
import { useEffect, useState, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
} from "react-router-dom";
import axios from "axios";
import "./App.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api/v1`;

const navigation = [
  { id: "/", label: "Operations overview", icon: "▦" },
  { id: "/surveillance", label: "Live surveillance", icon: "⌖" },
  { id: "/agents", label: "Field agents", icon: "◉" },
  { id: "/missions", label: "Missions", icon: "▤" },
  { id: "/vehicles", label: "Vehicle lookup", icon: "⌕" },
];

const statusColors = {
  "On Duty": "#22c55e",
  "On Mission": "#60a5fa",
  Break: "#f59e0b",
  Offline: "#ef4444",
};

const agentIcon = (status) =>
  L.divIcon({
    className: "agent-marker-wrapper",
    html: `<div style="background:${
      statusColors[status] || "#94a3b8"
    }" class="agent-marker"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const formatFine = (amount) =>
  `${Number(amount || 0).toLocaleString("en-US")} GNF`;

function StatCard({ title, value, note, icon, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-copy">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
      <div className="stat-accent" />
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-symbol">G</div>
        <div>
          <h2>GuinéeRoute</h2>
          <span>FIELD OPERATIONS</span>
        </div>
      </div>

      <div className="nav-label">WORKSPACE</div>

      <nav className="sidebar-navigation" aria-label="Main navigation">
        {navigation.map((item) => (
          <NavLink
            key={item.id}
            to={item.id}
            end={item.id === "/"}
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="system-dot" />
        <div>
          <strong>System operational</strong>
          <small>API monitoring enabled</small>
        </div>
      </div>
    </aside>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">COMMAND CENTER / GUINEA</div>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      <div className="live-badge">
        <span /> LIVE MONITORING
      </div>
    </header>
  );
}

function DashboardStats({ stats }) {
  return (
    <section className="stats-grid">
      <StatCard
        title="Total agents"
        value={stats?.total_agents ?? "—"}
        note="Registered field personnel"
        icon="♙"
        color="blue"
      />
      <StatCard
        title="Agents on duty"
        value={stats?.agents_on_duty ?? "—"}
        note="Currently available"
        icon="◉"
        color="green"
      />
      <StatCard
        title="Active missions"
        value={stats?.active_missions ?? "—"}
        note="Currently in progress"
        icon="◎"
        color="purple"
      />
      <StatCard
        title="Offline alerts"
        value={stats?.offline_alerts ?? "—"}
        note="Require attention"
        icon="⚠"
        color="orange"
      />
    </section>
  );
}

function SurveillanceMap({ agents }) {
  return (
    <div className="panel map-panel">
      <div className="panel-header">
        <div>
          <h3>Live field surveillance</h3>
          <p>RN1 corridor · Coyah to Dubréka</p>
        </div>
        <span className="count-pill">{agents.length} agents tracked</span>
      </div>

      <div className="map-container">
        <MapContainer
          center={[9.665, -13.54]}
          zoom={11}
          scrollWheelZoom
          className="leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Polyline
            positions={[
              [9.6412, -13.5784],
              [9.6505, -13.55],
              [9.6803, -13.51],
              [9.7001, -13.4502],
            ]}
            pathOptions={{
              color: "#2563eb",
              weight: 4,
              dashArray: "8 8",
            }}
          />

          {agents.map((agent) => {
            const lat = Number(agent.lat);
            const lng = Number(agent.lng);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              return null;
            }

            return (
              <Marker
                key={agent.id}
                position={[lat, lng]}
                icon={agentIcon(agent.status)}
              >
                <Popup>
                  <strong>{agent.name}</strong>
                  <br />
                  {agent.badge_number}
                  <br />
                  Status: {agent.status}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <div className="map-legend">
          {Object.entries(statusColors).map(([status, color]) => (
            <span key={status}>
              <i style={{ background: color }} />
              {status}
            </span>
          ))}
        </div>
      </div>

      <div className="map-footer">
        <div>
          <span className="footer-dot" />
          Location feed refreshed every 15 seconds
        </div>
        <span>Map data © OpenStreetMap</span>
      </div>
    </div>
  );
}

function MissionCard({ mission, agents }) {
  return (
    <div className="panel mission-panel">
      <div className="panel-header">
        <div>
          <h3>{mission ? "Active mission" : "Mission status"}</h3>
          <p>Current field deployment</p>
        </div>
        {mission && <span className="status-tag">IN PROGRESS</span>}
      </div>

      {mission ? (
        <div className="mission-content">
          <div className="mission-code">{mission.mission_code}</div>
          <h2>{mission.road_name} Corridor Patrol</h2>
          <p className="mission-description">
            Field surveillance and road compliance monitoring.
          </p>

          <div className="progress-heading">
            <span>Mission progress</span>
            <strong>
              {mission.total_km > 0
                ? Math.round(
                    (mission.covered_km / mission.total_km) * 100
                  )
                : 0}
              %
            </strong>
          </div>

          <div className="progress-track">
            <div
              style={{
                width: `${
                  mission.total_km > 0
                    ? Math.min(
                        100,
                        (mission.covered_km / mission.total_km) * 100
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="distance-row">
            <span>{mission.covered_km} km covered</span>
            <span>{mission.total_km} km total</span>
          </div>

          <div className="mission-metrics">
            <div>
              <span>Violations</span>
              <strong>{mission.violations}</strong>
            </div>
            <div>
              <span>Duration</span>
              <strong>{mission.duration_minutes} min</strong>
            </div>
          </div>

          <div className="assigned-agent">
            <div className="avatar">
              {getInitials(
                agents.find((agent) => agent.id === mission.agent_id)?.name ||
                  "AG"
              )}
            </div>
            <div>
              <strong>
                {agents.find((agent) => agent.id === mission.agent_id)?.name ||
                  "Assigned agent"}
              </strong>
              <small>Lead field agent</small>
            </div>
            <span className="assigned-dot" />
          </div>
        </div>
      ) : (
        <div className="empty-state">No active missions found.</div>
      )}
    </div>
  );
}

