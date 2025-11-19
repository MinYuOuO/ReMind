import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SqliteDbService } from '../core/services/db.service';

@Component({
  selector: 'app-db-inspector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Login Screen -->
    <div *ngIf="!isAuthenticated" class="login-overlay">
      <div class="login-box">
        <h2>🔒 DB Inspector Access</h2>
        <p class="login-subtitle">Authentication required</p>
        <form (submit)="authenticate($event)">
          <div class="form-group">
            <label>Password</label>
            <input 
              type="password" 
              [(ngModel)]="passwordInput" 
              name="password"
              placeholder="Enter password"
              autocomplete="off"
              class="password-input"
            />
          </div>
          <div *ngIf="authError" class="auth-error">{{ authError }}</div>
          <button type="submit" class="login-btn">Unlock</button>
        </form>
      </div>
    </div>

    <!-- Main Inspector (only shown when authenticated) -->
    <div *ngIf="isAuthenticated" class="inspector">
      <header class="toolbar">
        <div class="toolbar-left">
          <h2>DB Inspector <span class="tag">debug</span></h2>
        </div>
        <div class="toolbar-actions">
          <input class="table-search" placeholder="Search tables..." [(ngModel)]="tableFilter" (input)="applyFilter()" />
          <button (click)="refreshTables()" title="Refresh tables">Refresh</button>
          <button (click)="exportJson()" title="Open export in new tab">Open export</button>
          <button (click)="downloadExport()" title="Download export">Download</button>
          <button (click)="logout()" class="logout-btn" title="Logout">Logout</button>
        </div>
      </header>

      <main class="content">
        <aside class="sidebar">
          <h3>Tables</h3>
          <div *ngIf="loadingTables" class="muted">Loading...</div>
          <ul *ngIf="!loadingTables">
            <li *ngFor="let t of filteredTables" (click)="viewTable(t.name)" [class.active]="t.name===activeTable">
              <div class="name">{{ t.name }}</div>
              <div class="meta">{{ t.count !== undefined ? t.count : '—' }}</div>
            </li>
          </ul>
        </aside>

        <section class="main-panel">
          <div class="query-box">
            <label>Quick SELECT (readonly)</label>
            <textarea [(ngModel)]="sql" rows="4" class="sql-area"></textarea>
            <div class="query-actions">
              <button (click)="runSql()">Run</button>
              <button (click)="limitTo100()">Limit 100</button>
              <button (click)="clearResult()">Clear</button>
            </div>
          </div>

          <div class="result-area">
            <div *ngIf="loadingResult" class="muted">Running query...</div>
            <div *ngIf="resultError" class="error">{{ resultError }}</div>

            <div *ngIf="rows && rows.length > 0" class="table-wrap">
              <table class="result-table">
                <thead>
                  <tr>
                    <th *ngFor="let c of columns">{{ c }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let r of rows; let i = index" [class.alt]="i % 2 === 1">
                    <td *ngFor="let c of columns">{{ formatCell(r[c]) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div *ngIf="rows && rows.length === 0" class="muted">No rows returned.</div>

            <div *ngIf="rawJson" class="json-panel">
              <h4>Raw JSON</h4>
              <pre class="json-view">{{ rawJson }}</pre>
            </div>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    :host { display:block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #111; }
    
    /* Login Screen Styles */
    .login-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }
    
    .login-box {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
      animation: slideUp 0.4s ease-out;
    }
    
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    .login-box h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: #111;
      text-align: center;
    }
    
    .login-subtitle {
      color: #6b7280;
      text-align: center;
      margin: 0 0 24px 0;
      font-size: 14px;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
    }
    
    .password-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }
    
    .password-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    .auth-error {
      color: #dc2626;
      font-size: 14px;
      margin-bottom: 16px;
      padding: 12px;
      background: #fee2e2;
      border-radius: 8px;
      text-align: center;
    }
    
    .login-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .login-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    
    .login-btn:active {
      transform: translateY(0);
    }
    
    /* Existing Inspector Styles */
    .inspector { height:100%; display:flex; flex-direction:column; min-height: 100vh; background: #f4f6f8; }
    .toolbar { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#0f1720; color:#fff; gap:12px; }
    .toolbar h2 { margin:0; font-size:18px; display:flex; align-items:center; gap:8px; }
    .toolbar .tag { font-size:11px; background:#1f2937; padding:2px 6px; border-radius:4px; color:#d1d5db; }
    .toolbar-actions { display:flex; align-items:center; gap:8px; }
    .table-search { padding:6px 8px; border-radius:6px; border:1px solid #cbd5e1; min-width:180px; }
    .toolbar button { background:#111827; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; }
    .toolbar button:hover { opacity:0.9; }
    .logout-btn { background:#dc2626 !important; }

    .content { display:flex; flex:1; gap:12px; padding:14px; box-sizing:border-box; }
    .sidebar { width:260px; background:#fff; border-radius:8px; padding:12px; box-shadow:0 1px 3px rgba(0,0,0,0.06); overflow:auto; height: calc(100vh - 100px); }
    .sidebar h3 { margin:0 0 8px 0; font-size:14px; }
    .sidebar ul { list-style:none; padding:0; margin:0; }
    .sidebar li { display:flex; justify-content:space-between; padding:8px; border-radius:6px; cursor:pointer; align-items:center; }
    .sidebar li:hover { background:#f1f5f9; }
    .sidebar li.active { background:#e6f0ff; box-shadow:inset 0 0 0 1px rgba(59,130,246,0.08); }
    .sidebar .name { font-weight:600; font-size:13px; color:#0f1720; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:170px; }
    .sidebar .meta { font-size:12px; color:#6b7280; }

    .main-panel { flex:1; display:flex; flex-direction:column; gap:12px; }
    .query-box { background:#fff; padding:12px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
    .query-box label { font-size:13px; color:#374151; }
    .sql-area { width:100%; background:#111827; color:#e6eef8; border:none; padding:10px; border-radius:6px; font-family: monospace; resize:vertical; min-height:72px; }
    .query-actions { margin-top:8px; display:flex; gap:8px; }
    .query-actions button { padding:6px 10px; border-radius:6px; border:none; background:#0b69ff; color:#fff; cursor:pointer; }
    .query-actions button:nth-child(2) { background:#06b6d4; }
    .query-actions button:nth-child(3) { background:#ef4444; }

    .result-area { flex:1; overflow:auto; }
    .muted { color:#6b7280; padding:8px 0; }
    .error { color:#b91c1c; padding:8px 0; }

    .table-wrap { background:#fff; border-radius:8px; padding:8px; box-shadow:0 1px 3px rgba(0,0,0,0.04); overflow:auto; max-height:320px; }
    .result-table { width:100%; border-collapse:collapse; font-size:13px; }
    .result-table thead th { position:sticky; top:0; background:#f8fafc; padding:8px; text-align:left; border-bottom:1px solid #e6edf3; }
    .result-table td { padding:8px; border-bottom:1px solid #f1f5f9; vertical-align:top; white-space:pre-wrap; word-break:break-word; max-width:280px; }
    .result-table tbody tr.alt { background:#fbfdff; }

    .json-panel { margin-top:12px; background:#0b1220; color:#e6eef8; border-radius:8px; padding:10px; }
    .json-panel h4 { margin:0 0 8px 0; color:#cbd5e1; }
    .json-view { font-family:monospace; font-size:12px; max-height:240px; overflow:auto; white-space:pre-wrap; background:transparent; color:#e6eef8; margin:0; }

    /* responsive */
    @media (max-width: 880px) {
      .content { flex-direction:column; padding:10px; }
      .sidebar { width:100%; height:auto; order:2; }
      .main-panel { order:1; }
      .login-box { padding: 24px; }
    }
  `]
})
export class DbInspectorComponent {
  // Authentication state
  private readonly CORRECT_PASSWORD = 'OfqzR6kYT5m[U#zM';
  isAuthenticated = false;
  passwordInput = '';
  authError: string | null = null;

  // table list + UI state
  tables: Array<{ name: string; count?: number }> = [];
  loadingTables = false;
  tableFilter = '';
  activeTable: string | null = null;

  // query/result state
  sql = 'SELECT name FROM sqlite_master WHERE type=\"table\" AND name NOT LIKE \"sqlite_%\";';
  loadingResult = false;
  rows: any[] | null = null;
  columns: string[] = [];
  resultError: string | null = null;
  rawJson: string | null = null;

  constructor(private db: SqliteDbService) {
    // Check if already authenticated in session
    this.isAuthenticated = sessionStorage.getItem('dbInspectorAuth') === 'true';
    
    if (this.isAuthenticated) {
      this.refreshTables();
    }
  }

  authenticate(event: Event) {
    event.preventDefault();
    
    if (this.passwordInput === this.CORRECT_PASSWORD) {
      this.isAuthenticated = true;
      this.authError = null;
      sessionStorage.setItem('dbInspectorAuth', 'true');
      this.refreshTables();
    } else {
      this.authError = 'Incorrect password';
      this.passwordInput = '';
    }
  }

  logout() {
    this.isAuthenticated = false;
    this.passwordInput = '';
    this.authError = null;
    sessionStorage.removeItem('dbInspectorAuth');
    this.clearResult();
  }

  // Filter helpers
  applyFilter() {
    // no-op here because we use a getter; keep for template binding consistency
  }

  get filteredTables() {
    const q = (this.tableFilter || '').trim().toLowerCase();
    if (!q) return this.tables;
    return this.tables.filter(t => t.name.toLowerCase().includes(q));
  }

  async refreshTables() {
    this.loadingTables = true;
    this.tables = [];
    try {
      const res: Array<{ name: string }> = await this.db.query(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      for (const t of res) {
        let count: number | undefined = undefined;
        try {
          const cnt = await this.db.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${t.name}`);
          count = (cnt && cnt[0] && typeof cnt[0].cnt === 'number') ? cnt[0].cnt : undefined;
        } catch {
          count = undefined;
        }
        this.tables.push({ name: t.name, count });
      }
    } catch (err: any) {
      console.error('Failed to load tables', err);
    } finally {
      this.loadingTables = false;
    }
  }

  async viewTable(name: string) {
    this.activeTable = name;
    this.sql = `SELECT * FROM ${name} LIMIT 200;`;
    await this.runSql();
  }

  limitTo100() {
    if (!this.sql) return;
    if (/limit\s+\d+/i.test(this.sql)) {
      this.sql = this.sql.replace(/limit\s+\d+/i, 'LIMIT 100');
    } else {
      this.sql = this.sql.trim().replace(/;?$/, ' LIMIT 100;');
    }
  }

  async runSql() {
    this.loadingResult = true;
    this.resultError = null;
    this.rows = null;
    this.columns = [];
    this.rawJson = null;

    const trimmed = (this.sql || '').trim();
    if (!trimmed) {
      this.resultError = 'Enter a SELECT statement.';
      this.loadingResult = false;
      return;
    }

    // Restrict to SELECT queries by default for safety
    if (!/^select/i.test(trimmed)) {
      this.resultError = 'Only SELECT queries are allowed from this inspector (read-only).';
      this.loadingResult = false;
      return;
    }

    try {
      const res = await this.db.query<any>(trimmed);
      this.rows = res || [];
      this.columns = this.rows.length ? Object.keys(this.rows[0]) : [];
      try {
        this.rawJson = JSON.stringify(this.rows, null, 2);
      } catch {
        this.rawJson = String(this.rows);
      }
    } catch (err: any) {
      console.error('Query failed', err);
      this.resultError = err?.message ?? String(err);
    } finally {
      this.loadingResult = false;
    }
  }

  clearResult() {
    this.rows = null;
    this.columns = [];
    this.rawJson = null;
    this.resultError = null;
  }

  formatCell(v: any) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  async getExportJson(): Promise<string> {
    return this.db.export();
  }

  async exportJsonRaw(): Promise<string | null> {
    try {
      return await this.getExportJson();
    } catch {
      return null;
    }
  }

  async exportJsonAndOpen(): Promise<void> {
    const raw = await this.exportJsonRaw();
    const pretty = (() => {
      try { return JSON.stringify(JSON.parse(raw || ''), null, 2); } catch { return raw; }
    })();
    const html = `<pre style="white-space:pre-wrap;font-family:monospace;padding:12px;">${this.escapeHtml(pretty || '')}</pre>`;
    const w = window.open('', '_blank');
    if (w && w.document) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } else {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }
  }

  async exportJsonDownload(filename = 'remind-export.json'): Promise<void> {
    try {
      const raw = await this.exportJsonRaw();
      if (!raw) return;
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      console.error('Export download failed', err);
    }
  }

  exportJson = () => this.exportJsonAndOpen();
  downloadExport = () => this.exportJsonDownload();

  private escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
