export interface Friend {
  id?: string;
  name: string;
  birthday?: string | null; // 'YYYY-MM-DD'
  tags?: string[];
  preferences?: { gifts?: string[]; likes?: string[]; dislikes?: string[] };
  note_summary?: string;
  created_at?: any; // Timestamp
  updated_at?: any; // Timestamp
}
