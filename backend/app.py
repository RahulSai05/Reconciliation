import io
import os
import json
import base64
import datetime
from typing import Any, Dict, List
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Response, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse




# -----------------------------------------------------------------------------
# FastAPI + CORS
# -----------------------------------------------------------------------------
app = FastAPI(title="Missing 945 API", version="1.1.1")

if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    from mangum import Mangum
    handler = Mangum(app)
    
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


# -----------------------------------------------------------------------------
# Utility helpers
# -----------------------------------------------------------------------------
def load_csv_bytes(b: bytes) -> pd.DataFrame:
    """
    Read CSV from uploaded bytes with robust, dependency-optional encoding handling.
    - Tries optional chardet guess if available (no hard dependency).
    - Tries a list of common encodings.
    - Final fallback uses python engine with sep autodetect (no low_memory).
    """
    enc_candidates = []

    # Optional encoding sniff (won't fail if chardet isn't installed)
    try:
        import chardet  # type: ignore
        guess = (chardet.detect(b[:4000]) or {}).get("encoding")
        if guess:
            enc_candidates.append(guess)
    except Exception:
        pass

    # Common encodings to try next
    enc_candidates += ["utf-8", "utf-8-sig", "utf-16", "cp1252", "latin1"]

    last_err = None
    for enc in enc_candidates:
        try:
            return pd.read_csv(io.BytesIO(b), encoding=enc, low_memory=False)
        except Exception as e:
            last_err = e

    # Final, very forgiving fallback (no low_memory with python engine)
    try:
        return pd.read_csv(io.BytesIO(b), encoding="latin1", engine="python", sep=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV read error: {e or last_err}")


def get_col(df: pd.DataFrame, name: str) -> str:
    """Get a column name case-insensitively."""
    low = {c.lower().strip(): c for c in df.columns}
    key = name.lower().strip()
    if key not in low:
        raise HTTPException(status_code=400, detail=f"Missing column '{name}'. Available: {list(df.columns)}")
    return low[key]

def df_to_xlsx_bytes(df: pd.DataFrame, sheet_name: str = "Sheet1") -> bytes:
    """Convert a DataFrame to Excel bytes."""
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name=sheet_name)
    buf.seek(0)
    return buf.getvalue()

def df_records_safe(df: pd.DataFrame, limit: int = 30):
    """
    Produce JSON-serializable records from a DataFrame:
    - Replace +/-inf with NaN
    - Use pandas to_json so NaN/NaT -> null and datetimes -> ISO
    """
    safe = df.replace([np.inf, -np.inf], np.nan)
    return json.loads(safe.head(limit).to_json(orient="records", date_format="iso"))

# -----------------------------------------------------------------------------
# Local snapshot store for /reports (used by your frontend history)
# -----------------------------------------------------------------------------
SNAPSHOT_FILE = os.path.join(os.path.dirname(__file__), "snapshots.json")

