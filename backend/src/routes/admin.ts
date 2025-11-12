// @ts-nocheck: route handlers use Hono context without typings to keep edits minimal
import { Hono } from "hono";
import {
  createInvoice,
  deleteInvoice,
  duplicateInvoice,
  getInvoiceById,
  getInvoices,
  publishInvoice,
  unpublishInvoice,
  updateInvoice,
} from "../controllers/invoices.ts";
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  getTemplates,
  installTemplateFromManifest,
  loadTemplateFromFile,
  renderTemplate,
  setDefaultTemplate,
} from "../controllers/templates.ts";
import {
  deleteSetting,
  getSetting,
  getSettings,
  setSetting,
  updateSettings,
} from "../controllers/settings.ts";
import {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  getCustomers,
  updateCustomer,
} from "../controllers/customers.ts";
import {
  createRateModifier,
  deleteRateModifier,
  getRateModifierById,
  getRateModifiers,
  updateRateModifier,
} from "../controllers/rate_modifiers.ts";
import { buildInvoiceHTML, generatePDF } from "../utils/pdf.ts";
import { generateUBLInvoiceXML } from "../utils/ubl.ts"; // legacy direct import
import { generateInvoiceXML, listXMLProfiles } from "../utils/xmlProfiles.ts";
import { availableInvoiceLocales } from "../i18n/translations.ts";
import { resetDatabaseFromDemo } from "../database/init.ts";
import { getNextInvoiceNumber } from "../database/init.ts";
import { getDatabase } from "../database/init.ts";
import { isDemoMode } from "../utils/env.ts";
import { requireAdminAuth } from "../middleware/auth.ts";

const adminRoutes = new Hono();

// Normalize tax-related settings coming from the client to robust canonical forms
function normalizeTaxSettingsPayload(data: Record<string, unknown>) {
  // defaultTaxRate: parse to finite non-negative number, store as canonical string
  if (data && Object.prototype.hasOwnProperty.call(data, "defaultTaxRate")) {
    const raw = String(
      (data as Record<string, unknown>)["defaultTaxRate"] ?? "",
    ).trim();
    const norm = raw.replace(",", ".");
    const n = Number(norm);
    if (!isFinite(n) || isNaN(n) || n < 0) {
      // Remove invalid value to avoid persisting junk
      delete (data as Record<string, unknown>)["defaultTaxRate"];
    } else {
      // Keep a trimmed canonical numeric string (avoid trailing spaces)
      (data as Record<string, unknown>)["defaultTaxRate"] = String(n);
    }
  }

  // defaultPricesIncludeTax: normalize to "true" | "false"
  if (
    data &&
    Object.prototype.hasOwnProperty.call(data, "defaultPricesIncludeTax")
  ) {
    const v = String(
      (data as Record<string, unknown>)["defaultPricesIncludeTax"] ?? "",
    ).toLowerCase().trim();
    const truthy = new Set(["1", "true", "yes", "y", "on"]);
    (data as Record<string, unknown>)["defaultPricesIncludeTax"] = truthy.has(v)
      ? "true"
      : "false";
  }

  // defaultRoundingMode: normalize to "line" | "total" (default line)
  if (
    data && Object.prototype.hasOwnProperty.call(data, "defaultRoundingMode")
  ) {
    const v = String(
      (data as Record<string, unknown>)["defaultRoundingMode"] ?? "",
    ).toLowerCase().trim();
    (data as Record<string, unknown>)["defaultRoundingMode"] = v === "total"
      ? "total"
      : "line";
  }
}

const SUPPORTED_LOCALES = new Set(availableInvoiceLocales());

function normalizeLocaleSettingPayload(data: Record<string, unknown>) {
  if (!data || !Object.prototype.hasOwnProperty.call(data, "locale")) {
    return;
  }
  const raw = String((data as Record<string, unknown>).locale ?? "").trim();
  if (!raw) {
    delete (data as Record<string, unknown>).locale;
    return;
  }
  const lower = raw.toLowerCase();
  if (SUPPORTED_LOCALES.has(lower)) {
    (data as Record<string, unknown>).locale = lower;
    return;
  }
  const base = lower.split("-")[0];
  if (SUPPORTED_LOCALES.has(base)) {
    (data as Record<string, unknown>).locale = base;
  } else {
    (data as Record<string, unknown>).locale = "en";
  }
}

// Demo mode flag (mutations allowed; periodic resets handle reverting state)
const DEMO_MODE = isDemoMode();

adminRoutes.use(
  "/invoices/*",
  requireAdminAuth,
);

adminRoutes.use(
  "/customers/*",
  requireAdminAuth,
);

