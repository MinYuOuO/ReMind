import { Component, OnInit } from '@angular/core';
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
export class LoginPage implements OnInit {
  password = '';
  loading = false;
  biometricAvailable = false;
  biometricEnabled = false;
  hasPassword = false;

  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit() {
    try {
      this.hasPassword = await this.auth.hasPassword();
      this.biometricEnabled = await this.auth.isBiometricEnabled();

      // If biometric is enabled, attempt biometric login automatically
      if (this.biometricEnabled) {
        this.loading = true;
        try {
          const ok = await this.auth.loginWithBiometric();
          if (ok) {
            await this.router.navigateByUrl('/');
            return;
          }
        } finally {
          this.loading = false;
        }
      }
    } catch (e) {
      console.warn('[Login] init failed', e);
    }
  }

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

  async tryBiometric() {
    this.loading = true;
    try {
      const ok = await this.auth.loginWithBiometric();
      if (ok) {
        await this.router.navigateByUrl('/');
      } else {
        alert('Biometric login failed or is not available. Use password or enable biometric in Settings.');
      }
    } finally {
      this.loading = false;
    }
  }

  goToSettings() {
    this.router.navigate(['/settings'], { queryParams: { view: 'privacy' } });
  }
}
