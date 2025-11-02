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
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  personOutline,
  shieldCheckmarkOutline,
  notificationsOutline,
  informationCircleOutline,
  helpCircleOutline,
  arrowBack,
  lockClosedOutline,
  sparklesOutline,
  settingsOutline, callOutline, calendarOutline, mailOutline } from 'ionicons/icons';
import { AiSettingService } from '../core/services/ai-setting.service';

addIcons({
  'person-outline': personOutline,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'notifications-outline': notificationsOutline,
  'information-circle-outline': informationCircleOutline,
  'help-circle-outline': helpCircleOutline,
  'arrow-back': arrowBack,
  'lock-closed-outline': lockClosedOutline,
  'sparkles-outline': sparklesOutline,
  'settings-outline': settingsOutline,
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
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SettingsPage implements OnInit {
  view:
    | 'main'
    | 'privacy'
    | 'ai'
    | 'data'
    | 'about'
    | 'faq'
    | 'card'
    | 'notification' = 'main';

  // AI form models
  aiProvider: 'openai' | 'deepseek' | 'none' = 'none';
  aiApiKey = '';
  aiModel = 'gpt-4o-mini';

  saving = false;

  constructor(private aiSettings: AiSettingService) {
      addIcons({arrowBack,personOutline,notificationsOutline,lockClosedOutline,sparklesOutline,settingsOutline,informationCircleOutline,helpCircleOutline,callOutline,calendarOutline,mailOutline});}

  async ngOnInit() {
    // load saved settings once
    const s = await this.aiSettings.load();
    this.aiProvider = s.provider;
    this.aiApiKey = s.apiKey;
    this.aiModel = s.model;
  }

  goBack() {
    this.view = 'main';
  }

  open(
    page:
      | 'privacy'
      | 'ai'
      | 'data'
      | 'about'
      | 'faq'
      | 'card'
      | 'notification',
  ) {
    this.view = page;
  }

  async saveAi() {
    this.saving = true;
    await this.aiSettings.save({
      provider: this.aiProvider,
      apiKey: this.aiApiKey,
      model: this.aiModel,
    });
    this.saving = false;
    alert('AI settings saved');
  }
}
