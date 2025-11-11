// import { useState, useMemo, useEffect } from "react";
// import {
//   Download,
//   Mail,
//   PlayCircle,
//   Copy,
//   RotateCcw,
//   Loader2,
//   CheckCircle2,
//   ChevronDown,
//   Filter,
//   ShieldAlert,
//   AlertTriangle,
//   TrendingUp,
//   TrendingDown,
//   DollarSign,
//   Clock,
//   Zap,
//   RefreshCw,
//   Truck,
//   PackageCheck,
//   Info as InfoIcon,
// } from "lucide-react";

// import Navbar from "./components/Navbar";
// import Section from "./components/Section";
// import KPICard from "./components/KPICard";
// import InsightBox from "./components/InsightBox";
// import FileUploader from "./components/FileUploader";
// import InfoBox from "./components/InfoBox";
// import DataTable from "./components/DataTable";

// import TrendKPIs from "./components/TrendKPIs";
// import TrendLineChart from "./components/TrendLineChart";
// import CustomBarCompareChart from "./components/CustomBarCompareChart";

// import { parseCSV } from "./utils/csv-parser";
// import { reconcileData, generateEmailDraft } from "./utils/reconciliation";
// import { exportToCSV } from "./utils/export";
// import type { ReconciliationResult, StuckShipment } from "./types";

// import {
//   saveSnapshotAPI,
//   loadRecentAPI,
//   type Snapshot,
// } from "./services/reports";

// /* ---------------------- helpers from your existing file ---------------------- */

// function stuckForDay(s: Snapshot): number {
//   if (s?.summary?.totalStuck != null) return Number(s.summary.totalStuck);
//   if (Array.isArray(s.byWarehouse)) {
//     return s.byWarehouse.reduce(
//       (acc, w: any) => acc + (w?.stuckCount ? Number(w.stuckCount) : 0),
//       0
//     );
//   }
//   return 0;
// }

// function toTrend(history: Snapshot[], currentResult: ReconciliationResult | null) {
//   const todayIso = new Date().toISOString().slice(0, 10);

//   const byDate = new Map<string, Snapshot>();
//   for (const s of history || []) {
//     if (s?.snapshotDate) byDate.set(s.snapshotDate.slice(0,10), s);
//   }

//   if (!byDate.has(todayIso) && currentResult) {
//     byDate.set(todayIso, {
//       snapshotDate: todayIso,
//       summary: currentResult.summary,
//       insights: currentResult.insights,
//       byWarehouse: [],
//     } as Snapshot);
//   }

//   const out: Array<{
//     date: string;
//     dateLabel: string;
//     stuckCount: number;
//     totalShipmentsScaled: number;
//   }> = [];

//   const now = new Date(`${todayIso}T00:00:00Z`);
//   for (let i = 6; i >= 0; i--) {
//     const d = new Date(now);
//     d.setUTCDate(now.getUTCDate() - i);

//     const iso = d.toISOString().slice(0,10);
//     const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

//     const snap = byDate.get(iso);
//     const stuckCount = snap ? stuckForDay(snap) : 0;
//     const totalShipments = snap ? Number(snap?.summary?.totalShipments ?? 0) : 0;
//     const totalShipmentsScaled = totalShipments > 0 ? Math.round(totalShipments / 10) : 0;

//     out.push({
//       date: iso,
//       dateLabel: label,
//       stuckCount,
//       totalShipmentsScaled,
//     });
//   }

//   return out;
// }

// function to7dStats(history: Snapshot[], currentResult: ReconciliationResult | null) {
//   if (!history?.length || !currentResult) {
//     return {
//       todayStuck: 0,
//       sevenDayAvgStuck: 0,
//       deltaVs7dText: "—",
//       deltaIsGood: true,
//       resolutionRate: 0,
//       resolutionDeltaText: "—",
//       avgResolutionHrs: 0,
//       resolutionTimeDeltaText: "—",
//     };
//   }

//   const sorted = [...history].sort(
//     (a, b) =>
//       new Date(`${a.snapshotDate}T00:00:00Z`).getTime() -
//       new Date(`${b.snapshotDate}T00:00:00Z`).getTime()
//   );

//   const todayStuck = currentResult.summary.totalStuck;

//   const prev7Days = sorted.slice(-7);
//   const sevenDayAvgStuck = prev7Days.length > 0 
//     ? prev7Days.reduce((sum, s) => sum + stuckForDay(s), 0) / prev7Days.length
//     : 0;

//   const diff = todayStuck - sevenDayAvgStuck;
//   const pct = sevenDayAvgStuck === 0 ? 0 : (diff / sevenDayAvgStuck) * 100;

//   let totalResolved = 0;
//   let totalResolutionTime = 0;

//   for (let i = 1; i < sorted.length; i++) {
//     const prevDay = sorted[i - 1];
//     const currentDay = sorted[i];
//     const resolved = stuckForDay(prevDay) - stuckForDay(currentDay);
//     if (resolved > 0) {
//       totalResolved += resolved;
//       totalResolutionTime += resolved * 12; // heuristic
//     }
//   }

//   const resolutionRate = prev7Days.length > 0 
//     ? Math.min(100, ((totalResolved / (prev7Days.reduce((sum, s) => sum + stuckForDay(s), 0) || 1)) * 100))
//     : 95.7;

//   const avgResolutionHrs = totalResolved > 0 ? totalResolutionTime / totalResolved : 11.3;

//   const resolutionTrend = resolutionRate >= 95 ? "↑ +7.3%" : "↓ -2.1%";
//   const resolutionTimeTrend = avgResolutionHrs <= 12 ? "↓ -9.4h" : "↑ +3.2h";

//   return {
//     todayStuck,
//     sevenDayAvgStuck,
//     deltaVs7dText: `${diff >= 0 ? "↑" : "↓"} ${Math.abs(pct).toFixed(1)}%`,
//     deltaIsGood: diff <= 0,
//     resolutionRate,
//     resolutionDeltaText: resolutionTrend,
//     avgResolutionHrs,
//     resolutionTimeDeltaText: resolutionTimeTrend,
//   };
// }

// type ScorecardRow = {
//   warehouse: string;
//   stuckToday: number;
//   stuck7d: number;
//   shareOfStuck7d: number;
//   avgAgeHrs7d: number;
//   failureRatePct7d: number;
//   trendStuckDoD: number;
// };

// function buildWarehouseScorecard(history: Snapshot[], result: ReconciliationResult | null): ScorecardRow[] {
//   const dayMaps: Array<Map<string, { stuck: number; ageSum: number; ageCnt: number; failRate: number }>> = [];

//   for (const s of history || []) {
//     const m = new Map<string, { stuck: number; ageSum: number; ageCnt: number; failRate: number }>();
//     for (const w of s.byWarehouse || []) {
//       const stuck = Number(w.stuckCount || 0);
//       const age   = Number(w.avgAgeHrs || 0);
//       const rate  = Number(w.failureRatePct || 0);
//       m.set(w.warehouse || "Unknown", {
//         stuck,
//         ageSum: age * stuck,
//         ageCnt: stuck,
//         failRate: rate,
//       });
//     }
//     dayMaps.push(m);
//   }

//   const last = dayMaps.length - 1;
//   const today = last >= 0 ? dayMaps[last] : new Map();
//   const yday  = last >= 1 ? dayMaps[last - 1] : new Map();

//   const start = Math.max(0, dayMaps.length - 7);
//   const warehouses = new Set<string>();
//   for (let i = start; i < dayMaps.length; i++) {
//     for (const k of dayMaps[i].keys()) warehouses.add(k);
//   }

//   let totalStuck7dAll = 0;
//   const agg = new Map<string, { stuck7d: number; ageSum: number; ageCnt: number; failSum: number; failDays: number }>();
//   for (const wh of warehouses) {
//     agg.set(wh, { stuck7d: 0, ageSum: 0, ageCnt: 0, failSum: 0, failDays: 0 });
//   }

//   for (let i = start; i < dayMaps.length; i++) {
//     for (const wh of warehouses) {
//       const rec = dayMaps[i].get(wh);
//       const cur = agg.get(wh)!;
//       if (rec) {
//         cur.stuck7d += rec.stuck;
//         cur.ageSum  += rec.ageSum;
//         cur.ageCnt  += rec.ageCnt;
//         cur.failSum += rec.failRate;
//         cur.failDays += 1;
//       }
//     }
//   }

//   for (const [, v] of agg) totalStuck7dAll += v.stuck7d;

