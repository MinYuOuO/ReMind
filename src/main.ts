import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';
import { JeepSqlite } from 'jeep-sqlite/dist/components/jeep-sqlite';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { appConfig } from './app/app.config';
import { addIcons } from 'ionicons';
import { homeOutline, searchOutline, shuffleOutline, settingsOutline, add as addIcon } from 'ionicons/icons';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

if (Capacitor.getPlatform() === 'web') {
  if (!customElements.get('jeep-sqlite')) {
    customElements.define('jeep-sqlite', JeepSqlite);
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});

addIcons({
  'home-outline': homeOutline,
  'search-outline': searchOutline,
  'shuffle-outline': shuffleOutline,
  'settings-outline': settingsOutline,
  'add': addIcon,
});

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
