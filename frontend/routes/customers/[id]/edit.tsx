import { Handlers, PageProps } from "$fresh/server.ts";
import { Layout } from "../../../components/Layout.tsx";
import { LuSave } from "../../../components/icons.tsx";
import {
  backendGet,
  backendPut,
  getAuthHeaderFromCookie,
} from "../../../utils/backend.ts";

type Customer = {
  id: string;
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  countryCode?: string;
  city?: string;
  postalCode?: string;
  defaultHourlyRate?: number;
};
type Data = { authed: boolean; customer?: Customer; error?: string };

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
    const { id } = ctx.params as { id: string };
    try {
      const customer = await backendGet(
        `/api/v1/customers/${id}`,
        auth,
      ) as Customer;
      return ctx.render({ authed: true, customer });
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
    const { id } = ctx.params as { id: string };
    const form = await req.formData();
    const payload = {
      name: String(form.get("name") || ""),
      contactName: String(form.get("contactName") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      address: String(form.get("address") || ""),
      city: String(form.get("city") || ""),
      postalCode: String(form.get("postalCode") || ""),
      taxId: String(form.get("taxId") || ""),
      countryCode: String(form.get("countryCode") || ""),
      defaultHourlyRate: parseFloat(String(form.get("defaultHourlyRate") || "0")) || 0,
    };
    if (!payload.name) return new Response("Name is required", { status: 400 });
    try {
      await backendPut(`/api/v1/customers/${id}`, auth, payload);
      return new Response(null, {
        status: 303,
        headers: { Location: `/customers/${id}` },
      });
    } catch (e) {
      return new Response(String(e), { status: 500 });
    }
  },
};

export default function EditCustomerPage(props: PageProps<Data>) {
  const demoMode = ((props.data as unknown) as { settings?: Record<string, unknown> }).settings?.demoMode === "true";
  const c = props.data.customer;
  return (
    <Layout authed={props.data.authed} demoMode={demoMode} path={new URL(props.url).pathname} wide>
      {props.data.error && (
        <div class="alert alert-error mb-3">
          <span>{props.data.error}</span>
        </div>
      )}
      {c && (
        <form method="post" class="space-y-4" data-writable>
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h1 class="text-2xl font-semibold">Edit Customer</h1>
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <a href={`/customers/${c.id}`} class="btn btn-ghost btn-sm flex-1 sm:flex-none">
                Cancel
              </a>
              <button type="submit" class="btn btn-primary flex-1 sm:flex-none" data-writable disabled={demoMode}>
                <LuSave size={16} />
                Save
              </button>
            </div>
          </div>

          <div class="space-y-3">
            <label class="form-control">
              <div class="label">
                <span class="label-text">Name <span class="text-error">*</span></span>
              </div>
              <input
                name="name"
                value={c.name || ""}
                class="input input-bordered w-full"
                required
                data-writable
                disabled={demoMode}
              />
            </label>
            <label class="form-control">
              <div class="label">
                <span class="label-text">Contact Name</span>
              </div>
              <input
                name="contactName"
                value={c.contactName || ""}
                class="input input-bordered w-full"
                data-writable
                disabled={demoMode}
              />
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="form-control">
                <div class="label">
                  <span class="label-text">Email</span>
                </div>
                <input
                  type="email"
                  name="email"
                  value={c.email || ""}
                  class="input input-bordered w-full"
                  data-writable
                  disabled={demoMode}
                />
              </label>
              <label class="form-control">
                <div class="label">
                  <span class="label-text">Phone</span>
                </div>
                <input
                  name="phone"
                  value={c.phone || ""}
                  class="input input-bordered w-full"
                  data-writable
                  disabled={demoMode}
                />
              </label>
            </div>
            <label class="form-control">
              <div class="label">
                <span class="label-text">Address</span>
              </div>
              <textarea
                name="address"
                class="textarea textarea-bordered"
                rows={3}
                data-writable
                disabled={demoMode}
              >
                {c.address || ""}
              </textarea>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="form-control">
                <div class="label">
                  <span class="label-text">City</span>
                </div>
                <input
                  name="city"
                  value={c.city || ""}
                  class="input input-bordered w-full"
                  data-writable
                  disabled={demoMode}
                />
              </label>
              <label class="form-control">
                <div class="label">
                  <span class="label-text">Postal Code</span>
                </div>
                <input
                  name="postalCode"
                  value={c.postalCode || ""}
                  class="input input-bordered w-full"
                  data-writable
                  disabled={demoMode}
                />
              </label>
            </div>
            <label class="form-control">
              <div class="label">
                <span class="label-text">Tax ID</span>
              </div>
              <input
                name="taxId"
                value={c.taxId || ""}
                class="input input-bordered w-full"
                data-writable
                disabled={demoMode}
              />
            </label>
            <label class="form-control">
              <div class="label">
                <span class="label-text">Country Code (ISO alpha-2)</span>
              </div>
              <input
                name="countryCode"
                value={c.countryCode || ""}
                class="input input-bordered w-full"
                maxlength={2}
                placeholder="e.g. US, NL, DE"
                data-writable
                disabled={demoMode}
              />
            </label>
            <label class="form-control">
              <div class="label">
                <span class="label-text">Default Hourly Rate ($/hr)</span>
                <span class="label-text-alt">Used as default for invoices</span>
              </div>
              <input
                name="defaultHourlyRate"
                type="number"
                step="0.01"
                min="0"
                value={c.defaultHourlyRate || 0}
                class="input input-bordered w-full"
                data-writable
                disabled={demoMode}
              />
            </label>
          </div>
        </form>
      )}
    </Layout>
  );
}