function AgentsTable({ agents, updatingAgentId, updateStatus, loading, onSelect }) {
  return (
    <div className="panel agents-panel">
      <div className="panel-header">
        <div>
          <h3>Field agents</h3>
          <p>Current personnel status</p>
        </div>
        <span className="count-pill">{agents.length} personnel</span>
      </div>

      <div className="agent-table-wrap">
        <table className="agent-table">
          <thead>
            <tr>
              <th>AGENT</th>
              <th>BADGE ID</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td>
                  <button
                    type="button"
                    className="agent-name-button"
                    onClick={() => onSelect(agent)}
                  >
                    <span className="table-avatar">
                      {getInitials(agent.name)}
                    </span>
                    <span>{agent.name}</span>
                  </button>
                </td>
                <td className="muted-cell">{agent.badge_number}</td>
                <td>
                  <span
                    className={`agent-status status-${agent.status
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    <i />
                    {agent.status}
                  </span>
                </td>
                <td>
                  <select
                    aria-label={`Update status for ${agent.name}`}
                    value={agent.status}
                    disabled={updatingAgentId === agent.id}
                    onChange={(event) =>
                      updateStatus(agent, event.target.value)
                    }
                  >
                    <option>On Duty</option>
                    <option>On Mission</option>
                    <option>Break</option>
                    <option>Offline</option>
                  </select>
                </td>
              </tr>
            ))}
            {!loading && agents.length === 0 && (
              <tr>
                <td colSpan="4">No agents found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VehicleLookup({
  plate,
  setPlate,
  vehicle,
  vehicleMessage,
  vehicleLoading,
  lookupVehicle,
}) {
  return (
    <div className="panel vehicle-panel">
      <div className="panel-header">
        <div>
          <h3>Vehicle lookup</h3>
          <p>Search by registration plate</p>
        </div>
        <span className="vehicle-icon">⌕</span>
      </div>

      <form className="lookup-form" onSubmit={lookupVehicle}>
        <label htmlFor="plate">VEHICLE REGISTRATION</label>
        <div className="lookup-input-row">
          <input
            id="plate"
            value={plate}
            onChange={(event) => setPlate(event.target.value)}
            placeholder="e.g. GN-2048-A"
            required
          />
          <button type="submit" disabled={vehicleLoading}>
            {vehicleLoading ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {vehicleMessage && (
        <p className="lookup-message" role="alert">
          {vehicleMessage}
        </p>
      )}

      {vehicle && (
        <div className="vehicle-details">
          <div className="vehicle-result-heading">
            <strong>{vehicle.plate_number}</strong>
            <span className="vehicle-active">{vehicle.status}</span>
          </div>

          <div className="vehicle-detail-row">
            <span>Make &amp; model</span>
            <strong>
              {vehicle.make} {vehicle.model}
            </strong>
          </div>
          <div className="vehicle-detail-row">
            <span>Registered to</span>
            <strong>{vehicle.owner || "Not available"}</strong>
          </div>
          <div className="vehicle-detail-row">
            <span>Recorded violations</span>
            <strong>
              {Array.isArray(vehicle.violations)
                ? vehicle.violations.length
                : Number(vehicle.violations || 0)}
            </strong>
          </div>

          {Array.isArray(vehicle.violations) &&
            vehicle.violations.map((violation, index) => (
              <div
                className="vehicle-violation"
                key={violation.id ?? index}
              >
                <div className="vehicle-detail-row">
                  <span>{violation.violation_type || "Violation"}</span>
                  <strong>{formatFine(violation.fine_amount_gnf)}</strong>
                </div>
                {violation.description && (
                  <p className="violation-description">
                    {violation.description}
                  </p>
                )}
                {violation.created_at && (
                  <small className="violation-date">
                    Recorded: {new Date(violation.created_at).toLocaleString()}
                  </small>
                )}
              </div>
            ))}
        </div>
      )}

      <div className="lookup-hint">
        <span>ⓘ</span>
        Enter a plate number to retrieve vehicle records and compliance
        information.
      </div>
    </div>
  );
}

function AgentDrawer({ agent, onClose, updateStatus, updatingAgentId }) {
  if (!agent) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="agent-drawer" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="drawer-close"
          onClick={onClose}
          aria-label="Close agent details"
        >
          ×
        </button>
        <div className="drawer-avatar">{getInitials(agent.name)}</div>
        <div className="eyebrow">FIELD PERSONNEL</div>
        <h2>{agent.name}</h2>
        <p>{agent.badge_number}</p>

        <div className="drawer-detail">
          <span>Current status</span>
          <strong>{agent.status}</strong>
        </div>
        <div className="drawer-detail">
          <span>Latitude</span>
          <strong>{agent.lat}</strong>
        </div>
        <div className="drawer-detail">
          <span>Longitude</span>
          <strong>{agent.lng}</strong>
        </div>

        <label className="drawer-label" htmlFor="drawer-status">
          UPDATE STATUS
        </label>
        <select
          id="drawer-status"
          value={agent.status}
          disabled={updatingAgentId === agent.id}
          onChange={(event) => updateStatus(agent, event.target.value)}
        >
          <option>On Duty</option>
          <option>On Mission</option>
          <option>Break</option>
          <option>Offline</option>
        </select>
      </aside>
    </div>
  );
}

function DashboardPages() {
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [missions, setMissions] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState(null);
  const [vehicleMessage, setVehicleMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingAgentId, setUpdatingAgentId] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [statsRes, agentsRes, missionsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/agents/live`),
        axios.get(`${API}/missions`),
      ]);

      setStats(statsRes.data);
      setAgents(agentsRes.data.data || []);
      setMissions(missionsRes.data.data || []);
      setError("");

      setSelectedAgent((current) => {
        if (!current) return null;
        return (agentsRes.data.data || []).find(
          (agent) => agent.id === current.id
        ) || null;
      });
    } catch (err) {
      console.error("Dashboard loading failed:", err);
      setError(
        "Unable to connect to the API. Check that the backend is running on port 5000."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(loadDashboard, 0);
    const timer = setInterval(loadDashboard, 15000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(timer);
    };
  }, [loadDashboard]);

  useEffect(() => {
    const pageTitles = {
      "/": [
        "Operations overview",
        "Monitor field activity, agents and road missions in real time.",
      ],
      "/surveillance": [
        "Live surveillance",
        "Monitor agent locations and the RN1 corridor.",
      ],
      "/agents": [
        "Field agents",
        "Review personnel and update field status.",
      ],
      "/missions": [
        "Missions",
        "Track deployments, mission progress and field activity.",
      ],
      "/vehicles": [
        "Vehicle lookup",
        "Search vehicle registrations and review compliance records.",
      ],
    };

    document.title = `${pageTitles[location.pathname]?.[0] || "GuinéeRoute"} | GuinéeRoute`;
  }, [location.pathname]);

  const updateStatus = async (agent, status) => {
    if (updatingAgentId !== null) return;

    setUpdatingAgentId(agent.id);
    setError("");

    try {
      const response = await axios.patch(
        `${API}/agents/${agent.id}/status`,
        { status }
      );
      const updatedAgent = response.data.data;

      setAgents((current) =>
        current.map((item) =>
          item.id === updatedAgent.id ? updatedAgent : item
        )
      );
      setSelectedAgent((current) =>
        current?.id === updatedAgent.id ? updatedAgent : current
      );

      await loadDashboard();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not update agent status. Please try again."
      );
    } finally {
      setUpdatingAgentId(null);
    }
  };

  const lookupVehicle = async (event) => {
    event.preventDefault();

    if (!plate.trim()) {
      setVehicleMessage("Please enter a vehicle registration plate.");
      return;
    }

    setVehicle(null);
    setVehicleMessage("");
    setVehicleLoading(true);

    try {
      const response = await axios.get(`${API}/vehicles/lookup`, {
        params: { plate: plate.trim() },
      });
      setVehicle(response.data.data);
    } catch (err) {
      setVehicleMessage(
        err.response?.data?.message ||
          "Unable to search vehicle. Please try again."
      );
    } finally {
      setVehicleLoading(false);
    }
  };

  const activeMission = missions.find(
    (mission) => mission.status === "In Progress"
  );

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <>
                <PageHeader
                  title="Operations overview"
                  subtitle="Monitor field activity, agents and road missions in real time."
                />
                {error && <div className="error-banner" role="alert">{error}</div>}
                <DashboardStats stats={stats} />
                <section className="content-grid">
                  <SurveillanceMap agents={agents} />
                  <MissionCard mission={activeMission} agents={agents} />
                </section>
                <section className="bottom-grid">
                  <AgentsTable
                    agents={agents}
                    updatingAgentId={updatingAgentId}
                    updateStatus={updateStatus}
                    loading={loading}
                    onSelect={setSelectedAgent}
                  />
                  <VehicleLookup
                    plate={plate}
                    setPlate={setPlate}
                    vehicle={vehicle}
                    vehicleMessage={vehicleMessage}
                    vehicleLoading={vehicleLoading}
                    lookupVehicle={lookupVehicle}
                  />
                </section>
              </>
            }
          />

          <Route
            path="/surveillance"
            element={
              <>
                <PageHeader
                  title="Live surveillance"
                  subtitle="Monitor agent locations and the RN1 corridor."
                />
                {error && <div className="error-banner" role="alert">{error}</div>}
                <SurveillanceMap agents={agents} />
                <DashboardStats stats={stats} />
              </>
            }
          />

          <Route
            path="/agents"
            element={
              <>
                <PageHeader
                  title="Field agents"
                  subtitle="Review personnel and update field status."
                />
                {error && <div className="error-banner" role="alert">{error}</div>}
                <DashboardStats stats={stats} />
                <AgentsTable
                  agents={agents}
                  updatingAgentId={updatingAgentId}
                  updateStatus={updateStatus}
                  loading={loading}
                  onSelect={setSelectedAgent}
                />
              </>
            }
          />

          <Route
            path="/missions"
            element={
              <>
                <PageHeader
                  title="Missions"
                  subtitle="Track deployments, mission progress and field activity."
                />
                {error && <div className="error-banner" role="alert">{error}</div>}
                <DashboardStats stats={stats} />
                <MissionCard mission={activeMission} agents={agents} />
                <div className="panel agents-panel">
                  <div className="panel-header">
                    <div>
                      <h3>All missions</h3>
                      <p>Mission records from the operations database</p>
                    </div>
                    <span className="count-pill">{missions.length} missions</span>
                  </div>
                  <div className="agent-table-wrap">
                    <table className="agent-table">
                      <thead>
                        <tr>
                          <th>MISSION</th>
                          <th>ROAD</th>
                          <th>STATUS</th>
                          <th>PROGRESS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missions.map((mission) => (
                          <tr key={mission.id}>
                            <td>{mission.mission_code}</td>
                            <td>{mission.road_name}</td>
                            <td>{mission.status}</td>
                            <td>
                              {mission.total_km > 0
                                ? Math.round(
                                    (mission.covered_km / mission.total_km) * 100
                                  )
                                : 0}
                              %
                            </td>
                          </tr>
                        ))}
                        {!loading && missions.length === 0 && (
                          <tr>
                            <td colSpan="4">No missions found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            }
          />

          <Route
            path="/vehicles"
            element={
              <>
                <PageHeader
                  title="Vehicle lookup"
                  subtitle="Search vehicle registrations and review compliance records."
                />
                {error && <div className="error-banner" role="alert">{error}</div>}
                <VehicleLookup
                  plate={plate}
                  setPlate={setPlate}
                  vehicle={vehicle}
                  vehicleMessage={vehicleMessage}
                  vehicleLoading={vehicleLoading}
                  lookupVehicle={lookupVehicle}
                />
              </>
            }
          />

          <Route
            path="*"
            element={
              <>
                <PageHeader
                  title="Page not found"
                  subtitle="The requested page does not exist."
                />
                <NavLink to="/">Return to overview</NavLink>
              </>
            }
          />
        </Routes>
      </main>

      <AgentDrawer
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        updateStatus={updateStatus}
        updatingAgentId={updatingAgentId}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DashboardPages />
    </BrowserRouter>
  );
}
