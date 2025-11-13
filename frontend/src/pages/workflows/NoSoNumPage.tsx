// src/pages/workflows/NoSoNumPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  PlayCircle, Loader2, RotateCcw, Download, Filter, CheckCircle2,
  ChevronDown, Info as InfoIcon, PackageCheck, AlertTriangle
} from "lucide-react";

import Section from "../../components/Section";
import FileUploader from "../../components/FileUploader";

type Row = Record<string, any>;

export default function NoSoNumPage() {
  const [axHeaderFile, setAxHeaderFile] = useState<File | null>(null);
  const [d1LegsFile, setD1LegsFile] = useState<File | null>(null);
  const [edi214File, setEdi214File] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [xlsxBlob, setXlsxBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState("NO_SONUM.xlsx");

  const summary = useMemo(() => {
    const total = rows.length;
    const uniquePOs = new Set(rows.map(r => String(r["PurchaseOrderNumber"] ?? ""))).size;
    const withErrors = rows.filter(r => String(r["ERRORDESCRIPTION"] ?? "").trim() !== "").length;
    return { total_rows: total, unique_pos: uniquePOs, with_errors: withErrors };
  }, [rows]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const base = (import.meta.env.VITE_API_BASE_FASTAPI as string) || "http://localhost:8000";

  async function handleRun() {
    if (!axHeaderFile || !d1LegsFile || !edi214File) {
      alert("Please upload all 3 files: EDI940Report_withCostV2.0, TPX_-_AX_D1_Report, and EDIB2BiReportV2.");
      return;
    }
    setBusy(true);
    setRows([]);
    setXlsxBlob(null);
    setFilename("NO_SONUM.xlsx");

    try {
      const fd = new FormData();
      // API expects these exact field names:
      fd.append("ax_header", axHeaderFile);
      fd.append("d1_legs", d1LegsFile);
      fd.append("edi214", edi214File);

      const res = await fetch(`${base}/no-sonum-reconciliation`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Server error: ${res.status} ${await res.text().catch(()=> "")}`);

      const dispo = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/i.exec(dispo);
      const inferredName = m?.[1] || "NO_SONUM.xlsx";

      const blob = await res.blob();
      setXlsxBlob(blob);
      setFilename(inferredName);

      // Parse first sheet of the Excel to preview rows
      const arr = await blob.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(arr, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: Row[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setRows(json);

      setToast("NO_SONUM report generated");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to generate NO_SONUM report.");
    } finally {
      setTimeout(() => setBusy(false), 1200);
    }
  }

  function handleReset() {
    setAxHeaderFile(null);
    setD1LegsFile(null);
    setEdi214File(null);
    setBusy(false);
    setRows([]);
    setXlsxBlob(null);
    setFilename("NO_SONUM.xlsx");
    setSearch("");
    setStatusFilter("");
    setShowExportMenu(false);
  }

  function handleDownloadExcel() {
    if (!xlsxBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(xlsxBlob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("Excel downloaded");
  }

  // Optional client-side exports (based on preview rows)
  function exportCSV(data: Row[]) {
    if (!data?.length) return;
    const cols = Object.keys(data[0]);
    const lines = [
      cols.join(","),
      ...data.map(r =>
        cols.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `NO_SONUM_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("CSV downloaded");
  }
  function exportJSON(data: Row[]) {
    const blob = new Blob([JSON.stringify(data ?? [], null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `NO_SONUM_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("JSON downloaded");
  }
  async function exportPDF(cols: string[], data: Row[]) {
    const [{ jsPDF }, autoTable] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const title = "NO_SONUM / NO_SO Reconciliation";
    doc.setFontSize(14); doc.text(title, 40, 40);
    const sub = `Generated: ${new Date().toLocaleString()}`;
    doc.setFontSize(10); doc.text(sub, 40, 58);
    const head = [cols];
    const body = data.map(r => cols.map(c => String(r[c] ?? "")));
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
    doc.save(`NO_SONUM_${new Date().toISOString().slice(0,10)}.pdf`);
    setToast("PDF downloaded");
  }

  const columns = useMemo(() => rows.length ? Object.keys(rows[0]) : [], [rows]);
  const statusSet = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => s.add(String(r["StatusSummary"] ?? "")));
    return Array.from(s).filter(Boolean).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !q || Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q));
      const matchesStatus = !statusFilter || String(r["StatusSummary"] ?? "").toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  return (
    <>
      {/* Loading overlay */}
      {busy && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-200">
          <div className="bg-white shadow-2xl rounded-2xl px-8 py-7 flex flex-col items-center gap-4 border border-gray-200 animate-in zoom-in duration-300">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <div className="text-base font-semibold text-gray-900">Reconciling NO_SONUM rows…</div>
            <div className="text-sm text-gray-600 max-w-[360px]">
              Filtering EDI 214 for <span className="font-medium">NO_SONUM / NO_SO</span> and generating the workbook.
            </div>
            <div className="flex gap-2 mt-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-start gap-3 bg-white border-l-4 border-green-500 rounded-lg shadow-2xl px-5 py-4 text-sm text-gray-800 max-w-sm animate-in slide-in-from-right duration-300">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="font-medium text-gray-900">{toast}</div>
        </div>
      )}

      <Section
        title="NO_SONUM / NO_SO Reconciliation"
        caption="Upload EDI940Report_withCostV2.0, TPX_-_AX_D1_Report, and EDIB2BiReportV2 CSVs. We’ll generate the Excel and show a preview."
      >
        {/* Uploaders with your exact names */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <FileUploader
            label="EDI940Report_withCostV2.0"
            hint="AX header CSV (includes: SalesId, SalesHeaderStatus, SalesHeaderDocStatus)"
            file={axHeaderFile}
            onChange={setAxHeaderFile}
          />
          <FileUploader
            label="TPX_-_AX_D1_Report"
            hint="D1 / Legs CSV (accepted for parity; not used in output)"
            file={d1LegsFile}
            onChange={setD1LegsFile}
          />
          <FileUploader
            label="EDIB2BiReportV2"
            hint="EDI 214 CSV (includes: SalesOrderNumber1, StatusSummary, TimeIssueOccurred, ERRORDESCRIPTION)"
            file={edi214File}
            onChange={setEdi214File}
          />
        </div>

        {/* Actions (Export removed from here, just Run + Reset like Delivery) */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRun}
            disabled={busy || !axHeaderFile || !d1LegsFile || !edi214File}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            {busy ? (<><Loader2 className="w-5 h-5 animate-spin" />Generating…</>)
              : (<><PlayCircle className="w-5 h-5" />Generate NO_SONUM Report</>)}
          </button>

          {(rows.length || busy) ? (
            <button
              onClick={handleReset}
              className="bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all shadow hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          ) : null}
        </div>

        {/* Summary card */}
        {rows.length > 0 && (
          <div className="mt-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-2">Executive Summary</h3>
            <p className="text-sm text-white/70 mb-6">NO_SONUM / NO_SO snapshot with AX enrichment where possible.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white/10 border border-white/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/70">Rows</div>
                  <PackageCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold">{summary.total_rows}</div>
                <div className="text-xs text-white/70">Final result rows</div>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/70">Unique POs</div>
                  <AlertTriangle className="w-5 h-5 text-amber-300" />
                </div>
                <div className="text-3xl font-bold">{summary.unique_pos}</div>
                <div className="text-xs text-white/70">Distinct Purchase Orders</div>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/70">With Errors</div>
                  <AlertTriangle className="w-5 h-5 text-rose-300" />
                </div>
                <div className="text-3xl font-bold">{summary.with_errors}</div>
                <div className="text-xs text-white/70">Rows with error details</div>
              </div>
            </div>
          </div>
        )}

        {/* Data table + Export button in header (same placement as Delivery) */}
        {rows.length > 0 && (
          <div className="mt-6 bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-5 py-4 border-b-2 border-gray-200">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-700">
                    Showing {filteredRows.length} of {rows.length} rows
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search all columns..."
                      className="w-full sm:w-64 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <InfoIcon className="w-4 h-4" />
                    </div>
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">All Statuses</option>
                    {statusSet.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>

                  {/* Export moved here, just like Delivery */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowExportMenu((v) => !v)}
                      className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2.5 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Data</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {showExportMenu && (
                      <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-gray-200 rounded-xl shadow-2xl z-50 py-2 text-sm">
                        {xlsxBlob && (
                          <button
                            onClick={() => { handleDownloadExcel(); setShowExportMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
                          >
                            <Download className="w-4 h-4 text-green-600" />
                            <span>Download Excel</span>
                          </button>
                        )}
                        {filteredRows.length > 0 && (
                          <>
                            <button
                              onClick={() => { exportCSV(filteredRows); setShowExportMenu(false); }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
                            >
                              <Download className="w-4 h-4 text-green-600" />
                              <span>Download CSV</span>
                            </button>
                            <button
                              onClick={() => { exportJSON(filteredRows); setShowExportMenu(false); }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
                            >
                              <Download className="w-4 h-4 text-green-600" />
                              <span>Download JSON</span>
                            </button>
                            <button
                              onClick={async () => { await exportPDF(columns, filteredRows); setShowExportMenu(false); }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-gray-800 font-medium"
                            >
                              <Download className="w-4 h-4 text-green-600" />
                              <span>Executive Report (PDF)</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden">
              <div className="max-h-[65vh] overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {columns.map((c) => (
                        <th key={c} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {columns.map((c) => (
                          <td key={c} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap truncate max-w-[16rem]" title={String(r[c] ?? "")}>
                            {String(r[c] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 text-sm text-gray-600">
              Showing {filteredRows.length} of {rows.length} records
              {search || statusFilter ? " (filtered)" : ""}
            </div>
          </div>
        )}
      </Section>
    </>
  );
}
