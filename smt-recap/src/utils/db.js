/**
 * PostgreSQL database helper
 * Stores pipeline state per session instead of flat JSON files
 */

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME     || "smt_recap",
  user:     process.env.DB_USER     || "heinminhtet",
  password: process.env.DB_PASSWORD || "",
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pipeline_sessions (
      id          SERIAL PRIMARY KEY,
      session_id  TEXT UNIQUE NOT NULL,
      state       JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function getSession(sessionId) {
  const res = await pool.query(
    "SELECT state FROM pipeline_sessions WHERE session_id = $1",
    [sessionId]
  );
  return res.rows[0]?.state || {};
}

export async function saveSession(sessionId, patch) {
  await pool.query(`
    INSERT INTO pipeline_sessions (session_id, state, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (session_id) DO UPDATE
      SET state = pipeline_sessions.state || $2::jsonb,
          updated_at = NOW()
  `, [sessionId, JSON.stringify(patch)]);
}

export async function resetSession(sessionId) {
  await pool.query(
    "DELETE FROM pipeline_sessions WHERE session_id = $1",
    [sessionId]
  );
}

export async function getAllSessions() {
  const res = await pool.query(
    "SELECT session_id, state, created_at, updated_at FROM pipeline_sessions ORDER BY updated_at DESC"
  );
  return res.rows;
}

export { pool };