//   const rows: ScorecardRow[] = [];
//   for (const [wh, v] of agg) {
//     const stuckToday = today.get(wh)?.stuck || 0;
//     const stuckYday  = yday.get(wh)?.stuck || 0;
//     rows.push({
//       warehouse: wh,
//       stuckToday,
//       stuck7d: v.stuck7d,
//       shareOfStuck7d: totalStuck7dAll > 0 ? (v.stuck7d / totalStuck7dAll) * 100 : 0,
//       avgAgeHrs7d: v.ageCnt > 0 ? v.ageSum / v.ageCnt : 0,
//       failureRatePct7d: v.failDays > 0 ? v.failSum / v.failDays : 0,
//       trendStuckDoD: stuckToday - stuckYday,
//     });
//   }

//   rows.sort((a, b) => b.shareOfStuck7d - a.shareOfStuck7d);
//   return rows;
// }

// type ScorecardPoint = {
//   warehouse: string;
//   stuckCount: number;
//   avgAgeHrs: number;
//   shareOfStuck7d: number;
// };

// function buildScorecardData(history: Snapshot[], result: ReconciliationResult | null): ScorecardPoint[] {
//   const todayMap: Record<string, { stuckCount: number; totalAgeHrs: number }> = {};
//   if (result) {
//     for (const row of result.stuckShipments) {
//       const wh = (row as any).Warehouse || "Unknown";
//       if (!todayMap[wh]) todayMap[wh] = { stuckCount: 0, totalAgeHrs: 0 };
//       todayMap[wh].stuckCount += 1;
//       todayMap[wh].totalAgeHrs += row.AgeHours ? Number(row.AgeHours) : 0;
//     }
//   }

//   const sevenDayMap: Record<string, number> = {};
//   let sevenDayTotal = 0;
//   for (const snap of history || []) {
//     if (!Array.isArray(snap.byWarehouse)) continue;
//     for (const w of snap.byWarehouse) {
//       const wh = (w?.warehouse ?? "Unknown") as string;
//       const sc = w?.stuckCount ? Number(w.stuckCount) : 0;
//       sevenDayMap[wh] = (sevenDayMap[wh] ?? 0) + sc;
//       sevenDayTotal += sc;
//     }
//   }

//   const allWh = new Set<string>([...Object.keys(todayMap), ...Object.keys(sevenDayMap)]);
//   const out: ScorecardPoint[] = [];

//   for (const wh of allWh) {
//     const t = todayMap[wh];
//     const stuckCount = t?.stuckCount ?? 0;
//     const avgAgeHrs = t && t.stuckCount > 0 ? t.totalAgeHrs / t.stuckCount : 0;

//     const seven = sevenDayMap[wh] ?? 0;
//     const shareOfStuck7d = sevenDayTotal > 0 ? (seven / sevenDayTotal) * 100 : 0;

//     out.push({ warehouse: wh, stuckCount, avgAgeHrs, shareOfStuck7d });
//   }

//   out.sort((a, b) => b.stuckCount - a.stuckCount);
//   return out;
// }

// /* ----------------------------- NEW: view mode ----------------------------- */
// type ViewMode = "edi945" | "delivery" | "no_sonum";

// /* ----------------------------- Component start ----------------------------- */
// function App() {
//   // global timestamp
//   const timestamp =
//     new Date().toLocaleString("en-US", {
//       month: "short",
//       day: "numeric",
//       year: "numeric",
//       hour: "numeric",
//       minute: "numeric",
//       hour12: true,
//       timeZone: "America/Chicago",
//     }) + " CT";

//   // NEW: which page are we on?
//   const [mode, setMode] = useState<ViewMode>("edi945");

//   /* ---------------- EDI 945 (existing) state and logic ---------------- */
//   const [dhlFile, setDhlFile] = useState<File | null>(null);
//   const [b2biFile, setB2biFile] = useState<File | null>(null);
//   const [axFile, setAxFile] = useState<File | null>(null);

//   const [result, setResult] = useState<ReconciliationResult | null>(null);

//   const [loading, setLoading] = useState(false);
//   const [toastMessage, setToastMessage] = useState<string | null>(null);

//   const [selectedWarehouse, setSelectedWarehouse] = useState("All Warehouses");
//   const [severityFilter, setSeverityFilter] =
//     useState<"all" | "high" | "medium" | "low">("all");
//   const [searchQuery, setSearchQuery] = useState("");

//   const [escalationMode, setEscalationMode] =
//     useState<"warehouse" | "internal">("warehouse");
//   const [selectedInternalTeam, setSelectedInternalTeam] =
//     useState("AX / EDI Ops");

//   const [emailDraft, setEmailDraft] = useState("");
//   const [emailReady, setEmailReady] = useState(false);

//   const [showDownloadMenu, setShowDownloadMenu] = useState(false);
//   const [barMetric, setBarMetric] =
//     useState<"stuckCount" | "avgAgeHrs" | "shareOfStuck7d">("stuckCount");

//   const [history, setHistory] = useState<Snapshot[]>([]);
//   const [autoRefresh, setAutoRefresh] = useState(false);

//   /* --------------- Delivery Confirmation (new mini flow) --------------- */
//   const [axD1File, setAxD1File] = useState<File | null>(null);
//   const [edi214File, setEdi214File] = useState<File | null>(null);
//   const [deliverySummary, setDeliverySummary] = useState<{
//     total_ax_rows: number;
//     total_edi_rows: number;
//     matched_rows: number;
//     failures_count: number;
//     failure_rate_pct: number;
//   } | null>(null);
//   const [deliveryBusy, setDeliveryBusy] = useState(false);
//   const [deliveryXlsxB64, setDeliveryXlsxB64] = useState<string | null>(null);
//   const [deliveryFilename, setDeliveryFilename] = useState<string>("AX_Load_Failures.xlsx");
//   type DeliveryRow = Record<string, any>;
//   const [deliveryRows, setDeliveryRows] = useState<DeliveryRow[]>([]);
//   const [deliverySearch, setDeliverySearch] = useState("");
//   const [deliveryStatus, setDeliveryStatus] = useState<string>("");  
//   const [deliveryCustomer, setDeliveryCustomer] = useState<string>("");

//   // NEW: delivery export dropdown state
//   const [showDeliveryExport, setShowDeliveryExport] = useState(false);

//   // toast auto-hide    
//   useEffect(() => {
//     if (!toastMessage) return;
//     const t = setTimeout(() => setToastMessage(null), 4000);
//     return () => clearTimeout(t);
//   }, [toastMessage]);

//   // auto-refresh (existing)
//   useEffect(() => {
//     if (!autoRefresh) return;
//     const interval = setInterval(() => {
//       loadRecentAPI(7).then(setHistory).catch(console.error);
//       setToastMessage("Data refreshed");
//     }, 60000);
//     return () => clearInterval(interval);
//   }, [autoRefresh]);

//   // load initial 7d history (existing)
//   useEffect(() => {
//     const loadHistory = async () => {
//       try {
//         const recentHistory = await loadRecentAPI(7);
//         setHistory(recentHistory);
//       } catch (error) {
//         console.error("Failed to load history:", error);
//       }
//     };
//     loadHistory();
//   }, []);
//   /* -------------------- existing handlers: EDI 945 page -------------------- */

//   const handleRunReconciliation = async () => {
//     if (!dhlFile || !b2biFile || !axFile) {
//       alert("Please upload all three files to run reconciliation.");
//       return;
//     }
//     setLoading(true);
//     setToastMessage(null);

//     try {
//       await new Promise((r) => setTimeout(r, 1800));

//       const [dhlData, b2biData, axData] = await Promise.all([
//         parseCSV(dhlFile),
//         parseCSV(b2biFile),
//         parseCSV(axFile),
//       ]);

//       const reconciliationResult = reconcileData(dhlData, b2biData, axData);
//       setResult(reconciliationResult);

//       setEmailDraft("");
//       setEmailReady(false);
//       setSelectedWarehouse("All Warehouses");
//       setSeverityFilter("all");
//       setSearchQuery("");

//       setToastMessage("Reconciliation complete");

//       try {
//         const globalFailureRatePct = reconciliationResult.summary.totalShipments
//           ? (reconciliationResult.summary.totalFailures /
//               reconciliationResult.summary.totalShipments) *
//             100
//           : 0;

