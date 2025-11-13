import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Platform } from '@ionic/angular';

import { SqliteDbService } from './db.service';
import { DbInitService } from './db-inti.service';

// Key to store local user id
const PREF_KEY = 'remind.user_id';
// Your DB init already seeds this:
const DEFAULT_USER_ID = 'u_local';

// fallback id generator (if you really want separate device profiles later)
const genId = () =>
  (crypto as any)?.randomUUID
    ? (crypto as any).randomUUID()
    : 'u-' + Math.random().toString(36).slice(2);

@Injectable({ providedIn: 'root' })
export class UserIdentityService {
  private _userId: string | null = null;
  private _readyPromise: Promise<void> | null = null;

  constructor(
    private db: SqliteDbService,
    private dbInit: DbInitService,
    private platform: Platform
  ) {}

  /**
   * Ensure platform + DB ready + user row exists.
   * Call this once in pages before using `ensureUserId()`.
   */
  async ready(): Promise<void> {
    if (this._readyPromise) {
      return this._readyPromise;
    }

    this._readyPromise = (async () => {
      // 1) Ionic platform ready
      await this.platform.ready();

      // 2) DB/schema ready (your big SCHEMA_SQL is executed here)
      await this.dbInit.init();

      // 3) Load from preferences (device-level)
      const pref = await Preferences.get({ key: PREF_KEY });
      let userId = pref.value;

      if (!userId) {
        // first run on this device
        // use the same id that db_init.service inserted
        userId = DEFAULT_USER_ID;
        await Preferences.set({ key: PREF_KEY, value: userId });
      }

      // 4) make sure row exists in SQLite
      await this.ensureUserRow(userId);

      // 4b) If this user has no contacts but the DB contains contacts for another user,
      // adopt that user id so Home will show the imported contacts.
      try {
        await this.db.open();
        // count contacts for current user
        const cntRows = await this.db.query<{ cnt: number }>(
          'SELECT COUNT(1) as cnt FROM contact WHERE user_id = ?',
          [userId]
        );
        const cnt = (cntRows && cntRows[0] && typeof cntRows[0].cnt === 'number') ? cntRows[0].cnt : 0;
        if (cnt === 0) {
          // find any user_id that actually has contacts
          const other = await this.db.query<{ user_id: string }>(
            `SELECT DISTINCT user_id FROM contact WHERE user_id IS NOT NULL LIMIT 1`
          );
          if (other && other.length > 0 && other[0].user_id) {
            const candidate = other[0].user_id;
            console.log(`[UserIdentity] switching current user to '${candidate}' because '${userId}' has no contacts`);
            userId = candidate;
            await this.ensureUserRow(userId);
            await Preferences.set({ key: PREF_KEY, value: userId });
          }
        }
      } catch (e) {
        console.warn('[UserIdentity] contact-based user auto-switch check failed', e);
        // ignore and proceed with existing userId
      }

      // 5) cache in memory
      this._userId = userId;
    })();

    return this._readyPromise;
  }

  /**
   * Get the current user id (after ready()).
   */
  get userId(): string {
    return this._userId ?? DEFAULT_USER_ID;
  }

  /**
   * Public helper used across your pages.
   * Ensures there is always a user id and returns it.
   */
  async ensureUserId(): Promise<string> {
    await this.ready();
    return this.userId;
  }

  /**
   * (Optional) Switch to another user profile on this device.
   * We ensure the row exists first, then store to Preferences.
   */
  async switchUser(newUserId: string): Promise<void> {
    if (!newUserId) return;
    await this.ensureUserRow(newUserId);
    await Preferences.set({ key: PREF_KEY, value: newUserId });
    this._userId = newUserId;
  }

  /**
   * Internal: ensure the given user_id exists in the `user` table.
   * If not, we create a minimal row.
   */
  private async ensureUserRow(userId: string): Promise<void> {
    await this.db.open();

    const rows = await this.db.query<{ user_id: string }>(
      'SELECT user_id FROM user WHERE user_id = ?',
      [userId]
    );

    if (!rows.length) {
      // user not found in DB — create minimal row
      await this.db.run(
        `INSERT INTO user (user_id, username)
         VALUES (?, ?)`,
        [userId, 'Local User']
      );

      // best-effort flush for web
      try {
        await this.db.saveToStoreAndClose();
      } catch (e) {
        console.warn('[UserIdentityService] saveToStore failed after create', e);
      }
    }
  }

  /**
   * (Optional) create a brand new userId (for multi-profile use case).
   */
  async createNewLocalUser(username = 'Local User'): Promise<string> {
    const newId = genId();

    await this.db.open();
    await this.db.run(
      `INSERT INTO user (user_id, username)
       VALUES (?, ?)`,
      [newId, username]
    );

    // store in preferences and cache
    await Preferences.set({ key: PREF_KEY, value: newId });
    this._userId = newId;

    return newId;
  }
}