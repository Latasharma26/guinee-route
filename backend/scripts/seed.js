require("dotenv").config();
const pool = require("../config/db");
const { logError } = require("../middleware/errorHandler");

const seedDatabase = async () => {
  await pool.query(`
    INSERT INTO agents
      (id, badge_number, name, status, lat, lng, location, duty_duration, last_sync, active_mission_code)
    VALUES
      (1, 'AGT-1048', 'Mamadou Diallo', 'On Mission', 9.6412, -13.5784, 'RN1 Coyah', '02h 14m', '1 min', '…00984'),
      (2, 'AGT-1052', 'Aissatou Bah', 'Inspecting', 9.6505, -13.5500, 'R. Le Prince', '01h 32m', '30 sec', '…00991'),
      (3, 'AGT-1061', 'Alpha Condé', 'Offline', 9.6803, -13.5104, 'Dubréka', '03h 05m', '18 min', '…00987'),
      (4, 'AGT-1067', 'Mariama Camara', 'Available', 9.6300, -13.6000, 'RN3', '01h 45m', '1 min', NULL),
      (5, 'AGT-1073', 'Oumar Kouyaté', 'On Mission', 9.7001, -13.4502, 'RN3', '02h 30m', '2 min', '…00988'),
      (6, 'AGT-1080', 'Sékou Touré', 'On Mission', 9.6650, -13.5250, 'Zone Ind.', '01h 14m', '5 min', '…00990')
    ON CONFLICT (id) DO UPDATE SET
      badge_number = EXCLUDED.badge_number,
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      location = EXCLUDED.location,
      duty_duration = EXCLUDED.duty_duration,
      last_sync = EXCLUDED.last_sync,
      active_mission_code = EXCLUDED.active_mission_code;

    INSERT INTO vehicles
      (id, plate_number, make, model, status, owner)
    VALUES
      (1, 'GN-2048-A', 'Toyota', 'Land Cruiser', 'Active', 'Mamadou Diallo'),
      (2, 'GN-1056-B', 'Nissan', 'Patrol', 'Active', 'Ibrahima Camara'),
      (3, 'RC 8245 AB', 'Scania', 'R500 Heavy Truck', 'Active', 'TransGuinée SA'),
      (4, 'RC 1920 CC', 'Mercedes-Benz', 'Actros', 'Active', 'Société Minière de Boké')
    ON CONFLICT (id) DO UPDATE SET
      plate_number = EXCLUDED.plate_number,
      make = EXCLUDED.make,
      model = EXCLUDED.model,
      status = EXCLUDED.status,
      owner = EXCLUDED.owner;

    INSERT INTO missions
      (id, mission_code, road_name, route, total_km, covered_km,
       status, agent_id, violations, duration_minutes, duration_text)
    VALUES
      (1, '00984', 'RN1', 'Coyah → Dubréka', 18.6, 7.44, 'In Progress', 1, 2, 52, '00h 52m'),
      (2, '00991', 'R. Le Prince', 'Hamdallaye → Sonfonia', 12.0, 8.16, 'In Progress', 2, 1, 92, '01h 32m'),
      (3, '00988', 'RN3', 'Kindia → Mamou', 25.0, 13.75, 'In Progress', 5, 1, 150, '02h 30m'),
      (4, '00990', 'R. Industrielle', 'Zone Ind. → Port', 15.0, 12.0, 'In Progress', 6, 0, 74, '01h 14m')
    ON CONFLICT (id) DO UPDATE SET
      mission_code = EXCLUDED.mission_code,
      road_name = EXCLUDED.road_name,
      route = EXCLUDED.route,
      total_km = EXCLUDED.total_km,
      covered_km = EXCLUDED.covered_km,
      status = EXCLUDED.status,
      agent_id = EXCLUDED.agent_id,
      violations = EXCLUDED.violations,
      duration_minutes = EXCLUDED.duration_minutes,
      duration_text = EXCLUDED.duration_text;
  `);

  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('agents', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM agents), 1)
    );

    SELECT setval(
      pg_get_serial_sequence('vehicles', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM vehicles), 1)
    );

    SELECT setval(
      pg_get_serial_sequence('missions', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM missions), 1)
    );
  `);

  await pool.query(`
    INSERT INTO violations
      (id, vehicle_id, mission_id, violation_code, violation_type, severity, fine_amount_gnf, status, payment_status, description)
    VALUES
      (1, 3, 1, '26-01844', 'Unauthorized Heavy Vehicle', 'Severe', 750000, 'Paid', 'Paid Cash', 'Unauthorized heavy vehicle on RN1 corridor'),
      (2, 1, 2, '26-01843', 'Road Occupation', 'Moderate', 300000, 'Unpaid', 'Issued', 'Road occupation during transit peak'),
      (3, 4, 3, '26-01841', 'Overloaded Vehicle', 'Very Severe', 1200000, 'Unpaid', 'Partially Paid', 'Overloaded vehicle exceeding axle threshold on RN3'),
      (4, 1, 1, '26-01840', 'Speeding', 'Moderate', 500000, 'Unpaid', 'Unpaid', 'Radar recorded 94 km/h in 60 km/h zone')
    ON CONFLICT (id) DO UPDATE SET
      vehicle_id = EXCLUDED.vehicle_id,
      mission_id = EXCLUDED.mission_id,
      violation_code = EXCLUDED.violation_code,
      violation_type = EXCLUDED.violation_type,
      severity = EXCLUDED.severity,
      fine_amount_gnf = EXCLUDED.fine_amount_gnf,
      status = EXCLUDED.status,
      payment_status = EXCLUDED.payment_status,
      description = EXCLUDED.description;

    SELECT setval(
      pg_get_serial_sequence('violations', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM violations), 1)
    );
  `);
};

seedDatabase()
  .then(() => console.log("Sample data ready"))
  .catch((error) => {
    logError("seed_failed", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());