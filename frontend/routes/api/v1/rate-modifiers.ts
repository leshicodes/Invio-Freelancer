import { Handlers } from "$fresh/server.ts";
import { BACKEND_URL, getAuthHeaderFromCookie } from "../../../utils/backend.ts";

// Proxy rate-modifiers API to backend
export const handler: Handlers = {
  async GET(req) {
    const auth = getAuthHeaderFromCookie(req.headers.get("cookie") || undefined);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { "content-type": "application/json" } 
      });
    }

    const backendUrl = `${BACKEND_URL}/api/v1/rate-modifiers`;
    const resp = await fetch(backendUrl, { 
      headers: { Authorization: auth } 
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return new Response(body || `Backend error ${resp.status}`, { 
        status: resp.status, 
        headers: { "content-type": "application/json" } 
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
};
