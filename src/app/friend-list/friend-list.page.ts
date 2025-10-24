import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Platform,
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonRefresher, IonRefresherContent,
  IonFab, IonFabButton, IonIcon, IonButtons, IonInput, IonButton,
  IonSelect, IonSelectOption, IonModal, IonDatetime, IonAvatar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add,
  createOutline,
  arrowBack,
  camera,
  save,
  personOutline,
  briefcaseOutline,
  callOutline,
  calendarOutline,
  starOutline
} from 'ionicons/icons';
import { UserIdentityService } from '../core/services/user-identity.service';
import { ContactRepo, Contact, Relationship } from '../core/repos/contact.repo';
import { DbInitService } from '../core/services/db-inti.service';
import { SqliteDbService } from '../core/services/db.service';

@Component({
  selector: 'app-friend-list',
  templateUrl: 'friend-list.page.html',
  styleUrls: ['friend-list.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonContent,
    IonList, IonItem, IonLabel, IonRefresher, IonRefresherContent,
    IonFab, IonFabButton, IonIcon, IonInput, IonButton,
    IonSelect, IonSelectOption, IonModal, IonDatetime, IonAvatar
  ],
})
export class FriendListPage implements OnInit {
  userId = '';
  loading = signal(true);
  contacts = signal<Contact[]>([]);

  constructor(
    private platform: Platform,
    private identity: UserIdentityService,
    private contactsRepo: ContactRepo,
    private dbInit: DbInitService,
    private db: SqliteDbService
  ) {
    // register icons used by the list + modal UI
    addIcons({
      add,
      'create-outline': createOutline,
      'arrow-back': arrowBack,
      camera,
      save,
      'person-outline': personOutline,
      'briefcase-outline': briefcaseOutline,
      'call-outline': callOutline,
      'calendar-outline': calendarOutline,
      'star-outline': starOutline
    });
  }

  showModal = signal(false);
  newContact: Partial<Contact> = {
    name: '',
    relationship: 'friend',
    contact_detail: '',
    birthday: null,
    notes: ''
  };
  // currently editing contact id; null when creating new
  editingContactId: string | null = null;
  relationships: Relationship[] = ['friend', 'best_friend', 'colleague', 'family'];

  // Inline calendar state (robust fallback that always works inside modal)
  calendarOpen = false;
  calYear = new Date().getFullYear();
  calMonth = new Date().getMonth(); // 0-based
  calendarCells: (number | null)[] = []; // grid of 42 cells (some null)
  monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  async ngOnInit() {
    try {
      await this.platform.ready();
      await this.identity.ready();

      // Ensure DB/webstore/schema initialized before any DB ops
      await this.dbInit.init();       // ensures schema & seed
      await this.db.open();           // ensure connection available

      await this.initUser();
      await this.load();
    } catch (err) {
      console.error('[FriendList] Init failed:', err);
      this.loading.set(false);
    }
  }

  // helper used for *ngFor trackBy
  trackById(index: number, item: Contact) {
    return item.contact_id;
  }

