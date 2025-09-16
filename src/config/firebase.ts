import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize Analytics (optional - only in production and if supported)
// Disabled for now to avoid ad blocker issues
// Uncomment if you want to enable analytics
/*
import { getAnalytics, isSupported } from 'firebase/analytics';
isSupported().then(supported => {
  if (supported && import.meta.env.PROD) {
    try {
      getAnalytics(app);
    } catch (error) {
      console.log('Analytics blocked or not available');
    }
  }
}).catch(() => {
  console.log('Analytics not supported');
});
*/

export default app;