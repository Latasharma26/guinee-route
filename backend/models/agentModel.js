const pool = require("../config/db");

const getAll = async () => {
  const result = await pool.query(`
    SELECT id, badge_number, name, status, lat, lng,
           COALESCE(location, 'RN1 Corridor') AS location,
           COALESCE(duty_duration, '02h 14m') AS duty_duration,
           COALESCE(last_sync, '1 min') AS last_sync,
           active_mission_code
    FROM agents
    ORDER BY id
  `);
  return result.rows;
};

const updateStatus = async (agentId, status) => {
  const result = await pool.query(
    `UPDATE agents
     SET status = $1
     WHERE id = $2
     RETURNING id, badge_number, name, status, lat, lng,
               location, duty_duration, last_sync, active_mission_code`,
    [status, agentId]
  );
  return result.rows[0] || null;
};

module.exports = { getAll, updateStatus };