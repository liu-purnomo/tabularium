import { pool } from './index.js';

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS sheet_syncs (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    sheet_id TEXT NOT NULL,
    range TEXT NOT NULL,
    interval TEXT NOT NULL,
    target_table TEXT NOT NULL UNIQUE,
    last_synced_at TIMESTAMP,
    is_syncing BOOLEAN DEFAULT false
  );
`;

async function migrate() {
  try {
    await pool.query(createTableQuery);
    console.log('✅ Table sheet_syncs created or already exists');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
