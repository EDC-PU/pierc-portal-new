
'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db, functions as firebaseFunctions } from '@/lib/firebase/config'; // Ensure functions is imported
import { getUserProfile, createUserProfileFS, createIdeaFromProfile, getIdeaWhereUserIsTeamMember, getIdeaById } from '@/lib/firebase/firestore';
import type { UserProfile, Role, IdeaSubmission } from '@/types';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword as firebaseSignInWithEmailPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner'; // For potential use if returning a loader

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  initialLoadComplete: boolean;
  isTeamMemberForIdea: IdeaSubmission | null; // If user is part of an idea as a member
  teamLeaderProfileForMember: UserProfile | null; // Profile of the leader of that idea

  signInWithGoogle: () => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setRoleAndCompleteProfile: (role: Role, additionalData: Omit<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL' | 'role' | 'isSuperAdmin' | 'createdAt' | 'updatedAt' | 'isTeamMemberOnly' | 'associatedIdeaId' | 'associatedTeamLeaderUid'>) => Promise<void>;
  deleteCurrentUserAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isTeamMemberForIdea, setIsTeamMemberForIdea] = useState<IdeaSubmission | null>(null);
  const [teamLeaderProfileForMember, setTeamLeaderProfileForMember] = useState<UserProfile | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser); // Set Firebase user immediately

      if (firebaseUser) {
        let profile = await getUserProfile(firebaseUser.uid);
        let ideaMembership: IdeaSubmission | null = null;
        let leaderProfile: UserProfile | null = null;

        if (profile) {
          if (firebaseUser.email === 'pranavrathi07@gmail.com') {
              profile.isSuperAdmin = true;
              profile.role = 'ADMIN_FACULTY';
          }
          setUserProfile(profile);

          if (profile.isTeamMemberOnly && profile.associatedIdeaId) {
            ideaMembership = await getIdeaById(profile.associatedIdeaId);
            if (ideaMembership && ideaMembership.userId) {
               leaderProfile = await getUserProfile(ideaMembership.userId);
            }
          }
          // If existing profile and not explicitly team member only, they are likely an owner
          // No need to search for idea membership again unless the profile itself indicates it.

        } else { // No profile exists, could be new user or first login after being added as team member
          ideaMembership = await getIdeaWhereUserIsTeamMember(firebaseUser.email!);
          if (ideaMembership && ideaMembership.userId) {
            leaderProfile = await getUserProfile(ideaMembership.userId);
          }
          setUserProfile(null); // Explicitly set to null if no profile found yet
        }

        setIsTeamMemberForIdea(ideaMembership);
        setTeamLeaderProfileForMember(leaderProfile);

        if (profile) { // Profile exists
          if (router && (window.location.pathname === '/login' || window.location.pathname === '/profile-setup')) {
            router.push('/dashboard');
          }
        } else { // No profile, redirect to setup
           if (router && window.location.pathname !== '/profile-setup' && window.location.pathname !== '/login') {
             router.push('/profile-setup');
           }
        }

      } else { // No Firebase user
        setUser(null);
        setUserProfile(null);
        setIsTeamMemberForIdea(null);
        setTeamLeaderProfileForMember(null);
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
    additionalData: Omit<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL' | 'role' | 'isSuperAdmin' | 'createdAt' | 'updatedAt' | 'isTeamMemberOnly' | 'associatedIdeaId' | 'associatedTeamLeaderUid'>
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

    const profileDataForCreation: Partial<UserProfile> = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || additionalData.fullName,
        photoURL: user.photoURL,
        role: actualRole,
        isSuperAdmin: isSuperAdminEmail,
        ...additionalData,
    };

    let createdOrUpdatedProfile: UserProfile;

    if (isTeamMemberForIdea) { // User was identified as a team member for an existing idea
        profileDataForCreation.isTeamMemberOnly = true;
        profileDataForCreation.associatedIdeaId = isTeamMemberForIdea.id;
        profileDataForCreation.associatedTeamLeaderUid = isTeamMemberForIdea.userId;
        // For team members, these idea-specific fields are not set from their own profile form
        delete profileDataForCreation.startupTitle;
        delete profileDataForCreation.problemDefinition;
        delete profileDataForCreation.solutionDescription;
        delete profileDataForCreation.uniqueness;
        delete profileDataForCreation.currentStage;
        delete profileDataForCreation.applicantCategory;
        delete profileDataForCreation.teamMembers; // Free text
    } else {
        profileDataForCreation.isTeamMemberOnly = false;
    }


    try {
      createdOrUpdatedProfile = await createUserProfileFS(user.uid, profileDataForCreation);

      // Only create an idea if the user is NOT just a team member and has idea details
      if (!profileDataForCreation.isTeamMemberOnly && additionalData.startupTitle && additionalData.startupTitle !== 'Administrative Account') {
        await createIdeaFromProfile(user.uid, {
            startupTitle: additionalData.startupTitle,
            problemDefinition: additionalData.problemDefinition,
            solutionDescription: additionalData.solutionDescription,
            uniqueness: additionalData.uniqueness,
            currentStage: additionalData.currentStage,
            applicantCategory: additionalData.applicantCategory,
            teamMembers: additionalData.teamMembers || '',
        });
      }
      
      // Update local state after successful creation/update.
      // Re-fetch from onAuthStateChanged might be slightly delayed.
      setUserProfile(createdOrUpdatedProfile);
      if (createdOrUpdatedProfile.isTeamMemberOnly && createdOrUpdatedProfile.associatedIdeaId) {
        const idea = await getIdeaById(createdOrUpdatedProfile.associatedIdeaId);
        setIsTeamMemberForIdea(idea);
        if (idea && idea.userId) {
          const leader = await getUserProfile(idea.userId);
          setTeamLeaderProfileForMember(leader);
        }
      }


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

  const deleteCurrentUserAccount = async () => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "No user is currently logged in.", variant: "destructive" });
      throw new Error("User not authenticated");
    }
    if (user.email === 'pranavrathi07@gmail.com') {
        toast({ title: "Action Restricted", description: "The primary super admin account cannot be deleted.", variant: "default" });
        throw new Error("Primary super admin cannot be deleted.");
    }

    setLoading(true);
    try {
      const userProfileRef = doc(db, 'users', user.uid);
      await deleteDoc(userProfileRef);
      toast({ title: "Profile Data Deleted", description: "Your profile information has been removed."});

      const deleteAuthFn = httpsCallable(firebaseFunctions, 'deleteMyAuthAccountCallable');
      await deleteAuthFn();

      await firebaseSignOut(auth);
      toast({ title: "Account Deleted", description: "Your account has been successfully deleted. You have been signed out." });

    } catch (error: any) {
      console.error("Error deleting user account:", error);
      await firebaseSignOut(auth).catch(e => console.error("Sign out failed after delete error:", e));
      toast({ title: "Account Deletion Failed", description: error.message || "Could not fully delete your account. Please contact support.", variant: "destructive" });
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
      setIsTeamMemberForIdea(null);
      setTeamLeaderProfileForMember(null);
      router.push('/login');
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
    } catch (error: any) {
      handleAuthError(error, "sign-out");
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-background z-[9999]">
            <LoadingSpinner size={32} />
            <p className="ml-2 text-muted-foreground">Initializing Authentication...</p>
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      initialLoadComplete,
      isTeamMemberForIdea,
      teamLeaderProfileForMember,
      signInWithGoogle,
      signUpWithEmailPassword,
      signInWithEmailPassword,
      signOut,
      setRoleAndCompleteProfile,
      deleteCurrentUserAccount
    }}>
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
