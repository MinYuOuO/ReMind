# ReMind

**Course:** BAI13123 Mobile Application Development
**Semester:** Sept 2025 Session

---

## Project Overview

**ReMind** is a **privacy-first, offline-enabled relationship manager** that helps users
record, organize, and sustain meaningful friendships.

Built with **Ionic + Angular + Capacitor + SQLite**, the app stores all personal data **locally** on the device.
Unlike cloud-based CRMs, ReMind focuses on **data sovereignty, emotional awareness,** and **offline reliability**.

---

## Quick Start Guide

1. Clone and Install

  ```bash
    git clone https://github.com/MinYuOuO/ReMind.git
    cd ReMind
  ```

2. Install Dependencyies

  ```
    npm install
    npm install -g @ionic/cli
    npm ci
  ```

3. Create the Missing Environment File
   Because /src/environments/environment.ts is in .gitignore,
   you’ll need to create it manually before running the app.
   Create the file:

  ```
  mkdir -p src/environments
  nano src/environments/environment.ts
  ```

Paste the following template:

  ```
  export const environment = {
    production: false,
    offlineOnly: true,
  };
  ```

4. Run the App in Browser

  ```
    ionic serve
  ```

Then open [http://localhost:8100](http://localhost:8100) in your browser.
You should see the ReMind starter interface.

5. Build for Android or IOS

  ```
    ionic capacitor build android
    ionic capacitor build ios
  ```

(Ensure Android Studio or Xcode SDK is properly installed.)

6. Run in Android Studio

   ```
   npx cap run android
   ```

---

### Project Architecture

This project is an Ionic + Angular + Capacitor mobile app with a local-first SQLite-backed data layer. The repository is organised to separate platform config, app source, native projects and build output.

Top-level layout

```
capacitor.config.ts        # Capacitor configuration
ionic.config.json          # Ionic CLI config
package.json               # npm scripts & dependencies
android/                   # Android native project (Capacitor)
ios/                       # iOS native project (Capacitor)
www/                       # Built web app output (production build)
src/                       # Main app source (Angular + Ionic)
```

Key `src/` structure

```
src/
├── app/                   # Angular app: pages, routes, root component
│  ├── app.component.*     # Root app entry (initialization + routing)
│  ├── app.routes.ts       # Global route definitions
│  ├── app.config.ts       # App-specific configuration
│  ├── tabs/               # Tabbed navigation layout
│  ├── friend-list/        # Friend list & contact management UI
│  ├── search-list/        # Search and filter UI
│  ├── roulette/           # Social/AI suggestion screens
│  ├── settings/           # User preferences and privacy settings
│  └── core/               # Application core modules
│     ├── components/      # Reusable UI components
│     ├── guards/          # Route guards (e.g. `auth.guard.ts`)
│     ├── models/          # TypeScript interfaces and domain models
│     ├── repos/           # Repository layer (DB CRUD: contact, interaction, user)
│     └── services/        # Core services (DB init, SQLite wrapper, AI, auth, notifications)
├── assets/
│  ├── sql-wasm.js         # SQLite WASM adapter for browser (used by web fallback)
│  └── icon/               # App icons and static image assets
├── environments/          # `environment.ts` (dev) and `environment.prod.ts` (prod)
└── theme/                 # Global SCSS variables and theme styles
```

Notes on important pieces

- Local database: The app uses SQLite for local persistence. `src/assets/sql-wasm.js` provides a WebAssembly adapter for browser-based development; native platforms use Capacitor SQLite plugins.  
- Data layer: `core/repos` contains repository classes (e.g. `contact.repo.ts`, `interaction.repo.ts`) that encapsulate CRUD and queries.  
- Services: `core/services` contains cross-cutting logic: DB initialization (`db-inti.service.ts`), `db.service.ts` (SQLite wrapper), `ai.service.ts` (AI integration), `auth.service.ts`, and other helpers.  
- Routing & entry: `app.routes.ts` and `app.component.ts` initialize navigation and bootstrapping. `app.config.ts` holds Ionic/Angular specific app configuration.  
- Native build: Use `ionic capacitor build android` / `ionic capacitor build ios` to produce native apps. Built web artifacts land in `www/` and are copied into native projects during Capacitor sync.  
- Environments: `src/environments/environment.ts` is gitignored and must be created locally (see Quick Start section).  

This section summarizes the most relevant places to modify or inspect when adding features, debugging DB issues, or changing platform behaviour.  

---

### License

This project is licensed under the MIT License.
© 2025 ReMind Team — All Rights Reserved.