adminRoutes.use(
  "/templates/*",
  requireAdminAuth,
);

adminRoutes.use(
  "/settings/*",
  requireAdminAuth,
);

// Protect admin alias routes as well
adminRoutes.use(
  "/admin/*",
  requireAdminAuth,
);

// Protect export routes
adminRoutes.use(
  "/export/*",
  requireAdminAuth,
);

// Demo helper: trigger an immediate reset (only effective when DEMO_MODE=true)
adminRoutes.post("/admin/demo/reset", (c) => {
  if (!DEMO_MODE) return c.json({ error: "Demo mode is not enabled" }, 400);
  try {
    resetDatabaseFromDemo();
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Invoice routes
adminRoutes.get("/invoices/next-number", (c) => {
  try {
    const next = getNextInvoiceNumber();
    return c.json({ next });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});
adminRoutes.post("/invoices", async (c) => {
  const data = await c.req.json();
  try {
    const invoice = createInvoice(data);
    return c.json(invoice);
  } catch (e) {
    const msg = String(e);
    if (/already exists/i.test(msg)) {
      return c.json({ error: msg }, 409);
    }
    return c.json({ error: msg }, 400);
  }
});

adminRoutes.get("/invoices", (c) => {
  const invoices = getInvoices();
  // Enrich with customer name and snake_case issue_date for UI compatibility
  const list = invoices.map((inv) => {
    let customerName: string | undefined = undefined;
    try {
      const customer = getCustomerById(inv.customerId);
      customerName = customer?.name;
    } catch (_e) { /* ignore */ }
    const issue_date = inv.issueDate
      ? new Date(inv.issueDate).toISOString().slice(0, 10)
      : undefined;
    return {
      ...inv,
      customer: customerName ? { name: customerName } : undefined,
      issue_date,
    } as unknown;
  });
  return c.json(list);
});

adminRoutes.get("/invoices/:id", (c) => {
  const id = c.req.param("id");
  const invoice = getInvoiceById(id);
  if (!invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }
  return c.json(invoice);
});

adminRoutes.put("/invoices/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  try {
    const invoice = await updateInvoice(id, data);
    return c.json(invoice);
  } catch (e) {
    const msg = String(e);
    if (/already exists/i.test(msg)) {
      return c.json({ error: msg }, 409);
    }
    return c.json({ error: msg }, 400);
  }
});

adminRoutes.delete("/invoices/:id", (c) => {
  const id = c.req.param("id");
  deleteInvoice(id);
  return c.json({ success: true });
});

adminRoutes.post("/invoices/:id/publish", async (c) => {
  const id = c.req.param("id");
  try {
    const result = await publishInvoice(id);
    return c.json(result);
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

adminRoutes.post("/invoices/:id/unpublish", async (c) => {
  const id = c.req.param("id");
  const result = await unpublishInvoice(id);
  return c.json(result);
});

adminRoutes.post("/invoices/:id/duplicate", async (c) => {
  const id = c.req.param("id");
  const copy = await duplicateInvoice(id);
  if (!copy) return c.json({ error: "Invoice not found" }, 404);
  return c.json(copy);
});

// Template routes
adminRoutes.get("/templates", async (c) => {
  let templates = await getTemplates();
  // Overlay the default from settings if present; also compute 'updatable' flag when a manifest source exists
  try {
    const settings = await getSettings();
    const map = settings.reduce((acc: Record<string, string>, s) => {
      acc[s.key] = s.value as string;
      return acc;
    }, {} as Record<string, string>);
    const current = map.templateId;
    if (current) {
      templates = templates.map((t) => ({
        ...t,
        isDefault: t.id === current,
        updatable: !!map[`templateSource:${t.id}`],
      }));
    } else {
      templates = templates.map((t) => ({
        ...t,
        updatable: !!map[`templateSource:${t.id}`],
      }));
    }
  } catch { /* ignore */ }
  return c.json(templates);
});

adminRoutes.post("/templates", async (c) => {
  const data = await c.req.json();
  const template = await createTemplate(data);
  return c.json(template);
});

// Install a template from a remote manifest URL (YAML or JSON)
adminRoutes.post("/templates/install-from-manifest", async (c) => {
  try {
    const { url } = await c.req.json();
    if (!url || typeof url !== "string") {
      return c.json({ error: "Missing 'url'" }, 400);
    }
    const t = await installTemplateFromManifest(url);
    try {
      // Remember the source manifest used for this template id to enable future updates
      setSetting(`templateSource:${t.id}`, url);
    } catch (_e) { /* non-fatal */ }
    return c.json(t);
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

// Update a template by id using its stored source manifest URL
adminRoutes.post("/templates/:id/update", async (c) => {
  const id = c.req.param("id");
  try {
    const src = await getSetting(`templateSource:${id}`);
    if (!src || typeof src !== "string") {
      return c.json({ error: "No stored manifest URL for this template" }, 404);
    }
    const updated = await installTemplateFromManifest(src);
    if (!updated || updated.id !== id) {
      return c.json({ error: "Manifest ID does not match template id" }, 400);
    }
    return c.json({ ok: true, template: updated });
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

// Delete a template (disallow removing built-in app templates)
adminRoutes.delete("/templates/:id", async (c) => {
  const id = c.req.param("id");
  // Built-in templates are protected
  const builtin = new Set(["professional-modern", "minimalist-clean"]);
  if (builtin.has(id)) {
    return c.json({ error: "Cannot delete built-in templates" }, 400);
  }

  // If this template is currently selected in settings, reset to minimalist-clean
  try {
    const current = await getSetting("templateId");
    if (current === id) {
      await setSetting("templateId", "minimalist-clean");
    }
  } catch (_e) {
    // non-fatal
  }

  try {
    await deleteTemplate(id);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Get template by ID
adminRoutes.get("/templates/:id", (c) => {
  const id = c.req.param("id");
  const template = getTemplateById(id);
  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }
  return c.json(template);
});

// Preview template with sample data
adminRoutes.post("/templates/:id/preview", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();

  const template = getTemplateById(id);
  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  // Add sample data if not provided
  const sampleData = {
    companyName: "Sample Company Inc",
    companyAddress: "123 Business St, City, State 12345",
    companyEmail: "contact@sample.com",
    companyPhone: "+1-555-123-4567",
    companyTaxId: "TAX123456",
    invoiceNumber: "INV-2025-001",
    issueDate: "2025-08-26",
    dueDate: "2025-09-25",
    currency: "USD",
    status: "draft",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    customerAddress: "456 Client Ave, City, State 54321",
    highlightColor: data.highlightColor || "#2563eb",
    highlightColorLight: data.highlightColorLight || "#dbeafe",
    subtotal: 2500.00,
    discountAmount: 250.00,
    discountPercentage: 10,
    taxRate: 8.5,
    taxAmount: 191.25,
    total: 2441.25,
    hasDiscount: true,
    hasTax: true,

    items: [
      {
        description: "Website Development",
        quantity: 1,
        unitPrice: 2500.00,
        lineTotal: 2500.00,
        notes: "Custom responsive website with modern design",
      },
    ],
    notes: "Thank you for your business! Payment is due within 30 days.",
    paymentTerms: "Net 30 days",
    paymentMethods: "Bank Transfer, Credit Card",
    bankAccount: "Account: 123-456-789, Routing: 987-654-321",
    ...data,
  };

  try {
    const renderedHtml = renderTemplate(template.html, sampleData);
    return new Response(renderedHtml, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    return c.json({
      error: "Failed to render template",
      details: String(error),
    }, 500);
  }
});

// Load template from file
adminRoutes.post("/templates/load-from-file", async (c) => {
  try {
    const { filePath, name, isDefault, highlightColor } = await c.req.json();

    const html = await loadTemplateFromFile(filePath);
    const template = await createTemplate({
      name,
      html,
      isDefault: isDefault || false,
    });

    return c.json({
      ...template,
      highlightColor: highlightColor || "#2563eb",
      message: "Template loaded successfully from file",
    });
  } catch (error) {
    return c.json({
      error: "Failed to load template from file",
      details: String(error),
    }, 500);
  }
});

// Settings routes
adminRoutes.get("/settings", async (c) => {
  const settings = await getSettings();
  const map = settings.reduce((acc: Record<string, string>, s) => {
    acc[s.key] = s.value as string;
    return acc;
  }, {} as Record<string, string>);
  // Provide normalized aliases expected by the frontend
  if (map.companyEmail && !map.email) map.email = map.companyEmail;
  if (map.companyPhone && !map.phone) map.phone = map.companyPhone;
  if (map.companyTaxId && !map.taxId) map.taxId = map.companyTaxId;
  if (map.companyCountryCode && !map.countryCode) {
    map.countryCode = map.companyCountryCode;
  }
  // Unify logo fields: prefer single 'logo'; hide legacy 'logoUrl'
  if (map.logoUrl && !map.logo) map.logo = map.logoUrl;
  if (map.logoUrl) delete map.logoUrl;
  if (!map.locale) map.locale = "en";
  // Expose demo mode to frontend UI
  (map as Record<string, unknown>).demoMode = DEMO_MODE ? "true" : "false";
  return c.json(map);
});

adminRoutes.put("/settings", async (c) => {
  const data = await c.req.json();
  // Normalize legacy logoUrl to logo
  if (typeof data.logoUrl === "string" && !data.logo) {
    data.logo = data.logoUrl;
    delete data.logoUrl;
  }
  // Normalize tax-related settings
  normalizeTaxSettingsPayload(data);
  normalizeLocaleSettingPayload(data);
  const settings = await updateSettings(data);
  try {
    if ("logoUrl" in data) deleteSetting("logoUrl");
  } catch (_e) { /* ignore legacy cleanup errors */ }
  // If default template changed, reflect in templates table
  if (typeof data.templateId === "string" && data.templateId) {
    try {
      setDefaultTemplate(String(data.templateId));
    } catch { /* ignore */ }
  }
  return c.json(settings);
});

// Partial update (PATCH) to merge provided keys only
adminRoutes.patch("/settings", async (c) => {
  const data = await c.req.json();
  // Normalize legacy logoUrl to logo
  if (typeof data.logoUrl === "string" && !data.logo) {
    data.logo = data.logoUrl;
    delete data.logoUrl;
  }
  // Normalize countryCode alias to companyCountryCode
  if (typeof data.countryCode === "string" && !data.companyCountryCode) {
    data.companyCountryCode = data.countryCode;
    delete data.countryCode;
  }
  // Normalize tax-related settings
  normalizeTaxSettingsPayload(data);
  normalizeLocaleSettingPayload(data);
  const settings = await updateSettings(data);
  if (typeof data.templateId === "string" && data.templateId) {
    try {
      setDefaultTemplate(String(data.templateId));
    } catch { /* ignore */ }
  }
  try {
    if ("logoUrl" in data) deleteSetting("logoUrl");
  } catch (_e) { /* ignore legacy cleanup errors */ }
  return c.json(settings);
});

// Optional admin-prefixed aliases for clarity/documentation parity
adminRoutes.get("/admin/settings", async (c) => {
  const settings = await getSettings();
  const map = settings.reduce((acc: Record<string, string>, s) => {
    acc[s.key] = s.value as string;
    return acc;
  }, {} as Record<string, string>);
  if (map.companyEmail && !map.email) map.email = map.companyEmail;
  if (map.companyPhone && !map.phone) map.phone = map.companyPhone;
  if (map.companyTaxId && !map.taxId) map.taxId = map.companyTaxId;
  if (map.companyCountryCode && !map.countryCode) {
    map.countryCode = map.companyCountryCode;
  }
  if (map.logoUrl && !map.logo) map.logo = map.logoUrl;
  if (map.logoUrl) delete map.logoUrl;
  if (!map.locale) map.locale = "en";
  // Expose demo mode to frontend UI for admin-prefixed route as well
  (map as Record<string, unknown>).demoMode = DEMO_MODE ? "true" : "false";
  return c.json(map);
});

adminRoutes.put("/admin/settings", async (c) => {
  const data = await c.req.json();
  if (typeof data.logoUrl === "string" && !data.logo) {
    data.logo = data.logoUrl;
    delete data.logoUrl;
  }
  // Normalize tax-related settings
  normalizeTaxSettingsPayload(data);
  normalizeLocaleSettingPayload(data);
  const settings = await updateSettings(data);
  try {
    if ("logoUrl" in data) deleteSetting("logoUrl");
  } catch (_e) { /* ignore legacy cleanup errors */ }
  return c.json(settings);
});

adminRoutes.patch("/admin/settings", async (c) => {
  const data = await c.req.json();
  if (typeof data.logoUrl === "string" && !data.logo) {
    data.logo = data.logoUrl;
    delete data.logoUrl;
  }
  // Normalize tax-related settings
  normalizeTaxSettingsPayload(data);
  normalizeLocaleSettingPayload(data);
  const settings = await updateSettings(data);
  try {
    if ("logoUrl" in data) deleteSetting("logoUrl");
  } catch (_e) { /* ignore legacy cleanup errors */ }
  return c.json(settings);
});

// Customer routes
adminRoutes.get("/customers", async (c) => {
  const customers = await getCustomers();
  return c.json(customers);
});

adminRoutes.get("/customers/:id", async (c) => {
  const id = c.req.param("id");
  const customer = await getCustomerById(id);
  if (!customer) {
    return c.json({ error: "Customer not found" }, 404);
  }
  return c.json(customer);
});

adminRoutes.post("/customers", async (c) => {
  const data = await c.req.json();
  const customer = await createCustomer(data);
  return c.json(customer);
});

adminRoutes.put("/customers/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const customer = await updateCustomer(id, data);
  return c.json(customer);
});

adminRoutes.delete("/customers/:id", async (c) => {
  const id = c.req.param("id");
  await deleteCustomer(id);
  return c.json({ success: true });
});

// Rate Modifier routes
adminRoutes.get("/rate-modifiers", async (c) => {
  const modifiers = await getRateModifiers();
  return c.json(modifiers);
});

adminRoutes.get("/rate-modifiers/:id", async (c) => {
  const id = c.req.param("id");
  const modifier = await getRateModifierById(id);
  if (!modifier) {
    return c.json({ error: "Rate modifier not found" }, 404);
  }
  return c.json(modifier);
});

adminRoutes.post("/rate-modifiers", async (c) => {
  const data = await c.req.json();
  const modifier = await createRateModifier(data);
  return c.json(modifier);
});

adminRoutes.put("/rate-modifiers/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const modifier = await updateRateModifier(id, data);
  if (!modifier) {
    return c.json({ error: "Rate modifier not found" }, 404);
  }
  return c.json(modifier);
});

adminRoutes.delete("/rate-modifiers/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await deleteRateModifier(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: String(error) }, 400);
  }
});

// Authenticated HTML/PDF generation for invoices by ID (no share token required)
adminRoutes.get("/invoices/:id/html", async (c) => {
  const id = c.req.param("id");
  const invoice = getInvoiceById(id);
  if (!invoice) {
    return c.json({ message: "Invoice not found" }, 404);
  }

  // Settings map
  const settings = await getSettings();
  const settingsMap = settings.reduce((acc: Record<string, string>, s) => {
    acc[s.key] = s.value as string;
    return acc;
  }, {} as Record<string, string>);
  if (!settingsMap.logo && settingsMap.logoUrl) {
    settingsMap.logo = settingsMap.logoUrl;
  }

  const businessSettings = {
    companyName: settingsMap.companyName || "Your Company",
    companyAddress: settingsMap.companyAddress || "",
    companyEmail: settingsMap.companyEmail || "",
    companyPhone: settingsMap.companyPhone || "",
    companyTaxId: settingsMap.companyTaxId || "",
    currency: settingsMap.currency || "USD",
    logo: settingsMap.logo,
    // brandLayout removed; always treating as logo-left in rendering
    paymentMethods: settingsMap.paymentMethods || "Bank Transfer",
    bankAccount: settingsMap.bankAccount || "",
    paymentTerms: settingsMap.paymentTerms || "Due in 30 days",
    defaultNotes: settingsMap.defaultNotes || "",
    locale: settingsMap.locale || undefined,
  };

  // Use template/highlight from settings only (no query overrides)
  const highlight = settingsMap.highlight ?? undefined;
  let selectedTemplateId: string | undefined = settingsMap.templateId
    ?.toLowerCase();
  if (
    selectedTemplateId === "professional" ||
    selectedTemplateId === "professional-modern"
  ) selectedTemplateId = "professional-modern";
  else if (
    selectedTemplateId === "minimalist" ||
    selectedTemplateId === "minimalist-clean"
  ) selectedTemplateId = "minimalist-clean";

  const html = buildInvoiceHTML(
    invoice,
    businessSettings,
    selectedTemplateId,
    highlight,
    settingsMap.dateFormat,
    settingsMap.numberFormat,
    settingsMap.locale,
  );
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});

adminRoutes.get("/invoices/:id/pdf", async (c) => {
  const id = c.req.param("id");
  const invoice = getInvoiceById(id);
  if (!invoice) {
    return c.json({ message: "Invoice not found" }, 404);
  }

  // Settings map
  const settings = await getSettings();
  const settingsMap = settings.reduce((acc: Record<string, string>, s) => {
    acc[s.key] = s.value as string;
    return acc;
  }, {} as Record<string, string>);
  if (!settingsMap.logo && settingsMap.logoUrl) {
    settingsMap.logo = settingsMap.logoUrl;
  }

  const businessSettings = {
    companyName: settingsMap.companyName || "Your Company",
    companyAddress: settingsMap.companyAddress || "",
    companyEmail: settingsMap.companyEmail || "",
    companyPhone: settingsMap.companyPhone || "",
    companyTaxId: settingsMap.companyTaxId || "",
    currency: settingsMap.currency || "USD",
    logo: settingsMap.logo,
    // brandLayout removed; always treating as logo-left in rendering
    paymentMethods: settingsMap.paymentMethods || "Bank Transfer",
    bankAccount: settingsMap.bankAccount || "",
    paymentTerms: settingsMap.paymentTerms || "Due in 30 days",
    defaultNotes: settingsMap.defaultNotes || "",
    locale: settingsMap.locale || undefined,
  };

  // Use template/highlight from settings only (no query overrides)
  const highlight = settingsMap.highlight ?? undefined;
  let selectedTemplateId: string | undefined = settingsMap.templateId
    ?.toLowerCase();
  if (
    selectedTemplateId === "professional" ||
    selectedTemplateId === "professional-modern"
  ) selectedTemplateId = "professional-modern";
  else if (
    selectedTemplateId === "minimalist" ||
    selectedTemplateId === "minimalist-clean"
  ) selectedTemplateId = "minimalist-clean";

  try {
    const embedXml =
      String(settingsMap.embedXmlInPdf || "false").toLowerCase() === "true";
    const xmlProfileId = settingsMap.xmlProfileId || "ubl21";
    const pdfBuffer = await generatePDF(
      invoice,
      businessSettings,
      selectedTemplateId,
      highlight,
      {
        embedXml,
        embedXmlProfileId: xmlProfileId,
        dateFormat: settingsMap.dateFormat,
        numberFormat: settingsMap.numberFormat,
        locale: settingsMap.locale,
      },
    );
    // Detect embedded attachments for diagnostics
    let hasAttachment = false;
    let attachmentNames: string[] = [];
    try {
      // Dynamically import to avoid import cycles
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(pdfBuffer);
      const maybe = (doc as unknown as {
        getAttachments?: () => Record<string, Uint8Array>;
      }).getAttachments?.();
      if (maybe && typeof maybe === "object") {
        attachmentNames = Object.keys(maybe);
        hasAttachment = attachmentNames.length > 0;
      }
    } catch (_e) { /* ignore */ }
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${
          invoice.invoiceNumber || id
        }.pdf"`,
        ...(hasAttachment
          ? {
            "X-Embedded-XML": "true",
            "X-Embedded-XML-Names": attachmentNames.join(","),
          }
          : { "X-Embedded-XML": "false" }),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("/invoices/:id/pdf failed:", msg);
    return c.json({ error: "Failed to generate PDF", details: msg }, 500);
  }
});

// UBL (PEPPOL BIS Billing 3.0) XML for an invoice by ID
adminRoutes.get("/invoices/:id/ubl.xml", async (c) => {
  const id = c.req.param("id");
  const invoice = getInvoiceById(id);
  if (!invoice) {
    return c.json({ message: "Invoice not found" }, 404);
  }

  const settings = await getSettings();
  const map = settings.reduce((acc: Record<string, string>, s) => {
    acc[s.key] = s.value as string;
    return acc;
  }, {} as Record<string, string>);

  const businessSettings = {
    companyName: map.companyName || "Your Company",
    companyAddress: map.companyAddress || "",
    companyEmail: map.companyEmail || "",
    companyPhone: map.companyPhone || "",
    companyTaxId: map.companyTaxId || "",
    currency: map.currency || "USD",
    logo: map.logo,
    paymentMethods: map.paymentMethods || "Bank Transfer",
    bankAccount: map.bankAccount || "",
    paymentTerms: map.paymentTerms || "Due in 30 days",
    defaultNotes: map.defaultNotes || "",
    companyCountryCode: map.companyCountryCode || "",
  };

  // Optional PEPPOL endpoint IDs if configured in settings
  const xml = generateUBLInvoiceXML(invoice, businessSettings, {
    sellerEndpointId: map.peppolSellerEndpointId,
    sellerEndpointSchemeId: map.peppolSellerEndpointSchemeId,
    buyerEndpointId: map.peppolBuyerEndpointId,
    buyerEndpointSchemeId: map.peppolBuyerEndpointSchemeId,
    sellerCountryCode: map.companyCountryCode,
    buyerCountryCode: invoice.customer.countryCode,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoice-${
        invoice.invoiceNumber || id
      }.xml"`,
    },
  });
});

// Generic XML export selecting an internal profile (?profile=ubl21 or stub-generic)
adminRoutes.get("/invoices/:id/xml", async (c) => {
  const id = c.req.param("id");
  const invoice = getInvoiceById(id);
  if (!invoice) return c.json({ message: "Invoice not found" }, 404);

  const settings = await getSettings();
  const map = settings.reduce((acc: Record<string, string>, s) => {
    acc[s.key] = s.value as string;
    return acc;
  }, {} as Record<string, string>);

  const businessSettings = {
    companyName: map.companyName || "Your Company",
    companyAddress: map.companyAddress || "",
    companyEmail: map.companyEmail || "",
    companyPhone: map.companyPhone || "",
    companyTaxId: map.companyTaxId || "",
    currency: map.currency || "USD",
    logo: map.logo,
    paymentMethods: map.paymentMethods || "Bank Transfer",
    bankAccount: map.bankAccount || "",
    paymentTerms: map.paymentTerms || "Due in 30 days",
    defaultNotes: map.defaultNotes || "",
    companyCountryCode: map.companyCountryCode || "",
  };

  const url = new URL(c.req.url);
  const profileParam = url.searchParams.get("profile") || map.xmlProfileId ||
    undefined;
  const { xml, profile } = generateInvoiceXML(
    profileParam,
    invoice,
    businessSettings,
    {
      sellerEndpointId: map.peppolSellerEndpointId,
      sellerEndpointSchemeId: map.peppolSellerEndpointSchemeId,
      buyerEndpointId: map.peppolBuyerEndpointId,
      buyerEndpointSchemeId: map.peppolBuyerEndpointSchemeId,
      sellerCountryCode: map.companyCountryCode,
      buyerCountryCode: invoice.customer.countryCode,
    },
  );

  return new Response(xml, {
    headers: {
      "Content-Type": `${profile.mediaType}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="invoice-${
        invoice.invoiceNumber || id
      }.${profile.fileExtension}"`,
    },
  });
});

// List built-in XML profiles
adminRoutes.get("/xml-profiles", (c) => {
  const profiles = listXMLProfiles().map((p) => ({
    id: p.id,
    name: p.name,
    mediaType: p.mediaType,
    fileExtension: p.fileExtension,
    experimental: !!p.experimental,
    builtIn: true,
  }));
  return c.json(profiles);
});

export { adminRoutes };

// Export all data (DB file, JSON dump, installed template assets) as a tar.gz
adminRoutes.get("/export/full", async (c) => {
  // Parse options: includeDb (default true), includeJson (default true), includeAssets (default true)
  const url = new URL(c.req.url);
  const includeDb =
    (url.searchParams.get("includeDb") ?? "true").toLowerCase() !== "false";
  const includeJson =
    (url.searchParams.get("includeJson") ?? "true").toLowerCase() !== "false";
  const includeAssets =
    (url.searchParams.get("includeAssets") ?? "true").toLowerCase() !== "false";

  // Resolve active DB path
  const dbPath = Deno.env.get("DATABASE_PATH") || "./invio.db";

  // Create a staging temp dir
  let tmpDir = "";
  let outPath = "";
  try {
    tmpDir = await Deno.makeTempDir({ prefix: "invio-export-" });
    // Optionally copy DB file
    if (includeDb) {
      try {
        await Deno.copyFile(dbPath, `${tmpDir}/invio.db`);
      } catch (e) {
        console.warn("Export: could not copy DB file:", e);
      }
    }

    // Optionally dump JSON
    if (includeJson) {
      try {
        const db = getDatabase();
        const q = (sql: string, params: unknown[] = []) =>
          db.query(sql, params) as unknown[][];
        // settings as map
        const settingsRows = q("SELECT key, value FROM settings");
        const settings: Record<string, string> = {};
        for (const r of settingsRows) {
          settings[String(r[0])] = String(r[1] ?? "");
        }

        const customers = q(
          "SELECT id, name, email, phone, address, country_code, tax_id, created_at FROM customers ORDER BY created_at DESC",
        ).map((r) => ({
          id: String(r[0]),
          name: String(r[1]),
          email: r[2] ?? null,
          phone: r[3] ?? null,
          address: r[4] ?? null,
          countryCode: r[5] ?? null,
          taxId: r[6] ?? null,
          createdAt: r[7],
        }));
        const invoices = q(
          "SELECT id, invoice_number, customer_id, issue_date, due_date, currency, status, subtotal, discount_amount, discount_percentage, tax_rate, tax_amount, total, payment_terms, notes, share_token, created_at, updated_at, prices_include_tax, rounding_mode FROM invoices ORDER BY created_at DESC",
        ).map((r) => ({
          id: r[0],
          invoiceNumber: r[1],
          customerId: r[2],
          issueDate: r[3],
          dueDate: r[4],
          currency: r[5],
          status: r[6],
          subtotal: r[7],
          discountAmount: r[8],
          discountPercentage: r[9],
          taxRate: r[10],
          taxAmount: r[11],
          total: r[12],
          paymentTerms: r[13],
          notes: r[14],
          shareToken: r[15],
          createdAt: r[16],
          updatedAt: r[17],
          pricesIncludeTax: r[18],
          roundingMode: r[19],
        }));
        const items = q(
          "SELECT id, invoice_id, description, quantity, unit_price, line_total, notes, sort_order FROM invoice_items ORDER BY invoice_id, sort_order",
        ).map((r) => ({
          id: r[0],
          invoiceId: r[1],
          description: r[2],
          quantity: r[3],
          unitPrice: r[4],
          lineTotal: r[5],
          notes: r[6],
          sortOrder: r[7],
        }));
        const itemTaxes = q(
          "SELECT id, invoice_item_id, tax_definition_id, percent, taxable_amount, amount, included, sequence, note, created_at FROM invoice_item_taxes ORDER BY created_at",
        ).map((r) => ({
          id: r[0],
          invoiceItemId: r[1],
          taxDefinitionId: r[2],
          percent: r[3],
          taxableAmount: r[4],
          amount: r[5],
          included: r[6],
          sequence: r[7],
          note: r[8],
          createdAt: r[9],
        }));
        const invoiceTaxes = q(
          "SELECT id, invoice_id, tax_definition_id, percent, taxable_amount, tax_amount, created_at FROM invoice_taxes ORDER BY created_at",
        ).map((r) => ({
          id: r[0],
          invoiceId: r[1],
          taxDefinitionId: r[2],
          percent: r[3],
          taxableAmount: r[4],
          taxAmount: r[5],
          createdAt: r[6],
        }));
        const templates = q(
          "SELECT id, name, html, is_default, created_at FROM templates ORDER BY created_at DESC",
        ).map((r) => ({
          id: r[0],
          name: r[1],
          html: r[2],
          isDefault: r[3],
          createdAt: r[4],
        }));

        const json = {
          exportedAt: new Date().toISOString(),
          settings,
          customers,
          invoices,
          invoiceItems: items,
          invoiceItemTaxes: itemTaxes,
          invoiceTaxes,
          templates,
        };
        await Deno.writeTextFile(
          `${tmpDir}/data.json`,
          JSON.stringify(json, null, 2),
        );
      } catch (e) {
        console.warn("Export: JSON dump failed:", e);
      }
    }

    // Optionally copy installed template assets directory
    if (includeAssets) {
      const src = "./data/templates";
      const dest = `${tmpDir}/templates`;
      try {
        // Only copy if exists
        const s = await Deno.stat(src).catch(() => null);
        if (s && s.isDirectory) {
          await copyDirRecursive(src, dest);
        }
      } catch (e) {
        console.warn("Export: copying template assets failed:", e);
      }
    }

    // Create tar.gz from tmpDir contents. Important: write the archive OUTSIDE tmpDir
    // to avoid tar including its own output ("file changed as we read it").
    const ts = new Date();
    const y = String(ts.getFullYear());
    const m = String(ts.getMonth() + 1).padStart(2, "0");
    const d = String(ts.getDate()).padStart(2, "0");
    const hh = String(ts.getHours()).padStart(2, "0");
    const mm = String(ts.getMinutes()).padStart(2, "0");
    const ss = String(ts.getSeconds()).padStart(2, "0");
    const fileName = `invio-export-${y}${m}${d}-${hh}${mm}${ss}.tar.gz`;
    outPath = await Deno.makeTempFile({
      prefix: "invio-export-",
      suffix: ".tar.gz",
    });
    const cmd = new Deno.Command("tar", {
      args: ["-czf", outPath, "-C", tmpDir, "."],
      stdout: "piped",
      stderr: "piped",
    });
    const result = await cmd.output();
    if (result.code !== 0) {
      const err = new TextDecoder().decode(result.stderr);
      throw new Error(`tar failed: ${err}`);
    }

    // Read and return the tar.gz
    const bytes = await Deno.readFile(outPath);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("/export/full failed:", e);
    return c.json({ error: "Failed to export data", details: String(e) }, 500);
  } finally {
    // Best-effort cleanup; keep tar result inside tmpDir so removal takes it too
    if (tmpDir) {
      try {
        await Deno.remove(tmpDir, { recursive: true });
      } catch { /* ignore */ }
    }
    if (outPath) {
      try {
        await Deno.remove(outPath);
      } catch { /* ignore */ }
    }
  }
});

// Recursive directory copy helper
async function copyDirRecursive(src: string, dest: string) {
  await Deno.mkdir(dest, { recursive: true });
  for await (const entry of Deno.readDir(src)) {
    const from = `${src}/${entry.name}`;
    const to = `${dest}/${entry.name}`;
    if (entry.isDirectory) {
      await copyDirRecursive(from, to);
    } else if (entry.isFile) {
      await Deno.copyFile(from, to);
    } else if (entry.isSymlink) {
      try {
        const target = await Deno.readLink(from);
        await Deno.symlink(target, to);
      } catch {
        // skip problematic symlinks
      }
    }
  }
}
