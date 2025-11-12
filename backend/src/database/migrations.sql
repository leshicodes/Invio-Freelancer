-- Business/Seller information (stored in settings)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Insert default business settings
INSERT OR IGNORE INTO settings (key, value) VALUES 
  ('companyName', 'Your Company'),
  ('companyAddress', '123 Business St, City, State 12345'),
  ('companyEmail', 'contact@yourcompany.com'),
  ('companyPhone', '+1 (555) 123-4567'),
  ('companyTaxId', 'TAX123456789'),
  ('companyCountryCode', 'US'),
  ('currency', 'USD'),
  ('logo', ''),
  ('paymentMethods', 'Bank Transfer, PayPal, Credit Card'),
  ('bankAccount', 'Account: 1234567890, Routing: 987654321'),
  ('paymentTerms', 'Due in 30 days'),
  ('defaultNotes', 'Thank you for your business!'),
  -- Optional default invoice number pattern (tokens: {YYYY} {YY} {MM} {DD} {DATE} {RAND4})
  ('invoiceNumberPattern', ''),
  ('invoiceNumberingEnabled', 'true'),
  ('embedXmlInHtml', 'false'),
  -- Optional PEPPOL endpoint configuration (leave empty if not applicable)
  ('peppolSellerEndpointId', ''),
  ('peppolSellerEndpointSchemeId', ''),
  ('peppolBuyerEndpointId', ''),
  ('peppolBuyerEndpointSchemeId', ''),
  -- Mileage rate for time-based billing (default federal standard rate)
  ('mileageRate', '0.70');

-- Rate modifiers for time-based billing (e.g., Holiday, Weekend, Overnight)
CREATE TABLE IF NOT EXISTS rate_modifiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  description TEXT,
  is_default BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default rate modifier
INSERT OR IGNORE INTO rate_modifiers (id, name, multiplier, description, is_default) VALUES 
  ('standard', 'Standard', 1.0, 'Regular daytime work', 1);

-- Enhanced customers table
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  country_code TEXT,
  tax_id TEXT,
  default_hourly_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced invoices table
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  issue_date DATE NOT NULL,
  due_date DATE,
  currency TEXT DEFAULT 'USD',
  status TEXT CHECK(status IN ('draft', 'sent', 'paid', 'overdue')) DEFAULT 'draft',
  
  -- Totals
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  
  -- Payment and notes
  payment_terms TEXT,
  notes TEXT,
  
  -- System fields
  share_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced invoice items table
CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  line_total NUMERIC NOT NULL,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  -- Time-based billing fields
  hours NUMERIC DEFAULT 0,
  rate NUMERIC DEFAULT 0,
  rate_modifier_id TEXT REFERENCES rate_modifiers(id),
  distance NUMERIC DEFAULT 0
);

-- Invoice attachments (optional)
CREATE TABLE invoice_attachments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Templates table
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  html TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- No built-in default template is seeded here; startup code installs maintained templates.

-- Index for performance
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_share_token ON invoices(share_token);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Normalized tax schema (for complex/composite taxes)
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

CREATE TABLE IF NOT EXISTS invoice_taxes (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tax_definition_id TEXT REFERENCES tax_definitions(id),
  percent NUMERIC NOT NULL,
  taxable_amount NUMERIC NOT NULL,
  tax_amount NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice-level flags for tax pricing/rounding
ALTER TABLE invoices ADD COLUMN prices_include_tax BOOLEAN DEFAULT 0;
ALTER TABLE invoices ADD COLUMN rounding_mode TEXT DEFAULT 'line';