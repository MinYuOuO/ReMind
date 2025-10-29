import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-search-list',
  templateUrl: 'search-list.page.html',
  styleUrls: ['search-list.page.scss'],
  imports: [ 
    CommonModule,
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class RSearchPage {

  constructor() {}

}
