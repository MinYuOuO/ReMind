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
    await this.ready(); // Ensure DB is initialized

    const existing = await Preferences.get({ key: KEY_USER_ID });
    if (existing.value) {
      // Verify user exists in DB
      const users = await this.db.query(
        'SELECT user_id FROM user WHERE user_id = ?',
        [existing.value]
      );
      
      if (users.length) {
        return existing.value;
      }
      // User not in DB, fall through to create new
    }

    const newId = uid();
    
    // Create user record first
    await this.db.run(
      `INSERT INTO user (user_id, username) VALUES (?, ?)`,
      [newId, 'Local User']
    );

    // Only save ID after successful DB insert
    await Preferences.set({ key: KEY_USER_ID, value: newId });
    return newId;
  }

  async ready() {
    await this.dbInit.init();
  }
}
