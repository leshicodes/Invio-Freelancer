import { Handlers } from "$fresh/server.ts";
import { BACKEND_URL, getAuthHeaderFromCookie } from "../../../utils/backend.ts";

// Proxy rate-modifiers API to backend (all methods)
async function proxyToBackend(req: Request) {
  const auth = getAuthHeaderFromCookie(req.headers.get("cookie") || undefined);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401, 
      headers: { "content-type": "application/json" } 
    });
  }

  const url = new URL(req.url);
  const backendUrl = `${BACKEND_URL}/api/v1/rate-modifiers${url.pathname.replace('/api/v1/rate-modifiers', '')}`;
  
  const headers: HeadersInit = { Authorization: auth };
  
  // Forward content-type for POST/PUT/PATCH
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers["content-type"] = contentType;
  }

  const options: RequestInit = {
    method: req.method,
    headers,
  };

  // Include body for POST/PUT/PATCH
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    options.body = await req.text();
  }

  const resp = await fetch(backendUrl, options);

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return new Response(body || `Backend error ${resp.status}`, { 
      status: resp.status, 
      headers: { "content-type": "application/json" } 
    });
  }

  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { "content-type": "application/json" },
  });
}

export const handler: Handlers = {
  GET: proxyToBackend,
  POST: proxyToBackend,
  PUT: proxyToBackend,
  PATCH: proxyToBackend,
  DELETE: proxyToBackend,
};
