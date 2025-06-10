import express from 'express';
import { pool } from '../db/index.js';
import { Sheet } from '../lib/google-sheet.js';
import { requireLogin } from '../middleware/require-login.js';

export const syncRouter = express.Router();

function isValidTableName(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function inferColumnType(value) {
  //   if (!value) return 'TEXT';
  //   if (!isNaN(value))
  //     return Number.isInteger(Number(value)) ? 'INTEGER' : 'REAL';
  //   if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')
  //     return 'BOOLEAN';
  //   if (!isNaN(Date.parse(value))) return 'DATE';
  return 'TEXT';
}

function slugify(text) {
  return text
    .toString()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/__+/g, '_')
    .toLowerCase();
}

syncRouter.use(requireLogin);

syncRouter.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM sheet_syncs ORDER BY id DESC');
  res.render('index', {
    syncs: result.rows,
    alert: req.session?.alert || null,
    old: {},
  });
  if (req.session) req.session.alert = null;
});

syncRouter.post('/syncs', async (req, res) => {
  const {
    title,
    description,
    sheet_id,
    range,
    interval_value,
    interval_unit,
    target_table,
  } = req.body;

  const interval = `${interval_value}${interval_unit}`;

  if (
    !title ||
    !sheet_id ||
    !interval_unit ||
    !interval_value ||
    !target_table
  ) {
    const syncs = await pool.query(
      'SELECT * FROM sheet_syncs ORDER BY id DESC'
    );
    return res.render('index', {
      syncs: syncs.rows,
      alert: '❌ All * fields are required.',
      old: req.body,
    });
  }

  if (!isValidTableName(target_table)) {
    const syncs = await pool.query(
      'SELECT * FROM sheet_syncs ORDER BY id DESC'
    );
    return res.render('index', {
      syncs: syncs.rows,
      alert: '❌ Invalid table name.',
      old: req.body,
    });
  }

  let previewData;
  try {
    previewData = await Sheet.read(sheet_id, range);
    if (!previewData?.length) throw new Error('Empty or invalid sheet');
  } catch (err) {
    const syncs = await pool.query(
      'SELECT * FROM sheet_syncs ORDER BY id DESC'
    );
    return res.render('index', {
      syncs: syncs.rows,
      alert: `❌ Failed to access Google Sheet. Please check the Sheet ID and range.`,
      old: req.body,
    });
  }

  try {
    await pool.query(
      `INSERT INTO sheet_syncs (title, description, sheet_id, range, interval, target_table)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [title, description, sheet_id, range, interval, target_table]
    );
  } catch (err) {
    const syncs = await pool.query(
      'SELECT * FROM sheet_syncs ORDER BY id DESC'
    );
    if (err.code === '23505') {
      return res.render('index', {
        syncs: syncs.rows,
        alert: `⚠️ Sync config with target table "${target_table}" already exists.`,
        old: req.body,
      });
    }
    // console.error('❌ Failed to insert sync config:', err);
    req.session.alert = '❌ Failed to save sync config.';
    return res.redirect('/');
  }

  const tableCheck = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables WHERE table_name = $1
    )`,
    [target_table]
  );

  if (!tableCheck.rows[0].exists) {
    const headers = Object.keys(previewData[0]);
    const firstRow = previewData[0];
    const columns = headers.map((key) => {
      const colName = slugify(key) === 'id' ? 'id_from_sheet' : slugify(key);
      const colType = inferColumnType(firstRow[key]);
      return `"${colName}" ${colType}`;
    });

    const createSQL = `CREATE TABLE "${target_table}" (
      id SERIAL PRIMARY KEY,
      ${columns.join(',\n      ')},
      synced_at TIMESTAMP DEFAULT NOW()
    )`;

    await pool.query(createSQL);
    // console.log(`🛠️ Created table "${target_table}" with inferred structure`);
  } else {
    req.session.alert = `⚠️ Table "${target_table}" already exists. Configuration saved only.`;
  }

  res.redirect('/');
});

syncRouter.get('/syncs/:id/edit', async (req, res) => {
  const result = await pool.query('SELECT * FROM sheet_syncs WHERE id = $1', [
    req.params.id,
  ]);
  const sync = result.rows[0];

  if (!sync) {
    req.session.alert = '❌ Config not found.';
    return res.redirect('/');
  }

  res.render('edit', { sync });
});

syncRouter.post('/syncs/:id/edit', async (req, res) => {
  const { title, description, sheet_id, range, interval_value, interval_unit } =
    req.body;
  const interval = `${interval_value}${interval_unit}`;

  await pool.query(
    `UPDATE sheet_syncs
     SET title = $1, description = $2, sheet_id = $3, range = $4, interval = $5
     WHERE id = $6`,
    [title, description, sheet_id, range, interval, req.params.id]
  );
  res.redirect('/');
});

syncRouter.post('/syncs/:id/delete', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT target_table FROM sheet_syncs WHERE id = $1',
      [id]
    );
    const sync = result.rows[0];

    if (!sync) {
      req.session.alert = `❌ Config with ID ${id} not found.`;
      return res.redirect('/');
    }

    const tableName = sync.target_table;

    await pool.query(`DROP TABLE IF EXISTS "${tableName}"`);
    await pool.query('DELETE FROM sheet_syncs WHERE id = $1', [id]);

    // console.log(`🗑️ Dropped table "${tableName}"`);
    req.session.alert = `✅ Deleted sync config and table "${tableName}".`;
  } catch (err) {
    // console.error('❌ Failed to delete sync config:', err);
    req.session.alert = '❌ Failed to delete sync config.';
  }

  res.redirect('/');
});