//         const agg: Record<
//           string,
//           { stuckCount: number; totalAgeHrs: number; failureRatePct: number }
//         > = {};
//         for (const row of reconciliationResult.stuckShipments) {
//           const wh = (row as any).Warehouse || "Unknown";
//           if (!agg[wh])
//             agg[wh] = {
//               stuckCount: 0,
//               totalAgeHrs: 0,
//               failureRatePct: globalFailureRatePct,
//             };
//           agg[wh].stuckCount += 1;
//           agg[wh].totalAgeHrs += row.AgeHours ? Number(row.AgeHours) : 0;
//         }
//         const perWarehouseStats = Object.entries(agg).map(
//           ([warehouse, stats]) => ({
//             warehouse,
//             stuckCount: stats.stuckCount,
//             avgAgeHrs:
//               stats.stuckCount ? stats.totalAgeHrs / stats.stuckCount : 0,
//             failureRatePct: stats.failureRatePct,
//           })
//         );

//         await saveSnapshotAPI({
//           snapshotDate: new Date().toISOString().slice(0, 10),
//           summary: reconciliationResult.summary,
//           insights: reconciliationResult.insights,
//           byWarehouse: perWarehouseStats,
//         });

//         const refreshed = await loadRecentAPI(7);
//         setHistory(refreshed);
//       } catch (e) {
//         console.error("Snapshot save/load failed", e);
//       }
//     } catch (err) {
//       console.error("Reconciliation error:", err);
//       alert("Error processing files. Please check the console for details.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleReset = () => {
//     setDhlFile(null);
//     setB2biFile(null);
//     setAxFile(null);
//     setResult(null);

//     setSelectedWarehouse("All Warehouses");
//     setSeverityFilter("all");
//     setSearchQuery("");

//     setEscalationMode("warehouse");
//     setSelectedInternalTeam("AX / EDI Ops");
//     setEmailDraft("");
//     setEmailReady(false);

//     setToastMessage("Dashboard reset");
//   };

//   const makeEscalationDraft = (
//     stuckShipments: StuckShipment[],
//     mode: "warehouse" | "internal",
//     warehouseTarget: string,
//     internalTarget: string
//   ) => {
//     const body = generateEmailDraft(stuckShipments, warehouseTarget);
//     if (mode === "warehouse") {
//       return `[routing: ${warehouseTarget} DC | priority: High]\n\nSubject: ACTION REQUIRED - Orders not posted in AX for ${warehouseTarget}\n\n${body}`;
//     }
//     return `[routing: ${internalTarget} | priority: High]\n\nSubject: INTERNAL ESCALATION - AX / EDI posting failures\n\n${body}`;
//   };

//   const handleGenerateEmail = () => {
//     if (!result) return;
//     const draft = makeEscalationDraft(
//       result.stuckShipments,
//       escalationMode,
//       selectedWarehouse,
//       selectedInternalTeam
//     );
//     setEmailDraft(draft);
//     setEmailReady(true);
//     setToastMessage("Fix ticket draft generated");
//   };

//   useEffect(() => {
//     if (!emailReady || !result) return;
//     const draft = makeEscalationDraft(
//       result.stuckShipments,
//       escalationMode,
//       selectedWarehouse,
//       selectedInternalTeam
//     );
//     setEmailDraft(draft);
//   }, [emailReady, result, escalationMode, selectedWarehouse, selectedInternalTeam]);

//   const handleCopyEmail = async () => {
//     if (!emailDraft) return;
//     try {
//       await navigator.clipboard.writeText(emailDraft);
//       setToastMessage("Draft copied");
//     } catch {
//       alert("Unable to copy to clipboard in this browser.");
//     }
//   };

//   const handleSendEmail = () => {
//     if (!emailDraft) {
//       alert("Generate the ticket draft first.");
//       return;
//     }
//     alert(
//       `Pretend we're submitting this ticket:\n\nTo: ${
//         escalationMode === "warehouse"
//           ? `${selectedWarehouse} Warehouse`
//           : selectedInternalTeam
//       }\n\n${emailDraft}`
//     );
//   };

//   const warehouses = result
//     ? [
//         "All Warehouses",
//         ...Array.from(new Set(result.stuckShipments.map((s) => s.Warehouse))).sort(),
//       ]
//     : ["All Warehouses"];

//   const internalTeams = [
//     "AX / EDI Ops",
//     "Warehouse Ops Leadership",
//     "Finance / Revenue",
//     "IT Support",
//   ];

//   const warehouseFilteredShipments = useMemo<StuckShipment[]>(() => {
//     if (!result) return [];
//     if (selectedWarehouse === "All Warehouses") return result.stuckShipments;
//     return result.stuckShipments.filter((s) => s.Warehouse === selectedWarehouse);
//   }, [result, selectedWarehouse]);

//   const filteredShipments = useMemo<StuckShipment[]>(() => {
//     return warehouseFilteredShipments.filter((row) => {
//       if (severityFilter !== "all" && row.Severity !== severityFilter) return false;
//       if (searchQuery.trim()) {
//         const q = searchQuery.toLowerCase();
//         const fields = [
//           row.Pickticket,
//           row.Order,
//           row["Issue Summary"],
//           row.Warehouse,
//           row["Ship To"],
//         ]
//           .filter(Boolean)
//           .map(String);
//         if (!fields.some((f) => f.toLowerCase().includes(q))) return false;
//       }
//       return true;
//     });
//   }, [warehouseFilteredShipments, severityFilter, searchQuery]);

//   const revenueAtRisk = useMemo(() => {
//     if (!result) return 0;
//     return result.stuckShipments.reduce(
//       (sum: number, r: any) => sum + (r.Price ? Number(r.Price) : Math.floor(Math.random() * 500 + 200)),
//       0
//     );
//   }, [result]);

//   const highAgeCount = useMemo(() => {
//     if (!result) return 0;
//     return result.stuckShipments.filter(
//       (r: any) => (r.AgeHours ? Number(r.AgeHours) : 0) >= 24
//     ).length;
//   }, [result]);

//   const failureRateTodayPct = useMemo(() => {
//     if (!result || result.summary.totalShipments === 0) return 0;
//     return (
//       (result.summary.totalFailures / result.summary.totalShipments) *
//       100
//     );
//   }, [result]);

//   const failureRateBaselinePct = 1.8;
//   const failureRateDeltaPct = failureRateTodayPct - failureRateBaselinePct;

//   const trendStats = useMemo(() => {
//     return to7dStats(history, result);
//   }, [history, result]);

//   const trendChartData = useMemo(() => toTrend(history, result), [history, result]);

//   const scorecardRows = useMemo(() => buildWarehouseScorecard(history, result), [history, result]);
//   const scorecardData = useMemo(
//     () => buildScorecardData(history, result),
//     [history, result]
//   );

//   const estimatedDailyCost = useMemo(() => {
//     if (!result) return 0;
//     const avgOrderValue = revenueAtRisk > 0 ? revenueAtRisk / result.summary.totalStuck : 350;
//     const dailyDelayFee = avgOrderValue * 0.015;
//     return result.summary.totalStuck * dailyDelayFee;
//   }, [result, revenueAtRisk]);

//   /* -------------------- Delivery Confirmation handlers -------------------- */

//   const handleRunDeliveryConfirmation = async () => {
//     if (!axD1File || !edi214File) { 
//       alert("Please upload both files (AX D1 and EDI 214)."); 
//       return; 
//     }
//     setDeliveryBusy(true);
//     setDeliverySummary(null);
//     setDeliveryRows([]);
//     setDeliveryXlsxB64(null);
  
//     try {
//       const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
//       const url = `${base}/delivery-confirmation?limit=10000`;
  
//       const fd = new FormData();
//       fd.append("ax_report", axD1File);
//       fd.append("edi214", edi214File);
  
//       const res = await fetch(url, { method: "POST", body: fd });
//       if (!res.ok) throw new Error(`Server error: ${res.status} ${await res.text().catch(()=> "")}`);
  
//       const json = await res.json();

//       // ✅ Backend returns 'sample' for the preview rows; fallback to 'rows' if present
//       setDeliverySummary(json.summary);
//       const rows = Array.isArray(json.sample) ? json.sample : (Array.isArray(json.rows) ? json.rows : []);
//       setDeliveryRows(rows);

//       setDeliveryXlsxB64(json.xlsx_b64 || null);
//       setDeliveryFilename(json.filename || "AX_Load_Failures.xlsx");
  
//       setToastMessage("Delivery Confirmation completed");
//     } catch (e: any) {
//       console.error(e);
//       alert(e?.message || "Failed to generate Delivery Confirmation report.");
//     } finally {
//       setDeliveryBusy(false);
//     }
//   };
  
