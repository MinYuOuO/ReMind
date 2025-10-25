import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon, IonBackButton } from '@ionic/angular/standalone';
import { ExploreContainerComponent } from '../explore-container/explore-container.component';

@Component({
  selector: 'app-roulette',
  templateUrl: 'roulette.page.html',
  styleUrls: ['roulette.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButtons, IonButton, IonIcon, IonBackButton,
    RouterModule,
    ExploreContainerComponent
  ],
})
export class RoulettePage {
  constructor() {}
}
