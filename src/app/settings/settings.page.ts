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
import { NavController } from '@ionic/angular';

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
	settingsOutline,
	callOutline,
	calendarOutline,
	mailOutline,
	eyeOutline,
	eyeOffOutline,
	downloadOutline,
	documentOutline,
} from 'ionicons/icons';
import { trashOutline } from 'ionicons/icons';

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
	'trash-outline': trashOutline,
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
		FormsModule,
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

	appVersion = '1.0.0';

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
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec',
	];
	weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

	// Reminders loaded for notification view
	reminders: any[] = [];
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
		if (m < 0) {
			m = 11;
			y -= 1;
		}
		this.buildCalendar(y, m);
	}

	nextMonth() {
		let m = this.calMonth + 1;
		let y = this.calYear;
		if (m > 11) {
			m = 0;
			y += 1;
		}
		this.buildCalendar(y, m);
	}

	prevYear() {
		this.buildCalendar(this.calYear - 1, this.calMonth);
	}
	nextYear() {
		this.buildCalendar(this.calYear + 1, this.calMonth);
	}

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
		private dbInit: DbInitService,
		private db: SqliteDbService,
		private auth: AuthService,
		private navCtrl: NavController
	) {
		// constructor intentionally does not call addIcons again
		addIcons({
			arrowBack,
			personOutline,
			notificationsOutline,
			lockClosedOutline,
			sparklesOutline,
			settingsOutline,
			informationCircleOutline,
			helpCircleOutline,
			downloadOutline,
			documentOutline,
			callOutline,
			calendarOutline,
			mailOutline,
			trashOutline,
		});
	}

	async ngOnInit() {
		// load saved settings once
		const s = await this.aiSettings.load();
		this.aiProvider = s.provider;
		this.aiApiKey = s.apiKey;
		this.aiModel = s.model;

		// Check if we should open a specific view
		this.route.queryParams.subscribe((params) => {
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
		page: 'privacy' | 'ai' | 'data' | 'about' | 'faq' | 'card' | 'notification'
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

		// load reminders when opening notifications
		if (page === 'notification') {
			await this.loadReminders();
		}
	}

	// load reminders from DB for notification view
	async loadReminders() {
		try {
			await this.dbInit.init();
			await this.db.open();
			// Fetch reminders, include contact name when possible
			const rows = await this.db.query<any>(`
				SELECT r.reminder_id, r.contact_id, r.user_id, r.reminder_type, r.due_date, r.title, r.description, r.priority, r.status, r.created_at, r.completed_at, c.name as contact_name
				FROM reminder r
				LEFT JOIN contact c ON c.contact_id = r.contact_id
				ORDER BY datetime(r.due_date) DESC
			`);
			this.reminders = (rows || []).map((r) => ({
				...r,
				due_date_display: r.due_date
					? new Date(r.due_date).toLocaleString()
					: '',
			}));
			console.log('[Settings] loaded reminders:', this.reminders.length);
		} catch (e) {
			console.error('[Settings] loadReminders failed', e);
			this.reminders = [];
		}
	}

	// delete a single reminder by id
	async deleteReminder(reminderId: string) {
		if (!reminderId) return;
		try {
			if (!confirm('Delete this notification?')) return;
			await this.dbInit.init();
			await this.db.open();
			await this.db.run(`DELETE FROM reminder WHERE reminder_id = ?`, [
				reminderId,
			]);
			try {
				await this.db.saveToStoreAndClose();
			} catch (e) {
				/* ignore */
			}
			this.reminders = this.reminders.filter(
				(r) => r.reminder_id !== reminderId
			);
		} catch (e) {
			console.error('[Settings] deleteReminder failed', e);
			alert('Failed to delete notification');
		}
	}

	// clear all reminders (with confirmation)
	async clearAllReminders() {
		if (!confirm('Clear all notifications? This cannot be undone.')) return;
		try {
			await this.dbInit.init();
			await this.db.open();
			await this.db.run(`DELETE FROM reminder`);
			try {
				await this.db.saveToStoreAndClose();
			} catch (e) {
				/* ignore */
			}
			this.reminders = [];
		} catch (e) {
			console.error('[Settings] clearAllReminders failed', e);
			alert('Failed to clear notifications');
		}
	}

	// handle notification card click
	onNotificationClick(notification: any) {
		try {
			console.log('[Settings] notification clicked', notification);
			if (notification && notification.contact_id) {
				// If you have a route to open contact details, implement navigation here.
				// For now show a simple info dialog.
				alert(`Open contact: ${notification.contact_id}`);
			} else {
				alert(notification?.title || 'Notification selected');
			}
		} catch (e) {
			console.warn('[Settings] onNotificationClick handler failed', e);
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
				const verRows = await this.db.query<{ user_version: number }>(
					'PRAGMA user_version;'
				);
				console.log(
					'[Settings] PRAGMA user_version result:',
					JSON.stringify(verRows)
				);
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

			console.log(
				'[Settings] query user WHERE user_id="u_local" →',
				rows?.length ? rows : 'no rows'
			);

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
					const all = await this.db.query<any>(
						`SELECT user_id, username, contact_detail FROM user`
					);
					console.log(
						'[Settings] fallback: all user rows →',
						all?.length ? all : 'no rows'
					);
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
			if (
				!this.personalUsername &&
				!this.personalContactDetails &&
				!this.personalBirthday &&
				!this.personalNotes
			) {
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

	// ------------------ IMPORT HANDLERS (fixed) ------------------

	// helper: get table info via PRAGMA (returns rows with columns: cid, name, type, notnull, dflt_value, pk)
	private async getTableInfo(tableName: string): Promise<any[]> {
		try {
			const info = await this.db.query<any>(
				`PRAGMA table_info("${tableName}")`
			);
			if (info && info.length) {
				console.log(`[Settings][PRAGMA] table_info("${tableName}") →`, info);
			} else {
				console.log(
					`[Settings][PRAGMA] table_info("${tableName}") → no rows (table missing?)`
				);
			}
			return info || [];
		} catch (e) {
			console.warn(`[Settings] getTableInfo failed for ${tableName}`, e);
			return [];
		}
	}

	// create table if missing; if present, add any missing columns (do NOT change existing PK)
	private async createSimpleTableIfNotExists(
		tableName: string,
		columns: string[]
	) {
		const exists = await this.db.query<{ name: string }>(
			`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
			[tableName]
		);
		if (!exists || exists.length === 0) {
			const pkCandidates = ['contact_id', 'id', 'user_id', 'uuid'];
			const lowerCols = columns.map((c) => c.toLowerCase());
			let primaryKey: string | undefined;
			for (const cand of pkCandidates) {
				const idx = lowerCols.indexOf(cand);
				if (idx !== -1) {
					primaryKey = columns[idx];
					break;
				}
			}

			const colsDef = columns
				.map((c) =>
					primaryKey && c === primaryKey
						? `"${c}" TEXT PRIMARY KEY`
						: `"${c}" TEXT`
				)
				.join(', ');

			console.log(
				`[Settings] Creating table "${tableName}" (${columns.length} cols) pk=${primaryKey ?? 'none'
				}`
			);
			await this.db.run(
				`CREATE TABLE IF NOT EXISTS "${tableName}" (${colsDef})`
			);
			return;
		}

		// Table exists — ensure missing columns are added (ALTER TABLE ADD COLUMN)
		const info = await this.getTableInfo(tableName);
		const existingCols = new Set(
			(info || []).map((r: any) => String(r.name).toLowerCase())
		);
		const missing = columns.filter((c) => !existingCols.has(c.toLowerCase()));

		if (missing.length === 0) {
			console.log(
				`[Settings] Table "${tableName}" exists and has all ${columns.length} columns.`
			);
			return;
		}

		console.log(
			`[Settings] Table "${tableName}" exists — adding ${missing.length} missing columns:`,
			missing
		);
		for (const col of missing) {
			try {
				await this.db.run(
					`ALTER TABLE "${tableName}" ADD COLUMN "${col}" TEXT;`
				);
				console.log(
					`[Settings] ALTER TABLE "${tableName}" ADD COLUMN "${col}" succeeded`
				);
			} catch (e) {
				console.warn(
					`[Settings] Failed to add column "${col}" to "${tableName}" — continuing`,
					e
				);
			}
		}
	}

	// robust upsert/import function (preserves existing contacts and safely migrates)
	private async upsertRowsIntoTable(tableName: string, rows: any[]) {
		if (!rows || rows.length === 0) return;

		// union of keys from imported rows (case-preserving)
		const colSet = new Set<string>();
		for (const r of rows) {
			if (r && typeof r === 'object')
				Object.keys(r).forEach((k) => colSet.add(k));
		}
		const importCols = Array.from(colSet);
		if (importCols.length === 0) return;

		// ensure table exists and has required columns
		await this.createSimpleTableIfNotExists(tableName, importCols);

		// inspect existing schema
		const tableInfo = await this.getTableInfo(tableName);
		const existingColsOnDisk = (tableInfo || []).map((c: any) =>
			String(c.name)
		);
		const existingPkCol = (
			tableInfo.find((col: any) => col && col.pk && col.pk > 0) || {}
		).name as string | undefined;

		const makeId = () =>
			typeof (crypto as any)?.randomUUID === 'function'
				? (crypto as any).randomUUID()
				: 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2);

		// Special handling for contact table - always additive
		if (tableName.toLowerCase() === 'contact') {
			console.log(
				`[Settings] Contact import: ADDITIVE mode - checking for duplicates`
			);

			let inserted = 0,
				skipped = 0,
				failed = 0;

			for (const [i, r] of rows.entries()) {
				try {
					// Check if contact already exists by name + contact_detail
					const name = r.name || r.Name || '';
					const contactDetail =
						r.contact_detail || r.contact_details || r.Contact_detail || '';
					const userId = r.user_id || r.User_id || 'u_default';

					if (!name) {
						console.log(`[Settings] Skipping contact row ${i + 1}: no name`);
						skipped++;
						continue;
					}

					// Check for duplicates
					const existingCheck = await this.db.query<any>(
						`SELECT contact_id FROM contact WHERE name = ? AND contact_detail = ? LIMIT 1`,
						[name, contactDetail]
					);

					if (existingCheck && existingCheck.length > 0) {
						console.log(
							`[Settings] Skipping duplicate contact: ${name} (${contactDetail})`
						);
						skipped++;
						continue;
					}

					// Generate new contact_id
					const newContactId = makeId();

					// Prepare values for all columns
					const vals = importCols.map((c: string) => {
						const lower = c.toLowerCase();
						if (lower === 'contact_id') return newContactId;
						if (lower === 'user_id') return userId;
						if (lower === 'created_at' || lower === 'updated_at') {
							return new Date().toISOString();
						}

						// Try to find matching key (case-insensitive)
						if (Object.prototype.hasOwnProperty.call(r, c)) return r[c] ?? null;
						const matchKey = Object.keys(r).find(
							(k) => k.toLowerCase() === lower
						);
						return matchKey ? r[matchKey] ?? null : null;
					});

					// Insert the new contact
					const quotedCols = importCols.map((c: string) => `"${c}"`).join(',');
					const placeholders = importCols.map(() => '?').join(',');
					await this.db.run(
						`INSERT INTO contact (${quotedCols}) VALUES (${placeholders})`,
						vals
					);

					inserted++;
					console.log(
						`[Settings] Added contact ${i + 1}/${rows.length}: ${name}`
					);
				} catch (err) {
					console.warn(
						`[Settings] Failed to import contact row ${i + 1}:`,
						err
					);
					failed++;
				}
			}

			console.log(
				`[Settings] Contact import complete: inserted=${inserted}, skipped=${skipped}, failed=${failed}`
			);
			return;
		}

		// For other tables - use additive INSERT (not REPLACE)
		const quotedCols = importCols.map((c: string) => `"${c}"`).join(',');
		const placeholders = importCols.map(() => '?').join(',');
		const insertSql = `INSERT INTO "${tableName}" (${quotedCols}) VALUES (${placeholders})`;

		console.log(
			`[Settings] Importing ${tableName}: ${rows.length} rows (ADDITIVE mode)`
		);

		let inserted = 0,
			failed = 0,
			skipped = 0;
		for (const [i, r] of rows.entries()) {
			const vals = importCols.map((c: string) => {
				if (Object.prototype.hasOwnProperty.call(r, c)) return r[c] ?? null;
				const matchKey = Object.keys(r).find(
					(k) => k.toLowerCase() === c.toLowerCase()
				);
				return matchKey ? r[matchKey] ?? null : null;
			});

			try {
				// Generate new ID if primary key column exists and value is null/empty
				if (existingPkCol) {
					const pkIdx = importCols.findIndex(
						(c) => c.toLowerCase() === existingPkCol.toLowerCase()
					);
					if (pkIdx >= 0 && (!vals[pkIdx] || vals[pkIdx] === '')) {
						vals[pkIdx] = makeId();
					}
				}

				await this.db.run(insertSql, vals);
				inserted++;
			} catch (rowErr: any) {
				// Check if it's a duplicate key error
				if (
					rowErr?.message?.includes('UNIQUE') ||
					rowErr?.message?.includes('PRIMARY KEY')
				) {
					console.log(
						`[Settings] Skipping duplicate row in ${tableName} (row ${i + 1})`
					);
					skipped++;
				} else {
					console.warn(
						`[Settings] Import row failed for table=${tableName} index=${i}:`,
						rowErr
					);
					failed++;
				}
			}
		}

		console.log(
			`[Settings] Import ${tableName} complete: inserted=${inserted}, skipped=${skipped}, failed=${failed}, total=${rows.length}`
		);
	}

	// Download helper for JSON
	private downloadFile(data: string, fileName: string, type: string) {
		const blob = new Blob([data], { type });
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		link.click();
		window.URL.revokeObjectURL(url);
	}

	// Download helper for Excel workbook
	private downloadExcel(workbook: any, fileName: string) {
		const wbout = XLSXWrite(workbook, {
			bookType: 'xlsx',
			type: 'array',
		});
		const blob = new Blob([wbout], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		});
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(url);
	}

	// Export DB (JSON or Excel) exposed to template
	async exportDatabase(format: 'sqlite' | 'excel') {
		try {
			const tables = await this.db.query<{ name: string }>(`
				SELECT name FROM sqlite_master 
				WHERE type='table' AND name NOT LIKE 'sqlite_%'
			`);

			if (format === 'sqlite') {
				const dbData = await this.db.export();
				const fileName = `remind_backup_${new Date()
					.toISOString()
					.slice(0, 10)}.json`;
				// db.export returns JSON string; ensure pretty format
				try {
					const parsed = JSON.parse(dbData);
					this.downloadFile(
						JSON.stringify(parsed, null, 2),
						fileName,
						'application/json'
					);
				} catch {
					this.downloadFile(dbData, fileName, 'application/json');
				}
				alert('Database exported successfully');
			} else {
				const workbook = XLSXUtils.book_new();
				for (const table of tables) {
					const rows = await this.db.query(`SELECT * FROM ${table.name}`);
					const worksheet = XLSXUtils.json_to_sheet(rows || [], {
						cellDates: true,
					});
					XLSXUtils.book_append_sheet(workbook, worksheet, table.name);
				}
				const fileName = `remind_backup_${new Date()
					.toISOString()
					.slice(0, 10)}.xlsx`;
				this.downloadExcel(workbook, fileName);
				alert('Database exported successfully');
			}
		} catch (error: unknown) {
			console.error('[Settings] Export failed:', error);
			alert(
				'Failed to export database: ' +
				(error instanceof Error ? error.message : String(error))
			);
		}
	}

	// File input handler for Excel uploads (template calls this)
	async onExcelSelected(ev: Event) {
		try {
			const input = ev.target as HTMLInputElement;
			if (!input.files || input.files.length === 0) return;
			const f = input.files[0];

			if (
				!confirm(
					'Import Excel will ADD data to your database (existing data will be preserved). Continue?'
				)
			) {
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
				console.log(
					`[Settings] Processing sheet "${sheetName}": ${rows.length} rows`
				);
				await this.upsertRowsIntoTable(sheetName, rows);
			}

			try {
				await this.db.saveToStoreAndClose?.();
			} catch (e) {
				/* ignore */
			}
			alert('Excel imported successfully (data added, not replaced)');
		} catch (err) {
			console.error('[Settings] onExcelSelected failed', err);
			alert(
				'Failed to import Excel: ' +
				(err instanceof Error ? err.message : String(err))
			);
		} finally {
			const input = ev.target as HTMLInputElement;
			if (input) input.value = '';
		}
	}

	// File input handler for JSON/backup uploads (template calls this)
	async onSqliteSelected(ev: Event) {
		try {
			const input = ev.target as HTMLInputElement;
			if (!input.files || input.files.length === 0) return;
			const f = input.files[0];

			if (
				!confirm(
					'Import backup will ADD data to your database (existing data will be preserved). Continue?'
				)
			) {
				input.value = '';
				return;
			}

			const text = await f.text();
			let parsed: any;
			try {
				parsed = JSON.parse(text);
				if (typeof parsed === 'string') {
					try {
						parsed = JSON.parse(parsed);
					} catch {
						/* keep as-is */
					}
				}
			} catch (jsonErr) {
				const name = (f.name || '').toLowerCase();
				if (
					name.endsWith('.db') ||
					name.endsWith('.sqlite') ||
					name.endsWith('.sqlite3')
				) {
					alert(
						'Selected file appears to be a raw SQLite DB; this importer expects JSON backups. Raw DB replacement is not supported here.'
					);
					input.value = '';
					return;
				}
				console.error('[Settings] JSON parse failed', jsonErr);
				alert('Failed to parse backup as JSON.');
				input.value = '';
				return;
			}

			if (!parsed || typeof parsed !== 'object') {
				alert('Backup file does not contain a valid object.');
				input.value = '';
				return;
			}

			await this.dbInit.init();
			await this.db.open();

			const tableMap: Record<string, any[]> = {};

			// various shapes -> tableMap
			if (Array.isArray(parsed.tables)) {
				for (const t of parsed.tables) {
					const name = t.name || t.table || 'unknown';
					const rows = t.rows || t.values || t.data || [];
					if (Array.isArray(rows) && rows.length) tableMap[name] = rows;
				}
			}
			if (
				parsed.database &&
				parsed.database.tables &&
				typeof parsed.database.tables === 'object'
			) {
				for (const [k, v] of Object.entries(parsed.database.tables)) {
					if (Array.isArray((v as any).values)) tableMap[k] = (v as any).values;
					else if (Array.isArray((v as any).rows))
						tableMap[k] = (v as any).rows;
					else if (Array.isArray(v as any)) tableMap[k] = v as any[];
				}
			}
			for (const key of Object.keys(parsed)) {
				const val = parsed[key];
				if (Array.isArray(val) && val.length && typeof val[0] === 'object') {
					if (!tableMap[key]) tableMap[key] = val;
				}
			}

			// fallback deep inspect
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

			if (Object.keys(tableMap).length === 0) {
				alert('No table data found in backup file.');
				input.value = '';
				return;
			}

			console.log(
				`[Settings] Found ${Object.keys(tableMap).length} tables to import`
			);

			for (const [name, rows] of Object.entries(tableMap)) {
				if (Array.isArray(rows) && rows.length) {
					console.log(
						`[Settings] Importing table "${name}": ${rows.length} rows`
					);
					await this.upsertRowsIntoTable(name, rows);
				}
			}

			try {
				await this.db.saveToStoreAndClose?.();
			} catch (e) {
				/* ignore */
			}
			alert('Backup imported successfully (data added, not replaced)');
		} catch (err) {
			console.error('[Settings] onSqliteSelected failed', err);
			alert(
				'Failed to import backup: ' +
				(err instanceof Error ? err.message : String(err))
			);
		} finally {
			const input = ev.target as HTMLInputElement;
			if (input) input.value = '';
		}
	}
	// ------------------ END IMPORT HANDLERS ------------------

	sendFeedback() {
		// You can implement actual feedback submission logic here
		alert('Feedback sent!');
	}

	openPrivacyPolicy() {
		// Navigate to Privacy Policy page or show in a modal
		// For example, you could use NavController to navigate
		this.navCtrl.navigateForward('/privacy-policy');
	}

	openTermsOfService() {
		// Navigate to Terms of Service page or show in a modal
		// For example, you could use NavController to navigate
		this.navCtrl.navigateForward('/terms-of-service');
	}


}
