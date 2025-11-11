import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  personOutline,
  shieldCheckmarkOutline,
  notificationsOutline,
  informationCircleOutline,
  helpCircleOutline,
  arrowBack,
  lockClosedOutline,
  sparklesOutline,
  settingsOutline, callOutline, calendarOutline, mailOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';

import { AiSettingService } from '../core/services/ai-setting.service';
import { ActivatedRoute } from '@angular/router';
import { DbInitService } from '../core/services/db-inti.service';
import { SqliteDbService } from '../core/services/db.service';
import { AuthService } from '../core/services/auth.service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { utils as XLSXUtils, write as XLSXWrite, read as XLSXRead } from 'xlsx';

addIcons({
  'person-outline': personOutline,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'notifications-outline': notificationsOutline,
  'information-circle-outline': informationCircleOutline,
  'help-circle-outline': helpCircleOutline,
  'arrow-back': arrowBack,
  'lock-closed-outline': lockClosedOutline,
  'sparkles-outline': sparklesOutline,
  'settings-outline': settingsOutline,
  'call-outline': callOutline,
  'calendar-outline': calendarOutline,
  'mail-outline': mailOutline,
  eyeOutline,
  eyeOffOutline,
});

// Add this small interface near the top of the file (after imports)
interface UserRow {
  user_id: string;
  username?: string;
  contact_detail?: string;
  birthday?: string | null;
  notes?: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss'],
  imports: [
    CommonModule,
    FormsModule, // <-- added so [(ngModel)] works
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SettingsPage implements OnInit {
  view:
    | 'main'
    | 'privacy'
    | 'ai'
    | 'data'
    | 'about'
    | 'faq'
    | 'card'
    | 'notification' = 'main';

  // AI form models
  aiProvider: 'openai' | 'deepseek' | 'none' = 'none';
  aiApiKey = '';
  aiModel = 'gpt-4o-mini';

  saving = false;

  // --- Personal card fields (new) ---
  personalUserId: string | null = null; // text id (matches app schema)
  personalUsername = '';
  personalContactDetails = '';
  personalBirthday: string | null = null;
  personalNotes = '';

  // Calendar state (reuse same logic as friend-list.page.ts)
  calendarOpen = false;
  calYear = new Date().getFullYear();
  calMonth = new Date().getMonth();
  calendarCells: (number | null)[] = [];
  monthNames = [
    'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
  ];
  weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Password and biometric settings
  hasPassword = false;
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  biometricEnabled = false;

  // Password visibility toggles
  showOldPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  readonly eyeOutline = eyeOutline;
  readonly eyeOffOutline = eyeOffOutline;

  private buildCalendar(year = this.calYear, month = this.calMonth) {
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length < 42) cells.push(null);
    this.calendarCells = cells;
    this.calYear = year;
    this.calMonth = month;
  }

  toggleCalendar(open?: boolean) {
    const next = typeof open === 'boolean' ? open : !this.calendarOpen;
    this.calendarOpen = next;
    if (next) {
      if (this.personalBirthday) {
        const d = new Date(this.personalBirthday);
        if (!isNaN(d.getTime())) {
          this.buildCalendar(d.getFullYear(), d.getMonth());
          return;
        }
      }
      const now = new Date();
      this.buildCalendar(now.getFullYear(), now.getMonth());
    }
  }

  prevMonth() {
    let m = this.calMonth - 1;
    let y = this.calYear;
    if (m < 0) { m = 11; y -= 1; }
    this.buildCalendar(y, m);
  }

  nextMonth() {
    let m = this.calMonth + 1;
    let y = this.calYear;
    if (m > 11) { m = 0; y += 1; }
    this.buildCalendar(y, m);
  }

  prevYear() { this.buildCalendar(this.calYear - 1, this.calMonth); }
  nextYear() { this.buildCalendar(this.calYear + 1, this.calMonth); }

  selectDay(day: number) {
    const y = this.calYear;
    const m = String(this.calMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    this.personalBirthday = `${y}-${m}-${d}`;
    this.calendarOpen = false;
  }

  isSelectedDay(day: number) {
    if (!this.personalBirthday) return false;
    const d = new Date(this.personalBirthday);
    return (
      d.getFullYear() === this.calYear &&
      d.getMonth() === this.calMonth &&
      d.getDate() === day
    );
  }

  constructor(
    private aiSettings: AiSettingService,
    private route: ActivatedRoute,
    private dbInit: DbInitService,         // added
    private db: SqliteDbService,            // added
    private auth: AuthService              // added
  ) {
      // constructor intentionally does not call addIcons again
  }

  async ngOnInit() {
    // load saved settings once
    const s = await this.aiSettings.load();
    this.aiProvider = s.provider;
    this.aiApiKey = s.apiKey;
    this.aiModel = s.model;

    // Check if we should open a specific view
    this.route.queryParams.subscribe(params => {
      if (params['view']) {
        this.view = params['view'];
      }
    });

    // Load password and biometric settings
    this.hasPassword = await this.auth.hasPassword();
    this.biometricEnabled = await this.auth.isBiometricEnabled();
  }

  goBack() {
    this.view = 'main';
  }

  async open(
    page:
      | 'privacy'
      | 'ai'
      | 'data'
      | 'about'
      | 'faq'
      | 'card'
      | 'notification',
  ) {
    this.view = page;

    // load personal card data when opening the card view
    if (page === 'card') {
      await this.loadPersonalCard();
      // Log the loaded personal card data for debugging
      console.log('[Settings] personal card opened:', {
        user_id: this.personalUserId,
        username: this.personalUsername,
        contact_detail: this.personalContactDetails,
        birthday: this.personalBirthday,
        notes: this.personalNotes,
      });
    }
  }

  async saveAi() {
    this.saving = true;
    await this.aiSettings.save({
      provider: this.aiProvider,
      apiKey: this.aiApiKey,
      model: this.aiModel,
    });
    this.saving = false;
    alert('AI settings saved');
  }

  // --- DB helpers for personal card (new) ---
  private async ensureUserTable() {
    // Ensure a 'user' table exists matching the app-wide schema (text primary key).
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS user (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        contact_detail TEXT,
        birthday TEXT,
        notes TEXT
      )
    `);
  }

  async loadPersonalCard() {
    try {
      await this.dbInit.init();
      await this.db.open();
      await this.ensureUserTable();

      // Debug: log DB version so we can correlate with observed messages
      try {
        const verRows = await this.db.query<{ user_version: number }>('PRAGMA user_version;');
        console.log('[Settings] PRAGMA user_version result:', JSON.stringify(verRows));
      } catch (e) {
        console.warn('[Settings] PRAGMA user_version failed', e);
      }

      // Deterministic read for the local profile
       // Read the single local profile deterministically by id so it won't
       // "disappear" if row ordering changes or extra rows exist.
       const rows = await this.db.query<UserRow>(
         `SELECT user_id, username, contact_detail, birthday, notes FROM user WHERE user_id = ? LIMIT 1`,
         ['u_local']
       );

      console.log('[Settings] query user WHERE user_id="u_local" →', rows?.length ? rows : 'no rows');

       if (rows && rows.length > 0) {
         const r = rows[0];
         this.personalUserId = r.user_id ?? null;
         this.personalUsername = r.username ?? '';
         this.personalContactDetails = r.contact_detail ?? '';
         this.personalBirthday = r.birthday ?? null;
         this.personalNotes = r.notes ?? '';
       } else {
        // no saved user for 'u_local' – list all users for debugging
        try {
          const all = await this.db.query<any>(`SELECT user_id, username, contact_detail FROM user`);
          console.log('[Settings] fallback: all user rows →', all?.length ? all : 'no rows');
        } catch (e) {
          console.warn('[Settings] fallback all users query failed', e);
        }
        // no saved user
         this.personalUserId = null;
         this.personalUsername = '';
         this.personalContactDetails = '';
         this.personalBirthday = null;
         this.personalNotes = '';
       }
     } catch (err) {
       console.error('[Settings] loadPersonalCard failed', err);
     }
   }

  async savePersonalCard() {
    try {
      if (!this.personalUsername && !this.personalContactDetails && !this.personalBirthday && !this.personalNotes) {
        alert('Please fill at least one field before saving.');
        return;
      }

      await this.dbInit.init();
      await this.db.open();
      await this.ensureUserTable();

      if (this.personalUserId) {
        // update existing
        await this.db.run(
          `UPDATE user SET username = ?, contact_detail = ?, birthday = ?, notes = ? WHERE user_id = ?`,
          [
            this.personalUsername,
            this.personalContactDetails,
            this.personalBirthday,
            this.personalNotes,
            this.personalUserId,
          ]
        );
      } else {
        // insert new row - must supply a text user_id to match app schema.
        const uid = 'u_local'; // keep single local profile id; change if you want multiple users
        await this.db.run(
          `INSERT OR REPLACE INTO user (user_id, username, contact_detail, birthday, notes) VALUES (?,?,?,?,?)`,
          [
            uid,
            this.personalUsername,
            this.personalContactDetails,
            this.personalBirthday,
            this.personalNotes,
          ]
        );
        this.personalUserId = uid;
      }

      // Persist web store if needed
      try {
        await this.db.saveToStoreAndClose();
      } catch (e) {
        console.warn('[Settings] saveToStoreAndClose failed', e);
      }

      // on success, return to main settings view (no popup)
      console.log('[Settings] Personal card saved:', {
        user_id: this.personalUserId,
        username: this.personalUsername,
      });
      this.view = 'main';
    } catch (err) {
      console.error('[Settings] savePersonalCard failed', err);
      alert('Failed to save personal card.');
    }
  }

  async changePassword() {
    if (!this.newPassword || this.newPassword !== this.confirmPassword) {
      alert('Passwords do not match or are empty');
      return;
    }

    const ok = await this.auth.setPassword(this.oldPassword, this.newPassword);
    if (ok) {
      this.oldPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.hasPassword = true;
      alert('Password changed successfully');
    } else {
      alert('Failed to change password');
    }
  }

  async toggleBiometric() {
    if (this.biometricEnabled) {
      await this.auth.disableBiometric();
    } else {
      await this.auth.enableBiometric();
    }
    this.biometricEnabled = await this.auth.isBiometricEnabled();
  }

  // ------------------ IMPORT HANDLERS (added) ------------------
  private async createSimpleTableIfNotExists(tableName: string, columns: string[]) {
    // create columns as TEXT; primary key not set to avoid conflicts on unknown schema
    const cols = columns.map(c => `"${c}" TEXT`).join(', ');
    await this.db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${cols})`);
  }

  private async upsertRowsIntoTable(tableName: string, rows: any[]) {
    if (!rows || rows.length === 0) return;
    const cols = Object.keys(rows[0]);
    await this.createSimpleTableIfNotExists(tableName, cols);

    // build INSERT OR REPLACE
    const placeholders = cols.map(_ => '?').join(',');
    const sql = `INSERT OR REPLACE INTO "${tableName}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`;

    // insert rows one by one (could be optimized with transaction in db service)
    for (const r of rows) {
      const vals = cols.map(c => {
        const v = r[c];
        if (v === undefined || v === null) return null;
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
      });
      await this.db.run(sql, vals);
    }
  }

  async onExcelSelected(ev: Event) {
    try {
      const input = ev.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;
      const f = input.files[0];

      // Inform user to backup first
      if (!confirm('Importing Excel will attempt to merge sheets into your DB. Please backup first (export). Continue?')) {
        input.value = '';
        return;
      }

      const buffer = await f.arrayBuffer();
      const wb = XLSXRead(new Uint8Array(buffer), { type: 'array' });
      await this.dbInit.init();
      await this.db.open();

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows: any[] = XLSXUtils.sheet_to_json(ws, { defval: null });
        if (!rows || rows.length === 0) continue;
        await this.upsertRowsIntoTable(sheetName, rows);
      }

      // optional: persist store/close if supported
      try { await this.db.saveToStoreAndClose?.(); } catch(e) { /* ignore */ }

      alert('Excel imported successfully');
    } catch (err) {
      console.error('[Settings] onExcelSelected failed', err);
      alert('Failed to import Excel: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      // reset file input
      const input = ev.target as HTMLInputElement; if (input) input.value = '';
    }
  }

  async onSqliteSelected(ev: Event) {
    try {
      const input = ev.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;
      const f = input.files[0];

      if (!confirm('Importing a backup can overwrite or merge data. Please export your current DB first. Continue?')) {
        input.value = '';
        return;
      }

      // Read file text
      const text = await f.text();

      let parsed: any;
      try {
        parsed = JSON.parse(text);
        // Handle case where file contains a JSON string (double-encoded)
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
            console.log('[Settings] Detected double-encoded JSON; parsed inner object.');
          } catch (innerErr) {
            console.warn('[Settings] Inner JSON parse failed', innerErr);
            // keep parsed as string so downstream will error out with helpful message
          }
        }
      } catch (jsonErr) {
        // If user selected a raw .db/.sqlite file, we cannot import it via JSON merge here.
        const name = (f.name || '').toLowerCase();
        if (name.endsWith('.db') || name.endsWith('.sqlite') || name.endsWith('.sqlite3')) {
          alert('Selected file appears to be a raw SQLite database file. This import flow accepts JSON backups (created by the app export). Replacing a raw DB file requires a native plugin and is not supported via the browser file import.');
          input.value = '';
          return;
        }
        console.error('[Settings] JSON parse failed for backup file', jsonErr);
        alert('Failed to parse backup file as JSON. Make sure you exported a JSON backup via the app export feature.');
        input.value = '';
        return;
      }

      // If parsing resulted in a string (still), show clearer message and bail.
      if (typeof parsed === 'string') {
        alert('Backup file contained a JSON string. The importer attempted to decode it but failed to produce an object. Please ensure the export file is a valid JSON object (not a string-wrapped JSON).');
        input.value = '';
        return;
      }

      await this.dbInit.init();
      await this.db.open();

      // Helper to try many possible shapes and return map<name, rows[]>
      const tableMap: Record<string, any[]> = {};

      // 1) shape: { tables: [ { name, rows } ] }
      if (parsed && Array.isArray(parsed.tables)) {
        for (const t of parsed.tables) {
          const name = t.name || t.table || 'unknown';
          const rows = t.rows || t.values || t.data || [];
          if (Array.isArray(rows) && rows.length) tableMap[name] = rows;
        }
      }

      // 2) shape: { database: { tables: { tableName: { values | rows } } } }
      if (parsed && parsed.database && parsed.database.tables && typeof parsed.database.tables === 'object') {
        for (const [k, v] of Object.entries(parsed.database.tables)) {
          if (Array.isArray((v as any).values)) tableMap[k] = (v as any).values;
          else if (Array.isArray((v as any).rows)) tableMap[k] = (v as any).rows;
          else if (Array.isArray(v as any)) tableMap[k] = v as any[];
        }
      }

      // 3) shape: simple map { tableName: [ rows... ], ... }
      if (parsed && typeof parsed === 'object') {
        for (const key of Object.keys(parsed)) {
          const val = parsed[key];
          if (Array.isArray(val)) {
            // avoid overwriting entries already discovered
            if (!tableMap[key]) tableMap[key] = val;
          }
        }
      }

      // 4) shape: { tables: { tableName: [ rows ] } }
      if (parsed && parsed.tables && typeof parsed.tables === 'object' && !Array.isArray(parsed.tables)) {
        for (const key of Object.keys(parsed.tables)) {
          const val = parsed.tables[key];
          if (Array.isArray(val)) {
            if (!tableMap[key]) tableMap[key] = val;
          }
        }
      }

      // If still empty, attempt to find any nested arrays inside object
      if (Object.keys(tableMap).length === 0) {
        const inspect = (obj: any, prefix = '') => {
          if (!obj || typeof obj !== 'object') return;
          for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
              const name = prefix ? `${prefix}_${k}` : k;
              if (!tableMap[name]) tableMap[name] = v;
            } else if (typeof v === 'object') {
              inspect(v, prefix ? `${prefix}_${k}` : k);
            }
          }
        };
        inspect(parsed);
      }

      console.log('[Settings] parsed backup → discovered tables:', Object.keys(tableMap));

      if (Object.keys(tableMap).length === 0) {
        alert('No table data found in the backup file. Make sure the file was exported by the app or is a valid JSON backup.');
        input.value = '';
        return;
      }

      for (const [name, rows] of Object.entries(tableMap)) {
        if (Array.isArray(rows) && rows.length) {
          await this.upsertRowsIntoTable(name, rows);
        }
      }

      try { await this.db.saveToStoreAndClose?.(); } catch(e) { /* ignore */ }

      alert('Backup imported successfully');
    } catch (err) {
      console.error('[Settings] onSqliteSelected failed', err);
      alert('Failed to import backup: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      const input = ev.target as HTMLInputElement; if (input) input.value = '';
    }
  }
  // ------------------ END IMPORT HANDLERS ------------------

  private downloadFile(data: string, fileName: string, type: string) {
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private downloadExcel(workbook: any, fileName: string) {
    // Write workbook and get output
    const wbout = XLSXWrite(workbook, { 
      bookType: 'xlsx',
      type: 'buffer'  // Changed to buffer type
    });

    // Create blob from buffer
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // Download file
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link); // Add link to body
    link.click();
    document.body.removeChild(link); // Clean up
    window.URL.revokeObjectURL(url);
  }

  async exportDatabase(format: 'sqlite' | 'excel') {
    try {
      const tables = await this.db.query<{name: string}>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);

      if (format === 'sqlite') {
        const dbData = await this.db.export();
        const fileName = `remind_backup_${new Date().toISOString().slice(0,10)}.json`;
        this.downloadFile(
          JSON.stringify(dbData, null, 2),
          fileName,
          'application/json'
        );
        alert('Database exported successfully');
      } else {
        const workbook = XLSXUtils.book_new();
        
        for (const table of tables) {
          const rows = await this.db.query(`SELECT * FROM ${table.name}`);
          const worksheet = XLSXUtils.json_to_sheet(rows, {
            cellDates: true  // Properly handle dates
          });
          XLSXUtils.book_append_sheet(workbook, worksheet, table.name);
        }

        const fileName = `remind_backup_${new Date().toISOString().slice(0,10)}.xlsx`;
        this.downloadExcel(workbook, fileName);
        alert('Database exported successfully');
      }
    } catch (error: unknown) {
      console.error('[Settings] Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Failed to export database: ' + errorMessage);
    }
  }
}
