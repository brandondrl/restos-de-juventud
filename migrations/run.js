const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const sql = neon(process.env.DATABASE_URL);

  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (NOW()::text)
  )`;

  const dir = __dirname;
  const files = fs.readdirSync(dir)
    .filter(f => /^\d+.*\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const [row] = await sql`SELECT 1 FROM _migrations WHERE name = ${file}`;
    if (row) {
      console.log(`Already applied: ${file}`);
      continue;
    }

    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const statements = content.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    console.log(`Applied: ${file}`);
  }

  console.log('All migrations complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
