// src/services/reports.ts
export type Snapshot = {
  snapshotDate: string; // 'YYYY-MM-DD'
  summary: any;
  insights: any;
  byWarehouse: Array<{ warehouse: string; stuckCount: number; avgAgeHrs: number; failureRatePct: number }>;
};

const API_BASE =
  import.meta.env.VITE_API_BASE_LAMBDA ??
  "https://ax37hcnoga.execute-api.us-east-1.amazonaws.com/prod";

export async function saveSnapshotAPI(payload: Snapshot) {
  const res = await fetch(`${API_BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function loadRecentAPI(days = 7): Promise<Snapshot[]> {
  try {
    const res = await fetch(`${API_BASE}/reports/recent?days=${days}`, {
      cache: "no-store", // avoid cached responses
    });
    if (!res.ok) throw new Error(await res.text());
    const raw = await res.json();

    // Normalize and keep only rows with a valid YYYY-MM-DD
    const cleaned: Snapshot[] = (Array.isArray(raw) ? raw : [])
      .map((row: any) => {
        const snapshotDate =
          (typeof row?.snapshotDate === "string" && row.snapshotDate.slice(0,10)) ||
          (typeof row?.date === "string" && row.date.slice(0,10)) ||
          (typeof row?.snapshot_date === "string" && row.snapshot_date.slice(0,10)) ||
          null;

        if (!snapshotDate) return null;

        const t = new Date(`${snapshotDate}T00:00:00Z`).getTime();
        if (Number.isNaN(t)) return null;

        return {
          snapshotDate,
          summary: row?.summary ?? {},
          insights: row?.insights ?? {},
          byWarehouse: Array.isArray(row?.byWarehouse) ? row.byWarehouse : [],
        } as Snapshot;
      })
      .filter(Boolean) as Snapshot[];

    // Dedupe on date (keep last), sort ascending, clamp to last N
    const dedup = Object.values(
      cleaned.reduce((acc: Record<string, Snapshot>, cur) => {
        acc[cur.snapshotDate] = cur;
        return acc;
      }, {})
    ).sort(
      (a, b) =>
        new Date(`${a.snapshotDate}T00:00:00Z`).getTime() -
        new Date(`${b.snapshotDate}T00:00:00Z`).getTime()
    );

    return dedup.slice(-days);
  } catch (error) {
    console.error("Error loading history:", error);
    return [];
  }
}
