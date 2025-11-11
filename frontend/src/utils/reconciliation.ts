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
