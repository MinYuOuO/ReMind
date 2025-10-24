import { Injectable } from '@angular/core';
import { SqliteDbService } from './db.service';
import { Platform } from '@ionic/angular';

const SCHEMA_SQL = `

-- USER
CREATE TABLE IF NOT EXISTS user (
  user_id        TEXT PRIMARY KEY,
  username       TEXT NOT NULL,
  contact_detail TEXT,
  birthday       TEXT,   -- 'YYYY-MM-DD'
  notes          TEXT
);

-- CONTACT
CREATE TABLE IF NOT EXISTS contact (
  contact_id     TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  name           TEXT NOT NULL,
  relationship   TEXT NOT NULL CHECK (relationship IN ('friend','best_friend','colleague','family')),
  contact_detail TEXT,
  birthday       TEXT,   -- 'YYYY-MM-DD'
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  notes          TEXT,
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contact_user ON contact(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_name ON contact(name);

-- INTERACTION
CREATE TABLE IF NOT EXISTS interaction (
  interaction_id   TEXT PRIMARY KEY,
  contact_id       TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  interaction_date TEXT NOT NULL,  -- ISO datetime
  context          TEXT CHECK (context IN ('work','lunch','meeting','social')),
  user_summary     TEXT,
  raw_notes        TEXT,
  created_at       TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES user(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_interaction_contact ON interaction(contact_id);
CREATE INDEX IF NOT EXISTS idx_interaction_user ON interaction(user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_date ON interaction(interaction_date);

-- COGNITIVE_UNIT
CREATE TABLE IF NOT EXISTS cognitive_unit (
  unit_id          TEXT PRIMARY KEY,
  contact_id       TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('work_style','values','communication','behavior')),
  essence          TEXT NOT NULL,    -- core insight description
  confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 1 AND 5),
  last_confirmed   TEXT,             -- ISO datetime
  status           TEXT NOT NULL CHECK (status IN ('active','inactive','superseded')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cunit_contact ON cognitive_unit(contact_id);
CREATE INDEX IF NOT EXISTS idx_cunit_status ON cognitive_unit(status);

-- INSIGHT
CREATE TABLE IF NOT EXISTS insight (
  insight_id     TEXT PRIMARY KEY,
  contact_id     TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  insight_type   TEXT NOT NULL CHECK (insight_type IN ('pattern','reminder','suggestion')),
  content        TEXT NOT NULL,
  generated_at   TEXT NOT NULL,
  relevant_until TEXT,
  is_actionable  INTEGER NOT NULL CHECK (is_actionable IN (0,1)),
  FOREIGN KEY (contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES user(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_insight_contact ON insight(contact_id);
CREATE INDEX IF NOT EXISTS idx_insight_user ON insight(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_type ON insight(insight_type);

-- REMINDER
CREATE TABLE IF NOT EXISTS reminder (
  reminder_id   TEXT PRIMARY KEY,
  contact_id    TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('follow_up','birthday','check_in')),
  due_date      TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  priority      TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
  status        TEXT NOT NULL CHECK (status IN ('pending','completed','snoozed')),
  created_at    TEXT NOT NULL,
  completed_at  TEXT,
  FOREIGN KEY (contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES user(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reminder_due ON reminder(due_date);
CREATE INDEX IF NOT EXISTS idx_reminder_user ON reminder(user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_contact ON reminder(contact_id);
CREATE INDEX IF NOT EXISTS idx_reminder_status ON reminder(status);

-- AI_PROCESSING_LOG
CREATE TABLE IF NOT EXISTS ai_processing_log (
  log_id            TEXT PRIMARY KEY,
  interaction_id    TEXT NOT NULL,
  processed_at      TEXT NOT NULL,
  ai_model          TEXT,
  input_text        TEXT,
  output_json       TEXT,           -- JSON string
  user_confirmed    INTEGER NOT NULL DEFAULT 0 CHECK (user_confirmed IN (0,1)),
  confirmed_at      TEXT,
  status            TEXT NOT NULL CHECK (status IN ('success','error','pending')),
  cognitive_unit_id TEXT,
  FOREIGN KEY (interaction_id)   REFERENCES interaction(interaction_id) ON DELETE CASCADE,
  FOREIGN KEY (cognitive_unit_id) REFERENCES cognitive_unit(unit_id)  ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_log_interaction ON ai_processing_log(interaction_id);
CREATE INDEX IF NOT EXISTS idx_log_status ON ai_processing_log(status);


`;

