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

### Upstream Attribution

All core architecture, design, and foundational code credit goes to **[kittendevv](https://github.com/kittendevv)** and the Invio contributors. This fork builds on their excellent work. ❤️

**If you need traditional product invoicing, please use the [original Invio](https://github.com/kittendevv/Invio).**

---

## 🌟 Why Invio Freelancer?

- **Time-based billing** — invoice by hours, not quantity. Perfect for interpreters, consultants, and service providers.
- **Rate modifiers** — apply multipliers for holidays, weekends, overnight work, rush jobs, etc.
- **Mileage tracking** — automatically calculate reimbursement at configurable rates (default: federal standard).
- **Customer default rates** — set hourly rates per client, auto-populate on new invoices.
- **Automatic calculations** — no manual price entry. System calculates: `(Rate × Hours × Modifier) + (Miles × Mileage Rate)`.
- **You really own it** — self-hosted by default. Your data lives where you put it.
- **Fast & dependable** — Deno + Fresh + Hono + SQLite keeps things simple and quick.
- **Client-friendly** — share a secure public link—no accounts required to view invoices.

---

## ✨ New Features (vs. Original Invio)

### 1. Time-Based Line Items
Instead of `Quantity × Unit Price`, invoices now use:
```
Line Total = (Rate × Hours × Modifier) + (Distance × Mileage Rate)
```

**Example:**
- Rate: $50/hour
- Hours: 2.5
- Modifier: Holiday (1.5x)
- Distance: 30 miles @ $0.70/mile
- **Total: $208.50** = ($50 × 2.5 × 1.5) + (30 × $0.70)

### 2. Customer Default Rates
Set a default hourly rate per customer (e.g., Hospital A = $50/hr, University B = $75/hr). New invoice line items auto-populate with the customer's rate.

### 3. Rate Modifiers
Create custom rate multipliers in Settings → Rate Modifiers:
- **Standard** (1.0x) — regular daytime work
- **Holiday** (1.5x) — holiday premium
- **Overnight** (1.75x) — overnight shifts
- **Weekend** (1.2x) — weekend work
- **Rush** (1.3x) — last-minute bookings

Fully user-configurable and extensible.

### 4. Mileage Reimbursement
Track round-trip mileage per job. System automatically calculates reimbursement at configurable rate (default: $0.70/mile, federal standard 2025).

### 5. Automatic Price Calculation
Price field is **calculated, not entered**. No manual math errors. System shows transparent breakdown of how totals are calculated.

### 6. Ad-hoc Rate Adjustments
Override rate per line item for special cases (charity events, discounts, specialized work).

### 7. Updated PDF Templates
Both included templates (Minimalist Clean & Professional Modern) display:
- Hours worked
- Hourly rate ($/hr)
- Rate modifier name and multiplier
- Miles traveled
- Calculated line total

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
   - **Description**: "ASL Interpreting - Hospital Appointment"
   - **Hours**: 2.5 (accepts decimals)
   - **Rate**: $50.00 (pre-filled, editable)
   - **Modifier**: Select from dropdown (e.g., "Holiday")
   - **Miles**: 30 (optional, round-trip total)
   - **Price**: Auto-calculates to $208.50
4. System totals all line items automatically
5. Save and share the public link with your client

### Managing Rate Modifiers

1. Navigate to **Settings** → **Rate Modifiers**
2. View existing modifiers (Standard, Holiday, etc.)
3. **Add new**: Click "Add Rate Modifier"
   - Name: "Weekend"
   - Multiplier: 1.2
   - Mark as default: No
4. **Edit/Delete**: Use action buttons on each modifier
5. One modifier must be marked as default (typically "Standard" at 1.0x)

### Configuring Mileage Rate

1. Navigate to **Settings** → **General**
2. Find "Mileage Rate per Mile"
3. Update to current federal rate or your preference (e.g., $0.70)
4. Save settings

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
│   │   │   ├── customers.ts         # Customer + default rates
│   │   │   └── rate_modifiers.ts    # Rate modifiers CRUD
│   │   ├── database/
│   │   │   ├── init.ts              # DB initialization + helpers
│   │   │   └── migrations.sql       # Schema with time-based fields
│   │   └── utils/
│   │       └── pdf.ts               # PDF generation with modifiers
│   └── static/
│       └── templates/               # Updated HTML templates
├── frontend/
│   ├── islands/
│   │   ├── InvoiceEditorIsland.tsx  # Time-based invoice editor
│   │   └── RateModifiersManager.tsx # Modifiers management UI
│   ├── routes/
│   │   ├── invoices/                # Invoice CRUD routes
│   │   ├── customers/               # Customer CRUD routes
│   │   └── settings.tsx             # Settings with modifiers tab
│   └── components/
└── docker-compose.yml
```

### Database Schema Changes

**New Table: `rate_modifiers`**
```sql
CREATE TABLE rate_modifiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  multiplier NUMERIC NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Updated: `customers`**
```sql
ALTER TABLE customers ADD COLUMN default_hourly_rate NUMERIC;
```

**Updated: `invoice_items`**
```sql
ALTER TABLE invoice_items ADD COLUMN hours NUMERIC;
ALTER TABLE invoice_items ADD COLUMN rate NUMERIC;
ALTER TABLE invoice_items ADD COLUMN rate_modifier_id TEXT;
ALTER TABLE invoice_items ADD COLUMN distance NUMERIC;
-- quantity and unit_price now nullable for backward compatibility
```

**New Setting: `mileageRate`**
```sql
INSERT INTO settings (key, value) VALUES ('mileageRate', '0.70');
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
- [x] Rate modifiers system with UI
- [x] Mileage reimbursement tracking
- [x] Automatic price calculation
- [x] Updated PDF templates
- [x] Ad-hoc rate overrides per line item
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
| **Billing Model** | Quantity × Price | Hours × Rate × Modifier + Mileage |
| **Customer Rates** | - | ✅ Default hourly rate per customer |
| **Rate Modifiers** | - | ✅ Configurable multipliers |
| **Mileage Tracking** | - | ✅ Automatic reimbursement |
| **Price Entry** | Manual | ✅ Automatic calculation |
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
