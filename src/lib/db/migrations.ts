import type { DB } from './client';

export async function runMigrations(db: DB): Promise<void> {
  // subjects
  await db.execute(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // topics
  await db.execute(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(subject_id, name),
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
  `);

  // sessions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      start_ts INTEGER NOT NULL,
      end_ts INTEGER NOT NULL,
      duration_min INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      focus INTEGER,
      note TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
  `);

  // session_topics
  await db.execute(`
    CREATE TABLE IF NOT EXISTS session_topics (
      session_id TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      PRIMARY KEY(session_id, topic_id),
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
  `);

  // settings
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // goals
  await db.execute(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      subject_id TEXT,
      minutes_per_week INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
  `);

  // daily_briefs
  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_briefs (
      date TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Indices
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_ts);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_subject ON sessions(subject_id, start_ts);`);

  // Migration v2: add archived + passed_at to subjects (idempotent — catches duplicate column error)
  try { await db.execute(`ALTER TABLE subjects ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;`); } catch { /* already exists */ }
  try { await db.execute(`ALTER TABLE subjects ADD COLUMN passed_at INTEGER;`); } catch { /* already exists */ }


  // Default settings
  await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('llm.enabled', 'false');`);
  await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('llm.endpoint', 'http://localhost:11434/v1/chat/completions');`);
  await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('llm.model', 'qwen3:4b');`);
  await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('llm.temperature', '0.2');`);
  await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('llm.maxTokens', '250');`);
  await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('llm.timeoutMs', '8000');`);
  await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('llm.frequency', 'once_per_day');`);
  await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('goal.weeklyMinutes', '1200');`);
  await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('app.version', '1.0.0');`);
}
