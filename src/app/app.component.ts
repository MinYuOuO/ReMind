import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { DbInitService } from './core/services/db-inti.service';
import { SqliteDbService } from './core/services/db.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private static alreadyInitialized = false;

  constructor(
    private platform: Platform, 
    private dbInit: DbInitService,
    private db: SqliteDbService
  ) {
    if (!AppComponent.alreadyInitialized) {
      AppComponent.alreadyInitialized = true;
      this.initApp();
    }
  }

  private async initApp() {
    try {
      await this.platform.ready();
      console.log('[App] Platform ready — initializing SQLite...');
      
      // Initialize web store first if needed
      if (!this.platform.is('hybrid')) {
        console.log('[App] Initializing web store...');
        await this.db.initWebStore();
      }

      // Then initialize database
      await this.dbInit.init();
      console.log('[App] Database initialized.');
      
      await new Promise(r => setTimeout(r, 400));
      await SplashScreen.hide();
    } catch (err) {
      console.error('[App] Initialization failed:', err);
      try { await SplashScreen.hide(); } catch {}
    }
  }
}