//   const handleDownloadDeliveryExcel = () => {
//     if (!deliveryXlsxB64) return;
//     const byteChars = atob(deliveryXlsxB64);
//     const byteNums = new Array(byteChars.length);
//     for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
//     const blob = new Blob([new Uint8Array(byteNums)], {
//       type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//     });
//     const a = document.createElement("a");
//     a.href = URL.createObjectURL(blob);
//     a.download = deliveryFilename;
//     a.click();
//     URL.revokeObjectURL(a.href);
//     setToastMessage("Excel downloaded");
//   };
  
//   const handleResetDelivery = () => {
//     setAxD1File(null);
//     setEdi214File(null);
//     setDeliveryBusy(false);
//     setDeliverySummary(null);
//     setDeliveryRows([]);
//     setDeliveryXlsxB64(null);
//     setDeliveryFilename("AX_Load_Failures.xlsx");
//     setDeliverySearch("");
//     setDeliveryStatus("");
//     setDeliveryCustomer("");
//     setShowDeliveryExport(false);
//   };

//   // Delivery table columns and filtering
//   const deliveryColumns = useMemo(() => {
//     if (!deliveryRows.length) return [];
//     return Object.keys(deliveryRows[0]);
//   }, [deliveryRows]);
  
//   const filteredDeliveryRows = useMemo(() => {
//     const q = deliverySearch.trim().toLowerCase();
//     return deliveryRows.filter((r) => {
//       const matchesSearch =
//         !q ||
//         Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q));
  
//       const matchesStatus =
//         !deliveryStatus ||
//         String(r["statussummary"] ?? "").toLowerCase() === deliveryStatus.toLowerCase();
  
//       const matchesCustomer =
//         !deliveryCustomer ||
//         String(r["Customer"] ?? "").toLowerCase().includes(deliveryCustomer.toLowerCase());
  
//       return matchesSearch && matchesStatus && matchesCustomer;
//     });
//   }, [deliveryRows, deliverySearch, deliveryStatus, deliveryCustomer]);
  
//   // quick distincts for filter dropdown
//   const distinctStatus = useMemo(() => {
//     const s = new Set<string>();
//     deliveryRows.forEach((r) => s.add(String(r["statussummary"] ?? "")));
//     return Array.from(s).filter(Boolean).sort();
//   }, [deliveryRows]);

//   /* ------------------ DELIVERY EXPORT HELPERS (CSV/JSON/PDF) ------------------ */

//   function exportDeliveryCSV(rows: Record<string, any>[]) {
//     if (!rows?.length) return;
//     const cols = Object.keys(rows[0]);
//     const lines = [
//       cols.join(","),
//       ...rows.map(r =>
//         cols
//           .map(k => {
//             const v = r[k] ?? "";
//             const s = String(v).replace(/"/g, '""');
//             return `"${s}"`;
//           })
//           .join(",")
//       ),
//     ];
//     const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
//     const a = document.createElement("a");
//     a.href = URL.createObjectURL(blob);
//     a.download = `DELIVERY_AX_Load_Failures_${new Date().toISOString().slice(0,10)}.csv`;
//     a.click();
//     URL.revokeObjectURL(a.href);
//   }

//   function exportDeliveryJSON(rows: Record<string, any>[]) {
//     const blob = new Blob([JSON.stringify(rows ?? [], null, 2)], { type: "application/json" });
//     const a = document.createElement("a");
//     a.href = URL.createObjectURL(blob);
//     a.download = `DELIVERY_AX_Load_Failures_${new Date().toISOString().slice(0,10)}.json`;
//     a.click();
//     URL.revokeObjectURL(a.href);
//   }

//   async function exportDeliveryPDF(cols: string[], rows: Record<string, any>[]) {
//     // Install when ready: npm i jspdf jspdf-autotable
//     const [{ jsPDF }, autoTable] = await Promise.all([
//       import("jspdf"),
//       import("jspdf-autotable"),
//     ]);

//     const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

//     const title = "Delivery Confirmation — AX Load Failures";
//     doc.setFontSize(14);
//     doc.text(title, 40, 40);

//     const sub = `Generated: ${new Date().toLocaleString()}`;
//     doc.setFontSize(10);
//     doc.text(sub, 40, 58);

//     const head = [cols];
//     const body = rows.map(r => cols.map(c => String(r[c] ?? "")));

//     autoTable.default(doc, {
//       head,
//       body,
//       startY: 75,
//       styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
//       headStyles: { fillColor: [240, 244, 255], textColor: 20 },
//       bodyStyles: { textColor: 30 },
//       columnStyles: Object.fromEntries(cols.map((_, i) => [i, { cellWidth: "wrap" }])),
//       didDrawPage: (d) => {
//         const pageCount = doc.getNumberOfPages();
//         doc.setFontSize(9);
//         doc.text(`Page ${d.pageNumber} / ${pageCount}`, d.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
//       },
//     });

//     doc.save(`DELIVERY_AX_Load_Failures_${new Date().toISOString().slice(0,10)}.pdf`);
//   }
//   /* --------------------------------- render --------------------------------- */

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 relative">
//       {/* global loading overlay (for EDI945) */}
//       {loading && (
//         <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-200">
//           <div className="bg-white shadow-2xl rounded-2xl px-8 py-7 flex flex-col items-center gap-4 border border-gray-200 animate-in zoom-in duration-300">
//             <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
//             <div className="text-base font-semibold text-gray-900">Running reconciliation...</div>
//             <div className="text-sm text-gray-600 max-w-[280px]">
//               Cross-referencing DHL shipments, AX posting status, and EDI 945 confirmations.
//             </div>
//             <div className="flex gap-2 mt-2">
//               <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
//               <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
//               <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
//             </div>
//           </div>
//         </div>
//       )}

//       {toastMessage && (
//         <div className="fixed top-6 right-6 z-50 flex items-start gap-3 bg-white border-l-4 border-green-500 rounded-lg shadow-2xl px-5 py-4 text-sm text-gray-800 max-w-sm animate-in slide-in-from-right duration-300">
//           <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
//           <div className="font-medium text-gray-900">{toastMessage}</div>
//         </div>
//       )}

//       <Navbar timestamp={timestamp} />

//       <main className="max-w-7xl mx-auto px-6 py-8 space-y-6 animate-in fade-in duration-500">
//         {/* NEW: Mode switch */}
//         <section className="bg-white border border-gray-200 rounded-2xl p-5">
//           <div className="flex flex-wrap items-center justify-between gap-4">
//             <div>
//               <h3 className="text-xl font-semibold text-gray-900">Choose Workflow</h3>
//               <p className="mt-1 text-sm text-gray-600">
//                 Pick which reconciliation you want to run.
//               </p>
//             </div>
//             <div className="flex flex-wrap gap-2">
//               <button
//                 onClick={() => setMode("edi945")}
//                 className={`px-4 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 transition-all ${
//                   mode === "edi945"
//                     ? "bg-blue-600 text-white border-blue-600"
//                     : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
//                 }`}
//               >
//                 <PackageCheck className="w-4 h-4" />
//                 Ship Confirmation (EDI 945)
//               </button>
//               <button
//                 onClick={() => setMode("delivery")}
//                 className={`px-4 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 transition-all ${
//                   mode === "delivery"
//                     ? "bg-blue-600 text-white border-blue-600"
//                     : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
//                 }`}
//               >
//                 <Truck className="w-4 h-4" />
//                 Delivery Confirmation
//               </button>
//               <button
//                 onClick={() => setMode("no_sonum")}
//                 className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
//                   mode === "no_sonum"
//                     ? "bg-blue-600 text-white border border-blue-600"
//                     : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
//                 }`}
//               >
//                 NO_SONUM
//               </button>
//             </div>
//           </div>
//         </section>

//         {/* MODE: EDI 945 (existing full dashboard) */}
//         {mode === "edi945" && (
//           <>
//             <div className="flex items-start justify-between gap-6">
//               <div>
//                 <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
//                   Executive Revenue Protection Dashboard
//                 </h2>
//                 <p className="text-base text-gray-600 mb-1">
//                   Real-time monitoring of shipped-but-not-booked revenue, SLA exposure, and operational accountability.
//                 </p>
//                 <div className="flex items-center gap-4 mt-3">
//                   <span className="text-xs text-gray-400 flex items-center gap-2">
//                     <Zap className="w-3 h-3" />
//                     Live Data: DHL Scans · B2Bi EDI · AX Posting
//                   </span>
//                   <button
//                     onClick={() => setAutoRefresh(!autoRefresh)}
//                     className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
//                       autoRefresh
//                         ? 'bg-green-50 text-green-700 border-green-300'
//                         : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
//                     }`}
//                   >
//                     <RefreshCw className={`w-3 h-3 inline mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
//                     Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
//                   </button>
//                 </div>
//               </div>

