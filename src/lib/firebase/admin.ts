import admin from "firebase-admin";

// This new structure ensures Firebase Admin is initialized only when one of its services is first accessed.
// This is safer for Next.js and provides better error handling.

let app: admin.app.App | null = null;
let initializationError: Error | null = null;
let initAttempted = false;

function ensureAdminInitialized() {
  if (initAttempted) return; // Only attempt to initialize once
  initAttempted = true;

  // If another part of the code initialized an app, use it.
  if (admin.apps.length > 0 && admin.apps[0]) {
    app = admin.apps[0];
    console.log("Firebase Admin SDK re-used existing instance.");
    return;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  // Check if all required environment variables are present.
  if (!projectId || !clientEmail || !process.env.FIREBASE_PRIVATE_KEY || !storageBucket) {
    initializationError = new Error("Missing Firebase Admin SDK service account credentials in environment variables.");
    console.error(
      "Firebase Admin SDK initialization skipped. " +
      "Required environment variables are missing. Please ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET are set."
    );
    return;
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
  } catch (error: any) {
    initializationError = error;
    console.error(
      "Firebase Admin SDK initialization error. Check service account credentials.",
      error.message
    );
  }
}

// A helper function to safely get a service, throwing an error only when the service is accessed.
function getService<T>(serviceGetter: () => T): T {
  ensureAdminInitialized();
  if (initializationError) {
    throw new Error(`Firebase Admin SDK failed to initialize. Cannot get service. Reason: ${initializationError.message}`);
  }
  if (!app) {
    throw new Error("Firebase Admin SDK is not initialized. Check server logs for configuration errors.");
  }
  return serviceGetter();
}

// We use a Proxy to create lazy-loaded exports.
// This means getService() is only called when you access a property
// on adminAuth, adminDb, or adminStorage for the first time.
export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(target, prop) {
    const service = getService(() => admin.auth());
    return Reflect.get(service, prop);
  },
});

export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(target, prop) {
    const service = getService(() => admin.firestore());
    return Reflect.get(service, prop);
  },
});

export const adminStorage = new Proxy({} as admin.storage.Storage, {
  get(target, prop) {
    const service = getService(() => admin.storage());
    return Reflect.get(service, prop);
  },
});

// New function for the health check page
export function getAdminSdkStatus() {
  ensureAdminInitialized(); // Ensure an initialization attempt has been made
  return {
    isInitialized: app !== null,
    error: initializationError ? initializationError.message : null,
  };
}
