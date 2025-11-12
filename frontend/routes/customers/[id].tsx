import { Handlers, PageProps } from "$fresh/server.ts";
import { Layout } from "../../components/Layout.tsx";
import { LuPencil, LuTrash2 } from "../../components/icons.tsx";
import ConfirmOnSubmit from "../../islands/ConfirmOnSubmit.tsx";
import {
  backendDelete,
  backendGet,
  getAuthHeaderFromCookie,
} from "../../utils/backend.ts";

type Customer = { id: string; name?: string; contactName?: string; email?: string; address?: string; city?: string; postalCode?: string; defaultHourlyRate?: number };
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
    const intent = String(form.get("intent") || "");
    if (intent === "delete") {
      try {
        await backendDelete(`/api/v1/customers/${id}`, auth);
        return new Response(null, {
          status: 303,
          headers: { Location: "/customers" },
        });
      } catch (_e) {
        // Redirect to an informational page when deletion is blocked (e.g., existing invoices)
        return new Response(null, {
          status: 303,
          headers: { Location: `/customers/${id}/cannot-delete` },
        });
      }
    }
    return new Response("Unsupported action", { status: 400 });
  },
};

export default function CustomerDetail(props: PageProps<Data>) {
  const c = props.data.customer;
  return (
    <Layout authed={props.data.authed} path={new URL(props.url).pathname}>
      <ConfirmOnSubmit />
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-semibold">Customer {c?.name || c?.id}</h1>
        {c && (
          <div class="flex gap-2">
            <a href={`/customers/${c.id}/edit`} class="btn btn-sm">
              <LuPencil size={16} />
              Edit
            </a>
            <form
              method="post"
              data-confirm="Delete this customer? This cannot be undone."
            >
              <input type="hidden" name="intent" value="delete" />
              <button type="submit" class="btn btn-sm btn-outline btn-error">
                <LuTrash2 size={16} />
                Delete
              </button>
            </form>
          </div>
        )}
      </div>
      {props.data.error && (
        <div class="alert alert-error mb-3">
          <span>{props.data.error}</span>
        </div>
      )}
      {c && (
        <div class="space-y-2">
          {c.contactName && (
            <div>
              <span class="opacity-70">Contact:</span> {c.contactName}
            </div>
          )}
          {c.email && (
            <div>
              <span class="opacity-70">Email:</span> {c.email}
            </div>
          )}
          {c.address && (
            <div>
              <span class="opacity-70">Address:</span> {c.address}
            </div>
          )}
          {(c.city || c.postalCode) && (
            <div>
              <span class="opacity-70">City/Postal:</span> {c.city || ""} {c.postalCode ? `(${c.postalCode})` : ""}
            </div>
          )}
          {c.defaultHourlyRate !== undefined && c.defaultHourlyRate > 0 && (
            <div>
              <span class="opacity-70">Default Hourly Rate:</span> ${c.defaultHourlyRate.toFixed(2)}/hr
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
