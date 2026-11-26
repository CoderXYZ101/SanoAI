# Deploy SanoAI (GitHub → Firebase, free Spark plan)

SanoAI is a **static, browser-only app**: Firebase **Hosting** serves it, **Firebase Authentication** signs users in, **Firestore** stores their data (protected by `firestore.rules`). No server, no card needed.

## 1. Firebase project (5 min, you)
1. https://console.firebase.google.com → **Add project** (stay on the free **Spark** plan).
2. **Build → Authentication → Get started → Sign-in method**, then enable both:
   - **Email/Password** (SanoAI sends the verification and password-reset emails through Firebase).
   - **Google** (choose a support email). If you later use your own domain, add it under **Authentication → Settings → Authorized domains**.
3. **Build → Firestore Database → Create database** (production mode, any region).
4. **Project settings → Your apps → Web (`</>`)** → register an app → copy the config values (apiKey, authDomain, projectId, appId).

## 2. GitHub + Codespaces
1. Create a GitHub repo and push this folder (`.env.local` and `node_modules` are gitignored).
2. Open the repo → **Code → Codespaces → Create codespace** (the `.devcontainer` installs everything).
3. The project settings are already in `.env.production` and `.firebaserc` (project `sanoai-india`; change both to use another project). In the Codespace terminal:
   ```bash
   npx firebase login --no-localhost
   npm run deploy                    # builds + deploys Hosting and Firestore rules
   ```
   Your app is live at `https://<project-id>.web.app`.

## 3. Make yourself the admin
1. Open your live app, create your account and verify your email (or use **Continue with Google**).
2. Firebase console → **Authentication → Users** → copy your **User UID**.
3. **Firestore Database → Start collection** → collection id `sano_admins` → **document id = your UID** → add any field, e.g. `role` = `owner`.
4. Reload the app. An **Admin** item appears in the menu (payments, sponsor codes, business enquiries).

Admins can change plans and report credits, but the rules give them no access to anyone's medical records. (As the owner of the Firebase project you can still see all data in the console, so protect that Google account with 2-step verification.)

## 4. Auto-deploy on every push (optional)
Do **not** run `firebase init hosting:github` (it writes its own workflows). Instead add to the GitHub repo:
- **Secrets:** `FIREBASE_SERVICE_ACCOUNT` (service-account JSON), `FIREBASE_PROJECT_ID`
- **Variables:** `AUTO_DEPLOY=true` (app settings are read from `.env.production`)

The service account needs the roles **Firebase Hosting Admin** and **Firebase Rules Admin** (Google Cloud console → IAM). This workflow has not been run on GitHub yet.

## Run locally with emulators (no cloud account)
```bash
npm run emulators                       # terminal 1 (Auth + Firestore; needs Java 21+)
npm run test:rules                      # security rules + payment approval checks (emulators running)
npm run test:ai                         # AI proxy checks with simulated providers (emulators running)
NEXT_PUBLIC_USE_EMULATORS=true NEXT_PUBLIC_DEMO_BILLING=true npm run dev   # terminal 2 → http://localhost:3000
```

## How security works
- Every personal document has `user_id`; rules only allow a signed-in user to read/write their own (tested: unauthenticated, other-user and self-upgrade attempts are denied).
- Accounts must have a **verified email** before they can read or write anything (Google accounts already are).
- Users cannot raise their own `plan` / `plan_until` / report credits or change their profile email. Plans change only through an admin approval, the billing webhook, or an unused sponsor code.
- Doctor links (`/share?id=…`) are single-document reads by a 32-character random id, time-limited and revocable; listing is impossible.
- AI keys users paste stay in their browser's localStorage and are sent only to the provider they chose.

## Limits of a no-server design (be honest with judges)
- Plan limits (documents, links…) are enforced in the app UI; a determined user could bypass them. The costly resource — managed AI — is metered **server-side** by the proxy worker (`billing/managed-ai-worker`).
- NVIDIA NIM blocks direct browser calls (CORS), so it works only via the proxy; Gemini, DeepSeek, OpenRouter and Anthropic work directly from the browser.
- Firestore free quota: ~50k reads / 20k writes per day, 1 GiB. Files are stored as chunked documents (10 MB max each).
