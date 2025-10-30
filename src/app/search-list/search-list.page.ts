import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon,
  IonItem, IonSelect, IonSelectOption,
  IonTextarea, IonList, IonInput
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { arrowBack } from 'ionicons/icons';

addIcons({
  arrowBack,
});

@Component({
  selector: 'app-search-list',
  standalone: true,
  templateUrl: 'search-list.page.html',
  styleUrls: ['search-list.page.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButtons, IonButton, IonIcon,
    IonItem, IonSelect, IonSelectOption,
    IonTextarea, IonList, IonInput
  ]
})
export class RSearchPage {
  view: 'list' | 'search' = 'list';

  keyword = '';
  question = '';
  selectedContact = '';
  contacts = ['Woon Ren Yi', 'Moo Ben Yi', 'Alex'];

  hasQuery() { return (this.keyword?.trim()?.length ?? 0) > 0; }

  openSearch() {
    if (this.hasQuery()) {
      this.question = this.keyword.trim();
      this.view = 'search';
    }
  }

  goBack() { this.view = 'list'; }

  send() {
    console.log('[RSearch] submit', {
      contact: this.selectedContact || '(any)',
      question: (this.question?.trim() || this.keyword?.trim() || '')
    });
  }
}
