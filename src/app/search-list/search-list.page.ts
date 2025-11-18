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
  IonSearchbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonBadge,
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
  searchOutline,
  closeCircleOutline,
} from 'ionicons/icons';

import { ContactRepo, Contact } from '../core/repos/contact.repo';
import { UserIdentityService } from '../core/services/user-identity.service';
import { AiService } from '../core/services/ai.service';
import { DbInitService } from '../core/services/db-inti.service';
import { SqliteDbService } from '../core/services/db.service';
import { RSearchService, SearchResult } from '../core/services/rsearch.service';
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
  searchOutline,
  closeCircleOutline,
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
  contact_name?: string;
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
    IonSearchbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonBadge,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class RSearchPage implements OnInit {
  // UI view switch
  view: 'list' | 'search' | 'results' | 'ai-question' = 'list';

  // Form models
  keyword = '';
  question = '';
  searchTerm = '';

  // Search state
  searchResults = signal<SearchResult[]>([]);
  isSearching = signal(false);
  hasSearched = signal(false);

  // Selected contact
  selectedContact: Contact | null = null;

  // Loaded contacts
  contacts = signal<Contact[]>([]);

  // History of insights - PERSISTED
  insights = signal<InsightRow[]>([]);

  // Current user id
  userId = '';

  // Loading state for AI generation
  loading = signal(false);

  // AI response
  aiAnswer = signal<string>('');

  constructor(
    private contactRepo: ContactRepo,
    private identity: UserIdentityService,
    private ai: AiService,
    private aiSetting: AiSettingService,
    private dbInit: DbInitService,
    private db: SqliteDbService,
    private router: Router,
    private rsearchService: RSearchService
  ) {
      addIcons({arrowBack,searchOutline,notificationsOutline,shieldCheckmarkOutline,sparklesOutline,personOutline,chevronDownOutline,reorderThreeOutline,paperPlaneOutline});}

  async ngOnInit() {
    // Initialize database and user
    await this.dbInit.init();
    await this.identity.ready();
    this.userId = await this.identity.ensureUserId();

    // Load contacts for the selector
    const list = await this.contactRepo.listByUser(this.userId);
    this.contacts.set(list);

    // Load insights history (FIXED: this now properly loads from DB)
    await this.loadInsights();
  }

  /**
   * Load insights from database - FIXED VERSION
   * This properly retrieves persisted data
   */
  private async loadInsights() {
    try {
      const rows = await this.db.query<InsightRow>(
        `SELECT
          i.insight_id,
          i.contact_id,
          i.user_id,
          i.insight_type,
          i.content,
          i.generated_at,
          i.relevant_until,
          i.is_actionable,
          c.name AS contact_name
        FROM insight i
        LEFT JOIN contact c ON c.contact_id = i.contact_id
        WHERE i.user_id = ?
        ORDER BY i.generated_at DESC
        LIMIT 50`,
        [this.userId]
      );
      
      console.log('Loaded insights from DB:', rows.length);
      this.insights.set(rows);
    } catch (error) {
      console.error('Failed to load insights:', error);
      this.insights.set([]);
    }
  }

  /**
   * SEARCH FUNCTIONALITY - Trigger search on Enter or button click
   */
  async onSearch() {
    const term = this.searchTerm.trim();
    
    if (!term) {
      this.clearSearch();
      return;
    }

    this.isSearching.set(true);
    this.hasSearched.set(true);

    try {
      const results = await this.rsearchService.searchByCognitivePatterns(term);
      this.searchResults.set(results);
      
      if (results.length > 0) {
        this.view = 'results';
      } else {
        alert(`No contacts found matching "${term}". Try different keywords.`);
        this.view = 'list';
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  /**
   * Advanced search with filters
   */
  async onAdvancedSearch() {
    const filters = {
      personality_traits: ['extroverted', 'optimistic'],
      interests: ['technology', 'reading'],
      communication_style: ['direct'],
      min_confidence: 3,
    };

    this.isSearching.set(true);
    this.hasSearched.set(true);

    try {
      const results = await this.rsearchService.advancedSearch(filters);
      this.searchResults.set(results);
      
      if (results.length > 0) {
        this.view = 'results';
      } else {
        alert('No contacts match the selected filters.');
        this.view = 'list';
      }
    } catch (error) {
      console.error('Advanced search error:', error);
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  /**
   * View contact details from search result
   */
  async viewContactDetails(result: SearchResult) {
    try {
      const details = await this.rsearchService.getContactDetails(result.contact_id);
      
      if (!details) {
        alert('Could not load contact details.');
        return;
      }

      // Show details in alert (you can create a modal later)
      const summary = await this.rsearchService.getCognitiveSummary(result.contact_id);
      
      let message = `${details.contact.name}\n\n`;
      
      if (summary.traits.length > 0) {
        message += `Traits: ${summary.traits.slice(0, 3).join(', ')}\n\n`;
      }
      
      if (summary.interests.length > 0) {
        message += `Interests: ${summary.interests.slice(0, 3).join(', ')}\n\n`;
      }
      
      if (summary.communication.length > 0) {
        message += `Communication: ${summary.communication.slice(0, 2).join(', ')}\n\n`;
      }
      
      message += `Total Interactions: ${details.recentInteractions.length}`;
      
      alert(message);
    } catch (error) {
      console.error('View contact details error:', error);
      alert('Failed to load contact details.');
    }
  }

  /**
   * Clear search and return to list
   */
  clearSearch() {
    this.searchTerm = '';
    this.searchResults.set([]);
    this.hasSearched.set(false);
    this.view = 'list';
  }

  /**
   * Check if there's a query in the keyword field
   */
  hasQuery() {
    return (this.keyword?.trim()?.length ?? 0) > 0;
  }

  /**
   * Open AI question view from main search bar
   */
  openSearch() {
    if (this.hasQuery()) {
      this.question = this.keyword.trim();
      this.view = 'ai-question';
      this.aiAnswer.set('');
    }
  }

  /**
   * Open search mode for cognitive pattern search
   */
  openCognitiveSearch() {
    this.view = 'search';
    this.searchTerm = '';
    this.searchResults.set([]);
  }

  /**
   * Go back to list view
   */
  goBack() {
    this.view = 'list';
    this.aiAnswer.set('');
    this.keyword = '';
    this.question = '';
    this.clearSearch();
  }

  /**
   * Send AI question - FIXED: Properly saves to database
   */
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
        this.router.navigate(['/settings'], { queryParams: { tab: 'ai' } });
      }
      return;
    }

    this.loading.set(true);
    this.aiAnswer.set('');

    try {
      // Generate insight and save to database
      const insightId = await this.ai.generatePersonInsight({
        contact_id: contact.contact_id,
        user_id: this.userId,
        type: 'suggestion',
        question: question,
        actionable: 1,
      });

      if (insightId) {
        // Fetch the newly created insight to display it
        const newInsight = await this.db.query<InsightRow>(
          `SELECT
            i.insight_id,
            i.contact_id,
            i.user_id,
            i.insight_type,
            i.content,
            i.generated_at,
            i.relevant_until,
            i.is_actionable,
            c.name AS contact_name
          FROM insight i
          LEFT JOIN contact c ON c.contact_id = i.contact_id
          WHERE i.insight_id = ?`,
          [insightId]
        );

        if (newInsight && newInsight.length > 0) {
          this.aiAnswer.set(newInsight[0].content);
        } else {
          this.aiAnswer.set('Insight generated and saved successfully.');
        }

        // Reload insights list to show the new one
        await this.loadInsights();
      } else {
        this.aiAnswer.set('Failed to generate insight.');
      }
    } catch (err) {
      console.error('[RSearch] AI send failed:', err);
      this.aiAnswer.set('Failed to generate insight. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Open insight from history
   */
  openFromHistory(row: InsightRow) {
    this.view = 'ai-question';
    this.aiAnswer.set(row.content);
    this.question = row.content; // Show the insight as context
    
    // Try to select the contact
    if (row.contact_id) {
      const c = this.contacts().find((x) => x.contact_id === row.contact_id);
      if (c) {
        this.selectedContact = c;
      }
    }
  }

  /**
   * Helper for contact display
   */
  contactLabel(c: Contact): string {
    if (!c) return '';
    const rel = c.relationship ? ` (${c.relationship})` : '';
    return c.name + rel;
  }

  /**
   * Track by functions for performance
   */
  trackByInsight(index: number, item: InsightRow) {
    return item.insight_id;
  }

  trackBySearchResult(index: number, item: SearchResult) {
    return item.contact_id;
  }

  /**
   * Get color for search result score
   */
  getScoreColor(score: number): string {
    if (score >= 80) return 'success';
    if (score >= 50) return 'warning';
    if (score >= 20) return 'medium';
    return 'light';
  }

  /**
   * Format matched patterns for display
   */
  formatMatchedPatterns(patterns: string[]): string {
    if (!patterns || patterns.length === 0) {
      return 'No specific patterns matched';
    }
    return patterns.slice(0, 3).join(' • ');
  }
}