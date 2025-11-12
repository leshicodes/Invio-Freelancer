import { DB } from "sqlite";
import { getEnv, isDemoMode } from "../utils/env.ts";

let db: DB;

// Resolve workspace-relative paths consistently from project root
function resolvePath(p: string): string {
  if (p.startsWith("/")) return p; // absolute
  // Assume process CWD is project root during deno run; keep relative as-is
  return p;
}

// Minimal dirname for POSIX-style paths
function simpleDirname(p: string): string {
  const i = p.lastIndexOf("/");
  if (i <= 0) return "/";
  return p.slice(0, i);
}

export function initDatabase(): void {
  // In all modes, open the active database at DATABASE_PATH. In demo mode we may
  // periodically copy a pristine DEMO_DB_PATH over this file.
  const dbPath = resolvePath(getEnv("DATABASE_PATH", "./invio.db")!);

  // Ensure parent directory exists if using a nested path
  try {
    const dir = simpleDirname(dbPath);
    if (dir && dir !== "." && dir !== "/") {
      try {
        Deno.mkdirSync(dir, { recursive: true });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  db = new DB(dbPath);

  // Read and execute the migration file
  const migrationSQL = Deno.readTextFileSync("./src/database/migrations.sql");

  // Remove line comments and split by semicolon
  const withoutComments = migrationSQL
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("--")) return ""; // drop whole-line comments
      // strip inline comments starting with --
      const idx = line.indexOf("--");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");

  const statements = withoutComments
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);

  for (const statement of statements) {
    try {
      db.execute(statement);
    } catch (error) {
      // Ignore "already exists" errors for tables/indexes
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      // Also ignore duplicate column errors which occur when rerunning ALTER TABLE ADD COLUMN
      if (!/already exists|duplicate column name/i.test(errorMessage)) {
        console.error("Migration error:", errorMessage);
        console.error("Statement:", statement);
      }
    }
  }

  // Insert built-in templates and clean up legacy/default conflicts
  insertBuiltinTemplates(db);
  ensureTemplateDefaults(db);
  ensureSchemaUpgrades(db);

  console.log("Database initialized successfully");
}

/**
 * Reset the active DATABASE_PATH contents from DEMO_DB_PATH.
 * This closes the current DB connection, copies the file, and re-initializes.
 * Safe to call at startup and on an interval when DEMO_MODE=true.
 */
export function resetDatabaseFromDemo(): void {
  const demoMode = isDemoMode();
  const demoDb = getEnv("DEMO_DB_PATH");
  const activePath = resolvePath(getEnv("DATABASE_PATH", "./invio.db")!);
  if (!demoMode) return; // only meaningful in demo mode
  if (!demoDb) {
    console.warn(
      "DEMO_MODE is true but DEMO_DB_PATH is not set; skipping reset.",
    );
    return;
  }

  try {
    closeDatabase();
  } catch { /* ignore */ }

  try {
    // Ensure destination directory exists
    const dir = simpleDirname(activePath);
    if (dir && dir !== "." && dir !== "/") {
      try {
        Deno.mkdirSync(dir, { recursive: true });
      } catch { /* ignore */ }
    }
    // Overwrite the active DB with the pristine demo DB
    try {
      Deno.removeSync(activePath);
    } catch { /* ignore if missing */ }
    Deno.copyFileSync(resolvePath(demoDb), activePath);
    console.log("♻️  Demo database reset from DEMO_DB_PATH.");
  } catch (e) {
    console.error("Failed to reset demo database:", e);
  }

  // Re-open and run migrations/template maintenance
  initDatabase();
}

function insertBuiltinTemplates(database: DB) {
  const filePathForId = (id: string): string => {
    switch (id) {
      case "professional-modern":
        return "./static/templates/professional-modern.html";
      case "minimalist-clean":
        return "./static/templates/minimalist-clean.html";
      default:
        throw new Error(`Unknown template id: ${id}`);
    }
  };

  const loadHtml = (id: string): string => {
    const path = filePathForId(id);
    try {
      return Deno.readTextFileSync(path);
    } catch (e) {
      console.error(`Failed to read template file ${path}:`, e);
      return "<html><body><p>Template unavailable.</p></body></html>";
    }
  };

  const templates = [
    {
      id: "professional-modern",
      name: "Professional Modern",
      html: loadHtml("professional-modern"),
      isDefault: false,
    },
    {
      id: "minimalist-clean",
      name: "Minimalist Clean",
      html: loadHtml("minimalist-clean"),
      isDefault: true,
    },
  ];

  for (const t of templates) {
    try {
      const existing = database.query(
        "SELECT html FROM templates WHERE id = ?",
        [t.id],
      );
      if (existing.length === 0) {
        database.query(
          "INSERT INTO templates (id, name, html, is_default, created_at) VALUES (?, ?, ?, ?, ?)",
          [t.id, t.name, t.html, t.isDefault, new Date().toISOString()],
        );
        console.log(`✅ Installed template: ${t.name}`);
      } else {
        const currentHtml = String((existing[0] as unknown[])[0] ?? "");
        if (currentHtml.trim() !== t.html.trim()) {
          database.query(
            "UPDATE templates SET name = ?, html = ?, is_default = ? WHERE id = ?",
            [t.name, t.html, t.isDefault, t.id],
          );
          console.log(`♻️  Updated template from file: ${t.name}`);
        }
      }
    } catch (error) {
      console.error(`Failed to upsert template ${t.name}:`, error);
    }
  }
}

function ensureTemplateDefaults(database: DB) {
  try {
    // Remove legacy default row if present
    database.query("DELETE FROM templates WHERE id = ?", ["default-template"]);

    // Ensure only one default: prefer minimalist-clean
    const rows = database.query("SELECT id, is_default FROM templates");
    const ids = rows.map((r) => String((r as unknown[])[0]));
    const hasMinimalist = ids.includes("minimalist-clean");

    // Reset all defaults
    database.query("UPDATE templates SET is_default = 0");

    // Set preferred default if present; otherwise set any one template as default for safety
    if (hasMinimalist) {
      database.query("UPDATE templates SET is_default = 1 WHERE id = ?", [
        "minimalist-clean",
      ]);
    } else if (ids.length) {
      const first = ids[0];
      database.query("UPDATE templates SET is_default = 1 WHERE id = ?", [
        first,
      ]);
    }
  } catch (e) {
    console.error("Failed to ensure template defaults:", e);
  }
}

export function getDatabase(): DB {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}

function ensureSchemaUpgrades(database: DB) {
  try {
    // Ensure customers.country_code exists
    const cols = database.query(
      "PRAGMA table_info(customers)",
    ) as unknown[] as Array<unknown[]>;
    const names = new Set(cols.map((r) => String(r[1])));
    // Add missing customer columns: contact_name, country_code, city, postal_code
    if (!names.has("contact_name")) {
      try {
        database.execute("ALTER TABLE customers ADD COLUMN contact_name TEXT");
        console.log("✅ Added customers.contact_name column");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn("Could not add customers.contact_name:", msg);
        }
      }
    }
    if (!names.has("country_code")) {
      try {
        database.execute("ALTER TABLE customers ADD COLUMN country_code TEXT");
        console.log("✅ Added customers.country_code column");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn("Could not add customers.country_code:", msg);
        }
      }
    }
    if (!names.has("city")) {
      try {
        database.execute("ALTER TABLE customers ADD COLUMN city TEXT");
        console.log("✅ Added customers.city column");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn("Could not add customers.city:", msg);
        }
      }
    }
    if (!names.has("postal_code")) {
      try {
        database.execute("ALTER TABLE customers ADD COLUMN postal_code TEXT");
        console.log("✅ Added customers.postal_code column");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn("Could not add customers.postal_code:", msg);
        }
      }
    }

    // Ensure invoices.prices_include_tax exists
    const invCols = database.query(
      "PRAGMA table_info(invoices)",
    ) as unknown[] as Array<unknown[]>;
    const invNames = new Set(invCols.map((r) => String(r[1])));
    if (!invNames.has("prices_include_tax")) {
      try {
        database.execute(
          "ALTER TABLE invoices ADD COLUMN prices_include_tax BOOLEAN DEFAULT 0",
        );
        console.log("✅ Added invoices.prices_include_tax column");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn("Could not add invoices.prices_include_tax:", msg);
        }
      }
    }
    if (!invNames.has("rounding_mode")) {
      try {
        database.execute(
          "ALTER TABLE invoices ADD COLUMN rounding_mode TEXT DEFAULT 'line'",
        );
        console.log("✅ Added invoices.rounding_mode column");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn("Could not add invoices.rounding_mode:", msg);
        }
      }
    }

    // Ensure normalized tax tables exist
    database.execute(`
      CREATE TABLE IF NOT EXISTS tax_definitions (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        name TEXT,
        percent NUMERIC NOT NULL,
        category_code TEXT,
        country_code TEXT,
        vendor_specific_id TEXT,
        default_included BOOLEAN DEFAULT 0,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    database.execute(`
      CREATE TABLE IF NOT EXISTS invoice_item_taxes (
        id TEXT PRIMARY KEY,
        invoice_item_id TEXT NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
        tax_definition_id TEXT REFERENCES tax_definitions(id),
        percent NUMERIC NOT NULL,
        taxable_amount NUMERIC NOT NULL,
        amount NUMERIC NOT NULL,
        included BOOLEAN NOT NULL DEFAULT 0,
        sequence INTEGER DEFAULT 0,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    database.execute(`
      CREATE TABLE IF NOT EXISTS invoice_taxes (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        tax_definition_id TEXT REFERENCES tax_definitions(id),
        percent NUMERIC NOT NULL,
        taxable_amount NUMERIC NOT NULL,
        tax_amount NUMERIC NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn("Schema upgrade check failed:", e);
  }
}

// Helper function to get next invoice number
export function getNextInvoiceNumber(): string {
  // Support advanced pattern if configured: tokens {YYYY}{YY}{MM}{DD}{DATE}{RAND4}{SEQ}
  // Fallback to legacy prefix/year/padding if pattern empty
  let prefix = "INV";
  let includeYear = true;
  let pad = 3;
  let pattern: string | undefined = undefined;
  // New flag: whether advanced invoice numbering (invoiceNumberPattern) is enabled
  let numberingEnabled = true;
  try {
    const rows = db.query(
      "SELECT key, value FROM settings WHERE key IN ('invoicePrefix','invoiceIncludeYear','invoiceNumberPadding','invoiceNumberPattern')",
    );
    const map = new Map<string, string>();
    for (const r of rows) {
      const [k, v] = r as [string, string];
      map.set(k, v);
    }
    prefix = (map.get("invoicePrefix") || prefix).trim() || prefix;
    includeYear =
      (map.get("invoiceIncludeYear") || "true").toLowerCase() !== "false";
    const p = parseInt(map.get("invoiceNumberPadding") || String(pad), 10);
    if (!Number.isNaN(p) && p >= 2 && p <= 8) pad = p;
    pattern = (map.get("invoiceNumberPattern") || "").trim() || undefined;
    // Respect explicit toggle if present (stored as "true"/"false")
    try {
      const raw = db.query("SELECT value FROM settings WHERE key = 'invoiceNumberingEnabled' LIMIT 1");
      if (raw.length > 0) {
        numberingEnabled = String(raw[0][0]).toLowerCase() !== 'false';
      }
    } catch (_) { /* ignore */ }
  } catch (_) { /* use defaults */ }

  // If numbering is disabled, ignore advanced pattern and fall back to legacy
  if (pattern && numberingEnabled) {
    const now = new Date();
    const YYYY = String(now.getFullYear());
    const YY = YYYY.slice(-2);
    const MM = String(now.getMonth() + 1).padStart(2, "0");
    const DD = String(now.getDate()).padStart(2, "0");
    const DATE = `${YYYY}${MM}${DD}`;
    const baseWithoutSeq = pattern
      .replace(/\{YYYY\}/g, YYYY)
      .replace(/\{YY\}/g, YY)
      .replace(/\{MM\}/g, MM)
      .replace(/\{DD\}/g, DD)
      .replace(/\{DATE\}/g, DATE)
      .replace(/\{RAND4\}/g, () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        return Array.from({ length: 4 }).map(() => chars[Math.floor(Math.random() * chars.length)]).join("");
      });
    if (!/\{SEQ\}/.test(pattern)) {
      // No sequence token: return rendered pattern immediately (not guaranteed unique)
      return baseWithoutSeq;
    }
    // Sequence token present: find max existing sequence for same static prefix
    const prefixForSeq = baseWithoutSeq.split("{SEQ}")[0];
    const like = `${prefixForSeq}%`;
    const result = db.query("SELECT invoice_number FROM invoices WHERE invoice_number LIKE ?", [like]);
    let maxSeq = 0;
    const re = new RegExp(`^${prefixForSeq.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(\\d+).*?$`);
    for (const row of result) {
      const inv = String((row as unknown[])[0] ?? "");
      const m = inv.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n);
      }
    }
    const nextSeq = String(maxSeq + 1).padStart(3, "0");
    return baseWithoutSeq.replace(/\{SEQ\}/g, nextSeq);
  }

  const year = new Date().getFullYear();
  const base = includeYear ? `${prefix}-${year}-` : `${prefix}-`;

  // Scan existing invoice_numbers that match this base and find max numeric suffix
  const like = `${base}%`;
  const result = db.query(
    "SELECT invoice_number FROM invoices WHERE invoice_number LIKE ?",
    [like],
  );
  let maxNum = 0;
  const baseEscaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${baseEscaped}(\\d+)$`);
  for (const row of result) {
    const inv = String((row as unknown[])[0] ?? "");
    const m = inv.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
    }
  }
  const next = maxNum + 1;
  return `${base}${String(next).padStart(pad, "0")}`;
}

export function generateDraftInvoiceNumber(): string {
  // Unique placeholder that will be replaced on send/publish
  // Use short random to avoid UNIQUE collisions
  const rand = cryptoRandom(6);
  return `DRAFT-${rand}`;
}

function cryptoRandom(len: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

// Helper function to calculate totals
export interface CalculatedTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

/**
 * Calculate line total for time-based billing
 * Formula: (Rate × Hours × Modifier) + (Distance × Mileage Rate)
 */
export function calculateTimeBasedLineTotal(params: {
  rate: number;
  hours: number;
  modifierMultiplier: number;
  distance?: number;
  mileageRate?: number;
}): number {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  
  // Calculate base pay with modifier
  const basePay = (params.rate || 0) * (params.hours || 0) * (params.modifierMultiplier || 1);
  
  // Calculate mileage reimbursement
  const mileage = (params.distance || 0) * (params.mileageRate || 0);
  
  // Total
  return r2(basePay + mileage);
}

export function calculateInvoiceTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  discountPercentage: number = 0,
  discountAmount: number = 0,
  taxRate: number = 0,
  pricesIncludeTax: boolean = false,
  roundingMode: "line" | "total" = "line",
): CalculatedTotals {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const rate = Math.max(0, Number(taxRate) || 0) / 100;

  // Calculate subtotal from items (sum of quantity * unitPrice)
  const lines = items.map((it) => ({
    qty: Number(it.quantity) || 0,
    unit: Number(it.unitPrice) || 0,
  }));
  const lineGrosses = lines.map((l) => l.qty * l.unit);
  const subtotal = lineGrosses.reduce((a, b) => a + b, 0);

  // Calculate discount
  let finalDiscountAmount = Number(discountAmount) || 0;
  if (discountPercentage > 0) {
    finalDiscountAmount = subtotal * (discountPercentage / 100);
  }
  // Cap discount not to exceed subtotal
  finalDiscountAmount = Math.min(Math.max(finalDiscountAmount, 0), subtotal);

  let taxAmount = 0;
  let total = 0;

  if (roundingMode === "line" && subtotal > 0) {
    // Distribute discount proportionally to lines and round per line
    let distributed = 0;
    const lineDiscounts = lineGrosses.map((g, idx) => {
      if (idx === lineGrosses.length - 1) {
        // Last line gets the remainder to preserve total discount
        return r2(finalDiscountAmount - distributed);
      }
      const share = g / subtotal;
      const d = r2(finalDiscountAmount * share);
      distributed += d;
      return d;
    });

    let sumTax = 0;
    let sumTotal = 0;
    for (let i = 0; i < lineGrosses.length; i++) {
      const gross = lineGrosses[i];
      const ld = lineDiscounts[i] || 0;
      const afterDiscount = Math.max(0, gross - ld);
      if (pricesIncludeTax) {
        // afterDiscount already includes tax; extract tax portion per line
        const net = rate > 0 ? afterDiscount / (1 + rate) : afterDiscount;
        const tax = afterDiscount - net;
        sumTax += r2(tax);
        sumTotal += r2(afterDiscount);
      } else {
        const tax = afterDiscount * rate;
        sumTax += r2(tax);
        sumTotal += r2(afterDiscount + r2(tax));
      }
    }
    taxAmount = r2(sumTax);
    total = r2(sumTotal);
  } else {
    // Total rounding mode
    const afterDiscount = subtotal - finalDiscountAmount;
    if (pricesIncludeTax) {
      const net = rate > 0 ? afterDiscount / (1 + rate) : afterDiscount;
      taxAmount = r2(afterDiscount - net);
      total = r2(afterDiscount);
    } else {
      taxAmount = r2(afterDiscount * rate);
      total = r2(afterDiscount + taxAmount);
    }
  }

  return {
    subtotal: r2(subtotal),
    discountAmount: r2(finalDiscountAmount),
    taxAmount: r2(taxAmount),
    total: r2(total),
  };
}
