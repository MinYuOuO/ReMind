import { Component, OnInit, signal } from '@angular/core';
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
  IonItem,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonList,
  IonInput,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  arrowBack,
  notificationsOutline,
  shieldCheckmarkOutline,
  personOutline,
  chevronDownOutline,
  reorderThreeOutline,
  paperPlaneOutline,
} from 'ionicons/icons';

import { ContactRepo, Contact } from '../core/repos/contact.repo';
import { UserIdentityService } from '../core/services/user-identity.service';
import { AiService } from '../core/services/ai.service';
import { DbInitService } from '../core/services/db-inti.service';

addIcons({
  arrowBack,
  notificationsOutline,
  shieldCheckmarkOutline,
  personOutline,
  chevronDownOutline,
  reorderThreeOutline,
  paperPlaneOutline,
});

@Component({
  selector: 'app-search-list',
  standalone: true,
  templateUrl: 'search-list.page.html',
  styleUrls: ['search-list.page.scss'],
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
    IonItem,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonList,
    IonInput,
  ],
})
export class RSearchPage implements OnInit {
  // UI view switch
  view: 'list' | 'search' = 'list';

  // form models
  keyword = '';
  question = '';

  // actual contact we select
  selectedContact: Contact | null = null;

  // loaded contacts
  contacts = signal<Contact[]>([]);

  // current user id
  userId = '';

  // show loading when calling AI
  loading = signal(false);

  // response from AI (we can show under the form)
  aiAnswer = signal<string>('');

  constructor(
    private contactRepo: ContactRepo,
    private identity: UserIdentityService,
    private ai: AiService,
    private dbInit: DbInitService
  ) {
      addIcons({arrowBack,notificationsOutline,shieldCheckmarkOutline,personOutline,chevronDownOutline,reorderThreeOutline,paperPlaneOutline});}

  async ngOnInit() {
    // make sure DB and user are ready
    await this.dbInit.init();
    await this.identity.ready();
    this.userId = await this.identity.ensureUserId();

    // load contacts for the selector
    const list = await this.contactRepo.listByUser(this.userId);
    this.contacts.set(list);
  }

  hasQuery() {
    return (this.keyword?.trim()?.length ?? 0) > 0;
  }

  // user typed in "Ask for anything..." → go to search view
  openSearch() {
    if (this.hasQuery()) {
      this.question = this.keyword.trim();
      this.view = 'search';
      this.aiAnswer.set('');
    }
  }

  goBack() {
    this.view = 'list';
    this.aiAnswer.set('');
    this.keyword = '';
    this.question = '';
  }

  async send() {
    // 1. basic validation
    const question = (this.question || this.keyword || '').trim();
    if (!question) {
      alert('Please enter a question about your friend.');
      return;
    }

    // 2. resolve contact_id (optional)
    const contact = this.selectedContact;
    if (!contact) {
      alert('Please select a contact.');
      return;
    }

    this.loading.set(true);
    this.aiAnswer.set('');

    try {
      // 3. call the AI → this will INSERT into insight table
      const insightId = await this.ai.generatePersonInsight({
        contact_id: contact.contact_id,
        user_id: this.userId,
        type: 'suggestion',   // or 'pattern' / 'reminder'
        question: question,
        actionable: 1,
      });

      // 4. for UI: we can just display a friendly confirmation
      if (insightId) {
        // we didn’t fetch back from DB — just tell user it’s saved
        this.aiAnswer.set('Insight generated and saved. Check your insights page.');
      } else {
        this.aiAnswer.set('AI is not configured yet. Please set API key in AI Settings.');
      }
    } catch (err) {
      console.error('[RSearch] AI send failed:', err);
      this.aiAnswer.set('Failed to generate insight.');
    } finally {
      this.loading.set(false);
    }
  }

  // helper for template display
  contactLabel(c: Contact): string {
    if (!c) return '';
    const rel = c.relationship ? ` (${c.relationship})` : '';
    return c.name + rel;
  }
}
