const pool = require("../config/db");

const getAll = async () => {
  const result = await pool.query(`
    SELECT m.id, m.mission_code, m.road_name, m.route, m.total_km, m.covered_km,
           m.status, m.agent_id, m.violations, m.duration_minutes, m.duration_text,
           a.name AS agent_name, a.badge_number AS agent_badge
    FROM missions m
    LEFT JOIN agents a ON a.id = m.agent_id
    ORDER BY m.id
  `);
  return result.rows;
};

module.exports = { getAll };