import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('../friend-list/friend-list.page').then(
            (m) => m.FriendListPage
          ),
      },
      {
        path: 'rsearch',
        loadComponent: () =>
          import('../search-list/search-list.page').then((m) => m.RSearchPage),
      },
      {
        path: 'roulette',
        loadComponent: () =>
          import('../roulette/roulette.page').then((m) => m.RoulettePage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('../settings/settings.page').then((m) => m.SettingsPage),
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full',
  },
];
