
'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db, functions as firebaseFunctions } from '@/lib/firebase/config';
import {
    getUserProfile,
    createUserProfileFS,
    createIdeaFromProfile,
    getIdeaWhereUserIsTeamMember,
    getIdeaById,
    updateTeamMemberDetailsInIdeaAfterProfileSetup,
    logUserActivity
} from '@/lib/firebase/firestore';
import type { UserProfile, Role, IdeaSubmission, TeamMember, ActivityLogAction } from '@/types';
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
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  initialLoadComplete: boolean;
  isTeamMemberForIdea: IdeaSubmission | null;
  teamLeaderProfileForMember: UserProfile | null;

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
    let lastUserUid: string | null = null; 

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setLoading(true);
      const isNewAuthUser = firebaseUser?.uid !== lastUserUid;
      lastUserUid = firebaseUser?.uid || null;
      setUser(firebaseUser);

      if (firebaseUser && auth.currentUser && firebaseUser.uid === auth.currentUser.uid) { 
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
        } else {
          setUserProfile(null); 
          if (firebaseUser.email) {
            ideaMembership = await getIdeaWhereUserIsTeamMember(firebaseUser.email);
            if (ideaMembership && ideaMembership.userId) {
              leaderProfile = await getUserProfile(ideaMembership.userId);
            }
          }
        }

        setIsTeamMemberForIdea(ideaMembership);
        setTeamLeaderProfileForMember(leaderProfile);

        if (profile) {
          if (isNewAuthUser) { 
             logUserActivity(firebaseUser.uid, profile.displayName || profile.fullName, 'USER_SIGNED_IN', undefined, { ipAddress: 'N/A', userAgent: 'N/A' });
          }
          if (router && (window.location.pathname === '/login' || window.location.pathname === '/profile-setup')) {
            router.push('/dashboard');
          }
        } else {
           if (router && window.location.pathname !== '/profile-setup' && window.location.pathname !== '/login') {
             router.push('/profile-setup');
           }
        }

      } else { 
        setUser(null);
        setUserProfile(null);
        setIsTeamMemberForIdea(null);
        setTeamLeaderProfileForMember(null);
        
        if (!firebaseUser && router && !['/login', '/'].includes(window.location.pathname) && !window.location.pathname.startsWith('/_next')) {
           router.push('/login');
        } else if (firebaseUser && (!auth.currentUser || firebaseUser.uid !== auth.currentUser.uid)) {
            console.warn("Auth state inconsistency detected during sign out or user change.", firebaseUser, auth.currentUser);
        }
      }
      setLoading(false);
      setInitialLoadComplete(true);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (error: any) {
      handleAuthError(error, "Google sign-in");
    }
  };

  const signUpWithEmailPassword = async (email: string, password: string) => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      handleAuthError(error, "sign-up");
    }
  };

  const signInWithEmailPassword = async (email: string, password: string) => {
    setLoading(true);
    try {
      await firebaseSignInWithEmailPassword(auth, email, password);
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
    const wasProfileExisting = !!userProfile;

    let actualRole = roleFromForm;
    const isSuperAdminEmail = user.email === 'pranavrathi07@gmail.com';
    if (isSuperAdminEmail) {
      actualRole = 'ADMIN_FACULTY'; 
    }

    // Determine if setting up as a team member based on AuthContext's state
    // (isTeamMemberForIdea is set if the user's email was found in an existing idea's teamMemberEmails list)
    const settingUpAsTeamMember = isTeamMemberForIdea !== null;

    // Construct the base profile data
    const profileDataForCreation: Partial<UserProfile> = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || additionalData.fullName, 
        photoURL: user.photoURL,
        role: actualRole,
        isSuperAdmin: isSuperAdminEmail,
        fullName: additionalData.fullName,
        contactNumber: additionalData.contactNumber,
        // Common optional fields
        enrollmentNumber: additionalData.enrollmentNumber || undefined,
        college: additionalData.college || undefined,
        instituteName: additionalData.instituteName || undefined,
        isTeamMemberOnly: settingUpAsTeamMember, 
    };
    
    if (settingUpAsTeamMember && isTeamMemberForIdea) {
        // Team Member specific fields
        profileDataForCreation.associatedIdeaId = isTeamMemberForIdea.id;
        profileDataForCreation.associatedTeamLeaderUid = isTeamMemberForIdea.userId;
        // Explicitly nullify idea owner fields
        profileDataForCreation.startupTitle = null;
        profileDataForCreation.problemDefinition = null;
        profileDataForCreation.solutionDescription = null;
        profileDataForCreation.uniqueness = null;
        profileDataForCreation.currentStage = null;
        profileDataForCreation.applicantCategory = null;
        profileDataForCreation.teamMembers = null; // The free-text field for team members
    } else {
        // Idea Owner specific fields (or Admin who is not a team member)
        profileDataForCreation.startupTitle = additionalData.startupTitle;
        profileDataForCreation.problemDefinition = additionalData.problemDefinition;
        profileDataForCreation.solutionDescription = additionalData.solutionDescription;
        profileDataForCreation.uniqueness = additionalData.uniqueness;
        profileDataForCreation.currentStage = additionalData.currentStage;
        profileDataForCreation.applicantCategory = additionalData.applicantCategory;
        profileDataForCreation.teamMembers = additionalData.teamMembers || '';
        // Explicitly nullify team member association fields
        profileDataForCreation.associatedIdeaId = null;
        profileDataForCreation.associatedTeamLeaderUid = null;
    }


    try {
      const createdOrUpdatedProfile = await createUserProfileFS(user.uid, profileDataForCreation);
      setUserProfile(createdOrUpdatedProfile); 

      const logAction: ActivityLogAction = wasProfileExisting ? 'USER_PROFILE_UPDATED' : 'USER_PROFILE_CREATED';
      await logUserActivity(
        user.uid,
        createdOrUpdatedProfile.displayName || createdOrUpdatedProfile.fullName,
        logAction,
        { type: 'USER_PROFILE', id: user.uid, displayName: createdOrUpdatedProfile.displayName || createdOrUpdatedProfile.fullName || undefined },
        { role: createdOrUpdatedProfile.role, isTeamMember: createdOrUpdatedProfile.isTeamMemberOnly }
      );


      if (createdOrUpdatedProfile.isTeamMemberOnly && createdOrUpdatedProfile.associatedIdeaId && isTeamMemberForIdea) {
        await updateTeamMemberDetailsInIdeaAfterProfileSetup(
          createdOrUpdatedProfile.associatedIdeaId,
          isTeamMemberForIdea.title, 
          user, 
          { 
            fullName: createdOrUpdatedProfile.fullName,
            contactNumber: createdOrUpdatedProfile.contactNumber,
            enrollmentNumber: createdOrUpdatedProfile.enrollmentNumber,
            college: createdOrUpdatedProfile.college,
            instituteName: createdOrUpdatedProfile.instituteName,
          }
        );
        const updatedIdea = await getIdeaById(createdOrUpdatedProfile.associatedIdeaId);
        setIsTeamMemberForIdea(updatedIdea);
        if (updatedIdea && updatedIdea.userId) {
          const leader = await getUserProfile(updatedIdea.userId);
          setTeamLeaderProfileForMember(leader);
        }
      } else if (!createdOrUpdatedProfile.isTeamMemberOnly && createdOrUpdatedProfile.startupTitle && createdOrUpdatedProfile.startupTitle !== 'Administrative Account') {
        // Only create an idea if the user is NOT a team member and has a valid startup title
        const idea = await createIdeaFromProfile(user.uid, {
            startupTitle: createdOrUpdatedProfile.startupTitle!,
            problemDefinition: createdOrUpdatedProfile.problemDefinition!,
            solutionDescription: createdOrUpdatedProfile.solutionDescription!,
            uniqueness: createdOrUpdatedProfile.uniqueness!,
            currentStage: createdOrUpdatedProfile.currentStage!,
            applicantCategory: createdOrUpdatedProfile.applicantCategory!,
            teamMembers: createdOrUpdatedProfile.teamMembers || '',
        });
        if (idea) {
            await logUserActivity(
                user.uid,
                createdOrUpdatedProfile.displayName || createdOrUpdatedProfile.fullName,
                'IDEA_SUBMITTED',
                { type: 'IDEA', id: idea.id!, displayName: idea.title },
                { title: idea.title }
            );
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
    if (!user || !userProfile) {
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

      await logUserActivity(
        user.uid,
        userProfile.displayName || userProfile.fullName,
        'USER_ACCOUNT_DELETED_SELF',
        { type: 'USER_PROFILE', id: user.uid, displayName: userProfile.displayName || userProfile.fullName || undefined }
      );
      toast({ title: "Account Deleted", description: "Your account has been successfully deleted. You have been signed out." });

    } catch (error: any) {
      console.error("Error deleting user account:", error);
      try { await firebaseSignOut(auth); } catch (e) { console.error("Sign out failed after delete error:", e); }
      toast({ title: "Account Deletion Failed", description: error.message || "Could not fully delete your account. Please contact support.", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (user && userProfile) {
      await logUserActivity(
        user.uid,
        userProfile.displayName || userProfile.fullName,
        'USER_SIGNED_OUT'
      );
    }
    setLoading(true);
    try {
      await firebaseSignOut(auth);
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

