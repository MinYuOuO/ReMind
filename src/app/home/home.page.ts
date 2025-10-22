import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { DatabaseService, User } from '../services/database';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonicModule]
})
export class HomePage implements OnInit {
  
 constructor(private database: DatabaseService) {}

  // used by the template: *ngFor="let user of users()"
  users(): User[] {
    return this.database.getUsers()(); // unwrap the signal
  }

  async updateUser(user: User) {
    // ensure types/format expected by DatabaseService (convert active if needed)
    // here we forward the user object to the service
    await this.database.updateUser(user);
  }

  async deleteUser(user: User) {
    await this.database.deleteUser(user.user_id);
  }

  ngOnInit() {
  }

}
