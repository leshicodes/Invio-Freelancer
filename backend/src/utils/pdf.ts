import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFString,
} from "pdf-lib";
// Use Puppeteer (headless Chrome) for HTML -> PDF rendering instead of wkhtmltopdf
import puppeteer from "puppeteer-core";
import { generateInvoiceXML } from "./xmlProfiles.ts";
import {
  BusinessSettings,
  InvoiceWithDetails,
  TemplateContext,
} from "../types/index.ts";
import {
  getTemplateById,
  renderTemplate as renderTpl,
} from "../controllers/templates.ts";
import { getDefaultTemplate } from "../controllers/templates.ts";
import { resolveChromiumLaunchConfig } from "./chromium.ts";
import { getInvoiceLabels } from "../i18n/translations.ts";
import { getDatabase } from "../database/init.ts";
// pdf-lib is used to embed XML attachments and tweak metadata after rendering

// ---- Basic color helpers ----
function normalizeHex(hex?: string): string | undefined {
  if (!hex) return undefined;
  const h = hex.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(h)) return h.startsWith("#") ? h : `#${h}`;
  return undefined;
}

function escapeHtml(value: unknown): string {
  const str = value === undefined || value === null ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function _escapeHtmlWithBreaks(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isPrivateIPv4Host(hostname: string): boolean {
  const parts = hostname.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIPv6Host(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fd") || lower.startsWith("fc")) return true;
  if (lower.startsWith("fe80")) return true;
  return false;
}

function tryParseSafeRemoteUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return null;
  if (isPrivateIPv4Host(host) || isPrivateIPv6Host(host)) return null;
  return url;
}

function lighten(hex: string, amount = 0.85): string {
  const n = normalizeHex(hex) ?? "#2563eb";
  const m = n.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const rr = mix(r).toString(16).padStart(2, "0");
  const gg = mix(g).toString(16).padStart(2, "0");
  const bb = mix(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function formatDate(d?: Date, format: string = "YYYY-MM-DD") {
  if (!d) return undefined;
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  if (format === "DD.MM.YYYY") {
    return `${day}.${month}.${year}`;
  }
  // Default to YYYY-MM-DD
  return `${year}-${month}-${day}`;
}

// Support a single stored 'logo' setting; 'logoUrl' here is a derived, inlined data URL for rendering robustness
type WithLogo = BusinessSettings & {
  logo?: string;
  logoUrl?: string;
  brandLayout?: string;
};

function formatMoney(
  value: number,
  currency: string,
  numberFormat: "comma" | "period" = "comma"
): string {
  // Create a custom locale based on the number format preference
  let locale: string;
  let options: Intl.NumberFormatOptions;

  if (numberFormat === "period") {
    // European style: 1.000,00
    locale = "de-DE"; // German locale uses period as thousands separator and comma as decimal
    options = { style: "currency", currency };
  } else {
    // US style: 1,000.00
    locale = "en-US";
    options = { style: "currency", currency };
  }

  return new Intl.NumberFormat(locale, options).format(value);
}

async function inlineLogoIfPossible(
  settings?: BusinessSettings,
): Promise<BusinessSettings | undefined> {
  if (!settings?.logo) return settings;
  const url = settings.logo.trim();
  if (url.startsWith("data:")) {
    return { ...settings, logoUrl: url } as unknown as BusinessSettings;
  }

  const toDataUrl = (bytes: Uint8Array, mime = "image/png") => {
    const base64 = btoa(String.fromCharCode(...bytes));
    return `data:${mime};base64,${base64}`;
  };

  try {
    const remote = tryParseSafeRemoteUrl(url);
    if (remote) {
      const res = await fetch(remote);
      if (!res.ok) return settings;
      const buf = new Uint8Array(await res.arrayBuffer());
      const mime = res.headers.get("content-type") ?? "image/png";
      return {
        ...settings,
        logoUrl: toDataUrl(buf, mime),
      } as unknown as BusinessSettings;
    }
    // Attempt local file read (prevent traversal)
    if (url.includes("..")) {
      return settings;
    }
    const file = await Deno.readFile(url);
    let mime = "image/png";
    if (url.endsWith(".jpg") || url.endsWith(".jpeg")) mime = "image/jpeg";
    if (url.endsWith(".svg")) mime = "image/svg+xml";
    return {
      ...settings,
      logoUrl: toDataUrl(file, mime),
    } as unknown as BusinessSettings;
  } catch (_e) {
    return settings; // keep original
  }
}

function buildContext(
  invoice: InvoiceWithDetails,
  settings?: BusinessSettings & { logoUrl?: string; brandLayout?: string },
  _highlight?: string,
  dateFormat?: string,
  numberFormat?: "comma" | "period",
  localeOverride?: string,
): TemplateContext & { logoUrl?: string; brandLogoLeft?: boolean } {
  const requestedLocale = localeOverride ?? invoice.locale ?? settings?.locale;
  const { locale: resolvedLocale, labels } = getInvoiceLabels(requestedLocale);
  const currency = invoice.currency || settings?.currency || "USD";
  // Build tax summary from normalized taxes if present
  let taxSummary = (invoice.taxes && invoice.taxes.length > 0)
    ? invoice.taxes.map((t) => ({
      label: `${labels.taxLabel} ${t.percent}%`,
      percent: t.percent,
      taxable: formatMoney(t.taxableAmount, currency, numberFormat || "comma"),
      amount: formatMoney(t.taxAmount, currency, numberFormat || "comma"),
    }))
    : undefined;
  // Fallback: synthesize a single-row summary from invoice-level taxRate
  if ((!taxSummary || taxSummary.length === 0) && (invoice.taxAmount > 0)) {
    const percent = invoice.taxRate || 0;
    const taxableBase = Math.max(
      0,
      (invoice.subtotal || 0) - (invoice.discountAmount || 0),
    );
    taxSummary = [{
      label: `${labels.taxLabel} ${percent}%`,
      percent,
      taxable: formatMoney(taxableBase, currency, numberFormat || "comma"),
      amount: formatMoney(invoice.taxAmount, currency, numberFormat || "comma"),
    }];
  }
  return {
    // Company
    companyName: settings?.companyName || "Your Company",
    companyAddress: settings?.companyAddress || "",
    companyEmail: settings?.companyEmail || "",
    companyPhone: settings?.companyPhone || "",
    companyTaxId: settings?.companyTaxId || "",

    // Invoice
    invoiceNumber: invoice.invoiceNumber,
    issueDate: formatDate(invoice.issueDate, dateFormat)!,
    dueDate: formatDate(invoice.dueDate, dateFormat),
    currency,
    status: invoice.status,

    // Customer
    customerName: invoice.customer.name,
    customerContactName: invoice.customer.contactName,
    customerEmail: invoice.customer.email,
    customerPhone: invoice.customer.phone,
    customerAddress: invoice.customer.address,
    customerTaxId: invoice.customer.taxId,

    // Items
    items: invoice.items.map((i) => {
      // Fetch rate modifier details if present
      let rateModifierName = "";
      let rateModifierMultiplier = "";
      if (i.rateModifierId) {
        try {
          const db = getDatabase();
          const result = db.query(
            "SELECT name, multiplier FROM rate_modifiers WHERE id = ?",
            [i.rateModifierId],
          ) as unknown[][];
          if (result.length > 0) {
            rateModifierName = String(result[0][0]);
            rateModifierMultiplier = String(result[0][1]);
          }
        } catch (e) {
          console.error("Failed to fetch rate modifier:", e);
        }
      }
      
      return {
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice !== undefined
          ? formatMoney(i.unitPrice, currency, numberFormat || "comma")
          : undefined,
        lineTotal: formatMoney(i.lineTotal, currency, numberFormat || "comma"),
        notes: i.notes,
        // Time-based fields
        hours: i.hours,
        rate: i.rate !== undefined
          ? formatMoney(i.rate, currency, numberFormat || "comma")
          : undefined,
        rateModifierName,
        rateModifierMultiplier,
        distance: i.distance,
      };
    }),

    // Totals
    subtotal: formatMoney(invoice.subtotal, currency, numberFormat || "comma"),
    discountAmount: invoice.discountAmount > 0
      ? formatMoney(invoice.discountAmount, currency, numberFormat || "comma")
      : undefined,
    discountPercentage: invoice.discountPercentage || undefined,
    taxRate: invoice.taxRate || undefined,
    taxAmount: invoice.taxAmount > 0 ? formatMoney(invoice.taxAmount, currency, numberFormat || "comma") : undefined,
    total: formatMoney(invoice.total, currency, numberFormat || "comma"),
    taxSummary,
    hasTaxSummary: Boolean(taxSummary && taxSummary.length > 0),
    // Net subtotal (taxable base after discount, before tax) for convenience
    netSubtotal: formatMoney(
      Math.max(0, (invoice.subtotal || 0) - (invoice.discountAmount || 0)),
      currency,
      numberFormat || "comma",
    ),

    // Flags
    hasDiscount: invoice.discountAmount > 0,
    hasTax: invoice.taxAmount > 0,

    // Payment
    paymentTerms: invoice.paymentTerms || settings?.paymentTerms || undefined,
    paymentMethods: settings?.paymentMethods || undefined,
    bankAccount: settings?.bankAccount || undefined,

    // Notes
    notes: invoice.notes || settings?.defaultNotes || undefined,

    // Internationalization
    locale: resolvedLocale,
    labels,

    // Non-mustache extras consumed by templates
    // Prefer inlined data URL if available; otherwise pass through the provided logo value
    logoUrl: (settings as WithLogo | undefined)?.logoUrl ||
      (settings as WithLogo | undefined)?.logo,
    // Permanently use logo-left layout
    brandLogoLeft: true,
  } as TemplateContext & { logoUrl?: string; brandLogoLeft?: boolean };
}

export async function generateInvoicePDF(
  invoiceData: InvoiceWithDetails,
  businessSettings?: BusinessSettings,
  templateId?: string,
  customHighlightColor?: string,
  opts?: { embedXmlProfileId?: string; embedXml?: boolean; xmlOptions?: Record<string, unknown>; dateFormat?: string; numberFormat?: "comma" | "period"; locale?: string },
): Promise<Uint8Array> {
  // Inline remote logo when possible for robust HTML rendering
  const inlined = await inlineLogoIfPossible(businessSettings);
  const html = buildInvoiceHTML(
    invoiceData,
    inlined,
    templateId,
    customHighlightColor,
    opts?.dateFormat,
    opts?.numberFormat,
    opts?.locale ?? invoiceData.locale ?? inlined?.locale,
  );
  // First, attempt Puppeteer-based rendering
  let pdfBytes = await tryPuppeteerPdf(html);
  if (!pdfBytes) {
    throw new Error(
      "Chromium-based PDF rendering failed. Install Google Chrome/Chromium or set PUPPETEER_EXECUTABLE_PATH.",
    );
  }

  const pdfaResult = await convertPdfToPdfA3(pdfBytes);
  if (pdfaResult) {
    pdfBytes = pdfaResult;
  } else {
    console.warn(
      "Ghostscript PDF/A-3 conversion unavailable or failed; continuing with source PDF.",
    );
  }

  // Optionally embed XML profile as an attachment if requested and we have a PDF (browser or fallback)
  if (pdfBytes && opts?.embedXml) {
    try {
      const profileId = opts.embedXmlProfileId || "ubl21";
      const { xml, profile } = generateInvoiceXML(profileId, invoiceData, inlined || ({} as BusinessSettings));
      const fileName = `invoice-${invoiceData.invoiceNumber || invoiceData.id}.${profile.fileExtension}`;
      const xmlBytes = new TextEncoder().encode(xml);
      pdfBytes = await embedXmlAttachment(
        pdfBytes,
        xmlBytes,
        fileName,
        profile.mediaType || "application/xml",
        `${profile.name} export embedded by Invio`,
        opts?.locale || invoiceData.locale || inlined?.locale || "en-US",
      );
    } catch (error) {
      console.warn("Failed to embed XML attachment:", error);
      // Continue without attachment to avoid breaking download
    }
  }
  return pdfBytes as Uint8Array;
}

export function buildInvoiceHTML(
  invoice: InvoiceWithDetails,
  settings?: BusinessSettings,
  templateId?: string,
  highlight?: string,
  dateFormat?: string,
  numberFormat?: "comma" | "period",
  localeOverride?: string,
): string {
  const ctx = buildContext(
    invoice,
    settings,
    highlight,
    dateFormat,
    numberFormat,
    localeOverride,
  );
  const hl = normalizeHex(highlight) || "#2563eb";
  const hlLight = lighten(hl, 0.86);

  let template;
  if (templateId) {
    try {
      template = getTemplateById(templateId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to load template ${templateId}: ${message}`);
    }
  }

  const fallbackTemplate = template ?? getDefaultTemplate();
  if (!fallbackTemplate) {
    throw new Error(
      "No invoice templates available. Ensure database migrations have seeded templates.",
    );
  }

  return renderTpl(fallbackTemplate.html, {
    ...ctx,
    highlightColor: hl,
    highlightColorLight: hlLight,
  });
}

async function tryPuppeteerPdf(html: string): Promise<Uint8Array | null> {
  try {
    const { executablePath, channel } = await resolveChromiumLaunchConfig();
    const launchOptions: NonNullable<Parameters<typeof puppeteer.launch>[0]> = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--font-render-hinting=medium",
        "--disable-dev-shm-usage",
      ],
    };

    if (executablePath) {
      launchOptions.executablePath = executablePath;
    } else if (channel) {
      (launchOptions as { channel?: string }).channel = channel;
    }

    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
      });
      return new Uint8Array(pdf);
    } finally {
      await browser.close();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Puppeteer PDF render failed:", msg);
    return null;
  }
}

async function resolveGhostscriptExecutable(): Promise<string | null> {
  const candidates: string[] = [];
  try {
    const configured = Deno.env.get("GHOSTSCRIPT_BIN");
    if (configured && configured.trim().length > 0) {
      candidates.push(configured);
    }
  } catch { /* ignore env access errors */ }
  candidates.push("gs", "gswin64c", "gswin32c");

  for (const candidate of candidates) {
    try {
      const probe = new Deno.Command(candidate, {
        args: ["-version"],
        stdout: "piped",
        stderr: "piped",
      });
      const { success } = await probe.output();
      if (success) return candidate;
    } catch (_err) {
      // ignore and continue searching
    }
  }
  return null;
}

async function convertPdfToPdfA3(pdfBytes: Uint8Array): Promise<Uint8Array | null> {
  const ghostscript = await resolveGhostscriptExecutable();
  if (!ghostscript) return null;

  const inputPath = await Deno.makeTempFile({ prefix: "invio-pdfa-src-", suffix: ".pdf" });
  const outputPath = await Deno.makeTempFile({ prefix: "invio-pdfa-out-", suffix: ".pdf" });
  await Deno.writeFile(inputPath, pdfBytes);

  const args = [
    "-dNOPAUSE",
    "-dBATCH",
    "-dSAFER",
    "-sDEVICE=pdfwrite",
    "-dPDFA=3",
    "-dUseCIEColor",
    "-dEmbedAllFonts=true",
    "-dCompressFonts=true",
    "-sProcessColorModel=DeviceRGB",
    "-sColorConversionStrategy=UseDeviceIndependentColor",
    "-sDefaultRGBProfile=srgb.icc",
    "-sPDFAICCProfile=srgb.icc",
    "-dPDFACompatibilityPolicy=1",
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];

  try {
    const cmd = new Deno.Command(ghostscript, {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    const { success, stderr } = await cmd.output();
    if (!success) {
      console.error(
        "Ghostscript PDF/A-3 conversion failed:",
        new TextDecoder().decode(stderr),
      );
      return null;
    }
    const converted = await Deno.readFile(outputPath);
    return converted;
  } catch (err) {
    console.error("Ghostscript PDF/A-3 conversion error:", err);
    return null;
  } finally {
    try {
      await Deno.remove(inputPath);
    } catch { /* ignore cleanup failures */ }
    try {
      await Deno.remove(outputPath);
    } catch { /* ignore cleanup failures */ }
  }
}

async function embedXmlAttachment(
  pdfBytes: Uint8Array,
  xmlBytes: Uint8Array,
  fileName: string,
  mediaType: string,
  description: string,
  docLang?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const context = pdfDoc.context;
  const now = new Date();
  const paramsDict = context.obj({
    Size: PDFNumber.of(xmlBytes.length),
    CreationDate: PDFString.fromDate(now),
    ModDate: PDFString.fromDate(now),
  });

  const subtypeName = mediaType.includes("/")
    ? mediaType.replace("/", "#2F")
    : mediaType;

  const embeddedFileStream = context.stream(xmlBytes, {
    Type: PDFName.of("EmbeddedFile"),
    Subtype: PDFName.of(subtypeName),
    Params: paramsDict,
  });
  const embeddedFileRef = context.register(embeddedFileStream);

  const efDict = context.obj({
    F: embeddedFileRef,
    UF: embeddedFileRef,
  });

  const fileSpecDict = context.obj({
    Type: PDFName.of("Filespec"),
    F: PDFString.of(fileName),
    UF: PDFString.of(fileName),
    EF: efDict,
    Desc: PDFString.of(description),
    AFRelationship: PDFName.of("Data"),
  });
  const fileSpecRef = context.register(fileSpecDict);

  let namesDict = pdfDoc.catalog.get(PDFName.of("Names"));
  if (!(namesDict instanceof PDFDict)) {
    const created = context.obj({});
    pdfDoc.catalog.set(PDFName.of("Names"), created);
    namesDict = created;
  }
  const namesDictObj = namesDict as PDFDict;

  let embeddedFilesDict = namesDictObj.get(PDFName.of("EmbeddedFiles"));
  if (!(embeddedFilesDict instanceof PDFDict)) {
    const created = context.obj({});
    namesDictObj.set(PDFName.of("EmbeddedFiles"), created);
    embeddedFilesDict = created;
  }
  const embeddedFilesDictObj = embeddedFilesDict as PDFDict;

  let namesArray = embeddedFilesDictObj.get(PDFName.of("Names"));
  if (!(namesArray instanceof PDFArray)) {
    const created = context.obj([]);
    embeddedFilesDictObj.set(PDFName.of("Names"), created);
    namesArray = created;
  }
  const namesArrayObj = namesArray as PDFArray;
  namesArrayObj.push(PDFString.of(fileName));
  namesArrayObj.push(fileSpecRef);

  let afArray = pdfDoc.catalog.get(PDFName.of("AF"));
  if (!(afArray instanceof PDFArray)) {
    const created = context.obj([]);
    pdfDoc.catalog.set(PDFName.of("AF"), created);
    afArray = created;
  }
  const afArrayObj = afArray as PDFArray;
  afArrayObj.push(fileSpecRef);

  pdfDoc.setSubject(`Embedded XML: ${fileName}`);
  pdfDoc.setKeywords(["Invoice", "Embedded XML", fileName]);
  pdfDoc.setModificationDate(now);
  if (docLang) {
    pdfDoc.catalog.set(PDFName.of("Lang"), PDFString.of(docLang));
  }

  return pdfDoc.save({ useObjectStreams: false });
}

// Alias for backward compatibility
export const generatePDF = generateInvoicePDF;
