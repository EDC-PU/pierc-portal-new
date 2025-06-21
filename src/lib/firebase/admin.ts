
import * as admin from 'firebase-admin';

// This new structure ensures Firebase Admin is initialized only when one of its services is first accessed.
// This is safer for Next.js and provides better error handling.

let app: admin.app.App;

function ensureAdminInitialized() {
  // If the app is already initialized, do nothing.
  if (app) {
    return;
  }
  // If another part of the code initialized an app, use it.
  if (admin.apps.length > 0 && admin.apps[0]) {
    app = admin.apps[0];
    return;
  }
  
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  };

  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  // Check if all required environment variables are present and throw a clear error if not.
  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey || !storageBucket) {
    throw new Error(
      'Firebase admin initialization failed: Missing required environment variables. Ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET are set in your .env file.'
    );
  }
  
  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        ...serviceAccount,
        // The 'replace' is crucial for keys stored in single-line env vars.
        privateKey: serviceAccount.privateKey.replace(/\\n/g, '\n'),
      }),
      storageBucket,
    });
    console.log("Firebase Admin SDK initialized on first use.");
  } catch (error: any) {
     console.error('Firebase Admin SDK initialization error. Check your service account credentials.', error.stack);
     throw new Error('Firebase Admin SDK could not be initialized. See server logs for details.');
  }
}

// We use a Proxy to create lazy-loaded exports.
// This means ensureAdminInitialized() is only called when you access a property
// on adminAuth, adminDb, or adminStorage for the first time.
export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(target, prop) {
    ensureAdminInitialized();
    return Reflect.get(admin.auth(), prop);
  },
});

export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(target, prop) {
    ensureAdminInitialized();
    return Reflect.get(admin.firestore(), prop);
  },
});

export const adminStorage = new Proxy({} as admin.storage.Storage, {
  get(target, prop) {
    ensureAdminInitialized();
    return Reflect.get(admin.storage(), prop);
  },
});
