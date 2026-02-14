# Variance Analysis Tool

Enterprise-grade spend variance analyzer that replaces 30–60 minutes of manual Excel work with a single drag-and-drop workflow. Python handles the variance calculations; an optional AI layer reads Line Memos from the top variance driver and generates executive-ready commentary — with a full audit trail.

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## What It Does

Upload your spend data CSV, configure the analysis parameters, and get a complete variance report in seconds — broken down by spend category, cost center, and supplier.

### Two Analysis Modes

| Mode | Input | Comparison | Use Case |
|------|-------|------------|----------|
| **Accounting Variance** | 1 file | Actual vs. Budget / Standard | Month-end close, GAAP-aligned cost accounting |
| **Financial Variance (MoM)** | Up to 5 files | Current month vs. prior month(s) | Operational trend analysis, exec reporting |

### Key Features

- **Real CSV Parsing** — Reads your spend data directly via PapaParse; no mock data, no hardcoded categories
- **Variance by Spend Category** — Top-level table with dollar and percentage variances, sorted by absolute impact
- **Drill-Down Drivers** — Expandable groups by cost center and supplier showing exactly where variances originate
- **Commentary: Python Only** — Factual, single-sentence variance attribution chaining spend category → top driver → supplier. No narrative filler. Example: *"Rent spend increased +$238K vs. prior period, driven primarily by CC-535 (+$18K via Amazon)."*
- **Commentary: Python + AI** — Same immutable Python sentence, enhanced by Claude Sonnet 4.5 reading the Line Memos tied to the top variance driver for that category. The LLM adds 1–2 sentences of executive context (spend types, department patterns, accounting adjustments). Python-generated numbers, categories, and driver attribution are never modified by the LLM.
- **Audit Trail** — Every AI-enhanced commentary includes an expandable audit panel showing: which driver's memos were sent to the LLM, the driver's share of total category variance, row count, and the exact Line Memo text — full traceability from CSV row to AI output.
- **Graceful Degradation** — If the AI API call fails, the tool falls back to Python-only commentary with no user-facing errors
- **Market Segmentation** — Filter by Consolidated, Non-JP, or JP markets
- **Methodology Transparency** — Collapsible panels explain formulas, calculation methodology, and escalation thresholds

---

## Commentary Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  CSV Upload   │────▶│  Python Engine    │────▶│  Factual Sentence  │
│  (PapaParse)  │     │  Variance Calc    │     │  (immutable)       │
└──────────────┘     │  Top Driver ID    │     └────────┬───────────┘
                     └──────────────────┘              │
                                                        │ AI Toggle ON
                                                        ▼
                     ┌──────────────────┐     ┌────────────────────┐
                     │  Top Driver's    │────▶│  Claude Sonnet 4.5 │
                     │  Line Memos      │     │  Adds 1-2 context  │
                     └──────────────────┘     │  sentences          │
                                              └────────┬───────────┘
                                                        │
                                                        ▼
                                              ┌────────────────────┐
                                              │  Audit Trail       │
                                              │  Driver + Memos    │
                                              │  sent to LLM       │
                                              └────────────────────┘
```

**Python Only:** Factual chain — nothing extra.

**Python + AI:** Same factual sentence + LLM enhancement. The LLM receives only the Line Memos from the #1 variance driver for that spend category. It never sees raw dollar amounts, never modifies the Python sentence, and every memo it read is visible in the audit trail.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/dhakshanayashwanth/variance-analysis-tool.git
cd variance-analysis-tool
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173`.

### Production Build

```bash
npm run build
npm run preview
```

---

## Expected CSV Format

The tool expects a CSV with the following columns:

| Column | Description |
|--------|-------------|
| `Market` | Geographic market (e.g., North America, APAC, EMEA) |
| `Date` | Transaction date |
| `Amount` | Spend amount |
| `Line Memo` | Free-text description of the transaction |
| `Spend Category` | Category (e.g., Consulting, Software, Rent, Travel) |
| `Supplier` | Vendor name |
| `Cost Center` | Cost center code |
| `Department` | Department name |
| `Variance Amount` | Variance vs. prior period or budget |

Additional columns (GL Account, Invoice Number, Voucher ID, Legal Entity, etc.) are preserved but not required for analysis.

---

## Project Structure

```
variance-analysis-tool/
├── index.html          # Entry HTML
├── package.json        # Dependencies & scripts
├── vite.config.js      # Vite + React plugin config
└── src/
    ├── main.jsx        # React DOM mount
    └── App.jsx         # Full application (single-file component)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| Build Tool | Vite 5.4 |
| CSV Parsing | PapaParse 5.4 |
| AI Commentary | Claude Sonnet 4.5 (Anthropic API) |
| Styling | Inline styles, Salesforce Lightning design system |
| Typography | DM Sans + JetBrains Mono (Google Fonts) |
| State Management | React hooks (`useState`, `useRef`, `useCallback`) |

---

## Data Security

```
Your Data (CSV) → Python Engine (local) → PII Proxy (scrubs sensitive data) → LLM (commentary only)
```

- **Raw data stays local** — Variance calculations run entirely in the browser
- **LLM receives only Line Memos** from the single top variance driver — not raw financial records
- **Python sentence is immutable** — The LLM cannot modify variance amounts, category names, or driver attribution
- **Audit trail** — Every AI enhancement traces back to the exact memos the LLM received

---

## How Variances Are Calculated

### Accounting Mode
```
Variance = Actual Cost − Budgeted (Standard) Cost
```
Positive = over-budget (unfavorable). Line-item comparison at the cost center level with price/volume decomposition and FX isolation.

### Financial (MoM) Mode
```
Variance = Current Month Actual − Prior Month Actual
```
Surfaces operational trends with seasonal adjustment factors and run-rate extrapolation for full-quarter projections.

### Escalation Thresholds

**Accounting:** ± 0–2% Immaterial → ± 2–5% Notable → ± 5–10% Significant → >±10% Critical

**Financial:** ± 0–3% Stable → ± 3–7% Trending → ± 7–15% Escalating → >±15% Anomalous

---

## License

MIT

---

Built by [Yashwanth Dhakshana](https://github.com/dhakshanayashwanth)
