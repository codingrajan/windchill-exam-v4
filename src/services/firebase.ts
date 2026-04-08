import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const firebaseFallbackConfig = {
  apiKey: 'AIzaSyDqe4YXGVtglnjC3W1ODV4zRcADWtVFjSM',
  authDomain: 'windchill-mock-exam-v4.firebaseapp.com',
  projectId: 'windchill-mock-exam-v4',
  storageBucket: 'windchill-mock-exam-v4.firebasestorage.app',
  messagingSenderId: '1088263687851',
  appId: '1:1088263687851:web:013cd37e168d565e9071ee',
  measurementId: 'G-B2ZEEBH0SE',
} as const;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseFallbackConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseFallbackConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseFallbackConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseFallbackConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseFallbackConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseFallbackConfig.appId,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || firebaseFallbackConfig.measurementId,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
