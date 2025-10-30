import { Component } from '@angular/core';
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
} from '@ionic/angular/standalone';
import { ExploreContainerComponent } from '../explore-container/explore-container.component';

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
} from 'ionicons/icons';

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
    ExploreContainerComponent,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
  ],
})
export class SettingsPage {
  // 加了两个新的 view: card, notification
  view:
    | 'main'
    | 'privacy'
    | 'ai'
    | 'data'
    | 'about'
    | 'faq'
    | 'card'
    | 'notification' = 'main';

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
}
