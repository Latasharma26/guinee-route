const agentModel = require("../models/agentModel");
const { logError } = require("../middleware/errorHandler");

const allowedStatuses = ["On Duty", "Break", "On Mission", "Offline", "Inspecting", "Available"];

const getLiveAgents = async (req, res) => {
  try {
    const agents = await agentModel.getAll();
    res.json({ success: true, data: agents });
  } catch (error) {
    logError("agents_load_failed", error);
    res.status(500).json({ success: false, message: "Could not load agents" });
  }
};

const updateStatus = async (req, res) => {
  const agentId = Number(req.params.id);
  const status = req.body?.status;

  if (!Number.isInteger(agentId) || agentId < 1) {
    return res.status(400).json({ success: false, message: "Invalid agent ID" });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid agent status" });
  }

  try {
    const agent = await agentModel.updateStatus(agentId, status);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    res.json({
      success: true,
      message: "Agent status updated",
      data: agent,
    });
  } catch (error) {
    logError("agent_status_update_failed", error);
    res.status(500).json({
      success: false,
      message: "Could not update agent status",
    });
  }
};

module.exports = { getLiveAgents, updateStatus };