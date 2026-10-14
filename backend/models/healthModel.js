const pool = require("../config/db");

const checkDatabase = async () => {
  await pool.query("SELECT 1");
};

module.exports = { checkDatabase };