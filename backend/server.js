
const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
require("dotenv").config();
const { Pool } = require("pg");

const app = express();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);

if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
}

app.set("trust proxy", trustProxyHops);

const logError = (event, error) => {
  const code =
    typeof error?.code === "string" && /^[A-Z0-9_]+$/i.test(error.code)
      ? error.code
      : "UNEXPECTED_ERROR";
  console.error(JSON.stringify({ event, code }));
};

const allowedOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
  })
);
app.use(
  "/api/v1",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many requests" },
  })
);
app.use(express.json());

// -------------------- DATABASE SEED --------------------

const seedDatabase = async () => {
  await pool.query(`
    INSERT INTO agents
      (id, badge_number, name, status, lat, lng)
    VALUES
      (1, 'AGT-1048', 'Mamadou Diallo', 'On Mission', 9.6412, -13.5784),
      (2, 'AGT-1052', 'Ibrahima Camara', 'On Duty', 9.7001, -13.4502),
      (3, 'AGT-1061', 'Fatou Bah', 'Break', 9.6505, -13.6201),
      (4, 'AGT-1073', 'Alpha Barry', 'Offline', 9.6803, -13.5104)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO vehicles
      (id, plate_number, make, model, status, owner)
    VALUES
      (1, 'GN-2048-A', 'Toyota', 'Land Cruiser', 'Active', 'Mamadou Diallo'),
      (2, 'GN-1056-B', 'Nissan', 'Patrol', 'Active', 'Ibrahima Camara')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO missions
      (id, mission_code, road_name, total_km, covered_km,
       status, agent_id, violations, duration_minutes)
    VALUES
      (1, 'GR-MSN-2026-00984', 'RN1', 18.6, 7.4,
       'In Progress', 1, 3, 48)
    ON CONFLICT (id) DO NOTHING;
  `);

  // Ensure sequences are ready for future inserts.
  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('agents', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM agents), 1)
    );

    SELECT setval(
      pg_get_serial_sequence('vehicles', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM vehicles), 1)
    );

    SELECT setval(
      pg_get_serial_sequence('missions', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM missions), 1)
    );
  `);

  // Add a demo violation only when the mission has none.
  await pool.query(`
    INSERT INTO violations
      (mission_id, violation_type, fine_amount_gnf, description)
    SELECT 1, 'Speeding', 500000, 'Speed limit exceeded'
    WHERE EXISTS (SELECT 1 FROM missions WHERE id = 1)
      AND NOT EXISTS (
        SELECT 1 FROM violations WHERE mission_id = 1
      );
  `);
};

// -------------------- HEALTH CHECK --------------------

app.get("/api/v1/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "GuinéeRoute API and database are running",
    });
  } catch (error) {
    logError("health_check_failed", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// -------------------- DASHBOARD STATS --------------------

app.get("/api/v1/dashboard/stats", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM agents)::int AS total_agents,
        (SELECT COUNT(*) FROM agents
          WHERE status = 'On Duty')::int AS agents_on_duty,
        (SELECT COUNT(*) FROM missions
          WHERE status = 'In Progress')::int AS active_missions,
        (SELECT COUNT(*) FROM agents
          WHERE status = 'Offline')::int AS offline_alerts
    `);

    res.json(result.rows[0]);
  } catch (error) {
    logError("dashboard_stats_failed", error);

    res.status(500).json({
      success: false,
      message: "Could not load dashboard stats",
    });
  }
});

// -------------------- LIVE AGENTS --------------------

app.get("/api/v1/agents/live", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, badge_number, name, status, lat, lng
      FROM agents
      ORDER BY id
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logError("agents_load_failed", error);

    res.status(500).json({
      success: false,
      message: "Could not load agents",
    });
  }
});

// -------------------- UPDATE AGENT STATUS --------------------

app.patch(
  "/api/v1/agents/:id/status",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many status updates" },
  }),
  async (req, res) => {
  const allowedStatuses = ["On Duty", "Break", "On Mission", "Offline"];
  const { status } = req.body;
  const agentId = Number(req.params.id);

  if (!Number.isInteger(agentId) || agentId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid agent ID",
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid agent status",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE agents
       SET status = $1
       WHERE id = $2
       RETURNING id, badge_number, name, status, lat, lng`,
      [status, agentId]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    res.json({
      success: true,
      message: "Agent status updated",
      data: result.rows[0],
    });
  } catch (error) {
    logError("agent_status_update_failed", error);

    res.status(500).json({
      success: false,
      message: "Could not update agent status",
    });
  }
  }
);

// -------------------- MISSIONS --------------------

app.get("/api/v1/missions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, mission_code, road_name, total_km, covered_km,
             status, agent_id, violations, duration_minutes
      FROM missions
      ORDER BY id
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logError("missions_load_failed", error);

    res.status(500).json({
      success: false,
      message: "Could not load missions",
    });
  }
});

// -------------------- VEHICLE LOOKUP --------------------

app.get("/api/v1/vehicles/lookup", async (req, res) => {
  const plate = String(req.query.plate || "").trim().toUpperCase();

  if (!plate) {
    return res.status(400).json({
      success: false,
      message: "Please provide a vehicle plate number",
    });
  }

  try {
    const vehicleResult = await pool.query(
      `SELECT id, plate_number, make, model, status, owner
       FROM vehicles
       WHERE UPPER(plate_number) = $1`,
      [plate]
    );

    if (!vehicleResult.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    const vehicle = vehicleResult.rows[0];

    // Current schema connects violations to missions, not vehicles.
    // For this demo, show violations for the vehicle's active mission agent.
    const violationsResult = await pool.query(
      `SELECT v.id, v.violation_type, v.fine_amount_gnf,
              v.description, v.created_at
       FROM violations v
       JOIN missions m ON m.id = v.mission_id
       JOIN agents a ON a.id = m.agent_id
       WHERE a.name = $1
       ORDER BY v.created_at DESC`,
      [vehicle.owner]
    );

    res.json({
      success: true,
      data: {
        ...vehicle,
        violations: violationsResult.rows,
      },
    });
  } catch (error) {
    logError("vehicle_lookup_failed", error);

    res.status(500).json({
      success: false,
      message: "Could not look up vehicle",
    });
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  logError("request_failed", error);

  res.status(status).json({
    success: false,
    message: status < 500 ? "Invalid request" : "Internal server error",
  });
});

// -------------------- START SERVER --------------------

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await pool.query("SELECT 1");
    await seedDatabase();

    const server = app.listen(PORT, () => {
      console.log(`GuinéeRoute API running on port ${PORT}`);
      console.log("PostgreSQL connected and sample data ready");
    });

    const shutdown = () => {
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logError("startup_failed", error);
    process.exit(1);
  }
};

startServer();
