# Invio Freelancer

<p align="center">
  <img src="https://raw.githubusercontent.com/kittendevv/Invio/refs/heads/main/assets/banner-default.png" alt="Invio Freelancer" width="100%" />
</p>

<p align="center"><b>Self-hosted time-based invoicing for freelancers. Fast, transparent, and fully yours.</b></p>

<p align="center">
  Forked from <a href="https://github.com/kittendevv/Invio">Invio</a> by <a href="https://github.com/kittendevv">kittendevv</a>
</p>

---

## 🍴 About This Fork

**Invio Freelancer** is a specialized fork of the excellent [Invio](https://github.com/kittendevv/Invio) project, adapted specifically for **time-based freelance work** (particularly ASL interpreting and similar service-based professions).

### Why Fork?

The original Invio is designed for **product-based invoicing** (quantity × unit price), which works great for selling products but doesn't fit freelance service work where you bill by:
- **Hours worked** with variable hourly rates
- **Rate modifiers** (holiday pay, overnight shifts, rush jobs, etc.)
- **Mileage reimbursement** for on-site work

Rather than asking the upstream project to support this niche use case, this fork maintains the original's simplicity while adding freelancer-specific features.

### What's Different

- **Hours worked** with variable hourly rates per client
- **Date and time tracking** per job — start/end time with overnight support
- **Mileage reimbursement** for on-site work
- **Per-line rate override** for special jobs that deviate from the standard rate
- **Landscape & verbose PDFs** for detailed, professional billing

### Upstream Attribution

All core architecture, design, and foundational code credit goes to **[kittendevv](https://github.com/kittendevv)** and the Invio contributors. This fork builds on their excellent work. ❤️

**If you need traditional product invoicing, please use the [original Invio](https://github.com/kittendevv/Invio).**

---

## 🌟 Why Invio Freelancer?

- **Time-based billing** — invoice by hours, not quantity. Perfect for interpreters, consultants, and service providers.
- **Date & time tracking** — log start/end time per job (overnight-aware), with hours auto-calculated.
- **Mileage tracking** — automatically calculate reimbursement at configurable rates (default: $0.725/mile).
- **Customer default rates** — set hourly rates per client, auto-populate on new invoices.
- **Per-line rate override** — quickly override the rate for any individual line item.
- **Automatic calculations** — no manual price entry. System calculates: `(Rate × Hours) + (Miles × Mileage Rate)`.
- **Landscape & verbose PDFs** — download invoices in portrait or landscape, with optional formula breakdown per line.
- **You really own it** — self-hosted by default. Your data lives where you put it.
- **Fast & dependable** — Deno + Fresh + Hono + SQLite keeps things simple and quick.
- **Client-friendly** — share a secure public link—no accounts required to view invoices.

---

## ✨ New Features (vs. Original Invio)

### 1. Time-Based Line Items
Instead of `Quantity × Unit Price`, invoices now use:
```
Line Total = (Rate × Hours) + (Distance × Mileage Rate)
```

**Example:**
- Rate: $50/hour
- Hours: 2.5
- Distance: 30 miles @ $0.725/mile
- **Total: $146.75** = ($50 × 2.5) + (30 × $0.725)

### 2. Customer Default Rates
Set a default hourly rate per customer (e.g., Hospital A = $50/hr, University B = $75/hr). New invoice line items auto-populate with the customer's rate.

### 3. Date & Time Tracking Per Line Item
Log the date, start time, and end time for each job. Hours are auto-calculated — overnight jobs are handled automatically (e.g., 10:00 PM – 2:00 AM = 4 hrs).

### 4. Copy / Duplicate Line Items
One-click duplicate button (⧉) on each line item — instantly copies a line with all fields intact, useful for recurring or similar jobs.

### 5. Per-Line Rate Override
Each line item can individually override the customer's default hourly rate via a toggle (✏️). Useful for charity events, premium work, or any job deviating from the standard rate.

### 6. Mileage Reimbursement
Track round-trip mileage per job. System automatically calculates reimbursement at configurable rate (default: $0.725/mile, IRS standard 2025).

### 7. Automatic Price Calculation
Price field is **calculated, not entered**. No manual math errors. Download PDFs with verbose mode to show a per-line formula breakdown (e.g., `$50.00/hr × 2.5 hrs + 30 mi × $0.725/mi = $125.00 + $21.75 = $146.75`).

### 8. Portrait & Landscape PDFs
Download invoices in portrait or landscape orientation. Choose per-download from the dropdown, or set landscape as the default in Settings.

### 9. Updated PDF Templates
Both included templates (Minimalist Clean & Professional Modern) display:
- Date of service
- Start/end time and calculated hours
- Hourly rate ($/hr)
- Miles traveled
- Calculated line total
- Optional verbose formula breakdown per line

---

## 🚀 Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose
- Git

### Quick Start

**Option 1: Using Pre-built Docker Hub Images (Easiest)**
```bash
# Download docker-compose file
curl -O https://raw.githubusercontent.com/leshicodes/Invio-Freelancer/main/docker-compose-hub.yml

# Create .env file
echo "JWT_SECRET=$(openssl rand -base64 32)" > .env
echo "ADMIN_USERNAME=admin" >> .env
echo "ADMIN_PASSWORD=change-me" >> .env

# Start services
docker compose -f docker-compose-hub.yml up -d
```

**Option 2: Build from Source**
```bash
1. **Clone the repository**
   ```bash
   git clone https://github.com/leshicodes/Invio-Freelancer.git
   cd Invio-Freelancer
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings (JWT_SECRET, etc.)
   ```

3. **Start with Docker Compose**
   ```bash
   # Production
   docker compose up -d

   # Development (with hot reload)
   docker compose -f docker-compose-dev.yml up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:8000
   - Backend API: http://localhost:3000

5. **Default credentials**
   - Username: `admin`
   - Password: `admin`
   - ⚠️ **Change these immediately in Settings!**

### Docker Hub Images

Pre-built images are available on Docker Hub:
- **Backend**: `leshicodes/invio-freelancer-backend:latest`
- **Frontend**: `leshicodes/invio-freelancer-frontend:latest`

📖 **[View complete Docker deployment guide](./DOCKER.md)** for:
- Production setup with reverse proxy (Nginx/Traefik)
- Data backup strategies
- Security best practices
- Troubleshooting

### Configuration

Key settings in `.env`:
```env
JWT_SECRET=your-secret-key-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
BASE_URL=http://localhost:3000
```

---

## 📖 Usage Guide

### Setting Up Your First Customer

1. Navigate to **Customers** → **New Customer**
2. Fill in customer details (name, email, address, etc.)
3. **Set Default Hourly Rate** (e.g., $50.00)
4. Save customer

### Creating a Time-Based Invoice

1. Navigate to **Invoices** → **New Invoice**
2. Select customer → rate auto-fills to their default
3. Add line items:
   - **Date**: Date of service
   - **Start / End**: Start and end times (hours auto-calculated, overnight-aware)
   - **Rate**: $50.00 (pre-filled from customer; toggle ✏️ to override per line)
   - **Miles**: 30 (optional, round-trip total)
   - **Notes**: Description of work performed
   - **Price**: Auto-calculates to `(Rate × Hours) + (Miles × $0.725)`
4. System totals all line items automatically
5. Save and share the public link with your client

### Configuring Mileage Rate

1. Navigate to **Settings** → **General**
2. Find "Mileage Rate per Mile"
3. Update to current IRS rate or your preference (e.g., $0.725)
4. Save settings

### PDF Orientation

1. Navigate to **Settings** → **General**
2. Toggle **"PDF Landscape Mode"** to set landscape as your default
3. You can also override per-download from the invoice page's **Download PDF** dropdown (Portrait, Landscape, Portrait + Verbose, Landscape + Verbose)

---

## 🏗️ Technical Architecture

### Stack
- **Frontend**: Deno 2.x + Fresh Framework (SSR with Preact)
- **Backend**: Hono (fast HTTP framework)
- **Database**: SQLite (embedded, no external DB required)
- **PDF Generation**: Chromium (headless browser)
- **Styling**: DaisyUI + Tailwind CSS

### Project Structure
```
Invio-Freelancer/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── invoices.ts          # Time-based calculation logic
│   │   │   └── customers.ts         # Customer + default rates
│   │   ├── database/
│   │   │   ├── init.ts              # DB initialization + helpers
│   │   │   └── migrations.sql       # Schema with time-based fields
│   │   └── utils/
│   │       └── pdf.ts               # PDF generation with modifiers
│   └── static/
│       └── templates/               # Updated HTML templates
├── frontend/
│   ├── islands/
│   │   └── InvoiceEditorIsland.tsx  # Time-based invoice editor
│   ├── routes/
│   │   ├── invoices/                # Invoice CRUD routes
│   │   ├── customers/               # Customer CRUD routes
│   │   └── settings.tsx             # Settings with modifiers tab
│   └── components/
└── docker-compose.yml
```

### Database Schema Changes

**Updated: `customers`**
```sql
ALTER TABLE customers ADD COLUMN default_hourly_rate NUMERIC;
```

**Updated: `invoice_items`**
```sql
ALTER TABLE invoice_items ADD COLUMN hours NUMERIC;
ALTER TABLE invoice_items ADD COLUMN rate NUMERIC;
ALTER TABLE invoice_items ADD COLUMN service_date TEXT;
ALTER TABLE invoice_items ADD COLUMN service_start_time TEXT;
ALTER TABLE invoice_items ADD COLUMN service_end_time TEXT;
ALTER TABLE invoice_items ADD COLUMN distance NUMERIC;
-- quantity and unit_price remain for backward compatibility
```

**New Settings**
```sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('mileageRate', '0.725');
INSERT OR IGNORE INTO settings (key, value) VALUES ('pdfLandscape', 'false');
```

---

## 🔄 Backward Compatibility

This fork maintains **backward compatibility** with original Invio invoices:

- Old invoices with `quantity × unitPrice` still display and calculate correctly
- Database schema keeps `quantity` and `unit_price` fields (nullable)
- Templates handle both old and new invoice formats
- Migration path available for converting old invoices to time-based

---

## 🛠️ Development

### Local Development Setup

1. **Install Deno** (if not using Docker)
   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   ```

2. **Start backend**
   ```bash
   cd backend
   deno task start
   # Runs on http://localhost:3000
   ```

3. **Start frontend**
   ```bash
   cd frontend
   deno task start
   # Runs on http://localhost:8000
   ```

### Running Tests
```bash
# Backend tests
cd backend
deno test --allow-all

# Frontend tests
cd frontend
deno test --allow-all
```

### Building for Production
```bash
docker compose build
docker compose up -d
```

---

## 📋 Roadmap

### Completed ✅
- [x] Time-based line item calculation
- [x] Customer default hourly rates
- [x] Per-line rate override toggle
- [x] Date of service per line item
- [x] Start/end time with overnight support and auto-calculated hours
- [x] Copy/duplicate line items
- [x] Mileage reimbursement tracking ($0.725/mile default)
- [x] Automatic price calculation
- [x] Portrait & landscape PDF download
- [x] Verbose PDF with per-line formula breakdown
- [x] Updated PDF templates
- [x] Backward compatibility with quantity-based invoices

### Planned 🔮
- [ ] Visual indicators for custom rates in PDF/HTML
- [ ] Time tracking integration (auto-populate hours)
- [ ] Multiple rates per customer (different service types)
- [ ] Expense tracking beyond mileage
- [ ] Invoice templates for common job types
- [ ] Reporting/analytics on rate modifiers usage
- [ ] Automatic mileage calculation from addresses
- [ ] Recurring invoices for retainer clients

---

## 🆚 Invio vs. Invio Freelancer

| Feature | Original Invio | Invio Freelancer |
|---------|---------------|------------------|
| **Billing Model** | Quantity × Price | Hours × Rate + Mileage |
| **Customer Rates** | - | ✅ Default hourly rate per customer |
| **Per-line Rate Override** | - | ✅ Toggle per line item |
| **Date & Time Per Job** | - | ✅ Start/end time, overnight-aware |
| **Copy Line Items** | - | ✅ One-click duplicate |
| **Mileage Tracking** | - | ✅ Automatic reimbursement ($0.725/mi) |
| **Price Entry** | Manual | ✅ Automatic calculation |
| **PDF Orientation** | Portrait only | ✅ Portrait & Landscape |
| **Verbose PDF** | - | ✅ Formula breakdown per line |
| **Use Case** | Product sales | Service-based freelancing |

---

## 💡 Use Cases

Perfect for:
- **ASL Interpreters** 👋 — Variable rates for medical, legal, educational work
- **Consultants** 💼 — Premium rates for urgent requests
- **Freelance Developers** 💻 — Different rates for dev/support/emergency
- **Photographers** 📸 — Hourly rate + mileage for shoots
- **Private Tutors** 📚 — Standard vs. weekend vs. holiday rates
- **Contractors** 🔧 — Hourly labor + travel reimbursement
- **Any hourly service provider** needing professional invoicing

---

## 🤝 Contributing

Contributions are welcome! This fork follows the same contribution guidelines as the upstream project.

### Reporting Issues
- Check existing issues first
- Provide clear reproduction steps
- Include environment details (Docker version, OS, etc.)

### Submitting PRs
1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## ⚖️ License

This project maintains the same license as the upstream [Invio project](https://github.com/kittendevv/Invio).

---

## 🙏 Acknowledgments

### Upstream Project
**[Invio](https://github.com/kittendevv/Invio)** by **[kittendevv](https://github.com/kittendevv)** — The foundation of this fork. All core architecture, design, and foundational code credit goes to kittendevv and the Invio contributors. ❤️

### Support Original Creator
If this fork helps you, please support the original:
- ☕ [Buy kittendevv a coffee](https://ko-fi.com/codingkitten)
- ⭐ [Star the original Invio repo](https://github.com/kittendevv/Invio)

### This Fork
Maintained by **[leshicodes](https://github.com/leshicodes)** for freelance service providers.

---

## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/leshicodes/Invio-Freelancer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/leshicodes/Invio-Freelancer/discussions)
- **Original Docs**: [Invio Wiki](https://github.com/kittendevv/Invio/wiki)

---

<p align="center">
  <sub>Forked with ❤️ from <a href="https://github.com/kittendevv/Invio">Invio</a> by <a href="https://github.com/kittendevv">kittendevv</a></sub>
</p>

<p align="center">
  <sub>Modified for time-based freelance invoicing by <a href="https://github.com/leshicodes">leshicodes</a></sub>
</p>

<p align="center">
  <sub>If you find this useful, please ⭐️ both repos!</sub>
</p>
