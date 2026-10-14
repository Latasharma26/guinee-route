const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Mock database before importing the app.
const pool = require("../config/db");
pool.query = async () => ({ rows: [{ "?column?": 1 }] });

const healthModel = require("../models/healthModel");
healthModel.checkDatabase = async () => {};

const agentModel = require("../models/agentModel");
agentModel.updateStatus = async () => null;

const vehicleModel = require("../models/vehicleModel");
vehicleModel.findByPlate = async () => null;

const { app } = require("../server");

test("GET /api/v1/health returns success", async () => {
  const response = await request(app).get("/api/v1/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("PATCH agent status rejects invalid agent ID", async () => {
  const response = await request(app)
    .patch("/api/v1/agents/abc/status")
    .send({ status: "On Duty" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Invalid agent ID");
});

test("PATCH agent status rejects invalid status", async () => {
  const response = await request(app)
    .patch("/api/v1/agents/1/status")
    .send({ status: "Flying" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Invalid agent status");
});

test("GET vehicle lookup requires a plate number", async () => {
  const response = await request(app).get("/api/v1/vehicles/lookup");

  assert.equal(response.status, 400);
  assert.equal(
    response.body.message,
    "Please provide a vehicle plate number"
  );
});

test("GET vehicle lookup returns 404 for an unknown plate", async () => {
  const response = await request(app)
    .get("/api/v1/vehicles/lookup")
    .query({ plate: "UNKNOWN-PLATE" });

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Vehicle not found");
});

test("GET vehicle lookup returns vehicle with violations and unpaid fines", async () => {
  // Mock finding a valid vehicle
  vehicleModel.findByPlate = async (plate) => {
    if (plate.toUpperCase().includes("RC 8245 AB")) {
      return {
        id: 3,
        plate_number: "RC 8245 AB",
        make: "Scania",
        model: "R500",
        status: "Active",
        owner: "TransGuinée SA",
      };
    }
    return null;
  };

  vehicleModel.getViolationsByVehicleId = async (vehicleId) => {
    if (vehicleId === 3) {
      return [
        {
          id: 1,
          violation_type: "Unauthorized Heavy Vehicle",
          fine_amount_gnf: 750000,
          status: "Unpaid",
          description: "RN1 restricted corridor violation",
        },
      ];
    }
    return [];
  };

  const response = await request(app)
    .get("/api/v1/vehicles/lookup")
    .query({ plate: "RC 8245 AB" });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.plate_number, "RC 8245 AB");
  assert.equal(response.body.data.unpaid_fines_gnf, 750000);
  assert.equal(response.body.data.violations.length, 1);
  assert.equal(response.body.data.violations[0].status, "Unpaid");
});