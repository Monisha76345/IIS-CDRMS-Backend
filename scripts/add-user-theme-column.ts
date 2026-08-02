/**
 * Ensures users.themePreference exists as VARCHAR (supports all theme ids).
 * Usage: npm run db:migrate:theme
 */
import mysql, { type RowDataPacket } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function main() {
  const database = process.env.DB_DATABASE || 'cdrms';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
  });

  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT DATA_TYPE AS dataType, COLUMN_TYPE AS columnType
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'themePreference'`,
    [database],
  );

  const col = rows[0] as { dataType?: string; columnType?: string } | undefined;

  if (!col) {
    await conn.query(`
      ALTER TABLE users
        ADD COLUMN themePreference VARCHAR(32) NOT NULL DEFAULT 'blue'
    `);
    console.log('[db:migrate:theme] Added users.themePreference VARCHAR(32).');
  } else if (String(col.dataType).toLowerCase() === 'enum') {
    await conn.query(`
      ALTER TABLE users
        MODIFY COLUMN themePreference VARCHAR(32) NOT NULL DEFAULT 'blue'
    `);
    console.log('[db:migrate:theme] Converted themePreference ENUM → VARCHAR(32).');
  } else {
    console.log('[db:migrate:theme] users.themePreference already VARCHAR — ok.');
  }

  await conn.end();
}

main().catch((err) => {
  console.error('[db:migrate:theme] Failed:', err.message);
  process.exit(1);
});
