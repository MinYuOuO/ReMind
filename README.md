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
``` bash
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

---

### Project Architecture
```
src/
├── app/
│ ├── app.component.* # Root app entry (initialization + routing)
│ ├── app.routes.ts # Global route definitions
│ ├── app.config.ts # Ionic/Angular configuration
│ │
│ ├── tabs/ # Bottom navigation layout
│ ├── friend-list/ # Friend list & contact management UI
│ ├── search-list/ # Search and filter interface
│ ├── roulette/ # Social roulette (AI-suggested actions)
│ ├── settings/ # User preferences and privacy settings
│ │
│ └── core/
│ ├── components/ # Shared reusable UI components
│ ├── models/ # TypeScript interfaces and data models
│ ├── repos/ # Repository layer for DB CRUD (ContactRepo, InteractionRepo)
│ └── services/ # Core logic: SQLite service, DB init, identity, AI integration
│
├── assets/
│ ├── sql-wasm.js # SQLite WebAssembly adapter (for browser)
│ └── icon/ # App icons and static image assets
│
├── environments/ # Environment configurations (create manually if missing)
│ ├── environment.ts # Local development config (offline)
│ └── environment.prod.ts # Production config (optional Firebase)
│
└── theme/ # Ionic theme variables and global SCSS styles
```

---

### License
This project is licensed under the MIT License.
© 2025 ReMind Team — All Rights Reserved.
