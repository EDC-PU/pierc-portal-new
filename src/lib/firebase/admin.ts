
import 'dotenv/config';
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
  
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // The private key must have its escaped newlines replaced with actual newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  // Check if all required environment variables are present and throw a clear error if not.
  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new Error(
      'Firebase Admin initialization failed: Missing required environment variables. Ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET are set in your .env file.'
    );
  }
  
  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey,
      }),
      storageBucket,
    });
    console.log("Firebase Admin SDK initialized on first use.");
  } catch (error: any) {
     console.error('Firebase Admin SDK initialization error. Check your service account credentials.', error);
     // Re-throw a more specific error to help with debugging by including the original Firebase error message.
     throw new Error(`Firebase Admin SDK initialization failed: ${error.message}. Please check your service account credentials in the .env file.`);
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
