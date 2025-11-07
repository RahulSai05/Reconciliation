// // utils/reconciliation.ts
// import type {
//   DHLShipment,
//   B2BiRecord,
//   AXRecord,
//   MergedRecord,
//   StuckShipment,
//   ReconciliationResult,
// } from "../types";

// /* ----------------------------- small helpers ----------------------------- */

// const norm = (v?: string) =>
//   (v ?? "")
//     .toString()
//     .trim()
//     .toLowerCase();

// const cleanKey = (v?: string) => {
//   if (!v) return "";
//   // trim, remove spaces, collapse leading zeros (common PT formatting)
//   const t = v.trim().replace(/\s+/g, "");
//   return t.replace(/^0+/, "") || "0";
// };

// function isLikelyGuid(str: string): boolean {
//   return (
//     /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) ||
//     /^[0-9a-f]{32}$/i.test(str) ||
//     (str.length > 20 && /^[0-9a-f-]+$/i.test(str))
//   );
// }
// function isLikelyInternalId(str: string): boolean {
//   return /^\d+$/.test(str) && str.length > 8;
// }
// function looksLikeErrorMessage(str: string): boolean {
//   if ((str ?? "").length < 10) return false;
//   const s = str.toLowerCase();
//   return [
//     "sales order",
//     "is on hold",
//     "customer account",
//     "error",
//     "failure",
//     "failed",
//     "reject",
//     "invalid",
//     "missing",
//     "not found",
//     "cannot",
//     "unable",
//     "hold for",
//     "credit hold",
//     "creation has been canceled",
//     "the request failed",
//     "tpx945header",
//     "ts-00084",
//     "account",
//     "order",
//     "customer",
//   ].some((x) => s.includes(x));
// }

// /* -------------------------- derive EDI failure/ok ------------------------- */
// /** Convert any B2Bi "status-ish" fields into a single canonical status. */
// function deriveEdiProcessingStatus(b2bi?: Record<string, any>): "AX Load Failure" | "Accepted" | "Pending" | "Unknown" {
//   if (!b2bi) return "Unknown";

//   // Check common fields in priority order
//   const candidates = [
//     b2bi.StatusSummary,
//     b2bi.Status,
//     b2bi.PROCESSING_STATUS,
//     b2bi["Processing Status"],
//     b2bi.Outcome,
//     b2bi.DocumentStatus,
//     b2bi.Ack,
//   ]
//     .filter(Boolean)
//     .map(String);

//   // Also scan all string fields as a fallback
//   const strings = new Set<string>();
//   for (const [k, v] of Object.entries(b2bi)) {
//     if (typeof v === "string" && v.trim()) strings.add(v.trim());
//   }
//   const all = [...candidates, ...strings];

//   let sawErrorish = false;
//   let sawSuccessish = false;
//   let sawPendingish = false;

//   for (const s of all) {
//     const x = norm(s);
//     if (x.includes("fail") || x.includes("error") || x.includes("reject")) sawErrorish = true;
//     if (x.includes("accept") || x.includes("success") || x === "ok") sawSuccessish = true;
//     if (x.includes("pend")) sawPendingish = true;
//   }

//   if (sawErrorish && !sawSuccessish) return "AX Load Failure";
//   if (sawSuccessish && !sawErrorish) return "Accepted";
//   if (sawPendingish) return "Pending";
//   return "Unknown";
// }

// function findErrorMessage(b2biRecord: any, derivedStatus: string): string {
//   // Only return an error message if the overall status is failure.
//   if (derivedStatus !== "AX Load Failure" || !b2biRecord) return "";

//   const isStatusWord = (s: string) => {
//     const x = s.trim().toLowerCase();
//     return (
//       x === "ax load failure" ||
//       x === "accepted" ||
//       x === "success" ||
//       x === "ok" ||
//       x === "processed" ||
//       x === "complete" ||
//       x === "completed" ||
//       x === "pending" ||
//       x === "unknown"
//     );
//   };

//   const looksLikeStatusPhrase = (s: string) => {
//     const x = s.toLowerCase();
//     return (
//       x.includes("accepted") ||
//       x.includes("success") ||
//       x.includes("ok") ||
//       x.includes("processed") ||
//       x.includes("complete") ||
//       x.includes("pending") ||
//       x === "ax load failure"
//     );
//   };

//   const errorFields = [
//     "ERRORDESCRIPTION",
//     "ERROR_DESCRIPTION",
//     "EDI Message",
//     "Message",
//     "Error Description",
//     "Error",
//     "ErrorMsg",
//     "FailureReason",
//     "StatusMessage",
//     "Description",
//     "ERROR",
//     "FAILURE_REASON",
//     "STATUS_MESSAGE",
//   ];

