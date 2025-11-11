# 🧠 Missing 945 Reconciliation

A full-stack analytics and reporting tool built for **Tempur-Pedic supply-chain operations** to reconcile shipment, EDI, and warehouse data from multiple sources (e.g., `Shipment_History`, `EDIB2BiReportV2`, `EDI940Report_withCostV2`, and `EDI214`).  
It helps visualize KPIs such as **Revenue at Risk**, **AX Load Failures**, **Posting Failure Rate**, and **Average Resolution Time**, and exports reconciliation results directly to Excel.

---

## ⚙️ Tech Stack

### **Frontend**
- **React + TypeScript + Vite + TailwindCSS**
- **Lucide Icons**, **Custom KPI components**
- Interactive dashboards: Trend KPIs, charts, and DataTables
- CSV upload and Excel export
- Hosted via **AWS S3 + CloudFront** (CI/CD with GitHub Actions)

### **Backend**
- **FastAPI (Python 3.9+)**
- **Pandas**, **OpenPyXL**, **NumPy**, **chardet**
- CORS enabled for local & production origins
- JSON + Base64 Excel responses for frontend
- Deployed via **AWS App Runner (Docker)** or **Lambda + API Gateway**

---


Backend Setup
cd backend
pyenv shell 3.9.6
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000


Frontend Setup
cd ../frontend
npm install
npm run devcl