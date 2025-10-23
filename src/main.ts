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

async function initializeApp() {
  if (Capacitor.getPlatform() === 'web') {
    try {
      // Initialize SQLite web platform
      if (!customElements.get('jeep-sqlite')) {
        customElements.define('jeep-sqlite', JeepSqlite);
      }

      // Create and append element
      const jeepSqlite = document.createElement('jeep-sqlite');
      document.body.appendChild(jeepSqlite);

      // Wait for element to be defined
      await customElements.whenDefined('jeep-sqlite');

      // Wait for a brief moment to ensure element is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Initialize the web store
      await CapacitorSQLite.initWebStore();

      console.log('[App] SQLite web store initialized');
    } catch (err) {
      console.error('[App] SQLite initialization failed:', err);
      throw err;
    }
  }

  // Bootstrap the app
  await bootstrapApplication(AppComponent, {
    providers: [
      { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
      provideIonicAngular(),
      provideRouter(routes, withPreloading(PreloadAllModules)),
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
