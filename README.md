# Variance Analysis Tool

Enterprise-grade spend variance analyzer that replaces 30–60 minutes of manual Excel work with a single drag-and-drop workflow. Python handles the variance calculations; an optional AI layer generates executive-ready commentary.

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## What It Does

Upload your spend data (CSV or XLSX), configure the analysis parameters, and get a complete variance report in seconds — broken down by spend category, cost center, and supplier with color-coded severity indicators.

### Two Analysis Modes

| Mode | Input | Comparison | Use Case |
|------|-------|------------|----------|
| **Accounting Variance** | 1 file | Actual vs. Budget / Standard | Month-end close, GAAP-aligned cost accounting |
| **Financial Variance (MoM)** | Up to 5 files | Current month vs. prior month(s) | Operational trend analysis, exec reporting |

### Key Features

- **Variance by Spend Category** — Top-level table with dollar and percentage variances, sorted by absolute impact
- **Drill-Down Drivers** — Expandable groups by cost center and supplier showing exactly where variances originate
- **AI-Enhanced Commentary** — Optional LLM-generated narrative explanations for each material variance, with severity classification (Unfavorable / Favorable / Monitor)
- **Market Segmentation** — Filter by Consolidated, Non-JP, or JP markets
- **Methodology Transparency** — Collapsible panels explain formulas, calculation methodology, and escalation thresholds
- **Data Security Architecture** — PII proxy layer scrubs sensitive data before anything reaches the LLM; raw financials never leave your environment

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
| Styling | Inline styles (zero CSS dependencies) |
| Typography | DM Sans + JetBrains Mono (Google Fonts) |
| State Management | React hooks (`useState`, `useRef`, `useCallback`) |

---

## Data Security

The tool is designed with a defense-in-depth approach to financial data:

```
Your Data (CSV/XLSX) → Python Engine (local) → PII Proxy (scrubs sensitive data) → LLM (anonymized, commentary only)
```

- **Raw data stays local** — Variance calculations run entirely in the Python engine
- **PII proxy layer** — Strips vendor names, employee IDs, cost center codes, and all personally identifiable information before any data reaches the LLM
- **LLM receives only anonymized aggregates** — The commentary engine sees sanitized variance figures, never raw financial records
- **Zero data retention** — LLM provider contractually bound to not retain any inputs
- **SOC 2 Type II compliant** infrastructure with full audit logging

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
