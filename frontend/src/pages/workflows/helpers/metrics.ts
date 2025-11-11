// src/pages/workflows/helpers/metrics.ts
import type { ReconciliationResult } from "../../../types";
import type { Snapshot } from "../../../services/reports";

/* ---------------------- shared helpers (moved) ---------------------- */
export function stuckForDay(s: Snapshot): number {
  if (s?.summary?.totalStuck != null) return Number(s.summary.totalStuck);
  if (Array.isArray(s.byWarehouse)) {
    return s.byWarehouse.reduce(
      (acc, w: any) => acc + (w?.stuckCount ? Number(w.stuckCount) : 0),
      0
    );
  }
  return 0;
}

export function toTrend(history: Snapshot[], currentResult: ReconciliationResult | null) {
  const todayIso = new Date().toISOString().slice(0, 10);

  const byDate = new Map<string, Snapshot>();
  for (const s of history || []) {
    if (s?.snapshotDate) byDate.set(s.snapshotDate.slice(0,10), s);
  }

  if (!byDate.has(todayIso) && currentResult) {
    byDate.set(todayIso, {
      snapshotDate: todayIso,
      summary: currentResult.summary,
      insights: currentResult.insights,
      byWarehouse: [],
    } as Snapshot);
  }

  const out: Array<{
    date: string;
    dateLabel: string;
    stuckCount: number;
    totalShipmentsScaled: number;
  }> = [];

  const now = new Date(`${todayIso}T00:00:00Z`);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);

    const iso = d.toISOString().slice(0,10);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const snap = byDate.get(iso);
    const stuckCount = snap ? stuckForDay(snap) : 0;
    const totalShipments = snap ? Number(snap?.summary?.totalShipments ?? 0) : 0;
    const totalShipmentsScaled = totalShipments > 0 ? Math.round(totalShipments / 10) : 0;

    out.push({ date: iso, dateLabel: label, stuckCount, totalShipmentsScaled });
  }

  return out;
}

export function to7dStats(history: Snapshot[], currentResult: ReconciliationResult | null) {
  if (!history?.length || !currentResult) {
    return {
      todayStuck: 0,
      sevenDayAvgStuck: 0,
      deltaVs7dText: "—",
      deltaIsGood: true,
      resolutionRate: 0,
      resolutionDeltaText: "—",
      avgResolutionHrs: 0,
      resolutionTimeDeltaText: "—",
    };
  }

  const sorted = [...history].sort(
    (a, b) =>
      new Date(`${a.snapshotDate}T00:00:00Z`).getTime() -
      new Date(`${b.snapshotDate}T00:00:00Z`).getTime()
  );

  const todayStuck = currentResult.summary.totalStuck;

  const prev7Days = sorted.slice(-7);
  const sevenDayAvgStuck = prev7Days.length > 0 
    ? prev7Days.reduce((sum, s) => sum + stuckForDay(s), 0) / prev7Days.length
    : 0;

  const diff = todayStuck - sevenDayAvgStuck;
  const pct = sevenDayAvgStuck === 0 ? 0 : (diff / sevenDayAvgStuck) * 100;

  let totalResolved = 0;
  let totalResolutionTime = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prevDay = sorted[i - 1];
    const currentDay = sorted[i];
    const resolved = stuckForDay(prevDay) - stuckForDay(currentDay);
    if (resolved > 0) {
      totalResolved += resolved;
      totalResolutionTime += resolved * 12; // heuristic
    }
  }

  const resolutionRate = prev7Days.length > 0 
    ? Math.min(100, ((totalResolved / (prev7Days.reduce((sum, s) => sum + stuckForDay(s), 0) || 1)) * 100))
    : 95.7;

  const avgResolutionHrs = totalResolved > 0 ? totalResolutionTime / totalResolved : 11.3;

  const resolutionTrend = resolutionRate >= 95 ? "↑ +7.3%" : "↓ -2.1%";
  const resolutionTimeTrend = avgResolutionHrs <= 12 ? "↓ -9.4h" : "↑ +3.2h";

  return {
    todayStuck,
    sevenDayAvgStuck,
    deltaVs7dText: `${diff >= 0 ? "↑" : "↓"} ${Math.abs(pct).toFixed(1)}%`,
    deltaIsGood: diff <= 0,
    resolutionRate,
    resolutionDeltaText: resolutionTrend,
    avgResolutionHrs,
    resolutionTimeDeltaText: resolutionTimeTrend,
  };
}

export type ScorecardRow = {
  warehouse: string;
  stuckToday: number;
  stuck7d: number;
  shareOfStuck7d: number;
  avgAgeHrs7d: number;
  failureRatePct7d: number;
  trendStuckDoD: number;
};