//   // 1) Preferred fields first
//   for (const f of errorFields) {
//     const v = b2biRecord[f];
//     if (typeof v === "string") {
//       const s = v.trim();
//       if (
//         s &&
//         s.length > 10 &&                            // not too short
//         !isStatusWord(s) &&                         // not a plain status token
//         !looksLikeStatusPhrase(s) &&                // not a status-like phrase
//         !isLikelyGuid(s) &&
//         !isLikelyInternalId(s) &&
//         looksLikeErrorMessage(s)
//       ) {
//         return s;
//       }
//     }
//   }

//   // 2) Fallback: scan all string fields for a plausible error sentence
//   for (const [, v] of Object.entries(b2biRecord)) {
//     if (typeof v === "string") {
//       const s = v.trim();
//       if (
//         s &&
//         s.length > 10 &&
//         !isStatusWord(s) &&
//         !looksLikeStatusPhrase(s) &&
//         !isLikelyGuid(s) &&
//         !isLikelyInternalId(s) &&
//         looksLikeErrorMessage(s)
//       ) {
//         return s;
//       }
//     }
//   }

//   // 3) If still nothing, return a friendly default for failure
//   return "AX load failure reported by B2Bi; no detailed message provided.";
// }

// /* ------------------------------- aging utils ------------------------------ */
// export function calculateAgeHours(row: MergedRecord | StuckShipment): number | null {
//   const now = new Date();
//   const tryDates: Array<keyof typeof row> = ["Ship Date", "PickCreatedDate"];

//   for (const col of tryDates) {
//     const value = row[col];
//     if (!value) continue;

//     try {
//       const dateStr = String(value);
//       let dt: Date;

//       if (dateStr.includes("/")) {
//         // Allow MM/DD/YY or MM/DD/YYYY
//         const [m, d, y] = dateStr.split("/");
//         const fullY = y.length === "YY".length ? `20${y}` : y;
//         dt = new Date(parseInt(fullY), parseInt(m) - 1, parseInt(d));
//       } else {
//         dt = new Date(dateStr);
//       }
//       if (!isNaN(dt.getTime())) {
//         return (now.getTime() - dt.getTime()) / (1000 * 60 * 60);
//       }
//     } catch {
//       // ignore and try next column
//     }
//   }
//   return null;
// }

// export function getAgeBadgeInfo(ageHours: number | null): {
//   label: string;
//   badgeClass: string;
//   severity: "low" | "medium" | "high" | "unknown";
// } {
//   if (ageHours === null) {
//     return { label: "Unknown", badgeClass: "badge-neutral", severity: "unknown" };
//   }
//   if (ageHours < 4) return { label: `Fresh (${Math.round(ageHours)}h)`, badgeClass: "badge-success", severity: "low" };
//   if (ageHours < 24) return { label: `Watch (${Math.round(ageHours)}h)`, badgeClass: "badge-warning", severity: "medium" };
//   return { label: `Escalate (${Math.round(ageHours)}h)`, badgeClass: "badge-danger", severity: "high" };
// }

// /* -------------------------------- reconcile -------------------------------- */

// export function classifyIssueReason(message: string): string {
//   if (!message) return "Check Message";
//   const msg = norm(message);
//   if (msg.includes("credit") || msg.includes("hold")) return "Credit / On Hold";
//   if (msg.includes("mismatch")) return "Qty Mismatch";
//   if (msg.includes("not found")) return "Pickticket Not Found";
//   if (msg.includes("failure") || msg.includes("error") || msg.includes("reject")) return "AX Load Failure";
//   return "Other / Review";
// }

// export function reconcileData(
//   dhlData: Record<string, string>[],
//   b2biData: Record<string, string>[],
//   axData: Record<string, string>[]
// ): ReconciliationResult {
//   const dhlShipments = (dhlData as unknown as DHLShipment[]) ?? [];
//   const b2biRecords = (b2biData as unknown as B2BiRecord[]) ?? [];
//   const axRecords = (axData as unknown as AXRecord[]) ?? [];

//   /* Build lookup maps with normalized keys */
//   const b2biMap = new Map<string, B2BiRecord>();
//   for (const r of b2biRecords) {
//     const keys = [
//       cleanKey((r as any).AXReferenceID),
//       cleanKey((r as any).Pickticket),
//       cleanKey((r as any).InvoiceNumber),
//       cleanKey((r as any).ReferenceID),
//     ].filter(Boolean);
//     for (const k of keys) if (k) b2biMap.set(k, r);
//   }

