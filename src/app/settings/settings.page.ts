import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonIcon } from '@ionic/angular/standalone';
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
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, ExploreContainerComponent],
})
export class SettingsPage {
  constructor() {}
}
