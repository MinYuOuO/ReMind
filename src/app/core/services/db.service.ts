import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection
} from '@capacitor-community/sqlite';
import { Platform } from '@ionic/angular';

const DB_NAME = 'remind.db';
const DB_VERSION = 2;

@Injectable({ providedIn: 'root' })
export class SqliteDbService {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | undefined;
  private webStoreInitialized = false;

  constructor(private platform: Platform) { }

  async initWebStore(): Promise<void> {
    if (this.webStoreInitialized) {
      console.log('[DB] Web store already initialized');
      return;
    }

    // Check if we're on web/desktop (not hybrid/mobile)
    if (!this.platform.is('hybrid') && !this.platform.is('mobile')) {
      try {
        await this.sqlite.initWebStore();
        this.webStoreInitialized = true;
        console.log('[DB] WebStore initialized');
      } catch (err) {
        console.error('[DB] WebStore init failed:', err);
        throw err;
      }
    }
  }

  // Promise used to serialize concurrent open() calls
  private openingPromise: Promise<SQLiteDBConnection> | null = null;

  /** Web: ensure jeep-sqlite is ready & IndexedDB store initialized */
  private async initWebIfNeeded(): Promise<void> {
    if (Capacitor.isNativePlatform()) return;

    // If running in a browser, initialize the jeep-sqlite web store (WASM backed)
    if (this.webStoreInitialized) return;

    try {
      console.log('[DB] web init: waiting for jeep-sqlite element...');
      // wait for the custom element to be defined and present in DOM
      await customElements.whenDefined('jeep-sqlite');
      console.log('[DB] web init: jeep-sqlite defined — initializing web store...');
      await CapacitorSQLite.initWebStore();
      this.webStoreInitialized = true;
      console.log('[DB] web init: initWebStore completed');
    } catch (err) {
      console.error('[DB] web init failed:', err);
      // rethrow so callers know the DB can't open on web if init fails
      throw err;
    }
  }

  /** Open (or reuse) a connection and enable foreign keys */
  async open(): Promise<SQLiteDBConnection> {
    // Ensure web store is ready if running in browser
    await this.initWebIfNeeded();

    if (this.db) return this.db;

    // If an open is already in progress, await it instead of creating another
    if (this.openingPromise) {
      return this.openingPromise;
    }

    this.openingPromise = (async () => {
      // createConnection returns the SQLiteDBConnection object
      const conn = await this.sqlite.createConnection(
        DB_NAME,
        false,            // encrypted?
        'no-encryption',  // encryption mode
        DB_VERSION,
        false             // readonly
      );

      // Keep a reference to the connection, then open it (open returns void)
      this.db = conn;
      await conn.open();

      // Enforce FKs
      try {
        await this.db.execute('PRAGMA foreign_keys = ON;');
      } catch (fkErr) {
        console.warn('[DB] could not set PRAGMA foreign_keys ON', fkErr);
      }

      // clear openingPromise now that open succeeded
      const result = this.db;
      this.openingPromise = null;
      return result as SQLiteDBConnection;
    })();

    return this.openingPromise;
  }

  /** Execute a batch SQL string (DDL or multiple DML statements) */
  async execute(sql: string): Promise<void> {
    // Try once, retry on transient errors (web adapter races)
    try {
      const db = await this.open();
      const res = await db.execute(sql);
      if ((res.changes?.changes ?? 0) < 0) {
        throw new Error('SQL execution failed');
      }
      return;
    } catch (err: any) {
      if (this.isTransientError(err)) {
        console.warn('[DB] transient execute error, retrying after reopen', err?.message ?? err);
        // reset state and retry once
        await this.reopenForRecovery();
        const db = await this.open();
        try {
          const res = await db.execute(sql);
          if ((res.changes?.changes ?? 0) < 0) {
            throw new Error('SQL execution failed');
          }
          return;
        } catch (err2) {
          // if batch fails due to nested transaction, fallback to per-statement execution
          if ((err2 + '').toLowerCase().includes('cannot start a transaction') || (err2 + '').toLowerCase().includes('transaction within')) {
            console.warn('[DB] execute batch failed due to nested transaction — falling back to per-statement execution');
            for (const s of this.splitSql(sql)) {
              try { await (await this.open()).execute(s); } catch (sErr) { console.warn('[DB] statement error (continuing):', sErr); }
            }
            return;
          }
          throw err2;
        }
      }
      throw err;
    }
  }

