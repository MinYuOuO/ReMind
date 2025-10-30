import {
  Component,
  OnInit,
  signal,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Platform,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonFab,
  IonFabButton,
  IonIcon,
  IonButtons,
  IonInput,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonTextarea,
  IonSearchbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  notificationsOutline,
  shieldCheckmarkOutline,
  personOutline,
  add,
  arrowBack,
  trash,
  camera,
  briefcaseOutline,
  starOutline,
  callOutline,
  calendarOutline,
  save,
  createOutline,
  chatbubblesOutline,
  chevronDownOutline,
  paperPlaneOutline,
} from 'ionicons/icons';

import { ContactRepo, Contact, Relationship } from '../core/repos/contact.repo';
import { DbInitService } from '../core/services/db-inti.service';
import { SqliteDbService } from '../core/services/db.service';
import { UserRepo } from '../core/repos/user.repo';
import { UserIdentityService } from '../core/services/user-identity.service';

@Component({
  selector: 'app-friend-list',
  templateUrl: 'friend-list.page.html',
  styleUrls: ['friend-list.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonFab,
    IonFabButton,
    IonIcon,
    IonInput,
    IonButton,
    IonSelect,
    IonSelectOption,
    IonModal,
    IonTextarea,
    IonSearchbar,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FriendListPage implements OnInit {
  // current user (comes from identity service)
  userId = '';

  // UI state
  loading = signal(true);
  contacts = signal<Contact[]>([]);
  query = signal<string>('');

  // computed filtered contacts by query
  filteredContacts = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.contacts();
    return this.contacts().filter((c) => {
      const name = (c.name || '').toLowerCase();
      const detail = (c.contact_detail || '').toLowerCase();
      return name.includes(q) || detail.includes(q);
    });
  });

  // modal state
  showModal = signal(false);
  showInteractionModal = signal(false);

  // form model for contact
  newContact: Partial<Contact> = {
    name: '',
    relationship: 'friend',
    contact_detail: '',
    birthday: null,
    notes: '',
  };

  // editing id
  editingContactId: string | null = null;

  // interaction form model
  interaction: any = {
    topic: '',
    date: null,
    contact: null,
    rawNotes: '',
  };

  // select options for interaction
  contactOptions: Contact[] = [];
  relationships: Relationship[] = [
    'friend',
    'best_friend',
    'colleague',
    'family',
  ];

  // calendar state
  calendarOpen = false;
  calYear = new Date().getFullYear();
  calMonth = new Date().getMonth();
  calendarCells: (number | null)[] = [];

  // interaction calendar state
  interactionCalendarOpen = false;
  interactionCalYear = new Date().getFullYear();
  interactionCalMonth = new Date().getMonth();
  interactionCalendarCells: (number | null)[] = [];

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

  constructor(
    private platform: Platform,
    private contactsRepo: ContactRepo,
    private userRepo: UserRepo,
    private identity: UserIdentityService, // ✅ use identity
    private dbInit: DbInitService,
    private db: SqliteDbService
  ) {
    // register icons
    addIcons({
      notificationsOutline,
      shieldCheckmarkOutline,
      personOutline,
      add,
      arrowBack,
      camera,
      briefcaseOutline,
      starOutline,
      callOutline,
      calendarOutline,
      save,
      chatbubblesOutline,
      createOutline,
      paperPlaneOutline,
      chevronDownOutline,
      trash,
    });
  }

  async ngOnInit() {
    try {
      await this.platform.ready();

      // ensure DB/schema
      await this.dbInit.init();
      await this.db.open();

      // get current user from identity service
      await this.identity.ready();
      this.userId = await this.identity.ensureUserId(); // "u_local"

      // (optional) keep userRepo in sync — safe no-op if exists
      await this.userRepo.ensureLocal(this.userId, 'Local User');

      // load contacts
      await this.load();

      // set options for interaction select
      this.contactOptions = this.contacts();
    } catch (err) {
      console.error('[FriendList] Init failed:', err);
      this.loading.set(false);
    }
  }

  // trackBy for ngFor
  trackById(index: number, item: Contact) {
    return item.contact_id;
  }

  initials(name?: string) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return (first + second).toUpperCase();
  }

  avatarColor(name?: string) {
    const palette = [
      '#387ef5',
      '#32db64',
      '#ffce00',
      '#ff6b6b',
      '#8e44ad',
      '#e67e22',
    ];
    if (!name) return palette[0];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
    return palette[Math.abs(h) % palette.length];
  }

  formatBirthday(b?: string | null) {
    if (!b) return '';
    try {
      const d = new Date(b);
      if (isNaN(d.getTime())) return b;
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    } catch {
      return b;
    }
  }

  openEdit(c: Contact) {
    this.editingContactId = c.contact_id ?? null;
    this.newContact = {
      name: c.name ?? '',
      relationship: (c.relationship as Relationship) ?? 'friend',
      contact_detail: c.contact_detail ?? '',
      birthday: c.birthday ?? null,
      notes: c.notes ?? '',
    };
    this.showModal.set(true);
  }

  onCancel() {
    this.showModal.set(false);
    this.editingContactId = null;
    this.newContact = {
      name: '',
      relationship: 'friend',
      contact_detail: '',
      birthday: null,
      notes: '',
    };
  }

  async load(event?: CustomEvent) {
    try {
      this.loading.set(true);
      const list = await this.contactsRepo.listByUser(this.userId);
      this.contacts.set(list);
      this.contactOptions = list;
      this.query.set('');
    } finally {
      this.loading.set(false);
      (event?.target as any)?.complete?.();
    }
  }

  onSearch(ev: any) {
    const v = ev?.detail?.value ?? '';
    this.query.set(v);
  }

  openAddInteraction(contact?: Contact) {
    this.contactOptions = this.contacts();
    if (contact) {
      this.interaction.contact = contact;
    } else if (this.editingContactId) {
      const c = this.contacts().find(
        (x) => x.contact_id === this.editingContactId
      );
      this.interaction.contact = c ?? null;
    } else {
      this.interaction.contact = null;
    }
    this.interaction.topic = '';
    this.interaction.date = this.formatDateToYMD(new Date());
    this.interaction.rawNotes = '';
    this.showInteractionModal.set(true);
  }

  private formatDateToYMD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  openAddInteractionForCurrent() {
    const c = this.contacts().find(
      (x) => x.contact_id === this.editingContactId
    );
    this.openAddInteraction(c);
  }

  closeInteraction() {
    this.showInteractionModal.set(false);
  }

  async onGenerateInteraction() {
    try {
      if (!this.interaction.contact) {
        alert('Please choose a contact for this interaction');
        return;
      }
      const interaction_id = (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : 'i-' + Date.now();
      const contact_id = (this.interaction.contact as Contact).contact_id;
      const now = new Date().toISOString();
      const date = this.interaction.date ?? now;

      await this.db.open();
      await this.db.run(
        `INSERT INTO interaction (interaction_id, contact_id, user_id, interaction_date, raw_notes, created_at)
         VALUES (?,?,?,?,?,?)`,
        [
          interaction_id,
          contact_id,
          this.userId,
          date,
          this.interaction.rawNotes ?? '',
          now,
        ]
      );

      try {
        await this.db.saveToStoreAndClose();
      } catch (e) {
        console.warn('[FriendList] interaction save failed', e);
      }

      this.showInteractionModal.set(false);
      alert('Interaction saved');
    } catch (err) {
      console.error('[FriendList] onGenerateInteraction failed', err);
      alert('Failed to save interaction');
    }
  }

  async addSample() {
    try {
      await this.dbInit.init();
      await this.db.open();

      await this.contactsRepo.createMinimal(this.userId, 'New Friend');

      try {
        await this.db.saveToStoreAndClose();
      } catch (e) {
        console.warn('[FriendList] save failed', e);
      }

      await this.load();
    } catch (err) {
      console.error('[FriendList] Add sample failed:', err);
    }
  }

  async onSubmit() {
    if (!this.newContact.name) return;

    try {
      await this.dbInit.init();
      await this.db.open();

      if (this.editingContactId) {
        await this.contactsRepo.update(this.editingContactId, {
          name: this.newContact.name,
          relationship: this.newContact.relationship as Relationship,
          contact_detail: this.newContact.contact_detail ?? null,
          birthday: this.newContact.birthday ?? null,
          notes: this.newContact.notes ?? null,
        });
      } else {
        await this.contactsRepo.createMinimal(
          this.userId,
          this.newContact.name,
          this.newContact.relationship as Relationship,
          this.newContact.contact_detail ?? '',
          this.newContact.birthday ?? '',
          this.newContact.notes ?? ''
        );
      }

      try {
        await this.db.saveToStoreAndClose();
      } catch (e) {
        console.warn('[FriendList] save failed', e);
      }

      this.showModal.set(false);
      this.editingContactId = null;
      this.newContact = {
        name: '',
        relationship: 'friend',
        contact_detail: '',
        birthday: null,
        notes: '',
      };
      await this.load();
    } catch (err) {
      console.error('Failed to create/update contact:', err);
    }
  }

  // calendar helpers
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

  private buildInteractionCalendar(
    year = this.interactionCalYear,
    month = this.interactionCalMonth
  ) {
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length < 42) cells.push(null);
    this.interactionCalendarCells = cells;
    this.interactionCalYear = year;
    this.interactionCalMonth = month;
  }

  toggleCalendar(open?: boolean) {
    const next = typeof open === 'boolean' ? open : !this.calendarOpen;
    this.calendarOpen = next;
    if (next) {
      if (this.newContact.birthday) {
        const d = new Date(this.newContact.birthday);
        if (!isNaN(d.getTime())) {
          this.buildCalendar(d.getFullYear(), d.getMonth());
          return;
        }
      }
      const now = new Date();
      this.buildCalendar(now.getFullYear(), now.getMonth());
    }
  }

  toggleInteractionCalendar(open?: boolean) {
    const next =
      typeof open === 'boolean' ? open : !this.interactionCalendarOpen;
    this.interactionCalendarOpen = next;
    if (next) {
      if (this.interaction?.date) {
        const d = new Date(this.interaction.date);
        if (!isNaN(d.getTime())) {
          this.buildInteractionCalendar(d.getFullYear(), d.getMonth());
          return;
        }
      }
      const now = new Date();
      this.buildInteractionCalendar(now.getFullYear(), now.getMonth());
    }
  }

  prevInteractionMonth() {
    let m = this.interactionCalMonth - 1;
    let y = this.interactionCalYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    this.buildInteractionCalendar(y, m);
  }

  nextInteractionMonth() {
    let m = this.interactionCalMonth + 1;
    let y = this.interactionCalYear;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    this.buildInteractionCalendar(y, m);
  }

  selectInteractionDay(day: number) {
    const y = this.interactionCalYear;
    const m = String(this.interactionCalMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    this.interaction.date = `${y}-${m}-${d}`;
    this.interactionCalendarOpen = false;
  }

  isSelectedInteractionDay(day: number) {
    if (!this.interaction?.date) return false;
    const dt = new Date(this.interaction.date);
    return (
      dt.getFullYear() === this.interactionCalYear &&
      dt.getMonth() === this.interactionCalMonth &&
      dt.getDate() === day
    );
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
    this.newContact.birthday = `${y}-${m}-${d}`;
    this.calendarOpen = false;
  }

  prevInteractionYear() {
    this.buildInteractionCalendar(
      this.interactionCalYear - 1,
      this.interactionCalMonth
    );
  }

  nextInteractionYear() {
    this.buildInteractionCalendar(
      this.interactionCalYear + 1,
      this.interactionCalMonth
    );
  }

  isSelectedDay(day: number) {
    if (!this.newContact.birthday) return false;
    const d = new Date(this.newContact.birthday);
    return (
      d.getFullYear() === this.calYear &&
      d.getMonth() === this.calMonth &&
      d.getDate() === day
    );
  }

  confirmDelete(ev?: Event) {
    ev?.stopPropagation?.();
    if (!this.editingContactId) return;
    const ok = confirm('Delete this contact? This action cannot be undone.');
    if (ok) {
      this.onDelete();
    }
  }

  onAdd() {
    this.editingContactId = null;
    this.newContact = {
      name: '',
      relationship: 'friend',
      contact_detail: '',
      birthday: null,
      notes: '',
    };
    this.calendarOpen = false;
    this.showInteractionModal.set(false);
    this.showModal.set(true);
    console.log('[FriendList] Add modal opened — ready for new contact');
  }

  async onDelete() {
    if (!this.editingContactId) return;
    try {
      await this.contactsRepo.delete(this.editingContactId);

      try {
        await this.db.saveToStoreAndClose();
      } catch (e) {
        console.warn('[FriendList] save failed after delete', e);
      }

      this.showModal.set(false);
      this.editingContactId = null;
      this.newContact = {
        name: '',
        relationship: 'friend',
        contact_detail: '',
        birthday: null,
        notes: '',
      };
      await this.load();
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  }
}
