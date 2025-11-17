import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';

const PW_KEY = 'auth.password_hash';
const BIOMETRIC_KEY = 'auth.biometric_enabled';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _auth$ = new BehaviorSubject<boolean>(false);

  get isAuthenticated$() {
    return this._auth$;
  }

  constructor() { }

  async init() {
    // Placeholder for any startup tasks (session restore etc.)
    // Currently we keep session in-memory until app restart.
  }

  private async sha256(text: string) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async hasPassword(): Promise<boolean> {
    const res = await Preferences.get({ key: PW_KEY });
    return !!res.value;
  }

  async setPassword(oldPassword: string | null, newPassword: string): Promise<boolean> {
    const stored = await Preferences.get({ key: PW_KEY });
    if (stored.value) {
      // verify old
      if (!oldPassword) return false;
      const oldHash = await this.sha256(oldPassword);
      if (oldHash !== stored.value) return false;
    }
    const newHash = await this.sha256(newPassword);
    await Preferences.set({ key: PW_KEY, value: newHash });
    return true;
  }

  async verifyPassword(password: string): Promise<boolean> {
    const stored = await Preferences.get({ key: PW_KEY });
    if (!stored.value) return false;
    const h = await this.sha256(password);
    return h === stored.value;
  }

  async loginWithPassword(password: string): Promise<boolean> {
    const ok = await this.verifyPassword(password);
    if (ok) this._auth$.next(true);
    return ok;
  }

  logout() {
    this._auth$.next(false);
  }

  async enableBiometric(): Promise<void> {
    // NOTE: This implementation only stores the flag locally.
    // For production, integrate a native biometric plugin (Keychain/Keystore)
    // and store a token there. This method is safe as a scaffold.
    await Preferences.set({ key: BIOMETRIC_KEY, value: '1' });
  }

  async disableBiometric(): Promise<void> {
    await Preferences.remove({ key: BIOMETRIC_KEY });
  }

  async isBiometricEnabled(): Promise<boolean> {
    const r = await Preferences.get({ key: BIOMETRIC_KEY });
    return !!r.value;
  }


  async loginWithBiometric(): Promise<boolean> {
    try {
      // First, check if biometric authentication is available
      const result = await NativeBiometric.isAvailable();

      if (!result.isAvailable) {
        console.warn('Biometric authentication is not available.');
        return false;
      }

      // Optionally, you can check if Face ID is available
      const isFaceID = result.biometryType === BiometryType.FACE_ID;
      console.log(`Biometric Type: ${isFaceID ? 'Face ID' : 'Fingerprint'}`);

      // Request biometric authentication
      const verified = await NativeBiometric.verifyIdentity({
        reason: "For easy login",
        title: "Log in",
        subtitle: isFaceID ? "Use Face ID to log in" : "Use Fingerprint to log in",
        description: "Please authenticate using your fingerprint or face recognition.",
      }).then(() => true)
        .catch(() => false);

      // If verification fails, return false
      if (!verified) {
        console.log('Biometric authentication failed');
        return false;
      }

      // Biometric authentication successful, now log the user in
      this._auth$.next(true);
      console.log('Biometric authentication successful');

      // Optionally, you can store the authentication state or perform further actions
      return true;
    } catch (e) {
      console.error('[AuthService] Biometric login failed', e);
      return false;
    }
  }
}
