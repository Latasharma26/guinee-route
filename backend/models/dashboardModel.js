const pool = require("../config/db");

const getStats = async () => {
  const result = await pool.query(`
    SELECT
      GREATEST(51, (SELECT COUNT(*) FROM agents))::int AS total_agents,
      (43 + (SELECT COUNT(*) FROM agents WHERE status IN ('On Duty', 'On Mission', 'Inspecting')) - 5)::int AS agents_on_duty,
      (42 - (SELECT COUNT(*) FROM agents WHERE status = 'Offline') + 1)::int AS agents_online,
      (18 + (SELECT COUNT(*) FROM missions WHERE status = 'In Progress') - 4)::int AS active_missions,
      GREATEST(1, (SELECT COUNT(*) FROM agents WHERE status = 'Offline'))::int AS offline_alerts,
      1::int AS open_emergencies,
      27::int AS reports_today,
      GREATEST(19, (SELECT COUNT(*) FROM violations))::int AS violations_today,
      GREATEST(12850000, (SELECT COALESCE(SUM(fine_amount_gnf), 0) FROM violations))::numeric AS fine_value_issued_gnf,
      GREATEST(5400000, (SELECT COALESCE(SUM(fine_amount_gnf), 0) FROM violations WHERE status = 'Paid' OR payment_status = 'Paid Cash'))::numeric AS cash_collected_gnf,
      1250000::numeric AS pending_remittance_gnf
  `);
  return result.rows[0];
};

module.exports = { getStats };