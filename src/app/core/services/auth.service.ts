import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

const PW_KEY = 'auth.password_hash';
const BIOMETRIC_KEY = 'auth.biometric_enabled';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _auth$ = new BehaviorSubject<boolean>(false);

  get isAuthenticated$() {
    return this._auth$;
  }

  constructor() {}

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
    // Placeholder: try to call a native biometric plugin if installed.
    // If not available, return false to let UI fallback to password.
    try {
      const win: any = window as any;
      const plugin = win?.Plugins?.Biometric || win?.Biometric || win?.Fingerprint;
      if (plugin && typeof plugin.verify === 'function') {
        const res = await plugin.verify();
        if (res && res.verified) {
          this._auth$.next(true);
          return true;
        }
      }
    } catch (e) {
      console.warn('[Auth] biometric plugin call failed', e);
    }
    return false;
  }
}
