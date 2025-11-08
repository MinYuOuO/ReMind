import { Routes } from '@angular/router';
import { TabsPage } from './tabs/tabs.page';
import { AuthGuard } from './core/guards/auth.guard';

// Auth guard will be used to protect the app's main tabs
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('../app/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: TabsPage,
    canActivate: [AuthGuard],
    // Guarding is applied at runtime via a guard file (added separately)
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('../app/friend-list/friend-list.page').then((m) => m.FriendListPage),
      },
      {
        path: 'rsearch',
        loadComponent: () =>
          import('../app/search-list/search-list.page').then((m) => m.RSearchPage),
      },
      {
        path: 'roulette',
        loadComponent: () =>
          import('../app/roulette/roulette.page').then((m) => m.RoulettePage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('../app/settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: '',
        redirectTo: '/home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full',
  },
];
