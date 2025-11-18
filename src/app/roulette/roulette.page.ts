import { Component, OnInit, ViewEncapsulation, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
  IonTextarea,
  IonChip,
  IonSpinner,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubblesOutline,
  arrowBack,
  personOutline,
  sparklesOutline,
} from 'ionicons/icons';

import { AiService } from '../core/services/ai.service';
import {
  RouletteService,
  PersonalizedSuggestion,
} from '../core/services/roulette.service';
import { ContactRepo, Contact } from '../core/repos/contact.repo';
import { UserIdentityService } from '../core/services/user-identity.service';
import { DbInitService } from '../core/services/db-inti.service';
import { AiSettingService } from '../core/services/ai-setting.service';

@Component({
  selector: 'app-roulette',
  standalone: true,
  templateUrl: 'roulette.page.html',
  styleUrls: ['roulette.page.scss'],
  encapsulation: ViewEncapsulation.None,
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
    IonTextarea,
    IonChip,
    IonSpinner,
    IonSelect,
    IonSelectOption,
  ], schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class RoulettePage implements OnInit {
  view: 'ask' | 'roll' = 'ask';
  question = '';
  isGenerating = false;

  contacts: Contact[] = [];
  selectedContact: Contact | null = null;
  userId = '';

  // Wheel data
  options: string[] = [];
  personalizedSuggestions: PersonalizedSuggestion[] = [];
  private segmentAngle = 45; // will reset when options are set
  isSpinning = false;
  resultText = '';
  selectedIndex = -1;
  spinDegrees = 0;
  transitionStyle = 'transform 2.8s cubic-bezier(.2,.75,.2,1)';

  constructor(
    private aiService: AiService,
    private rouletteService: RouletteService,
    private contactRepo: ContactRepo,
    private identity: UserIdentityService,
    private dbInit: DbInitService,
    private aiSetting: AiSettingService
  ) {
    addIcons({
      chatbubblesOutline,
      arrowBack,
      personOutline,
      sparklesOutline,
    });
  }

  async ngOnInit() {
    // 初始化数据库和用户
    await this.dbInit.init();
    await this.identity.ready();
    this.userId = await this.identity.ensureUserId();

    // 加载联系人列表
    this.contacts = await this.contactRepo.listByUser(this.userId);
  }

  goBack() {
    this.view = 'ask';
  }

  toTwoLine(s: string): string {
    const clean = (s || '').trim().replace(/\s+/g, ' ');
    const i = clean.indexOf(' ');
    if (i > 0 && i < clean.length - 1)
      return clean.slice(0, i) + '<br>' + clean.slice(i + 1);
    return clean;
  }

  /** Click: Use default options quickly */
  useDefaults() {
    this.setOptions([
      'Coffee Shop',
      'Cinema',
      'Restaurant',
      'Shopping Mall',
      'Beach',
      'Karaoke',
      'Picnic Park',
      'Night Market',
    ]);
    this.view = 'roll';
  }

  private async ensureAiProviderConfigured(): Promise<'ready' | 'none'> {
    const s = await this.aiSetting.getActive();
    if (s.provider === 'openai' && s.apiKey?.trim()) {
      this.aiService.useOpenAI(s.apiKey, s.model || 'gpt-4o-mini');
      return 'ready';
    }
    if (s.provider === 'deepseek' && s.apiKey?.trim()) {
      this.aiService.useDeepSeek(s.apiKey, s.model || 'deepseek-chat');
      return 'ready';
    }
    // leave provider unset => AiService will return null
    return 'none';
  }

  async generateWithAI() {
    await this.ensureAiProviderConfigured();
    
    // Validation
    if (!this.selectedContact) {
      alert('Please select a contact to generate personalized suggestions.');
      return;
    }

    const configured = await this.aiSetting.isConfigured();
    if (!configured) {
      const go = confirm('AI is not configured. Go to settings?');
      if (go) {
        // Navigate to settings page
        // this.router.navigate(['/settings']);
        return;
      }
      // Fallback to defaults if user declines
      this.useDefaults();
      return;
    }

    this.isGenerating = true;

    try {
      // ONLY call RouletteService - it handles AI internally
      // IMPORTANT: Pass the user's question so AI can answer it!
      const userQuestion = (this.question || '').trim();

      this.personalizedSuggestions =
        await this.rouletteService.getPersonalizedSuggestions(
          this.selectedContact.contact_id,
          8,
          userQuestion // Pass the question here!
        );

      // Extract suggestion text for the wheel
      const suggestions = this.personalizedSuggestions.map((s) => s.suggestion);

      // Validate we got suggestions
      if (suggestions.length === 0) {
        throw new Error('No suggestions generated');
      }

      this.setOptions(suggestions);
      this.view = 'roll';

    } catch (error) {
      console.error('AI-generated suggestions failed:', error);

      // Better error handling with specific messages
      if (error instanceof Error) {
        if (error.message.includes('not configured')) {
          alert('AI service is not properly configured. Please check your settings.');
        } else if (error.message.includes('No JSON')) {
          alert('AI returned invalid response. Please try again or use default options.');
        } else {
          alert(`Failed to generate personalized suggestions: ${error.message}`);
        }
      } else {
        alert('Failed to generate personalized suggestions. Using default options instead.');
      }

      this.useDefaults();
    } finally {
      this.isGenerating = false;
    }
  }

  /** Replace with your real AI call; must resolve to an array of strings */
  async generateGenericWithAI() {
    // Check AI configuration
    await this.ensureAiProviderConfigured();
    const configured = await this.aiSetting.isConfigured();
    if (!configured) {
      const go = confirm('AI is not configured. Go to settings?');
      if (go) {
        // Navigate to settings
        return;
      }
      this.useDefaults();
      return;
    }

    // Reset personalized suggestions since we're doing generic
    this.personalizedSuggestions = [];

    this.isGenerating = true;

    try {
      // ONLY call RouletteService - never AiService directly!
      // RouletteService should have a method for generic suggestions too
      const suggestions = await this.rouletteService.getGenericAISuggestions(8);

      if (!suggestions || suggestions.length === 0) {
        throw new Error('No suggestions returned');
      }

      this.setOptions(suggestions);
      this.view = 'roll';

    } catch (error) {
      console.error('Failed to generate generic suggestions:', error);
      alert('Failed to generate suggestions. Using default options instead.');
      this.useDefaults();
    } finally {
      this.isGenerating = false;
    }
  }

  /** Normalize to exactly 8 unique labels and reset angles */
  private setOptions(list: string[]) {
    const cleaned = (list || [])
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .filter(
        (v, i, a) =>
          a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i
      );

    // Ensure exactly 8 by trimming/padding with sensible defaults
    const defaults = [
      'Coffee Shop',
      'Cinema',
      'Restaurant',
      'Shopping Mall',
      'Beach',
      'Karaoke',
      'Picnic Park',
      'Night Market',
    ];
    while (cleaned.length < 8)
      cleaned.push(defaults[cleaned.length % defaults.length]);
    this.options = cleaned.slice(0, 8);

    this.segmentAngle = 360 / this.options.length;
    this.resultText = '';
    this.selectedIndex = -1;
  }

  /** Spin controls */
  startRoll() {
    if (!this.options.length) {
      this.useDefaults();
    }
    if (this.isSpinning) return;

    this.isSpinning = true;
    this.resultText = '';

    // Random number of extra degrees (0-360) for variety
    const randomDegrees = Math.random() * 360;

    // Spin 5-8 full rotations plus the random amount
    const extraTurns = 5 + Math.floor(Math.random() * 3);
    const totalSpin = extraTurns * 360 + randomDegrees;

    this.spinDegrees = this.spinDegrees + totalSpin;

    // Don't calculate selectedIndex here - we'll calculate it based on final position
    this.selectedIndex = -1;

    // safety fallback
    window.setTimeout(() => {
      if (this.isSpinning) this.finishSpin();
    }, 3000);
  }

  onSpinEnd(evt: TransitionEvent) {
    const el = evt.target as HTMLElement;
    if (!el || !el.classList.contains('wheel')) return;
    this.finishSpin();
  }

  private finishSpin() {
    this.isSpinning = false;

    // Normalize the rotation to 0-360 range
    let normalizedDegrees = this.spinDegrees % 360;
    if (normalizedDegrees < 0) normalizedDegrees += 360;

    // The pointer is at the bottom (270 degrees)
    // Each segment is 45 degrees (360 / 8)
    // Segments start with index 0 at 0 degrees and go clockwise
    // With the 22.5 degree offset, segment 0 is centered at 22.5 degrees

    // Calculate where 270 degrees (bottom pointer) lands after rotation
    const pointerPosition = (270 - normalizedDegrees + 360) % 360;

    // Find which segment this position falls into
    // Subtract 22.5 to account for the offset, then divide by segment size
    let segmentIndex = Math.floor(
      ((pointerPosition + 360 - 22.5) % 360) / this.segmentAngle
    );

    this.selectedIndex = segmentIndex % this.options.length;
    this.resultText = this.options[this.selectedIndex] ?? '';

    // Debug logging - remove this after testing
    console.log('Spin degrees:', this.spinDegrees);
    console.log('Normalized:', normalizedDegrees);
    console.log('Pointer position:', pointerPosition);
    console.log('Selected index:', this.selectedIndex);
    console.log('Result:', this.resultText);

    try {
      navigator.vibrate?.(20);
    } catch { }
  }

  contactLabel(c: Contact): string {
    if (!c) return '';
    const rel = c.relationship ? ` (${c.relationship})` : '';
    return c.name + rel;
  }

  getConfidenceDisplay(suggestion: PersonalizedSuggestion): string {
    return `${Math.round(suggestion.confidence * 100)}% match`;
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      communication: '💬',
      activity: '🎯',
      gesture: '🎁',
      follow_up: '🔄',
    };
    return icons[category] || '✨';
  }
}