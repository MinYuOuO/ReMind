import { Injectable } from '@angular/core';
import { SqliteDbService } from './db.service';
import { Platform } from '@ionic/angular';

const SCHEMA_SQL = `

-- USER
CREATE TABLE IF NOT EXISTS user (
  user_id        TEXT PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,  -- Added UNIQUE constraint
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
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+0800')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+0800')),
  notes          TEXT,
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
  -- Removed UNIQUE constraint to allow same names for different user_ids
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

-- COGNITIVE_SUMMARY
CREATE TABLE IF NOT EXISTS cognitive_summary (
  summary_id   TEXT PRIMARY KEY,
  contact_id   TEXT NOT NULL UNIQUE,  -- 每个联系人只有一个总结
  ai_summary   TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_csummary_contact ON cognitive_summary(contact_id);

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
  summary_id        TEXT,
  processed_at      TEXT NOT NULL,
  ai_model          TEXT,
  input_text        TEXT,
  output_json       TEXT,
  user_confirmed    INTEGER NOT NULL DEFAULT 0 CHECK (user_confirmed IN (0,1)),
  confirmed_at      TEXT,
  status            TEXT NOT NULL CHECK (status IN ('success','error','pending')),
  FOREIGN KEY (interaction_id) REFERENCES interaction(interaction_id) ON DELETE CASCADE,
  FOREIGN KEY (summary_id)     REFERENCES cognitive_summary(summary_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_log_interaction ON ai_processing_log(interaction_id);
CREATE INDEX IF NOT EXISTS idx_log_summary ON ai_processing_log(summary_id);
CREATE INDEX IF NOT EXISTS idx_log_status ON ai_processing_log(status);

`;

@Injectable({ providedIn: 'root' })
export class DbInitService {
  private initialized = false;

  constructor(private db: SqliteDbService, private platform: Platform) {}

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
      try {
        await this.db.execute('PRAGMA foreign_keys = ON;');
      } catch (e) {
        console.warn('[DB] warning: could not set FK PRAGMA early', e);
      }

      // Read user_version to decide schema/migrations
      let currentVersion = 0;
      try {
        const rows = await this.db.query<{ user_version: number }>(
          'PRAGMA user_version;'
        );
        if (rows?.length) {
          const val =
            (rows[0] as any).user_version ?? Object.values(rows[0])[0];
          currentVersion = Number(val) || 0;
        }
      } catch (e) {
        console.warn('[DB] warning: could not read user_version', e);
      }

      if (currentVersion === 0) {
        try {
          await this.db.execute(SCHEMA_SQL);

          // Clean up data and fix relationships
          await this.db.execute(`
            BEGIN TRANSACTION;
            
            -- Remove contacts with invalid user_ids (not in user table)
            DELETE FROM contact 
            WHERE user_id NOT IN (SELECT user_id FROM user);

            -- Remove any remaining 'u_local' references
            DELETE FROM contact WHERE user_id = 'u_local';
            DELETE FROM user WHERE user_id = 'u_local';

            -- Fix timestamps for remaining valid contacts
            UPDATE contact 
            SET created_at = datetime(created_at, '+0800'),
                updated_at = datetime(updated_at, '+0800')
            WHERE created_at NOT LIKE '%+08%';

            -- Log cleanup actions
            INSERT INTO ai_processing_log (
              log_id,
              interaction_id,
              processed_at,
              input_text,
              status
            ) VALUES (
              'cleanup_' || strftime('%Y%m%d%H%M%S', 'now'),
              'system',
              datetime('now'),
              'Cleaned up invalid contacts and user references',
              'success'
            );

            COMMIT;
          `);
        } catch (err) {
          console.error('[DB] schema/migration failed:', err);
          throw err;
        }
      } else {
        console.log(
          `[DB] schema user_version=${currentVersion} — skipping full schema`
        );
        // TODO: migrations when bumping to 2,3,...
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
      .map((l) => (l.trim().startsWith('--') ? '' : l))
      .join('\n');
    return noLineComments
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
