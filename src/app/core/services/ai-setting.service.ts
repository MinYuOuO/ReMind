import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { AiService } from './ai.service';

export type AiProviderType = 'openai' | 'deepseek' | null;

export interface AiSettings {
  provider: AiProviderType;
  apiKey: string | null;
  model?: string | null;
}

// Key for storage in Preferences
const STORAGE_KEY = 'ai_settings_v1';

@Injectable({ providedIn: 'root' })
export class AiSettingService {
  private current: AiSettings = { provider: null, apiKey: null, model: null };

  constructor(private ai: AiService) {}

  // ---------------------------------------------------------------------------
  // 1. Load + Apply Settings
  // ---------------------------------------------------------------------------

  /** Load AI settings from Preferences and initialize AiService accordingly. */
  async init(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value) {
        this.current = JSON.parse(value);
        await this.applyProvider();
        console.log('[AI Settings] Loaded and applied:', this.current);
      } else {
        console.log('[AI Settings] No saved provider; using default (none)');
      }
    } catch (err) {
      console.warn('[AI Settings] Failed to load settings', err);
    }
  }

  /** Apply the current provider and key to AiService */
  private async applyProvider(): Promise<void> {
    const { provider, apiKey, model } = this.current;
    if (!provider || !apiKey) return;

    switch (provider) {
      case 'openai':
        this.ai.useOpenAI(apiKey, model || 'gpt-4o-mini');
        break;
      case 'deepseek':
        this.ai.useDeepSeek(apiKey, model || 'deepseek-chat');
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Update Settings
  // ---------------------------------------------------------------------------

  /**
   * Update provider and API key.
   * Automatically applies new provider to AiService and persists it securely.
   */
  async updateSettings(newSettings: Partial<AiSettings>): Promise<void> {
    this.current = { ...this.current, ...newSettings };

    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(this.current),
    });

    await this.applyProvider();
    console.log('[AI Settings] Updated & applied:', this.current);
  }

  /** Quick helper to switch to OpenAI provider */
  async useOpenAI(apiKey: string, model = 'gpt-4o-mini'): Promise<void> {
    await this.updateSettings({ provider: 'openai', apiKey, model });
  }

  /** Quick helper to switch to DeepSeek provider */
  async useDeepSeek(apiKey: string, model = 'deepseek-chat'): Promise<void> {
    await this.updateSettings({ provider: 'deepseek', apiKey, model });
  }

  // ---------------------------------------------------------------------------
  // 3. Accessors
  // ---------------------------------------------------------------------------

  get provider(): AiProviderType {
    return this.current.provider;
  }

  get model(): string | null | undefined {
    return this.current.model;
  }

  get apiKey(): string | null {
    return this.current.apiKey;
  }

  async clear(): Promise<void> {
    await Preferences.remove({ key: STORAGE_KEY });
    this.current = { provider: null, apiKey: null, model: null };
    console.log('[AI Settings] Cleared');
  }
}