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
import { LocalNotifications } from '@capacitor/local-notifications';
import { NgModule } from '@angular/core';

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
  sparklesOutline, reorderThreeOutline, closeOutline, saveOutline } from 'ionicons/icons';

import { ContactRepo, Contact, Relationship } from '../core/repos/contact.repo';
import { DbInitService } from '../core/services/db-inti.service';
import { SqliteDbService } from '../core/services/db.service';
import { UserRepo } from '../core/repos/user.repo';
import { UserIdentityService } from '../core/services/user-identity.service';

import { AiService } from '../core/services/ai.service';
import { InteractionRepo } from '../core/repos/interaction.repo';
import {
  CognitiveUnitRepo,
  CognitiveUnit,
} from '../core/repos/cognitive-unit.repo';
import { NotificationService } from '../core/services/notification.service';

import type { InteractionFacts } from '../core/services/ai.service';

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
    IonSearchbar
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FriendListPage implements OnInit {
  // current user
  userId = '';

  // UI state
  loading = signal(true);
  contacts = signal<Contact[]>([]);
  query = signal<string>('');

  aiUnits: CognitiveUnit[] = [];

  // computed filtered contacts
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

  // contact form
  newContact: Partial<Contact> = {
    name: '',
    relationship: 'friend',
    contact_detail: '',
    birthday: null,
    notes: '',
  };

  // editing
  editingContactId: string | null = null;

  // interaction form
  interaction: any = {
    topic: '',
    date: null,
    contact: null,
    rawNotes: '',
  };

  // select options
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

  // interaction calendar
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

  // show AI review screen
  showAiReview = signal(false);

  // last AI output
  lastAiFacts = signal<InteractionFacts | null>(null);

  // last interaction id (for resend)
  lastInteractionId = '';
  lastInteractionContactId = '';

  // Add these properties
  notifications = signal<any[]>([]);
  hasUnreadNotifications = signal(false);

  constructor(
    private platform: Platform,
    private contactsRepo: ContactRepo,
    private userRepo: UserRepo,
    private identity: UserIdentityService,
    private dbInit: DbInitService,
    private db: SqliteDbService,
    private interactionRepo: InteractionRepo,
    private aiService: AiService,
    private cuRepo: CognitiveUnitRepo,
    private notificationService: NotificationService
  ) {
    addIcons({notificationsOutline,shieldCheckmarkOutline,personOutline,add,arrowBack,trash,camera,briefcaseOutline,starOutline,callOutline,calendarOutline,save,chatbubblesOutline,createOutline,paperPlaneOutline,reorderThreeOutline,closeOutline,saveOutline,sparklesOutline,chevronDownOutline,});
  }

  async ngOnInit() {
    try {
      await this.platform.ready();
      await this.dbInit.init();
      await this.db.open();

      await this.identity.ready();
      this.userId = await this.identity.ensureUserId();

      await this.userRepo.ensureLocal(this.userId, 'Local User');

      await this.load();
      this.contactOptions = this.contacts();

      // Schedule all birthday notifications
      await this.notificationService.scheduleBirthdayNotifications();

      // // Add notification tap handler
      // LocalNotifications.addListener('localNotificationActionPerformed', 
      //   (notification) => {
      //     const contactId = notification.notification.extra?.contactId;
      //     if (contactId) {
      //       const contact = this.contacts().find(c => c.contact_id === contactId);
      //       if (contact) {
      //         this.openEdit(contact);
      //       }
      //     }
      // );

      // // Add this after other init code
      // await this.loadNotifications();
    } catch (err) {
      console.error('[FriendList] Init failed:', err);
      this.loading.set(false);
    }
  }

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

  async openEdit(c: Contact) {
    this.editingContactId = c.contact_id ?? null;
    this.newContact = {
      name: c.name ?? '',
      relationship: (c.relationship as Relationship) ?? 'friend',
      contact_detail: c.contact_detail ?? '',
      birthday: c.birthday ?? null,
      notes: c.notes ?? '',
    };

    // load AI notes for this contact
    await this.loadCognitiveUnitsForContact(c.contact_id);

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
    this.aiUnits = []; // clear when closing
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
    this.openAddInteraction(c!);
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

      const contact = this.interaction.contact as Contact;
      const interaction_id = (crypto as any)?.randomUUID
        ? (crypto as any).randomUUID()
        : 'i-' + Date.now();

      const now = new Date().toISOString();
      const date = this.interaction.date ?? now;

      // 1) save interaction
      await this.db.run(
        `INSERT INTO interaction (
        interaction_id,
        contact_id,
        user_id,
        interaction_date,
        context,
        user_summary,
        raw_notes,
        created_at
      ) VALUES (?,?,?,?,?,?,?,?)`,
        [
          interaction_id,
          contact.contact_id,
          this.userId,
          date,
          this.interaction.topic ? 'meeting' : null,
          this.interaction.topic ?? null,
          this.interaction.rawNotes ?? '',
          now,
        ]
      );

      // 2) call AI — now returns facts
      const facts = await this.aiService.summarizeInteractionToFacts({
        interaction_id,
        contact_id: contact.contact_id,
        user_id: this.userId,
        context: 'social',
        user_summary: this.interaction.topic ?? '',
        raw_notes: this.interaction.rawNotes ?? '',
      });

      // 3) close input modal
      this.showInteractionModal.set(false);

      // 4) cache for review screen
      this.lastInteractionId = interaction_id;
      this.lastInteractionContactId = contact.contact_id;
      this.lastAiFacts.set(facts);

      // 5) open review screen
      this.showAiReview.set(true);

      // also refresh AI notes if this contact is currently being edited
      if (this.editingContactId === contact.contact_id) {
        await this.loadCognitiveUnitsForContact(contact.contact_id);
      }
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

      let contactId: string;

      if (this.editingContactId) {
        await this.contactsRepo.update(this.editingContactId, {
          name: this.newContact.name,
          relationship: this.newContact.relationship as Relationship,
          contact_detail: this.newContact.contact_detail ?? null,
          birthday: this.newContact.birthday ?? null,
          notes: this.newContact.notes ?? null,
        });
        contactId = this.editingContactId;
      } else {
        // New contact
        contactId = 'c-' + Date.now(); // Or however you generate IDs
        await this.contactsRepo.createMinimal(
          this.userId,
          this.newContact.name,
          this.newContact.relationship as Relationship,
          this.newContact.contact_detail ?? '',
          this.newContact.birthday ?? '',
          this.newContact.notes ?? ''
        );

        // Notify for new contact
        await this.notificationService.notifyNewContact({
          contact_id: contactId,
          name: this.newContact.name
        });
      }

      // Reschedule all birthday notifications after adding/updating contact
      await this.notificationService.scheduleBirthdayNotifications();

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
      this.aiUnits = [];
      await this.load();
    } catch (err) {
      console.error('Failed to create/update contact:', err);
    }
  }

  // ===== calendar helpers =====

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
    this.aiUnits = [];
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
      this.aiUnits = [];
      await this.load();
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  }

  private async loadCognitiveUnitsForContact(contact_id: string) {
    try {
      this.aiUnits = await this.cuRepo.listByContact(contact_id);
    } catch (e) {
      console.warn('[FriendList] loadCognitiveUnitsForContact failed', e);
      this.aiUnits = [];
    }
  }

  closeAiReview() {
    this.showAiReview.set(false);
    this.lastAiFacts.set(null);
  }

  async acceptAi() {
    // simplest version: just close; data is already in cognitive_unit
    this.closeAiReview();

    // optional: reload right-side notes if editing that contact
    if (this.editingContactId) {
      await this.loadCognitiveUnitsForContact(this.editingContactId);
    }
  }

  async rejectAiAndResend() {
    if (!this.lastInteractionId || !this.lastInteractionContactId) {
      alert('No previous interaction to re-process.');
      return;
    }

    try {
      // get original interaction from repo
      const last = await this.interactionRepo.getById(this.lastInteractionId);
      if (!last) {
        alert('Cannot find original interaction.');
        return;
      }

      const facts = await this.aiService.summarizeInteractionToFacts({
        interaction_id: last.interaction_id,
        contact_id: last.contact_id,
        user_id: last.user_id,
        context: last.context ?? 'social',
        user_summary: last.user_summary ?? '',
        raw_notes: last.raw_notes ?? '',
      });

      this.lastAiFacts.set(facts);

      // reload cognitive units for that contact
      await this.loadCognitiveUnitsForContact(last.contact_id);
    } catch (err) {
      console.error('[FriendList] rejectAiAndResend failed', err);
      alert('Failed to re-generate AI notes.');
    }
  }

  // Add this new test method
  async testNotification() {
    try {
      // First check if we have permission
      const permResult = await LocalNotifications.requestPermissions();
      console.log('Permission result:', permResult);
      
      if (!permResult.display) {
        alert('Please enable notifications in your device settings');
        return;
      }

      const notificationId = Math.floor(Math.random() * 100000);
      
      // Send notification immediately
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: "Test Notification",
            body: "This is a test notification! 📱",
            // Fix: sound should be string or null
            sound: 'notification.wav',
            attachments: undefined,
            actionTypeId: '',
            extra: null
          }
        ]
      });
      
      console.log('Test notification sent!');
    } catch (err) {
      console.error('Failed to send test notification:', err);
      alert('Error: ' + (err as any).message);
    }
  }

  // // Add these new methods
  // async loadNotifications() {
  //   const notifications = await this.notificationService.getNotifications();
  //   this.notifications.set(notifications);
  //   this.hasUnreadNotifications.set(notifications.some(n => !n.read));
  // }

  // async openNotifications(ev: any) {
  //   // Mark notifications as read
  //   await this.notificationService.markAllAsRead();
  //   this.hasUnreadNotifications.set(false);
    
  // }

  async onNotificationClick(notification: any) {
    // Handle notification click - e.g. open relevant contact
    if (notification.contactId) {
      const contact = this.contacts().find(c => c.contact_id === notification.contactId);
      if (contact) {
        this.openEdit(contact);
      }
    }
  }

  // ...rest of existing code...
}
