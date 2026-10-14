const express = require("express");
const missionController = require("../controllers/missionController");

const router = express.Router();

router.get("/missions", missionController.getMissions);

module.exports = router;