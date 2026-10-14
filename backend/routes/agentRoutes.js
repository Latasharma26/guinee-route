const express = require("express");
const { rateLimit } = require("express-rate-limit");
const agentController = require("../controllers/agentController");

const router = express.Router();

router.get("/agents/live", agentController.getLiveAgents);
router.patch(
  "/agents/:id/status",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many status updates" },
  }),
  agentController.updateStatus
);

module.exports = router;