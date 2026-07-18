# Pilot Logbook

A web app that reads flight-log PDFs or photos and organizes them by month and year.

Features:

- Automatic split into **A380 PIC Time** and **Auditor Time**
- CSV export / import
- Per-year archive (export + remove)
- Optional Google sign-in sync across iPad, phone, and computer (Firebase)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and upload a logbook PDF, JPG, or PNG (or a CSV previously exported from this app).

**Tip:** For AFLIS Flight Logs, uploading the **PDF** is the most accurate. Photos/screenshots should be JPG or PNG (iPhone HEIC is not supported — use Share → Options → Most Compatible).

## Multi-device sync (Firebase, optional)

Without Firebase config, the app works with browser storage only. To see the same logbook on iPad, phone, and PC, connect a Firebase project:

1. Create a project in the [Firebase Console](https://console.firebase.google.com) (the free Spark plan is enough).
2. Add a **Web app** and copy the `firebaseConfig` values.
3. Under **Authentication → Sign-in method**, enable **Google**.
4. Create a **Firestore Database** (production mode), then deploy the rules from `firestore.rules` in this repo:

   ```bash
   firebase deploy --only firestore:rules
   ```

   (Each user can only read/write their own `logbooks/{uid}` document.)

5. Create a `.env.local` file in the project root:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_APP_ID=...
```

6. Rebuild / restart the app. A **Sign in with Google** button appears in the header. Sign in with the same Google account on each device to sync.
   - On first sign-in, local and cloud data are merged (duplicates removed).
   - Uploads, year removals, and Clear are pushed to the cloud immediately and appear on other devices in real time.

For hosting, run `npm run build` and deploy the `dist` folder to Firebase Hosting, Netlify, GitHub Pages, or any static host. Add your deployed domain under **Authentication → Settings → Authorized domains** in Firebase.

## Local emulator testing

To test sync without a real Firebase project:

```bash
npx firebase-tools emulators:start --project demo-pilot-logbook --only auth,firestore
```

Put these dummy values in `.env.local`, then start the dev server:

```bash
VITE_FIREBASE_API_KEY=demo
VITE_FIREBASE_AUTH_DOMAIN=demo-pilot-logbook.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-pilot-logbook
VITE_FIREBASE_APP_ID=demo
VITE_FIREBASE_USE_EMULATOR=true
```

## Year-end archive

- Use **Export {year} CSV** on a year card to save that year’s flights as a file.
- Use **Remove year** to drop that year from the browser and keep the app light.
- Drop the saved CSV back onto the app anytime to view it again.

## Flight classification

- **Auditor Time:** any non-A380 sector, or any sector whose duty code contains `Z`
- **A380 PIC Time:** remaining A380 sectors
- Auditor rows stay in the date-ordered table and are shown in a lighter color
- Duty codes are always shown; T/O and L/D display as `1` when credited
