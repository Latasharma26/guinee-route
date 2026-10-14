
const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
require("dotenv").config();
const pool = require("./config/db");
const agentRoutes = require("./routes/agentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const healthRoutes = require("./routes/healthRoutes");
const missionRoutes = require("./routes/missionRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const { errorHandler, logError } = require("./middleware/errorHandler");

const app = express();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);

if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
}

app.set("trust proxy", trustProxyHops);

const allowedOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

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
    limit: 5000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many requests" },
  })
);
app.use(express.json());

app.use("/api/v1", healthRoutes);
app.use("/api/v1", dashboardRoutes);
app.use("/api/v1", agentRoutes);
app.use("/api/v1", missionRoutes);
app.use("/api/v1", vehicleRoutes);
app.use(errorHandler);

// -------------------- START SERVER --------------------

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await pool.query("SELECT 1");

    const server = app.listen(PORT, () => {
      console.log(`GuinéeRoute API running on port ${PORT}`);
      console.log("PostgreSQL connected");
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
    process.exitCode = 1;
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
