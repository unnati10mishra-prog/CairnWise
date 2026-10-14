# Cairnwise mobile client

This is a minimal real Expo React Native client for the versioned Cairnwise API. It uses the API for all workspaces, brands, candidates, evidence, coverage, cases, decisions, and report drafts. It contains no fake queue data, local password authentication, or background monitoring.

## Setup

1. Start the Cairnwise API from the repository root:

   ```powershell
   python run_server.py
   ```

2. Copy the environment example and fill in public values:

   ```powershell
   Copy-Item .env.example .env
   ```

   Required values:

   - `EXPO_PUBLIC_API_BASE_URL`: API origin, without `/v1`.
   - `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL.
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` **or** `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: browser-safe public key only.

   Never put a server-only service credential, JWT secret, or any other backend credential in an Expo environment variable.

3. Install and run:

   ```powershell
   npm install
   npm run start
   ```

   Useful scripts are `npm run android`, `npm run ios`, `npm run web`, and `npm run typecheck`.

### Local API addresses

- A physical phone cannot use its own `localhost`; use the host computer's LAN IP and make sure the API binds/reaches that interface.
- The Android emulator maps the host computer to `10.0.2.2`, so use `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8765` for the local server.
- iOS Simulator can generally use `http://127.0.0.1:8765`.

## Google/Supabase redirect setup

The app registers the `cairnwise` deep-link scheme and uses `cairnwise://auth/callback` for the OAuth return. Add that exact URL to the Supabase Auth URL configuration / redirect allow-list, and enable Google as a Supabase provider. The app opens the returned OAuth URL with `expo-web-browser`, exchanges the PKCE code (or callback session tokens), and lets Supabase persist the session in AsyncStorage. The current Supabase access token is also kept in AsyncStorage for the API Bearer session and is sent as `Authorization: Bearer <access token>` to Cairnwise.

If the public values are absent, the app disables the sign-in action and visibly names the missing environment variables. OAuth callback errors are also rendered in the app.

## Mobile acceptance checklist

- [ ] `npm install` completes in `mobile/` and `npm run typecheck` passes.
- [ ] With the three public environment values set, Google sign-in opens and returns through `cairnwise://auth/callback`.
- [ ] The app loads `/v1/auth/me`, allows workspace selection, and loads `/v1/workspaces/{id}/brands`.
- [ ] A selected brand loads `/v1/brands/{brand}/candidates` and `/v1/brands/{brand}/coverage`.
- [ ] Selecting a candidate loads its evidence and shows source mode plus independent assessment dimensions.
- [ ] Source `unavailable` states are shown as unavailable and never presented as an all-clear.
- [ ] A reviewer can open a case, record `monitor`, `investigate`, or `insufficient_evidence` with a reason, and generate a report draft through the API.
- [ ] Removing Supabase/API env values produces visible setup instructions rather than fake data.

No native build is claimed by this repository check when Expo dependencies or a device/simulator are unavailable; use the commands above for the device acceptance pass.
