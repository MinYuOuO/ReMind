import { Component, Renderer2, Inject, PLATFORM_ID } from '@angular/core';
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
  public currentTheme: 'light' | 'dark' | 'auto' = 'auto';

  constructor(
    private platform: Platform, 
    private dbInit: DbInitService,
    private db: SqliteDbService,
    private renderer: Renderer2,
    @Inject(PLATFORM_ID) private platformId: any
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
      
      // Initialize theme before any UI shows
      this.initializeTheme();
      
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

  private initializeTheme() {
    // Get saved theme preference or default to 'auto'
    const savedTheme = localStorage.getItem('app-theme') as 'light' | 'dark' | 'auto' || 'auto';
    this.currentTheme = savedTheme;
    
    this.applyTheme(savedTheme);
    
    // Listen for system theme changes (only in auto mode)
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (this.currentTheme === 'auto') {
          this.applyTheme('auto');
        }
      });
    }
  }

  private applyTheme(theme: 'light' | 'dark' | 'auto') {
    // Remove all theme classes
    this.renderer.removeClass(document.body, 'theme-light');
    this.renderer.removeClass(document.body, 'theme-dark');
    this.renderer.removeClass(document.body, 'theme-auto');
    
    // For auto mode, determine which theme to apply based on system preference
    if (theme === 'auto') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const actualTheme = isDark ? 'dark' : 'light';
      this.renderer.addClass(document.body, `theme-${actualTheme}`);
      this.renderer.addClass(document.body, 'theme-auto'); // Mark as auto mode
    } else {
      // Direct theme selection
      this.renderer.addClass(document.body, `theme-${theme}`);
    }
    
    console.log(`[App] Theme applied: ${theme}`);
  }

  // Public method to change theme
  public setTheme(theme: 'light' | 'dark' | 'auto') {
    this.currentTheme = theme;
    this.applyTheme(theme);
    localStorage.setItem('app-theme', theme);
  }

  // Check if dark mode is currently active
  public isDarkMode(): boolean {
    if (this.currentTheme === 'dark') return true;
    if (this.currentTheme === 'light') return false;
    
    // Auto mode - check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Get the actual theme being displayed (for UI indicators)
  public getActiveTheme(): 'light' | 'dark' {
    if (this.currentTheme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }
}