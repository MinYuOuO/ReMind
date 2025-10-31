import { Injectable } from '@angular/core';
import { SqliteDbService } from '../services/db.service';

export interface AiProcessingLog {
  log_id: string;
  interaction_id: string;
  processed_at: string;
  ai_model?: string | null;
  input_text?: string | null;
  output_json?: string | null;
  user_confirmed: number;
  confirmed_at?: string | null;
  status: 'success' | 'error' | 'pending';
  cognitive_unit_id?: string | null;
}

const uid = () =>
  (crypto as any)?.randomUUID
    ? (crypto as any).randomUUID()
    : 'log-' + Date.now();

@Injectable({ providedIn: 'root' })
export class AiProcessingLogRepo {
  constructor(private db: SqliteDbService) {}

  async createPending(interaction_id: string, input_text: string): Promise<string> {
    const id = uid();
    const now = new Date().toISOString();

    await this.db.run(
      `INSERT INTO ai_processing_log
        (log_id, interaction_id, processed_at, ai_model, input_text, output_json, user_confirmed, status)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        id,
        interaction_id,
        now,
        null,
        input_text,
        null,
        0,
        'pending',
      ]
    );

    return id;
  }

  async markSuccess(
    log_id: string,
    ai_model: string,
    output_json: string,
    cognitive_unit_id?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE ai_processing_log
       SET status = 'success',
           ai_model = ?,
           output_json = ?,
           cognitive_unit_id = ?,
           processed_at = ?
       WHERE log_id = ?`,
      [ai_model, output_json, cognitive_unit_id ?? null, now, log_id]
    );
  }

  async markError(log_id: string, output_json: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE ai_processing_log
       SET status = 'error',
           output_json = ?,
           processed_at = ?
       WHERE log_id = ?`,
      [output_json, now, log_id]
    );
  }
}