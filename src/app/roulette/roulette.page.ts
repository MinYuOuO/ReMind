import { Component, ViewEncapsulation } from '@angular/core';
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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chatbubblesOutline, arrowBack } from 'ionicons/icons';

addIcons({
  chatbubblesOutline,
  arrowBack,
});

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
  ],
})
export class RoulettePage {
  view: 'ask' | 'roll' = 'ask';
  question = '';
  isGenerating = false;

  // Wheel data
  options: string[] = [];
  private segmentAngle = 45; // will reset when options are set
  isSpinning = false;
  resultText = '';
  selectedIndex = -1;
  spinDegrees = 0;
  transitionStyle = 'transform 2.8s cubic-bezier(.2,.75,.2,1)';

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
    if (!prompt) {
      this.useDefaults();
      return;
    }

    this.isGenerating = true;
    try {
      const ideas = await this.aiSuggestOptions(prompt);
      this.setOptions(ideas);
      this.view = 'roll';
    } catch (e) {
      console.warn('AI fallback used:', e);
      this.useDefaults();
    } finally {
      this.isGenerating = false;
    }
  }

  /** Replace with your real AI call; must resolve to an array of strings */
  private async aiSuggestOptions(prompt: string): Promise<string[]> {
    // TODO: plug in your backend call here.
    // For now, return themed, deterministic-ish suggestions:
    const base = [
      'Coffee Shop',
      'Cinema',
      'Restaurant',
      'Shopping Mall',
      'Beach',
      'Karaoke',
      'Picnic Park',
      'Night Market',
      'Board Games',
      'Art Museum',
      'Live Music',
      'Bowling',
    ];
    // simple shuffle influenced by prompt length
    const rnd = Math.max(3, Math.min(9, prompt.length % 10));
    const shuffled = [...base].sort(
      (a, b) => ((a.charCodeAt(0) + rnd) % 7) - ((b.charCodeAt(0) + rnd) % 7)
    );
    return shuffled.slice(0, 8);
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

    const i = Math.floor(Math.random() * this.options.length);
    this.selectedIndex = i;

    const center = i * this.segmentAngle + this.segmentAngle / 2;
    const extraTurns = 5; // nice pace
    const delta = 360 - center;

    this.spinDegrees = this.spinDegrees + extraTurns * 360 + delta;

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
    this.resultText = this.options[this.selectedIndex] ?? '';
    try {
      navigator.vibrate?.(20);
    } catch {}
  }
}
