import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend } from 'firebase/ai';
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';

// Public web config. Not secret: App Check is what keeps others from using this project's AI quota.
export const firebaseConfig = {
  apiKey: 'AIzaSyAt4FTph_LtWz0djucZEAW3tU3NoC_DEMo',
  authDomain: 'lapor72.firebaseapp.com',
  projectId: 'lapor72',
  storageBucket: 'lapor72.firebasestorage.app',
  messagingSenderId: '755873474638',
  appId: '1:755873474638:web:9f0c093e2433cddf19bb1f',
};
const RECAPTCHA_SITE_KEY = '6Lf59SwuAAAAADPVxTrSIYzwsQQsdor637ZT7neg';

// On localhost App Check uses a debug token printed to the console; register it in the Firebase console.
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const app = initializeApp(firebaseConfig);
initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
export const ai = getAI(app, { backend: new GoogleAIBackend() });

// Firestore keeps a local copy, so saving works offline and syncs when the connection returns.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

export const auth = getAuth(app);
/** Anonymous account per browser, so each person's saved cases are private to them. */
export function currentUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (u) => {
      stop();
      if (u) resolve(u); else signInAnonymously(auth).then((c) => resolve(c.user), reject);
    });
  });
}

// Remote Config: the cloud model and the legal thresholds can change without a redeploy
// (for example if the Commissioner revises the guideline).
export const remoteConfig = getRemoteConfig(app);
remoteConfig.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
remoteConfig.defaultConfig = {
  cloud_model: 'gemini-3.5-flash-lite',
  hours_to_commissioner: 72,
  days_to_individuals: 7,
  significant_scale: 1000,
};
export const configReady = fetchAndActivate(remoteConfig).catch(() => false);
export const config = {
  cloudModel: () => getValue(remoteConfig, 'cloud_model').asString(),
  hoursToCommissioner: () => getValue(remoteConfig, 'hours_to_commissioner').asNumber(),
  daysToIndividuals: () => getValue(remoteConfig, 'days_to_individuals').asNumber(),
  significantScale: () => getValue(remoteConfig, 'significant_scale').asNumber(),
};
