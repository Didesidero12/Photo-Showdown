const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const connectionString = "postgres://postgres:postgres@127.0.0.1:54322/postgres";
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to DB.");
    
    const sql = fs.readFileSync('supabase/migrations/0016_milestone_3_1_verification.sql', 'utf8');
    
    await client.query(sql);
    console.log("Migration applied successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
