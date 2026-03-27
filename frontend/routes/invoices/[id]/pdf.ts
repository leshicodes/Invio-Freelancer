import { Handlers } from "$fresh/server.ts";
import {
  BACKEND_URL,
  getAuthHeaderFromCookie,
} from "../../../utils/backend.ts";

export const handler: Handlers = {
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
    const url = new URL(req.url);
    const landscape = url.searchParams.get("landscape");
    const backendUrl = `${BACKEND_URL}/api/v1/invoices/${id}/pdf${landscape ? `?landscape=${encodeURIComponent(landscape)}` : ""}`;

    const res = await fetch(backendUrl, { headers: { Authorization: auth } });
    if (!res.ok) {
      return new Response(`Upstream error: ${res.status} ${res.statusText}`, {
        status: res.status,
      });
    }

    const headers = new Headers();
    for (const [k, v] of res.headers.entries()) {
      if (k.toLowerCase() === "set-cookie") continue;
      headers.set(k, v);
    }
    // Ensure proper content type/disposition for PDF
    headers.set(
      "content-type",
      res.headers.get("content-type") ?? "application/pdf",
    );
    if (!headers.has("content-disposition")) {
      headers.set(
        "content-disposition",
        `attachment; filename=invoice-${id}.pdf`,
      );
    }
    return new Response(res.body, { status: 200, headers });
  },
};
