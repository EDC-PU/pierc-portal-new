import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
// import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAzjb4HkO4zgIUs9RW71tkWAjK_EJtLgsI",
  authDomain: "pierc-portal.firebaseapp.com",
  projectId: "pierc-portal",
  storageBucket: "pierc-portal.firebasestorage.app",
  messagingSenderId: "603360357694",
  appId: "1:603360357694:web:d8f13b55860e4b1e56506f"
};

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app); // Initialize Firebase Functions
// const analytics = getAnalytics(app);

export { app, auth, db, functions }; // Export functions
