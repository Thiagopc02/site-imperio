// src/firebase/config.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// =========================
// Firebase ENV (sempre NEXT_PUBLIC_* no front)
// =========================
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Garante uma única instância (bom para HMR)
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Exposição de debug (opcional)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).__FIREBASE_APP__ = app;
}

// =========================
// App Check (reCAPTCHA v3)
// - Só inicializa SE NEXT_PUBLIC_APPCHECK_ENABLED === "true"
// - Quando ligado, usa:
//     NEXT_PUBLIC_RECAPTCHA_SITE_KEY  (ou)
//     NEXT_PUBLIC_APPCHECK_V3_SITE_KEY
// - Debug opcional:
//     NEXT_PUBLIC_APPCHECK_DEBUG = "true"
//     NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN (opcional)
// =========================
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_APPCHECK_ENABLED === 'true') {
  (async () => {
    try {
      const siteKeyV3 =
        process.env.NEXT_PUBLIC_APPCHECK_V3_SITE_KEY ||
        process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
        '';

      if (!siteKeyV3) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[AppCheck] Habilitado, mas sem site key. Ignorando init.');
        }
        return;
      }

      const { initializeAppCheck, ReCaptchaV3Provider, getToken } = await import('firebase/app-check');

      // Evita múltiplas inits em HMR
      const w = window as unknown as { __APP_CHECK_INIT__?: boolean };
      if (w.__APP_CHECK_INIT__) return;

      // Debug local
      const debugEnabled = process.env.NEXT_PUBLIC_APPCHECK_DEBUG === 'true';
      const debugToken = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
      if (debugEnabled) {
        // propriedade “mágica” lida pelo SDK
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken || true;
      }

      const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKeyV3),
        isTokenAutoRefreshEnabled: true,
      });
      w.__APP_CHECK_INIT__ = true;

      // Token inicial (não força refresh)
      try {
        await getToken(appCheck);
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[AppCheck] getToken error:', e);
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AppCheck] init error:', e);
      }
    }
  })();
}

// =========================
// Firestore / Auth
// =========================
export const db = getFirestore(app);

// Única instância principal de Auth (recomendado)
export const auth: Auth = getAuth(app);

// (Opcional) App/Auth secundário “admin”. Se não usar em lugar nenhum,
// pode remover este bloco e usar só `auth` no projeto.
const adminApp =
  getApps().find((a) => a.name === 'admin') ?? initializeApp(firebaseConfig, 'admin');
export const adminAuth: Auth = getAuth(adminApp);

// Persistência local (somente no browser)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  setPersistence(adminAuth, browserLocalPersistence).catch(() => {});
}

export { app };
