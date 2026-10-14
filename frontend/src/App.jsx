import { useEffect, useState, useCallback, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
  useNavigate,
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

const API = `${import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000"}/api/v1`;

// RN1 Corridor Coordinates (Coyah Junction to Dubréka Checkpoint)
const RN1_CORRIDOR_COORDS = [
  [9.6412, -13.5784], // Coyah Junction (MD)
  [9.6505, -13.5500], // RN1 middle
  [9.6650, -13.5250], // RN1 middle
  [9.6803, -13.5104], // Dubréka Checkpoint (AC / OK)
];


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

const getAgentVisual = (agent, filter = "all") => {
  const status = agent?.status || "On Mission";
  let fill = "#2563eb";
  let stroke = "#ffffff";
  let textColor = "#ffffff";
  let hasHalo = false;
  let isOffline = false;

  if (status === "On Mission") {
    fill = "#2563eb";
    stroke = "#ffffff";
    textColor = "#ffffff";
    hasHalo = true;
  } else if (status === "Inspecting") {
    fill = "#10b981";
    stroke = "#ffffff";
    textColor = "#ffffff";
    hasHalo = true;
  } else if (status === "Available" || status === "On Duty") {
    fill = "#059669";
    stroke = "#ffffff";
    textColor = "#ffffff";
    hasHalo = false;
  } else if (status === "Break") {
    fill = "#d97706";
    stroke = "#ffffff";
    textColor = "#ffffff";
    hasHalo = false;
  } else if (status === "Emergency") {
    fill = "#dc2626";
    stroke = "#ffffff";
    textColor = "#ffffff";
    hasHalo = true;
  } else if (status === "Offline") {
    fill = "#cbd5e1";
    stroke = "#475569";
    textColor = "#1e293b";
    hasHalo = false;
    isOffline = true;
  }

  let opacity = 1;
  if (filter === "active") {
    const isActive = ["On Mission", "Inspecting", "On Duty", "Available"].includes(status);
    opacity = isActive ? 1 : 0.22;
  } else if (filter === "emergencies") {
    const isEmerg = status === "Emergency";
    opacity = isEmerg ? 1 : 0.22;
  }

  return { fill, stroke, textColor, hasHalo, isOffline, opacity, status };
};

// Custom Leaflet DivIcon matching PDF 2
const createAgentMarkerIcon = (agent) => {
  const initials = getInitials(agent.name);
  let bg = "#0891b2";
  if (agent.status === "On Mission") bg = "#2563eb";
  else if (agent.status === "Inspecting") bg = "#10b981";
  else if (agent.status === "Available" || agent.status === "On Duty") bg = "#10b981";
  else if (agent.status === "Offline") bg = "#475569";
  else if (agent.status === "Break") bg = "#f59e0b";

  return L.divIcon({
    className: "agent-marker-div",
    html: `
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${bg}; color: #fff; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: pointer;">
        ${initials}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const createCheckpointIcon = (label, color = "#059669") =>
  L.divIcon({
    className: "checkpoint-div",
    html: `
      <div style="background: ${color}; color: #ffffff; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #ffffff; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
        ${label}
      </div>
    `,
    iconSize: [90, 20],
    iconAnchor: [45, 10],
  });

/* ==================== SIDEBAR ==================== */
function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand-section">
        <div className="brand-logo-stripes">
          <div className="brand-stripe red" />
          <div className="brand-stripe yellow" />
          <div className="brand-stripe green" />
        </div>
        <div className="brand-text">
          <h2>GuinéeRoute</h2>
          <span>ADMIN PLATFORM</span>
        </div>
        <div style={{ marginLeft: "auto", opacity: 0.35, display: "flex", alignItems: "center" }} title="Toggle sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </div>
      </div>

      <nav className="sidebar-navigation" aria-label="Main navigation">
        <div className="nav-category">COMMAND</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </span>
          Dashboard
        </NavLink>
        <NavLink
          to="/surveillance"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
          </span>
          Live Map
        </NavLink>

        <div className="nav-category">OPERATIONS</div>
        <NavLink
          to="/missions"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </span>
          Missions
          <span className="nav-item-pill blue">8</span>
        </NavLink>
        <NavLink
          to="/agents"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </span>
          Agents
        </NavLink>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </span>
          Emergencies
          <span className="nav-item-pill red">1</span>
        </div>

        <div className="nav-category">ROAD MANAGEMENT</div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          </span>
          Roads
        </div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </span>
          Damage Reports
          <span className="nav-item-pill blue">27</span>
        </div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </span>
          Repairs
        </div>

        <div className="nav-category">ENFORCEMENT</div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
          </span>
          Violations
        </div>
        <NavLink
          to="/vehicles"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </span>
          Vehicles
        </NavLink>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
              <line x1="9" y1="6" x2="9.01" y2="6"/>
              <line x1="15" y1="6" x2="15.01" y2="6"/>
              <line x1="9" y1="10" x2="9.01" y2="10"/>
              <line x1="15" y1="10" x2="15.01" y2="10"/>
              <line x1="9" y1="14" x2="9.01" y2="14"/>
              <line x1="15" y1="14" x2="15.01" y2="14"/>
              <line x1="9" y1="18" x2="15" y2="18"/>
            </svg>
          </span>
          Companies
        </div>

        <div className="nav-category">FINANCE</div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </span>
          Fines
        </div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </span>
          Payments
        </div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M3 9l9-4 9 4M3 9l4 7h-8l4-7zM21 9l-4 7h8l-4-7z"/>
            </svg>
          </span>
          Reconciliation
        </div>

        <div className="nav-category">ANALYTICS</div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          Reports
        </div>

        <div className="nav-category">ADMINISTRATION</div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </span>
          Users
        </div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </span>
          Roles
        </div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </span>
          Geography
        </div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          Configuration
        </div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </span>
          Integrations
        </div>
        <div className="nav-item" style={{ cursor: "default" }}>
          <span className="nav-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </span>
          Audit Logs
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-avatar-circle" style={{ background: "#1a463b", color: "#fff", fontWeight: 800 }}>
          IC
        </div>
        <div className="user-info">
          <strong>Ibrahima Camara</strong>
          <small>National Supervisor</small>
        </div>
      </div>
    </aside>
  );
}

/* ==================== TOP BAR (Dashboard Screen.pdf) ==================== */
function Topbar({
  title = "Dashboard",
  searchQuery = "",
  setSearchQuery,
  agents = [],
  missions = [],
  onSelectAgent,
  onSelectMission,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  const trimmedQuery = (searchQuery || "").trim().toLowerCase();

  const matchingAgents = trimmedQuery
    ? agents.filter((ag) =>
        (ag.name || "").toLowerCase().includes(trimmedQuery) ||
        (ag.badge_number || "").toLowerCase().includes(trimmedQuery) ||
        (ag.status || "").toLowerCase().includes(trimmedQuery) ||
        (ag.location || "").toLowerCase().includes(trimmedQuery)
      ).slice(0, 4)
    : [];

  const matchingMissions = trimmedQuery
    ? missions.filter((m) =>
        (m.mission_code || "").toLowerCase().includes(trimmedQuery) ||
        (m.road_name || "").toLowerCase().includes(trimmedQuery) ||
        (m.route || "").toLowerCase().includes(trimmedQuery) ||
        (m.agent_name || "").toLowerCase().includes(trimmedQuery)
      ).slice(0, 3)
    : [];

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
          <span>{title}</span>
        </div>

        <div className="global-search-pill" ref={searchRef}>
          <input
            type="search"
            placeholder="Search agent, mission, road, vehicle, case…"
            aria-label="Search"
            value={searchQuery || ""}
            onChange={(e) => {
              if (setSearchQuery) setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                if (setSearchQuery) setSearchQuery("");
                setShowDropdown(false);
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {showDropdown && trimmedQuery && (
            <div className="search-autocomplete-dropdown">
              {matchingAgents.length > 0 && (
                <>
                  <div className="search-dropdown-section-title">Field Agents</div>
                  {matchingAgents.map((ag) => (
                    <div
                      key={ag.id}
                      className="search-dropdown-item"
                      onClick={() => {
                        if (onSelectAgent) onSelectAgent(ag);
                        setShowDropdown(false);
                      }}
                    >
                      <div>
                        <strong>{ag.name}</strong> · <small>{ag.badge_number}</small>
                        <div style={{ fontSize: "10.5px", color: "#64748b" }}>{ag.location}</div>
                      </div>
                      <span className="badge-status-dot blue" style={{ fontSize: "10px" }}>
                        {ag.status}
                      </span>
                    </div>
                  ))}
                </>
              )}

              {matchingMissions.length > 0 && (
                <>
                  <div className="search-dropdown-section-title">Corridor Missions</div>
                  {matchingMissions.map((m) => (
                    <div
                      key={m.id}
                      className="search-dropdown-item"
                      onClick={() => {
                        if (onSelectMission) onSelectMission(m);
                        setShowDropdown(false);
                      }}
                    >
                      <div>
                        <strong style={{ color: "#2563eb" }}>GR-MSN-2026-{m.mission_code}</strong>
                        <div style={{ fontSize: "10.5px", color: "#64748b" }}>{m.road_name} · {m.route}</div>
                      </div>
                      <span className="badge-status-dot green" style={{ fontSize: "10px" }}>
                        {m.status || "In Progress"}
                      </span>
                    </div>
                  ))}
                </>
              )}

              <div className="search-dropdown-section-title">Vehicle Registry Lookup</div>
              <div
                className="search-dropdown-item"
                style={{ background: "#ecfdf5", borderTop: "1px solid #d1fae5" }}
                onClick={() => {
                  navigate(`/vehicles`);
                  setShowDropdown(false);
                }}
              >
                <div>
                  <strong style={{ color: "#059669" }}>🔍 Lookup vehicle "{searchQuery}"</strong>
                  <div style={{ fontSize: "10px", color: "#64748b" }}>Check registration &amp; unpaid fines in PostgreSQL</div>
                </div>
                <span style={{ fontSize: "12px", color: "#059669", fontWeight: 700 }}>→</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-lang-btn" title="Language selection">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>EN</span>
        </div>

        <div className="topbar-notification-btn" title="Notifications">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="notification-badge-dot" />
        </div>

        <div className="topbar-divider" />

        <div className="topbar-user">
          <div className="user-avatar-circle" style={{ width: "28px", height: "28px", background: "#dcfce7", color: "#059669", fontWeight: 800, fontSize: "11px", border: "1px solid #bbf7d0" }}>
            IC
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontWeight: 700, fontSize: "12px", color: "#0f172a" }}>Ibrahima Camara</span>
            <span style={{ fontSize: "10px", color: "#64748b" }}>National Supervisor</span>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "2px" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
    </header>
  );
}

/* ==================== DASHBOARD SUBHEADER (Dashboard Screen.pdf) ==================== */
function DashboardSubheader() {
  return (
    <div style={{ background: "#ffffff", padding: "14px 24px 6px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #f1f5f9" }}>
      <div>
        <div style={{ fontSize: "9.5px", fontWeight: 700, letterSpacing: "1px", color: "#94a3b8", textTransform: "uppercase" }}>
          COMMAND / DASHBOARD
        </div>
        <h1 style={{ margin: "2px 0 0", fontSize: "19px", fontWeight: 800, color: "#0f172a" }}>
          Command Dashboard
        </h1>
        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
          National road surveillance operations overview
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingBottom: "2px" }}>
        <div className="live-badge-pill">
          <span className="live-dot-pulse" />
          <span>Live Operations</span>
        </div>
        <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 500 }}>
          05 October 2026 · 10:42:16
        </span>
      </div>
    </div>
  );
}

/* ==================== FILTER STRIP (PDF 3) ==================== */
function DashboardFilterBar({
  agentStatusFilter = "all",
  setAgentStatusFilter,
  roadFilter = "all",
  setRoadFilter,
  regionFilter = "all",
  setRegionFilter,
  supervisorFilter = "all",
  setSupervisorFilter,
  onResetFilters,
  isFiltered,
}) {
  return (
    <div className="dashboard-filter-bar">
      <div className="filter-select-wrapper">
        <div className="filter-select-input" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span>📅</span>
          <span>Date: 05 October 2026</span>
        </div>
      </div>

      <div className="filter-select-wrapper">
        <select
          className="filter-select-input"
          value={roadFilter}
          onChange={(e) => setRoadFilter && setRoadFilter(e.target.value)}
          aria-label="Filter by Road"
        >
          <option value="all">All Guinea (All Roads)</option>
          <option value="RN1">RN1 Highway</option>
          <option value="R. Le Prince">R. Le Prince</option>
          <option value="RN3">RN3 Highway</option>
        </select>
        <span className="filter-select-chevron">⌄</span>
      </div>

      <div className="filter-select-wrapper">
        <select
          className="filter-select-input"
          value={regionFilter}
          onChange={(e) => setRegionFilter && setRegionFilter(e.target.value)}
          aria-label="Filter by Region"
        >
          <option value="all">All Regions</option>
          <option value="Conakry">Conakry</option>
          <option value="Kindia">Kindia</option>
          <option value="Dubréka">Dubréka</option>
          <option value="Coyah">Coyah</option>
        </select>
        <span className="filter-select-chevron">⌄</span>
      </div>

      <div className="filter-select-wrapper">
        <select
          className="filter-select-input"
          value={supervisorFilter}
          onChange={(e) => setSupervisorFilter && setSupervisorFilter(e.target.value)}
          aria-label="Filter by Supervisor"
        >
          <option value="all">All Supervisors</option>
          <option value="Ibrahima Camara">Ibrahima Camara (National)</option>
          <option value="Fatoumata Binta">Fatoumata Binta (Kindia)</option>
        </select>
        <span className="filter-select-chevron">⌄</span>
      </div>

      <div className="filter-select-wrapper">
        <select
          className="filter-select-input"
          value={agentStatusFilter}
          onChange={(e) => setAgentStatusFilter && setAgentStatusFilter(e.target.value)}
          aria-label="Filter by Agent Status"
        >
          <option value="all">Agent Status: All</option>
          <option value="On Mission">On Mission</option>
          <option value="Inspecting">Inspecting</option>
          <option value="Available">Available</option>
          <option value="On Duty">On Duty</option>
          <option value="Break">Break</option>
          <option value="Offline">Offline</option>
        </select>
        <span className="filter-select-chevron">⌄</span>
      </div>

      {isFiltered && (
        <button
          type="button"
          className="clear-filter-btn"
          onClick={onResetFilters}
          title="Reset all filters"
        >
          ✕ Reset Filters
        </button>
      )}

      <button
        type="button"
        className="filter-btn no-print"
        onClick={() => window.print()}
        style={{ marginLeft: "auto", background: "#f8fafc", fontWeight: 700, color: "#2563eb", borderColor: "#bfdbfe" }}
        title="Print or Export Dashboard as PDF"
      >
        <span>📄</span>
        <span>Export PDF</span>
      </button>
    </div>
  );
}

/* ==================== 6 TOP KPI CARDS (Dashboard Screen.pdf) ==================== */
function KpiCardsRow({ stats }) {
  return (
    <section className="kpi-row-grid">
      <div className="kpi-card-white">
        <span className="kpi-card-title">Agents Online</span>
        <div className="kpi-card-value-row">
          <span className="kpi-card-value">{stats?.agents_online ?? 42}</span>
          <span style={{ color: "#059669", background: "#ecfdf5", padding: "1px 6px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 700 }}>
            +3
          </span>
        </div>
        <span className="kpi-card-subtext">{stats?.agents_on_duty ?? 48} on duty today</span>
      </div>

      <div className="kpi-card-white">
        <span className="kpi-card-title">Active Missions</span>
        <div className="kpi-card-value-row">
          <span className="kpi-card-value">{stats?.active_missions ?? 18}</span>
          <span style={{ color: "#059669", background: "#ecfdf5", padding: "1px 6px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 700 }}>
            +1
          </span>
        </div>
        <span className="kpi-card-subtext">31 assigned today</span>
      </div>

      <div className="kpi-card-white">
        <span className="kpi-card-title">Reports Today</span>
        <div className="kpi-card-value-row">
          <span className="kpi-card-value">{stats?.reports_today ?? 27}</span>
          <span style={{ color: "#dc2626", background: "#fef2f2", padding: "1px 6px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 700 }}>
            +6
          </span>
        </div>
        <span className="kpi-card-subtext">5 severe / critical</span>
      </div>

      <div className="kpi-card-white">
        <span className="kpi-card-title">Violations Today</span>
        <div className="kpi-card-value-row">
          <span className="kpi-card-value">{stats?.violations_today ?? 19}</span>
          <span style={{ color: "#d97706", background: "#fffbeb", padding: "1px 6px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 700 }}>
            +2
          </span>
        </div>
        <span className="kpi-card-subtext">4 heavy vehicle</span>
      </div>

      <div className="kpi-card-white">
        <span className="kpi-card-title">Fine Value Issued</span>
        <div className="kpi-card-value-row">
          <span className="kpi-card-value" style={{ fontSize: "19px" }}>
            GNF 12.85M
          </span>
        </div>
        <span className="kpi-card-subtext">Today</span>
      </div>

      <div className="kpi-card-white">
        <span className="kpi-card-title">Cash Collected</span>
        <div className="kpi-card-value-row">
          <span className="kpi-card-value" style={{ fontSize: "19px" }}>
            GNF 5.40M
          </span>
        </div>
        <span className="kpi-card-subtext">GNF 1.25M pending</span>
      </div>
    </section>
  );
}

/* ==================== LIVE FIELD OPERATIONS VECTOR MAP (IMAGE 1 & PDF 2) ==================== */
function LiveFieldOperationsVectorMap({ agents = [], stats, onSelectAgent }) {
  const [filter, setFilter] = useState("all");

  const mdAgent = agents.find((a) => a.badge_number === "AGT-1048" || a.name?.includes("Mamadou")) || agents[0];
  const abAgent = agents.find((a) => a.badge_number === "AGT-1052" || a.name?.includes("Aissatou")) || agents[1];
  const acAgent = agents.find((a) => a.badge_number === "AGT-1061" || a.name?.includes("Alpha")) || agents[2];
  const mcAgent = agents.find((a) => a.badge_number === "AGT-1067" || a.name?.includes("Mariama")) || agents[3];
  const okAgent = agents.find((a) => a.badge_number === "AGT-1073" || a.name?.includes("Oumar")) || agents[4];
  const stAgent = agents.find((a) => a.badge_number === "AGT-1080" || a.name?.includes("Sékou")) || agents[5];

  const mdVis = getAgentVisual(mdAgent, filter);
  const abVis = getAgentVisual(abAgent, filter);
  const acVis = getAgentVisual(acAgent, filter);
  const mcVis = getAgentVisual(mcAgent, filter);
  const okVis = getAgentVisual(okAgent, filter);
  const stVis = getAgentVisual(stAgent, filter);

  return (
    <div className="card-white" style={{ background: "#081714", borderRadius: "8px", overflow: "hidden", border: "1px solid #14382e", position: "relative" }}>
      {/* Dark Forest Green Header matching Image 1 */}
      <div style={{ background: "#0f2b24", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", display: "inline-block" }} />
          <span style={{ fontWeight: 800, fontSize: "13px", color: "#ffffff", letterSpacing: "-0.2px" }}>Live Field Operations</span>
          <span style={{ color: "#4f756a", fontSize: "11px" }}>·</span>
          <span style={{ color: "#688b81", fontSize: "11px" }}>Updated 20 sec ago</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ background: "rgba(16, 185, 129, 0.14)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "2.5px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>
            {stats?.agents_online ?? 42} Agents
          </span>
          <span style={{ background: "rgba(2, 132, 199, 0.14)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "2.5px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>
            {stats?.active_missions ?? 18} Missions
          </span>
        </div>
      </div>

      {/* Map Canvas with SVG Vector Highway matching Image 1 */}
      <div style={{ height: "245px", width: "100%", position: "relative", overflow: "hidden", background: "#081714" }}>
        {/* Floating Filter Pills on Top Left */}
        <div style={{ position: "absolute", top: "10px", left: "12px", zIndex: 10, display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setFilter("all")}
            style={{
              background: filter === "all" ? "#059669" : "rgba(11, 35, 29, 0.75)",
              color: filter === "all" ? "#ffffff" : "#8fa89d",
              border: filter === "all" ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "99px",
              padding: "3.5px 14px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            style={{
              background: filter === "active" ? "#059669" : "rgba(11, 35, 29, 0.75)",
              color: filter === "active" ? "#ffffff" : "#8fa89d",
              border: filter === "active" ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "99px",
              padding: "3.5px 12px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setFilter("emergencies")}
            style={{
              background: filter === "emergencies" ? "#ef4444" : "rgba(11, 35, 29, 0.75)",
              color: filter === "emergencies" ? "#ffffff" : "#8fa89d",
              border: filter === "emergencies" ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "99px",
              padding: "3.5px 12px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Emergencies
          </button>
        </div>

        {/* The Vector Road Network SVG matching Image 1 */}
        <svg
          viewBox="0 0 800 240"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <defs>
            <pattern id="surveillanceGrid" width="45" height="45" patternUnits="userSpaceOnUse">
              <path d="M 45 0 L 0 0 0 45" fill="none" stroke="#0e2820" strokeWidth="0.8" opacity="0.5" />
            </pattern>
            <radialGradient id="radarGlowMD" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={mdVis.fill} stopOpacity="0.32" />
              <stop offset="100%" stopColor={mdVis.fill} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Grid pattern background */}
          <rect width="100%" height="100%" fill="#081714" />
          <rect width="100%" height="100%" fill="url(#surveillanceGrid)" />

          {/* Glow effect behind active inspector MD */}
          {mdVis.hasHalo && (
            <circle cx="238" cy="142" r="62" fill="url(#radarGlowMD)" opacity={mdVis.opacity} />
          )}

          {/* Minor connecting road paths */}
          <path d="M 238 142 Q 180 162 140 185" fill="none" stroke="#123b31" strokeWidth="2.2" opacity={mcVis.opacity} />
          <path d="M 410 122 Q 380 175 360 220" fill="none" stroke="#123b31" strokeWidth="2.2" opacity={stVis.opacity} />
          <path d="M 540 192 Q 680 182 800 192" fill="none" stroke="#14362d" strokeWidth="3" />
          <text x="750" y="182" fill="#2d5248" fontSize="9.5" fontWeight="700">RN3</text>

          {/* Main RN1 Highway corridor */}
          <path
            d="M -10 152 Q 200 142 410 122 T 810 150"
            fill="none"
            stroke="#163f34"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <path
            d="M -10 152 Q 200 142 410 122 T 810 150"
            fill="none"
            stroke="#0a211b"
            strokeWidth="7"
          />

          {/* Green Active Road Segment on left between A and MD */}
          <path
            d="M 24 151 Q 120 146 238 142"
            fill="none"
            stroke={filter === "emergencies" ? "#ef4444" : "#10b981"}
            strokeWidth="6"
            strokeLinecap="round"
            style={{ transition: "stroke 0.3s ease" }}
          />

          {/* RN1 Highway Label */}
          <text x="424" y="117" fill="#4d7268" fontSize="10" fontWeight="700">RN1</text>

          {/* Branch Highway: R. PRINCE */}
          <path
            d="M 410 122 Q 380 68 338 28"
            fill="none"
            stroke="#163f34"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M 410 122 Q 380 68 338 28"
            fill="none"
            stroke="#2563eb"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <text
            x="346"
            y="76"
            transform="rotate(-54 346 76)"
            fill="#38bdf8"
            fontSize="9"
            fontWeight="700"
            letterSpacing="0.5px"
          >
            R. PRINCE
          </text>

          {/* MARKERS WITH DYNAMIC STATUS COLORS */}
          {/* Checkpoint A */}
          <g style={{ cursor: "pointer" }} onClick={() => onSelectAgent && onSelectAgent(mdAgent)}>
            <circle cx="24" cy="151" r="11" fill="#10b981" />
            <text x="24" y="155" fill="#ffffff" fontSize="10" fontWeight="800" textAnchor="middle">A</text>
          </g>

          {/* Marker MC (Mariama Camara) */}
          <g
            style={{ cursor: "pointer", opacity: mcVis.opacity, transition: "opacity 0.2s ease" }}
            onClick={() => onSelectAgent && onSelectAgent(mcAgent)}
          >
            {mcVis.hasHalo && (
              <circle cx="140" cy="185" r="17" fill="none" stroke={mcVis.fill} strokeWidth="1.5" opacity="0.35" />
            )}
            <circle cx="140" cy="185" r="11" fill={mcVis.fill} stroke={mcVis.stroke} strokeWidth="1.5" />
            <text x="140" y="189" fill={mcVis.textColor} fontSize="9.5" fontWeight="800" textAnchor="middle">MC</text>
            {mcVis.isOffline && <circle cx="149" cy="176" r="3.5" fill="#ffffff" stroke="#475569" strokeWidth="1" />}
          </g>

          {/* Marker MD (Mamadou Diallo) */}
          <g
            style={{ cursor: "pointer", opacity: mdVis.opacity, transition: "opacity 0.2s ease" }}
            onClick={() => onSelectAgent && onSelectAgent(mdAgent)}
          >
            {mdVis.hasHalo && (
              <>
                <circle cx="238" cy="142" r="22" fill="none" stroke={mdVis.fill} strokeWidth="1.5" opacity="0.4" />
                <circle cx="238" cy="142" r="17" fill={mdVis.fill} opacity="0.2" />
              </>
            )}
            <circle cx="238" cy="142" r="12" fill={mdVis.fill} stroke={mdVis.stroke} strokeWidth="1.5" />
            <text x="238" y="146" fill={mdVis.textColor} fontSize="10" fontWeight="800" textAnchor="middle">MD</text>
            {mdVis.isOffline && <circle cx="247" cy="133" r="3.5" fill="#ffffff" stroke="#475569" strokeWidth="1" />}
          </g>

          {/* Warning Marker ! (west of AB) */}
          <g style={{ cursor: "pointer" }}>
            {filter === "emergencies" && (
              <circle cx="312" cy="132" r="16" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.8">
                <animate attributeName="r" values="12;20;12" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx="312" cy="132" r={filter === "emergencies" ? "10" : "8"} fill={filter === "emergencies" ? "#ef4444" : "#f59e0b"} stroke="#ffffff" strokeWidth="1.2" />
            <text x="312" y="136" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">!</text>
          </g>

          {/* Marker AB (Aissatou Bah) */}
          <g
            style={{ cursor: "pointer", opacity: abVis.opacity, transition: "opacity 0.2s ease" }}
            onClick={() => onSelectAgent && onSelectAgent(abAgent)}
          >
            {abVis.hasHalo && (
              <circle cx="410" cy="122" r="16" fill="none" stroke={abVis.fill} strokeWidth="1.5" opacity="0.35" />
            )}
            <circle cx="410" cy="122" r="11" fill={abVis.fill} stroke={abVis.stroke} strokeWidth="1.5" />
            <text x="410" y="126" fill={abVis.textColor} fontSize="9.5" fontWeight="800" textAnchor="middle">AB</text>
            {abVis.isOffline && <circle cx="419" cy="113" r="3.5" fill="#ffffff" stroke="#475569" strokeWidth="1" />}
          </g>

          {/* Warning Marker ! (east of AB) */}
          <g style={{ cursor: "pointer" }}>
            {filter === "emergencies" && (
              <circle cx="458" cy="126" r="16" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.8">
                <animate attributeName="r" values="12;20;12" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx="458" cy="126" r={filter === "emergencies" ? "10" : "8"} fill={filter === "emergencies" ? "#ef4444" : "#f59e0b"} stroke="#ffffff" strokeWidth="1.2" />
            <text x="458" y="130" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">!</text>
          </g>

          {/* Marker AC (Alpha Condé) */}
          <g
            style={{ cursor: "pointer", opacity: acVis.opacity, transition: "opacity 0.2s ease" }}
            onClick={() => onSelectAgent && onSelectAgent(acAgent)}
          >
            {acVis.hasHalo && (
              <circle cx="580" cy="134" r="16" fill="none" stroke={acVis.fill} strokeWidth="1.5" opacity="0.35" />
            )}
            <circle cx="580" cy="134" r="11" fill={acVis.fill} stroke={acVis.stroke} strokeWidth="1.5" />
            <text x="580" y="138" fill={acVis.textColor} fontSize="9.5" fontWeight="800" textAnchor="middle">AC</text>
            {acVis.isOffline && <circle cx="589" cy="125" r="3.5" fill="#ffffff" stroke="#475569" strokeWidth="1" />}
          </g>

          {/* Marker OK (Oumar Kouyaté) */}
          <g
            style={{ cursor: "pointer", opacity: okVis.opacity, transition: "opacity 0.2s ease" }}
            onClick={() => onSelectAgent && onSelectAgent(okAgent)}
          >
            {okVis.hasHalo && (
              <circle cx="702" cy="150" r="16" fill="none" stroke={okVis.fill} strokeWidth="1.5" opacity="0.35" />
            )}
            <circle cx="702" cy="150" r="11" fill={okVis.fill} stroke={okVis.stroke} strokeWidth="1.5" />
            <text x="702" y="154" fill={okVis.textColor} fontSize="9.5" fontWeight="800" textAnchor="middle">OK</text>
            {okVis.isOffline && <circle cx="711" cy="141" r="3.5" fill="#ffffff" stroke="#475569" strokeWidth="1" />}
          </g>

          {/* Marker ST (Sékou Touré) */}
          <g
            style={{ cursor: "pointer", opacity: stVis.opacity, transition: "opacity 0.2s ease" }}
            onClick={() => onSelectAgent && onSelectAgent(stAgent)}
          >
            {stVis.hasHalo && (
              <circle cx="360" cy="220" r="16" fill="none" stroke={stVis.fill} strokeWidth="1.5" opacity="0.35" />
            )}
            <circle cx="360" cy="220" r="11" fill={stVis.fill} stroke={stVis.stroke} strokeWidth="1.5" />
            <text x="360" y="224" fill={stVis.textColor} fontSize="9.5" fontWeight="800" textAnchor="middle">ST</text>
            {stVis.isOffline && <circle cx="369" cy="211" r="3.5" fill="#ffffff" stroke="#475569" strokeWidth="1" />}
          </g>
        </svg>

        {/* Floating Bottom Legend */}
        <div style={{
          position: "absolute",
          bottom: "10px",
          left: "12px",
          zIndex: 10,
          background: "rgba(9, 26, 21, 0.88)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "6px",
          padding: "4px 12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "10.5px",
          color: "#cbd5e1"
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563eb" }} />
            On Mission
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
            Inspecting
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#059669" }} />
            Available
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }} />
            Break
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#94a3b8" }} />
            Offline
          </span>
        </div>
      </div>
    </div>
  );
}

/* ==================== LIVE OPERATIONS MAP SCREEN (PDF 2) ==================== */
function LiveOperationsMapScreen({
  agents,
  stats,
  missions,
  onSelectAgent,
  selectedAgent,
  selectedMission,
  isDrawerOpen,
  onCloseDrawer,
  updateStatus,
  updatingAgentId,
}) {
  const [mapMode, setMapMode] = useState("vector"); // vector | satellite
  const [activeLayer, setActiveLayer] = useState("missions");
  const [zoomLevel, setZoomLevel] = useState(1);

  const mdAgent = agents.find((a) => a.badge_number === "AGT-1048" || a.name?.includes("Mamadou")) || agents[0];
  const abAgent = agents.find((a) => a.badge_number === "AGT-1052" || a.name?.includes("Aissatou")) || agents[1];
  const acAgent = agents.find((a) => a.badge_number === "AGT-1061" || a.name?.includes("Alpha")) || agents[2];
  const mcAgent = agents.find((a) => a.badge_number === "AGT-1067" || a.name?.includes("Mariama")) || agents[3];
  const okAgent = agents.find((a) => a.badge_number === "AGT-1073" || a.name?.includes("Oumar")) || agents[4];
  const stAgent = agents.find((a) => a.badge_number === "AGT-1080" || a.name?.includes("Sékou")) || agents[5];

  const layerFilter = activeLayer === "emergencies" ? "emergencies" : "all";
  const mdVis = getAgentVisual(mdAgent, layerFilter);
  const abVis = getAgentVisual(abAgent, layerFilter);
  const acVis = getAgentVisual(acAgent, layerFilter);
  const mcVis = getAgentVisual(mcAgent, layerFilter);
  const okVis = getAgentVisual(okAgent, layerFilter);
  const stVis = getAgentVisual(stAgent, layerFilter);

  const currentAgent =
    selectedAgent ||
    agents[0] || {
      id: 1,
      name: "Mamadou Diallo",
      badge_number: "AGT-1048",
      status: "On Mission",
    };

  const currentMission =
    selectedMission ||
    (missions && missions.find((m) => m.agent_id === currentAgent.id)) ||
    (missions && missions[0]) || {
      mission_code: "00984",
      road_name: "RN1",
      route: "Coyah Junction → Dubréka",
      total_km: 18.6,
      covered_km: 7.4,
      violations: 2,
      duration_text: "00h 52m",
    };

  const routeParts = currentMission.route
    ? currentMission.route.split(/→|->/)
    : ["Coyah Junction", "Dubréka Checkpoint"];
  const fromName = routeParts[0]?.trim() || "Coyah Junction";
  const toName = routeParts[1]?.trim() || "Dubréka Checkpoint";
  const totalKm = Number(currentMission.total_km) || 18.6;
  const coveredKm = Number(currentMission.covered_km) || 7.4;
  const remainingKm = Math.max(0, totalKm - coveredKm).toFixed(1);
  const progressPct = totalKm > 0 ? Math.round((coveredKm / totalKm) * 100) : 40;
  const missionCodeFormatted = String(currentMission.mission_code || "00984").startsWith("GR")
    ? currentMission.mission_code
    : `GR-MSN-2026-${currentMission.mission_code || "00984"}`;

  return (
    <div className="live-map-screen-wrapper">
      {/* Subheader matching Image 2 */}
      <div style={{ background: "#ffffff", padding: "12px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #f1f5f9" }}>
        <div>
          <div style={{ fontSize: "9.5px", fontWeight: 700, letterSpacing: "1px", color: "#94a3b8", textTransform: "uppercase" }}>
            COMMAND / LIVE OPERATIONS MAP
          </div>
          <h1 style={{ margin: "2px 0 0", fontSize: "19px", fontWeight: 800, color: "#0f172a" }}>
            Live Operations Map
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
            Monitor field agents, missions, incidents and road-surveillance in real time.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ background: "rgba(16, 185, 129, 0.12)", color: "#059669", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "4px 10px", borderRadius: "99px", fontSize: "11.5px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
            Live · 10:42:18
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "4px 10px", borderRadius: "6px", fontSize: "11.5px", fontWeight: 600, color: "#475569" }}>
            National View
          </div>
        </div>
      </div>

      {/* Filter Row matching Image 2 */}
      <div style={{ background: "#ffffff", padding: "8px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <div className="filter-btn" style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <span>All Guinée</span>
            <span style={{ fontSize: "9px" }}>⌄</span>
          </div>
          <div className="filter-btn" style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <span>Region</span>
            <span style={{ fontSize: "9px" }}>⌄</span>
          </div>
          <div className="filter-btn" style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <span>Agent Status</span>
            <span style={{ fontSize: "9px" }}>⌄</span>
          </div>
          <div className="filter-btn" style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <span>Mission Status</span>
            <span style={{ fontSize: "9px" }}>⌄</span>
          </div>
          <div className="filter-btn" style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <span>Road</span>
            <span style={{ fontSize: "9px" }}>⌄</span>
          </div>
          <div className="filter-btn" style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <span>More Filters</span>
          </div>
        </div>
        <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
          05 October 2026 · Current Operations
        </div>
      </div>

      {/* Green KPI Bar under Header in PDF 2 & Image 2 */}
      <div className="pdf2-green-kpi-bar">
        <div className="pdf2-kpi-item">
          <span style={{ color: "#10b981" }}>●</span>
          <strong>{stats?.agents_on_duty ?? 48}</strong>
          <span>On Duty</span>
        </div>
        <div className="pdf2-kpi-item">
          <span style={{ color: "#10b981" }}>●</span>
          <strong>{stats?.agents_online ?? 42}</strong>
          <span>Online</span>
        </div>
        <div className="pdf2-kpi-item">
          <span style={{ color: "#38bdf8" }}>●</span>
          <strong>{stats?.active_missions ?? 18}</strong>
          <span>Active Missions</span>
        </div>
        <div className="pdf2-kpi-item">
          <span style={{ color: "#ef4444" }}>●</span>
          <strong>{stats?.open_emergencies ?? 1}</strong>
          <span>Open Emergencies</span>
        </div>
        <div className="pdf2-kpi-item">
          <span style={{ color: "#94a3b8" }}>●</span>
          <strong>{stats?.offline_alerts ?? 6}</strong>
          <span>Offline</span>
        </div>
        <span className="pdf2-updated-right">● Live · Updated 20 sec ago</span>
      </div>

      <div className="map-container-relative" style={{ height: "calc(100vh - 215px)", minHeight: "560px", position: "relative", overflow: "hidden", background: "#081714" }}>
        {/* Floating Top Layers Bar in PDF 2 & Image 2 */}
        <div className="floating-layers-bar">
          <span style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", marginRight: "4px" }}>
            LAYERS
          </span>
          <button type="button" className={`layer-btn-pill ${activeLayer === "agents" ? "active" : ""}`} onClick={() => setActiveLayer(activeLayer === "agents" ? "all" : "agents")}>
            Agents ⌄
          </button>
          <button type="button" className={`layer-btn-pill ${activeLayer === "missions" ? "active" : ""}`} onClick={() => setActiveLayer(activeLayer === "missions" ? "all" : "missions")}>
            Active Missions ⌄
          </button>
          <button type="button" className={`layer-btn-pill ${activeLayer === "emergencies" ? "active" : ""}`} style={{ color: "#ef4444" }} onClick={() => setActiveLayer(activeLayer === "emergencies" ? "all" : "emergencies")}>
            Emergencies ⌄
          </button>
          <button type="button" className={`layer-btn-pill ${activeLayer === "damage" ? "active" : ""}`} onClick={() => setActiveLayer(activeLayer === "damage" ? "all" : "damage")}>▲ Road Damage</button>
          <button type="button" className={`layer-btn-pill ${activeLayer === "violations" ? "active" : ""}`} onClick={() => setActiveLayer(activeLayer === "violations" ? "all" : "violations")}>Violations</button>
          <button type="button" className="layer-btn-pill">Restricted Roads</button>
          <button type="button" className="layer-btn-pill">Heavy vehicles</button>
          <button
            type="button"
            className="layer-btn-pill"
            style={{ marginLeft: "6px", background: mapMode === "satellite" ? "#0284c7" : "rgba(255,255,255,0.08)", color: "#ffffff", borderColor: mapMode === "satellite" ? "#0284c7" : "rgba(255,255,255,0.2)" }}
            onClick={() => setMapMode(mapMode === "vector" ? "satellite" : "vector")}
          >
            {mapMode === "vector" ? "🛰 Satellite" : "🗺 Corridor"}
          </button>
        </div>

        {/* MAP VIEW: Either SVG Vector Corridor (Image 2) OR Satellite Leaflet */}
        {mapMode === "vector" ? (
          <div style={{ width: "100%", height: "100%", position: "relative", background: "#081714", overflow: "hidden" }}>
            {/* Live Operations Header Pill on top-left of canvas matching Image 2 */}
            <div style={{ position: "absolute", top: "54px", left: "20px", zIndex: 500, display: "flex", alignItems: "center", gap: "6px", background: "rgba(11, 35, 29, 0.8)", padding: "4px 10px", borderRadius: "99px", border: "1px solid rgba(255, 255, 255, 0.08)", color: "#10b981", fontSize: "11px", fontWeight: 700 }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              <span>Live Operations · 10:42:18</span>
            </div>

            {/* Vector Highway Network SVG matching Image 2 */}
            <svg
              viewBox="0 0 1000 600"
              preserveAspectRatio="xMidYMid meet"
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                transform: `scale(${zoomLevel})`,
                transformOrigin: "center center",
                transition: "transform 0.25s ease"
              }}
            >
              <defs>
                <pattern id="liveMapGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#0e2820" strokeWidth="0.8" opacity="0.6" />
                </pattern>
                <radialGradient id="radarPulseGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={mdVis.fill} stopOpacity="0.4" />
                  <stop offset="60%" stopColor={mdVis.fill} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={mdVis.fill} stopOpacity="0" />
                </radialGradient>
              </defs>

              <rect width="100%" height="100%" fill="#081714" />
              <rect width="100%" height="100%" fill="url(#liveMapGrid)" />

              {/* Radar glow behind selected or active agent (MD) */}
              {mdVis.hasHalo && (
                <circle cx="280" cy="330" r="75" fill="url(#radarPulseGlow)">
                  <animate attributeName="r" values="60;85;60" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0.3;0.7" dur="3s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Minor road paths */}
              <path d="M 280 330 Q 210 380 160 430" fill="none" stroke="#123b31" strokeWidth="3" opacity={mcVis.opacity} />
              <path d="M 490 280 Q 450 410 420 510" fill="none" stroke="#123b31" strokeWidth="3" opacity={stVis.opacity} />
              <path d="M 660 450 Q 820 420 980 440" fill="none" stroke="#14362d" strokeWidth="3.5" />
              <text x="910" y="430" fill="#2d5248" fontSize="11" fontWeight="700">RN3</text>

              {/* Main Corridor Highway RN1 */}
              <path
                d="M -20 350 Q 240 330 490 280 T 1020 340"
                fill="none"
                stroke="#163f34"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <path
                d="M -20 350 Q 240 330 490 280 T 1020 340"
                fill="none"
                stroke="#09241d"
                strokeWidth="8"
              />

              {/* Active Progress Segment in vibrant green between A and MD */}
              <path
                d="M 30 350 Q 150 340 280 330"
                fill="none"
                stroke={activeLayer === "emergencies" ? "#ef4444" : "#10b981"}
                strokeWidth="7"
                strokeLinecap="round"
                style={{ transition: "stroke 0.3s ease" }}
              />

              {/* Emergency Segment in Red at km 7.4 Coyah */}
              <path
                d="M 280 330 Q 330 320 370 310"
                fill="none"
                stroke="#ef4444"
                strokeWidth="5"
                strokeLinecap="round"
              />

              {/* Damage Segment in Amber */}
              <path
                d="M 540 288 Q 590 295 640 305"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="5"
                strokeLinecap="round"
              />

              {/* RN1 Highway Label */}
              <text x="508" y="270" fill="#4d7268" fontSize="11" fontWeight="700">RN1</text>

              {/* Branch Road: R. PRINCE */}
              <path
                d="M 490 280 Q 450 150 400 60"
                fill="none"
                stroke="#163f34"
                strokeWidth="11"
                strokeLinecap="round"
              />
              <path
                d="M 490 280 Q 450 150 400 60"
                fill="none"
                stroke="#2563eb"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <text
                x="414"
                y="160"
                transform="rotate(-58 414 160)"
                fill="#38bdf8"
                fontSize="11"
                fontWeight="700"
                letterSpacing="1px"
              >
                R. PRINCE
              </text>

              {/* Interactive Markers */}
              {/* Checkpoint A: Coyah Junction */}
              <g style={{ cursor: "pointer" }} onClick={() => onSelectAgent(mdAgent)}>
                <circle cx="30" cy="350" r="14" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                <text x="30" y="355" fill="#ffffff" fontSize="12" fontWeight="800" textAnchor="middle">A</text>
              </g>

              {/* MC: Mariama Camara */}
              <g
                style={{ cursor: "pointer", opacity: mcVis.opacity, transition: "opacity 0.2s ease" }}
                onClick={() => onSelectAgent(mcAgent)}
              >
                {mcVis.hasHalo && (
                  <circle cx="160" cy="430" r="20" fill="none" stroke={mcVis.fill} strokeWidth="1.8" opacity="0.4" />
                )}
                <circle cx="160" cy="430" r="14" fill={mcVis.fill} stroke={mcVis.stroke} strokeWidth="2.5" />
                <text x="160" y="435" fill={mcVis.textColor} fontSize="11" fontWeight="800" textAnchor="middle">MC</text>
                {mcVis.isOffline && <circle cx="171" cy="419" r="4.5" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />}
              </g>

              {/* MD: Mamadou Diallo */}
              <g
                style={{ cursor: "pointer", opacity: mdVis.opacity, transition: "opacity 0.2s ease" }}
                onClick={() => onSelectAgent(mdAgent)}
              >
                {mdVis.hasHalo && (
                  <>
                    <circle cx="280" cy="330" r="26" fill="none" stroke={mdVis.fill} strokeWidth="1.8" opacity="0.5" />
                    <circle cx="280" cy="330" r="20" fill={mdVis.fill} opacity="0.25" />
                  </>
                )}
                <circle cx="280" cy="330" r="14" fill={mdVis.fill} stroke={mdVis.stroke} strokeWidth="2" />
                <text x="280" y="335" fill={mdVis.textColor} fontSize="11.5" fontWeight="800" textAnchor="middle">MD</text>
                {mdVis.isOffline && <circle cx="291" cy="319" r="4.5" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />}
              </g>

              {/* Warning ! marker */}
              <g style={{ cursor: "pointer" }}>
                {activeLayer === "emergencies" && (
                  <circle cx="370" cy="310" r="18" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.8">
                    <animate attributeName="r" values="14;24;14" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx="370" cy="310" r={activeLayer === "emergencies" ? "12" : "9.5"} fill={activeLayer === "emergencies" ? "#ef4444" : "#f59e0b"} stroke="#ffffff" strokeWidth="1.2" />
                <text x="370" y="314" fill="#ffffff" fontSize="10.5" fontWeight="900" textAnchor="middle">!</text>
              </g>

              {/* AB: Aissatou Bah */}
              <g
                style={{ cursor: "pointer", opacity: abVis.opacity, transition: "opacity 0.2s ease" }}
                onClick={() => onSelectAgent(abAgent)}
              >
                {abVis.hasHalo && (
                  <circle cx="490" cy="280" r="20" fill="none" stroke={abVis.fill} strokeWidth="1.8" opacity="0.4" />
                )}
                <circle cx="490" cy="280" r="13" fill={abVis.fill} stroke={abVis.stroke} strokeWidth="2" />
                <text x="490" y="285" fill={abVis.textColor} fontSize="11" fontWeight="800" textAnchor="middle">AB</text>
                {abVis.isOffline && <circle cx="501" cy="269" r="4.5" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />}
              </g>

              {/* AC: Alpha Condé */}
              <g
                style={{ cursor: "pointer", opacity: acVis.opacity, transition: "opacity 0.2s ease" }}
                onClick={() => onSelectAgent(acAgent)}
              >
                {acVis.hasHalo && (
                  <circle cx="680" cy="305" r="20" fill="none" stroke={acVis.fill} strokeWidth="1.8" opacity="0.4" />
                )}
                <circle cx="680" cy="305" r="13" fill={acVis.fill} stroke={acVis.stroke} strokeWidth="2" />
                <text x="680" y="310" fill={acVis.textColor} fontSize="11" fontWeight="800" textAnchor="middle">AC</text>
                {acVis.isOffline && <circle cx="691" cy="294" r="4.5" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />}
              </g>

              {/* OK: Oumar Kouyaté */}
              <g
                style={{ cursor: "pointer", opacity: okVis.opacity, transition: "opacity 0.2s ease" }}
                onClick={() => onSelectAgent(okAgent)}
              >
                {okVis.hasHalo && (
                  <circle cx="830" cy="330" r="20" fill="none" stroke={okVis.fill} strokeWidth="1.8" opacity="0.4" />
                )}
                <circle cx="830" cy="330" r="14" fill={okVis.fill} stroke={okVis.stroke} strokeWidth="2" />
                <text x="830" y="335" fill={okVis.textColor} fontSize="11" fontWeight="800" textAnchor="middle">OK</text>
                {okVis.isOffline && <circle cx="841" cy="319" r="4.5" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />}
              </g>

              {/* ST: Sékou Touré */}
              <g
                style={{ cursor: "pointer", opacity: stVis.opacity, transition: "opacity 0.2s ease" }}
                onClick={() => onSelectAgent(stAgent)}
              >
                {stVis.hasHalo && (
                  <circle cx="420" cy="510" r="20" fill="none" stroke={stVis.fill} strokeWidth="1.8" opacity="0.4" />
                )}
                <circle cx="420" cy="510" r="14" fill={stVis.fill} stroke={stVis.stroke} strokeWidth="2.5" />
                <text x="420" y="515" fill={stVis.textColor} fontSize="11" fontWeight="800" textAnchor="middle">ST</text>
                {stVis.isOffline && <circle cx="431" cy="499" r="4.5" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />}
              </g>
            </svg>
          </div>
        ) : (
          /* Satellite Leaflet Map */
          <MapContainer
            center={[9.662, -13.545]}
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />

            <Polyline
              positions={RN1_CORRIDOR_COORDS}
              pathOptions={{
                color: "#06b6d4",
                weight: 5,
                opacity: 0.9,
              }}
            />

            <Marker position={RN1_CORRIDOR_COORDS[0]} icon={createCheckpointIcon("Coyah Junction", "#059669")}>
              <Popup>
                <strong>Coyah Junction</strong> (Km 0.0)
              </Popup>
            </Marker>

            <Marker position={RN1_CORRIDOR_COORDS[RN1_CORRIDOR_COORDS.length - 1]} icon={createCheckpointIcon("Dubréka Checkpoint", "#2563eb")}>
              <Popup>
                <strong>Dubréka Checkpoint</strong> (Km 18.6)
              </Popup>
            </Marker>

            {agents.map((ag) => {
              const lat = Number(ag.lat);
              const lng = Number(ag.lng);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

              return (
                <Marker
                  key={ag.id}
                  position={[lat, lng]}
                  icon={createAgentMarkerIcon(ag)}
                  eventHandlers={{
                    click: () => onSelectAgent(ag),
                  }}
                >
                  <Popup>
                    <div style={{ color: "#000", minWidth: "150px" }}>
                      <strong>{ag.name}</strong> ({ag.badge_number})
                      <br />
                      Status: <strong>{ag.status}</strong>
                      <br />
                      Location: {ag.location}
                      <br />
                      <button
                        type="button"
                        style={{
                          marginTop: "8px",
                          background: "#059669",
                          color: "#fff",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                        onClick={() => onSelectAgent(ag)}
                      >
                        View Mission Detail →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}

        {/* Floating Tool Rail on Right side matching Image 2 */}
        <div style={{ position: "absolute", right: isDrawerOpen ? "380px" : "20px", top: "50%", transform: "translateY(-50%)", zIndex: 1100, display: "flex", flexDirection: "column", gap: "6px", background: "rgba(11, 35, 29, 0.92)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "8px", padding: "6px 4px", transition: "right 0.2s ease" }}>
          <button type="button" title="Zoom in" onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.2))} style={{ background: "transparent", border: "none", color: "#cbd5e1", width: "32px", height: "30px", fontSize: "16px", cursor: "pointer", borderRadius: "4px" }}>+</button>
          <button type="button" title="Zoom out" onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))} style={{ background: "transparent", border: "none", color: "#cbd5e1", width: "32px", height: "30px", fontSize: "16px", cursor: "pointer", borderRadius: "4px" }}>−</button>
          <button type="button" title="Toggle Layers" onClick={() => setMapMode(mapMode === "vector" ? "satellite" : "vector")} style={{ background: "transparent", border: "none", color: "#cbd5e1", width: "32px", height: "30px", fontSize: "14px", cursor: "pointer", borderRadius: "4px" }}>☲</button>
          <button type="button" title="Center Corridor" onClick={() => setZoomLevel(1)} style={{ background: "transparent", border: "none", color: "#cbd5e1", width: "32px", height: "30px", fontSize: "14px", cursor: "pointer", borderRadius: "4px" }}>◎</button>
          <button type="button" title="Toggle Fullscreen" onClick={() => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen?.(); } else { document.exitFullscreen?.(); } }} style={{ background: "transparent", border: "none", color: "#cbd5e1", width: "32px", height: "30px", fontSize: "14px", cursor: "pointer", borderRadius: "4px" }}>⛶</button>
          <button type="button" title="Bookmarks" onClick={() => alert("Bookmark saved for RN1 corridor coordinates")} style={{ background: "transparent", border: "none", color: "#cbd5e1", width: "32px", height: "30px", fontSize: "14px", cursor: "pointer", borderRadius: "4px" }}>🔖</button>
        </div>

        {/* Floating Legend matching Image 3 */}
        <div className="floating-pdf2-legend">
          <strong style={{ color: "#ffffff", fontSize: "10.5px", letterSpacing: "1px" }}>
            LEGEND
          </strong>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563eb" }} />
            <span>On Mission</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
            <span>Inspecting</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#059669" }} />
            <span>Available</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748b" }} />
            <span>Offline</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
            <span>Emergency</span>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: "5px", marginTop: "2px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "16px", height: "3px", background: "#163f34", borderRadius: "2px" }} />
              <span style={{ fontSize: "10px" }}>Route corridor</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "16px", height: "3px", background: "#10b981", borderRadius: "2px" }} />
              <span style={{ fontSize: "10px" }}>Progress</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "16px", height: "3px", background: "#ef4444", borderRadius: "2px" }} />
              <span style={{ fontSize: "10px" }}>Emergency</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "16px", height: "3px", background: "#f59e0b", borderRadius: "2px" }} />
              <span style={{ fontSize: "10px" }}>Damage</span>
            </div>
          </div>
        </div>

        {/* White Mission Detail Drawer matching Image 4 */}
        {isDrawerOpen && (
          <aside className="pdf2-mission-drawer-white">
            <div className="pdf2-drawer-header">
              <h3>Mission Detail</h3>
              <button
                type="button"
                className="pdf2-drawer-close"
                onClick={onCloseDrawer}
              >
                ✕
              </button>
            </div>

            <div className="pdf2-drawer-content">
              <div>
                <div className="pdf2-mission-code-badge" style={{ color: "#059669" }}>
                  {missionCodeFormatted}
                </div>
                <div className="pdf2-tags-row">
                  <span className="badge-status-dot blue" style={{ background: "#eff6ff", padding: "2px 8px", borderRadius: "4px" }}>
                    ● In Progress
                  </span>
                  <span className="badge-status-dot green" style={{ background: "#ecfdf5", padding: "2px 8px", borderRadius: "4px" }}>
                    ● On Time
                  </span>
                </div>
              </div>

              <div className="pdf2-details-section-title">MISSION DETAILS</div>

              <div className="pdf2-key-val-list">
                <div className="pdf2-kv-row">
                  <span>Agent</span>
                  <strong>{currentAgent.name}</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>Road</span>
                  <strong>{currentMission.road_name || "RN1"}</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>From</span>
                  <strong>{fromName}</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>To</span>
                  <strong>{toName}</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>Total Distance</span>
                  <strong>{totalKm} km</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>Covered</span>
                  <strong style={{ color: "#059669" }}>{coveredKm} km</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>Remaining</span>
                  <strong>{remainingKm} km</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>Started</span>
                  <strong>09:50</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>Duration</span>
                  <strong>{currentMission.duration_text || "00h 52m"}</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>Reports</span>
                  <strong>1</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>Violations</span>
                  <strong style={{ color: "#dc2626" }}>{currentMission.violations ?? 2}</strong>
                </div>
                <div className="pdf2-kv-row">
                  <span>GPS</span>
                  <strong style={{ color: "#059669" }}>Active</strong>
                </div>
              </div>

              {/* Progress bar matching Image 4 */}
              <div style={{ marginTop: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
                  <span>Progress</span>
                  <span style={{ color: "#059669" }}>{progressPct}%</span>
                </div>
                <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progressPct}%`, background: "#059669", transition: "width 0.3s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
                  <span>{fromName}</span>
                  <span>{toName}</span>
                </div>
              </div>

              {/* In-place Agent Status Updater (Calls PATCH /api/v1/agents/:id/status) */}
              <div style={{ marginTop: "8px", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>UPDATE AGENT STATUS</span>
                  {updatingAgentId === currentAgent.id && (
                    <span style={{ fontSize: "10px", color: "#2563eb", fontWeight: 600 }}>Syncing to DB…</span>
                  )}
                </div>
                <select
                  style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", background: "#ffffff", fontWeight: 600, color: "#0f172a" }}
                  value={currentAgent.status || "On Mission"}
                  disabled={updatingAgentId === currentAgent.id}
                  onChange={(e) => updateStatus(currentAgent, e.target.value)}
                >
                  <option value="On Duty">On Duty</option>
                  <option value="On Mission">On Mission</option>
                  <option value="Inspecting">Inspecting</option>
                  <option value="Available">Available</option>
                  <option value="Break">Break</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto", paddingTop: "14px" }}>
                <button
                  type="button"
                  className="btn-green-solid"
                  onClick={() => alert(`Inspecting route corridor for ${missionCodeFormatted}`)}
                >
                  View Mission →
                </button>
                <button
                  type="button"
                  className="btn-outline-grey"
                  onClick={onCloseDrawer}
                >
                  View Agent →
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/* ==================== FIELD AGENT MOBILE APP (PDF 4) ==================== */
function FieldAgentMobileApp({
  agent,
  updateStatus,
  onClose,
}) {
  const [mobileTab, setMobileTab] = useState("home"); // home | shift | lookup
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakOption, setBreakOption] = useState("Short break (15 min)");
  const [plateQuery, setPlateQuery] = useState("RC 8245 AB");
  const [mobileVehicle, setMobileVehicle] = useState(null);

  const handleStartBreak = async () => {
    await updateStatus(agent, "Break");
    setShowBreakModal(false);
  };

  const handleMobileLookup = async (e) => {
    e?.preventDefault();
    try {
      const res = await axios.get(`${API}/vehicles/lookup`, {
        params: { plate: plateQuery.trim() },
      });
      setMobileVehicle(res.data.data);
    } catch {
      setMobileVehicle(null);
    }
  };

  return (
    <div className="mobile-view-container">
      <div className="phone-mockup-frame">
        {/* Notch / Status Bar */}
        <div className="phone-notch-bar">
          <span>09:41</span>
          <span style={{ fontSize: "10px", color: "#059669" }}>● GPS Active</span>
          <span>100% 🔋</span>
        </div>

        {/* Tab 1: Home (Screen 1 in PDF 4) */}
        {mobileTab === "home" && (
          <div className="phone-screen-body">
            <div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Good morning,</span>
              <h3 style={{ margin: "2px 0 0", fontSize: "16px", color: "#0f172a" }}>
                Mamadou Diallo
              </h3>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                Field Inspector · {agent?.badge_number || "AGT-1048"}
              </span>
            </div>

            {/* GPS Warning Banner */}
            <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", padding: "10px 12px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "11px", color: "#dc2626" }}>
                <strong>GPS Unavailable</strong>
                <div>Location tracking paused</div>
              </div>
              <button
                type="button"
                style={{ background: "#dc2626", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}
                onClick={() => alert("GPS coordinates synchronized")}
              >
                Enable GPS
              </button>
            </div>

            {/* Active Shift status banner */}
            <div style={{ background: "#ecfdf5", border: "1px solid #d1fae5", padding: "8px 12px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ color: "#059669", fontWeight: 700, fontSize: "11px" }}>● On Duty</span>
                <div style={{ fontSize: "10px", color: "#64748b" }}>Started 08:02 AM · Elapsed 02:14:33</div>
              </div>
              <button
                type="button"
                style={{ background: "#ffffff", border: "1px solid #cbd5e1", padding: "3px 8px", borderRadius: "4px", fontSize: "11px" }}
                onClick={() => setMobileTab("shift")}
              >
                Shift →
              </button>
            </div>

            {/* Active Mission Card: RN1 Corridor Inspection */}
            <div className="phone-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "12px", color: "#0f172a" }}>
                  RN1 Corridor Inspection
                </strong>
                <span className="badge-status-dot blue" style={{ background: "#eff6ff", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>
                  ● Assigned
                </span>
              </div>
              <div style={{ fontSize: "10px", color: "#64748b" }}>
                GR-MSN-2026-00984 · Assigned 08:30
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px", fontSize: "11px" }}>
                <div>
                  <span style={{ color: "#059669", fontWeight: 800 }}>A</span> Coyah Junction
                </div>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>18.6 km</div>
                <div>
                  <span style={{ color: "#2563eb", fontWeight: 800 }}>B</span> Dubréka Checkpoint
                </div>
              </div>

              <button
                type="button"
                className="btn-green-solid"
                style={{ marginTop: "6px" }}
                onClick={() => alert("Patrol started on RN1 Corridor")}
              >
                ▶ Start Inspection
              </button>
            </div>

            {/* Quick Actions (Screen 1 in PDF 4) */}
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginTop: "4px" }}>
              QUICK ACTIONS
            </div>
            <div className="phone-quick-actions-grid">
              <div className="phone-qa-item" onClick={() => alert("Damage report opened")}>
                <span style={{ fontSize: "16px" }}>⚠️</span>
                <strong style={{ fontSize: "10px", marginTop: "2px" }}>Report Damage</strong>
                <span style={{ fontSize: "9px", color: "#64748b" }}>3 Insp.</span>
              </div>
              <div className="phone-qa-item" onClick={() => alert("Violation form opened")}>
                <span style={{ fontSize: "16px" }}>📋</span>
                <strong style={{ fontSize: "10px", marginTop: "2px" }}>Record Viol.</strong>
                <span style={{ fontSize: "9px", color: "#64748b" }}>5 Viol.</span>
              </div>
              <div className="phone-qa-item" onClick={() => alert("Emergency SOS triggered")}>
                <span style={{ fontSize: "16px" }}>🚨</span>
                <strong style={{ fontSize: "10px", marginTop: "2px" }}>Emergency</strong>
                <span style={{ fontSize: "9px", color: "#dc2626" }}>GNF 2.45M</span>
              </div>
              <div className="phone-qa-item" onClick={() => setMobileTab("lookup")}>
                <span style={{ fontSize: "16px" }}>🔍</span>
                <strong style={{ fontSize: "10px", marginTop: "2px" }}>Vehicle Lookup</strong>
                <span style={{ fontSize: "9px", color: "#059669" }}>✓ Sync</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Active Shift (Screen 2 in PDF 4) */}
        {mobileTab === "shift" && (
          <div className="phone-screen-body">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "15px", color: "#0f172a" }}>Active Shift</h3>
                <span className="badge-status-dot green">● On Duty</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Started 08:02 · Elapsed 02:14:33
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", textAlign: "center" }}>
              <div style={{ background: "#ffffff", padding: "10px 4px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "10px", color: "#64748b" }}>DURATION</span>
                <div style={{ fontWeight: 800, fontSize: "14px", marginTop: "2px" }}>02:14</div>
              </div>
              <div style={{ background: "#ffffff", padding: "10px 4px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "10px", color: "#64748b" }}>LAST SYNC</span>
                <div style={{ fontWeight: 800, fontSize: "14px", marginTop: "2px" }}>10:16</div>
              </div>
              <div style={{ background: "#ffffff", padding: "10px 4px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "10px", color: "#64748b" }}>MISSIONS</span>
                <div style={{ fontWeight: 800, fontSize: "14px", marginTop: "2px" }}>1/1</div>
              </div>
            </div>

            <div className="phone-card">
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>CURRENT MISSION</span>
              <strong style={{ fontSize: "12px", color: "#0f172a" }}>RN1 Corridor Inspection</strong>
              <div style={{ fontSize: "11px", color: "#64748b" }}>Coyah Junction → Dubréka · 18.6 km</div>
              <div style={{ fontSize: "11px", color: "#059669", fontWeight: 700 }}>
                7.8 km completed · 10.8 km remaining
              </div>
            </div>

            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>SHIFT CONTROLS</div>
            <button
              type="button"
              className="btn-outline-grey"
              style={{ width: "100%", padding: "10px" }}
              onClick={() => setShowBreakModal(true)}
            >
              ☕ Take a Break
            </button>
            <button
              type="button"
              style={{ width: "100%", background: "#ef4444", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }}
              onClick={() => updateStatus(agent, "Offline")}
            >
              ⏹ End Duty
            </button>
          </div>
        )}

        {/* Tab 3: Vehicle Lookup (Screen 4 in PDF 4) */}
        {mobileTab === "lookup" && (
          <div className="phone-screen-body">
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", color: "#0f172a" }}>Vehicle Lookup</h3>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
                Check vehicle identity, company, authorization and enforcement history.
              </p>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", fontSize: "11px" }}>
              <div>Agent: Mamadou Diallo · AGT-1048</div>
              <div>Mission: GR-MSN-2026-00984</div>
              <div>Road: RN1 · Km 24.6</div>
              <div>Time: 05 Oct 2026 · 10:54</div>
            </div>

            <form onSubmit={handleMobileLookup}>
              <input
                type="text"
                placeholder="Search Registration Number"
                value={plateQuery}
                onChange={(e) => setPlateQuery(e.target.value)}
                style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }}
              />
              <button
                type="submit"
                className="btn-green-solid"
                style={{ width: "100%", marginTop: "8px" }}
              >
                Scan Licence Plate
              </button>
            </form>

            {mobileVehicle && (
              <div className="phone-card">
                <strong style={{ fontSize: "13px" }}>{mobileVehicle.plate_number}</strong>
                <div>Make/Model: {mobileVehicle.make} {mobileVehicle.model}</div>
                <div>Owner: {mobileVehicle.owner}</div>
                <div style={{ color: "#dc2626", fontWeight: 700 }}>
                  Unpaid Fines: {formatFine(mobileVehicle.unpaid_fines_gnf)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Navigation matching PDF 4 */}
        <div className="phone-bottom-nav">
          <button
            type="button"
            className={`phone-nav-btn ${mobileTab === "home" ? "active" : ""}`}
            onClick={() => setMobileTab("home")}
          >
            <span>🏠</span>
            Home
          </button>
          <button
            type="button"
            className={`phone-nav-btn ${mobileTab === "shift" ? "active" : ""}`}
            onClick={() => setMobileTab("shift")}
          >
            <span>⏱️</span>
            Shift
          </button>
          <button
            type="button"
            className={`phone-nav-btn ${mobileTab === "lookup" ? "active" : ""}`}
            onClick={() => setMobileTab("lookup")}
          >
            <span>🔍</span>
            Lookup
          </button>
          <button
            type="button"
            className="phone-nav-btn"
            onClick={onClose}
          >
            <span>✕</span>
            Exit
          </button>
        </div>
      </div>

      {/* Break Selection Modal (Screen 3 in PDF 4) */}
      {showBreakModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowBreakModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "20px",
              width: "320px",
              maxWidth: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>Take a Break</h3>
            <p style={{ margin: "4px 0 14px", fontSize: "11px", color: "#64748b", lineHeight: 1.4 }}>
              GPS tracking continues during breaks. You remain GPS-trackable during breaks. Your status will update to Break for your supervisor.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {["Short break (15 min)", "Lunch break (30 min)", "Extended break"].map((opt) => (
                <label
                  key={opt}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="break"
                    checked={breakOption === opt}
                    onChange={() => setBreakOption(opt)}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button
                type="button"
                className="btn-green-solid"
                onClick={handleStartBreak}
              >
                Start Break
              </button>
              <button
                type="button"
                className="btn-outline-grey"
                onClick={() => setShowBreakModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== VEHICLE LOOKUP STANDALONE ==================== */
function VehicleLookupPage() {
  const [plate, setPlate] = useState("RC 8245 AB");
  const [vehicle, setVehicle] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    if (!plate.trim()) return;
    setLoading(true);
    setMessage("");
    setVehicle(null);

    try {
      const res = await axios.get(`${API}/vehicles/lookup`, {
        params: { plate: plate.trim() },
      });
      setVehicle(res.data.data);
    } catch (err) {
      setMessage(err.response?.data?.message || "Vehicle not found.");
    } finally {
      setLoading(false);
    }
  }, [plate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 0);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  return (
    <div style={{ padding: "20px 24px", maxWidth: "900px" }}>
      <div className="card-white" style={{ padding: "20px" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "18px" }}>Vehicle Identity &amp; Enforcement History</h2>
        <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#64748b" }}>
          Query official vehicle records and inspect unpaid municipal corridor fines.
        </p>

        <form onSubmit={handleSearch} style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="Registration plate (e.g. RC 8245 AB)"
            style={{ flex: 1, padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px" }}
          />
          <button type="submit" className="btn-green-solid" style={{ width: "140px" }} disabled={loading}>
            {loading ? "Searching…" : "Search Vehicle"}
          </button>
        </form>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px", fontSize: "11px", color: "#64748b", alignItems: "center" }}>
          <span>Sample Plates:</span>
          {["RC 8245 AB", "RC 1920 CC", "GN-2048-A"].map((p) => (
            <button
              key={p}
              type="button"
              style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}
              onClick={() => {
                setPlate(p);
                axios.get(`${API}/vehicles/lookup`, { params: { plate: p } }).then((r) => setVehicle(r.data.data));
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {message && (
          <div style={{ marginTop: "16px", padding: "10px", background: "#fef2f2", color: "#dc2626", borderRadius: "6px", fontSize: "12px" }}>
            {message}
          </div>
        )}

        {vehicle && (
          <div style={{ marginTop: "20px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>{vehicle.plate_number}</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{vehicle.make} {vehicle.model}</span>
              </div>
              <span className="badge-status-dot green" style={{ background: "#ecfdf5", padding: "4px 10px", borderRadius: "99px" }}>
                ● {vehicle.status}
              </span>
            </div>

            <div style={{ margin: "14px 0", background: "#f8fafc", padding: "12px", borderRadius: "6px", display: "flex", justifyContent: "space-between" }}>
              <span>Registered Owner / Company:</span>
              <strong>{vehicle.owner}</strong>
            </div>

            <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", padding: "12px 14px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#dc2626", fontWeight: 700, fontSize: "12px" }}>OUTSTANDING UNPAID FINES</span>
              <strong style={{ fontSize: "16px", color: "#b91c1c" }}>{formatFine(vehicle.unpaid_fines_gnf)}</strong>
            </div>

            <h4 style={{ margin: "16px 0 8px", fontSize: "13px" }}>Recorded Violations ({vehicle.violations?.length || 0})</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {vehicle.violations?.map((v) => (
                <div key={v.id} style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "10px", borderRadius: "6px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                    <span>{v.violation_code ? `${v.violation_code} · ` : ""}{v.violation_type}</span>
                    <span style={{ color: "#dc2626" }}>{formatFine(v.fine_amount_gnf)}</span>
                  </div>
                  <div style={{ color: "#64748b", margin: "4px 0" }}>{v.description}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8" }}>
                    <span>Road: {v.road_name || "RN1"}</span>
                    <span className={`badge-status-dot ${(v.status || "").toLowerCase() === "paid" ? "green" : "red"}`}>
                      ● {v.status || "Unpaid"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== AGENT DETAIL MODAL ==================== */
function AgentDetailModal({ agent, mission, onClose, updateStatus, updatingAgentId, onNavigateMap }) {
  if (!agent) return null;
  const initials = getInitials(agent.name);
  const isOffline = agent.status === "Offline";

  return (
    <div className="dashboard-modal-overlay" onClick={onClose}>
      <div className="dashboard-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              className="table-agent-circle"
              style={{
                width: "42px",
                height: "42px",
                fontSize: "15px",
                background:
                  agent.status === "On Mission"
                    ? "#1e3a8a"
                    : agent.status === "Inspecting"
                    ? "#059669"
                    : isOffline
                    ? "#475569"
                    : "#0891b2",
                color: "#ffffff",
              }}
            >
              {initials}
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a", fontWeight: 800 }}>{agent.name}</h3>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
                {agent.badge_number} · Field Surveillance Officer
              </p>
            </div>
          </div>
          <button type="button" className="dashboard-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="dashboard-modal-body">
          {/* Status Quick Update directly connected to DB */}
          <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>OPERATIONAL STATUS (POSTGRESQL LIVE)</span>
              {updatingAgentId === agent.id && (
                <span style={{ fontSize: "11px", color: "#2563eb", fontWeight: 700 }}>Saving to DB…</span>
              )}
            </div>
            <select
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#0f172a",
                background: "#ffffff",
              }}
              value={agent.status}
              disabled={updatingAgentId === agent.id}
              onChange={(e) => updateStatus && updateStatus(agent, e.target.value)}
            >
              <option value="On Duty">On Duty</option>
              <option value="On Mission">On Mission</option>
              <option value="Inspecting">Inspecting</option>
              <option value="Available">Available</option>
              <option value="Break">Break</option>
              <option value="Offline">Offline</option>
            </select>
          </div>

          {/* Telemetry info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px", marginBottom: "14px" }}>
            <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: "10.5px" }}>Corridor / Location</div>
              <strong style={{ color: "#0f172a" }}>{agent.location || "RN1 Coyah"}</strong>
            </div>
            <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: "10.5px" }}>GPS Signal</div>
              <strong style={{ color: isOffline ? "#dc2626" : "#059669" }}>
                ● {isOffline ? "Disconnected" : "Active (9.6412° N, 13.5784° W)"}
              </strong>
            </div>
            <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: "10.5px" }}>Duty Duration</div>
              <strong style={{ color: "#0f172a" }}>{agent.duty_duration || "02h 14m"}</strong>
            </div>
            <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: "10.5px" }}>Last Telemetry Sync</div>
              <strong style={{ color: isOffline ? "#dc2626" : "#059669" }}>
                {agent.last_sync || "1 min ago"}
              </strong>
            </div>
          </div>

          {mission && (
            <div style={{ background: "#eff6ff", padding: "12px", borderRadius: "8px", border: "1px solid #bfdbfe", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e40af" }}>ACTIVE MISSION</span>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#2563eb" }}>GR-MSN-2026-{mission.mission_code}</span>
              </div>
              <div style={{ fontSize: "12px", color: "#1e3a8a", fontWeight: 600 }}>
                {mission.road_name}: {mission.route}
              </div>
              <div style={{ marginTop: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#1e40af", marginBottom: "3px" }}>
                  <span>Patrol Progress</span>
                  <strong>{mission.covered_km || 7.4} km / {mission.total_km || 18.6} km</strong>
                </div>
                <div style={{ height: "6px", background: "#bfdbfe", borderRadius: "99px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Number(mission.total_km) > 0 ? Math.round((Number(mission.covered_km) / Number(mission.total_km)) * 100) : 40}%`,
                      background: "#2563eb",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button
              type="button"
              className="btn-outline-grey"
              style={{ flex: 1, padding: "9px" }}
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="btn-green-solid"
              style={{ flex: 1, padding: "9px" }}
              onClick={() => {
                onClose();
                if (onNavigateMap) onNavigateMap(agent);
              }}
            >
              Open in Live Map ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== MISSION DETAIL MODAL ==================== */
function MissionDetailModal({ mission, agent, onClose, onNavigateMap }) {
  if (!mission) return null;
  const pct = Number(mission.total_km) > 0 ? Math.round((Number(mission.covered_km) / Number(mission.total_km)) * 100) : 40;

  return (
    <div className="dashboard-modal-overlay" onClick={onClose}>
      <div className="dashboard-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-modal-header">
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
              Corridor Mission Detail
            </div>
            <h3 style={{ margin: "2px 0 0", fontSize: "17px", color: "#0f172a", fontWeight: 800 }}>
              GR-MSN-2026-{mission.mission_code}
            </h3>
          </div>
          <button type="button" className="dashboard-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="dashboard-modal-body">
          <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Road &amp; Route</span>
                <div style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>{mission.road_name}</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>{mission.route || "Coyah Junction → Dubréka Checkpoint"}</div>
              </div>
              <span className="badge-status-dot blue" style={{ padding: "4px 10px" }}>
                ● {mission.status || "In Progress"}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px", marginBottom: "14px" }}>
            <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: "10.5px" }}>Assigned Officer</div>
              <strong style={{ color: "#0f172a" }}>{mission.agent_name || agent?.name || "Mamadou Diallo"}</strong>
            </div>
            <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: "10.5px" }}>Corridor Length</div>
              <strong style={{ color: "#0f172a" }}>{mission.total_km || 18.6} km total</strong>
            </div>
            <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: "10.5px" }}>Covered Distance</div>
              <strong style={{ color: "#059669" }}>{mission.covered_km || 7.4} km ({pct}%)</strong>
            </div>
            <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: "10.5px" }}>Elapsed Time</div>
              <strong style={{ color: "#0f172a" }}>{mission.duration_text || "00h 52m"}</strong>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
              <span style={{ fontWeight: 600, color: "#475569" }}>Corridor Inspection Progress</span>
              <strong style={{ color: "#059669" }}>{pct}%</strong>
            </div>
            <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "#059669", transition: "width 0.3s ease" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="btn-outline-grey"
              style={{ flex: 1, padding: "9px" }}
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="btn-green-solid"
              style={{ flex: 1, padding: "9px" }}
              onClick={() => {
                onClose();
                if (onNavigateMap) onNavigateMap();
              }}
            >
              Open Full Corridor in Live Map ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== MAIN DASHBOARD PAGES ==================== */
function DashboardPages() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [missions, setMissions] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileSimulator, setIsMobileSimulator] = useState(false);
  const [updatingAgentId, setUpdatingAgentId] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [agentStatusFilter, setAgentStatusFilter] = useState("all");
  const [roadFilter, setRoadFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [inspectingAgent, setInspectingAgent] = useState(null);
  const [inspectingMission, setInspectingMission] = useState(null);

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
    } catch (err) {
      console.error("Dashboard loading error:", err);
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

  const updateStatus = async (agentToUpdate, status) => {
    if (updatingAgentId !== null || !agentToUpdate) return;
    setUpdatingAgentId(agentToUpdate.id);

    try {
      const res = await axios.patch(
        `${API}/agents/${agentToUpdate.id}/status`,
        { status }
      );
      const updated = res.data.data;

      setAgents((current) =>
        current.map((a) => (a.id === updated.id ? updated : a))
      );

      if (selectedAgent?.id === updated.id) {
        setSelectedAgent(updated);
      }
      if (inspectingAgent?.id === updated.id) {
        setInspectingAgent(updated);
      }
      await loadDashboard();
    } catch (err) {
      console.error("Failed to update agent status:", err);
    } finally {
      setUpdatingAgentId(null);
    }
  };

  const handleSelectAgent = (agent) => {
    setSelectedAgent(agent);
    const mission = missions.find((m) => m.agent_id === agent.id) || missions[0];
    setSelectedMission(mission);
    setIsDrawerOpen(true);
  };

  const isFiltered =
    agentStatusFilter !== "all" ||
    roadFilter !== "all" ||
    regionFilter !== "all" ||
    supervisorFilter !== "all" ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setAgentStatusFilter("all");
    setRoadFilter("all");
    setRegionFilter("all");
    setSupervisorFilter("all");
    setSearchQuery("");
  };

  const filteredAgents = agents.filter((ag) => {
    if (agentStatusFilter !== "all" && ag.status !== agentStatusFilter) {
      return false;
    }
    if (roadFilter !== "all") {
      const loc = (ag.location || "").toLowerCase();
      if (!loc.includes(roadFilter.toLowerCase())) return false;
    }
    if (regionFilter !== "all") {
      const loc = (ag.location || "").toLowerCase();
      if (!loc.includes(regionFilter.toLowerCase())) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (ag.name || "").toLowerCase().includes(q);
      const matchBadge = (ag.badge_number || "").toLowerCase().includes(q);
      const matchLoc = (ag.location || "").toLowerCase().includes(q);
      const matchStat = (ag.status || "").toLowerCase().includes(q);
      const matchMsn = (ag.active_mission_code || "").toLowerCase().includes(q);
      if (!matchName && !matchBadge && !matchLoc && !matchStat && !matchMsn) {
        return false;
      }
    }
    return true;
  });

  const filteredMissions = missions.filter((m) => {
    if (roadFilter !== "all" && m.road_name !== roadFilter) {
      return false;
    }
    if (regionFilter !== "all") {
      const r = (m.route || "").toLowerCase();
      if (!r.includes(regionFilter.toLowerCase())) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchCode = (m.mission_code || "").toLowerCase().includes(q);
      const matchRoad = (m.road_name || "").toLowerCase().includes(q);
      const matchRoute = (m.route || "").toLowerCase().includes(q);
      const matchAg = (m.agent_name || "").toLowerCase().includes(q);
      if (!matchCode && !matchRoad && !matchRoute && !matchAg) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-content">
        <Topbar
          title={
            isMobileSimulator
              ? "Field Agent Mobile Interface"
              : location.pathname === "/surveillance"
              ? "Live Operations Map"
              : location.pathname === "/missions"
              ? "Missions Overview"
              : location.pathname === "/agents"
              ? "Live Field Agents"
              : location.pathname === "/vehicles"
              ? "Vehicle Lookup & Enforcement"
              : "Command Dashboard"
          }
          breadcrumb={
            isMobileSimulator
              ? "FIELD AGENT INTERFACE"
              : location.pathname === "/surveillance"
              ? "COMMAND / LIVE OPERATIONS MAP"
              : "COMMAND / DASHBOARD"
          }
          onToggleMobile={() => setIsMobileSimulator(!isMobileSimulator)}
          isMobileView={isMobileSimulator}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          agents={agents}
          missions={missions}
          onSelectAgent={(ag) => {
            setSelectedAgent(ag);
            setInspectingAgent(ag);
          }}
          onSelectMission={(m) => {
            setSelectedMission(m);
            setInspectingMission(m);
          }}
        />

        {isMobileSimulator ? (
          <FieldAgentMobileApp
            agent={agents[0] || { name: "Mamadou Diallo", badge_number: "AGT-1048", status: "On Duty" }}
            updateStatus={updateStatus}
            onClose={() => setIsMobileSimulator(false)}
          />
        ) : (
          <Routes>
            {/* Main Command Dashboard (Dashboard Screen.pdf) */}
            <Route
              path="/"
              element={
                <>
                  <DashboardSubheader />
                  <DashboardFilterBar
                    agentStatusFilter={agentStatusFilter}
                    setAgentStatusFilter={setAgentStatusFilter}
                    roadFilter={roadFilter}
                    setRoadFilter={setRoadFilter}
                    regionFilter={regionFilter}
                    setRegionFilter={setRegionFilter}
                    supervisorFilter={supervisorFilter}
                    setSupervisorFilter={setSupervisorFilter}
                    onResetFilters={handleResetFilters}
                    isFiltered={isFiltered}
                  />
                  <KpiCardsRow stats={stats} />

                  <div className="dashboard-layout-split">
                    {/* Left Column (68%) */}
                    <div className="dashboard-left-col">
                      {/* Live Field Operations Map snippet matching Image 1 */}
                      <LiveFieldOperationsVectorMap
                        agents={filteredAgents.length > 0 ? filteredAgents : agents}
                        stats={stats}
                        onSelectAgent={handleSelectAgent}
                      />

                      {/* Live Agents Table (Dashboard Screen.pdf) - Live from DB */}
                      <div className="card-white">
                        <div className="card-white-header">
                          <div className="card-title-group">
                            <h3>Live Agents</h3>
                            <p>Current field activity · {filteredAgents.length} of {agents.length} enrolled</p>
                          </div>
                          <span
                            className="card-header-link"
                            onClick={() => navigate("/agents")}
                            style={{ cursor: "pointer" }}
                          >
                            View all agents ↗
                          </span>
                        </div>
                        <table className="pdf-table">
                          <thead>
                            <tr>
                              <th>AGENT</th>
                              <th>STATUS</th>
                              <th>MISSION</th>
                              <th>LOCATION</th>
                              <th>DUTY</th>
                              <th>SYNC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAgents.length === 0 ? (
                              <tr>
                                <td colSpan="6" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                                  No agents found matching current filters.{" "}
                                  <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                                  >
                                    Reset Filters
                                  </button>
                                </td>
                              </tr>
                            ) : (
                              filteredAgents.map((ag) => {
                                const initials = ag.name
                                  ? ag.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                                  : "AG";
                                const circleClass =
                                  ag.status === "On Mission"
                                    ? "navy"
                                    : ag.status === "Inspecting"
                                    ? "green"
                                    : ag.status === "Offline"
                                    ? "slate"
                                    : "cyan";
                                const dotClass =
                                  ag.status === "On Mission"
                                    ? "blue"
                                    : ag.status === "Inspecting"
                                    ? "cyan"
                                    : ag.status === "Offline"
                                    ? "slate"
                                    : "green";

                                return (
                                  <tr
                                    key={ag.id}
                                    onClick={() => handleSelectAgent(ag)}
                                    style={{ cursor: "pointer" }}
                                  >
                                    <td>
                                      <div style={{ display: "flex", alignItems: "center" }}>
                                        <span className={`table-agent-circle ${circleClass}`}>{initials}</span>
                                        <div>
                                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{ag.name}</div>
                                          <div style={{ fontSize: "9.5px", color: "#94a3b8" }}>{ag.badge_number}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <span className={`badge-status-dot ${dotClass}`}>
                                        <span className="status-bullet" />
                                        {ag.status}
                                      </span>
                                    </td>
                                    <td
                                      style={{ color: ag.active_mission_code ? "#2563eb" : "#94a3b8", fontWeight: 700 }}
                                    >
                                      {ag.active_mission_code || "—"}
                                    </td>
                                    <td>{ag.location || "RN1 Coyah"}</td>
                                    <td>{ag.duty_duration || "02h 14m"}</td>
                                    <td>
                                      <span
                                        style={{
                                          color: ag.status === "Offline" ? "#dc2626" : "#059669",
                                          fontWeight: 600,
                                        }}
                                      >
                                        ● {ag.last_sync || "1 min"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Active Missions Table (Dashboard Screen.pdf) - Live from DB */}
                      <div className="card-white">
                        <div className="card-white-header">
                          <div className="card-title-group">
                            <h3>Active Missions</h3>
                            <p>Currently in progress on corridors · {filteredMissions.length} active</p>
                          </div>
                          <span
                            className="card-header-link"
                            onClick={() => navigate("/missions")}
                            style={{ cursor: "pointer" }}
                          >
                            View all missions ↗
                          </span>
                        </div>
                        <table className="pdf-table">
                          <thead>
                            <tr>
                              <th>MISSION</th>
                              <th>AGENT</th>
                              <th>ROAD</th>
                              <th>ROUTE</th>
                              <th>PROGRESS</th>
                              <th>DURATION</th>
                              <th>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMissions.length === 0 ? (
                              <tr>
                                <td colSpan="7" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                                  No missions found matching current filters.{" "}
                                  <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                                  >
                                    Reset Filters
                                  </button>
                                </td>
                              </tr>
                            ) : (
                              filteredMissions.map((m) => {
                                const pct =
                                  Number(m.total_km) > 0
                                    ? Math.round((Number(m.covered_km) / Number(m.total_km)) * 100)
                                    : 40;
                                return (
                                  <tr
                                    key={m.id}
                                    onClick={() => {
                                      const matchedAg =
                                        agents.find((a) => a.id === m.agent_id) || agents[0];
                                      setSelectedAgent(matchedAg);
                                      setSelectedMission(m);
                                      setInspectingMission(m);
                                    }}
                                    style={{ cursor: "pointer" }}
                                  >
                                    <td style={{ fontWeight: 700, color: "#2563eb" }}>{m.mission_code}</td>
                                    <td style={{ fontWeight: 600, color: "#0f172a" }}>
                                      {m.agent_name || "Mamadou Diallo"}
                                    </td>
                                    <td>{m.road_name}</td>
                                    <td style={{ color: "#64748b" }}>{m.route || "Coyah → Dubréka"}</td>
                                    <td>
                                      <div className="table-progress-bar">
                                        <div className="table-progress-track">
                                          <div className="table-progress-fill" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: "10.5px" }}>{pct}%</span>
                                      </div>
                                    </td>
                                    <td>{m.duration_text || "00h 52m"}</td>
                                    <td>
                                      <span className="badge-status-dot blue">
                                        <span className="status-bullet" />
                                        {m.status || "In Progress"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Road Damage & Enforcement Side-by-Side (Dashboard Screen.pdf) */}
                      <div className="two-card-row">
                        {/* Road Damage Card */}
                        <div className="card-white">
                          <div className="card-white-header">
                            <div className="card-title-group">
                              <h3>Road Damage</h3>
                              <p>27 reports today</p>
                            </div>
                            <span className="card-header-link">View all ↗</span>
                          </div>

                          <div className="road-damage-breakdowns">
                            <div>
                              <div className="breakdown-col-title">BY SEVERITY</div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label">Minor</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "50%", background: "#06b6d4" }} />
                                </div>
                                <span className="breakdown-count">8</span>
                              </div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label">Moderate</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "56%", background: "#2563eb" }} />
                                </div>
                                <span className="breakdown-count">9</span>
                              </div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label">Severe</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "25%", background: "#f97316" }} />
                                </div>
                                <span className="breakdown-count">3</span>
                              </div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label">Very Severe</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "18%", background: "#ea580c" }} />
                                </div>
                                <span className="breakdown-count">2</span>
                              </div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label">Critical</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "18%", background: "#dc2626" }} />
                                </div>
                                <span className="breakdown-count">2</span>
                              </div>
                            </div>

                            <div>
                              <div className="breakdown-col-title">BY STATUS</div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label" style={{ color: "#2563eb" }}>● Reported</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "100%", background: "#2563eb" }} />
                                </div>
                                <span className="breakdown-count">27</span>
                              </div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label" style={{ color: "#059669" }}>● Validated</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "56%", background: "#059669" }} />
                                </div>
                                <span className="breakdown-count">15</span>
                              </div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label" style={{ color: "#0891b2" }}>● Assigned</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "30%", background: "#0891b2" }} />
                                </div>
                                <span className="breakdown-count">8</span>
                              </div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label" style={{ color: "#6366f1" }}>● In Progress</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "22%", background: "#6366f1" }} />
                                </div>
                                <span className="breakdown-count">6</span>
                              </div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label" style={{ color: "#d97706" }}>● Awaiting Verif.</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "15%", background: "#d97706" }} />
                                </div>
                                <span className="breakdown-count">4</span>
                              </div>
                              <div className="breakdown-row">
                                <span className="breakdown-row-label" style={{ color: "#64748b" }}>● Closed</span>
                                <div className="breakdown-track">
                                  <div className="breakdown-fill" style={{ width: "11%", background: "#64748b" }} />
                                </div>
                                <span className="breakdown-count">3</span>
                              </div>
                            </div>
                          </div>

                          <table className="pdf-table">
                            <thead>
                              <tr>
                                <th>REPORT</th>
                                <th>ROAD</th>
                                <th>AGENT</th>
                                <th>CATEGORY</th>
                                <th>SEVERITY</th>
                                <th>TIME</th>
                                <th>STATUS</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{ fontWeight: 700, color: "#2563eb" }}>26-04-128</td>
                                <td>RN1</td>
                                <td>M. Diallo</td>
                                <td>Road Surface</td>
                                <td><span className="badge-status-dot orange">Severe</span></td>
                                <td>10:38</td>
                                <td><span className="badge-status-dot blue">● Reported</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 700, color: "#2563eb" }}>26-04-127</td>
                                <td>R. Le Prince</td>
                                <td>A. Bah</td>
                                <td>Drainage</td>
                                <td><span className="badge-status-dot amber">Moderate</span></td>
                                <td>10:24</td>
                                <td><span className="badge-status-dot green">● Validated</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 700, color: "#2563eb" }}>26-04-125</td>
                                <td>RN3</td>
                                <td>A. Sylla</td>
                                <td>Bridge / Structure</td>
                                <td><span className="badge-status-dot red">Critical</span></td>
                                <td>09:57</td>
                                <td><span className="badge-status-dot amber">● Awaiting Validation</span></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Enforcement Card */}
                        <div className="card-white">
                          <div className="card-white-header">
                            <div className="card-title-group">
                              <h3>Enforcement</h3>
                              <p>19 violations today · GNF 12.85M</p>
                            </div>
                            <span className="card-header-link">View all ↗</span>
                          </div>

                          <div className="enforcement-stat-boxes">
                            <div className="enforcement-stat-box">
                              <span className="enforcement-stat-value">19</span>
                              <span className="enforcement-stat-label">Violations</span>
                            </div>
                            <div className="enforcement-stat-box">
                              <span className="enforcement-stat-value">4</span>
                              <span className="enforcement-stat-label">Heavy Vehicle</span>
                            </div>
                            <div className="enforcement-stat-box">
                              <span className="enforcement-stat-value" style={{ fontSize: "12.5px" }}>GNF 12.85M</span>
                              <span className="enforcement-stat-label">Fine Value</span>
                            </div>
                            <div className="enforcement-stat-box">
                              <span className="enforcement-stat-value" style={{ color: "#dc2626", fontSize: "12.5px" }}>GNF 4.6M</span>
                              <span className="enforcement-stat-label">Unpaid</span>
                            </div>
                          </div>

                          <table className="pdf-table">
                            <thead>
                              <tr>
                                <th>VIO ID</th>
                                <th>AGENT</th>
                                <th>VEHICLE/CO.</th>
                                <th>ROAD</th>
                                <th>TYPE</th>
                                <th>SEV.</th>
                                <th>FINE</th>
                                <th>PAYMENT</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{ fontWeight: 700, color: "#2563eb" }}>26-01844</td>
                                <td>M. Diallo</td>
                                <td style={{ fontWeight: 600 }}>RC 8245 AB</td>
                                <td>RN1</td>
                                <td>Unauthorized Heavy Vehicle</td>
                                <td><span className="badge-status-dot orange">Severe</span></td>
                                <td style={{ fontWeight: 700 }}>GNF 750,000</td>
                                <td><span className="badge-status-dot green">● Paid Cash</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 700, color: "#2563eb" }}>26-01843</td>
                                <td>A. Bah</td>
                                <td style={{ fontWeight: 600 }}>TransGuinée SA</td>
                                <td>R. Le Prince</td>
                                <td>Road Occupation</td>
                                <td><span className="badge-status-dot amber">Moderate</span></td>
                                <td style={{ fontWeight: 700 }}>GNF 300,000</td>
                                <td><span className="badge-status-dot blue">● Issued</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 700, color: "#2563eb" }}>26-01841</td>
                                <td>O. Kouyaté</td>
                                <td style={{ fontWeight: 600 }}>RC 1920 CC</td>
                                <td>RN3</td>
                                <td>Overloaded Vehicle</td>
                                <td><span className="badge-status-dot red">Very Severe</span></td>
                                <td style={{ fontWeight: 700 }}>GNF 1,200,000</td>
                                <td><span className="badge-status-dot amber">● Partially Paid</span></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Finance Snapshot Card (Dashboard Screen.pdf) */}
                      <div className="card-white">
                        <div className="card-white-header">
                          <div className="card-title-group">
                            <h3>Finance Snapshot</h3>
                            <p>05 October 2026</p>
                          </div>
                          <span className="card-header-link">View finance ↗</span>
                        </div>

                        <div className="finance-metric-grid">
                          <div className="finance-metric-box">
                            <span>Fine Value Issued</span>
                            <strong>GNF 12,850,000</strong>
                            <small>19 violations</small>
                          </div>
                          <div className="finance-metric-box">
                            <span>Cash Collected</span>
                            <strong>GNF 5,400,000</strong>
                            <small>14 agents</small>
                          </div>
                          <div className="finance-metric-box">
                            <span>Mobile Money</span>
                            <strong>GNF 2,100,000</strong>
                            <small>Digital payments</small>
                          </div>
                          <div className="finance-metric-box">
                            <span>Pending Remittance</span>
                            <strong style={{ color: "#ea580c" }}>GNF 1,250,000</strong>
                            <small>6 agents pending</small>
                          </div>
                          <div className="finance-metric-box">
                            <span>Pending Reconciliation</span>
                            <strong style={{ color: "#d97706" }}>GNF 780,000</strong>
                            <small>2 batches</small>
                          </div>
                          <div className="finance-metric-box">
                            <span>Reconciled Today</span>
                            <strong style={{ color: "#059669" }}>GNF 3,370,000</strong>
                            <small style={{ color: "#059669" }}>Verified ✓</small>
                          </div>
                        </div>

                        <div className="discrepancy-banner-alert">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "14px" }}>⚠️</span>
                            <div>
                              <strong>Reconciliation discrepancy detected</strong>
                              <div style={{ fontSize: "10px", marginTop: "1px" }}>
                                AGT-1041 Expected: GNF 850,000 &nbsp; Submitted: GNF 700,000 &nbsp; Δ GNF 150,000
                              </div>
                            </div>
                          </div>
                          <button type="button" className="btn-review-discrepancy" onClick={() => alert("Reconciliation Review: AGT-1041 under-remitted by GNF 150,000")}>
                            Review
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right Column (32%) */}
                    <div className="dashboard-right-col">
                      {/* Dynamic Agent Detail Card */}
                      {(() => {
                        const curAg = selectedAgent || agents[0] || { id: 1, name: "Mamadou Diallo", badge_number: "AGT-1048", status: "On Mission" };
                        const curMsn = (missions && missions.find((m) => m.agent_id === curAg.id)) || selectedMission || (missions && missions[0]) || { mission_code: "00984", road_name: "RN1", route: "Coyah Junction → Dubréka", total_km: 18.6, covered_km: 7.4 };
                        const initials = curAg.name ? curAg.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "MD";
                        const msnPct = Number(curMsn.total_km) > 0 ? Math.round((Number(curMsn.covered_km) / Number(curMsn.total_km)) * 100) : 40;
                        const isOffline = curAg.status === "Offline";
                        const dotColorClass = curAg.status === "On Mission" ? "blue" : curAg.status === "Inspecting" ? "cyan" : isOffline ? "slate" : "green";
                        const avatarColorClass = curAg.status === "On Mission" ? "navy" : curAg.status === "Inspecting" ? "green" : isOffline ? "slate" : "cyan";

                        return (
                          <div className="card-white">
                            <div className="card-white-header">
                              <div className="card-title-group">
                                <h3>Agent Detail</h3>
                              </div>
                            </div>

                            <div className="agent-detail-header-card">
                              <span className={`table-agent-circle ${avatarColorClass}`} style={{ width: "36px", height: "36px", fontSize: "13px" }}>
                                {initials}
                              </span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>{curAg.name}</div>
                                <div style={{ fontSize: "10.5px", color: "#64748b" }}>{curAg.badge_number} · Field Inspector</div>
                                <span className={`badge-status-dot ${dotColorClass}`} style={{ marginTop: "4px" }}>
                                  <span className="status-bullet" />
                                  {curAg.status}
                                </span>
                              </div>
                            </div>

                            <div className="agent-detail-body">
                              <div className="detail-line">
                                <span>Mission:</span>
                                <strong style={{ color: "#2563eb" }}>GR-MSN-2026-{curMsn.mission_code || "00984"}</strong>
                              </div>
                              <div className="detail-line">
                                <span>Road:</span>
                                <strong>{curMsn.road_name || "RN1"}</strong>
                              </div>
                              <div className="detail-line">
                                <span>Route:</span>
                                <strong>{curMsn.route || "Coyah Junction → Dubréka"}</strong>
                              </div>
                              <div className="detail-line">
                                <span>Progress:</span>
                                <strong style={{ color: "#059669" }}>{msnPct}%</strong>
                              </div>
                              <div className="detail-line">
                                <span>GPS:</span>
                                <strong style={{ color: isOffline ? "#dc2626" : "#059669" }}>{isOffline ? "Inactive" : "Active"}</strong>
                              </div>
                              <div className="detail-line">
                                <span>Connection:</span>
                                <strong style={{ color: isOffline ? "#64748b" : "#059669" }}>{isOffline ? "Offline" : "Online"}</strong>
                              </div>
                              <div className="detail-line">
                                <span>Duty started:</span>
                                <strong>08:02</strong>
                              </div>
                              <div className="detail-line">
                                <span>Last sync:</span>
                                <strong>{curAg.last_sync || "1 min"} ago</strong>
                              </div>
                              <div className="detail-line">
                                <span>Cash today:</span>
                                <strong>GNF 350,000</strong>
                              </div>

                              <div style={{ marginTop: "8px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                                  <span>Mission progress</span>
                                  <strong style={{ color: "#059669" }}>{msnPct}%</strong>
                                </div>
                                <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${msnPct}%`, background: "#059669", transition: "width 0.3s ease" }} />
                                </div>
                              </div>

                              {/* Quick in-place status update to PostgreSQL */}
                              <div style={{ marginTop: "10px", padding: "8px 10px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>QUICK UPDATE STATUS</span>
                                  {updatingAgentId === curAg.id && (
                                    <span style={{ fontSize: "10px", color: "#2563eb", fontWeight: 600 }}>Syncing to DB…</span>
                                  )}
                                </div>
                                <select
                                  style={{ width: "100%", padding: "5px 8px", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "11.5px", background: "#ffffff", fontWeight: 600, color: "#0f172a" }}
                                  value={curAg.status || "On Mission"}
                                  disabled={updatingAgentId === curAg.id}
                                  onChange={(e) => updateStatus(curAg, e.target.value)}
                                >
                                  <option value="On Duty">On Duty</option>
                                  <option value="On Mission">On Mission</option>
                                  <option value="Inspecting">Inspecting</option>
                                  <option value="Available">Available</option>
                                  <option value="Break">Break</option>
                                  <option value="Offline">Offline</option>
                                </select>
                              </div>
                            </div>

                            <div className="agent-detail-actions">
                              <button
                                type="button"
                                className="btn-outline-grey"
                                onClick={() => setInspectingAgent(curAg)}
                              >
                                View Agent →
                              </button>
                              <button
                                type="button"
                                className="btn-green-solid"
                                onClick={() => setInspectingMission(curMsn)}
                              >
                                View Mission →
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Mobile Sync Health Card (Dashboard Screen.pdf) */}
                      <div className="card-white">
                        <div className="card-white-header">
                          <div className="card-title-group">
                            <h3>Mobile Sync Health</h3>
                            <p>Agent connectivity &amp; data sync</p>
                          </div>
                          <span className="card-header-link">View sync ↗</span>
                        </div>

                        <div className="sync-health-stat-boxes">
                          <div className="sync-health-box">
                            <div className="sync-health-val" style={{ color: "#059669" }}>42</div>
                            <div className="sync-health-lbl">Online</div>
                          </div>
                          <div className="sync-health-box">
                            <div className="sync-health-val" style={{ color: "#dc2626" }}>6</div>
                            <div className="sync-health-lbl">Offline</div>
                          </div>
                          <div className="sync-health-box">
                            <div className="sync-health-val" style={{ color: "#d97706" }}>9</div>
                            <div className="sync-health-lbl">Pending</div>
                          </div>
                          <div className="sync-health-box">
                            <div className="sync-health-val" style={{ color: "#dc2626" }}>2</div>
                            <div className="sync-health-lbl">Failed</div>
                          </div>
                          <div className="sync-health-box">
                            <div className="sync-health-val" style={{ color: "#0f172a" }}>34 min</div>
                            <div className="sync-health-lbl">Longest Offline</div>
                          </div>
                        </div>

                        <div className="sync-health-notice">
                          ⚠️ Pending records are stored on device and have NOT been received by the admin backend.
                        </div>

                        <table className="pdf-table">
                          <thead>
                            <tr>
                              <th>AGENT</th>
                              <th>MISSION</th>
                              <th>LAST SYNC</th>
                              <th>PENDING</th>
                              <th>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>
                                <div style={{ fontWeight: 600 }}>Alpha Condé</div>
                                <div style={{ fontSize: "9px", color: "#94a3b8" }}>AGT-1061</div>
                              </td>
                              <td style={{ color: "#2563eb", fontWeight: 600 }}>…00987</td>
                              <td>18 min ago</td>
                              <td style={{ fontWeight: 600 }}>3 records</td>
                              <td><span className="badge-status-dot red">● Offline</span></td>
                            </tr>
                            <tr>
                              <td>
                                <div style={{ fontWeight: 600 }}>Mariama C.</div>
                                <div style={{ fontSize: "9px", color: "#94a3b8" }}>AGT-1067</div>
                              </td>
                              <td style={{ color: "#2563eb", fontWeight: 600 }}>…00989</td>
                              <td>9 min ago</td>
                              <td style={{ fontWeight: 600 }}>2 records</td>
                              <td><span className="badge-status-dot amber">● Pending Sync</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Balanced Section matching Image 4 */}
                  <div className="dashboard-bottom-grid" style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: "16px", marginTop: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {/* Inspection Coverage Card (Dashboard Screen.pdf & Image 4) */}
                      <div className="card-white">
                        <div className="card-white-header">
                          <div className="card-title-group">
                            <h3>Inspection Coverage</h3>
                            <p>Today · National</p>
                          </div>
                        </div>

                        <div className="inspection-stat-row">
                          <div>
                            <div className="inspection-stat-val">164 km</div>
                            <div className="inspection-stat-lbl">Assigned</div>
                          </div>
                          <div>
                            <div className="inspection-stat-val">126 km</div>
                            <div className="inspection-stat-lbl">Inspected</div>
                          </div>
                          <div>
                            <div className="inspection-stat-val" style={{ color: "#059669" }}>77%</div>
                            <div className="inspection-stat-lbl">Completion</div>
                          </div>
                        </div>

                        <div className="regional-coverage-list">
                          <div className="regional-cov-row">
                            <span className="regional-cov-label">Conakry</span>
                            <div className="regional-cov-track">
                              <div className="regional-cov-fill" style={{ width: "84%", background: "#059669" }} />
                            </div>
                            <span className="regional-cov-pct" style={{ color: "#059669" }}>84%</span>
                          </div>
                          <div className="regional-cov-row">
                            <span className="regional-cov-label">Kindia</span>
                            <div className="regional-cov-track">
                              <div className="regional-cov-fill" style={{ width: "71%", background: "#059669" }} />
                            </div>
                            <span className="regional-cov-pct" style={{ color: "#059669" }}>71%</span>
                          </div>
                          <div className="regional-cov-row">
                            <span className="regional-cov-label">Boké</span>
                            <div className="regional-cov-track">
                              <div className="regional-cov-fill" style={{ width: "68%", background: "#d97706" }} />
                            </div>
                            <span className="regional-cov-pct" style={{ color: "#d97706" }}>68%</span>
                          </div>
                          <div className="regional-cov-row">
                            <span className="regional-cov-label">Mamou</span>
                            <div className="regional-cov-track">
                              <div className="regional-cov-fill" style={{ width: "55%", background: "#d97706" }} />
                            </div>
                            <span className="regional-cov-pct" style={{ color: "#d97706" }}>55%</span>
                          </div>
                          <div className="regional-cov-row">
                            <span className="regional-cov-label">Labé</span>
                            <div className="regional-cov-track">
                              <div className="regional-cov-fill" style={{ width: "42%", background: "#dc2626" }} />
                            </div>
                            <span className="regional-cov-pct" style={{ color: "#dc2626" }}>42%</span>
                          </div>
                        </div>
                      </div>

                      {/* Recent Activity Feed (Dashboard Screen.pdf & Image 4) */}
                      <div className="card-white">
                        <div className="card-white-header">
                          <div className="card-title-group">
                            <h3>Recent Activity</h3>
                            <p>Live operational feed</p>
                          </div>
                          <span className="card-header-link">View audit log ↗</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div className="activity-item-row">
                            <span className="activity-icon-badge amber">▲</span>
                            <span className="activity-time-stamp">10:42</span>
                            <div className="activity-text-desc">
                              <strong>Damage report submitted</strong>
                              <div>Mamadou Diallo · DMG-2026-04128 · RN1</div>
                            </div>
                          </div>
                          <div className="activity-item-row">
                            <span className="activity-icon-badge green">✓</span>
                            <span className="activity-time-stamp">10:38</span>
                            <div className="activity-text-desc">
                              <strong>Mission completed</strong>
                              <div>Aissatou Bah · GR-MSN-2026-00976</div>
                            </div>
                          </div>
                          <div className="activity-item-row">
                            <span className="activity-icon-badge blue">📋</span>
                            <span className="activity-time-stamp">10:32</span>
                            <div className="activity-text-desc">
                              <strong>Violation recorded · Unauthorized heavy vehicle</strong>
                              <div>RC 8245 AB · VIO-2026-01844 · RN1</div>
                            </div>
                          </div>
                          <div className="activity-item-row">
                            <span className="activity-icon-badge green">💰</span>
                            <span className="activity-time-stamp">10:21</span>
                            <div className="activity-text-desc">
                              <strong>Cash reconciled</strong>
                              <div>Finance · GNF 850,000 · AGT-1041</div>
                            </div>
                          </div>
                          <div className="activity-item-row">
                            <span className="activity-icon-badge red">⚠</span>
                            <span className="activity-time-stamp">10:14</span>
                            <div className="activity-text-desc">
                              <strong>Critical road blockage reported</strong>
                              <div>Coyah · RN1 km 7.4</div>
                            </div>
                          </div>
                          <div className="activity-item-row">
                            <span className="activity-icon-badge red" style={{ background: "#f1f5f9", color: "#64748b", border: "1px solid #cbd5e1" }}>⊘</span>
                            <span className="activity-time-stamp">09:58</span>
                            <div className="activity-text-desc">
                              <strong>Agent went offline during active mission</strong>
                              <div>Alpha Condé · AGT-1061 · GR-MSN-2026-00987</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      {/* Agent Distribution Card (Dashboard Screen.pdf & Image 4) */}
                      <div className="card-white">
                        <div className="card-white-header">
                          <div className="card-title-group">
                            <h3>Agent Distribution</h3>
                            <p>51 total enrolled</p>
                          </div>
                        </div>

                        <div className="agent-dist-list">
                          <div className="agent-dist-row">
                            <span className="agent-dist-label">Available</span>
                            <div className="agent-dist-track">
                              <div className="agent-dist-fill" style={{ width: "24%", background: "#059669" }} />
                            </div>
                            <span className="agent-dist-count">12</span>
                          </div>
                          <div className="agent-dist-row">
                            <span className="agent-dist-label">On Mission</span>
                            <div className="agent-dist-track">
                              <div className="agent-dist-fill" style={{ width: "35%", background: "#2563eb" }} />
                            </div>
                            <span className="agent-dist-count">18</span>
                          </div>
                          <div className="agent-dist-row">
                            <span className="agent-dist-label">Inspecting</span>
                            <div className="agent-dist-track">
                              <div className="agent-dist-fill" style={{ width: "18%", background: "#047857" }} />
                            </div>
                            <span className="agent-dist-count">9</span>
                          </div>
                          <div className="agent-dist-row">
                            <span className="agent-dist-label">Fine in Progress</span>
                            <div className="agent-dist-track">
                              <div className="agent-dist-fill" style={{ width: "4%", background: "#d97706" }} />
                            </div>
                            <span className="agent-dist-count">2</span>
                          </div>
                          <div className="agent-dist-row">
                            <span className="agent-dist-label">Break</span>
                            <div className="agent-dist-track">
                              <div className="agent-dist-fill" style={{ width: "6%", background: "#d97706" }} />
                            </div>
                            <span className="agent-dist-count">3</span>
                          </div>
                          <div className="agent-dist-row">
                            <span className="agent-dist-label">Emergency</span>
                            <div className="agent-dist-track">
                              <div className="agent-dist-fill" style={{ width: "2%", background: "#dc2626" }} />
                            </div>
                            <span className="agent-dist-count">1</span>
                          </div>
                          <div className="agent-dist-row">
                            <span className="agent-dist-label">Offline</span>
                            <div className="agent-dist-track">
                              <div className="agent-dist-fill" style={{ width: "12%", background: "#64748b" }} />
                            </div>
                            <span className="agent-dist-count">6</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              }
            />

            {/* Live Operations Map (PDF 2) */}
            <Route
              path="/surveillance"
              element={
                <LiveOperationsMapScreen
                  agents={agents}
                  stats={stats}
                  missions={missions}
                  onSelectAgent={handleSelectAgent}
                  selectedAgent={selectedAgent}
                  selectedMission={selectedMission}
                  isDrawerOpen={isDrawerOpen}
                  onCloseDrawer={() => setIsDrawerOpen(false)}
                  updateStatus={updateStatus}
                  updatingAgentId={updatingAgentId}
                />
              }
            />

            {/* Dedicated Vehicle Lookup */}
            <Route
              path="/vehicles"
              element={<VehicleLookupPage onQuickPlate={() => {}} />}
            />

            {/* Dedicated Missions View */}
            <Route
              path="/missions"
              element={
                <div style={{ padding: "20px 24px" }}>
                  <div className="card-white">
                    <div className="card-white-header">
                      <div className="card-title-group">
                        <h3>Active Missions</h3>
                        <p>Currently in progress on corridors</p>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb" }}>
                        {missions.length} Missions Active
                      </span>
                    </div>
                    <table className="pdf-table">
                      <thead>
                        <tr>
                          <th>MISSION</th>
                          <th>AGENT</th>
                          <th>ROAD</th>
                          <th>ROUTE</th>
                          <th>PROGRESS</th>
                          <th>DURATION</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missions.map((m) => {
                          const pct = m.total_km > 0 ? Math.round((m.covered_km / m.total_km) * 100) : 40;
                          return (
                            <tr key={m.id}>
                              <td style={{ fontWeight: 700, color: "#2563eb" }}>{m.mission_code}</td>
                              <td style={{ fontWeight: 600, color: "#0f172a" }}>{m.agent_name || "Mamadou Diallo"}</td>
                              <td>{m.road_name}</td>
                              <td style={{ color: "#64748b" }}>{m.route || "Coyah → Dubréka"}</td>
                              <td>
                                <div className="table-progress-bar">
                                  <div className="table-progress-track">
                                    <div className="table-progress-fill" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span style={{ fontWeight: 700, fontSize: "11px" }}>{pct}%</span>
                                </div>
                              </td>
                              <td>{m.duration_text || "00h 52m"}</td>
                              <td>
                                <span className="badge-status-dot blue">
                                  <span className="status-bullet" />
                                  {m.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            />

            {/* Dedicated Agents View */}
            <Route
              path="/agents"
              element={
                <div style={{ padding: "20px 24px" }}>
                  <div className="card-white">
                    <div className="card-white-header">
                      <div className="card-title-group">
                        <h3>Live Field Personnel Directory</h3>
                        <p>Field surveillance agent tracking</p>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669" }}>
                        {agents.length} Enrolled Agents
                      </span>
                    </div>
                    <table className="pdf-table">
                      <thead>
                        <tr>
                          <th>AGENT</th>
                          <th>STATUS</th>
                          <th>MISSION</th>
                          <th>LOCATION</th>
                          <th>DUTY</th>
                          <th>SYNC</th>
                          <th>STATUS UPDATE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map((ag) => (
                          <tr key={ag.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center" }}>
                                <span className="table-agent-circle green">
                                  {getInitials(ag.name)}
                                </span>
                                <div>
                                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{ag.name}</div>
                                  <div style={{ fontSize: "10px", color: "#94a3b8" }}>{ag.badge_number}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge-status-dot green">
                                <span className="status-bullet" />
                                {ag.status}
                              </span>
                            </td>
                            <td style={{ color: "#2563eb", fontWeight: 600 }}>{ag.active_mission_code || "—"}</td>
                            <td>{ag.location}</td>
                            <td>{ag.duty_duration}</td>
                            <td>{ag.last_sync}</td>
                            <td>
                              <select
                                style={{ padding: "3px 6px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                                value={ag.status}
                                disabled={updatingAgentId === ag.id}
                                onChange={(e) => updateStatus(ag, e.target.value)}
                              >
                                <option value="On Mission">On Mission</option>
                                <option value="Inspecting">Inspecting</option>
                                <option value="Available">Available</option>
                                <option value="On Duty">On Duty</option>
                                <option value="Break">Break</option>
                                <option value="Offline">Offline</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            />

            <Route
              path="*"
              element={
                <div style={{ padding: "40px", textAlign: "center" }}>
                  <h2>Page Not Found</h2>
                  <NavLink to="/" style={{ color: "#2563eb" }}>Return to Dashboard Overview</NavLink>
                </div>
              }
            />
          </Routes>
        )}

        {inspectingAgent && (
          <AgentDetailModal
            agent={inspectingAgent}
            mission={missions.find((m) => m.agent_id === inspectingAgent.id) || missions[0]}
            onClose={() => setInspectingAgent(null)}
            updateStatus={updateStatus}
            updatingAgentId={updatingAgentId}
            onNavigateMap={(ag) => {
              setSelectedAgent(ag);
              navigate("/surveillance");
            }}
          />
        )}

        {inspectingMission && (
          <MissionDetailModal
            mission={inspectingMission}
            agent={agents.find((a) => a.id === inspectingMission.agent_id)}
            onClose={() => setInspectingMission(null)}
            onNavigateMap={() => navigate("/surveillance")}
          />
        )}
      </main>
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
