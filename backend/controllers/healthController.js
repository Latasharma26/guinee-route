const healthModel = require("../models/healthModel");
const { logError } = require("../middleware/errorHandler");

const getHealth = async (req, res) => {
  try {
    await healthModel.checkDatabase();
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
};

module.exports = { getHealth };