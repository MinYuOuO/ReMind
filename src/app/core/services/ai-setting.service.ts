import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export interface AiSettings {
  provider: 'openai' | 'deepseek' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  logToDb: boolean;
}

const PREF_KEY = 'remind.ai.settings';

@Injectable({ providedIn: 'root' })
export class AiSettingService {
  async getSettings(): Promise<AiSettings> {
    const pref = await Preferences.get({ key: PREF_KEY });
    if (!pref.value) {
      return {
        provider: 'openai',
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        enabled: true,
        logToDb: true,
      };
    }
    try {
      return JSON.parse(pref.value) as AiSettings;
    } catch {
      return {
        provider: 'openai',
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        enabled: true,
        logToDb: true,
      };
    }
  }

  async saveSettings(s: AiSettings): Promise<void> {
    await Preferences.set({
      key: PREF_KEY,
      value: JSON.stringify(s),
    });
  }

  async isConfigured(): Promise<boolean> {
    const s = await this.getSettings();
    return !!(s.enabled && s.apiKey && s.baseUrl && s.model);
  }
}
