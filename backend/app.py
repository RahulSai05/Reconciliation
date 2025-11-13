import os
import io
import json
import base64
import datetime
from typing import Any, Dict, List
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Response, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# -------------------------------------------------
# Create the app FIRST
# -------------------------------------------------
app = FastAPI(title="Missing 945 API", version="1.2.0")

# (Optional) Lambda adapter – safe to leave in
if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    from mangum import Mangum
    handler = Mangum(app)

# -------------------------------------------------
# CORS (env-driven)
# -------------------------------------------------
def _csv_env(name: str, default: str = "") -> List[str]:
    return [o.strip() for o in os.getenv(name, default).split(",") if o.strip()]

ALLOWED_ORIGINS = _csv_env("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOW_ORIGIN_REGEX = os.getenv("ALLOW_ORIGIN_REGEX") or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if not ALLOW_ORIGIN_REGEX else [],
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
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
        "Content-Disposition": f'attachment; filename="{filename}"'
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

# -----------------------------------------------------------------------------
# NO_SONUM / NO_SO reconciliation (final)
# -----------------------------------------------------------------------------
@app.post("/no-sonum-reconciliation")
async def no_sonum_reconciliation(
    ax_header: UploadFile = File(..., description="AX Sales/Pick header CSV (e.g., EDI940Report_withCostV2.0*.csv)"),
    d1_legs: UploadFile = File(..., description="D1 / Legs CSV (e.g., TPX_-_AX_D1_Report-*.csv)"),
    edi214: UploadFile = File(..., description="EDI 214 / Exceptions CSV (e.g., EDIB2BiReportV2*.csv)"),
):
    # ---- load (utf-8-sig strips BOM if present)
    def _read(b: bytes) -> pd.DataFrame:
        try:
            df = pd.read_csv(io.BytesIO(b), dtype=str, encoding="utf-8-sig")
        except Exception:
            df = pd.read_csv(io.BytesIO(b), dtype=str, encoding="latin-1")
        # normalize headers
        df.columns = (
            df.columns.astype(str)
            .str.strip()
            .str.replace(r"^\ufeff|^ÿ", "", regex=True)
        )
        return df

    ax_df  = _read(await ax_header.read())
    _d1_df = _read(await d1_legs.read())    # accepted for parity; not used in output (yet)
    edi_df = _read(await edi214.read())

    # ---- required EDI cols (fail loud if truly missing)
    req_edi = [
        "PurchaseOrderNumber", "TimeIssueOccurred", "AXCompany", "TradingPartnerCode",
        "EDILocationID1", "DocumentType", "StatusSummary", "SalesOrderNumber1",
        "ShipmentID", "AXReferenceID", "ERRORDESCRIPTION"
    ]
    missing_edi = [c for c in req_edi if c not in edi_df.columns]
    if missing_edi:
        raise HTTPException(status_code=400, detail=f"Missing in EDI 214 file: {missing_edi}. Available: {list(edi_df.columns)}")

    # ---- set up filters (case-insensitive)
    def _norm_col(s: pd.Series) -> pd.Series:
        return s.fillna("").astype(str).str.strip().str.upper()

    edi = edi_df.copy()
    edi["__DOC"]  = _norm_col(edi["DocumentType"])
    edi["__SON"]  = _norm_col(edi["SalesOrderNumber1"])
    edi["__STAT"] = _norm_col(edi["StatusSummary"])

    no_so_markers = {"NO_SO_AVAILABLE", "NO_SO", "NO_SO_NUM", "NO_SONUM"}
    mask = (edi["__DOC"] == "214") & ( (edi["__SON"] == "NO_SONUM") | (edi["__STAT"].isin(no_so_markers)) )

    edi_filtered = edi.loc[mask].copy()

    # If no rows match, still return a proper (empty) file with headers
    out_cols = [
        "PurchaseOrderNumber", "TimeIssueOccurred", "AXCompany", "TradingPartnerCode",
        "EDILocationID1", "DocumentType", "StatusSummary", "SalesOrderNumber1",
        "ShipmentID", "Sales Order Number", "AXReferenceID", "AX Pick Status",
        "AX SO Header Status", "ERRORDESCRIPTION"
    ]
    if edi_filtered.empty:
        data = df_to_xlsx_bytes(pd.DataFrame(columns=out_cols))
        stamp = datetime.datetime.now().strftime("%m%d%y")
        filename = f"NO_SONUM_{stamp}.xlsx"
        return StreamingResponse(io.BytesIO(data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename=\"{filename}\"'}
        )

    # ---- optional AX enrichment (will be blank for NO_SONUM)
    ax_cols_present = {c for c in ax_df.columns}
    has_salesid = "SalesId" in ax_cols_present
    if has_salesid:
        ax_slim = ax_df[["SalesId"] + [c for c in ["SalesHeaderStatus", "SalesHeaderDocStatus"] if c in ax_df.columns]].copy()
        ax_slim["SalesId"] = ax_slim["SalesId"].astype(str).str.strip()
        edi_filtered["SalesOrderNumber1"] = edi_filtered["SalesOrderNumber1"].astype(str).str.strip()
        merged = pd.merge(
            edi_filtered,
            ax_slim,
            how="left",
            left_on="SalesOrderNumber1",
            right_on="SalesId",
        )
    else:
        merged = edi_filtered.copy()
        merged["SalesId"] = pd.NA
        if "SalesHeaderStatus" not in merged.columns:
            merged["SalesHeaderStatus"] = pd.NA
        if "SalesHeaderDocStatus" not in merged.columns:
            merged["SalesHeaderDocStatus"] = pd.NA

    # ---- prefer rows that have an ERRORDESCRIPTION, then dedupe on a stable key
    merged["__has_err"] = merged["ERRORDESCRIPTION"].notna() & (merged["ERRORDESCRIPTION"].astype(str).str.strip() != "")
    # sort so True comes first
    merged = merged.sort_values(by="__has_err", ascending=False)

    # choose dedupe keys that exist (cover your example)
    dedupe_keys = [k for k in ["PurchaseOrderNumber", "AXReferenceID", "ShipmentID"] if k in merged.columns]
    if dedupe_keys:
        merged = merged.drop_duplicates(subset=dedupe_keys, keep="first")

    # ---- build final output (exact names/order)
    out_df = pd.DataFrame({
        "PurchaseOrderNumber": merged.get("PurchaseOrderNumber"),
        "TimeIssueOccurred": merged.get("TimeIssueOccurred"),
        "AXCompany": merged.get("AXCompany"),
        "TradingPartnerCode": merged.get("TradingPartnerCode"),
        "EDILocationID1": merged.get("EDILocationID1"),
        "DocumentType": merged.get("DocumentType"),
        "StatusSummary": merged.get("StatusSummary"),
        "SalesOrderNumber1": merged.get("SalesOrderNumber1"),       # should be "NO_SONUM"
        "ShipmentID": merged.get("ShipmentID"),
        "Sales Order Number": merged.get("SalesId"),                # blank for NO_SONUM rows
        "AXReferenceID": merged.get("AXReferenceID"),
        "AX Pick Status": merged.get("SalesHeaderDocStatus"),
        "AX SO Header Status": merged.get("SalesHeaderStatus"),
        "ERRORDESCRIPTION": merged.get("ERRORDESCRIPTION"),
    })[out_cols]

    # ---- export
    data = df_to_xlsx_bytes(out_df)
    stamp = datetime.datetime.now().strftime("%m%d%y")
    filename = f"NO_SONUM_{stamp}.xlsx"

    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename=\"{filename}\"'}
    )
