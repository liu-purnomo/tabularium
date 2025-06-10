import cron from 'node-cron';
import { pool } from '../db/index.js';
import { generateSafeColumns } from '../lib/generate-safe-columns.js';
import { Sheet } from '../lib/google-sheet.js';

function parseInterval(interval) {
  const value = parseInt(interval.slice(0, -1));
  const unit = interval.slice(-1);
  const multipliers = { m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 0);
}

cron.schedule('* * * * *', async () => {
  const res = await pool.query(
    'SELECT * FROM sheet_syncs WHERE is_syncing = false'
  );

  for (const sync of res.rows) {
    const { id, sheet_id, range, target_table, interval, last_synced_at } =
      sync;

    const now = Date.now();
    const last = last_synced_at ? new Date(last_synced_at).getTime() : 0;
    const nextAllowed = last + parseInterval(interval);

    if (now >= nextAllowed) {
      try {
        await pool.query(
          'UPDATE sheet_syncs SET is_syncing = true WHERE id = $1',
          [id]
        );

        const data = await Sheet.read(sheet_id, range);
        if (!data?.length) throw new Error('Empty Sheet');

        const headers = Object.keys(data[0]);
        const safeColumns = generateSafeColumns(headers);

        let inserted = 0;
        for (const row of data) {
          const values = safeColumns.map((col, i) => {
            const originalKey = headers[i];
            return row[originalKey];
          });

          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

          const checkSql = `SELECT 1 FROM "${target_table}" WHERE ${safeColumns
            .map((col, i) => `"${col}" = $${i + 1}`)
            .join(' AND ')} LIMIT 1`;

          const check = await pool.query(checkSql, values);
          if (check.rowCount === 0) {
            const insertSql = `INSERT INTO "${target_table}" (${safeColumns
              .map((c) => `"${c}"`)
              .join(', ')}) VALUES (${placeholders})`;
            await pool.query(insertSql, values);
            inserted++;
          }
        }

        await pool.query(
          'UPDATE sheet_syncs SET last_synced_at = NOW() WHERE id = $1',
          [id]
        );
      } catch (err) {
      } finally {
        await pool.query(
          'UPDATE sheet_syncs SET is_syncing = false WHERE id = $1',
          [id]
        );
      }
    }
  }
});
