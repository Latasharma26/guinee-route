const pool = require("../config/db");

const findByPlate = async (plate) => {
  const cleanPlate = String(plate || "").trim().toUpperCase();
  const result = await pool.query(
    `SELECT id, plate_number, make, model, status, owner
     FROM vehicles
     WHERE UPPER(plate_number) = $1
        OR REPLACE(REPLACE(UPPER(plate_number), ' ', ''), '-', '') = REPLACE(REPLACE($1, ' ', ''), '-', '')`,
    [cleanPlate]
  );
  return result.rows[0] || null;
};

const getViolationsByVehicleId = async (vehicleId) => {
  const result = await pool.query(
    `SELECT v.id, v.violation_code, v.violation_type, v.severity,
            v.fine_amount_gnf, v.status,
            COALESCE(v.payment_status, v.status) AS payment_status,
            v.description, v.created_at,
            m.mission_code, m.road_name,
            a.name AS agent_name
     FROM violations v
     LEFT JOIN missions m ON m.id = v.mission_id
     LEFT JOIN agents a ON a.id = m.agent_id
     WHERE v.vehicle_id = $1
     ORDER BY v.created_at DESC`,
    [vehicleId]
  );
  return result.rows;
};

const getViolationsByOwner = async (owner) => {
  const result = await pool.query(
    `SELECT v.id, v.violation_code, v.violation_type, v.severity,
            v.fine_amount_gnf, v.status,
            COALESCE(v.payment_status, v.status) AS payment_status,
            v.description, v.created_at,
            m.mission_code, m.road_name,
            a.name AS agent_name
     FROM violations v
     JOIN vehicles veh ON veh.id = v.vehicle_id
     LEFT JOIN missions m ON m.id = v.mission_id
     LEFT JOIN agents a ON a.id = m.agent_id
     WHERE veh.owner = $1
     ORDER BY v.created_at DESC`,
    [owner]
  );
  return result.rows;
};

module.exports = { findByPlate, getViolationsByVehicleId, getViolationsByOwner };