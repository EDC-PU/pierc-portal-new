
import { auth } from './config';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged, 
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  signInWithEmailAndPassword as firebaseSignInWithEmailPassword,
  type User 
} from 'firebase/auth';

// Functions for direct use if needed, though AuthContext handles main flow

export const signInWithGooglePopup = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const createUserWithEmailPassword = async (email: string, password: string) => {
  try {
    const userCredential = await firebaseCreateUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error creating user with email and password:", error);
    throw error;
  }
};

export const signInWithEmailPassword = async (email: string, password: string) => {
  try {
    const userCredential = await firebaseSignInWithEmailPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in with email and password:", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};

// Get the current user (can be null if not signed in)
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