def _load_snapshots() -> List[Dict[str, Any]]:
    if not os.path.exists(SNAPSHOT_FILE):
        return []
    try:
        with open(SNAPSHOT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def _save_snapshots(items: List[Dict[str, Any]]) -> None:
    with open(SNAPSHOT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@app.get("/")
def home():
    return {"message": "✅ API is live and working!"}

# -----------------------------------------------------------------------------
# Explicit preflight for older setups (optional but harmless)
# -----------------------------------------------------------------------------
@app.options("/ship-confirmation-reconciliation")
def options_ship():
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

@app.options("/delivery-confirmation")
def options_delivery():
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

# -----------------------------------------------------------------------------
# Ship Confirmation Reconciliation (existing)
# -----------------------------------------------------------------------------
@app.post("/ship-confirmation-reconciliation")
async def reconcile(
    shipment_history: UploadFile = File(..., description="Shipment_History___Total-*.csv"),
    edib2bi: UploadFile = File(..., description="EDIB2BiReportV2*.csv"),
    edi940: UploadFile = File(..., description="EDI940Report_withCostV2.0*.csv"),
):
    df1 = load_csv_bytes(await shipment_history.read())
    df2 = load_csv_bytes(await edib2bi.read())
    df3 = load_csv_bytes(await edi940.read())

    for df in [df1, df2, df3]:
        df.columns = df.columns.astype(str).str.strip()

    required = [
        ("Shipment_History___Total", df1, "Pickticket"),
        ("EDIB2BiReportV2", df2, "AXReferenceID"),
        ("EDI940Report_withCostV2.0", df3, "PickRoute"),
    ]
    for name, df, col in required:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Missing column '{col}' in {name}. Available: {list(df.columns)}")

    merged_df = pd.merge(df1, df2, how='left', left_on='Pickticket', right_on='AXReferenceID')
    merged_df.columns = merged_df.columns.str.strip()

    merged_df = merged_df[[c for c in [
        'Warehouse', 'Pickticket', 'Order', 'Drop Date', 'Ship Date', 'Ship To',
        'Ship State', 'Zip Code', 'Customer PO', 'Ship Via', 'Load ID', 'Weight',
        'SKU', 'Units', 'Price', 'Size Type', 'Size', 'Product Type',
        'InvoiceNumber', 'StatusSummary', 'ERRORDESCRIPTION'
    ] if c in merged_df.columns]]

    final_merge_df = pd.merge(merged_df, df3, how='left', left_on='Pickticket', right_on='PickRoute')

    final_merge_df = final_merge_df[[c for c in [
        'Pickticket', 'Warehouse', 'Order', 'Drop Date', 'Ship Date', 'Ship To',
        'Ship State', 'Zip Code', 'Customer PO', 'Ship Via', 'Load ID', 'Weight',
        'SKU', 'Units', 'Price', 'Size Type', 'Size', 'Product Type',
        'InvoiceNumber', 'StatusSummary', 'ERRORDESCRIPTION',
        'PickRoute', 'SalesHeaderStatus', 'SalesHeaderDocStatus',
        'PickModeOfDelivery', 'PickCreatedDate', 'DeliveryDate'
    ] if c in final_merge_df.columns]]

    final_merge_df = final_merge_df.rename(columns={
        'InvoiceNumber': 'Received in EDI?',
        'StatusSummary': 'EDI Processing Status',
        'ERRORDESCRIPTION': 'EDI Message',
        'PickRoute': 'Found in AX Data?'
    })

    if 'SalesHeaderDocStatus' in final_merge_df.columns and 'EDI Processing Status' in final_merge_df.columns:
        filtered_df = final_merge_df[
            final_merge_df['SalesHeaderDocStatus'].isin(['Picking List']) &
            final_merge_df['EDI Processing Status'].isin(['AX Load Failure'])
        ]
    else:
        filtered_df = final_merge_df

    if 'Pickticket' in filtered_df.columns:
        filtered_df = filtered_df.drop_duplicates(subset=['Pickticket'])

    data = df_to_xlsx_bytes(filtered_df)
    stamp = datetime.datetime.now().strftime("%m%d%y")
    filename = f"MISSING_945_{stamp}.xlsx"

    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )

# -----------------------------------------------------------------------------
# Delivery Confirmation – returns JSON summary + base64 Excel (NaN-safe)
# -----------------------------------------------------------------------------
@app.post("/delivery-confirmation")
async def delivery_confirmation(
    ax_report: UploadFile = File(..., description="AX D1 CSV (must include 'Pick Number', 'Customer', '1st/2nd Leg SID/SCAC')"),
    edi214: UploadFile  = File(..., description="EDI 214 CSV (must include 'SalesOrderNumber1', 'StatusSummary', 'TimeIssueOccurred', 'ERRORDESCRIPTION', 'EDILocationID1', 'TradingPartnerCode', 'AXCompany')"),
    limit: int = Query(1000, ge=1, le=10000),
):
    try:
        ax = load_csv_bytes(await ax_report.read())
        edi = load_csv_bytes(await edi214.read())

        # AX columns
        ax_pick = get_col(ax, "Pick Number")
        ax_cust = get_col(ax, "Customer")
        ax_leg1_sid  = get_col(ax, "1st Leg SID")
        ax_leg1_scac = get_col(ax, "1st Leg SCAC")
        ax_leg2_sid  = get_col(ax, "2nd Leg SID")
        ax_leg2_scac = get_col(ax, "2nd Leg SCAC")

        # EDI columns
        edi_so   = get_col(edi, "SalesOrderNumber1")
        edi_stat = get_col(edi, "StatusSummary")
        edi_time = get_col(edi, "TimeIssueOccurred")
        edi_err  = get_col(edi, "ERRORDESCRIPTION")
        edi_loc  = get_col(edi, "EDILocationID1")
        edi_tp   = get_col(edi, "TradingPartnerCode")
        edi_co   = get_col(edi, "AXCompany")

        # Build join frames
        ax_tmp = ax[[ax_pick, ax_cust, ax_leg1_sid, ax_leg1_scac, ax_leg2_sid, ax_leg2_scac]].copy()
        ax_tmp["__key"] = ax_tmp[ax_pick].astype(str).str.strip().str.lower()

        edi_tmp = edi[[edi_so, edi_stat, edi_time, edi_err, edi_loc, edi_tp, edi_co]].copy()
        edi_tmp["__key"] = edi_tmp[edi_so].astype(str).str.strip().str.lower()

        merged = ax_tmp.merge(edi_tmp, on="__key", how="inner", validate="many_to_many")

        # Filter to AX Load Failures
        is_failure = merged[edi_stat].astype(str).str.strip().str.lower() == "ax load failure"
        failures = merged.loc[is_failure].copy()

        out = pd.DataFrame({
            "pickticketnumber": failures[ax_pick],
            "Customer": failures[ax_cust],
            "1st Leg SID": failures[ax_leg1_sid],
            "1st Leg SCAC": failures[ax_leg1_scac],
            "2nd Leg SID": failures[ax_leg2_sid],
            "2nd Leg SCAC": failures[ax_leg2_scac],
            "timeissueoccured": failures[edi_time],
            "statussummary": failures[edi_stat],
            "errordescription": failures[edi_err],
            "EDILocationID1": failures[edi_loc],
            "TradingPartnerCode": failures[edi_tp],
            "AXCompany": failures[edi_co],
        }).drop_duplicates().reset_index(drop=True)

        # Summary (ensure plain Python types)
        total_ax_rows = int(len(ax))
        total_edi_rows = int(len(edi))
        matched = int(len(merged))
        failures_count = int(len(out))
        failure_rate = float((failures_count / matched) * 100.0) if matched else 0.0

        # Excel export (base64)
        xlsx_bytes = df_to_xlsx_bytes(out, sheet_name="AX_Load_Failures")
        xlsx_b64 = base64.b64encode(xlsx_bytes).decode("ascii")
        filename = f"AX_Load_Failures_{datetime.datetime.now().date().isoformat()}.xlsx"

        return {
            "summary": {
                "total_ax_rows": total_ax_rows,
                "total_edi_rows": total_edi_rows,
                "matched_rows": matched,
                "failures_count": failures_count,
                "failure_rate_pct": round(failure_rate, 2),
            },
            "rows": df_records_safe(out, limit=limit),
            "xlsx_b64": xlsx_b64,
            "filename": filename,
        }
    except HTTPException:
        raise
    except Exception as e:
        # Helpful error surfaced to the UI
        raise HTTPException(status_code=500, detail=f"Delivery confirmation failed: {e}")

# -----------------------------------------------------------------------------
# Reports API (used by your frontend history widgets)
# -----------------------------------------------------------------------------
@app.post("/reports")
async def save_report(payload: Dict[str, Any] = Body(...)):
    """
    Save a snapshot. Expected keys:
    - snapshotDate: 'YYYY-MM-DD'
    - summary: {...}
    - insights: {...}
    - byWarehouse: [...]
    """
    items = _load_snapshots()
    snapshot_date = payload.get("snapshotDate") or datetime.date.today().isoformat()
    payload["snapshotDate"] = snapshot_date
    payload["_savedAt"] = datetime.datetime.utcnow().isoformat()
    items.append(payload)
    _save_snapshots(items)
    return {"ok": True, "count": len(items)}

@app.get("/reports/recent")
async def recent_reports(days: int = Query(7, ge=1, le=90)):
    """
    Return the last `days` snapshots (by snapshotDate).
    """
    items = _load_snapshots()
    if not items:
        return []

    cutoff = datetime.date.today() - datetime.timedelta(days=days - 1)

    def parse_date(s: str) -> datetime.date:
        try:
            return datetime.date.fromisoformat(s[:10])
        except Exception:
            return datetime.date.min

    filtered = [it for it in items if parse_date(it.get("snapshotDate", "")) >= cutoff]
    filtered.sort(key=lambda it: it.get("snapshotDate", ""))
    return filtered


@app.options("/no-sonum")
def options_no_sonum():
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# -----------------------------------------------------------------------------
# NO_SONUM – detect delivery-confirmed by 3PL but NOT ship-confirmed in AX
# -----------------------------------------------------------------------------
@app.post("/no-sonum")
async def no_sonum(
    shipment_history: UploadFile = File(..., description="Shipment_History (DHL 945 history, e.g. Shipment_History___Total-*.csv)"),
    edib2bi: UploadFile = File(..., description="EDIB2Bi report (must include 'Sales Order Number' or 'SalesOrderNumber1')"),
    edi940cost: UploadFile = File(..., description="EDI940Report_withCostV2.* (must include 'PickRoute' + AX status fields)"),
    limit: int = Query(1000, ge=1, le=10000),
):
    """
    Logic:
    - From B2Bi, keep rows where Sales Order Number == 'NO_SONUM' (case-insensitive).
    - Try to link those rows to DHL Shipment History and EDI940 Cost via Pickticket/PickRoute/AXReferenceID/ShipmentID.
    - Classify likely reason:
        1) No DHL scan found => "3PL never shipped"
        2) DHL shows shipped but B2Bi indicates no/failed 945 send/transmission => "3PL shipped but did not send 945 or transmission failed"
        3) DHL shows shipped and B2Bi shows 945 reached B2Bi but failed in TSI/AX => "File failed in TSI EDI"
    Returns:
        - summary (counts)
        - rows (sample up to ?limit)
        - xlsx_b64 (full Excel)
        - filename
    """
    try:
        # Load CSVs
        dhl = load_csv_bytes(await shipment_history.read())
        b2b = load_csv_bytes(await edib2bi.read())
        cost = load_csv_bytes(await edi940cost.read())

        # Normalize
        for df in (dhl, b2b, cost):
            df.columns = df.columns.astype(str).str.strip()

        # --- Column picks (case-insensitive via get_col) ---
        # DHL / Shipment History (we mainly use Pickticket as the join key)
        dhl_pick = get_col(dhl, "Pickticket") if "Pickticket".lower() in {c.lower() for c in dhl.columns} else get_col(dhl, "Pickticketnumber") if "Pickticketnumber".lower() in {c.lower() for c in dhl.columns} else get_col(dhl, "Pick Ticket")  # flexible variants
        dhl_order = None
        try:
            dhl_order = get_col(dhl, "Order")
        except HTTPException:
            pass  # optional

        # B2Bi – must contain Sales Order Number == NO_SONUM; we also try to use AXReferenceID/ShipmentID to link
        sonum_col = None
        for cand in ["Sales Order Number", "SalesOrderNumber1", "SalesOrderNumber", "Sales_Order_Number"]:
            try:
                sonum_col = get_col(b2b, cand)
                break
            except HTTPException:
                continue
        if not sonum_col:
            raise HTTPException(status_code=400, detail="B2Bi file missing 'Sales Order Number' column (tried several variants).")

        b2b_status = None
        for cand in ["StatusSummary", "Status Summary", "Status"]:
            try:
                b2b_status = get_col(b2b, cand)
                break
            except HTTPException:
                continue

        b2b_err = None
        for cand in ["ERRORDESCRIPTION", "ERROR DESCRIPTION", "ErrorDescription", "Error"]:
            try:
                b2b_err = get_col(b2b, cand)
                break
            except HTTPException:
                continue

        b2b_axref = None
        for cand in ["AXReferenceID", "AX Reference ID", "AXReferenceId"]:
            try:
                b2b_axref = get_col(b2b, cand)
                break
            except HTTPException:
                continue

        b2b_shipid = None
        for cand in ["ShipmentID", "Shipment ID", "ShipmentId"]:
            try:
                b2b_shipid = get_col(b2b, cand)
                break
            except HTTPException:
                continue

        # EDI940 Cost: PickRoute + AX statuses help tell if AX is not ship-confirmed
        cost_pick = get_col(cost, "PickRoute")
        cost_hdr_status = None
        for cand in ["SalesHeaderStatus", "Sales Header Status"]:
            try:
                cost_hdr_status = get_col(cost, cand)
                break
            except HTTPException:
                continue

        cost_doc_status = None
        for cand in ["SalesHeaderDocStatus", "Sales Header Doc Status"]:
            try:
                cost_doc_status = get_col(cost, cand)
                break
            except HTTPException:
                continue

        # --- Filter B2Bi to NO_SONUM rows ---
        b2b["_sonum_flag"] = b2b[sonum_col].astype(str).str.strip().str.upper() == "NO_SONUM"
        b2b_no_sonum = b2b.loc[b2b["_sonum_flag"]].copy()
        if b2b_no_sonum.empty:
            # Nothing to report, return empty artifact for consistent UI
            xlsx_bytes = df_to_xlsx_bytes(pd.DataFrame(columns=[
                "AXReferenceID", "ShipmentID", "StatusSummary", "ERRORDESCRIPTION",
                "Pickticket", "PickRoute", "AX_SalesHeaderStatus", "AX_SalesHeaderDocStatus",
                "ReasonCategory", "ReasonDetail"
            ]), sheet_name="NO_SONUM")
            xlsx_b64 = base64.b64encode(xlsx_bytes).decode("ascii")
            filename = f"NO_SONUM_{datetime.datetime.now().date().isoformat()}.xlsx"
            return {
                "summary": {
                    "total_b2bi_rows": int(len(b2b)),
                    "no_sonum_rows": 0,
                    "matched_to_dhl": 0,
                    "matched_to_940": 0,
                    "reason_never_shipped": 0,
                    "reason_no_945_or_txn_fail": 0,
                    "reason_failed_tsi": 0,
                },
                "rows": [],
                "xlsx_b64": xlsx_b64,
                "filename": filename,
            }

        # Build join keys
        # From B2Bi, best pick key order: AXReferenceID (if present) -> ShipmentID (fallback)
        b2b_no_sonum["__b2b_key"] = (
            b2b_no_sonum[b2b_axref].astype(str)
            if b2b_axref else b2b_no_sonum[b2b_shipid].astype(str)
        )
        b2b_no_sonum["__b2b_key"] = b2b_no_sonum["__b2b_key"].str.strip().str.lower()

        # DHL join: try Pickticket vs __b2b_key
        dhl_tmp = dhl[[dhl_pick]].copy()
        dhl_tmp["__dhl_key"] = dhl_tmp[dhl_pick].astype(str).str.strip().str.lower()

        # 940 join: PickRoute vs __b2b_key
        cost_tmp = cost[[cost_pick] + ([cost_hdr_status] if cost_hdr_status else []) + ([cost_doc_status] if cost_doc_status else [])].copy()
        cost_tmp["__940_key"] = cost_tmp[cost_pick].astype(str).str.strip().str.lower()

        # LEFT joins to keep all NO_SONUM rows
        merged = b2b_no_sonum.merge(dhl_tmp, left_on="__b2b_key", right_on="__dhl_key", how="left")
        merged = merged.merge(cost_tmp, left_on="__b2b_key", right_on="__940_key", how="left")

        # Reason classification helpers
        def classify_reason(row: pd.Series) -> tuple[str, str]:
            """
            Returns: (ReasonCategory, ReasonDetail)
            """
            # Found DHL scan?
            has_dhl = pd.notna(row.get("__dhl_key"))
            # Found 940/AX record?
            has_940 = pd.notna(row.get("__940_key"))

            status = str(row.get(b2b_status, "")).lower() if b2b_status else ""
            err = str(row.get(b2b_err, "")).lower() if b2b_err else ""
            ax_hdr = str(row.get(cost_hdr_status, "")).lower() if cost_hdr_status else ""
            ax_doc = str(row.get(cost_doc_status, "")).lower() if cost_doc_status else ""

            # 1) No DHL record -> likely never shipped
            if not has_dhl:
                return ("3PL never shipped", "No DHL shipment scan found for this Pickticket/AXReferenceID")

            # If DHL exists:
            # Check B2Bi status/error hints to separate transmission vs TSI/AX failures
            tsi_markers = ("tsi", "ax load failure", "mapping", "transform", "translate", "application error")
            tx_markers = ("transmission", "not received", "no file", "timeout", "network", "retry")

            if any(m in status or m in err for m in tsi_markers):
                return ("File failed in TSI EDI", f"B2Bi indicates failure in TSI/AX pipeline (status='{row.get(b2b_status, '')}', err='{row.get(b2b_err, '')}')")

            if any(m in status or m in err for m in tx_markers):
                return ("3PL sent 945 but transmission failed", f"Transmission-related issue detected in B2Bi (status='{row.get(b2b_status, '')}', err='{row.get(b2b_err, '')}')")

            # If AX doc status hints it's not ship-confirmed yet (still picking/packing)
            if ax_doc and ax_doc in ("picking list", "pickinglist", "picking_list"):
                return ("3PL shipped but AX not ship-confirmed", "AX document status indicates Picking List – posting not completed")

            # Fallback: treat as missing/unknown 945 transmission
            return ("3PL shipped but did not send 945 or transmission failed", "DHL shows shipped; B2Bi has NO_SONUM without clear TSI error")

        reasons = merged.apply(classify_reason, axis=1)
        merged["ReasonCategory"] = reasons.map(lambda t: t[0])
        merged["ReasonDetail"] = reasons.map(lambda t: t[1])

        # Output view
        out_cols = [
            (b2b_axref or "AXReferenceID"),
            (b2b_shipid or "ShipmentID"),
            (b2b_status or "StatusSummary"),
            (b2b_err or "ERRORDESCRIPTION"),
            dhl_pick,        # DHL Pickticket if found
            cost_pick,       # AX PickRoute if found
        ]
        if cost_hdr_status: out_cols.append(cost_hdr_status)
        if cost_doc_status: out_cols.append(cost_doc_status)
        out_cols += ["ReasonCategory", "ReasonDetail"]

        # Ensure columns exist in frame, fill missing if needed
        for c in out_cols:
            if c not in merged.columns:
                merged[c] = np.nan

        out = merged[out_cols].drop_duplicates().reset_index(drop=True)

        # Summary
        total_b2bi = int(len(b2b))
        total_no_sonum = int(len(b2b_no_sonum))
        matched_to_dhl = int(merged["__dhl_key"].notna().sum())
        matched_to_940 = int(merged["__940_key"].notna().sum())
        reason_never_shipped = int((out["ReasonCategory"] == "3PL never shipped").sum())
        reason_failed_tsi = int((out["ReasonCategory"] == "File failed in TSI EDI").sum())
        reason_no_945_or_txn_fail = int((out["ReasonCategory"] == "3PL shipped but did not send 945 or transmission failed").sum() +
                                        (out["ReasonCategory"] == "3PL sent 945 but transmission failed").sum() +
                                        (out["ReasonCategory"] == "3PL shipped but AX not ship-confirmed").sum())

        # Excel
        xlsx_bytes = df_to_xlsx_bytes(out, sheet_name="NO_SONUM")
        xlsx_b64 = base64.b64encode(xlsx_bytes).decode("ascii")
        filename = f"NO_SONUM_{datetime.datetime.now().date().isoformat()}.xlsx"

        return {
            "summary": {
                "total_b2bi_rows": total_b2bi,
                "no_sonum_rows": total_no_sonum,
                "matched_to_dhl": matched_to_dhl,
                "matched_to_940": matched_to_940,
                "reason_never_shipped": reason_never_shipped,
                "reason_no_945_or_txn_fail": reason_no_945_or_txn_fail,
                "reason_failed_tsi": reason_failed_tsi,
            },
            "rows": df_records_safe(out, limit=limit),
            "xlsx_b64": xlsx_b64,
            "filename": filename,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NO_SONUM detection failed: {e}")