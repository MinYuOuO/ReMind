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
  private initWebPromise: Promise<void> | null = null;

  constructor(private platform: Platform) { }

  async initWebStore(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initWebPromise) {
      return this.initWebPromise;
    }

    if (this.webStoreInitialized) {
      return;
    }

    this.initWebPromise = (async () => {
      try {
        // Wait for jeep-sqlite element
        await customElements.whenDefined('jeep-sqlite');

        // Initialize the web store
        await this.sqlite.initWebStore();

        this.webStoreInitialized = true;
        console.log('[WEBSTORE] WebStore successfully initialized');
      } catch (err) {
        console.error('[WEBSTORE] WebStore init failed:', err);
        this.initWebPromise = null;
        throw err;
      }
    })();

    return this.initWebPromise;
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

      try {
        // try to open the connection first
        await conn.open();

        // only set this.db after open succeeds
        this.db = conn;

        // Enforce FKs, guard if execute is not available
        try {
          if (this.db && typeof this.db.execute === 'function') {
            await this.db.execute('PRAGMA foreign_keys = ON;');
          } else {
            console.warn('[DB] open: db.execute not available after open');
          }
        } catch (fkErr) {
          console.warn('[DB] could not set PRAGMA foreign_keys ON', fkErr);
        }

        return this.db as SQLiteDBConnection;
      } catch (openErr) {
        // ensure wrapper cleanup on failure
        try { await this.sqlite.closeConnection(DB_NAME, false); } catch { }
        this.db = undefined;
        throw openErr;
      } finally {
        // clear openingPromise in all cases so future open() attempts can retry
        this.openingPromise = null;
      }
    })();

    return this.openingPromise;
  }

  /** Execute a batch SQL string (DDL or multiple DML statements) */
  async execute(sql: string): Promise<void> {
    try {
      const db = await this.open();
      const res = await db.execute(sql);
      if ((res.changes?.changes ?? 0) < 0) {
        throw new Error('SQL execution failed');
      }
      await this.persistWeb();
      return;
    } catch (err: any) {
      const errMsg = String(err?.message ?? err).toLowerCase();

      // If error indicates nested-transaction, do NOT try to start another transaction.
      // Execute statements individually using run() (no outer transaction).
      if (errMsg.includes('cannot start a transaction') || errMsg.includes('transaction within')) {
        console.warn('[DB] nested transaction detected — executing statements individually (no reopen)', errMsg);
        const db = await this.open();
        const stmts = this.splitSql(sql);
        for (const raw of stmts) {
          let stmt = raw.trim();
          if (stmt.endsWith(';')) stmt = stmt.slice(0, -1).trim();
          if (!stmt) continue;
          try {
            await db.run(stmt, []);
          } catch (sErr) {
            // last-resort: try execute per statement (catch its errors and continue)
            try {
              await db.execute(stmt);
            } catch (innerErr) {
              console.warn('[DB] statement execution failed (continuing):', innerErr);
            }
          }
        }
        try { await this.persistWeb(); } catch (pErr) { console.warn('[DB] persistWeb after execute retry failed:', pErr); }
        return;
      }

      // For other transient errors, try the previous recovery path (reopen + per-statement)
      if (this.isTransientError(err)) {
        console.warn('[DB] transient execute error, handling recovery', err?.message ?? String(err));
        await this.reopenForRecovery();

        const db = await this.open();
        const stmts = this.splitSql(sql);
        for (const raw of stmts) {
          let stmt = raw.trim();
          if (stmt.endsWith(';')) stmt = stmt.slice(0, -1).trim();
          if (!stmt) continue;
          try {
            await db.run(stmt, []);
          } catch (sErr) {
            try {
              await db.execute(stmt);
            } catch (innerErr) {
              console.warn('[DB] statement execution failed (continuing):', innerErr);
            }
          }
        }

        try { await this.persistWeb(); } catch (pErr) { console.warn('[DB] persistWeb after execute retry failed:', pErr); }
        return;
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

      // Persist for web platform after successful write
      try {
        await this.persistWeb();
      } catch (pErr) {
        console.warn('[DB] persistWeb after run failed (will not block):', pErr);
      }
      return;
    } catch (err: any) {
      if (this.isTransientError(err)) {
        console.warn('[DB] transient run error, retrying after reopen', (err && err.message) ? err.message : String(err));
        await this.reopenForRecovery();
        const db = await this.open();
        await db.run(sql, params);
        try {
          await this.persistWeb();
        } catch (pErr) {
          console.warn('[DB] persistWeb after retry failed (will not block):', pErr);
        }
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
    if (Capacitor.isNativePlatform()) return;

    // ensure wrapper connection exists
    try { await this.open(); } catch (openErr) { console.warn('[DB] persistWeb: open() failed', openErr); }

    // ensure plugin has an opened connection too (may be missing due to races)
    try {
      let pluginHasOpenConn = false;
      try {
        // isConnection returns { result: boolean } on many plugin versions
        const isConnRes = await (CapacitorSQLite as any).isConnection?.({ database: DB_NAME, readonly: false }) ?? { result: false };
        pluginHasOpenConn = !!isConnRes.result;
      } catch (e) {
        pluginHasOpenConn = false;
      }

      if (!pluginHasOpenConn) {
        try {
          await CapacitorSQLite.createConnection({
            database: DB_NAME,
            readonly: false,
            encrypted: false,
            mode: 'no-encryption',
            version: DB_VERSION
          });

          // open plugin connection (some plugin versions expose open as 'open' taking an object)
          await (CapacitorSQLite as any).open({ database: DB_NAME, readonly: false });

          // short delay so adapter finishes setup
          await new Promise(r => setTimeout(r, 80));
          console.log('[DB] persistWeb: plugin connection created and opened');
        } catch (createErr) {
          console.warn('[DB] persistWeb: plugin create/open failed', createErr);
        }
      }

      // try plugin-level saveToStore first
      try {
        await (CapacitorSQLite as any).saveToStore?.({ database: DB_NAME });
        console.log('[DB] persistWeb: saved to store (plugin) ', DB_NAME);
        return;
      } catch (pluginSaveErr) {
        console.warn('[DB] persistWeb: plugin saveToStore failed', pluginSaveErr);
        // fall through to wrapper attempt
      }

      // fallback: attempt wrapper saveToStore if available
      try {
        // wrapper exposes saveToStore in some versions — call via any to avoid TS errors
        await (this.sqlite as any).saveToStore?.(DB_NAME);
        console.log('[DB] persistWeb: saved to store (wrapper) ', DB_NAME);
        return;
      } catch (wrapperSaveErr) {
        console.error('[DB] persistWeb: wrapper saveToStore failed', wrapperSaveErr);
        throw wrapperSaveErr;
      }
    } catch (err) {
      console.error('[DB] persistWeb: final failure', err);
      throw err;
    }
  }

  async saveToStoreAndClose(): Promise<void> {
    if (Capacitor.isNativePlatform()) return;

    // ensure wrapper connection exists/open
    try { await this.open(); } catch (e) { console.warn('[DB] saveToStoreAndClose: open failed', e); }

    // try plugin-level save first, then wrapper fallback
    try {
      if (typeof (CapacitorSQLite as any).saveToStore === 'function') {
        await (CapacitorSQLite as any).saveToStore({ database: DB_NAME });
      } else if (typeof (this.sqlite as any).saveToStore === 'function') {
        await (this.sqlite as any).saveToStore(DB_NAME);
      } else {
        throw new Error('saveToStore unavailable on plugin and wrapper');
      }
      console.log('[DB] saveToStoreAndClose: saved to store', DB_NAME);
    } catch (saveErr) {
      console.warn('[DB] saveToStoreAndClose: saveToStore failed', saveErr);
      throw saveErr;
    } finally {
      // close wrapper connection to ensure adapter finalizes data
      try {
        await this.sqlite.closeConnection(DB_NAME, false);
        this.db = undefined;
        // small delay so IndexedDB write finishes
        await new Promise(r => setTimeout(r, 120));
        console.log('[DB] saveToStoreAndClose: closed wrapper connection');
      } catch (closeErr) {
        console.warn('[DB] saveToStoreAndClose: closeConnection failed', closeErr);
      }
    }
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

  async export(): Promise<string> {
    try {
      await this.open();
      
      // Get all tables
      const tables = await this.query<{name: string}>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);

      // Build full database export
      const exportData: any = {};
      for (const table of tables) {
        const rows = await this.query(`SELECT * FROM ${table.name}`);
        exportData[table.name] = rows;
      }

      return JSON.stringify(exportData);
    } catch (error) {
      console.error('Database export failed:', error);
      throw error;
    }
  }
}