  // return initials for avatar
  initials(name?: string) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return (first + second).toUpperCase();
  }

  // simple consistent avatar color based on name hash
  avatarColor(name?: string) {
    const palette = ['#387ef5','#32db64','#ffce00','#ff6b6b','#8e44ad','#e67e22'];
    if (!name) return palette[0];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
    return palette[Math.abs(h) % palette.length];
  }

  // format birthday string (YYYY-MM-DD or ISO). returns human-friendly date
  formatBirthday(b?: string|null) {
    if (!b) return '';
    try {
      const d = new Date(b);
      if (isNaN(d.getTime())) return b;
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
    } catch {
      return b;
    }
  }

  // placeholder edit handler
  openEdit(c: Contact) {
    // populate modal for editing and open it
    this.editingContactId = c.contact_id ?? null;
    this.newContact = {
      name: c.name ?? '',
      relationship: (c.relationship as Relationship) ?? 'friend',
      contact_detail: c.contact_detail ?? '',
      birthday: c.birthday ?? null,
      notes: c.notes ?? ''
    };
    this.showModal.set(true);
  }

  onCancel() {
    // close modal and reset form/editing state
    this.showModal.set(false);
    this.editingContactId = null;
    this.newContact = {
      name: '',
      relationship: 'friend',
      contact_detail: '',
      birthday: null,
      notes: ''
    };
  }

  private async initUser() {
    try {
      // Get/create user
      this.userId = await this.identity.ensureUserId();

      // Verify user exists in DB
      const users = await this.db.query(
        'SELECT user_id FROM user WHERE user_id = ?',
        [this.userId]
      );

      if (!users.length) {
        // Create user if missing
        await this.db.run(
          'INSERT INTO user (user_id, username) VALUES (?, ?)',
          [this.userId, 'Local User']
        );
      }
    } catch (err) {
      console.error('[FriendList] User init failed:', err);
      throw err;
    }
  }

  async load(event?: CustomEvent) {
    try {
      this.loading.set(true);
      const list = await this.contactsRepo.listByUser(this.userId);
      this.contacts.set(list);
    } finally {
      this.loading.set(false);
      (event?.target as any)?.complete?.(); // complete refresher if present
    }
  }

  async addSample() {
    try {
      // Make sure DB ready
      await this.dbInit.init();
      await this.db.open();

      // Create contact
      await this.contactsRepo.createMinimal(this.userId, 'New Friend');

      // Persist to web store and close wrapper so data survives reload
      try { await this.db.saveToStoreAndClose(); } catch (e) { console.warn('[FriendList] save failed', e); }

      await this.load();
    } catch (err) {
      console.error('[FriendList] Add sample failed:', err);
    }
  }

  // TODO: navigate to Add/Edit page when you build it
  onAdd() {
    // prepare modal for creating a new contact
    this.editingContactId = null;
    this.newContact = {
      name: '',
      relationship: 'friend',
      contact_detail: '',
      birthday: null,
      notes: ''
    };
    this.showModal.set(true);
  }

  async onSubmit() {
    if (!this.newContact.name) return;

    try {
      // Ensure DB ready and user exists
      await this.dbInit.init();
      await this.db.open();
      await this.initUser();

      if (this.editingContactId) {
        // Update existing contact via raw SQL (schema: contact table expected)
        await this.db.run(
          `UPDATE contact
           SET name = ?, relationship = ?, contact_detail = ?, birthday = ?, notes = ?
           WHERE contact_id = ?`,
          [
            this.newContact.name,
            this.newContact.relationship,
            this.newContact.contact_detail,
            this.newContact.birthday,
            this.newContact.notes,
            this.editingContactId
          ]
        );
      } else {
        // Create the contact (existing behavior)
        await this.contactsRepo.createMinimal(
          this.userId,
          this.newContact.name,
          this.newContact.relationship as Relationship
        );
      }

      // Persist and close wrapper so the web store has the latest bytes
      try { await this.db.saveToStoreAndClose(); } catch (e) { console.warn('[FriendList] save failed', e); }

      // Reset form and refresh list
      this.showModal.set(false);
      this.editingContactId = null;
      this.newContact = {
        name: '',
        relationship: 'friend',
        contact_detail: '',
        birthday: null,
        notes: ''
      };
      await this.load();
    } catch (err) {
      console.error('Failed to create/update contact:', err);
    }
  }

  // initialize calendar cells for current month
  private buildCalendar(year = this.calYear, month = this.calMonth) {
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay(); // 0..6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    // fill leading nulls
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    // fill days
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // pad to full weeks (42 cells max)
    while (cells.length < 42) cells.push(null);
    this.calendarCells = cells;
    this.calYear = year;
    this.calMonth = month;
  }

  toggleCalendar(open?: boolean) {
    const next = typeof open === 'boolean' ? open : !this.calendarOpen;
    this.calendarOpen = next;
    if (next) {
      // if model has a birthday, jump to that month
      if (this.newContact.birthday) {
        const d = new Date(this.newContact.birthday);
        if (!isNaN(d.getTime())) {
          this.buildCalendar(d.getFullYear(), d.getMonth());
          return;
        }
      }
      // default to current month
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

  selectDay(day: number) {
    // compose YYYY-MM-DD
    const y = this.calYear;
    const m = String(this.calMonth + 1).padStart(2,'0');
    const d = String(day).padStart(2,'0');
    this.newContact.birthday = `${y}-${m}-${d}`;
    this.calendarOpen = false;
  }

  isSelectedDay(day: number) {
    if (!this.newContact.birthday) return false;
    const d = new Date(this.newContact.birthday);
    return d.getFullYear() === this.calYear && (d.getMonth() === this.calMonth) && (d.getDate() === day);
  }
}
