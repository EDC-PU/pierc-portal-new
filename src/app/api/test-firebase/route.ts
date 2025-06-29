import { NextResponse } from 'next/server';
import { adminDb, adminAuth, adminStorage, getAdminSdkStatus } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET() {
  const initStatus = getAdminSdkStatus();
  
  let serviceAccountTest: any = {
      status: initStatus.isInitialized ? 'success' : 'error',
      message: initStatus.error || 'Service account credentials appear valid and SDK is initialized.',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  let firestoreTest: any = { status: 'error', message: 'Test not run due to service account failure.', canRead: false, canWrite: false };
  if (initStatus.isInitialized) {
    try {
      const testDocRef = adminDb.collection('__health-checks').doc('firestore-test');
      await testDocRef.set({ timestamp: Timestamp.now(), status: 'write-ok' });
      firestoreTest.canWrite = true;
      const doc = await testDocRef.get();
      if (doc.exists && doc.data()?.status === 'write-ok') {
        firestoreTest.canRead = true;
        firestoreTest.status = 'success';
        firestoreTest.message = 'Successfully wrote to and read from the database.';
        await testDocRef.delete(); // Clean up
      } else {
        throw new Error('Read verification failed after successful write.');
      }
    } catch (e: any) {
      firestoreTest.message = `Firestore test failed: ${e.message}`;
    }
  }

  let authTest: any = { status: 'error', message: 'Test not run due to service account failure.', canListUsers: false };
    if (initStatus.isInitialized) {
        try {
            await adminAuth.listUsers(1);
            authTest.status = 'success';
            authTest.message = 'Successfully connected to Firebase Authentication service.';
            authTest.canListUsers = true;
        } catch (e: any) {
            authTest.message = `Firebase Auth test failed: ${e.message}`;
        }
    }


  let storageTest: any = { status: 'error', message: 'Test not run due to service account failure.', bucketExists: false };
    if (initStatus.isInitialized) {
        try {
            const bucket = adminStorage.bucket();
            const [exists] = await bucket.exists();
            storageTest.bucketExists = exists;
            if (exists) {
                storageTest.status = 'success';
                storageTest.message = 'Successfully connected to the default Firebase Storage bucket.';
                storageTest.bucketName = bucket.name;
            } else {
                storageTest.status = 'error';
                storageTest.message = `The specified bucket (${bucket.name}) does not exist. Please check your storage bucket name in the environment variables.`;
                storageTest.bucketName = bucket.name;
            }
        } catch (e: any) {
            storageTest.message = `Firebase Storage test failed: ${e.message}`;
        }
    }

  const allTests = [serviceAccountTest, firestoreTest, authTest, storageTest];
  const overallStatus = allTests.every(t => t.status === 'success') ? 'success' : 'error';
  const overallMessage = overallStatus === 'success' ? 'All systems are operational.' : 'One or more systems have issues.';


  const responsePayload = {
    timestamp: new Date().toISOString(),
    overallStatus,
    message: overallMessage,
    tests: {
      firestore: firestoreTest,
      auth: authTest,
      storage: storageTest,
      serviceAccount: serviceAccountTest,
    },
    debug: {
      environment: {
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasPublicProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        hasPublicStorageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        publicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        publicStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      },
      initializationStatus: initStatus.error ? `Failed: ${initStatus.error}` : (initStatus.isInitialized ? 'Initialized successfully.' : 'Not initialized. Missing env vars?'),
    }
  };

  return NextResponse.json(responsePayload, {
        status: 200, // Always return 200, let the payload indicate errors
    });
}
