import { Handlers, PageProps } from "$fresh/server.ts";
import { Layout } from "../../components/Layout.tsx";
import { LuUserPlus } from "../../components/icons.tsx";
import { backendPost, getAuthHeaderFromCookie } from "../../utils/backend.ts";
import { useTranslations } from "../../i18n/context.tsx";

type Data = { authed: boolean; error?: string };

export const handler: Handlers<Data> = {
  GET(req, ctx) {
    const auth = getAuthHeaderFromCookie(
      req.headers.get("cookie") || undefined,
    );
    if (!auth) {
      return new Response(null, {
        status: 303,
        headers: { Location: "/login" },
      });
    }
    return ctx.render({ authed: true });
  },
  async POST(req) {
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
    const name = String(form.get("name") || "");
    const contactName = String(form.get("contactName") || "");
    const email = String(form.get("email") || "");
    const phone = String(form.get("phone") || "");
    const address = String(form.get("address") || "");
    const city = String(form.get("city") || "");
    const postalCode = String(form.get("postalCode") || "");
    const taxId = String(form.get("taxId") || "");
    const countryCode = String(form.get("countryCode") || "");
    const defaultHourlyRateStr = String(form.get("defaultHourlyRate") || "0");
    const defaultHourlyRate = parseFloat(defaultHourlyRateStr) || 0;

    if (!name) return new Response("Name is required", { status: 400 });

    try {
      const created = await backendPost("/api/v1/customers", auth, {
        name,
        contactName,
        email,
        phone,
        address,
        city,
        postalCode,
        taxId,
        countryCode,
        defaultHourlyRate,
      }) as { id: string };
      return new Response(null, {
        status: 303,
        headers: { Location: `/customers/${created.id}` },
      });
    } catch (e) {
      return new Response(String(e), { status: 500 });
    }
  },
};

export default function NewCustomerPage(props: PageProps<Data>) {
  const { t } = useTranslations();
  const demoMode = ((props.data as unknown) as { settings?: Record<string, unknown> }).settings?.demoMode === "true";
  return (
    <Layout authed={props.data.authed} demoMode={demoMode} path={new URL(props.url).pathname} wide>
      {props.data.error && (
        <div class="alert alert-error mb-3">
          <span>{props.data.error}</span>
        </div>
      )}
      <form method="post" class="space-y-4" data-writable>
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 class="text-2xl font-semibold">{t("Create Customer")}</h1>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <a href="/customers" class="btn btn-ghost btn-sm flex-1 sm:flex-none">
              {t("Cancel")}
            </a>
            <button type="submit" class="btn btn-primary flex-1 sm:flex-none" data-writable>
              <LuUserPlus size={16} />
              {t("Create Customer")}
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <label class="form-control">
            <div class="label">
              <span class="label-text">{t("Name")} <span class="text-error">*</span></span>
            </div>
            <input name="name" class="input input-bordered w-full" required data-writable />
          </label>
          <label class="form-control">
            <div class="label">
              <span class="label-text">{t("Contact Name")}</span>
            </div>
            <input name="contactName" class="input input-bordered w-full" data-writable />
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="form-control">
              <div class="label">
                <span class="label-text">{t("Email")}</span>
              </div>
              <input
                type="email"
                name="email"
                class="input input-bordered w-full"
                data-writable

              />
            </label>
            <label class="form-control">
              <div class="label">
                <span class="label-text">{t("Phone")}</span>
              </div>
              <input name="phone" class="input input-bordered w-full" data-writable />
            </label>
          </div>
          <label class="form-control">
            <div class="label">
              <span class="label-text">{t("Address")}</span>
            </div>
            <textarea
              name="address"
              class="textarea textarea-bordered"
              rows={3}
              data-writable

            />
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="form-control">
              <div class="label">
                <span class="label-text">{t("City")}</span>
              </div>
              <input name="city" class="input input-bordered w-full" data-writable />
            </label>
            <label class="form-control">
              <div class="label">
                <span class="label-text">{t("Postal Code")}</span>
              </div>
              <input name="postalCode" class="input input-bordered w-full" data-writable />
            </label>
          </div>
          <label class="form-control">
            <div class="label">
              <span class="label-text">{t("Tax ID")}</span>
            </div>
            <input name="taxId" class="input input-bordered w-full" data-writable />
          </label>
          <label class="form-control">
            <div class="label">
              <span class="label-text">{t("Country Code (ISO alpha-2)")}</span>
            </div>
            <input name="countryCode" class="input input-bordered w-full" maxlength={2} placeholder={t("Country code placeholder")} data-writable />
          </label>
          <label class="form-control">
            <div class="label">
              <span class="label-text">{t("Default Hourly Rate")} ($/hr)</span>
              <span class="label-text-alt">{t("Used as default for invoices")}</span>
            </div>
            <input 
              name="defaultHourlyRate" 
              type="number" 
              step="0.01" 
              min="0" 
              defaultValue="0" 
              class="input input-bordered w-full" 
              data-writable 
            />
          </label>
        </div>
      </form>
    </Layout>
  );
}
