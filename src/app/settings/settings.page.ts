import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';   // ← ngIf / ngSwitch 必须有
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

// register only the icons used on this page to silence the "Could not load icon" warnings
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
} from 'ionicons/icons';

addIcons({
  'person': person,
  'person-outline': personOutline,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'hardware-chip-outline': hardwareChipOutline,
  'notifications-outline': notificationsOutline,
  'server-outline': serverOutline,
  'cafe-outline': cafeOutline,
  'help-circle-outline': helpCircleOutline,
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
    IonLabel,],
})
export class SettingsPage {
  // 当前是哪一页：main / privacy / ai / data / about / faq
  view: 'main' | 'privacy' | 'ai' | 'data' | 'about' | 'faq' = 'main';

  // 点击左上角 ←
  goBack() {
    this.view = 'main';
  }

  // 点击每一行 menu
  open(page: 'privacy' | 'ai' | 'data' | 'about' | 'faq') {
    this.view = page;
  }
}