import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/angular/standalone';

import { ActivatedRoute } from '@angular/router';

import { addIcons } from 'ionicons';
import {
  person,
  personOutline,
  shieldCheckmarkOutline,
  hardwareChipOutline,
  notificationsOutline,
  serverOutline,
  cafeOutline,
  helpCircleOutline,
  arrowBack,
  callOutline,
  calendarOutline,
  mailOutline,
  sparklesOutline,
  lockClosedOutline,
  settingsOutline,
  informationCircleOutline,
} from 'ionicons/icons';

import {
  AiSettingService,
  AiSettings,
} from '../core/services/ai-setting.service';

addIcons({
  person,
  'person-outline': personOutline,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'hardware-chip-outline': hardwareChipOutline,
  'notifications-outline': notificationsOutline,
  'server-outline': serverOutline,
  'cafe-outline': cafeOutline,
  'help-circle-outline': helpCircleOutline,
  'arrow-back': arrowBack,
  'call-outline': callOutline,
  'calendar-outline': calendarOutline,
  'mail-outline': mailOutline,
  'sparkles-outline': sparklesOutline,
});

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonToggle,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SettingsPage implements OnInit {
  // views
  view:
    | 'main'
    | 'privacy'
    | 'ai'
    | 'data'
    | 'about'
    | 'faq'
    | 'card'
    | 'notification' = 'main';

  // AI settings state (bound to form)
  ai: AiSettings = {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o-mini',
    enabled: true,
    logToDb: true,
  };

  saving = false;

  constructor(private aiSetting: AiSettingService, private route: ActivatedRoute) {
    addIcons({
      arrowBack,
      personOutline,
      notificationsOutline,
      lockClosedOutline,
      sparklesOutline,
      settingsOutline,
      informationCircleOutline,
      helpCircleOutline,
      callOutline,
      calendarOutline,
      mailOutline,
    });
  }

  async ngOnInit() {
    // load AI settings once
    const loaded = await this.aiSetting.getSettings();
    this.ai = { ...this.ai, ...loaded };

    this.route.queryParams.subscribe((p) => {
      if (p['tab'] === 'ai') {
        this.view = 'ai';
      }
    });
  }

  goBack() {
    this.view = 'main';
  }

  open(
    page: 'privacy' | 'ai' | 'data' | 'about' | 'faq' | 'card' | 'notification'
  ) {
    this.view = page;
  }

  async saveAiSettings() {
    this.saving = true;
    try {
      await this.aiSetting.saveSettings(this.ai);
      alert('AI settings saved.');
    } catch (e) {
      console.error('[Settings] failed to save AI settings', e);
      alert('Failed to save AI settings.');
    } finally {
      this.saving = false;
    }
  }

  // convenience: set presets for common providers
  useOpenAI() {
    this.ai.provider = 'openai';
    // only set baseUrl if empty
    if (!this.ai.baseUrl) {
      this.ai.baseUrl = 'https://api.openai.com/v1';
    }
    if (!this.ai.model) {
      this.ai.model = 'gpt-4o-mini';
    }
  }

  useDeepSeek() {
    this.ai.provider = 'deepseek';
    if (!this.ai.baseUrl) {
      this.ai.baseUrl = 'https://api.deepseek.com/v1';
    }
    if (!this.ai.model) {
      this.ai.model = 'deepseek-chat';
    }
  }
}
