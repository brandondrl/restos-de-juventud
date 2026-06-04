const { neon } = require('@neondatabase/serverless');

function getSql() {
  return neon(process.env.DATABASE_URL);
}

module.exports = { getSql };
