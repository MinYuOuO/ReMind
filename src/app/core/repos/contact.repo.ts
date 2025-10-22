import { Injectable } from '@angular/core';
import { SqliteDbService } from '../services/db.service';

export type Relationship = 'friend'|'best_friend'|'colleague'|'family';

export interface Contact {
  contact_id: string;
  user_id: string;
  name: string;
  relationship: Relationship;
  contact_detail?: string | null;
  birthday?: string | null;            // 'YYYY-MM-DD'
  created_at: string;                  // ISO
  updated_at: string;                  // ISO
  notes?: string | null;
}

const now = () => new Date().toISOString();
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

@Injectable({ providedIn: 'root' })
export class ContactRepo {
  constructor(private db: SqliteDbService) {}

  listByUser(userId: string): Promise<Contact[]> {
    return this.db.query<Contact>(
      `SELECT * FROM contact WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC`,
      [userId]
    );
  }

  async createMinimal(userId: string, name: string, relationship: Relationship = 'friend'): Promise<Contact> {
    const rec: Contact = {
      contact_id: uid(),
      user_id: userId,
      name,
      relationship,
      contact_detail: null,
      birthday: null,
      created_at: now(),
      updated_at: now(),
      notes: null,
    };
    await this.db.run(
      `INSERT INTO contact (contact_id,user_id,name,relationship,contact_detail,birthday,created_at,updated_at,notes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        rec.contact_id, rec.user_id, rec.name, rec.relationship,
        rec.contact_detail, rec.birthday, rec.created_at, rec.updated_at, rec.notes
      ]
    );
    return rec;
  }
}