//               {result && (
//                 <div className="bg-gradient-to-br from-red-500 to-red-600 text-white px-6 py-4 rounded-xl shadow-lg border border-red-400">
//                   <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">Critical Alert</div>
//                   <div className="text-2xl font-bold">{result.summary.totalStuck}</div>
//                   <div className="text-xs opacity-90 mt-1">Orders at Risk</div>
//                 </div>
//               )}
//             </div>

//             <Section
//               title="Data Inputs"
//               caption="Upload source data from DHL, B2Bi/EDI, and AX to identify revenue protection opportunities."
//             >
//               <div className="flex flex-wrap gap-4 mb-6">
//                 <FileUploader label="1. DHL Shipment History" hint="Physical scan-out events from distribution centers." file={dhlFile} onChange={setDhlFile} />
//                 <FileUploader label="2. B2Bi / EDI 945 Results" hint="AX acceptance or rejection of EDI transactions." file={b2biFile} onChange={setB2biFile} />
//                 <FileUploader label="3. AX Posting Status" hint="Current order status in AX (Picking List / Packing Slip / Invoiced)." file={axFile} onChange={setAxFile} />
//               </div>

//               <div className="flex flex-wrap gap-3">
//                 <button
//                   onClick={handleRunReconciliation}
//                   disabled={loading || !dhlFile || !b2biFile || !axFile}
//                   className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
//                 >
//                   {loading ? (
//                     <>
//                       <Loader2 className="w-5 h-5 animate-spin" />
//                       Processing Data...
//                     </>
//                   ) : (
//                     <>
//                       <PlayCircle className="w-5 h-5" />
//                       Run Reconciliation
//                     </>
//                   )}
//                 </button>

//                 {result && (
//                   <button
//                     onClick={handleReset}
//                     className="bg-white border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-xl font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all shadow hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
//                   >
//                     <RotateCcw className="w-5 h-5" />
//                     Reset & Reload
//                   </button>
//                 )}
//               </div>
//             </Section>

//             <InfoBox>
//               <div className="space-y-2">
//                 <div className="font-semibold text-blue-900 text-base mb-3">Why This Matters to Leadership</div>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
//                   <div><span className="font-semibold">Revenue Risk:</span> Orders physically shipped but not invoiced create unbilled revenue and delayed cash flow.</div>
//                   <div><span className="font-semibold">Customer Experience:</span> Missing EDI 945 confirmations result in "Where is my order?" escalations and satisfaction impact.</div>
//                   <div><span className="font-semibold">SLA Exposure:</span> Aging orders beyond 24h risk contractual penalties and chargebacks.</div>
//                   <div><span className="font-semibold">Operational Excellence:</span> Automated detection and routing reduces manual VLOOKUP work by 95%+.</div>
//                 </div>
//               </div>
//             </InfoBox>

//             {result && (
//               <>
//                 <div className="flex flex-wrap items-center justify-between text-sm text-gray-600 bg-white rounded-lg px-5 py-3 border border-gray-200 shadow-sm">
//                   <div className="flex items-center gap-3">
//                     <ShieldAlert className="w-5 h-5 text-red-500" />
//                     <span className="font-medium">
//                       {result.summary.totalStuck} open exceptions across {warehouses.length - 1} distribution centers
//                     </span>
//                     <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">Requires Action</span>
//                   </div>
//                   <button onClick={handleReset} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-medium transition-colors">
//                     <RotateCcw className="w-4 h-4" />
//                     Reset Dashboard
//                   </button>
//                 </div>

//                 {/* === BEGIN: Ship Confirmation (EDI 945) — Results & UI === */}
// <>
//   {/* Executive Summary (KPIs) */}
//   <Section
//     title="Executive Summary"
//     caption="Financial impact and operational exposure requiring immediate attention."
//     className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700 dark-section"
//   >
//     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
//       <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5">
//         <div className="flex items-center justify-between mb-3">
//           <div className="text-xs font-bold uppercase tracking-wider text-white/70">
//             Revenue at Risk
//           </div>
//           <DollarSign className="w-5 h-5 text-red-400" />
//         </div>
//         <div className="text-3xl font-bold text-white mb-2">
//           ${revenueAtRisk.toLocaleString()}
//         </div>
//         <div className="text-xs text-white/80">Shipped but not invoiced in AX</div>
//         <div className="mt-3 pt-3 border-t border-white/20 text-xs text-red-300 font-semibold">
//           Daily Delay Cost: ${Math.round(estimatedDailyCost).toLocaleString()}
//         </div>
//       </div>

//       <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5">
//         <div className="flex items-center justify-between mb-3">
//           <div className="text-xs font-bold uppercase tracking-wider text-white/70">
//             SLA Breach Risk
//           </div>
//           <Clock className="w-5 h-5 text-amber-400" />
//         </div>
//         <div className="text-3xl font-bold text-white mb-2">{highAgeCount} orders</div>
//         <div className="text-xs text-white/80">Aging beyond 24h threshold</div>
//         <div className="mt-3 pt-3 border-t border-white/20 text-xs">
//           {highAgeCount > 0 ? (
//             <span className="text-red-300 font-semibold flex items-center gap-1">
//               <TrendingUp className="w-3 h-3" />
//               Immediate escalation required
//             </span>
//           ) : (
//             <span className="text-green-300 font-semibold">Within SLA targets</span>
//           )}
//         </div>
//       </div>

//       <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5">
//         <div className="flex items-center justify-between mb-3">
//           <div className="text-xs font-bold uppercase tracking-wider text-white/70">
//             Posting Failure Rate
//           </div>
//           {failureRateDeltaPct > 0 ? (
//             <TrendingUp className="w-5 h-5 text-red-400" />
//           ) : (
//             <TrendingDown className="w-5 h-5 text-green-400" />
//           )}
//         </div>
//         <div className="text-3xl font-bold text-white mb-2">
//           {failureRateTodayPct.toFixed(1)}%
//         </div>
//         <div className="text-xs text-white/80">
//           vs {failureRateBaselinePct.toFixed(1)}% baseline
//         </div>
//         <div className="mt-3 pt-3 border-t border-white/20 text-xs">
//           {failureRateDeltaPct > 0 ? (
//             <span className="text-red-300 font-semibold">
//               ↑ {Math.abs(failureRateDeltaPct).toFixed(1)} pts worse
//             </span>
//           ) : (
//             <span className="text-green-300 font-semibold">
//               ↓ {Math.abs(failureRateDeltaPct).toFixed(1)} pts improved
//             </span>
//           )}
//         </div>
//       </div>

//       <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5">
//         <div className="flex items-center justify-between mb-3">
//           <div className="text-xs font-bold uppercase tracking-wider text-white/70">
//             Avg Resolution Time
//           </div>
//           <Zap className="w-5 h-5 text-blue-400" />
//         </div>
//         <div className="text-3xl font-bold text-white mb-2">
//           {trendStats.avgResolutionHrs.toFixed(1)}h
//         </div>
//         <div className="text-xs text-white/80">From detection to clearance</div>
//         <div className="mt-3 pt-3 border-t border-white/20 text-xs text-green-300 font-semibold">
//           {trendStats.resolutionTimeDeltaText}
//         </div>
//       </div>
//     </div>

//     <div className="mt-6 bg-white/5 border border-white/10 rounded-lg p-4">
//       <div className="text-sm font-semibold text-white mb-2">Leadership Insight</div>
//       <div className="text-sm text-white/80">
//         This dashboard represents{" "}
//         <span className="text-white font-semibold">
//           ${revenueAtRisk.toLocaleString()}
//         </span>{" "}
//         in unbilled revenue with an estimated daily carrying cost of{" "}
//         <span className="text-white font-semibold">
//           ${Math.round(estimatedDailyCost).toLocaleString()}
//         </span>
//         . {highAgeCount > 0 && (
//           <span className="text-red-300 font-semibold">
//             {" "}However, {highAgeCount} orders require immediate escalation to avoid SLA
//             penalties.
//           </span>
//         )}
//       </div>
//     </div>
//   </Section>

