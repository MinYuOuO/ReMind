import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { SqliteDbService } from './db.service';
import { DbInitService } from './db-inti.service';

const KEY_USER_ID = 'remind.user_id';
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

@Injectable({ providedIn: 'root' })
export class UserIdentityService {
  constructor(private db: SqliteDbService, private dbInit: DbInitService) {}

  /** Get or create a local user_id and ensure a row exists in user table. */
  async ensureUserId(): Promise<string> {
    // Ensure DB schema/initialization completed before writing to the DB
    try {
      await this.dbInit.init();
    } catch (e) {
      console.warn('[UserIdentity] warning: db init failed or not ready', e);
      // continue: the subsequent db call will either succeed after recovery retries or throw
    }

    const existing = await Preferences.get({ key: KEY_USER_ID });
    if (existing.value) return existing.value;

    const newId = uid();
    // create empty profile (username/contact_detail/birthday/notes empty)
    await this.db.run(
      `INSERT OR IGNORE INTO user (user_id, username, contact_detail, birthday, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [newId, '', '', null, '']
    );

    await Preferences.set({ key: KEY_USER_ID, value: newId });
    return newId;
  }
}
