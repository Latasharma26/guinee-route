const missionModel = require("../models/missionModel");
const { logError } = require("../middleware/errorHandler");

const getMissions = async (req, res) => {
  try {
    const missions = await missionModel.getAll();
    res.json({ success: true, data: missions });
  } catch (error) {
    logError("missions_load_failed", error);
    res.status(500).json({ success: false, message: "Could not load missions" });
  }
};

module.exports = { getMissions };