//   {/* Operational Insights (quick tiles) */}
//   <Section title="Operational Insights" caption="Data-driven focus areas for immediate action.">
//     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//       <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-5">
//         <div className="text-xs font-bold text-blue-600 uppercase mb-2">
//           Primary Impact Site
//         </div>
//         <div className="text-xl font-bold text-blue-900">
//           {result.insights.topWarehouse}
//         </div>
//         <div className="text-xs text-blue-700 mt-2">
//           Requires operational review and process audit
//         </div>
//       </div>
//       <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl p-5">
//         <div className="text-xs font-bold text-amber-600 uppercase mb-2">
//           Top Failure Pattern
//         </div>
//         <div className="text-xl font-bold text-amber-900">
//           {result.insights.topReason}
//         </div>
//         <div className="text-xs text-amber-700 mt-2">Root cause analysis recommended</div>
//       </div>
//       <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-5">
//         <div className="text-xs font-bold text-red-600 uppercase mb-2">Maximum Age</div>
//         <div className="text-xl font-bold text-red-900">{result.insights.oldestStuck}</div>
//         <div className="text-xs text-red-700 mt-2">Escalate to executive level immediately</div>
//       </div>
//     </div>
//   </Section>

//   {/* Revenue Protection Queue (table + filters + export) */}
//   <Section
//     title="Revenue Protection Queue"
//     caption="All orders physically shipped but not posted in AX or confirmed to customers. Each row represents active revenue risk."
//   >
//     <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
//       <div className="flex flex-wrap gap-4">
//         <div>
//           <label className="block text-sm font-semibold text-gray-700 mb-2">
//             Distribution Center
//           </label>
//           <select
//             value={selectedWarehouse}
//             onChange={(e) => setSelectedWarehouse(e.target.value)}
//             className="w-full min-w[200px] px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
//           >
//             {warehouses.map((wh) => (
//               <option key={wh} value={wh}>
//                 {wh}
//               </option>
//             ))}
//           </select>
//         </div>

//         <div>
//           <label className="block text-sm font-semibold text-gray-700 mb-2">
//             Risk Level
//           </label>
//           <select
//             value={severityFilter}
//             onChange={(e) =>
//               setSeverityFilter(
//                 e.target.value as "all" | "high" | "medium" | "low"
//               )
//             }
//             className="w-full min-w[180px] px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
//           >
//             <option value="all">All Severities</option>
//             <option value="high">High Risk (&gt;24h)</option>
//             <option value="medium">Medium Risk (8–24h)</option>
//             <option value="low">Low Risk (&lt;8h)</option>
//           </select>
//         </div>

//         <div>
//           <label className="block text-sm font-semibold text-gray-700 mb-2">
//             Search Orders
//           </label>
//           <input
//             type="text"
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             placeholder="Order, Pickticket, Customer..."
//             className="w-full min-w[240px] px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
//           />
//         </div>
//       </div>

//       {/* Export menu */}
//       <div className="relative">
//         <button
//           type="button"
//           onClick={() => setShowDownloadMenu(!showDownloadMenu)}
//           className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg flex items-center gap-2"
//         >
//           <Download className="w-4 h-4" />
//           <span>Export Data</span>
//           <ChevronDown className="w-4 h-4" />
//         </button>

//         {showDownloadMenu && (
//           <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-gray-200 rounded-xl shadow-2xl z-50 py-2 text-sm">
//             <button
//               onClick={() => {
//                 exportToCSV(
//                   filteredShipments,
//                   `SHIPMENT_EXCEPTIONS_${new Date().toISOString().slice(0, 10)}.csv`
//                 );
//                 setToastMessage("CSV downloaded");
//                 setShowDownloadMenu(false);
//               }}
//               className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
//             >
//               <Download className="w-4 h-4 text-green-600" />
//               <span>Download CSV</span>
//             </button>
//             <button
//               onClick={() => {
//                 const blob = new Blob(
//                   [JSON.stringify(filteredShipments, null, 2)],
//                   { type: "application/json" }
//                 );
//                 const url = URL.createObjectURL(blob);
//                 const a = document.createElement("a");
//                 a.href = url;
//                 a.download = `SHIPMENT_EXCEPTIONS_${new Date()
//                   .toISOString()
//                   .slice(0, 10)}.json`;
//                 a.click();
//                 URL.revokeObjectURL(url);
//                 setToastMessage("JSON downloaded");
//                 setShowDownloadMenu(false);
//               }}
//               className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
//             >
//               <Download className="w-4 h-4 text-green-600" />
//               <span>Download JSON</span>
//             </button>
//           </div>
//         )}
//       </div>
//     </div>

//     <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-lg">
//       <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-5 py-3 text-sm font-bold text-gray-700 flex items-center justify-between border-b-2 border-gray-200">
//         <div className="flex items-center gap-2">
//           <Filter className="w-4 h-4 text-blue-600" />
//           <span>
//             Showing {filteredShipments.length} of {result.stuckShipments.length} exceptions
//           </span>
//         </div>
//         {filteredShipments.length < result.stuckShipments.length && (
//           <button
//             onClick={() => {
//               setSelectedWarehouse("All Warehouses");
//               setSeverityFilter("all");
//               setSearchQuery("");
//             }}
//             className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
//           >
//             Clear Filters
//           </button>
//         )}
//       </div>
//       <div className="bg-white">
//         <DataTable data={filteredShipments} />
//       </div>
//     </div>
//   </Section>

//   {/* Escalation (ticket draft) */}
//   <Section
//     title="Automated Escalation System"
//     caption="Generate and route structured fix tickets to the responsible team with full context and impacted orders."
//     collapsible
//     defaultOpen={false}
//   >
//     <div className="space-y-6">
//       <div className="space-y-3">
//         <div className="text-sm font-semibold text-gray-700">Select Escalation Target</div>
//         <div className="flex flex-wrap gap-4 text-sm text-gray-800">
//           <label className="flex items-center gap-2 cursor-pointer">
//             <input
//               type="radio"
//               name="escalationMode"
//               value="warehouse"
//               checked={escalationMode === "warehouse"}
//               onChange={() => setEscalationMode("warehouse")}
//               className="w-4 h-4"
//             />
//             <span className="font-medium">Route to Distribution Center</span>
//           </label>
//           <label className="flex items-center gap-2 cursor-pointer">
//             <input
//               type="radio"
//               name="escalationMode"
//               value="internal"
//               checked={escalationMode === "internal"}
//               onChange={() => setEscalationMode("internal")}
//               className="w-4 h-4"
//             />
//             <span className="font-medium">Route to Internal Team (AX/EDI/Finance)</span>
//           </label>
//         </div>
//       </div>

//       <div className="space-y-3">
//         {escalationMode === "warehouse" ? (
//           <>
//             <label className="block text-sm font-semibold text-gray-700 mb-2">
//               Distribution Center
//             </label>
//             <select
//               value={selectedWarehouse}
//               onChange={(e) => setSelectedWarehouse(e.target.value)}
//               className="w-full max-w-sm px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
//             >
//               {warehouses.map((wh) => (
//                 <option key={wh} value={wh}>
//                   {wh}
//                 </option>
//               ))}
//             </select>
//           </>
//         ) : (
//           <>
//             <label className="block text-sm font-semibold text-gray-700 mb-2">
//               Internal Operations Team
//             </label>
//             <select
//               value={selectedInternalTeam}
//               onChange={(e) => setSelectedInternalTeam(e.target.value)}
//               className="w-full max-w-sm px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
//             >
//               {internalTeams.map((team) => (
//                 <option key={team} value={team}>
//                   {team}
//                 </option>
//               ))}
//             </select>
//           </>
//         )}
//       </div>

//       <div className="flex flex-wrap gap-3">
//         <button
//           onClick={handleGenerateEmail}
//           className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center gap-2"
//         >
//           <Mail className="w-5 h-5" />
//           Generate Fix Ticket
//         </button>

//         <button
//           onClick={handleCopyEmail}
//           className="bg-gray-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-900 transition-all shadow-lg flex items-center gap-2"
//         >
//           <Copy className="w-5 h-5" />
//           Copy to Clipboard
//         </button>

//         {emailReady && (
//           <button
//             onClick={handleSendEmail}
//             className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg flex items-center gap-2"
//           >
//             <Mail className="w-5 h-5" />
//             Submit Ticket
//           </button>
//         )}
//       </div>

//       {emailDraft && (
//         <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5">
//           <div className="text-base font-bold text-red-900 mb-3 flex items-center gap-2">
//             <AlertTriangle className="w-5 h-5" />
//             Escalation Ticket Preview
//           </div>
//           <div className="bg-white border-2 border-red-200 rounded-lg p-5 font-mono text-xs text-gray-800 whitespace-pre-wrap shadow-inner">
//             {emailDraft}
//           </div>
//         </div>
//       )}
//     </div>
//   </Section>

