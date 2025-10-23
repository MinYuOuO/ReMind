import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { DbInitService } from './core/services/db-inti.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private static alreadyInitialized = false;

  constructor(private platform: Platform, private dbInit: DbInitService) {
    if (!AppComponent.alreadyInitialized) {
      AppComponent.alreadyInitialized = true;
      this.initApp();
    }
  }

  private async initApp() {
    try {
      await this.platform.ready();
      console.log('[App] Platform ready — initializing SQLite...');
      // Wait for DB initialization to complete
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
