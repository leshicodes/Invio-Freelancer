import { Handlers, PageProps } from "$fresh/server.ts";
import { Layout } from "../../components/Layout.tsx";
import { InvoiceEditor } from "../../components/InvoiceEditor.tsx";
import InvoiceFormButton from "../../islands/InvoiceFormButton.tsx";

import {
  backendGet,
  backendPost,
  getAuthHeaderFromCookie,
} from "../../utils/backend.ts";
import { useTranslations } from "../../i18n/context.tsx";

type Customer = { 
  id: string; 
  name: string;
  defaultHourlyRate?: number;
};
type Data = {
  authed: boolean;
  customers?: Customer[];
  currency?: string;
  paymentTerms?: string;
  defaultNotes?: string;
  defaultTaxRate?: number;
  defaultPricesIncludeTax?: boolean;
  defaultRoundingMode?: string;
  numberFormat?: string;
  error?: string;
  invoiceNumberError?: string;
  invoiceNumberPrefill?: string;
};

type Item = {
  description: string;
  hours?: number;
  rate?: number;
  rateModifierId?: string;
  distance?: number;
  quantity?: number; // Backward compatibility
  unitPrice?: number; // Backward compatibility
  notes?: string;
  taxes?: { percent: number }[];
};

export const handler: Handlers<Data> = {
  async GET(req, ctx) {
    const auth = getAuthHeaderFromCookie(
      req.headers.get("cookie") || undefined,
    );
    if (!auth) {
      return new Response(null, {
        status: 303,
        headers: { Location: "/login" },
      });
    }
    try {
      // Load customers and settings in parallel to get default currency
      const [customers, settings] = await Promise.all([
        backendGet("/api/v1/customers", auth) as Promise<Customer[]>,
        backendGet("/api/v1/settings", auth) as Promise<Record<string, string>>,
      ]);
      const currency = (settings && settings.currency)
        ? settings.currency
        : "USD";
      const paymentTerms = settings?.paymentTerms || "Due in 30 days";
      const defaultNotes = settings?.defaultNotes || "";
      const defaultTaxRate = Number(settings?.defaultTaxRate || 0) || 0;
      const defaultPricesIncludeTax =
        String(settings?.defaultPricesIncludeTax || "false").toLowerCase() ===
          "true";
      const defaultRoundingMode = settings?.defaultRoundingMode || "line";
      const numberFormat = settings?.numberFormat || "comma";
      // Fetch next invoice number (if numbering pattern configured) to prefill
      let invoiceNumberPrefill: string | undefined = undefined;
      try {
        // Only prefill when advanced numbering pattern is configured and enabled
        const numberingEnabled =
          String(settings?.invoiceNumberingEnabled ?? "true").toLowerCase() !==
            "false";
        if (numberingEnabled && settings?.invoiceNumberPattern) {
          const nextResp = await backendGet(
            "/api/v1/invoices/next-number",
            auth,
          ) as { next?: string };
          if (nextResp && nextResp.next) invoiceNumberPrefill = nextResp.next;
        }
      } catch (_e) { /* ignore prefill failure */ }
      return ctx.render({
        authed: true,
        customers,
        currency,
        paymentTerms,
        defaultNotes,
        defaultTaxRate,
        defaultPricesIncludeTax,
        defaultRoundingMode,
        numberFormat,
        invoiceNumberPrefill,
      });
    } catch (e) {
      return ctx.render({ authed: true, error: String(e) });
    }
  },
  async POST(req, ctx) {
    const auth = getAuthHeaderFromCookie(
      req.headers.get("cookie") || undefined,
    );
    if (!auth) {
      return new Response(null, {
        status: 303,
        headers: { Location: "/login" },
      });
    }
  const form = await req.formData();
  let customerId = String(form.get("customerId") || "");
    let currency = String(form.get("currency") || "");
    const status = String(form.get("status") || "draft") as
      | "draft"
      | "sent"
      | "paid"
      | "overdue";
    const issueDate = String(
      form.get("issueDate") || new Date().toISOString().slice(0, 10),
    );
    const dueDate = String(form.get("dueDate") || "");
    const notes = String(form.get("notes") || "");
    const paymentTerms = String(form.get("paymentTerms") || "");
    const taxRate = Number(form.get("taxRate") || 0) || 0;
    const pricesIncludeTax =
      String(form.get("pricesIncludeTax") || "false") === "true";
    const roundingMode = String(form.get("roundingMode") || "line");
    const taxMode = String(form.get("taxMode") || "invoice") as
      | "invoice"
      | "line";

    const items: Item[] = [];
    let i = 0;
    while (form.has(`item_${i}_description`)) {
      const description = form.get(`item_${i}_description`) as string;
      if (!description || description.trim() === "") {
        i++;
        continue;
      }
      
      // Time-based billing fields
      const hours = parseFloat(
        (form.get(`item_${i}_hours`) as string) || "0",
      );
      const rate = parseFloat(
        (form.get(`item_${i}_rate`) as string) || "0",
      );
      const rateModifierId = form.get(`item_${i}_rateModifierId`) as string | undefined;
      const distance = parseFloat(
        (form.get(`item_${i}_distance`) as string) || "0",
      );
      
      const itemNotes = form.get(`item_${i}_notes`) as string | undefined;
      const taxPercent = parseFloat(
        (form.get(`item_${i}_tax_percent`) as string) || "0",
      );

      const item: Item = {
        description,
        hours,
        rate,
        rateModifierId,
        distance: distance > 0 ? distance : undefined,
        notes: itemNotes,
      };

      if (taxMode === "line" && taxPercent > 0) {
        item.taxes = [{ percent: taxPercent }];
      }

      items.push(item);
      i++;
    }

    if (items.length === 0) {
      return new Response("Missing required fields", { status: 400 });
    }

    if (customerId === "__create__") {
      const inlineCustomerName = String(form.get("inlineCustomerName") || "").trim();
      const inlineCustomerEmail = String(form.get("inlineCustomerEmail") || "").trim();
      const inlineCustomerPhone = String(form.get("inlineCustomerPhone") || "").trim();
      const inlineCustomerAddress = String(form.get("inlineCustomerAddress") || "").trim();
      const inlineCustomerCity = String(form.get("inlineCustomerCity") || "").trim();
      const inlineCustomerPostalCode = String(form.get("inlineCustomerPostalCode") || "").trim();
      const inlineCustomerTaxId = String(form.get("inlineCustomerTaxId") || "").trim();
      const inlineCustomerCountryCode = String(form.get("inlineCustomerCountryCode") || "").trim();

      if (!inlineCustomerName) {
        return new Response("Customer name is required", { status: 400 });
      }

      try {
        const created = await backendPost("/api/v1/customers", auth, {
          name: inlineCustomerName,
          email: inlineCustomerEmail || undefined,
          phone: inlineCustomerPhone || undefined,
          address: inlineCustomerAddress || undefined,
          city: inlineCustomerCity || undefined,
          postalCode: inlineCustomerPostalCode || undefined,
          taxId: inlineCustomerTaxId || undefined,
          countryCode: inlineCustomerCountryCode || undefined,
        }) as { id: string };
        customerId = created.id;
      } catch (e) {
        return new Response(String(e), { status: 500 });
      }
    }

    if (!customerId) {
      return new Response("Missing required fields", { status: 400 });
    }

    // If currency wasn't provided, fall back to configured default
    if (!currency) {
      try {
        const settings = await backendGet("/api/v1/settings", auth) as Record<
          string,
          string
        >;
        currency = settings.currency || "USD";
      } catch {
        currency = "USD";
      }
    }

    const invoiceNumber = String(form.get("invoiceNumber") || "").trim();
    const payload: Record<string, unknown> = {
      customerId,
      currency,
      status,
      invoiceNumber: invoiceNumber || undefined,
      issueDate,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      paymentTerms: paymentTerms || undefined,
      taxRate: taxMode === "invoice" ? taxRate : 0,
      pricesIncludeTax,
      roundingMode,
      items,
    };
    if (taxMode === "invoice") {
      const arr = payload.items as Array<Record<string, unknown>>;
      arr.forEach((i) => {
        if (i.taxes) delete i.taxes;
      });
    }
    payload.taxMode = taxMode; // not required by backend but useful for future extension

    try {
      const created = await backendPost("/api/v1/invoices", auth, payload) as {
        id: string;
      };
      return new Response(null, {
        status: 303,
        headers: { Location: `/invoices/${created.id}` },
      });
    } catch (e) {
      const msg = String(e);
      if (/already exists|duplicate/i.test(msg)) {
        const [customers, settings] = await Promise.all([
          backendGet("/api/v1/customers", auth) as Promise<Customer[]>,
          backendGet("/api/v1/settings", auth) as Promise<
            Record<string, string>
          >,
        ]);
        const sCurrency = settings?.currency || currency || "USD";
        const sPaymentTerms = settings?.paymentTerms || paymentTerms ||
          "Due in 30 days";
        const sDefaultNotes = settings?.defaultNotes || "";
        const sDefaultTaxRate = Number(settings?.defaultTaxRate || 0) || 0;
        const sDefaultPricesIncludeTax =
          String(settings?.defaultPricesIncludeTax || "false").toLowerCase() ===
            "true";
        const sDefaultRoundingMode = settings?.defaultRoundingMode || "line";
        const sNumberFormat = settings?.numberFormat || "comma";
        return ctx.render({
          authed: true,
          customers,
          currency: sCurrency,
          paymentTerms: sPaymentTerms,
          defaultNotes: sDefaultNotes,
          defaultTaxRate: sDefaultTaxRate,
          defaultPricesIncludeTax: sDefaultPricesIncludeTax,
          defaultRoundingMode: sDefaultRoundingMode,
          numberFormat: sNumberFormat,
          invoiceNumberError: "Invoice number already exists",
        });
      }
      return new Response(String(e), { status: 500 });
    }
  },
};

