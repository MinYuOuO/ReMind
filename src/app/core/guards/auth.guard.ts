import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean | UrlTree> {
    // Try in-memory state first
    const inMem = this.auth.isAuthenticated$?.getValue?.() ?? false;
    if (inMem) return true;

    // otherwise, there is no session: redirect to login
    return this.router.parseUrl('/login');
  }
}
