import { Injectable, signal, WritableSignal } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'

const DB_USERS = 'USER';

export interface User {
  user_id: number;
  username: string;
  contact_detail: string;
  dob: Date;
  notes: string;
  active: number;
}
@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private db!: SQLiteDBConnection;
  private users: WritableSignal<User[]> = signal<User[]>([]);

  constructor() { }

  async initializPlugin() {
    this.db = await this.sqlite.createConnection(
      DB_USERS,
      false,
      'no-encryption',
      1,
      false
    );

    await this.db.open();

    const schema = `CREATE TABLE IF NOT EXISTS users ( 
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        contact_detail TEXT,
        dob DATE,
        notes TEXT,
        active INTEGER DEFAULT 1 
  );`

    await this.db.execute(schema);

    this.loadUsers();

    return true;
  }

  getUsers() {
    return this.users;
  }
  async loadUsers() {
    const users = await this.db.query('SELECT * FROM users;');
    this.users.set(users.values || []);
  }

  async addUser(username: string, contact_detail?: string, dob?: Date, notes?: string) {
    const insert = `INSERT INTO users (username, contact_detail, dob, notes) VALUES ('${username}', '${contact_detail}', '${dob?.toISOString()}', '${notes}');`;
    const result = await this.db.query(insert);

    this.loadUsers();

    return result;
  }

  async updateUser(user: User) {
    const update = `UPDATE users SET 
      username='${user.username}', 
      contact_detail='${user.contact_detail}', 
      dob='${user.dob.toISOString()}', 
      notes='${user.notes}' 
      WHERE user_id=${user.user_id};`;

    const result = await this.db.query(update);

    this.loadUsers();

    return result;
  }

  async deleteUser(user_id: number) {
    const del = `DELETE FROM users WHERE user_id=${user_id};`;
    const result = await this.db.query(del);

    this.loadUsers();

    return result;
  }
}
