
'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '@/lib/firebase/config';
import { getUserProfile, createUserProfileFS, createIdeaFromProfile } from '@/lib/firebase/firestore';
import type { UserProfile, Role } from '@/types';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword as firebaseSignInWithEmailPassword
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  initialLoadComplete: boolean; 
  signInWithGoogle: () => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setRoleAndCompleteProfile: (role: Role, additionalData: Omit<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL' | 'role' | 'isSuperAdmin' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        let profileExists = false; 
        try {
          let profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            if (firebaseUser.email === 'pranavrathi07@gmail.com') {
                profile.isSuperAdmin = true;
                profile.role = 'ADMIN_FACULTY';
            }
            setUserProfile(profile);
            profileExists = true;
            if (router && (window.location.pathname === '/login' || window.location.pathname === '/profile-setup')) {
              router.push('/dashboard');
            }
          } else {
            setUserProfile(null); 
            profileExists = false;
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
          profileExists = false; 
          if (!String(error).includes("Missing or insufficient permissions")) {
             toast({ title: "Profile Check Error", description: "Could not verify user profile.", variant: "destructive" });
          }
        }

        if (!profileExists && router && window.location.pathname !== '/profile-setup' && window.location.pathname !== '/login') {
          router.push('/profile-setup');
        }

      } else {
        setUser(null);
        setUserProfile(null);
         if (router && !['/login', '/'].includes(window.location.pathname) && !window.location.pathname.startsWith('/_next')) {
            router.push('/login');
        }
      }
      setLoading(false);
      setInitialLoadComplete(true);
    });

    return () => unsubscribe();
  }, [router, toast]);

  const handleAuthError = (error: any, action: string) => {
    console.error(`Error during ${action}:`, error);
    let message = error.message || `Failed to ${action}.`;
    if (error.code) {
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          message = `The ${action} popup was closed before completion. Please try again.`;
          break;
        case 'auth/cancelled-popup-request':
          message = `The ${action} request was cancelled. Please try again.`;
          break;
        case 'auth/unauthorized-domain':
          message = `This domain is not authorized for Firebase ${action}. Please check Firebase console settings.`;
          break;
        case 'auth/email-already-in-use':
          message = 'This email address is already in use. Please try signing in or use a different email.';
          break;
        case 'auth/weak-password':
          message = 'The password is too weak. Please use a stronger password.';
          break;
        case 'auth/invalid-credential': 
        case 'auth/user-not-found': 
        case 'auth/wrong-password': 
          message = 'Invalid email or password. Please check your credentials and try again.';
          break;
        default:
          message = `An error occurred during ${action}. Code: ${error.code}`;
      }
    }
    toast({ title: `${action.charAt(0).toUpperCase() + action.slice(1)} Error`, description: message, variant: "destructive" });
    setLoading(false);
    throw error; 
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle profile loading and redirection
    } catch (error: any) {
      handleAuthError(error, "Google sign-in");
    } 
  };

  const signUpWithEmailPassword = async (email: string, password: string) => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle profile loading and redirection
    } catch (error: any) {
      handleAuthError(error, "sign-up");
    }
  };

  const signInWithEmailPassword = async (email: string, password: string) => {
    setLoading(true);
    try {
      await firebaseSignInWithEmailPassword(auth, email, password);
      // onAuthStateChanged will handle profile loading and redirection
    } catch (error: any) {
      handleAuthError(error, "sign-in");
    }
  };

  const setRoleAndCompleteProfile = async (
    roleFromForm: Role, 
    additionalData: Omit<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL' | 'role' | 'isSuperAdmin' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) {
      toast({ title: "Error", description: "No user logged in.", variant: "destructive" });
      return Promise.reject(new Error("No user logged in."));
    }
    setLoading(true);
    
    let actualRole = roleFromForm;
    const isSuperAdminEmail = user.email === 'pranavrathi07@gmail.com';
    if (isSuperAdminEmail) {
      actualRole = 'ADMIN_FACULTY'; 
    }

    try {
      const profileDataForCreation: Partial<UserProfile> = {
        uid: user.uid,
        email: user.email, 
        displayName: user.displayName || additionalData.fullName, 
        photoURL: user.photoURL,
        role: actualRole,
        isSuperAdmin: isSuperAdminEmail,
        ...additionalData,
      };
      const createdProfile = await createUserProfileFS(user.uid, profileDataForCreation);
      
      // Create an idea submission if it's not an admin's placeholder profile
      if (additionalData.startupTitle && additionalData.startupTitle !== 'Administrative Account') {
        await createIdeaFromProfile(user.uid, {
            startupTitle: additionalData.startupTitle,
            problemDefinition: additionalData.problemDefinition,
            solutionDescription: additionalData.solutionDescription,
            uniqueness: additionalData.uniqueness,
            currentStage: additionalData.currentStage,
            applicantCategory: additionalData.applicantCategory,
        });
      }
      
      setUserProfile(createdProfile); 
      router.push('/dashboard');
      toast({ title: "Profile Updated", description: "Your profile has been successfully set up." });
    } catch (error: any) {
      console.error("Profile setup failed", error);
      toast({ title: "Profile Setup Error", description: error.message || "Failed to set up profile.", variant: "destructive" });
      throw error; 
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      router.push('/login'); 
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
    } catch (error: any) {
      handleAuthError(error, "sign-out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, initialLoadComplete, signInWithGoogle, signUpWithEmailPassword, signInWithEmailPassword, signOut, setRoleAndCompleteProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
