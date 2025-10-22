import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Platform,
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonRefresher, IonRefresherContent,
  IonFab, IonFabButton, IonIcon, IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add } from 'ionicons/icons';
import { UserIdentityService } from '../core/services/user-identity.service';
import { ContactRepo, Contact } from '../core/repos/contact.repo';

@Component({
  selector: 'app-friend-list',
  templateUrl: 'friend-list.page.html',
  styleUrls: ['friend-list.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonContent,
    IonList, IonItem, IonLabel, IonRefresher, IonRefresherContent,
    IonFab, IonFabButton, IonIcon
  ],
})
export class FriendListPage implements OnInit {
  userId = '';
  loading = signal(true);
  contacts = signal<Contact[]>([]);

  constructor(
    private platform: Platform,
    private identity: UserIdentityService,
    private contactsRepo: ContactRepo
  ) {
    addIcons({ add });
  }

  async ngOnInit() {
    await this.platform.ready();
    await this.initUser();
    await this.load();
  }

  private async initUser() {
    this.userId = await this.identity.ensureUserId(); // creates a random id and empty profile on first run
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
    await this.contactsRepo.createMinimal(this.userId, 'New Friend');
    await this.load();
  }

  // TODO: navigate to Add/Edit page when you build it
  onAdd() {
    this.addSample(); // temporary quick add
  }
}
