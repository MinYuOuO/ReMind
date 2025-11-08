import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonInput, IonItem, IonLabel, IonButton, IonList, IonIcon } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { lockClosedOutline } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  imports: [CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonInput, IonItem, IonLabel, IonButton, IonList, IonIcon]
})
export class LoginPage {
  password = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  async login() {
    this.loading = true;
    try {
      const ok = await this.auth.loginWithPassword(this.password);
      if (ok) {
        await this.router.navigateByUrl('/');
      } else {
        alert('Invalid password');
      }
    } finally {
      this.loading = false;
    }
  }

  goToSettings() {
    this.router.navigate(['/settings'], { queryParams: { view: 'privacy' } });
  }
}