//   const axMap = new Map<string, AXRecord>();
//   for (const r of axRecords) {
//     const keys = [
//       cleanKey((r as any).PickRoute),
//       cleanKey((r as any).Pickticket),
//       cleanKey((r as any).SalesOrder),
//     ].filter(Boolean);
//     for (const k of keys) if (k) axMap.set(k, r);
//   }

//   /* Merge rows (left-join from DHL) */
//   const merged: MergedRecord[] = dhlShipments.map((dhl) => {
//     const ptRaw = (dhl.Pickticket ?? "").toString();
//     const ptKey = cleanKey(ptRaw);

//     let b2bi = b2biMap.get(ptKey);
//     if (!b2bi) {
//       // extra defensive probe (sometimes PTs are prefixed/suffixed)
//       b2bi =
//         b2biRecords.find(
//           (r) =>
//             cleanKey((r as any).AXReferenceID) === ptKey ||
//             cleanKey((r as any).Pickticket) === ptKey ||
//             cleanKey((r as any).InvoiceNumber) === ptKey ||
//             cleanKey((r as any).ReferenceID) === ptKey
//         ) ?? undefined;
//     }

//     let ax = axMap.get(ptKey);
//     if (!ax) {
//       ax =
//         axRecords.find(
//           (r) =>
//             cleanKey((r as any).PickRoute) === ptKey ||
//             cleanKey((r as any).Pickticket) === ptKey ||
//             cleanKey((r as any).SalesOrder) === ptKey
//         ) ?? undefined;
//     }

//     const ediStatus = deriveEdiProcessingStatus(b2bi);


//     return {
//       ...dhl,
//       // Make these explicit & non-failing by default:
//       "Received in EDI?": (b2bi as any)?.InvoiceNumber || "",
//       "EDI Processing Status": ediStatus, // no defaulting to failure

//       "Found in AX?": (ax as any)?.PickRoute || "",
//       SalesHeaderStatus: (ax as any)?.SalesHeaderStatus || "",
//       SalesHeaderDocStatus: (ax as any)?.SalesHeaderDocStatus || "",
//       PickModeOfDelivery: (ax as any)?.PickModeOfDelivery || "",
//       PickCreatedDate: (ax as any)?.PickCreatedDate || "",
//       DeliveryDate: (ax as any)?.DeliveryDate || "",
//     } as MergedRecord;
//   });

//   /* Filter stuck: EXACT rule used by backend
//      - AX doc status is "Picking List"
//      - EDI status is "AX Load Failure"  */
//   const filtered = merged.filter(
//     (m) => norm(m.SalesHeaderDocStatus) === "picking list" && m["EDI Processing Status"] === "AX Load Failure"
//   );

//   /* Deduplicate by Pickticket */
//   const seen = new Set<string>();
//   const deduped = filtered.filter((row) => {
//     const k = cleanKey(row.Pickticket);
//     if (seen.has(k)) return false;
//     seen.add(k);
//     return true;
//   });

//   /* Build UI-friendly stuck shipments */
//   const stuckShipments: StuckShipment[] = deduped.map((rec) => {
//     const issueSummary = rec["Issue Summary"] || classifyIssueReason(rec["EDI Message"]);
//     const ageHrs = calculateAgeHours(rec);
//     const ageBadge = getAgeBadgeInfo(ageHrs);

//     return {
//       ...rec,
//       "Issue Summary": issueSummary,
//       "Age Hours": ageHrs,      // keep original label your table expects
//       AgeHours: ageHrs ?? null, // ALSO emit camelCase for any code path using it
//       "Age Label": ageBadge.label,
//       "Age Badge Class": ageBadge.badgeClass,
//       Severity: ageBadge.severity,
//     } as StuckShipment;
//   });

//   /* Summary + insights */
//   const totalShipments = dhlShipments.length;

//   // Failures = any merged row whose derived EDI status = failure
//   const totalFailures = merged.reduce((acc, m) => acc + (m["EDI Processing Status"] === "AX Load Failure" ? 1 : 0), 0);

//   const totalStuck = stuckShipments.length;

//   const warehouseCounts = new Map<string, number>();
//   for (const s of stuckShipments) {
//     const wh = (s as any).Warehouse || "Unknown";
//     warehouseCounts.set(wh, (warehouseCounts.get(wh) || 0) + 1);
//   }
//   const topWhEntry = [...warehouseCounts.entries()].sort((a, b) => b[1] - a[1])[0];
//   const topWarehouse = topWhEntry ? `${topWhEntry[0]} (${topWhEntry[1]} stuck)` : "—";

