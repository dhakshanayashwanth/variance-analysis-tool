import { useState, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   VARIANCE ANALYSIS TOOL
   Enterprise-grade spend variance analyzer
   ═══════════════════════════════════════════════════════════════ */

// ─── Analysis Type Definitions ───
const analysisTypes = {
  accounting: {
    label: "Accounting Variance",
    description: "Compares actual spend against budgeted/standard costs using GAAP-aligned cost accounting methodology. Single file input.",
    formula: "Variance = Actual Cost − Budgeted (Standard) Cost",
    interpretation: "A positive variance indicates over-budget (unfavorable); a negative variance indicates under-budget (favorable).",
    thresholds: [
      { range: "± 0–2%", label: "Immaterial", action: "No action required. Within normal operating tolerance." },
      { range: "± 2–5%", label: "Notable", action: "Flag for review during month-end close. Include in management commentary." },
      { range: "± 5–10%", label: "Significant", action: "Requires cost center owner explanation and corrective action plan." },
      { range: "> ±10%", label: "Critical", action: "Escalate to Finance Director. Mandatory variance memo and reforecast." },
    ],
    priorLabel: "Budget / Standard",
    currentLabel: "Actual",
    methodology: [
      "Line-item comparison of actual GL postings against approved budget at the cost center level.",
      "Variances decomposed into Price Variance (rate differential) and Volume Variance (quantity differential) where applicable.",
      "Accrual adjustments applied for timing differences (e.g., invoices received but not yet posted).",
      "FX impact isolated for multi-currency cost centers using budget vs. actual exchange rates.",
    ],
  },
  finance: {
    label: "Financial Variance (MoM)",
    description: "Month-over-month trend analysis comparing up to 5 periods of spend data for operational insight.",
    formula: "Variance = Current Month Actual − Prior Month Actual",
    interpretation: "Identifies spend trajectory and anomalies. Positive = spend increase; Negative = spend decrease.",
    thresholds: [
      { range: "± 0–3%", label: "Stable", action: "Normal fluctuation. No action required." },
      { range: "± 3–7%", label: "Trending", action: "Monitor over next 2 periods. Note in operating review." },
      { range: "± 7–15%", label: "Escalating", action: "Requires business owner narrative. Include in exec variance deck." },
      { range: "> ±15%", label: "Anomalous", action: "Immediate investigation. May indicate one-time event or data error." },
    ],
    priorLabel: "Prior Month",
    currentLabel: "Current Month",
    methodology: [
      "Compares consecutive monthly actuals to surface operational trends independent of budget assumptions.",
      "Seasonal adjustment factors applied where historical patterns exist (e.g., Q4 media spend spikes).",
      "Run-rate extrapolation used to project full-quarter and full-year impact of observed variances.",
      "Correlation analysis between cost categories to identify linked spend movements (e.g., headcount ↔ facilities).",
    ],
  },
};

// ─── Mock Data Generator ───
const generateMockData = (marketFilter) => {
  const categories = [
    { name: "Media Spend", prior: 42850000, current: 45120000 },
    { name: "Personnel", prior: 31200000, current: 30450000 },
    { name: "Technology", prior: 18750000, current: 20100000 },
    { name: "Professional Services", prior: 12400000, current: 13850000 },
    { name: "Facilities", prior: 8900000, current: 8650000 },
    { name: "Travel & Events", prior: 5600000, current: 6200000 },
    { name: "Other OpEx", prior: 3200000, current: 3450000 },
  ];

  const multiplier = marketFilter === "JP" ? 0.18 : marketFilter === "Non-JP" ? 0.82 : 1;

  const scaled = categories.map((c) => ({
    ...c,
    prior: Math.round(c.prior * multiplier),
    current: Math.round(c.current * multiplier),
  }));

  scaled.forEach((c) => {
    c.variance = c.current - c.prior;
    c.variancePct = c.prior !== 0 ? ((c.variance / c.prior) * 100) : 0;
  });

  return scaled;
};

const generateMonthlyData = (marketFilter) => {
  const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const multiplier = marketFilter === "JP" ? 0.18 : marketFilter === "Non-JP" ? 0.82 : 1;
  return months.map((m, i) => {
    const base = 9500000 + Math.sin(i * 0.8) * 2000000;
    const prior = Math.round((base + (Math.random() - 0.5) * 1000000) * multiplier);
    const current = Math.round((base * 1.04 + (Math.random() - 0.5) * 1500000) * multiplier);
    return { month: m, prior, current, variance: current - prior, variancePct: ((current - prior) / prior * 100) };
  });
};

const generateDrivers = (marketFilter) => {
  const drivers = [
    { category: "Media Spend", costCenter: "US Performance Marketing", supplier: "Google Ads", variance: 1450000 },
    { category: "Media Spend", costCenter: "US Brand Marketing", supplier: "Meta Platforms", variance: 820000 },
    { category: "Technology", costCenter: "Cloud Infrastructure", supplier: "AWS", variance: 680000 },
    { category: "Technology", costCenter: "SaaS Licenses", supplier: "Salesforce", variance: 450000 },
    { category: "Technology", costCenter: "Data Platform", supplier: "Snowflake", variance: 220000 },
    { category: "Professional Services", costCenter: "Strategy Consulting", supplier: "McKinsey & Co", variance: 590000 },
    { category: "Professional Services", costCenter: "Staffing - Engineering", supplier: "Insight Global", variance: 480000 },
    { category: "Professional Services", costCenter: "Staffing - Analytics", supplier: "Robert Half", variance: 380000 },
    { category: "Travel & Events", costCenter: "Sales Enablement", supplier: "Various Hotels", variance: 350000 },
    { category: "Travel & Events", costCenter: "Exec Travel", supplier: "Concur", variance: 250000 },
    { category: "Other OpEx", costCenter: "Legal & Compliance", supplier: "External Counsel", variance: 250000 },
    { category: "Personnel", costCenter: "Sales - Mid Market", supplier: "Internal HC", variance: -310000 },
    { category: "Personnel", costCenter: "Engineering - Platform", supplier: "Internal HC", variance: -280000 },
    { category: "Personnel", costCenter: "Customer Success", supplier: "Internal HC", variance: -160000 },
    { category: "Facilities", costCenter: "Austin HQ", supplier: "CBRE", variance: -150000 },
    { category: "Facilities", costCenter: "Stamford Office", supplier: "JLL", variance: -100000 },
  ];

  const multiplier = marketFilter === "JP" ? 0.18 : marketFilter === "Non-JP" ? 0.82 : 1;
  return drivers
    .map((d) => ({ ...d, variance: Math.round(d.variance * multiplier) }))
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
};

const generateCommentary = (numComments, commentaryType, marketFilter, categories) => {
  if (commentaryType === "none") return [];

  const drivers = generateDrivers(marketFilter);
  const sorted = [...categories].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  // Find top driver for a given category (by absolute variance)
  const topDriver = (catName) => {
    const catDrivers = drivers
      .filter((d) => d.category === catName)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    return catDrivers[0] || null;
  };

  const commentaryMap = {
    "Media Spend": (v, td) => ({
      title: "Media Spend Over-Index",
      body: `Total media spend ${v >= 0 ? "increased" : "decreased"} ${fmtVar(v)} vs. prior period, driven primarily by ${td.costCenter} (${fmtVar(td.variance)} via ${td.supplier}). The increase is attributable to incremental paid search investment during Q2 hiring campaigns and expanded brand awareness initiatives. Recommend reviewing ROI thresholds for campaigns exceeding $500K monthly burn rate.`,
      severity: v >= 0 ? "high" : "favorable",
    }),
    "Professional Services": (v, td) => ({
      title: "Professional Services Escalation",
      body: `Professional services spend ${v >= 0 ? "exceeded plan" : "came in under plan"} by ${fmt(Math.abs(v))}, driven primarily by ${td.costCenter} (${fmtVar(td.variance)} via ${td.supplier}). The variance correlates with Q2 engineering sprint acceleration and expanded consulting engagements. Engagement scoping and vendor rate card review recommended for Q3.`,
      severity: v >= 0 ? "high" : "favorable",
    }),
    "Technology": (v, td) => ({
      title: "Technology Infrastructure Growth",
      body: `Technology spend ${v >= 0 ? "increased" : "decreased"} ${fmtVar(v)} vs. prior period, driven primarily by ${td.costCenter} (${fmtVar(td.variance)} via ${td.supplier}). Consumption growth is tied to data pipeline scaling and increased query volume from new ML forecasting workloads. Recommend conducting cloud cost optimization review with Infrastructure team.`,
      severity: v >= 0 ? "high" : "favorable",
    }),
    "Personnel": (v, td) => ({
      title: "Personnel Savings from Attrition",
      body: `Personnel costs ${v < 0 ? "decreased" : "increased"} ${fmt(Math.abs(v))}, driven primarily by ${td.costCenter} (${fmtVar(td.variance)}). Open headcount backfills are in progress but lag 45-60 days behind departures, creating temporary P&L favorability. Recommend monitoring backfill pipeline and conversion timelines.`,
      severity: v < 0 ? "favorable" : "high",
    }),
    "Travel & Events": (v, td) => ({
      title: "Travel & Events Normalization",
      body: `T&E variance of ${fmtVar(v)} vs. prior period, driven primarily by ${td.costCenter} (${fmtVar(td.variance)} via ${td.supplier}). While elevated vs. prior period, spend remains 22% below FY23 pre-normalization levels. Suggest monitoring monthly run-rate against updated FY25 T&E budget.`,
      severity: "medium",
    }),
    "Facilities": (v, td) => ({
      title: "Facilities Cost Reduction",
      body: `Facilities spend came in ${fmt(Math.abs(v))} ${v < 0 ? "under" : "over"} plan, driven primarily by ${td.costCenter} (${fmtVar(td.variance)} via ${td.supplier}). ${v < 0 ? "This represents a favorable offset to other cost increases." : "Recommend reviewing upcoming lease renewals."}`,
      severity: v < 0 ? "favorable" : "medium",
    }),
    "Other OpEx": (v, td) => ({
      title: "Other OpEx Variance",
      body: `Other operating expenses showed a ${fmtVar(v)} variance, driven primarily by ${td.costCenter} (${fmtVar(td.variance)} via ${td.supplier}). Recommend reviewing engagement scope and rate cards for outside services.`,
      severity: v >= 0 ? "medium" : "favorable",
    }),
  };

  const comments = sorted
    .filter((c) => commentaryMap[c.name] && topDriver(c.name))
    .slice(0, numComments)
    .map((c) => {
      const td = topDriver(c.name);
      const gen = commentaryMap[c.name](c.variance, td);
      return {
        ...gen,
        type: commentaryType === "ai" ? "Python + AI Generated" : "Python Generated",
      };
    });

  return comments;
};

// ─── Formatters ───
const fmt = (n) => {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};
const fmtFull = (n) => `$${n.toLocaleString()}`;
const fmtVar = (n) => {
  const prefix = n >= 0 ? "+" : "";
  if (Math.abs(n) >= 1e6) return `${prefix}$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${prefix}$${(n / 1e3).toFixed(0)}K`;
  return `${prefix}$${n.toLocaleString()}`;
};
const fmtPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

// ─── Colors & Theme (Salesforce Lightning-aligned) ───
const t = {
  bg: "#EBF0F5",
  card: "#FFFFFF",
  cardBorder: "#E5E7EB",
  cardHover: "#F9FAFB",
  accent: "#0176D3",
  accentDim: "rgba(1,118,211,0.08)",
  accentBorder: "rgba(1,118,211,0.22)",
  green: "#2E844A",
  greenDim: "rgba(46,132,74,0.08)",
  greenBorder: "rgba(46,132,74,0.22)",
  red: "#EA001E",
  redDim: "rgba(234,0,30,0.06)",
  redBorder: "rgba(234,0,30,0.18)",
  amber: "#CA8A04",
  amberDim: "rgba(202,138,4,0.08)",
  amberBorder: "rgba(202,138,4,0.20)",
  white: "#181818",
  text: "#3E3E3C",
  textDim: "#706E6B",
  textMuted: "#939297",
  headerBg: "#F7F9FB",
  rowHover: "rgba(1,118,211,0.04)",
  divider: "#E5E7EB",
  purple: "#7B61FF",
  purpleDim: "rgba(123,97,255,0.08)",
  cyan: "#0891B2",
  cyanDim: "rgba(8,145,178,0.07)",
  cyanBorder: "rgba(8,145,178,0.22)",
};

// ─── Info Dropdown Component ───
function InfoDropdown({ icon, title, color, borderColor, bgColor, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: t.card,
      border: `1px solid ${open ? borderColor : t.cardBorder}`,
      borderRadius: 10,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "14px 20px",
          background: open ? bgColor : "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "inherit",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 600, color: t.white }}>{title}</span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
          style={{ transition: "transform 0.25s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          padding: "0 20px 18px 20px",
          background: bgColor,
          animation: "fadeIn 0.2s ease",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Expandable Driver Components ───
function DriverCostCenter({ costCenter, supplier, variance }) {
  const [open, setOpen] = useState(false);
  const isUnfavorable = variance >= 0;
  return (
    <div style={{ borderBottom: `1px solid ${t.divider}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "10px 14px 10px 32px", background: "transparent", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "inherit", transition: "background 0.1s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = t.rowHover}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textDim} strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.white }}>{costCenter}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: isUnfavorable ? t.red : t.green }}>{fmtVar(variance)}</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px 56px", animation: "fadeIn 0.15s ease" }}>
          <div style={{ background: "rgba(0,0,0,0.02)", borderRadius: 8, border: `1px solid ${t.divider}`, padding: "14px 18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Supplier</div>
                <div style={{ fontSize: 13, color: t.white, fontWeight: 500 }}>{supplier}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Variance</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: isUnfavorable ? t.red : t.green }}>{fmtVar(variance)}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Direction</div>
                <span style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
                  background: isUnfavorable ? t.redDim : t.greenDim,
                  color: isUnfavorable ? t.red : t.green,
                  border: `1px solid ${isUnfavorable ? t.redBorder : t.greenBorder}`,
                }}>{isUnfavorable ? "Unfavorable" : "Favorable"}</span>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Abs. Impact</div>
                <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: t.text }}>{fmt(Math.abs(variance))}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverGroup({ category, drivers, groupTotal }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${t.divider}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "14px 18px", background: "rgba(1,118,211,0.04)", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "inherit", transition: "background 0.1s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(1,118,211,0.08)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(1,118,211,0.04)"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.white }}>{category}</span>
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: t.accentDim, border: `1px solid ${t.accentBorder}`, color: t.accent, fontWeight: 600 }}>{drivers.length}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: groupTotal >= 0 ? t.red : t.green }}>{fmtVar(groupTotal)}</span>
      </button>
      {open && (
        <div>
          {drivers.map((d, i) => (
            <DriverCostCenter key={i} costCenter={d.costCenter} supplier={d.supplier} variance={d.variance} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function VarianceAnalysisTool() {
  const [analysisType, setAnalysisType] = useState("finance");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [market, setMarket] = useState("all");
  const [commentary, setCommentary] = useState("ai");
  const [numComments, setNumComments] = useState(3);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);
  const dropdownRef = useRef(null);

  const currentType = analysisTypes[analysisType];
  const isMultiFile = analysisType === "finance";
  const maxFiles = isMultiFile ? 5 : 1;
  const hasFiles = files.length > 0;
  const canAddMore = files.length < maxFiles;

  const isValidFile = (f) => f && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx"));

  const addFiles = useCallback((newFiles) => {
    const valid = Array.from(newFiles).filter(isValidFile);
    setFiles((prev) => {
      const combined = [...prev, ...valid];
      return combined.slice(0, maxFiles);
    });
  }, [maxFiles]);

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleFile = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const runAnalysis = () => {
    setAnalyzing(true);
    setProgress(0);
    setResults(null);
    const steps = [12, 28, 45, 62, 78, 88, 95, 100];
    let i = 0;
    const iv = setInterval(() => {
      if (i < steps.length) {
        setProgress(steps[i]);
        i++;
      } else {
        clearInterval(iv);
        const marketFilter = market === "jp" ? "JP" : market === "nonjp" ? "Non-JP" : "All";
        const cats = generateMockData(marketFilter);
        setResults({
          categories: cats,
          drivers: generateDrivers(marketFilter),
          commentary: generateCommentary(numComments, commentary, marketFilter, cats),
          market: marketFilter,
          commentaryType: commentary,
          analysisType: analysisType,
          files: [...files],
        });
        setAnalyzing(false);
      }
    }, 350);
  };

  const marketLabel = market === "all" ? "Consolidated (All Markets)" : market === "nonjp" ? "Non-JP Markets" : "JP Market";

  // ─── Styles ───
  const sCard = { background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  const sLabel = { fontSize: 11, fontWeight: 600, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 };
  const sBtn = (active) => ({
    padding: "8px 16px",
    borderRadius: 7,
    border: active ? `1px solid ${t.accentBorder}` : `1px solid ${t.cardBorder}`,
    background: active ? t.accentDim : "transparent",
    color: active ? t.accent : t.textDim,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
    fontFamily: "inherit",
  });
  const sTh = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${t.divider}`, background: t.headerBg };
  const sTd = (i) => ({ padding: "10px 14px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.divider}`, background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)" });

  const varColor = (v) => v >= 0 ? t.red : t.green;
  const varBg = (v) => v >= 0 ? t.redDim : t.greenDim;

  const resType = results ? analysisTypes[results.analysisType] : currentType;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'DM Sans', 'SF Pro Display', -apple-system, system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ═══ Header ═══ */}
      <div style={{ padding: "16px 32px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, #0176D3, #032D60)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 5-9"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.white, letterSpacing: "-0.01em" }}>Variance Analysis Tool</div>
            <div style={{ fontSize: 11, color: t.textDim, marginTop: 1 }}>300x faster than manual analysis · Python for variance calculations, AI for commentary</div>
          </div>
        </div>
        <a
          href="https://github.com/dhakshanayashwanth/variance-analysis-tool/tree/main"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 500, color: t.textDim,
            textDecoration: "none", padding: "7px 14px", borderRadius: 7,
            border: `1px solid ${t.cardBorder}`, background: "transparent",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accentBorder; e.currentTarget.style.color = t.white; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.cardBorder; e.currentTarget.style.color = t.textDim; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          GitHub
        </a>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* ═══ Analysis Type Selector ═══ */}
        {!results && (
          <div style={{ marginBottom: 20, position: "relative" }} ref={dropdownRef}>
            <div style={sLabel}>Analysis Type</div>
            <button
              onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: 10,
                border: `1px solid ${typeDropdownOpen ? t.accentBorder : t.cardBorder}`,
                background: t.card,
                color: t.white,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: analysisType === "accounting" ? t.amberDim : t.accentDim,
                  border: `1px solid ${analysisType === "accounting" ? t.amberBorder : t.accentBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {analysisType === "accounting" ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.amber} strokeWidth="2" strokeLinecap="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 10h8"/><path d="M8 14h4"/></svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  )}
                </div>
                <div style={{ textAlign: "left" }}>
                  <div>{currentType.label}</div>
                  <div style={{ fontSize: 11, color: t.textDim, fontWeight: 400, marginTop: 2 }}>{currentType.description}</div>
                </div>
              </div>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textDim} strokeWidth="2.5" strokeLinecap="round"
                style={{ transition: "transform 0.2s", transform: typeDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {typeDropdownOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                marginTop: 6, borderRadius: 10, border: `1px solid ${t.accentBorder}`,
                background: t.card, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                animation: "fadeIn 0.15s ease", overflow: "hidden",
              }}>
                {Object.entries(analysisTypes).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => { setAnalysisType(key); setTypeDropdownOpen(false); setFiles([]); }}
                    style={{
                      width: "100%", padding: "14px 20px",
                      background: analysisType === key ? "rgba(1,118,211,0.06)" : "transparent",
                      border: "none", borderBottom: `1px solid ${t.divider}`,
                      cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 12,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(1,118,211,0.08)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = analysisType === key ? "rgba(1,118,211,0.06)" : "transparent"}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: key === "accounting" ? t.amberDim : t.accentDim,
                      border: `1px solid ${key === "accounting" ? t.amberBorder : t.accentBorder}`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {key === "accounting" ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.amber} strokeWidth="2" strokeLinecap="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 10h8"/><path d="M8 14h4"/></svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                      )}
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.white }}>{val.label}</div>
                      <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{val.description}</div>
                    </div>
                    {analysisType === key && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: "auto", flexShrink: 0 }}>
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Upload Section ═══ */}
        {!results && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => canAddMore && fileRef.current?.click()}
              style={{
                ...sCard,
                padding: hasFiles ? "20px 28px" : "48px 28px",
                textAlign: "center",
                cursor: canAddMore ? "pointer" : "default",
                borderStyle: hasFiles && !canAddMore ? "solid" : "dashed",
                borderColor: dragging ? t.accent : (hasFiles && !canAddMore) ? t.greenBorder : t.cardBorder,
                background: dragging ? t.accentDim : (hasFiles && !canAddMore) ? t.greenDim : t.card,
                transition: "all 0.2s",
              }}
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx" multiple={isMultiFile} onChange={handleFile} style={{ display: "none" }} />
              {hasFiles ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* File header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: files.length > 1 ? 4 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: t.greenDim, border: `1px solid ${t.greenBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.white }}>
                        {files.length} {files.length === 1 ? "file" : "files"} selected
                      </span>
                      {isMultiFile && (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: t.accentDim, border: `1px solid ${t.accentBorder}`, color: t.accent, fontWeight: 600 }}>
                          {files.length} / {maxFiles}
                        </span>
                      )}
                    </div>
                    {canAddMore && (
                      <button
                        onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                        style={{
                          padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: t.accentDim, border: `1px solid ${t.accentBorder}`, color: t.accent,
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        + Add File
                      </button>
                    )}
                  </div>
                  {/* File list */}
                  {files.map((f, i) => {
                    const monthLabels = ["Month 1 (Oldest)", "Month 2", "Month 3", "Month 4", "Month 5 (Current)"];
                    const label = isMultiFile ? monthLabels[i] || `Month ${i + 1}` : null;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 14px", borderRadius: 7,
                        background: "rgba(0,0,0,0.02)", border: `1px solid ${t.divider}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textDim} strokeWidth="2" strokeLinecap="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                          <div style={{ textAlign: "left" }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: t.white }}>{f.name}</div>
                            <div style={{ fontSize: 10, color: t.textDim, marginTop: 1 }}>
                              {(f.size / 1024).toFixed(1)} KB
                              {label && <span> · {label}</span>}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                          style={{ background: "transparent", border: "none", color: t.textDim, cursor: "pointer", fontSize: 16, fontFamily: "inherit", padding: "2px 6px", borderRadius: 4 }}
                          onMouseEnter={(e) => e.currentTarget.style.color = t.red}
                          onMouseLeave={(e) => e.currentTarget.style.color = t.textDim}
                        >×</button>
                      </div>
                    );
                  })}
                  {isMultiFile && canAddMore && (
                    <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>
                      Upload up to {maxFiles} monthly files for trend comparison · Drop files or click "Add File"
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: t.accentDim, border: `1px solid ${t.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.white, marginBottom: 4 }}>
                    {isMultiFile ? "Drop your monthly spend data files here" : "Drop your spend data file here"}
                  </div>
                  <div style={{ fontSize: 12, color: t.textDim }}>
                    {isMultiFile
                      ? `Upload up to ${maxFiles} files for MoM trend analysis · CSV or XLSX`
                      : "or click to browse · CSV or XLSX"
                    }
                  </div>
                </>
              )}
            </div>

            {/* ═══ Configuration Panel ═══ */}
            <div style={{ ...sCard, padding: "24px 28px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.white, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                Analysis Configuration
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
                {/* Market */}
                <div>
                  <div style={sLabel}>Market Scope</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { v: "all", l: "Consolidated (All Markets)" },
                      { v: "nonjp", l: "Non-JP" },
                      { v: "jp", l: "JP" },
                    ].map((o) => (
                      <button key={o.v} onClick={() => setMarket(o.v)} style={sBtn(market === o.v)}>{o.l}</button>
                    ))}
                  </div>
                </div>

                {/* Commentary */}
                <div>
                  <div style={sLabel}>Commentary Type</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { v: "ai", l: "Python + AI" },
                      { v: "python", l: "Python Only" },
                      { v: "none", l: "No Commentary" },
                    ].map((o) => (
                      <button key={o.v} onClick={() => setCommentary(o.v)} style={sBtn(commentary === o.v)}>{o.l}</button>
                    ))}
                  </div>
                </div>

                {/* Comments Count */}
                <div>
                  <div style={sLabel}>Number of Comments</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[1, 3, 5].map((n) => (
                      <button key={n} onClick={() => setNumComments(n)} style={sBtn(numComments === n)}>
                        {n} {n === 1 ? "Comment" : "Comments"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Informational Dropdowns ═══ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Formula & Calculation */}
              <InfoDropdown
                title="How Variances Are Calculated"
                color={t.accent}
                borderColor={t.accentBorder}
                bgColor={t.accentDim}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
              >
                <div style={{ marginTop: 4 }}>
                  <div style={{
                    padding: "12px 16px", borderRadius: 8,
                    background: "rgba(0,0,0,0.03)", border: `1px solid ${t.divider}`,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 500,
                    color: t.accent, marginBottom: 14, letterSpacing: "0.02em",
                  }}>
                    {currentType.formula}
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: t.text, margin: "0 0 14px 0" }}>
                    {currentType.interpretation}
                  </p>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Methodology</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {currentType.methodology.map((step, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                          background: "rgba(1,118,211,0.12)", border: `1px solid ${t.accentBorder}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: t.accent, fontFamily: "'JetBrains Mono', monospace",
                        }}>{i + 1}</div>
                        <span style={{ fontSize: 12, lineHeight: 1.6, color: t.text }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </InfoDropdown>

              {/* Thresholds */}
              <InfoDropdown
                title="Variance Thresholds & Escalation Matrix"
                color={t.amber}
                borderColor={t.amberBorder}
                bgColor={t.amberDim}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.amber} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              >
                <div style={{ marginTop: 4 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", borderRadius: 8, overflow: "hidden" }}>
                    <thead>
                      <tr>
                        {["Range", "Severity", "Required Action"].map((h) => (
                          <th key={h} style={{
                            padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 600,
                            color: t.textDim, textTransform: "uppercase", letterSpacing: "0.06em",
                            borderBottom: `1px solid ${t.divider}`, background: "rgba(0,0,0,0.02)",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentType.thresholds.map((th, i) => {
                        const severityColors = {
                          Immaterial: { bg: t.greenDim, color: t.green, border: t.greenBorder },
                          Stable: { bg: t.greenDim, color: t.green, border: t.greenBorder },
                          Notable: { bg: t.amberDim, color: t.amber, border: t.amberBorder },
                          Trending: { bg: t.amberDim, color: t.amber, border: t.amberBorder },
                          Significant: { bg: "rgba(249,115,22,0.1)", color: "#F97316", border: "rgba(249,115,22,0.25)" },
                          Escalating: { bg: "rgba(249,115,22,0.1)", color: "#F97316", border: "rgba(249,115,22,0.25)" },
                          Critical: { bg: t.redDim, color: t.red, border: t.redBorder },
                          Anomalous: { bg: t.redDim, color: t.red, border: t.redBorder },
                        };
                        const sc = severityColors[th.label] || { bg: t.accentDim, color: t.accent, border: t.accentBorder };
                        return (
                          <tr key={i}>
                            <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: t.white, fontWeight: 500, borderBottom: `1px solid ${t.divider}` }}>{th.range}</td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${t.divider}` }}>
                              <span style={{
                                fontSize: 10, padding: "3px 8px", borderRadius: 4, fontWeight: 600,
                                textTransform: "uppercase", letterSpacing: "0.04em",
                                background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                              }}>{th.label}</span>
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: 12, color: t.text, lineHeight: 1.5, borderBottom: `1px solid ${t.divider}` }}>{th.action}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </InfoDropdown>

              {/* Data Security */}
              <InfoDropdown
                title="Data Security & Privacy"
                color={t.cyan}
                borderColor={t.cyanBorder}
                bgColor={t.cyanDim}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.cyan} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
              >
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Architecture diagram */}
                    <div style={{
                      padding: "16px 20px", borderRadius: 8,
                      background: "rgba(0,0,0,0.03)", border: `1px solid ${t.divider}`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Data Flow Architecture</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, flexWrap: "wrap" }}>
                        {[
                          { label: "Your Data", icon: "📄", sub: "CSV / XLSX" },
                          null,
                          { label: "Python Engine", icon: "🐍", sub: "Variance Calc" },
                          null,
                          { label: "PII Proxy", icon: "🛡️", sub: "Scrubs Sensitive Data" },
                          null,
                          { label: "LLM", icon: "🤖", sub: "Commentary Only" },
                        ].map((item, i) =>
                          item === null ? (
                            <svg key={i} width="28" height="12" viewBox="0 0 28 12" style={{ flexShrink: 0 }}>
                              <line x1="2" y1="6" x2="22" y2="6" stroke={t.textDim} strokeWidth="1.5" />
                              <polyline points="18,2 24,6 18,10" fill="none" stroke={t.textDim} strokeWidth="1.5" />
                            </svg>
                          ) : (
                            <div key={i} style={{
                              padding: "10px 14px", borderRadius: 8, textAlign: "center", minWidth: 90,
                              background: item.label === "PII Proxy" ? t.cyanDim : "rgba(0,0,0,0.025)",
                              border: `1px solid ${item.label === "PII Proxy" ? t.cyanBorder : t.divider}`,
                            }}>
                              <div style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: t.white }}>{item.label}</div>
                              <div style={{ fontSize: 9, color: t.textDim, marginTop: 2 }}>{item.sub}</div>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Security details */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        {
                          title: "LLM Proxy Layer",
                          body: "All data sent to the LLM passes through a dedicated proxy that strips personally identifiable information (PII), vendor names, employee IDs, and cost center codes. The LLM receives only anonymized, aggregated variance figures for commentary generation.",
                          icon: "🛡️",
                        },
                        {
                          title: "Data Residency",
                          body: "Raw financial data never leaves your environment. Variance calculations are performed locally via the Python engine. Only sanitized numerical summaries are transmitted to the commentary service.",
                          icon: "🏢",
                        },
                        {
                          title: "Access Controls",
                          body: "Role-based access ensures only authorized users can run analyses. Market-level data segmentation enforced at the query layer. All access is logged with full audit trail.",
                          icon: "🔑",
                        },
                        {
                          title: "Compliance",
                          body: "SOC 2 Type II compliant infrastructure. Data handling follows GDPR and CCPA requirements. LLM provider contractually bound to zero data retention for all inputs.",
                          icon: "✅",
                        },
                      ].map((sec, i) => (
                        <div key={i} style={{
                          padding: "14px 16px", borderRadius: 8,
                          background: "rgba(0,0,0,0.025)", border: `1px solid ${t.divider}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 14 }}>{sec.icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: t.white }}>{sec.title}</span>
                          </div>
                          <p style={{ fontSize: 11, lineHeight: 1.6, color: t.textDim, margin: 0 }}>{sec.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </InfoDropdown>
            </div>

            {/* ═══ Run Button ═══ */}
            <button
              onClick={runAnalysis}
              disabled={!hasFiles || analyzing}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 10,
                border: "none",
                background: hasFiles && !analyzing ? `linear-gradient(135deg, #0176D3, #032D60)` : t.cardBorder,
                color: hasFiles && !analyzing ? "#fff" : t.textMuted,
                fontSize: 14,
                fontWeight: 700,
                cursor: hasFiles && !analyzing ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                letterSpacing: "0.02em",
                transition: "all 0.2s",
                boxShadow: hasFiles && !analyzing ? "0 4px 24px rgba(1,118,211,0.18)" : "none",
              }}
            >
              {analyzing ? "Analyzing..." : `Run ${currentType.label}${isMultiFile && files.length > 1 ? ` (${files.length} files)` : ""}`}
            </button>

            {/* Progress Bar */}
            {analyzing && (
              <div style={{ ...sCard, padding: "20px 28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: t.text }}>
                    {progress < 30 ? "Parsing data..." : progress < 60 ? "Computing variances..." : progress < 85 ? "Generating drivers..." : progress < 100 ? "Building commentary..." : "Complete"}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.accent, fontFamily: "'JetBrains Mono', monospace" }}>{progress}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: t.cardBorder }}>
                  <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, #0176D3, #032D60)`, width: `${progress}%`, transition: "width 0.3s ease" }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            RESULTS
            ═══════════════════════════════════════════ */}
        {results && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Results Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.white, letterSpacing: "-0.02em" }}>Analysis Results</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                  <span style={{
                    fontSize: 10, padding: "3px 9px", borderRadius: 5, fontWeight: 600,
                    background: results.analysisType === "accounting" ? t.amberDim : t.accentDim,
                    color: results.analysisType === "accounting" ? t.amber : t.accent,
                    border: `1px solid ${results.analysisType === "accounting" ? t.amberBorder : t.accentBorder}`,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>{resType.label}</span>
                  <span style={{ fontSize: 12, color: t.textDim }}>
                    {marketLabel} · {results.files?.length > 1 ? `${results.files.length} files` : results.files?.[0]?.name || "—"} · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setResults(null); setFiles([]); }}
                style={{ padding: "8px 18px", borderRadius: 7, border: `1px solid ${t.cardBorder}`, background: "transparent", color: t.text, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
              >
                ← New Analysis
              </button>
            </div>

            {/* ─── Summary KPIs ─── */}
            {(() => {
              const totPrior = results.categories.reduce((s, c) => s + c.prior, 0);
              const totCurrent = results.categories.reduce((s, c) => s + c.current, 0);
              const totVar = totCurrent - totPrior;
              const totPct = (totVar / totPrior) * 100;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                  {[
                    { label: resType.priorLabel, value: fmt(totPrior), sub: "Total Spend", color: t.textDim },
                    { label: resType.currentLabel, value: fmt(totCurrent), sub: "Total Spend", color: t.accent },
                    { label: "Total Variance", value: fmtVar(totVar), sub: fmtPct(totPct), color: totVar >= 0 ? t.red : t.green },
                  ].map((kpi, i) => (
                    <div key={i} style={{ ...sCard, padding: "18px 20px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{kpi.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>{kpi.value}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{kpi.sub}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ─── Results-level Info Dropdowns ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <InfoDropdown
                title={`${resType.label} — Formula & Interpretation`}
                color={t.accent}
                borderColor={t.accentBorder}
                bgColor={t.accentDim}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
              >
                <div style={{ marginTop: 4 }}>
                  <div style={{
                    padding: "10px 14px", borderRadius: 6,
                    background: "rgba(0,0,0,0.03)", border: `1px solid ${t.divider}`,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500,
                    color: t.accent, marginBottom: 10,
                  }}>{resType.formula}</div>
                  <p style={{ fontSize: 12, lineHeight: 1.6, color: t.text, margin: 0 }}>{resType.interpretation}</p>
                </div>
              </InfoDropdown>

              <InfoDropdown
                title="Active Thresholds for This Analysis"
                color={t.amber}
                borderColor={t.amberBorder}
                bgColor={t.amberDim}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.amber} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              >
                <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
                  {resType.thresholds.map((th, i) => {
                    const colors = [
                      { bg: t.greenDim, color: t.green, border: t.greenBorder },
                      { bg: t.amberDim, color: t.amber, border: t.amberBorder },
                      { bg: "rgba(249,115,22,0.1)", color: "#F97316", border: "rgba(249,115,22,0.25)" },
                      { bg: t.redDim, color: t.red, border: t.redBorder },
                    ];
                    const sc = colors[i] || colors[0];
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 6,
                        background: "rgba(0,0,0,0.025)", border: `1px solid ${t.divider}`,
                      }}>
                        <span style={{
                          fontSize: 10, padding: "3px 8px", borderRadius: 4, fontWeight: 700,
                          fontFamily: "'JetBrains Mono', monospace", minWidth: 70, textAlign: "center",
                          background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                        }}>{th.range}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.white, minWidth: 70 }}>{th.label}</span>
                        <span style={{ fontSize: 11, color: t.textDim }}>{th.action}</span>
                      </div>
                    );
                  })}
                </div>
              </InfoDropdown>

              <InfoDropdown
                title="Data Security — How Your Data Was Processed"
                color={t.cyan}
                borderColor={t.cyanBorder}
                bgColor={t.cyanDim}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.cyan} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
              >
                <div style={{ marginTop: 4 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 0, justifyContent: "center", padding: "14px 0",
                    flexWrap: "wrap",
                  }}>
                    {[
                      { label: "Raw Data", status: "Local Only", color: t.green },
                      { label: "Python Calc", status: "Local Only", color: t.green },
                      { label: "PII Proxy", status: "Scrubbed", color: t.cyan },
                      { label: "LLM Commentary", status: "Anonymized", color: t.amber },
                    ].map((step, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                        <div style={{ textAlign: "center", padding: "8px 12px" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: step.color, margin: "0 auto 6px" }} />
                          <div style={{ fontSize: 11, fontWeight: 600, color: t.white }}>{step.label}</div>
                          <div style={{
                            fontSize: 9, marginTop: 3, padding: "2px 6px", borderRadius: 3,
                            background: step.color === t.green ? t.greenDim : step.color === t.cyan ? t.cyanDim : t.amberDim,
                            color: step.color, fontWeight: 600,
                          }}>{step.status}</div>
                        </div>
                        {i < 3 && (
                          <svg width="20" height="12" viewBox="0 0 20 12" style={{ flexShrink: 0 }}>
                            <line x1="0" y1="6" x2="14" y2="6" stroke={t.textMuted} strokeWidth="1" />
                            <polyline points="11,3 16,6 11,9" fill="none" stroke={t.textMuted} strokeWidth="1" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, lineHeight: 1.6, color: t.textDim, margin: "8px 0 0 0", textAlign: "center" }}>
                    The LLM proxy filters all PII, vendor identifiers, employee data, and cost center codes before any data reaches the commentary engine. Raw financial data never leaves your environment.
                  </p>
                </div>
              </InfoDropdown>
            </div>

            {/* ─── Top-Level Variance by Spend Category ─── */}
            <div style={{ ...sCard, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.purple} strokeWidth="2" strokeLinecap="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.white }}>Variance by Spend Category</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Spend Category", resType.priorLabel, resType.currentLabel, "Variance ($)", "Variance (%)"].map((h) => (
                      <th key={h} style={{ ...sTh, textAlign: h === "Spend Category" ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.categories.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)).map((c, i) => {
                    return (
                      <tr key={c.name} onMouseEnter={(e) => e.currentTarget.style.background = t.rowHover} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <td style={{ ...sTd(i), fontWeight: 600, color: t.white, fontSize: 13 }}>{c.name}</td>
                        <td style={{ ...sTd(i), textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmtFull(c.prior)}</td>
                        <td style={{ ...sTd(i), textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmtFull(c.current)}</td>
                        <td style={{ ...sTd(i), textAlign: "right", fontWeight: 600, color: varColor(c.variance), fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmtVar(c.variance)}</td>
                        <td style={{ ...sTd(i), textAlign: "right" }}>
                          <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", background: varBg(c.variance), color: varColor(c.variance) }}>{fmtPct(c.variancePct)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ─── Variance Drivers ─── */}
            <div style={{ ...sCard, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.amber} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.white }}>Variance Drivers</span>
                </div>
                <span style={{ fontSize: 11, color: t.textDim }}>Grouped by Cost Center & Supplier · Sorted by |Variance| desc</span>
              </div>
              <div style={{ padding: "0" }}>
                  {(() => {
                    const grouped = {};
                    results.drivers.forEach((d) => {
                      if (!grouped[d.category]) grouped[d.category] = [];
                      grouped[d.category].push(d);
                    });
                    const sortedGroups = Object.entries(grouped).sort((a, b) => {
                      const aTotal = a[1].reduce((s, x) => s + Math.abs(x.variance), 0);
                      const bTotal = b[1].reduce((s, x) => s + Math.abs(x.variance), 0);
                      return bTotal - aTotal;
                    });
                    return sortedGroups.map(([category, drivers]) => {
                      const groupTotal = drivers.reduce((s, x) => s + x.variance, 0);
                      return (
                        <DriverGroup key={category} category={category} drivers={drivers} groupTotal={groupTotal} />
                      );
                    });
                  })()}
              </div>
            </div>

            {/* ─── Commentary ─── */}
            {results.commentary.length > 0 && (
              <div style={{ ...sCard, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.white }}>Variance Commentary</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: results.commentaryType === "ai" ? t.purpleDim : t.accentDim, border: `1px solid ${results.commentaryType === "ai" ? "rgba(123,97,255,0.22)" : t.accentBorder}`, color: results.commentaryType === "ai" ? t.purple : t.accent, fontWeight: 600 }}>
                    {results.commentaryType === "ai" ? "AI-Enhanced" : "Python Generated"}
                  </span>
                  {results.commentaryType === "ai" && (
                    <span style={{ fontSize: 10, color: t.textDim, fontStyle: "italic" }}>ChatGPT 5.1</span>
                  )}
                </div>
                <div style={{ padding: "8px 0" }}>
                  {results.commentary.map((c, i) => (
                    <div key={i} style={{ padding: "16px 20px", borderBottom: i < results.commentary.length - 1 ? `1px solid ${t.divider}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: c.severity === "high" ? t.red : c.severity === "favorable" ? t.green : t.amber,
                        }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.white }}>{c.title}</span>
                        <span style={{
                          fontSize: 9, padding: "2px 7px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                          background: c.severity === "high" ? t.redDim : c.severity === "favorable" ? t.greenDim : t.amberDim,
                          color: c.severity === "high" ? t.red : c.severity === "favorable" ? t.green : t.amber,
                          border: `1px solid ${c.severity === "high" ? t.redBorder : c.severity === "favorable" ? t.greenBorder : t.amberBorder}`,
                        }}>
                          {c.severity === "high" ? "Unfavorable" : c.severity === "favorable" ? "Favorable" : "Monitor"}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, lineHeight: 1.65, color: t.text, margin: 0 }}>{c.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>
                Generated {new Date().toLocaleString()} · {resType.label} · {marketLabel}
              </div>
              <a
                href="https://github.com/dhakshanayashwanth/variance-analysis-tool/tree/main"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 11, fontWeight: 500, color: t.textDim,
                  textDecoration: "none", padding: "5px 12px", borderRadius: 6,
                  border: `1px solid ${t.divider}`, background: "rgba(0,0,0,0.02)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accentBorder; e.currentTarget.style.color = t.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.divider; e.currentTarget.style.color = t.textDim; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                View on GitHub
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