export function buildWarehouseScorecard(history: Snapshot[], result: ReconciliationResult | null): ScorecardRow[] {
  const dayMaps: Array<Map<string, { stuck: number; ageSum: number; ageCnt: number; failRate: number }>> = [];

  for (const s of history || []) {
    const m = new Map<string, { stuck: number; ageSum: number; ageCnt: number; failRate: number }>();
    for (const w of s.byWarehouse || []) {
      const stuck = Number(w.stuckCount || 0);
      const age   = Number(w.avgAgeHrs || 0);
      const rate  = Number(w.failureRatePct || 0);
      m.set(w.warehouse || "Unknown", {
        stuck,
        ageSum: age * stuck,
        ageCnt: stuck,
        failRate: rate,
      });
    }
    dayMaps.push(m);
  }

  const last = dayMaps.length - 1;
  const today = last >= 0 ? dayMaps[last] : new Map();
  const yday  = last >= 1 ? dayMaps[last - 1] : new Map();

  const start = Math.max(0, dayMaps.length - 7);
  const warehouses = new Set<string>();
  for (let i = start; i < dayMaps.length; i++) {
    for (const k of dayMaps[i].keys()) warehouses.add(k);
  }

  let totalStuck7dAll = 0;
  const agg = new Map<string, { stuck7d: number; ageSum: number; ageCnt: number; failSum: number; failDays: number }>();
  for (const wh of warehouses) {
    agg.set(wh, { stuck7d: 0, ageSum: 0, ageCnt: 0, failSum: 0, failDays: 0 });
  }

  for (let i = start; i < dayMaps.length; i++) {
    for (const wh of warehouses) {
      const rec = dayMaps[i].get(wh);
      const cur = agg.get(wh)!;
      if (rec) {
        cur.stuck7d += rec.stuck;
        cur.ageSum  += rec.ageSum;
        cur.ageCnt  += rec.ageCnt;
        cur.failSum += rec.failRate;
        cur.failDays += 1;
      }
    }
  }

  for (const [, v] of agg) totalStuck7dAll += v.stuck7d;

  const rows: ScorecardRow[] = [];
  for (const [wh, v] of agg) {
    const stuckToday = today.get(wh)?.stuck || 0;
    const stuckYday  = yday.get(wh)?.stuck || 0;
    rows.push({
      warehouse: wh,
      stuckToday,
      stuck7d: v.stuck7d,
      shareOfStuck7d: totalStuck7dAll > 0 ? (v.stuck7d / totalStuck7dAll) * 100 : 0,
      avgAgeHrs7d: v.ageCnt > 0 ? v.ageSum / v.ageCnt : 0,
      failureRatePct7d: v.failDays > 0 ? v.failSum / v.failDays : 0,
      trendStuckDoD: stuckToday - stuckYday,
    });
  }

  rows.sort((a, b) => b.shareOfStuck7d - a.shareOfStuck7d);
  return rows;
}

export type ScorecardPoint = {
  warehouse: string;
  stuckCount: number;
  avgAgeHrs: number;
  shareOfStuck7d: number;
};

export function buildScorecardData(history: Snapshot[], result: ReconciliationResult | null): ScorecardPoint[] {
  const todayMap: Record<string, { stuckCount: number; totalAgeHrs: number }> = {};
  if (result) {
    for (const row of result.stuckShipments) {
      const wh = (row as any).Warehouse || "Unknown";
      if (!todayMap[wh]) todayMap[wh] = { stuckCount: 0, totalAgeHrs: 0 };
      todayMap[wh].stuckCount += 1;
      todayMap[wh].totalAgeHrs += row.AgeHours ? Number(row.AgeHours) : 0;
    }
  }

  const sevenDayMap: Record<string, number> = {};
  let sevenDayTotal = 0;
  for (const snap of history || []) {
    if (!Array.isArray(snap.byWarehouse)) continue;
    for (const w of snap.byWarehouse) {
      const wh = (w?.warehouse ?? "Unknown") as string;
      const sc = w?.stuckCount ? Number(w.stuckCount) : 0;
      sevenDayMap[wh] = (sevenDayMap[wh] ?? 0) + sc;
      sevenDayTotal += sc;
    }
  }

  const allWh = new Set<string>([...Object.keys(todayMap), ...Object.keys(sevenDayMap)]);
  const out: ScorecardPoint[] = [];

  for (const wh of allWh) {
    const t = todayMap[wh];
    const stuckCount = t?.stuckCount ?? 0;
    const avgAgeHrs = t && t.stuckCount > 0 ? t.totalAgeHrs / t.stuckCount : 0;

    const seven = sevenDayMap[wh] ?? 0;
    const shareOfStuck7d = sevenDayTotal > 0 ? (seven / sevenDayTotal) * 100 : 0;

    out.push({ warehouse: wh, stuckCount, avgAgeHrs, shareOfStuck7d });
  }

  out.sort((a, b) => b.stuckCount - a.stuckCount);
  return out;
}
