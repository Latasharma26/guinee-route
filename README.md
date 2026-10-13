# GuinéeRoute Operations Command

A field-operations dashboard for monitoring agents, missions, vehicle registrations, and reported violations.

## Features

- Live agent status dashboard and status updates
- Mission progress and violation summaries
- Vehicle lookup by registration plate
- PostgreSQL-backed REST API
- Live map using Leaflet and OpenStreetMap

## Requirements

- Node.js 20.13 or newer
- npm
- PostgreSQL

## Setup

1. Create a PostgreSQL database and apply the schema from the repository root:

   ```bash
   createdb guinee_route
   psql -d guinee_route -f backend/schema.sql
   ```

2. Configure and start the backend:

   ```bash
   cd backend
   npm install
   ```

   Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` to your PostgreSQL connection string. `FRONTEND_ORIGINS` should list the allowed browser origins as comma-separated URLs. Keep `TRUST_PROXY_HOPS=0` for direct local access; in deployment, set it to the exact number of trusted reverse proxies.

   ```bash
   npm run dev
   ```

   The API listens on `http://localhost:5000` by default. Use `npm start` to run without the development watcher.

3. In a second terminal, configure and start the frontend:

   ```bash
   cd frontend
   npm install
   ```

   Copy `frontend/.env.example` to `frontend/.env`. Set `VITE_API_BASE_URL` to the API origin without `/api/v1` when using a different host or port.

   ```bash
   npm run dev
   ```

   Open the local URL printed by Vite, usually `http://localhost:5173`.

The backend seeds sample agent, mission, vehicle, and violation records when it starts. Reapplying the schema is safe; seed inserts skip existing IDs.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/v1/health` | API and database health check |
| GET | `/api/v1/dashboard/stats` | Dashboard statistics |
| GET | `/api/v1/agents/live` | List field agents |
| PATCH | `/api/v1/agents/:id/status` | Update an agent's status |
| GET | `/api/v1/missions` | List missions |
| GET | `/api/v1/vehicles/lookup?plate=GN-2048-A` | Look up a vehicle and its violations |

## Demo Access and Security

No demo username or password is configured; the application currently has no login or authentication flow. The status-update endpoint also lacks authorization and must not be exposed to the public internet until an identity and role policy is implemented.

The API allows 300 requests per IP per 15 minutes, with status updates limited to 30 per IP per 15 minutes. Error logs record an event and error code without request data or database error messages. Environment files are ignored by Git; commit only the `.env.example` templates, never `.env` files or database credentials.

For production, configure HTTPS termination and HTTP-to-HTTPS redirection at the hosting provider or reverse proxy. Local code cannot verify the deployment's TLS configuration. CORS and rate limiting do not replace authentication or authorization.