//   {/* Trends */}
//   <Section
//     title="Performance Trends & Forecasting"
//     caption="7-day historical analysis with predictive indicators. Track improvement velocity and identify emerging patterns."
//     className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 dark-section"
//   >
//     <TrendKPIs
//       kpis={[
//         {
//           label: "Stuck Today",
//           value: trendStats.todayStuck.toString(),
//           delta: trendStats.deltaVs7dText,
//           positiveIsGood: trendStats.deltaIsGood,
//         },
//         {
//           label: "7-Day Average",
//           value: trendStats.sevenDayAvgStuck.toFixed(1),
//           delta: "Baseline",
//           positiveIsGood: true,
//         },
//         {
//           label: "Resolution Rate",
//           value: `${trendStats.resolutionRate.toFixed(1)}%`,
//           delta: trendStats.resolutionDeltaText,
//           positiveIsGood: true,
//         },
//         {
//           label: "Avg Resolution Time",
//           value: `${trendStats.avgResolutionHrs.toFixed(1)}h`,
//           delta: trendStats.resolutionTimeDeltaText,
//           positiveIsGood: true,
//         },
//       ]}
//     />

//     <div className="mt-8">
//       <div className="text-white font-bold mb-4 text-lg flex items-center gap-2">
//         <TrendingDown className="w-5 h-5 text-green-400" />
//         Historical Trend Analysis (Last 7 Days)
//       </div>
//       <TrendLineChart data={trendChartData} />
//     </div>
//   </Section>

//   {/* Scorecard */}
//   <Section
//     title="Distribution Center Performance Scorecard"
//     caption="Comparative analysis across all facilities. Identify leaders and opportunities for operational improvement."
//     className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 dark-section"
//   >
//     <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
//       <div className="flex items-center gap-4">
//         <div className="text-sm text-gray-300 font-semibold">Ranking Metric:</div>
//         <select
//           value={barMetric}
//           onChange={(e) => setBarMetric(e.target.value as any)}
//           className="px-5 py-2.5 rounded-lg bg-gray-900 text-white border-2 border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
//         >
//           <option value="stuckCount">Open Exceptions (today)</option>
//           <option value="avgAgeHrs">Average Aging (hrs, today)</option>
//           <option value="shareOfStuck7d">Share of Stuck (7d, %)</option>
//         </select>
//       </div>
//       <div className="text-xs text-gray-400">Data refreshed: {timestamp}</div>
//     </div>

//     <CustomBarCompareChart data={scorecardData} metric={barMetric} />
//   </Section>

//   {/* Footer value card */}
//   <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-6 shadow-xl border border-blue-500">
//     <div className="flex items-start gap-4">
//       <div className="bg-white/20 rounded-lg p-3">
//         <Zap className="w-8 h-8" />
//       </div>
//       <div>
//         <div className="text-lg font-bold mb-2">Platform Value Delivered</div>
//         <div className="text-sm text-blue-100 leading-relaxed mb-3">
//           This dashboard eliminates manual reconciliation across DHL exports, B2Bi logs, and AX queries—saving
//           <span className="text-white font-semibold"> 12+ hours/week</span>. Automated escalation routing reduces response time by{" "}
//           <span className="text-white font-semibold">67%</span>, and predictive alerts have prevented{" "}
//           <span className="text-white font-semibold">$127K</span> in SLA penalties quarter-to-date.
//         </div>
//         <div className="text-xs text-blue-200">
//           ENV: DEMO | Revenue Protection v2.1.4 | Data as of {timestamp}
//         </div>
//       </div>
//     </div>
//   </div>
// </>
// {/* === END: Ship Confirmation (EDI 945) — Results & UI === */}



//               </>
//             )}
//           </>
//         )}

//         {/* MODE: Delivery Confirmation (improved UX) */}
//         {mode === "delivery" && (
//           <>
//             <Section
//               title="Delivery Confirmation – AX Load Failures"
//               caption="Upload AX D1 and EDI 214 CSVs. We'll generate a failure report matched by Pick Number ↔ SalesOrderNumber1."
//             >
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
//                 <FileUploader label="AX D1 Report (CSV)" hint="Must include: Pick Number, Customer, 1st/2nd Leg SID/SCAC" file={axD1File} onChange={setAxD1File} />
//                 <FileUploader label="EDI 214 (CSV)" hint="Must include: SalesOrderNumber1, StatusSummary, TimeIssueOccurred, ERRORDESCRIPTION, EDILocationID1, TradingPartnerCode, AXCompany" file={edi214File} onChange={setEdi214File} />
//               </div>

//               <div className="flex flex-wrap gap-3">
//                 <button
//                   onClick={handleRunDeliveryConfirmation}
//                   disabled={deliveryBusy || !axD1File || !edi214File}
//                   className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
//                 >
//                   {deliveryBusy ? (
//                     <>
//                       <Loader2 className="w-5 h-5 animate-spin" />
//                       Generating Report...
//                     </>
//                   ) : (
//                     <>
//                       <PlayCircle className="w-5 h-5" />
//                       Generate Delivery Confirmation Report
//                     </>
//                   )}
//                 </button>

//                 {(deliverySummary || deliveryBusy) && (
//                   <button
//                     onClick={handleResetDelivery}
//                     className="bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all shadow hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
//                   >
//                     <RotateCcw className="w-5 h-5" />
//                     Reset
//                   </button>
//                 )}
//               </div>

//               {deliverySummary && (
//                 <div className="mt-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white border border-slate-700 rounded-2xl p-6 shadow-xl">
//                   <h3 className="text-xl font-semibold mb-2">Executive Summary</h3>
//                   <p className="text-sm text-white/70 mb-6">
//                     AX D1 ↔ EDI 214 reconciliation snapshot. Operational summary of matched vs failed records.
//                   </p>

//                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
//                     <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 hover:bg-white/15 transition-all duration-300">
//                       <div className="flex items-center justify-between mb-3">
//                         <div className="text-xs font-bold uppercase tracking-wider text-white/70">AX Rows</div>
//                         <PackageCheck className="w-5 h-5 text-blue-400" />
//                       </div>
//                       <div className="text-3xl font-bold text-white mb-2">{deliverySummary.total_ax_rows?.toLocaleString()}</div>
//                       <div className="text-xs text-white/70">Records from AX D1</div>
//                     </div>

//                     <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 hover:bg-white/15 transition-all duration-300">
//                       <div className="flex items-center justify-between mb-3">
//                         <div className="text-xs font-bold uppercase tracking-wider text-white/70">EDI Rows</div>
//                         <Truck className="w-5 h-5 text-emerald-400" />
//                       </div>
//                       <div className="text-3xl font-bold text-white mb-2">{deliverySummary.total_edi_rows?.toLocaleString()}</div>
//                       <div className="text-xs text-white/70">Records from EDI 214</div>
//                     </div>

//                     <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 hover:bg-white/15 transition-all duration-300">
//                       <div className="flex items-center justify-between mb-3">
//                         <div className="text-xs font-bold uppercase tracking-wider text-white/70">Matched</div>
//                         <CheckCircle2 className="w-5 h-5 text-violet-400" />
//                       </div>
//                       <div className="text-3xl font-bold text-white mb-2">{deliverySummary.matched_rows?.toLocaleString()}</div>
//                       <div className="text-xs text-white/70">Pick Number ↔ SalesOrderNumber1</div>
//                     </div>

//                     <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 hover:bg-white/15 transition-all duration-300">
//                       <div className="flex items-center justify-between mb-3">
//                         <div className="text-xs font-bold uppercase tracking-wider text-white/70">Failures ({deliverySummary.failure_rate_pct?.toFixed(1)}%)</div>
//                         <AlertTriangle className="w-5 h-5 text-rose-400" />
//                       </div>
//                       <div className="text-3xl font-bold text-white mb-2">{deliverySummary.failures_count?.toLocaleString()}</div>
//                       <div className="text-xs text-white/70">AX load issues to review</div>
//                     </div>
//                   </div>

//                   <div className="mt-6 bg-white/5 border border-white/10 rounded-lg p-4">
//                     <div className="text-sm font-semibold text-white mb-1">Leadership Insight</div>
//                     <div className="text-sm text-white/80">
//                       {deliverySummary.failures_count?.toLocaleString()} failed records detected (
//                       {deliverySummary.failure_rate_pct?.toFixed(1)}% of total). Ensure timely reconciliation to
//                       maintain data integrity and delivery confirmations.
//                     </div>
//                   </div>
//                 </div>
//               )}

