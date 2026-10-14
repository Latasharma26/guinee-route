const dashboardModel = require("../models/dashboardModel");
const { logError } = require("../middleware/errorHandler");

const getStats = async (req, res) => {
  try {
    res.json(await dashboardModel.getStats());
  } catch (error) {
    logError("dashboard_stats_failed", error);
    res.status(500).json({
      success: false,
      message: "Could not load dashboard stats",
    });
  }
};

module.exports = { getStats };