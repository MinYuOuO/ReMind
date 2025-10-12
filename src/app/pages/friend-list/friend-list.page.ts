import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-friend-list',
  templateUrl: './friend-list.page.html',
  styleUrls: ['./friend-list.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class FriendListPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
