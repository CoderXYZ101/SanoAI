# SanoAI

**Understand your health. Connect the dots.** (“Sano” — Latin for *to heal*.) Built for Spark X Tech Fest — Generative AI, Theme S2: HealGen.

A Generative-AI healthcare intelligence platform that reconstructs your medical history from your own documents, shows what the records **don't** say, communicates uncertainty explicitly, links findings across specialties on an interactive 3D body map, and helps you talk to clinicians. It is an information tool — it cannot diagnose, treat or prescribe.

## Architecture (free, no server)
`GitHub (code) → Firebase Hosting (static app) + Firebase Auth + Cloud Firestore`. All analysis engines run **in the browser**; Firestore security rules are the security boundary. AI is optional: with the proxy set up, users choose **SanoAI AI** (the owner's key, never visible to them) or **Built-in rules**; a local Ollama model is also supported. See **FIREBASE.md** (deploy), **AI-SETUP.md** (AI) and **BILLING.md** (plans).

## Run it
```bash
npm install
cp .env.example .env.local        # Firebase web config, or use emulators
npm run emulators                 # terminal 1 (Auth + Firestore)
NEXT_PUBLIC_USE_EMULATORS=true NEXT_PUBLIC_DEMO_BILLING=true npm run dev   # terminal 2
```
Register, verify the email (with emulators, open the link printed in the emulator terminal), then **Load synthetic demo records**. `npm run eval` runs 71 offline checks of the AI engines; `npm run test:rules` and `npm run test:ai` check the security rules and the AI proxy against the running emulators.

## Features
Medical Timeline reconstruction (source-linked, uncertain dates flagged) · Blind-Spot Detector · Uncertainty Engine · Cross-Specialty map (3D) · Counterfactual Simulator (educational) · Deficiency Finder · AI Health Assistant with citations, voice and safety triage · **Health Diary** with trends · **Secure doctor links** (expiring, revocable) · Doctor Brief · Pharmacy tools · Free/Plus/Pro plans · AI transparency ledger · data export and account deletion · Google sign-in and email verification · UPI payment claims with an admin approval page.

## Honest status
- Verified in a real browser against the Firebase **emulators**: register, email verification, login, demo records, all modules, plan limits, share links, a UPI claim and its admin approval. `test:rules` covers the security rules (other-user, self-upgrade, self-approval and reference reuse are denied).
- Google sign-in is checked only at the account/rules level on the emulator; the popup itself, real verification emails and a real UPI payment have not been tried.
- Deployed to Firebase Hosting with the AI relay on Cloudflare. Signed-in features and live AI answers on the deployed site still need a full manual check. The Razorpay webhook worker has not been run.
- Doctors/pharmacies are fictional demo data. The knowledge base is a short summary of public sources and needs clinical review before real use.
- A previous server-based version lives in `../SanoAI-server-edition`.
