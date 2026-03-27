# Invio Frontend (Deno Fresh)

Modern, minimalist admin UI for Invio backend.

- Framework: Fresh (SSR + islands)
- Auth: JWT bearer sessions (stored as HttpOnly cookie; proxied to backend)
- Features:
  - Login/logout
  - Dashboard summary
  - Invoices: list, filter (server-rendered), view, edit, duplicate,
    publish/unpublish, status updates, download PDF (portrait/landscape/verbose), public link
  - Time-based invoice editor: date of service, start/end time (overnight-aware, auto-calculated hours), per-line rate override toggle, copy/duplicate line items
  - Customers: list, view, create, edit, delete (with default hourly rate)
  - Settings: company details, logo, default template, highlight color, mileage rate, PDF landscape mode
  - Templates UI integrated into Settings

## Dev

Requires Deno 1.42+.

Environment:

- `BACKEND_URL` — backend base URL (default http://localhost:3000)
- `FRONTEND_SECURE_HEADERS_DISABLED` — set to `true` to disable hardened headers in development
- `FRONTEND_CONTENT_SECURITY_POLICY` — override default CSP if custom assets are required
- `ENABLE_HSTS` — set to `true` to emit Strict-Transport-Security (only when served over HTTPS)

Run:

```bash
deno task start
```

Docker build (ensure the dashboard shows the correct version):

```bash
cp ../VERSION ./VERSION  # or pass --build-arg APP_VERSION=$(cat ../VERSION)
docker build -t invio-frontend .
```

## Notes

- PDF/HTML generation links no longer take query parameters; output uses the
  saved Settings template and highlight.
- UI uses DaisyUI components and aims for good accessibility (contrast, lang
  attribute, no client-side JS for exports).
