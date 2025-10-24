import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';
import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { homeOutline, searchOutline, shuffleOutline, settingsOutline, add as addIcon } from 'ionicons/icons';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { DbInitService } from './app/core/services/db-inti.service';
import { JeepSqlite } from 'jeep-sqlite/dist/components/jeep-sqlite';

const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    {
      provide: 'APP_INIT',
      useFactory: (dbInit: DbInitService) => {
        return () => dbInit.init();
      },
      deps: [DbInitService],
      multi: true
    }
  ]
};

async function initializeApp() {

  // Only for web target — ensure jeep-sqlite element exists and web store is initialized
  if (Capacitor.getPlatform() === 'web') {
    // define element if needed and append one instance to DOM
    if (!customElements.get('jeep-sqlite')) {
      customElements.define('jeep-sqlite', JeepSqlite);
    }
    const jeep = document.createElement('jeep-sqlite');
    document.body.appendChild(jeep);

    // wait until the custom element is defined
    await customElements.whenDefined('jeep-sqlite');

    // small pause so the element can finish internal setup (helps avoid race)
    await new Promise((r) => setTimeout(r, 120));

    // initialize the plugin's IndexedDB-backed web store
    await CapacitorSQLite.initWebStore();

    // optional: check/create connection registration so saveToStore has a connection
    try {
      // createConnection is exposed on the plugin and is idempotent for same name
      await CapacitorSQLite.createConnection({
        database: 'remind.db',
        readonly: false,
        encrypted: false,
        mode: 'no-encryption',
        version: 2
      });
      
    } catch (e) {
      console.warn('createConnection (pre-bootstrap) failed, continuing', e);
    }
  }

  // Bootstrap the app with config
  await bootstrapApplication(AppComponent, appConfig);

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