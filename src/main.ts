import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';
import { bootstrapApplication } from '@angular/platform-browser';
import { APP_INITIALIZER } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { homeOutline, searchOutline, shuffleOutline, settingsOutline, add as addIcon } from 'ionicons/icons';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { DbInitService } from './app/core/services/db-inti.service';

async function initializeApp() {
  // When running on web we rely on the loader in index.html to register <jeep-sqlite>
  // and let DbInitService / SqliteDbService handle initWebStore() at open().
  if (Capacitor.getPlatform() === 'web') {
    console.log('[App] web platform detected — assuming jeep-sqlite loader in index.html');
  }

  // Bootstrap the app
  await bootstrapApplication(AppComponent, {
    providers: [
      { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
      provideIonicAngular(),
      provideRouter(routes, withPreloading(PreloadAllModules)),
      // Ensure the DB is initialized before any component runs
      {
        provide: APP_INITIALIZER,
        useFactory: (dbInit: DbInitService) => () => dbInit.init(),
        deps: [DbInitService],
        multi: true,
      },
    ],
  });

  // Add icons
  addIcons({
    'home-outline': homeOutline,
    'search-outline': searchOutline,
    'shuffle-outline': shuffleOutline,
    'settings-outline': settingsOutline,
    'add': addIcon,
  });
}

// Initialize app
initializeApp().catch(err => console.error('[App] Initialization failed:', err));
