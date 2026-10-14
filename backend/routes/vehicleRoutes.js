const express = require("express");
const vehicleController = require("../controllers/vehicleController");

const router = express.Router();

router.get("/vehicles/lookup", vehicleController.lookupVehicle);

module.exports = router;