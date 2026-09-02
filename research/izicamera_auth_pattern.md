# IziCamera sign-in / onboarding pattern (reference only — no code shared)

Studied 2026-09-02 so IziCost recreates the same user experience with its own code.

## Auth
- Four paths on one screen: email+password (`signUp` / `signInWithPassword`), Google OAuth (PKCE), **Guest** (`signInAnonymously`) with a warning that data lives only on this login, forgot-password via deep link.
- **Guest -> account upgrade:** `updateUser({ email, password })` on the anonymous user — same uid, all rows stay. This is the pattern for IziCost.
- No `profiles` table, no auth trigger; tables key on `auth.uid()` with RLS.
- Client: AsyncStorage session, `persistSession`, `autoRefreshToken`, `detectSessionInUrl:false`, `flowType:'pkce'`.
- Gating: no `(auth)` route group; root layout renders `LoadingSplash -> AuthScreen (if no session) -> Onboarding (AsyncStorage 'hasSeenOnboarding') -> Stack`. AuthProvider hydrates from AsyncStorage first so the app opens instantly; `signOut({ scope: 'local' })`.
- Validation minimal: non-empty, password >= 6; errors via `Alert.alert(t('Error'), err.message)`.
- i18n: English string is the key; PT dictionary; EN/PT pill toggle on the first screen.

## Visual style
Dark theme: bg `#000`/`#0a0a0a`, accent `#0af`, brand orange `#ef8d0e` (logo only). Inputs `#1a1a1a` bg, `#333` border, radius 12, padding 16. Primary button `#0af`, radius 12, padding 16, bold 17-18 white, opacity 0.5 when busy. Guest button `#1a1a1a` + `#333` border. Upgrade card: `rgba(0,170,255,0.08)` bg + `rgba(0,170,255,0.4)` border, radius 14. Layout: SafeArea > KeyboardAvoiding > ScrollView centred, form maxWidth 480, padding 24. Logo: dark badge, orange circle "izi", wordmark izi(orange)+camera(white).

## Recommendation adopted for IziCost
1. Cold start: silent `signInAnonymously()` -> straight to Home (no auth screen).
2. "Guest" chip on Home; upgrade card "Keep your receipts safe" (email + password) -> `updateUser` -> stays logged in.
3. Me/Settings: sign out (this phone only) with hard warning for guests; sign in with another account (`signInWithPassword`).
4. Drop Google OAuth and deep-link password reset for v1; if reset is needed later use 6-digit OTP (`signInWithOtp` + `verifyOtp`).
