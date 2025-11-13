// src/app/core/repos/interaction.repo.ts
import { Injectable } from '@angular/core';
import { SqliteDbService } from '../services/db.service';

export interface Interaction {
  interaction_id: string;
  contact_id: string;
  user_id: string;
  interaction_date: string;
  context?: string | null;
  user_summary?: string | null;
  raw_notes?: string | null;
  created_at: string;
}

const uid = () =>
  (crypto as any)?.randomUUID
    ? (crypto as any).randomUUID()
    : 'i-' + Date.now();

@Injectable({ providedIn: 'root' })
export class InteractionRepo {
  constructor(private db: SqliteDbService) {}

  async createBasic(params: {
    contact_id: string;
    user_id: string;
    interaction_date?: string;
    context?: string | null;
    user_summary?: string | null;
    raw_notes?: string | null;
  }): Promise<string> {
    const id = uid();
    const now = new Date().toISOString();
    const date = params.interaction_date || now;

    await this.db.run(
      `INSERT INTO interaction (
        interaction_id, contact_id, user_id, interaction_date,
        context, user_summary, raw_notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        params.contact_id,
        params.user_id,
        date,
        params.context ?? null,
        params.user_summary ?? null,
        params.raw_notes ?? null,
        now,
      ]
    );

    return id;
  }

  async listByContact(contact_id: string) {
    return this.db.query<Interaction>(
      `SELECT * FROM interaction WHERE contact_id = ? ORDER BY interaction_date DESC`,
      [contact_id]
    );
  }

  async getById(interaction_id: string) {
    const rows = await this.db.query<any>(
      `SELECT * FROM interaction WHERE interaction_id = ? LIMIT 1`,
      [interaction_id]
    );
    return rows[0] || null;
  }
}
