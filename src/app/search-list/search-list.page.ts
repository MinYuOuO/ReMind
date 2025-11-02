import {
  Component,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
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
  IonLabel,
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
  settingsOutline,
  mailOutline,
  sparklesOutline,
  lockClosedOutline,
  informationCircleOutline,
} from 'ionicons/icons';

import { ContactRepo, Contact } from '../core/repos/contact.repo';
import { UserIdentityService } from '../core/services/user-identity.service';
import { AiService } from '../core/services/ai.service';
import { DbInitService } from '../core/services/db-inti.service';
import { SqliteDbService } from '../core/services/db.service';

import { Router } from '@angular/router';
import { AiSettingService } from '../core/services/ai-setting.service';

addIcons({
  arrowBack,
  notificationsOutline,
  shieldCheckmarkOutline,
  personOutline,
  chevronDownOutline,
  reorderThreeOutline,
  paperPlaneOutline,
  settingsOutline,
  mailOutline,
  sparklesOutline,
  lockClosedOutline,
  informationCircleOutline,
});

interface InsightRow {
  insight_id: string;
  contact_id: string;
  user_id: string;
  insight_type: string;
  content: string;
  generated_at: string;
  relevant_until?: string | null;
  is_actionable: number;
  contact_name?: string; // joined field
}

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
    IonLabel,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
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

  // history of insights
  insights = signal<InsightRow[]>([]);

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
    private aiSetting: AiSettingService,
    private dbInit: DbInitService,
    private db: SqliteDbService,
    private router: Router
  ) {
      addIcons({arrowBack,notificationsOutline,shieldCheckmarkOutline,sparklesOutline,personOutline,chevronDownOutline,reorderThreeOutline,paperPlaneOutline});}

  async ngOnInit() {
    // make sure DB and user are ready
    await this.dbInit.init();
    await this.identity.ready();
    this.userId = await this.identity.ensureUserId();

    // load contacts for the selector
    const list = await this.contactRepo.listByUser(this.userId);
    this.contacts.set(list);

    // load history
    await this.loadInsights();
  }

  private async loadInsights() {
    // join insight + contact to show name
    const rows = await this.db.query<InsightRow>(
      `
      SELECT
        i.*,
        c.name AS contact_name
      FROM insight i
      LEFT JOIN contact c ON c.contact_id = i.contact_id
      WHERE i.user_id = ?
      ORDER BY i.generated_at DESC
      LIMIT 50
      `,
      [this.userId]
    );
    this.insights.set(rows);
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
    const question = (this.question || this.keyword || '').trim();
    if (!question) {
      alert('Please enter a question about your friend.');
      return;
    }

    const contact = this.selectedContact;
    if (!contact) {
      alert('Please select a contact.');
      return;
    }

    const configured = await this.aiSetting.isConfigured();
    if (!configured) {
      const go = confirm('AI is not set up yet. Go to AI Settings now?');
      if (go) {
        // navigate to SettingsPage AI section
        this.router.navigate(['/settings'], { queryParams: { tab: 'ai' } });
      }
      return;
    }

    this.loading.set(true);
    this.aiAnswer.set('');

    try {
      const insightId = await this.ai.generatePersonInsight({
        contact_id: contact.contact_id,
        user_id: this.userId,
        type: 'suggestion',
        question: question,
        actionable: 1,
      });

      if (insightId) {
        this.aiAnswer.set(
          'Insight generated and saved. Check your insights page.'
        );
        await this.loadInsights();
      }
    } catch (err) {
      console.error('[RSearch] AI send failed:', err);
      this.aiAnswer.set('Failed to generate insight.');
    } finally {
      this.loading.set(false);
    }
  }

  // open from history → go to search view and prefill
  openFromHistory(row: InsightRow) {
    this.view = 'search';
    this.aiAnswer.set(row.content);
    this.question = ''; // we can leave it empty or reconstruct a prompt
    // try to select the contact (so user can send follow-up about same person)
    if (row.contact_id) {
      const c = this.contacts().find((x) => x.contact_id === row.contact_id);
      if (c) {
        this.selectedContact = c;
      }
    }
  }

  // helper for template display
  contactLabel(c: Contact): string {
    if (!c) return '';
    const rel = c.relationship ? ` (${c.relationship})` : '';
    return c.name + rel;
  }

  trackByInsight(index: number, item: InsightRow) {
    return item.insight_id;
  }
}
