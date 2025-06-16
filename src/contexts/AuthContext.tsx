
'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '@/lib/firebase/config';
import { getUserProfile, createUserProfileFS } from '@/lib/firebase/firestore';
import type { UserProfile, Role } from '@/types';
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  initialLoadComplete: boolean; 
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setRoleAndCompleteProfile: (role: Role, additionalData: Partial<Omit<UserProfile, 'role' | 'uid' | 'email' | 'displayName' | 'photoURL' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
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
        try {
          let profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
             // Ensure superAdmin status is reflected
            if (firebaseUser.email === 'pranavrathi07@gmail.com' && !profile.isSuperAdmin) {
                profile.isSuperAdmin = true; 
                // Optionally update Firestore if it's missing, but for client-side logic this is fine.
            }
            setUserProfile(profile);
            if (router && (window.location.pathname === '/login' || window.location.pathname === '/profile-setup')) {
              router.push('/dashboard');
            }
          } else {
            setUserProfile(null); 
            // If no profile, user needs to set it up.
            // The profile setup page itself will handle pre-filling role for Parul emails.
            if (router && window.location.pathname !== '/profile-setup') {
               router.push('/profile-setup');
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
          toast({ title: "Error", description: "Could not fetch user profile.", variant: "destructive" });
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
      setInitialLoadComplete(true);
    });

    return () => unsubscribe();
  }, [router, toast]);

  const signInWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      if (firebaseUser) {
        // Auth state change listener will handle profile fetching and redirection
      }
    } catch (error: any) {
      console.error("Error during Google sign-in:", error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        toast({ title: "Sign-in Cancelled", description: "The Google Sign-In popup was closed before completion.", variant: "default" });
      } else if (error.code === 'auth/unauthorized-domain') {
        toast({ title: "Sign-in Error", description: "This domain is not authorized for Firebase sign-in. Please contact support.", variant: "destructive" });
      }
      else {
        toast({ title: "Sign-in Error", description: error.message || "Failed to sign in with Google.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const setRoleAndCompleteProfile = async (role: Role, additionalData: Partial<Omit<UserProfile, 'role' | 'uid' | 'email' | 'displayName' | 'photoURL' | 'createdAt' | 'updatedAt'>>) => {
    if (!user) {
      toast({ title: "Error", description: "No user logged in.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const newProfileData: Partial<UserProfile> = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName, // This is Firebase Auth display name
        photoURL: user.photoURL,
        role, // The role determined by the form logic (e.g., 'STUDENT' if Parul email, or selected)
        isSuperAdmin: user.email === 'pranavrathi07@gmail.com', // Set super admin status
        ...additionalData, // This includes all other form fields like fullName, contactNumber, etc.
      };
      const createdProfile = await createUserProfileFS(user.uid, newProfileData);
      setUserProfile(createdProfile);
      router.push('/dashboard');
      toast({ title: "Profile Updated", description: "Your profile has been successfully set up." });
    } catch (error: any) {
      console.error("Error setting role and profile:", error);
      toast({ title: "Profile Setup Error", description: error.message || "Failed to set up profile.", variant: "destructive" });
      throw error; // Re-throw to allow form to handle its state
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
      console.error("Error signing out:", error);
      toast({ title: "Sign-out Error", description: error.message || "Failed to sign out.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, initialLoadComplete, signInWithGoogle, signOut, setRoleAndCompleteProfile }}>
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