syncRouter.post('/syncs/:id/sync', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT * FROM sheet_syncs WHERE id = $1',
      [id]
    );
    const sync = rows[0];

    if (!sync) {
      req.session.alert = '❌ Sync config not found.';
      return res.redirect('/');
    }

    if (sync.is_syncing) {
      req.session.alert = '⏳ Sync already in progress. Please wait...';
      return res.redirect('/');
    }

    await pool.query('UPDATE sheet_syncs SET is_syncing = true WHERE id = $1', [
      id,
    ]);

    const { sheet_id, range, target_table } = sync;
    const data = await Sheet.read(sheet_id, range);

    await pool.query(`DELETE FROM "${target_table}"`);

    const columns = Object.keys(data[0]).map((key) =>
      slugify(key) === 'id' ? 'id_from_sheet' : slugify(key)
    );

    for (const row of data) {
      const values = columns.map((col, i) => {
        const originalKey = Object.keys(row)[i];
        return row[originalKey];
      });
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO "${target_table}" (${columns
        .map((c) => `"${c}"`)
        .join(', ')}) VALUES (${placeholders})`;
      await pool.query(sql, values);
    }

    await pool.query(
      `UPDATE sheet_syncs SET last_synced_at = NOW() WHERE id = $1`,
      [id]
    );

    req.session.alert = `✅ Manual sync to "${target_table}" succeeded.`;
  } catch (err) {
    // console.error('❌ Manual sync error:', err);
    req.session.alert = '❌ Failed to sync data manually.';
  } finally {
    await pool.query(
      'UPDATE sheet_syncs SET is_syncing = false WHERE id = $1',
      [id]
    );
  }

  res.redirect('/');
});

syncRouter.get('/syncs/:id/detail', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM sheet_syncs WHERE id = $1', [
      id,
    ]);
    const sync = result.rows[0];

    if (!sync) {
      req.session.alert = '❌ Config not found.';
      return res.redirect('/');
    }

    const { target_table } = sync;

    if (!isValidTableName(target_table)) {
      req.session.alert = '❌ Invalid table name.';
      return res.redirect('/');
    }

    const columnsResult = await pool.query(
      `
      SELECT column_name AS name, data_type AS type
      FROM information_schema.columns
      WHERE table_name = $1
    `,
      [target_table]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM "${target_table}"`
    );
    const rowCount = parseInt(countResult.rows[0].count, 10);

    const sizeResult = await pool.query(
      `
      SELECT pg_total_relation_size($1) AS size
    `,
      [`"${target_table}"`]
    );
    const fileSizeBytes = parseInt(sizeResult.rows[0].size, 10);

    return res.render('detail', {
      sync,
      count: rowCount,
      size_bytes: fileSizeBytes,
      size_readable: formatSize(fileSizeBytes),
      columns: columnsResult.rows,
    });
  } catch (err) {
    req.session.alert = '❌ Failed to load table detail.';
    return res.redirect('/');
  }
});

function formatSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
