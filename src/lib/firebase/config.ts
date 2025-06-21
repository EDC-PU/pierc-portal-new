
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
// import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Map of config keys to their expected environment variable names.
// This is used for creating a more accurate error message.
const configToEnvVarMap: Record<keyof typeof firebaseConfig, string> = {
    apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
    authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
};

// Check if all required environment variables are defined.
const missingConfig = (Object.keys(firebaseConfig) as Array<keyof typeof firebaseConfig>).filter(
    key => !firebaseConfig[key]
);

if (missingConfig.length > 0) {
    // Generate an accurate list of the missing environment variable names.
    const missingKeys = missingConfig.map(key => configToEnvVarMap[key]);
    throw new Error(
        `Firebase client initialization failed: Missing required environment variables. Please ensure the following are set in your .env file: ${missingKeys.join(', ')}`
    );
}


// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app); // Export functions
// const analytics = getAnalytics(app);

export { app, auth, db, functions }; // Export functions
