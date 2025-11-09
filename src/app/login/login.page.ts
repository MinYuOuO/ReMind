import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonInput, 
  IonItem, IonLabel, IonButton, IonList, IonIcon,
  IonButtons, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

// Add icons to Ionic
addIcons({ eyeOutline, eyeOffOutline });

@Component({
  selector: 'app-password-setup-modal',
  standalone: true,
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ hasPassword ? 'Change Password' : 'Set Password' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item *ngIf="hasPassword">
          <ion-label position="stacked">Old Password</ion-label>
          <div style="display: flex; align-items: center; width: 100%">
            <ion-input [type]="showOldPassword ? 'text' : 'password'" [(ngModel)]="oldPassword"></ion-input>
            <ion-icon 
              [name]="showOldPassword ? 'eye-off-outline' : 'eye-outline'"
              (click)="showOldPassword = !showOldPassword"
              style="font-size: 1.5em; margin-left: 8px; cursor: pointer;"
            ></ion-icon>
          </div>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">New Password</ion-label>
          <div style="display: flex; align-items: center; width: 100%">
            <ion-input [type]="showNewPassword ? 'text' : 'password'" [(ngModel)]="newPassword"></ion-input>
            <ion-icon 
              [name]="showNewPassword ? 'eye-off-outline' : 'eye-outline'"
              (click)="showNewPassword = !showNewPassword"
              style="font-size: 1.5em; margin-left: 8px; cursor: pointer;"
            ></ion-icon>
          </div>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Confirm Password</ion-label>
          <div style="display: flex; align-items: center; width: 100%">
            <ion-input [type]="showConfirmPassword ? 'text' : 'password'" [(ngModel)]="confirmPassword"></ion-input>
            <ion-icon 
              [name]="showConfirmPassword ? 'eye-off-outline' : 'eye-outline'"
              (click)="showConfirmPassword = !showConfirmPassword"
              style="font-size: 1.5em; margin-left: 8px; cursor: pointer;"
            ></ion-icon>
          </div>
        </ion-item>

        <ion-item lines="none">
          <ion-button expand="block" (click)="save()">
            {{ hasPassword ? 'Change Password' : 'Save Password' }}
          </ion-button>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  imports: [
    CommonModule, 
    FormsModule, 
    IonContent, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonInput, 
    IonItem, 
    IonLabel, 
    IonButton, 
    IonList, 
    IonIcon,
    IonButtons
  ]
})
class PasswordSetupModal implements OnInit {
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  hasPassword = false;
  showOldPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  readonly eyeOutline = eyeOutline;
  readonly eyeOffOutline = eyeOffOutline;
  
  constructor(
    public modalController: ModalController,
    private auth: AuthService
  ) {}

  async ngOnInit() {
    this.hasPassword = await this.auth.hasPassword();
  }

  dismiss() {
    this.modalController.dismiss();
  }

  async save() {
    if (!this.newPassword || this.newPassword !== this.confirmPassword) {
      alert('New passwords do not match or are empty');
      return;
    }

    try {
      const ok = await this.auth.setPassword(
        this.hasPassword ? this.oldPassword : null, 
        this.newPassword
      );
      
      if (ok) {
        this.modalController.dismiss({ saved: true });
      } else {
        alert(this.hasPassword ? 'Current password is incorrect' : 'Failed to set password');
      }
    } catch (e) {
      alert('Failed to save password');
      console.error(e);
    }
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  imports: [CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, 
           IonTitle, IonInput, IonItem, IonLabel, IonButton, IonList, 
           IonIcon]
})
export class LoginPage implements OnInit {
  password = '';
  loading = false;
  biometricAvailable = false;
  biometricEnabled = false;
  hasPassword = false;
  showPassword = false;
  readonly eyeOutline = eyeOutline;
  readonly eyeOffOutline = eyeOffOutline;
  
  constructor(
    private auth: AuthService, 
    private router: Router,
    private modalController: ModalController
  ) {}

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

  async goToSettings() {
    const modal = await this.modalController.create({
      component: PasswordSetupModal
    });
    
    await modal.present();
    const { data } = await modal.onWillDismiss();
    
    if (data?.saved) {
      this.hasPassword = true;
    }
  }
}
