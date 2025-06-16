
'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '@/lib/firebase/config';
import { getUserProfile, createUserProfileFS } from '@/lib/firebase/firestore';
import type { UserProfile, Role } from '@/types'; // UserProfile type now includes all new fields
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
  // The additionalData type should now reflect the more comprehensive UserProfile structure
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
        try {
          let profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            // Ensure superAdmin status is reflected correctly
            if (firebaseUser.email === 'pranavrathi07@gmail.com' && !profile.isSuperAdmin) {
                profile.isSuperAdmin = true; 
            }
            setUserProfile(profile);
            // If user is logged in and has a profile, but is on login/setup page, redirect to dashboard
            if (router && (window.location.pathname === '/login' || window.location.pathname === '/profile-setup')) {
              router.push('/dashboard');
            }
          } else {
            setUserProfile(null); 
            // No profile exists, redirect to profile setup page if not already there.
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
        // If user logs out or session expires, and they are on a protected route, redirect to login.
        // DashboardLayout handles this for /dashboard/* routes.
        // For other potential protected routes, this logic might need expansion or be handled at page/layout level.
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
      // const firebaseUser = result.user;
      // Auth state change listener (useEffect above) will handle fetching/creating profile and redirection.
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
      // Loading will be set to false by the onAuthStateChanged listener
    }
  };

  const setRoleAndCompleteProfile = async (
    role: Role, 
    additionalData: Omit<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL' | 'role' | 'isSuperAdmin' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) {
      toast({ title: "Error", description: "No user logged in.", variant: "destructive" });
      return Promise.reject(new Error("No user logged in."));
    }
    setLoading(true);
    try {
      const profileDataForCreation: Partial<UserProfile> = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName, // Firebase Auth display name
        photoURL: user.photoURL,
        role,
        isSuperAdmin: user.email === 'pranavrathi07@gmail.com',
        ...additionalData, // This now includes all new fields from the form
      };
      const createdProfile = await createUserProfileFS(user.uid, profileDataForCreation);
      setUserProfile(createdProfile); // Update local state with the full profile from Firestore
      router.push('/dashboard');
      toast({ title: "Profile Updated", description: "Your profile has been successfully set up." });
    } catch (error: any) {
      console.error("Error setting role and profile:", error);
      toast({ title: "Profile Setup Error", description: error.message || "Failed to set up profile.", variant: "destructive" });
      throw error; // Re-throw to allow form to handle its state (e.g., stop loading spinner)
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
      router.push('/login'); // Redirect to login after sign out
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

