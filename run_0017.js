const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
});

async function run() {
  await client.connect();
  const sql = fs.readFileSync('supabase/migrations/0017_moderation_audit.sql', 'utf8');
  await client.query(sql);
  console.log("Migration 0017 applied");
  await client.end();
}
run();
