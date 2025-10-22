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
    // Prevent duplicate initialization under hot reload
    if (!AppComponent.alreadyInitialized) {
      AppComponent.alreadyInitialized = true;
      this.initApp();
    } else {
      console.log('[App] Initialization skipped (HMR duplicate)');
    }
  }

  private async initApp() {
    try {
      await this.platform.ready();
      console.log('Platform ready — initializing SQLite...');
      await this.dbInit.init();
      console.log('Database initialized successfully.');
      await new Promise(r => setTimeout(r, 400));
      await SplashScreen.hide();
      console.log('Splash screen hidden, app ready.');
    } catch (err) {
      console.error('Initialization failed:', err);
      try { await SplashScreen.hide(); } catch {}
    }
  }
}
