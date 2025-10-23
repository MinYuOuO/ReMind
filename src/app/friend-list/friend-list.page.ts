import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Platform,
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonRefresher, IonRefresherContent,
  IonFab, IonFabButton, IonIcon, IonButtons, IonInput, IonButton,
  IonSelect, IonSelectOption, IonModal, IonDatetime
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add } from 'ionicons/icons';
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
    IonSelect, IonSelectOption, IonModal, IonDatetime
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
    addIcons({ add });
  }

  showModal = signal(false);
  newContact: Partial<Contact> = {
    name: '',
    relationship: 'friend',
    contact_detail: '',
    birthday: null,
    notes: ''
  };
  relationships: Relationship[] = ['friend', 'best_friend', 'colleague', 'family'];

  async ngOnInit() {
    try {
      await this.platform.ready();
      await this.identity.ready();
      await this.initUser();
      await this.load();
    } catch (err) {
      console.error('[FriendList] Init failed:', err);
      this.loading.set(false);
    }
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
      // Verify user exists before adding contact
      await this.initUser();
      await this.contactsRepo.createMinimal(this.userId, 'New Friend');
      await this.load();
    } catch (err) {
      console.error('[FriendList] Add sample failed:', err);
    }
  }

  // TODO: navigate to Add/Edit page when you build it
  onAdd() {
    this.showModal.set(true);
  }

  async onSubmit() {
    if (!this.newContact.name) return;

    try {
      // First ensure user exists
      await this.initUser();

      // Then create the contact
      await this.contactsRepo.createMinimal(
        this.userId,
        this.newContact.name,
        this.newContact.relationship as Relationship
      );

      // Reset form and update list
      this.showModal.set(false);
      this.newContact = {
        name: '',
        relationship: 'friend',
        contact_detail: '',
        birthday: null,
        notes: ''
      };
      await this.load();
    } catch (err) {
      console.error('Failed to create contact:', err);
    }
  }
}
