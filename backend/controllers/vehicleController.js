const vehicleModel = require("../models/vehicleModel");
const { logError } = require("../middleware/errorHandler");

const lookupVehicle = async (req, res) => {
  const plate = String(req.query.plate || "").trim().toUpperCase();

  if (!plate) {
    return res.status(400).json({
      success: false,
      message: "Please provide a vehicle plate number",
    });
  }

  try {
    const vehicle = await vehicleModel.findByPlate(plate);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: "Vehicle not found" });
    }

    const violations = await vehicleModel.getViolationsByVehicleId(vehicle.id);
    const unpaidFines = violations
      .filter((v) => (v.status || "Unpaid").toLowerCase() === "unpaid")
      .reduce((sum, v) => sum + Number(v.fine_amount_gnf || 0), 0);

    res.json({
      success: true,
      data: {
        ...vehicle,
        unpaid_fines_gnf: unpaidFines,
        violations,
      },
    });
  } catch (error) {
    logError("vehicle_lookup_failed", error);
    res.status(500).json({
      success: false,
      message: "Could not look up vehicle",
    });
  }
};

module.exports = { lookupVehicle };