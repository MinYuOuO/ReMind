import { Injectable } from '@angular/core';
import { SqliteDbService } from '../services/db.service';

export interface CognitiveUnit {
  unit_id: string;
  contact_id: string;
  category: 'work_style' | 'values' | 'communication' | 'behavior';
  essence: string;
  confidence_score: number;
  last_confirmed?: string | null;
  status: 'active' | 'inactive' | 'superseded';
  created_at: string;
  updated_at: string;
}

const uid = () =>
  (crypto as any)?.randomUUID
    ? (crypto as any).randomUUID()
    : 'cu-' + Date.now();

@Injectable({ providedIn: 'root' })
export class CognitiveUnitRepo {
  constructor(private db: SqliteDbService) {}

  async createFromAi(params: {
    contact_id: string;
    category: CognitiveUnit['category'];
    essence: string;
    confidence_score?: number;
  }): Promise<string> {
    const id = uid();
    const now = new Date().toISOString();

    await this.db.run(
      `INSERT INTO cognitive_unit
       (unit_id, contact_id, category, essence, confidence_score, last_confirmed, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        params.contact_id,
        params.category,
        params.essence,
        params.confidence_score ?? 4,
        null,
        'active',
        now,
        now,
      ]
    );

    return id;
  }

  async listByContact(contact_id: string) {
    return this.db.query<CognitiveUnit>(
      `SELECT * FROM cognitive_unit
       WHERE contact_id = ? AND status = 'active'
       ORDER BY updated_at DESC`,
      [contact_id]
    );
  }
}