  /** SELECT helper with bound params */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const db = await this.open();
      const res = await db.query(sql, params);
      return (res.values ?? []) as T[];
    } catch (err: any) {
      if (this.isTransientError(err)) {
        console.warn('[DB] transient query error, retrying after reopen', err?.message ?? err);
        await this.reopenForRecovery();
        const db = await this.open();
        const res = await db.query(sql, params);
        return (res.values ?? []) as T[];
      }
      throw err;
    }
  }

  /** INSERT/UPDATE/DELETE helper with bound params */
  async run(sql: string, params: any[] = []): Promise<void> {
    try {
      const db = await this.open();
      await db.run(sql, params);
    } catch (err: any) {
      if (this.isTransientError(err)) {
        console.warn('[DB] transient run error, retrying after reopen', err?.message ?? err);
        await this.reopenForRecovery();
        const db = await this.open();
        await db.run(sql, params);
        return;
      }
      throw err;
    }
  }

  /** Detect errors that are likely transient on the web adapter */
  private isTransientError(err: any): boolean {
    if (!err) return false;
    const msg = (err.message ?? err + '').toLowerCase();
    return msg.includes('database not opened') || msg.includes('not opened') || msg.includes('cannot start a transaction') || msg.includes('transaction within');
  }

  /** Attempt to recover by closing and clearing connection state so open() will recreate it */
  private async reopenForRecovery(): Promise<void> {
    try {
      if (this.db) {
        try { await this.sqlite.closeConnection(DB_NAME, false); } catch (e) { console.warn('[DB] closeConnection during recovery failed', e); }
      }
    } finally {
      this.db = undefined;
      this.openingPromise = null;
      // give the web adapter a short pause to settle
      await new Promise(r => setTimeout(r, 50));
      // ensure web store ready again
      try { await this.initWebIfNeeded(); } catch (e) { /* ignore, will propagate on next open */ }
    }
  }

  /** Persist DB to IndexedDB on Web (required by plugin) */
  private async persistWeb(): Promise<void> {
    // No-op for native-only mode. If web support is required, implement a
    // web persistence strategy (jeep-sqlite or sql.js) and call save there.
    return;
  }

  /**
   * Split a batch SQL string into individual statements while avoiding splits
   * inside quotes, backticks, or comments.
   */
  private splitSql(sql: string): string[] {
    const statements: string[] = [];
    let buf = '';
    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      const next = sql[i + 1];

      if (inLineComment) {
        buf += ch;
        if (ch === '\n') {
          inLineComment = false;
        }
        continue;
      }

      if (inBlockComment) {
        buf += ch;
        if (ch === '*' && next === '/') {
          buf += next;
          i++;
          inBlockComment = false;
        }
        continue;
      }

      // start of line comment --
      if (!inSingle && !inDouble && !inBacktick && ch === '-' && next === '-') {
        buf += ch;
        buf += next;
        i++;
        inLineComment = true;
        continue;
      }

      // start of block comment /*
      if (!inSingle && !inDouble && !inBacktick && ch === '/' && next === '*') {
        buf += ch;
        buf += next;
        i++;
        inBlockComment = true;
        continue;
      }

      // quote toggles
      if (!inDouble && !inBacktick && ch === "'") {
        inSingle = !inSingle;
        buf += ch;
        continue;
      }
      if (!inSingle && !inBacktick && ch === '"') {
        inDouble = !inDouble;
        buf += ch;
        continue;
      }
      if (!inSingle && !inDouble && ch === '`') {
        inBacktick = !inBacktick;
        buf += ch;
        continue;
      }

      // statement separator
      if (!inSingle && !inDouble && !inBacktick && ch === ';') {
        const stmt = buf.trim();
        if (stmt) {
          statements.push(stmt + ';');
        }
        buf = '';
        continue;
      }

      buf += ch;
    }

    const tail = buf.trim();
    if (tail) {
      statements.push(tail);
    }
    return statements;
  }

  /** Close connection (rarely needed) */
  async close(): Promise<void> {
    if (this.db) {
      await this.sqlite.closeConnection(DB_NAME, false); // readonly=false
      this.db = undefined;
    }
  }
}