//   const reasonCounts = new Map<string, number>();
//   for (const s of stuckShipments) {
//     const reason = s["Issue Summary"] || classifyIssueReason(s["EDI Message"]);
//     reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
//   }
//   const topReasonEntry = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0];
//   const topReason = topReasonEntry ? topReasonEntry[0] : "—";

//   const oldestHours = Math.max(...stuckShipments.map((s) => s["Age Hours"] || 0));
//   const oldestStuck = Number.isFinite(oldestHours) && oldestHours > 0 ? `${Math.round(oldestHours)}h` : "—";

//   return {
//     summary: { totalShipments, totalFailures, totalStuck },
//     insights: { topWarehouse, topReason, oldestStuck },
//     stuckShipments,
//     fullData: merged,
//   };
// }

// /* --------------------------- email draft unchanged --------------------------- */

// export function generateEmailDraft(stuckShipments: StuckShipment[], warehouse: string): string {
//   const filtered =
//     warehouse === "All Warehouses" ? stuckShipments : stuckShipments.filter((s) => (s as any).Warehouse === warehouse);

//   if (filtered.length === 0) {
//     return "No stuck shipments for that selection.";
//   }

//   const count = filtered.length;
//   const oldestAge = Math.max(...filtered.map((s) => (s["Age Hours"] as number) || 0));
//   const oldestLabel = Number.isFinite(oldestAge) && oldestAge > 0 ? `${Math.round(oldestAge)}h` : "Unknown";

//   const reasonCounts = new Map<string, number>();
//   filtered.forEach((s) => {
//     const reason = s["Issue Summary"] || classifyIssueReason(s["EDI Message"]);
//     reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
//   });
//   const mainReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

//   const picktickets = filtered
//     .slice(0, 10)
//     .map((s) => s.Pickticket)
//     .join(", ");
//   const pickList = filtered.length > 10 ? `${picktickets}, ...` : picktickets;

//   const subject = `ACTION REQUIRED — ${count} stuck 945s (${warehouse}, oldest ${oldestLabel})`;

//   const body = `Team,

// The following shipments physically departed the warehouse but have not successfully posted in AX
// and have not generated customer confirmation.

// Warehouse: ${warehouse}
// Impact Count: ${count}
// Primary Failure Reason: ${mainReason}
// Oldest Open Shipment Age: ${oldestLabel}

// These orders are at risk of:
// • customer escalation ("Where is my shipment?")
// • delayed invoicing / revenue posting

// Picktickets impacted:
// ${pickList}

// Please review and re-process these 945s in AX / B2Bi.

// Thanks,
// Reconciliation Dashboard`;

//   return `Subject: ${subject}\n\n${body}`;
// }


// import type {
//   DHLShipment,
//   B2BiRecord,
//   AXRecord,
//   MergedRecord,
//   StuckShipment,
//   ReconciliationResult,
// } from "../types";


// /* ---------- Issue classification driven by EDI Processing Status ---------- */
// function classifyFromStatus(status: string | undefined): string {
//   if (!status) return "Check Message";
//   const s = status.toLowerCase();
//   if (s.includes("ax load failure") || s.includes("failure")) return "AX Load Failure";
//   if (s.includes("accept")) return "Accepted";
//   if (s.includes("pending") || s.includes("in progress")) return "Pending";
//   return "Check Message";
// }

// /* ---------- Age calc (same as before) ---------- */
// export function calculateAgeHours(row: MergedRecord | StuckShipment): number | null {
//   const now = new Date();
//   for (const col of ["Ship Date", "PickCreatedDate"] as const) {
//     const value = row[col];
//     if (value) {
//       try {
//         const dateStr = String(value);
//         let dt: Date;
//         if (dateStr.includes("/")) {
//           const [mm, dd, yy] = dateStr.split("/");
//           const fullYear = yy.length === 2 ? `20${yy}` : yy;
//           dt = new Date(parseInt(fullYear), parseInt(mm) - 1, parseInt(dd));
//         } else {
//           dt = new Date(dateStr);
//         }
//         if (!isNaN(dt.getTime())) {
//           return (now.getTime() - dt.getTime()) / (1000 * 60 * 60);
//         }
//       } catch {
//         /* ignore and try next */
//       }
//     }
//   }
//   return null;
// }

// export function getAgeBadgeInfo(ageHours: number | null): {
//   label: string;
//   badgeClass: string;
//   severity: "low" | "medium" | "high" | "unknown";
// } {
//   if (ageHours === null) {
//     return { label: "Unknown", badgeClass: "badge-neutral", severity: "unknown" };
//   }
//   if (ageHours < 4) return { label: `Fresh (${Math.round(ageHours)}h)`, badgeClass: "badge-success", severity: "low" };
//   if (ageHours < 24) return { label: `Watch (${Math.round(ageHours)}h)`, badgeClass: "badge-warning", severity: "medium" };
//   return { label: `Escalate (${Math.round(ageHours)}h)`, badgeClass: "badge-danger", severity: "high" };
// }

