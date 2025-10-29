import { Injectable } from '@angular/core';
import { SqliteDbService } from '../services/db.service';

/** In-app User entity mirroring the `user` table schema. */
export interface User {
  /** Primary key; stable ID you control (e.g., 'u_local') */
  user_id: string;
  /** Display name for the app owner */
  username: string;
  /** Optional phone/email string (stored as TEXT) */
  contact_detail?: string | null;
  /** Date-only string in 'YYYY-MM-DD' format (app convention) */
  birthday?: string | null;
  /** Free-form notes about the user */
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserRepo {
  constructor(private db: SqliteDbService) {}

  // ---------- Reads ----------

  /**
   * Fetch a single user by its ID.
   *
   * @param user_id - The primary key of the user row.
   * @returns The matching User row or `null` if not found.
   *
   * Implementation:
   *  - Uses SELECT with `?` placeholders to prevent SQL injection.
   *  - Returns first row only; primary key guarantees at most one.
   */
  async getById(user_id: string): Promise<User | null> {
    const rows = await this.db.query<User>(
      `SELECT user_id, username, contact_detail, birthday, notes
       FROM user WHERE user_id = ?`,
      [user_id]
    );
    return rows[0] ?? null;
  }

  /**
   * Convenience method to fetch the local device user.
   *
   * @param localId - Defaults to 'u_local'. Change only if your app identity differs.
   * @returns User or `null` if the local user row is missing.
   *
   */
  async getLocal(localId = 'u_local'): Promise<User | null> {
    return this.getById(localId);
  }

  // ---------- Writes ----------

  /**
   * Create a user row. Fails if `user_id` already exists.
   *
   * @param user - Full user object to insert.
   *
   * Notes:
   *  - Use `upsert()` if you want idempotent behavior (insert-or-ignore-then-update).
   *  - `birthday`, `contact_detail`, and `notes` accept `null` to clear values.
   */
  async create(user: User): Promise<void> {
    await this.db.run(
      `INSERT INTO user (user_id, username, contact_detail, birthday, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        user.user_id,
        user.username,
        user.contact_detail ?? null,
        user.birthday ?? null,
        user.notes ?? null,
      ]
    );
  }

  /**
   * Insert-or-update utility:
   *  1) INSERT OR IGNORE (idempotent seed)
   *  2) Patch-update only the fields present in `user` (no overwrite of others)
   *
   * @param user - Must include `user_id`. Other fields are optional and only
   *               applied if provided (even empty strings if explicitly set).
   *
   * Example:
   *  await upsert({ user_id: 'u_local', username: 'Local User' });
   *  await upsert({ user_id: 'u_local', notes: 'Prefers mornings' }); // patches notes only
   */
  async upsert(
    user: Partial<User> & { user_id: string; username?: string }
  ): Promise<void> {
    // 1) insert if missing
    await this.db.run(
      `INSERT OR IGNORE INTO user (user_id, username, contact_detail, birthday, notes)
       VALUES (?, COALESCE(?, 'Local User'), ?, ?, ?)`,
      [
        user.user_id,
        user.username ?? null,
        user.contact_detail ?? null,
        user.birthday ?? null,
        user.notes ?? null,
      ]
    );

    // 2) Patch-update only fields that were actually provided.
    const fields: Record<string, any> = {};
    if (user.username !== undefined) fields['username'] = user.username;
    if (user.contact_detail !== undefined)
      fields['contact_detail'] = user.contact_detail;
    if (user.birthday !== undefined) fields['birthday'] = user.birthday;
    if (user.notes !== undefined) fields['notes'] = user.notes;
    if (Object.keys(fields).length) {
      await this.update(user.user_id, fields);
    }
  }

  /**
   * Patch-style update. Only updates columns present in `fields`.
   *
   * @param user_id - Row to update (PRIMARY KEY).
   * @param fields  - Any subset of { username, contact_detail, birthday, notes }.
   *
   * Behavior:
   *  - Ignores `undefined` fields.
   *  - Accepts `null` to clear a column value.
   *  - No-op if nothing to update.
   *
   * Implementation detail:
   *  - Builds a dynamic `SET` clause while preserving parameter order.
   */
  async update(
    user_id: string,
    fields: Partial<Omit<User, 'user_id'>>
  ): Promise<void> {
    const setParts: string[] = [];
    const params: any[] = [];

    if (fields.username !== undefined) {
      setParts.push('username = ?');
      params.push(fields.username);
    }
    if (fields.contact_detail !== undefined) {
      setParts.push('contact_detail = ?');
      params.push(fields.contact_detail);
    }
    if (fields.birthday !== undefined) {
      setParts.push('birthday = ?');
      params.push(fields.birthday);
    }
    if (fields.notes !== undefined) {
      setParts.push('notes = ?');
      params.push(fields.notes);
    }

    if (!setParts.length) return; // nothing to update

    const sql = `UPDATE user SET ${setParts.join(', ')} WHERE user_id = ?`;
    params.push(user_id);
    await this.db.run(sql, params);
  }

  /**
   * Delete a user row by ID.
   *
   * @param user_id - The user to remove.
   *
   * Warning:
   *  - If your schema uses `ON DELETE CASCADE` from dependent tables
   *    (e.g., contact.user_id → user.user_id), this will also remove linked rows.
   *  - Prefer not to delete 'u_local' in normal app behavior;
   *    but this is useful for tests/reset.
   */
  async delete(user_id: string): Promise<void> {
    await this.db.run(`DELETE FROM user WHERE user_id = ?`, [user_id]);
  }

  // ---------- Helpers ----------

  /**
   * Ensure the local device user exists, creating it if needed, and return it.
   *
   * @param localId  - Defaults to 'u_local' (recommended).
   * @param username - Default username if row is created fresh.
   *
   * @returns The ensured User row (never null).
   *
   * Notes:
   *  - This is ideal to call once during app startup or first page that needs identity.
   *  - Avoids "missing FK" problems later in repos that reference user_id.
   */
  async ensureLocal(
    localId = 'u_local',
    username = 'Local User'
  ): Promise<User> {
    await this.upsert({ user_id: localId, username });
    const u = await this.getById(localId);
    if (!u) throw new Error('Failed to ensure local user');
    return u;
  }

  /**
   * Convenience setter for username.
   * Equivalent to: update(user_id, { username })
   */
  async setUsername(user_id: string, username: string) {
    await this.update(user_id, { username });
  }

  /**
   * Convenience setter for contact_detail.
   * Pass `null` to clear value.
   */
  async setContactDetail(user_id: string, contact_detail: string | null) {
    await this.update(user_id, { contact_detail });
  }

  /**
   * Convenience setter for birthday.
   * @param ymd - 'YYYY-MM-DD' or `null` to clear.
   */
  async setBirthday(user_id: string, ymd: string | null) {
    await this.update(user_id, { birthday: ymd });
  }

  /**
   * Convenience setter for notes.
   * Pass `null` to clear value.
   */
  async setNotes(user_id: string, notes: string | null) {
    await this.update(user_id, { notes });
  }
}
