import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { LocalNotifications } from '@capacitor/local-notifications';
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
    
    // Request notification permissions early
    const permResult = await LocalNotifications.requestPermissions();
    console.log('[App] Notification permissions:', permResult);
    
    // Initialize database
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