// /* ---------- Small helpers ---------- */
// const trimEq = (a?: string, b?: string) => (a?.trim() || "") === (b?.trim() || "");

// /* ---------- Reconciler ---------- */
// export function reconcileData(
//   dhlData: Record<string, string>[],
//   b2biData: Record<string, string>[],
//   axData: Record<string, string>[]
// ): ReconciliationResult {
//   const dhlShipments = dhlData as unknown as DHLShipment[];
//   const b2biRecords = b2biData as unknown as B2BiRecord[];
//   const axRecords = axData as unknown as AXRecord[];

//   // Build maps for faster lookup
//   const b2biMap = new Map<string, B2BiRecord>();
//   for (const r of b2biRecords) {
//     const keys = [r.AXReferenceID, (r as any).Pickticket, (r as any).InvoiceNumber, (r as any).ReferenceID]
//       .map((k) => (k ? String(k).trim() : ""))
//       .filter(Boolean);
//     for (const k of keys) if (!b2biMap.has(k)) b2biMap.set(k, r);
//   }

//   const axMap = new Map<string, AXRecord>();
//   for (const r of axRecords) {
//     const keys = [r.PickRoute, (r as any).Pickticket, (r as any).SalesOrder]
//       .map((k) => (k ? String(k).trim() : ""))
//       .filter(Boolean);
//     for (const k of keys) if (!axMap.has(k)) axMap.set(k, r);
//   }

//   // Merge row-by-row using Pickticket as primary key
//   const merged: MergedRecord[] = dhlShipments.map((dhl) => {
//     const pt = dhl.Pickticket?.trim();
//     const b2bi =
//       (pt && b2biMap.get(pt)) ||
//       b2biRecords.find(
//         (r) =>
//           trimEq(r.AXReferenceID, pt) ||
//           trimEq((r as any).Pickticket, pt) ||
//           trimEq((r as any).InvoiceNumber, pt) ||
//           trimEq((r as any).ReferenceID, pt)
//       );

//     const ax =
//       (pt && axMap.get(pt)) ||
//       axRecords.find(
//         (r) => trimEq(r.PickRoute, pt) || trimEq((r as any).Pickticket, pt) || trimEq((r as any).SalesOrder, pt)
//       );

//     // Derive a single status string we trust
//     const ediStatus =
//       (b2bi as any)?.StatusSummary ||
//       (b2bi as any)?.Status ||
//       (b2bi as any)?.ProcessingStatus ||
//       "AX Load Failure"; // sane default for stuck audit demos

//     return {
//       ...dhl,

//       // Keep these two only (remove EDI Message everywhere)
//       "Received in EDI?": (b2bi as any)?.InvoiceNumber || "",
//       "EDI Processing Status": ediStatus,

//       // AX fields
//       "Found in AX?": ax?.PickRoute || "",
//       SalesHeaderStatus: (ax as any)?.SalesHeaderStatus || "",
//       SalesHeaderDocStatus: (ax as any)?.SalesHeaderDocStatus || "",
//       PickModeOfDelivery: (ax as any)?.PickModeOfDelivery || "",
//       PickCreatedDate: (ax as any)?.PickCreatedDate || "",
//       DeliveryDate: (ax as any)?.DeliveryDate || "",
//     } as MergedRecord;
//   });

//   // Stuck definition: AX doc status = Picking List AND EDI status indicates failure
//   const filtered = merged.filter((m) => {
//     const docIsPicking = (m.SalesHeaderDocStatus || "").toLowerCase() === "picking list";
//     const status = (m["EDI Processing Status"] || "").toLowerCase();
//     const isFailure = status.includes("failure") || status.includes("ax load failure");
//     return docIsPicking && isFailure;
//   });

//   // De-duplicate by Pickticket
//   const seen = new Set<string>();
//   const dedup = filtered.filter((r) => {
//     const key = String(r.Pickticket || "").trim();
//     if (!key) return false;
//     if (seen.has(key)) return false;
//     seen.add(key);
//     return true;
//   });

//   // Decorate stuck shipments for UI
//   const stuckShipments: StuckShipment[] = dedup.map((r) => {
//     const age = calculateAgeHours(r);
//     const ageBadge = getAgeBadgeInfo(age);
//     const reason = classifyFromStatus(r["EDI Processing Status"]);

