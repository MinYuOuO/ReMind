import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const KEY_AI_SETTINGS = 'remind.ai.settings';

export type AiProviderName = 'openai' | 'deepseek' | 'none';

export interface AiSettings {
  provider: AiProviderName;
  apiKey: string;
  model: string;
  // future: temperature, maxTokens, etc.
}

const DEFAULT_SETTINGS: AiSettings = {
  provider: 'none',
  apiKey: '',
  model: 'gpt-4o-mini', // default for openai
};

@Injectable({ providedIn: 'root' })
export class AiSettingService {
  private _cache: AiSettings | null = null;

  /** load settings from storage (or return cached) */
  async load(): Promise<AiSettings> {
    if (this._cache) return this._cache;
    const stored = await Preferences.get({ key: KEY_AI_SETTINGS });
    if (stored.value) {
      try {
        const parsed = JSON.parse(stored.value) as AiSettings;
        this._cache = { ...DEFAULT_SETTINGS, ...parsed };
        return this._cache;
      } catch {
        this._cache = { ...DEFAULT_SETTINGS };
        return this._cache;
      }
    }
    // nothing stored
    this._cache = { ...DEFAULT_SETTINGS };
    return this._cache;
  }

  /** save and update cache */
  async save(next: Partial<AiSettings>): Promise<AiSettings> {
    const current = this._cache ? { ...this._cache } : { ...DEFAULT_SETTINGS };
    const merged: AiSettings = {
      ...current,
      ...next,
    };
    await Preferences.set({
      key: KEY_AI_SETTINGS,
      value: JSON.stringify(merged),
    });
    this._cache = merged;
    return merged;
  }

  /** helper for other services: get current provider ready to use */
  async getActive(): Promise<AiSettings> {
    return this.load();
  }

  /** quick check used by pages: is AI ready? */
  async isConfigured(): Promise<boolean> {
    const s = await this.load();
    if (s.provider === 'none') return false;
    if (!s.apiKey?.trim()) return false;
    return true;
  }

  /** reset to default */
  async reset(): Promise<void> {
    await Preferences.remove({ key: KEY_AI_SETTINGS });
    this._cache = { ...DEFAULT_SETTINGS };
  }
}