export default function NewInvoicePage(props: PageProps<Data>) {
  const { t } = useTranslations();
  const customers = props.data.customers ?? [];
  const demoMode =
    ((props.data as unknown) as { settings?: Record<string, unknown> }).settings
      ?.demoMode === "true";
  const currency = props.data.currency || "USD";
  const paymentTerms = props.data.paymentTerms || t("Due in 30 days");
  const defaultNotes = props.data.defaultNotes || "";
  const defaultTaxRate = props.data.defaultTaxRate ?? 0;
  const defaultPricesIncludeTax = props.data.defaultPricesIncludeTax ?? false;
  const defaultRoundingMode = props.data.defaultRoundingMode || "line";
  const numberFormat = props.data.numberFormat || "comma";
  const invoiceNumberError = props.data.invoiceNumberError
    ? t("Invoice number already exists")
    : undefined;
  const topError = invoiceNumberError || props.data.error;
  return (
    <Layout
      authed={props.data.authed}
      demoMode={demoMode}
      path={new URL(props.url).pathname}
      wide
    >
      {topError && (
        <div class="alert alert-error mb-3">
          <span>{topError}</span>
        </div>
      )}
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2">
          <h1 class="text-2xl font-semibold">{t("Create Invoice")}</h1>
          <InvoiceFormButton
            formId="invoice-form"
            label={t("Save")}
          />
        </div>

        <InvoiceEditor
          mode="create"
          customers={customers}
          currency={currency}
          status="draft"
          invoiceNumberPrefill={props.data.invoiceNumberPrefill}
          paymentTerms={paymentTerms}
          notes={defaultNotes}
          demoMode={demoMode}
          items={[]}
          showDates
          taxRate={defaultTaxRate}
          pricesIncludeTax={defaultPricesIncludeTax}
          roundingMode={defaultRoundingMode}
          taxMode="invoice"
          invoiceNumberError={invoiceNumberError}
          numberFormat={numberFormat}
          hideTopButton
          formId="invoice-form"
        />
      </div>
    </Layout>
  );
}
