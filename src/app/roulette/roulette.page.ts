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

  /** Click: Generate with AI (stubbed; replace with your API) */
  async generateWithAI() {
    const prompt = (this.question || '').trim();

    if (!this.selectedContact) {
      alert('Please select a person');
      return;
    }

    // 检查 AI 配置
    const configured = await this.aiSetting.isConfigured();
    if (!configured) {
      const go = confirm('AI is not configured, go to setting?');
      if (go) {
        // 这里可以导航到设置页面
        return;
      }
      this.useDefaults();
      return;
    }

    this.isGenerating = true;

    try {
      // 使用 RouletteService 生成个性化建议
      this.personalizedSuggestions =
        await this.rouletteService.getPersonalizedSuggestions(
          this.selectedContact.contact_id,
          8
        );

      // 提取建议文本
      const suggestions = this.personalizedSuggestions.map((s) => s.suggestion);
      this.setOptions(suggestions);
    } catch (error) {
      console.error('AI-generated suggestions failed.:', error);
      // 回退到默认选项
      this.useDefaults();
    } finally {
      this.isGenerating = false;
    }
  }

  /** Replace with your real AI call; must resolve to an array of strings */
  async generateGenericWithAI() {
    const prompt = (this.question || '').trim();
    if (!prompt) {
      this.useDefaults();
      return;
    }

    this.isGenerating = true;

    try {
      // use AiService generate general suggestions
      const result = await this.aiService.generateRouletteSuggestions(8);
      this.setOptions(result.suggestions);
    } catch (error) {
      console.error('AI failed to generate general suggestions:', error);
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
    } catch {}
  }

  contactLabel(c: Contact): string {
    if (!c) return '';
    const rel = c.relationship ? ` (${c.relationship})` : '';
    return c.name + rel;
  }

  getConfidenceDisplay(suggestion: PersonalizedSuggestion): string {
    return `${Math.round(suggestion.confidence * 100)}%匹配`;
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
