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

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss'],
  imports: [
    // Angular
    CommonModule,
    // Ionic UI
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
  ],
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