@Injectable({ providedIn: 'root' })
export class DbInitService 
{
  private initialized = false;

  constructor(
    private db: SqliteDbService,
    private platform: Platform
  ) {}

  async init(): Promise<void> {
    if (this.initialized) {
      console.log('[DB] already initialized — skipping.');
      return;
    }
    

    console.log('[DB] init starting...');
    const timerName = `[DB] init timer ${Date.now()}`;
    console.time?.(timerName);

    try {
      // Wait for platform ready
      await this.platform.ready();

      // Initialize web store first if needed (non-native platforms)
      if (!this.platform.is('hybrid')) {
        console.log('[DB] Initializing web store...');
        try {
          await this.db.initWebStore();
          console.log('[WEBSTORE] Web store initialized');
        } catch (e) {
          console.error('[WEBSTORE] Web store init failed:', e);
          throw e;
        }
      }

      // Now open the database
      console.log('[DB] Opening database connection...');
      await this.db.open();
      console.log('[DB] Database connection opened');

      // Try to enable FKs early (non-fatal if it throws)
      try { await this.db.execute('PRAGMA foreign_keys = ON;'); }
      catch (e) { console.warn('[DB] warning: could not set FK PRAGMA early', e); }

      // Read user_version to decide schema/migrations
      let currentVersion = 0;
      try {
        const rows = await this.db.query<{ user_version: number }>('PRAGMA user_version;');
        if (rows?.length) {
          const val = (rows[0] as any).user_version ?? Object.values(rows[0])[0];
          currentVersion = Number(val) || 0;
        }
      } catch (e) {
        console.warn('[DB] warning: could not read user_version', e);
      }

      if (currentVersion === 0) {
        try {
          await this.db.execute(SCHEMA_SQL);
        } catch (batchErr) {
          console.warn('[DB] batch schema failed — per-statement fallback', batchErr);
          const stmts = this.splitSql(SCHEMA_SQL);
          for (const stmt of stmts) {
            // skip explicit transaction markers if present
            const up = stmt.trim().toUpperCase();
            if (!stmt || up === 'BEGIN' || up.startsWith('BEGIN ') || up === 'COMMIT' || up === 'END') continue;
            try {
              // use execute for DDL/DML; run() can also work but execute is safer for statements
              await this.db.execute(stmt);
            } catch (sErr) {
              console.warn('[DB] statement failed (continuing):', stmt, sErr);
            }
          }
        }
        try { await this.db.execute('PRAGMA user_version = 1;'); }
        catch (e) { console.warn('[DB] warning: could not set user_version', e); }
      } else {
        console.log(`[DB] schema user_version=${currentVersion} — skipping full schema`);
        // TODO: migrations when bumping to 2,3,...
      }

      // Seed local user row (idempotent)
      await this.db.run(
        `INSERT OR IGNORE INTO user (user_id, username) VALUES (?, ?)`,
        ['u_local', 'Local User']
      );

      // Persist schema + seed to web store and close wrapper so data is flushed
      try {
        await this.db.saveToStoreAndClose();
        console.log('[DB] persisted schema and seed to web store');
      } catch (e) {
        console.warn('[DB] failed to persist schema/seed:', e);
      }

      this.initialized = true;
      console.timeEnd?.(timerName);
      console.log('[DB] schema ready');
    } catch (err) {
      console.timeEnd?.(timerName);
      console.error('[DB] init failed:', err);
      throw err;
    }
  }

  private splitSql(sql: string): string[] {
    const noLineComments = sql
      .split('\n')
      .map(l => (l.trim().startsWith('--') ? '' : l))
      .join('\n');
    return noLineComments
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);
  }
}