//     return {
//       ...r,
//       "Issue Summary": reason,
//       "Age Hours": age,
//       "Age Label": ageBadge.label,
//       "Age Badge Class": ageBadge.badgeClass,
//       Severity: ageBadge.severity,
//     } as StuckShipment;
//   });

//   // Summary & insights
//   const totalShipments = dhlShipments.length;
//   const totalFailures = merged.filter((m) =>
//     String(m["EDI Processing Status"] || "").toLowerCase().includes("failure")
//   ).length;
//   const totalStuck = stuckShipments.length;

//   const warehouseCounts = new Map<string, number>();
//   for (const s of stuckShipments) {
//     const wh = (s as any).Warehouse || "Unknown";
//     warehouseCounts.set(wh, (warehouseCounts.get(wh) || 0) + 1);
//   }
//   const topWh = [...warehouseCounts.entries()].sort((a, b) => b[1] - a[1])[0];
//   const topWarehouse = topWh ? `${topWh[0]} (${topWh[1]} stuck)` : "—";

//   const reasonCounts = new Map<string, number>();
//   for (const s of stuckShipments) {
//     const r = s["Issue Summary"] || classifyFromStatus(s["EDI Processing Status"]);
//     reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1);
//   }
//   const topReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

//   const oldestHours = Math.max(...stuckShipments.map((s) => s["Age Hours"] || 0));
//   const oldestStuck = oldestHours > 0 ? `${Math.round(oldestHours)}h` : "—";

//   return {
//     summary: { totalShipments, totalFailures, totalStuck },
//     insights: { topWarehouse, topReason, oldestStuck },
//     stuckShipments,
//     fullData: merged, // still useful for exports
//   };
// }

// /* ---------- Ticket draft (unchanged, but no EDI Message dependency) ---------- */
// export function generateEmailDraft(stuckShipments: StuckShipment[], warehouse: string): string {
//   const filtered =
//     warehouse === "All Warehouses" ? stuckShipments : stuckShipments.filter((s) => (s as any).Warehouse === warehouse);

//   if (filtered.length === 0) return "No stuck shipments for that selection.";

//   const count = filtered.length;
//   const oldestAge = Math.max(...filtered.map((s) => s["Age Hours"] || 0));
//   const oldestLabel = oldestAge > 0 ? `${Math.round(oldestAge)}h` : "Unknown";

//   const reasonCounts = new Map<string, number>();
//   filtered.forEach((s) => {
//     const r = s["Issue Summary"] || classifyFromStatus(s["EDI Processing Status"]);
//     reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1);
//   });
//   const mainReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

//   const picktickets = filtered.slice(0, 10).map((s) => s.Pickticket).join(", ");
//   const pickList = filtered.length > 10 ? `${picktickets}, ...` : picktickets;

//   const subject = `ACTION REQUIRED — ${count} stuck 945s (${warehouse}, oldest ${oldestLabel})`;

//   const body = `Team,

// The following shipments physically departed the warehouse but have not successfully posted in AX
// and have not generated customer confirmation.

// Warehouse: ${warehouse}
// Impact Count: ${count}
// Primary Failure Reason: ${mainReason}
// Oldest Open Shipment Age: ${oldestLabel}

// These orders are at risk of:
// • customer escalation ("Where is my shipment?")
// • delayed invoicing / revenue posting

// Picktickets impacted:
// ${pickList}

// Please review and re-process these 945s in AX / B2Bi.

// Thanks,
// Reconciliation Dashboard`;

//   return `Subject: ${subject}\n\n${body}`;
// }


import type {
  DHLShipment,
  B2BiRecord,
  AXRecord,
  MergedRecord,
  StuckShipment,
  ReconciliationResult,
} from "../types";

/* ---------- Issue classification driven by EDI Processing Status ---------- */
function classifyFromStatus(status: string | undefined): string {
  if (!status) return "Check Message";
  const s = status.toLowerCase();
  if (s.includes("ax load failure") || s.includes("failure")) return "AX Load Failure";
  if (s.includes("accept")) return "Accepted";
  if (s.includes("pending") || s.includes("in progress")) return "Pending";
  return "Check Message";
}

/* ---------- Age calculation ---------- */
export function calculateAgeHours(row: MergedRecord | StuckShipment): number | null {
  const now = new Date();
  for (const col of ["Ship Date", "PickCreatedDate"] as const) {
    const value = row[col];
    if (value) {
      try {
        const dateStr = String(value);
        let dt: Date;
        if (dateStr.includes("/")) {
          const [mm, dd, yy] = dateStr.split("/");
          const fullYear = yy.length === 2 ? `20${yy}` : yy;
          dt = new Date(parseInt(fullYear), parseInt(mm) - 1, parseInt(dd));
        } else {
          dt = new Date(dateStr);
        }
        if (!isNaN(dt.getTime())) {
          return (now.getTime() - dt.getTime()) / (1000 * 60 * 60);
        }
      } catch {
        /* ignore and try next */
      }
    }
  }
  return null;
}

