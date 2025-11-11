import { useEffect, useMemo, useState } from "react";
import {
  PlayCircle, Loader2, RotateCcw, Download, Filter, CheckCircle2,
  PackageCheck, Truck, AlertTriangle, ChevronDown, Info as InfoIcon
} from "lucide-react";

import Section from "../../components/Section";
import FileUploader from "../../components/FileUploader";

type DeliverySummary = {
  total_ax_rows: number;
  total_edi_rows: number;
  matched_rows: number;
  failures_count: number;
  failure_rate_pct: number;
};

export default function DeliveryConfirmationPage() {
  const [axD1File, setAxD1File] = useState<File | null>(null);
  const [edi214File, setEdi214File] = useState<File | null>(null);

  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [deliveryXlsxB64, setDeliveryXlsxB64] = useState<string | null>(null);
  const [deliveryFilename, setDeliveryFilename] = useState<string>("AX_Load_Failures.xlsx");

  type DeliveryRow = Record<string, any>;
  const [deliveryRows, setDeliveryRows] = useState<DeliveryRow[]>([]);

  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState<string>("");
  const [deliveryCustomer, setDeliveryCustomer] = useState<string>("");

  const [showDeliveryExport, setShowDeliveryExport] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const handleRun = async () => {
    if (!axD1File || !edi214File) {
      alert("Please upload both files (AX D1 and EDI 214).");
      return;
    }
    setDeliveryBusy(true);
    setDeliverySummary(null);
    setDeliveryRows([]);
    setDeliveryXlsxB64(null);
  
    try {
      const base = import.meta.env.VITE_API_BASE_FASTAPI || "http://localhost:8000";
      const url = `${base}/delivery-confirmation?limit=10000`;
  
      const fd = new FormData();
      fd.append("ax_report", axD1File);
      fd.append("edi214", edi214File);
  
      const res = await fetch(url, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Server error: ${res.status} ${await res.text().catch(()=> "")}`);
  
      const json = await res.json();
  
      setDeliverySummary(json.summary);
      const rows = Array.isArray(json.sample) ? json.sample : (Array.isArray(json.rows) ? json.rows : []);
      setDeliveryRows(rows);
      setDeliveryXlsxB64(json.xlsx_b64 || null);
      setDeliveryFilename(json.filename || "AX_Load_Failures.xlsx");
      setToastMessage("Delivery Confirmation completed");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to generate Delivery Confirmation report.");
    } finally {
      setTimeout(() => setDeliveryBusy(false), 1800);
    }
  };
  
  const handleReset = () => {
    setAxD1File(null);
    setEdi214File(null);
    setDeliveryBusy(false);
    setDeliverySummary(null);
    setDeliveryRows([]);
    setDeliveryXlsxB64(null);
    setDeliveryFilename("AX_Load_Failures.xlsx");
    setDeliverySearch("");
    setDeliveryStatus("");
    setDeliveryCustomer("");
    setShowDeliveryExport(false);
  };

  const handleDownloadDeliveryExcel = () => {
    if (!deliveryXlsxB64) return;
    const byteChars = atob(deliveryXlsxB64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNums)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = deliveryFilename;
    a.click();
    URL.revokeObjectURL(a.href);
    setToastMessage("Excel downloaded");
  };

  // quick CSV/JSON/PDF inlined (same behavior as before)
  function exportDeliveryCSV(rows: Record<string, any>[]) {
    if (!rows?.length) return;
    const cols = Object.keys(rows[0]);
    const lines = [
      cols.join(","),
      ...rows.map(r =>
        cols.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `DELIVERY_AX_Load_Failures_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function exportDeliveryJSON(rows: Record<string, any>[]) {
    const blob = new Blob([JSON.stringify(rows ?? [], null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `DELIVERY_AX_Load_Failures_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function exportDeliveryPDF(cols: string[], rows: Record<string, any>[]) {
    const [{ jsPDF }, autoTable] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const title = "Delivery Confirmation — AX Load Failures";
    doc.setFontSize(14); doc.text(title, 40, 40);
    const sub = `Generated: ${new Date().toLocaleString()}`;
    doc.setFontSize(10); doc.text(sub, 40, 58);
    const head = [cols];
    const body = rows.map(r => cols.map(c => String(r[c] ?? "")));
    autoTable.default(doc, {
      head, body, startY: 75,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [240, 244, 255], textColor: 20 },
      bodyStyles: { textColor: 30 },
      columnStyles: Object.fromEntries(cols.map((_, i) => [i, { cellWidth: "wrap" }])),
      didDrawPage: (d) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(9);
        doc.text(`Page ${d.pageNumber} / ${pageCount}`, d.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
      },
    });
    doc.save(`DELIVERY_AX_Load_Failures_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  const deliveryColumns = useMemo(() => {
    if (!deliveryRows.length) return [];
    return Object.keys(deliveryRows[0]);
  }, [deliveryRows]);

  const filteredDeliveryRows = useMemo(() => {
    const q = deliverySearch.trim().toLowerCase();
    return deliveryRows.filter((r) => {
      const matchesSearch =
        !q || Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q));
      const matchesStatus =
        !deliveryStatus || String(r["statussummary"] ?? "").toLowerCase() === deliveryStatus.toLowerCase();
      const matchesCustomer =
        !deliveryCustomer || String(r["Customer"] ?? "").toLowerCase().includes(deliveryCustomer.toLowerCase());
      return matchesSearch && matchesStatus && matchesCustomer;
    });
  }, [deliveryRows, deliverySearch, deliveryStatus, deliveryCustomer]);

  const distinctStatus = useMemo(() => {
    const s = new Set<string>();
    deliveryRows.forEach((r) => s.add(String(r["statussummary"] ?? "")));
    return Array.from(s).filter(Boolean).sort();
  }, [deliveryRows]);

  return (
    <>
      {/* === FULL-SCREEN LOADING OVERLAY (matches Ship Confirmation style) === */}
      {deliveryBusy && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-200">
          <div className="bg-white shadow-2xl rounded-2xl px-8 py-7 flex flex-col items-center gap-4 border border-gray-200 animate-in zoom-in duration-300">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <div className="text-base font-semibold text-gray-900">
              Generating Delivery Confirmation report...
            </div>
            <div className="text-sm text-gray-600 max-w-[320px]">
              Matching AX D1 <span className="font-medium">Pick&nbsp;Number</span> with EDI&nbsp;214 <span className="font-medium">SalesOrderNumber1</span>, capturing failures and preparing the download.
            </div>
            <div className="flex gap-2 mt-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-start gap-3 bg-white border-l-4 border-green-500 rounded-lg shadow-2xl px-5 py-4 text-sm text-gray-800 max-w-sm animate-in slide-in-from-right duration-300">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="font-medium text-gray-900">{toastMessage}</div>
        </div>
      )}

      <Section
        title="Delivery Confirmation – AX Load Failures"
        caption="Upload AX D1 and EDI 214 CSVs. We'll generate a failure report matched by Pick Number ↔ SalesOrderNumber1."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <FileUploader label="AX D1 Report (CSV)" hint="Must include: Pick Number, Customer, 1st/2nd Leg SID/SCAC" file={axD1File} onChange={setAxD1File} />
          <FileUploader label="EDI 214 (CSV)" hint="Must include: SalesOrderNumber1, StatusSummary, TimeIssueOccurred, ERRORDESCRIPTION, EDILocationID1, TradingPartnerCode, AXCompany" file={edi214File} onChange={setEdi214File} />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRun}
            disabled={deliveryBusy || !axD1File || !edi214File}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            {deliveryBusy ? (<><Loader2 className="w-5 h-5 animate-spin" />Generating Report...</>)
              : (<><PlayCircle className="w-5 h-5" />Generate Delivery Confirmation Report</>)}
          </button>

          {(deliverySummary || deliveryBusy) && (
            <button
              onClick={handleReset}
              className="bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all shadow hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          )}
        </div>

        {deliverySummary && (
          <div className="mt-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-2">Executive Summary</h3>
            <p className="text-sm text-white/70 mb-6">
              AX D1 ↔ EDI 214 reconciliation snapshot. Operational summary of matched vs failed records.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 hover:bg-white/15 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/70">AX Rows</div>
                  <PackageCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-2">{deliverySummary.total_ax_rows?.toLocaleString()}</div>
                <div className="text-xs text-white/70">Records from AX D1</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 hover:bg-white/15 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/70">EDI Rows</div>
                  <Truck className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-2">{deliverySummary.total_edi_rows?.toLocaleString()}</div>
                <div className="text-xs text-white/70">Records from EDI 214</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 hover:bg-white/15 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/70">Matched</div>
                  <CheckCircle2 className="w-5 h-5 text-violet-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-2">{deliverySummary.matched_rows?.toLocaleString()}</div>
                <div className="text-xs text-white/70">Pick Number ↔ SalesOrderNumber1</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 hover:bg-white/15 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/70">
                    Failures ({deliverySummary.failure_rate_pct?.toFixed(1)}%)
                  </div>
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-2">{deliverySummary.failures_count?.toLocaleString()}</div>
                <div className="text-xs text-white/70">AX load issues to review</div>
              </div>
            </div>

            <div className="mt-6 bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-sm font-semibold text-white mb-1">Leadership Insight</div>
              <div className="text-sm text-white/80">
                {deliverySummary.failures_count?.toLocaleString()} failed records detected ({deliverySummary.failure_rate_pct?.toFixed(1)}% of total). Ensure timely reconciliation to
                maintain data integrity and delivery confirmations.
              </div>
            </div>
          </div>
        )}

        {deliverySummary && deliveryRows.length > 0 && (
          <div className="mt-6 bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-5 py-4 border-b-2 border-gray-200">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-700">
                    Showing {filteredDeliveryRows.length} of {deliveryRows.length} rows
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <div className="relative">
                    <input
                      type="text"
                      value={deliverySearch}
                      onChange={(e) => setDeliverySearch(e.target.value)}
                      placeholder="Search all columns..."
                      className="w-full sm:w-64 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <InfoIcon className="w-4 h-4" />
                    </div>
                  </div>

                  <select
                    value={deliveryStatus}
                    onChange={(e) => setDeliveryStatus(e.target.value)}
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">All Statuses</option>
                    {distinctStatus.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <input
                    type="text"
                    value={deliveryCustomer}
                    onChange={(e) => setDeliveryCustomer(e.target.value)}
                    placeholder="Filter by customer..."
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDeliveryExport((v) => !v)}
                      className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2.5 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Data</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {showDeliveryExport && (
                      <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-gray-200 rounded-xl shadow-2xl z-50 py-2 text-sm">
                        <button
                          onClick={() => { exportDeliveryCSV(filteredDeliveryRows); setToastMessage("CSV downloaded"); setShowDeliveryExport(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
                        >
                          <Download className="w-4 h-4 text-green-600" />
                          <span>Download CSV</span>
                        </button>

                        <button
                          onClick={() => { exportDeliveryJSON(filteredDeliveryRows); setToastMessage("JSON downloaded"); setShowDeliveryExport(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
                        >
                          <Download className="w-4 h-4 text-green-600" />
                          <span>Download JSON</span>
                        </button>

                        <button
                          onClick={async () => { await exportDeliveryPDF(deliveryColumns, filteredDeliveryRows); setToastMessage("PDF downloaded"); setShowDeliveryExport(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
                        >
                          <Download className="w-4 h-4 text-green-600" />
                          <span>Executive Report (PDF)</span>
                        </button>

                        {deliveryXlsxB64 && (
                          <>
                            <div className="my-1 border-t border-gray-200" />
                            <button
                              onClick={handleDownloadDeliveryExcel}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
                            >
                              <Download className="w-4 h-4 text-green-600" />
                              <span>Download Excel</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(deliverySearch || deliveryStatus || deliveryCustomer) && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => { setDeliverySearch(""); setDeliveryStatus(""); setDeliveryCustomer(""); }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-hidden">
              <div className="max-h-[65vh] overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {deliveryColumns.map((column) => (
                        <th key={column} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">
                          <div className="flex items-center gap-1">{column}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDeliveryRows.length > 0 ? (
                      filteredDeliveryRows.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                          {deliveryColumns.map((column) => (
                            <td key={column} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap truncate max-w-[16rem]" title={String(row[column] ?? "")}>
                              {String(row[column] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={deliveryColumns.length} className="px-4 py-8 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <Filter className="w-8 h-8 text-gray-300" />
                            <div className="font-medium">No rows match your filters</div>
                            <button
                              onClick={() => { setDeliverySearch(""); setDeliveryStatus(""); setDeliveryCustomer(""); }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Clear filters to see all data
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-50 px-5 py-3 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-600">
                <div className="font-medium">
                  Showing {filteredDeliveryRows.length} of {deliveryRows.length} records
                  {deliverySearch || deliveryStatus || deliveryCustomer ? " (filtered)" : ""}
                </div>
                <div className="text-xs text-gray-500">
                  Scroll horizontally and vertically to view all data • Use filters to narrow results
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>
    </>
  );
}

