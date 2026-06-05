const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
const config = require('./_config');

function getSql() {
  if (!config.DATABASE_URL) {
    console.error('[Config] DATABASE_URL no configurado');
    throw new Error('Error de configuración del servidor. Contacta con el administrador.');
  }
  return neon(config.DATABASE_URL);
}

async function initDb(sql) {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (NOW()::text)
  )`;

  const dir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir)
    .filter(f => /^\d+.*\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const [row] = await sql`SELECT 1 FROM _migrations WHERE name = ${file}`;
    if (row) continue;

    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const statements = content.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      await sql(stmt);
    }
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;

    console.log(JSON.stringify({
      level: 'info',
      message: `Migration auto-applied at runtime: ${file}`,
      timestamp: new Date().toISOString(),
    }));
  }
}

module.exports = { getSql, initDb };