//               {/* Show a single “Download Excel” button if backend provided the full sheet */}
//               {/* {deliveryXlsxB64 && (
//                 <div className="mt-4 flex justify-center">
//                   <button
//                     onClick={handleDownloadDeliveryExcel}
//                     className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
//                   >
//                     <Download className="w-5 h-5" />
//                     Download Excel Report
//                   </button>
//                 </div>
//               )} */}

//               {/* Data Table with Enhanced Filtering + Export menu in header */}
//               {deliverySummary && deliveryRows.length > 0 && (
//                 <div className="mt-6 bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-lg">
//                   {/* Header with Filters + Export */}
//                   <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-5 py-4 border-b-2 border-gray-200">
//                     <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
//                       <div className="flex items-center gap-2">
//                         <Filter className="w-4 h-4 text-blue-600" />
//                         <span className="font-semibold text-gray-700">
//                           Showing {filteredDeliveryRows.length} of {deliveryRows.length} rows
//                         </span>
//                       </div>

//                       <div className="flex items-center gap-3 flex-wrap justify-end">
//                         {/* Search */}
//                         <div className="relative">
//                           <input
//                             type="text"
//                             value={deliverySearch}
//                             onChange={(e) => setDeliverySearch(e.target.value)}
//                             placeholder="Search all columns..."
//                             className="w-full sm:w-64 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all pr-10"
//                           />
//                           <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
//                             <InfoIcon className="w-4 h-4" />
//                           </div>
//                         </div>

//                         {/* Status Filter */}
//                         <select
//                           value={deliveryStatus}
//                           onChange={(e) => setDeliveryStatus(e.target.value)}
//                           className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
//                         >
//                           <option value="">All Statuses</option>
//                           {distinctStatus.map((s) => (
//                             <option key={s} value={s}>{s}</option>
//                           ))}
//                         </select>

//                         {/* Customer Filter */}
//                         <input
//                           type="text"
//                           value={deliveryCustomer}
//                           onChange={(e) => setDeliveryCustomer(e.target.value)}
//                           placeholder="Filter by customer..."
//                           className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
//                         />

//                         {/* EXPORT DROPDOWN (Delivery) */}
//                         <div className="relative">
//                           <button
//                             type="button"
//                             onClick={() => setShowDeliveryExport((v) => !v)}
//                             className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2.5 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
//                           >
//                             <Download className="w-4 h-4" />
//                             <span>Export Data</span>
//                             <ChevronDown className="w-4 h-4" />
//                           </button>

//                           {showDeliveryExport && (
//                             <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-gray-200 rounded-xl shadow-2xl z-50 py-2 text-sm">
//                               <button
//                                 onClick={() => {
//                                   exportDeliveryCSV(filteredDeliveryRows);
//                                   setToastMessage("CSV downloaded");
//                                   setShowDeliveryExport(false);
//                                 }}
//                                 className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
//                               >
//                                 <Download className="w-4 h-4 text-green-600" />
//                                 <span>Download CSV</span>
//                               </button>

//                               <button
//                                 onClick={() => {
//                                   exportDeliveryJSON(filteredDeliveryRows);
//                                   setToastMessage("JSON downloaded");
//                                   setShowDeliveryExport(false);
//                                 }}
//                                 className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
//                               >
//                                 <Download className="w-4 h-4 text-green-600" />
//                                 <span>Download JSON</span>
//                               </button>

//                               <button
//                                 onClick={async () => {
//                                   await exportDeliveryPDF(deliveryColumns, filteredDeliveryRows);
//                                   setToastMessage("PDF downloaded");
//                                   setShowDeliveryExport(false);
//                                 }}
//                                 className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
//                               >
//                                 <Download className="w-4 h-4 text-green-600" />
//                                 <span>Executive Report (PDF)</span>
//                               </button>

//                               {deliveryXlsxB64 && (
//                                 <>
//                                   <div className="my-1 border-t border-gray-200" />
//                                   <button
//                                     onClick={handleDownloadDeliveryExcel}
//                                     className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
//                                   >
//                                     <Download className="w-4 h-4 text-green-600" />
//                                     <span>Download Excel</span>
//                                   </button>
//                                 </>
//                               )}
//                             </div>
//                           )}
//                         </div>
//                       </div>
//                     </div>

//                     {/* Clear Filters */}
//                     {(deliverySearch || deliveryStatus || deliveryCustomer) && (
//                       <div className="mt-3 flex justify-end">
//                         <button
//                           onClick={() => {
//                             setDeliverySearch("");
//                             setDeliveryStatus("");
//                             setDeliveryCustomer("");
//                           }}
//                           className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
//                         >
//                           <RotateCcw className="w-3 h-3" />
//                           Clear all filters
//                         </button>
//                       </div>
//                     )}
//                   </div>

//                   {/* Scrollable Table Container */}
//                   <div className="overflow-hidden">
//                     <div className="max-h-[65vh] overflow-auto">
//                       <table className="min-w-full divide-y divide-gray-200 table-fixed">
//                         <thead className="bg-gray-50 sticky top-0 z-10">
//                           <tr>
//                             {deliveryColumns.map((column) => (
//                               <th
//                                 key={column}
//                                 className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap border-b border-gray-200"
//                               >
//                                 <div className="flex items-center gap-1">{column}</div>
//                               </th>
//                             ))}
//                           </tr>
//                         </thead>
//                         <tbody className="bg-white divide-y divide-gray-200">
//                           {filteredDeliveryRows.length > 0 ? (
//                             filteredDeliveryRows.map((row, index) => (
//                               <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
//                                 {deliveryColumns.map((column) => (
//                                   <td
//                                     key={column}
//                                     className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap truncate max-w-[16rem]"
//                                     title={String(row[column] ?? "")}
//                                   >
//                                     {String(row[column] ?? "—")}
//                                   </td>
//                                 ))}
//                               </tr>
//                             ))
//                           ) : (
//                             <tr>
//                               <td colSpan={deliveryColumns.length} className="px-4 py-8 text-center text-gray-500">
//                                 <div className="flex flex-col items-center gap-2">
//                                   <Filter className="w-8 h-8 text-gray-300" />
//                                   <div className="font-medium">No rows match your filters</div>
//                                   <button
//                                     onClick={() => {
//                                       setDeliverySearch("");
//                                       setDeliveryStatus("");
//                                       setDeliveryCustomer("");
//                                     }}
//                                     className="text-blue-600 hover:text-blue-800 text-sm font-medium"
//                                   >
//                                     Clear filters to see all data
//                                   </button>
//                                 </div>
//                               </td>
//                             </tr>
//                           )}
//                         </tbody>
//                       </table>
//                     </div>
//                   </div>

//                   {/* Footer with Pagination Info */}
//                   <div className="bg-gray-50 px-5 py-3 border-t border-gray-200">
//                     <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-600">
//                       <div className="font-medium">
//                         Showing {filteredDeliveryRows.length} of {deliveryRows.length} records
//                         {deliverySearch || deliveryStatus || deliveryCustomer ? " (filtered)" : ""}
//                       </div>
//                       <div className="text-xs text-gray-500">
//                         Scroll horizontally and vertically to view all data • Use filters to narrow results
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </Section>
//           </>
//         )}

//         {/* MODE: NO_SONUM (placeholder) */}
//         {mode === "no_sonum" && (
//           <Section title="NO_SONUM" caption="Placeholder view">
//             <div className="text-sm text-gray-700">
//               We'll flesh this out next.
//             </div>
//           </Section>
//         )}
//       </main>
//     </div>
//   );
// }

// export default App;


// src/App.tsx
import { useState } from "react";
import Navbar from "./components/Navbar";
import ModeSwitch, { ViewMode } from "./pages/workflows/ModeSwitch";
import EDI945Page from "./pages/workflows/EDI945Page";
import DeliveryConfirmationPage from "./pages/workflows/DeliveryConfirmationPage";
import NoSoNumPage from "./pages/workflows/NoSoNumPage";

export default function App() {
  const timestamp =
    new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
      timeZone: "America/Chicago",
    }) + " CT";

  const [mode, setMode] = useState<ViewMode>("edi945");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 relative">
      <Navbar timestamp={timestamp} />
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6 animate-in fade-in duration-500">
        <ModeSwitch mode={mode} setMode={setMode} />

        {mode === "edi945" && <EDI945Page timestamp={timestamp} />}
        {mode === "delivery" && <DeliveryConfirmationPage />}
        {mode === "no_sonum" && <NoSoNumPage />}
      </main>
    </div>
  );
}
