# GuinéeRoute (Operations Command & Field Surveillance)

A road monitoring and field enforcement system combining a high-performance Node.js + PostgreSQL backend with a Command Center Web Operations Dashboard (Option A) and a Field Agent Mobile App Simulator (Option B).

---

## 🌟 Overview & Delivered Surfaces

1. **Option A: Web Operations Dashboard & Live Operations Map (Compulsory Deliverable)**
   - **KPI Bar**: Real-time counters for agents on duty (48), active missions (18), online agents (42), and offline alerts (6).
   - **Corridor View**: Interactive dark-mode map of the **RN1 Corridor (Coyah Junction to Dubréka Checkpoint)** with agent markers, badge initials (`MD`, `AB`, `AC`, `OK`, `ST`), and live radar pulse indicators.
   - **Live Mission Drawer**: Inspect active mission `GR-MSN-2026-00984` showing progress (40%), total/covered distance (`18.6 km` / `7.4 km`), duration (`00h 52m`), violations (`2 violations`), and in-place status controls.
   - **Vehicle Identity & Violation Lookup**: Search license plates (`RC 8245 AB`, `RC 1920 CC`, `GN-2048-A`) to retrieve vehicle identity, registered company/owner, violation citations, and total unpaid fines in GNF.

2. **Option B: Field Agent Mobile App Simulator (Bonus Deliverable)**
   - Dedicated toggleable mobile interface representing Field Inspector **Mamadou Diallo** (`AGT-1048`).
   - Active shift timer ticking elapsed duty hours (`02:14:xx`).
   - Active RN1 mission patrol card with live progress bar and corridor endpoints.
   - Shift controls including **Take a Break modal** (Short break 15 min, Lunch break 30 min, Extended break) that updates the agent's live status in the database.
   - Quick mobile vehicle lookup and emergency SOS triggers.

---

## 🛠️ Tech Stack & Architecture

- **Backend**: Node.js, Express 5, `pg` (PostgreSQL Client), Express Rate Limit, MVC pattern (`config/`, `controllers/`, `models/`, `routes/`, `middleware/`, `scripts/`, `tests/`).
- **Database**: PostgreSQL with normalized schema (`agents`, `vehicles`, `missions`, `violations`).
- **Frontend**: React 19, Vite 8, React Router 7, Leaflet & React-Leaflet with CartoDB Dark Matter tiles.

---

## 📋 Requirements

- **Node.js**: `v20.13` or newer (Tested on Node.js `v24`)
- **npm**: `v10` or newer
- **PostgreSQL**: `v14` or newer

---

## 🚀 Quick-Start Setup

### 1. Database Setup

Create the PostgreSQL database and apply the normalized schema:

```bash
# In your terminal
createdb guinee_route
psql -d guinee_route -f backend/schema.sql
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Copy the environment template if needed and ensure `DATABASE_URL` is configured:

```bash
cp .env.example .env
```

Example `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/guinee_route"
PORT=5000
FRONTEND_ORIGINS="http://localhost:5173"
TRUST_PROXY_HOPS=0
```

Seed the database with realistic mock-aligned data:
```bash
npm run seed
```

Start the backend API server:
```bash
npm run dev
# Or run with standard node
npm start
```

The API will listen on `http://localhost:5000`.

### 3. Frontend Setup

In a new terminal window:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Quality Verification

### Run Backend Tests (Node Test Runner)
```bash
cd backend
npm test
```
All 10 unit and integration tests verify:
- Health check endpoint
- Agent status update validation & missing agent error handling
- Vehicle lookup validation, 404 responses, and violation foreign-key lookups with unpaid fines calculation

### Run Frontend Lint & Build
```bash
cd frontend
npm run lint
npm run build
```

---

## 📡 Core REST Endpoints

| Method | Endpoint | Description | Sample Query / Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service and database health check | - |
| `GET` | `/api/v1/dashboard/stats` | KPI counters (`agents_on_duty`, `active_missions`, `offline_alerts`, `violations_today`, fines) | - |
| `GET` | `/api/v1/agents/live` | Real-time agent status & coordinates | - |
| `PATCH` | `/api/v1/agents/:id/status` | Update agent status (`On Duty`, `On Mission`, `Break`, `Offline`) | `{"status": "Break"}` |
| `GET` | `/api/v1/missions` | List all active road corridor missions | - |
| `GET` | `/api/v1/vehicles/lookup` | Vehicle identity, violation history & unpaid fines | `?plate=RC 8245 AB` |

### Sample Vehicle Lookup Response (`GET /api/v1/vehicles/lookup?plate=RC 8245 AB`):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "plate_number": "RC 8245 AB",
    "make": "Scania",
    "model": "R500 Heavy Truck",
    "status": "Active",
    "owner": "TransGuinée SA",
    "unpaid_fines_gnf": 750000,
    "violations": [
      {
        "id": 1,
        "violation_type": "Unauthorized Heavy Vehicle",
        "fine_amount_gnf": "750000.00",
        "status": "Unpaid",
        "description": "Operating in RN1 restricted corridor without municipal transit clearance",
        "mission_code": "GR-MSN-2026-00984",
        "road_name": "RN1"
      }
    ]
  }
}
```

---

## 🗄️ Normalized Schema Structure

- **`agents`**: `id`, `badge_number`, `name`, `status`, `lat`, `lng`.
- **`vehicles`**: `id`, `plate_number`, `make`, `model`, `status`, `owner`.
- **`missions`**: `id`, `mission_code`, `road_name`, `total_km`, `covered_km`, `status`, `agent_id`, `violations`, `duration_minutes`.
- **`violations`**: `id`, `vehicle_id` (FK to `vehicles`), `mission_id` (FK to `missions`), `violation_type`, `fine_amount_gnf`, `status` (`Unpaid` / `Paid`), `description`, `created_at`.

---

## 🔒 Security & Production Notes

- **Rate Limiting**: Configured at 300 requests per 15-minute window for general API routes, with stricter limits on write operations.
- **Environment Isolation**: `.env` is ignored by Git; never commit database passwords or production secrets.
- **Authorization**: Role-based access control (RBAC) and user authentication should be integrated prior to public internet exposure.
