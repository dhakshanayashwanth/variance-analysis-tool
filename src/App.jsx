import { useState, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   VARIANCE ANALYSIS TOOL
   Enterprise-grade spend variance analyzer
   ═══════════════════════════════════════════════════════════════ */

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
  // Drivers must sum to category variances:
  // Media Spend: 2,270,000 | Personnel: -750,000 | Technology: 1,350,000
  // Professional Services: 1,450,000 | Facilities: -250,000 | Travel & Events: 600,000 | Other OpEx: 250,000
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

  // Sort categories by absolute variance descending to match table order
  const sorted = [...categories].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  const commentaryMap = {
    "Media Spend": (v) => ({
      title: "Media Spend Over-Index",
      body: `Total media spend increased ${fmtVar(v)} vs. July 2025, driven primarily by US Performance Marketing and US Brand Marketing. The increase is attributable to incremental paid search investment during Q2 hiring campaigns and expanded brand awareness initiatives. Recommend reviewing ROI thresholds for campaigns exceeding $500K monthly burn rate.`,
      severity: "high",
    }),
    "Professional Services": (v) => ({
      title: "Professional Services Escalation",
      body: `Professional services spend exceeded plan by ${fmt(Math.abs(v))}, concentrated in Strategy Consulting (McKinsey engagement for market entry analysis) and contract staffing through Insight Global. The staffing increase correlates with Q2 engineering sprint acceleration. Engagement scoping and vendor rate card review recommended for Q3.`,
      severity: v >= 0 ? "high" : "favorable",
    }),
    "Technology": (v) => ({
      title: "Technology Infrastructure Growth",
      body: `Cloud infrastructure and SaaS licensing drove a combined ${fmt(Math.abs(v))} unfavorable variance. AWS consumption grew 14% MoM due to data pipeline scaling, while Snowflake costs expanded from increased query volume tied to new ML forecasting workloads. Recommend conducting cloud cost optimization review with Infrastructure team.`,
      severity: v >= 0 ? "high" : "favorable",
    }),
    "Personnel": (v) => ({
      title: "Personnel Savings from Attrition",
      body: `Personnel costs ${v < 0 ? "decreased" : "increased"} ${fmt(Math.abs(v))} due to natural attrition in Sales - Mid Market and Customer Success teams. Open headcount backfills are in progress but lag 45-60 days behind departures, creating temporary P&L favorability. Engineering - Platform also contributing from delayed contractor conversions.`,
      severity: v < 0 ? "favorable" : "high",
    }),
    "Travel & Events": (v) => ({
      title: "Travel & Events Normalization",
      body: `T&E variance of ${fmtVar(v)} reflects return-to-office travel patterns and Sales Enablement regional meetings. Executive travel contributed a notable portion of the increase. While elevated vs. July 2025, spend remains 22% below FY23 pre-normalization levels. Suggest monitoring monthly run-rate against updated FY25 T&E budget.`,
      severity: "medium",
    }),
    "Facilities": (v) => ({
      title: "Facilities Cost Reduction",
      body: `Facilities spend came in ${fmt(Math.abs(v))} ${v < 0 ? "under" : "over"} plan, driven by lease renegotiations and space consolidation efforts. ${v < 0 ? "This represents a favorable offset to other cost increases." : "Recommend reviewing upcoming lease renewals."}`,
      severity: v < 0 ? "favorable" : "medium",
    }),
    "Other OpEx": (v) => ({
      title: "Other OpEx Variance",
      body: `Other operating expenses showed a ${fmtVar(v)} variance, primarily driven by Legal & Compliance spend on external counsel. Recommend reviewing engagement scope and rate cards for outside legal services.`,
      severity: v >= 0 ? "medium" : "favorable",
    }),
  };

  const comments = sorted
    .filter((c) => commentaryMap[c.name])
    .slice(0, numComments)
    .map((c) => {
      const gen = commentaryMap[c.name](c.variance);
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

// ─── Colors & Theme ───
const t = {
  bg: "#0B1121",
  card: "#111827",
  cardBorder: "#1E293B",
  cardHover: "#151D2E",
  accent: "#3B82F6",
  accentDim: "rgba(59,130,246,0.12)",
  accentBorder: "rgba(59,130,246,0.25)",
  green: "#10B981",
  greenDim: "rgba(16,185,129,0.12)",
  greenBorder: "rgba(16,185,129,0.25)",
  red: "#EF4444",
  redDim: "rgba(239,68,68,0.1)",
  redBorder: "rgba(239,68,68,0.2)",
  amber: "#F59E0B",
  amberDim: "rgba(245,158,11,0.1)",
  amberBorder: "rgba(245,158,11,0.2)",
  white: "#F8FAFC",
  text: "#CBD5E1",
  textDim: "#64748B",
  textMuted: "#475569",
  headerBg: "#0F172A",
  rowHover: "rgba(59,130,246,0.04)",
  divider: "#1E293B",
  purple: "#8B5CF6",
  purpleDim: "rgba(139,92,246,0.12)",
};

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
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${t.divider}`, padding: "14px 18px" }}>
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
          width: "100%", padding: "14px 18px", background: "rgba(59,130,246,0.04)", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "inherit", transition: "background 0.1s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(59,130,246,0.08)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(59,130,246,0.04)"}
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
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [market, setMarket] = useState("all");
  const [commentary, setCommentary] = useState("ai");
  const [numComments, setNumComments] = useState(3);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx"))) setFile(f);
  }, []);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
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
        });
        setAnalyzing(false);
      }
    }, 350);
  };

  const marketLabel = market === "all" ? "Consolidated (All Markets)" : market === "nonjp" ? "Non-JP Markets" : "JP Market";

  // ─── Styles ───
  const sCard = { background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 10 };
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
  const sTd = (i) => ({ padding: "10px 14px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.divider}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" });

  const varColor = (v) => v >= 0 ? t.red : t.green;
  const varBg = (v) => v >= 0 ? t.redDim : t.greenDim;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'DM Sans', 'SF Pro Display', -apple-system, system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ═══ Header ═══ */}
      <div style={{ padding: "16px 32px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(15,23,42,0.8)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${t.accent}, ${t.purple})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 5-9"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.white, letterSpacing: "-0.01em" }}>Variance Analysis Tool</div>
            <div style={{ fontSize: 11, color: t.textDim, marginTop: 1 }}>300x faster than manual analysis · Python for variance calculations, AI for commentary</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* ═══ Upload Section ═══ */}
        {!results && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                ...sCard,
                padding: file ? "20px 28px" : "48px 28px",
                textAlign: "center",
                cursor: "pointer",
                borderStyle: file ? "solid" : "dashed",
                borderColor: dragging ? t.accent : file ? t.greenBorder : t.cardBorder,
                background: dragging ? t.accentDim : file ? t.greenDim : t.card,
                transition: "all 0.2s",
              }}
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx" onChange={handleFile} style={{ display: "none" }} />
              {file ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: t.greenDim, border: `1px solid ${t.greenBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.white }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB • Ready for analysis</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} style={{ marginLeft: 12, background: "transparent", border: "none", color: t.textDim, cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}>×</button>
                </div>
              ) : (
                <>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: t.accentDim, border: `1px solid ${t.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.white, marginBottom: 4 }}>Drop your spend data file here</div>
                  <div style={{ fontSize: 12, color: t.textDim }}>or click to browse • CSV or XLSX</div>
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

            {/* ═══ Run Button ═══ */}
            <button
              onClick={runAnalysis}
              disabled={!file || analyzing}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 10,
                border: "none",
                background: file && !analyzing ? `linear-gradient(135deg, ${t.accent}, ${t.purple})` : t.cardBorder,
                color: file && !analyzing ? "#fff" : t.textMuted,
                fontSize: 14,
                fontWeight: 700,
                cursor: file && !analyzing ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                letterSpacing: "0.02em",
                transition: "all 0.2s",
                boxShadow: file && !analyzing ? "0 4px 24px rgba(59,130,246,0.25)" : "none",
              }}
            >
              {analyzing ? "Analyzing..." : "Run Analysis"}
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
                  <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${t.accent}, ${t.purple})`, width: `${progress}%`, transition: "width 0.3s ease" }} />
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
                <div style={{ fontSize: 12, color: t.textDim, marginTop: 3 }}>{marketLabel} • {file?.name} • {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
              </div>
              <button
                onClick={() => { setResults(null); setFile(null); }}
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
                    { label: "July 2025", value: fmt(totPrior), sub: "Total Spend", color: t.textDim },
                    { label: "August 2025", value: fmt(totCurrent), sub: "Total Spend", color: t.accent },
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

            {/* ─── Top-Level Variance by Spend Category ─── */}
            <div style={{ ...sCard, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.purple} strokeWidth="2" strokeLinecap="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.white }}>Variance by Spend Category</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Spend Category", "July 2025", "August 2025", "Variance ($)", "Variance (%)"].map((h) => (
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
                <span style={{ fontSize: 11, color: t.textDim }}>Grouped by Cost Center & Supplier • Sorted by |Variance| desc</span>
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
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: results.commentaryType === "ai" ? t.purpleDim : t.accentDim, border: `1px solid ${results.commentaryType === "ai" ? "rgba(139,92,246,0.25)" : t.accentBorder}`, color: results.commentaryType === "ai" ? t.purple : t.accent, fontWeight: 600 }}>
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
            <div style={{ textAlign: "center", padding: "8px 0 16px", fontSize: 11, color: t.textMuted }}>
              Generated {new Date().toLocaleString()} • Variance Analysis Tool • {marketLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
