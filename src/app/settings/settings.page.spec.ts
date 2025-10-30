import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonLabel
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel
  ]
})
export class SettingsPage {
  // 当前显示的子页
  view: 'main' | 'privacy' | 'ai' | 'data' | 'about' | 'faq' = 'main';

  // 统一返回
  goBack() {
    this.view = 'main';
  }

  // 进入子页
  open(viewName: 'privacy' | 'ai' | 'data' | 'about' | 'faq') {
    this.view = viewName;
  }
}