export function getAgeBadgeInfo(ageHours: number | null): {
  label: string;
  badgeClass: string;
  severity: "low" | "medium" | "high" | "unknown";
} {
  if (ageHours === null) {
    return { label: "Unknown", badgeClass: "badge-neutral", severity: "unknown" };
  }
  if (ageHours < 4) return { label: `Fresh (${Math.round(ageHours)}h)`, badgeClass: "badge-success", severity: "low" };
  if (ageHours < 24) return { label: `Watch (${Math.round(ageHours)}h)`, badgeClass: "badge-warning", severity: "medium" };
  return { label: `Escalate (${Math.round(ageHours)}h)`, badgeClass: "badge-danger", severity: "high" };
}

/* ---------- Helpers ---------- */
const trimEq = (a?: string, b?: string) => (a?.trim() || "") === (b?.trim() || "");

/** Extract a meaningful EDI error message (for export). */
function extractB2BiErrorMessage(rec: any): string {
  if (!rec) return "";
  const candidateFields = [
    "ERRORDESCRIPTION",
    "ERROR_DESCRIPTION",
    "Error Description",
    "ErrorMsg",
    "Message",
    "StatusMessage",
    "Description",
    "FAILURE_REASON",
    "STATUS_MESSAGE",
    "EDI Message",
  ];
  for (const f of candidateFields) {
    const v = rec?.[f];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  // Heuristic sweep for error-looking strings
  for (const [, v] of Object.entries(rec)) {
    if (
      typeof v === "string" &&
      v.trim().length > 10 &&
      /error|fail|reject|invalid|missing|not\s+found|hold/i.test(v)
    ) {
      return v.trim();
    }
  }
  return "";
}

/* ---------- Reconciler ---------- */
export function reconcileData(
  dhlData: Record<string, string>[],
  b2biData: Record<string, string>[],
  axData: Record<string, string>[]
): ReconciliationResult {
  const dhlShipments = dhlData as unknown as DHLShipment[];
  const b2biRecords = b2biData as unknown as B2BiRecord[];
  const axRecords = axData as unknown as AXRecord[];

  // Fast lookup maps
  const b2biMap = new Map<string, B2BiRecord>();
  for (const r of b2biRecords) {
    const keys = [r.AXReferenceID, (r as any).Pickticket, (r as any).InvoiceNumber, (r as any).ReferenceID]
      .map((k) => (k ? String(k).trim() : ""))
      .filter(Boolean);
    for (const k of keys) if (!b2biMap.has(k)) b2biMap.set(k, r);
  }

  const axMap = new Map<string, AXRecord>();
  for (const r of axRecords) {
    const keys = [r.PickRoute, (r as any).Pickticket, (r as any).SalesOrder]
      .map((k) => (k ? String(k).trim() : ""))
      .filter(Boolean);
    for (const k of keys) if (!axMap.has(k)) axMap.set(k, r);
  }

  // Merge everything row-by-row using Pickticket as the primary key
  const merged: MergedRecord[] = dhlShipments.map((dhl) => {
    const pt = dhl.Pickticket?.trim();

    const b2bi =
      (pt && b2biMap.get(pt)) ||
      b2biRecords.find(
        (r) =>
          trimEq(r.AXReferenceID, pt) ||
          trimEq((r as any).Pickticket, pt) ||
          trimEq((r as any).InvoiceNumber, pt) ||
          trimEq((r as any).ReferenceID, pt)
      );

    const ax =
      (pt && axMap.get(pt)) ||
      axRecords.find(
        (r) => trimEq(r.PickRoute, pt) || trimEq((r as any).Pickticket, pt) || trimEq((r as any).SalesOrder, pt)
      );

    // Trusted single status string
    const ediStatus =
      (b2bi as any)?.StatusSummary ||
      (b2bi as any)?.Status ||
      (b2bi as any)?.ProcessingStatus ||
      "AX Load Failure";

    // Keep the message for export only
    const ediMessage = extractB2BiErrorMessage(b2bi);

    return {
      ...dhl,
      "Received in EDI?": (b2bi as any)?.InvoiceNumber || "",
      "EDI Processing Status": ediStatus,
      "EDI Message": ediMessage, // <- included so exports have it
      "Found in AX?": ax?.PickRoute || "",
      SalesHeaderStatus: (ax as any)?.SalesHeaderStatus || "",
      SalesHeaderDocStatus: (ax as any)?.SalesHeaderDocStatus || "",
      PickModeOfDelivery: (ax as any)?.PickModeOfDelivery || "",
      PickCreatedDate: (ax as any)?.PickCreatedDate || "",
      DeliveryDate: (ax as any)?.DeliveryDate || "",
    } as MergedRecord;
  });

  // Stuck definition: Picking List in AX + EDI failure
  const filtered = merged.filter((m) => {
    const docIsPicking = (m.SalesHeaderDocStatus || "").toLowerCase() === "picking list";
    const status = (m["EDI Processing Status"] || "").toLowerCase();
    const isFailure = status.includes("failure") || status.includes("ax load failure");
    return docIsPicking && isFailure;
  });

  // De-dup by Pickticket
  const seen = new Set<string>();
  const dedup = filtered.filter((r) => {
    const key = String(r.Pickticket || "").trim();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Decorate records for UI (UI won’t render "EDI Message", but it remains on the object for export)
  const stuckShipments: StuckShipment[] = dedup.map((r) => {
    const age = calculateAgeHours(r);
    const ageBadge = getAgeBadgeInfo(age);
    const reason = classifyFromStatus(r["EDI Processing Status"]);

    return {
      ...r,
      "Issue Summary": reason,
      "Age Hours": age,
      "Age Label": ageBadge.label,
      "Age Badge Class": ageBadge.badgeClass,
      Severity: ageBadge.severity,
      "EDI Message": (r as any)["EDI Message"] || "", // keep for exports
    } as StuckShipment;
  });

  // Summary & insights
  const totalShipments = dhlShipments.length;
  const totalFailures = merged.filter((m) =>
    String(m["EDI Processing Status"] || "").toLowerCase().includes("failure")
  ).length;
  const totalStuck = stuckShipments.length;

  const warehouseCounts = new Map<string, number>();
  for (const s of stuckShipments) {
    const wh = (s as any).Warehouse || "Unknown";
    warehouseCounts.set(wh, (warehouseCounts.get(wh) || 0) + 1);
  }
  const topWh = [...warehouseCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topWarehouse = topWh ? `${topWh[0]} (${topWh[1]} stuck)` : "—";

  const reasonCounts = new Map<string, number>();
  for (const s of stuckShipments) {
    const r = s["Issue Summary"] || classifyFromStatus(s["EDI Processing Status"]);
    reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1);
  }
  const topReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const oldestHours = Math.max(...stuckShipments.map((s) => s["Age Hours"] || 0));
  const oldestStuck = oldestHours > 0 ? `${Math.round(oldestHours)}h` : "—";

  return {
    summary: { totalShipments, totalFailures, totalStuck },
    insights: { topWarehouse, topReason, oldestStuck },
    stuckShipments,
    fullData: merged, // exports can use this too
  };
}

/* ---------- Ticket draft ---------- */
export function generateEmailDraft(stuckShipments: StuckShipment[], warehouse: string): string {
  const filtered =
    warehouse === "All Warehouses" ? stuckShipments : stuckShipments.filter((s) => (s as any).Warehouse === warehouse);

  if (filtered.length === 0) return "No stuck shipments for that selection.";

  const count = filtered.length;
  const oldestAge = Math.max(...filtered.map((s) => s["Age Hours"] || 0));
  const oldestLabel = oldestAge > 0 ? `${Math.round(oldestAge)}h` : "Unknown";

  const reasonCounts = new Map<string, number>();
  filtered.forEach((s) => {
    const r = s["Issue Summary"] || classifyFromStatus(s["EDI Processing Status"]);
    reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1);
  });
  const mainReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const picktickets = filtered.slice(0, 10).map((s) => s.Pickticket).join(", ");
  const pickList = filtered.length > 10 ? `${picktickets}, ...` : picktickets;

  const subject = `ACTION REQUIRED — ${count} stuck 945s (${warehouse}, oldest ${oldestLabel})`;

  const body = `Team,

The following shipments physically departed the warehouse but have not successfully posted in AX
and have not generated customer confirmation.

Warehouse: ${warehouse}
Impact Count: ${count}
Primary Failure Reason: ${mainReason}
Oldest Open Shipment Age: ${oldestLabel}

These orders are at risk of:
• customer escalation ("Where is my shipment?")
• delayed invoicing / revenue posting

Picktickets impacted:
${pickList}

Please review and re-process these 945s in AX / B2Bi.

Thanks,
Reconciliation Dashboard`;

  return `Subject: ${subject}\n\n${body}`;
}
