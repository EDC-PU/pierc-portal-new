
import { db, functions as firebaseFunctions } from './config'; // functions aliased to avoid conflict
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs, Timestamp, getCountFromServer } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage, IdeaSubmission, Cohort, SystemSettings, IdeaStatus, ProgramPhase } from '@/types';
import { httpsCallable } from 'firebase/functions';

// User Profile Functions
export const createUserProfileFS = async (userId: string, data: Partial<UserProfile>): Promise<UserProfile> => {
  const userProfileRef = doc(db, 'users', userId);
  
  const profileToCreate: UserProfile = {
    uid: userId,
    email: data.email ?? null,
    displayName: data.displayName || data.fullName || 'User',
    photoURL: data.photoURL ?? null,
    role: data.role ?? null,
    fullName: data.fullName!, 
    contactNumber: data.contactNumber!,
    applicantCategory: data.applicantCategory!,
    currentStage: data.currentStage!,
    startupTitle: data.startupTitle!,
    problemDefinition: data.problemDefinition!,
    solutionDescription: data.solutionDescription!,
    uniqueness: data.uniqueness!,
    teamMembers: data.teamMembers || '',
    enrollmentNumber: data.enrollmentNumber,
    college: data.college,
    instituteName: data.instituteName,
    isSuperAdmin: data.email === 'pranavrathi07@gmail.com' ? true : (data.isSuperAdmin ?? false),
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  const cleanProfileToCreate = Object.fromEntries(
    Object.entries(profileToCreate).filter(([, value]) => value !== undefined)
  );

  await setDoc(userProfileRef, cleanProfileToCreate);
  
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  throw new Error("Failed to create or retrieve user profile after creation.");
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userProfileRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    const profile = docSnap.data() as UserProfile;
    if (profile.email === 'pranavrathi07@gmail.com') {
        profile.isSuperAdmin = true; 
        if (profile.role !== 'ADMIN_FACULTY') { 
            profile.role = 'ADMIN_FACULTY';
        }
    }
    return profile;
  }
  return null;
};

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>): Promise<void> => {
  const userProfileRef = doc(db, 'users', userId);
  const cleanData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  await updateDoc(userProfileRef, {
    ...cleanData,
    updatedAt: serverTimestamp(),
  });
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, orderBy('createdAt', 'desc')); 
  const querySnapshot = await getDocs(q);
  const users: UserProfile[] = [];
  querySnapshot.forEach((doc) => {
    users.push({ uid: doc.id, ...doc.data() } as UserProfile);
  });
  return users;
};

export const getTotalUsersCount = async (): Promise<number> => {
  const usersCol = collection(db, 'users');
  const snapshot = await getCountFromServer(usersCol);
  return snapshot.data().count;
};


export const updateUserRoleAndPermissionsFS = async (userId: string, newRole: Role, newIsSuperAdmin?: boolean): Promise<void> => {
  const userProfileRef = doc(db, 'users', userId);
  const updates: Partial<UserProfile> = {
    role: newRole,
    updatedAt: serverTimestamp(),
  };
  if (newIsSuperAdmin !== undefined) {
    updates.isSuperAdmin = newIsSuperAdmin;
  }
  const userDoc = await getDoc(userProfileRef);
  if (userDoc.exists() && userDoc.data().email === 'pranavrathi07@gmail.com') {
    updates.role = 'ADMIN_FACULTY';
    updates.isSuperAdmin = true;
  }

  await updateDoc(userProfileRef, updates);
};

export const deleteUserAccountAndProfile = async (userId: string): Promise<void> => {
  const userProfileRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userProfileRef);

  if (userDocSnap.exists() && userDocSnap.data().email === 'pranavrathi07@gmail.com') {
    throw new Error("The primary super admin's profile and account cannot be deleted through this interface.");
  }
  
  await deleteDoc(userProfileRef); 

  try {
    const deleteAuthUserFn = httpsCallable(firebaseFunctions, 'deleteAuthUserCallable');
    await deleteAuthUserFn({ uid: userId });
  } catch (error) {
    console.error("Error calling Firebase Function to delete auth user:", error);
    throw new Error(`Firestore profile deleted, but an error occurred attempting to delete the Firebase Auth account: ${(error as Error).message}. Please check the Cloud Function logs, or manually delete the auth account if necessary.`);
  }
};


// Announcement Functions
export const createAnnouncement = async (announcementData: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>): Promise<Announcement> => {
  const announcementsCol = collection(db, 'announcements');
  const newAnnouncementPayload = {
    ...announcementData, 
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(announcementsCol, newAnnouncementPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create announcement.");
  return { id: newDocSnap.id, ...newDocSnap.data() } as Announcement;
};

export const getAnnouncementsStream = (callback: (announcements: Announcement[]) => void) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol, 
    where('isUrgent', '==', false), 
    where('targetAudience', '==', 'ALL'),
    orderBy('createdAt', 'desc')
  ); 

  return onSnapshot(q, (querySnapshot) => {
    const announcements: Announcement[] = [];
    querySnapshot.forEach((doc) => {
      announcements.push({ id: doc.id, ...doc.data() } as Announcement);
    });
    callback(announcements);
  }, (error) => {
    console.error("Error fetching general announcements:", error);
    callback([]);
  });
};

export const getUrgentAnnouncementsStream = (callback: (announcements: Announcement[]) => void) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol, 
    where('isUrgent', '==', true),
    where('targetAudience', '==', 'ALL'), 
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const announcements: Announcement[] = [];
    querySnapshot.forEach((doc) => {
      announcements.push({ id: doc.id, ...doc.data() } as Announcement);
    });
    callback(announcements);
  }, (error) => {
    console.error("Error fetching urgent announcements:", error);
    callback([]);
  });
};

export const getAllAnnouncementsForAdminStream = (callback: (announcements: Announcement[]) => void) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (querySnapshot) => {
    const announcements: Announcement[] = [];
    querySnapshot.forEach((doc) => {
      announcements.push({ id: doc.id, ...doc.data() } as Announcement);
    });
    callback(announcements);
  }, (error) => {
    console.error("Error fetching all announcements for admin:", error);
    callback([]);
  });
};

export const updateAnnouncement = async (announcementId: string, data: Partial<Omit<Announcement, 'id'|'createdAt'>>): Promise<void> => {
  const announcementRef = doc(db, 'announcements', announcementId);
  await updateDoc(announcementRef, {
    ...data, 
    updatedAt: serverTimestamp(),
  });
};

export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
  const announcementRef = doc(db, 'announcements', announcementId);
  await deleteDoc(announcementRef);
};

// Idea Submission functions
export const createIdeaFromProfile = async (
    userId: string, 
    profileData: Pick<UserProfile, 'startupTitle' | 'problemDefinition' | 'solutionDescription' | 'uniqueness' | 'currentStage' | 'applicantCategory'>
): Promise<IdeaSubmission | null> => {
  if (profileData.startupTitle === 'Administrative Account') {
    return null;
  }

  const ideaCol = collection(db, 'ideas');
  const newIdeaPayload: Omit<IdeaSubmission, 'id' | 'submittedAt' | 'updatedAt'> = {
    userId: userId,
    title: profileData.startupTitle,
    category: 'General Profile Submission', 
    problem: profileData.problemDefinition,
    solution: profileData.solutionDescription,
    uniqueness: profileData.uniqueness,
    developmentStage: profileData.currentStage,
    applicantType: profileData.applicantCategory,
    status: 'SUBMITTED',
    programPhase: null, // Initialize programPhase
    submittedAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };
  const docRef = await addDoc(ideaCol, newIdeaPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create idea submission from profile.");
  return { id: newDocSnap.id, ...newDocSnap.data() } as IdeaSubmission;
};


export const getAllIdeaSubmissionsWithDetails = async (): Promise<IdeaSubmission[]> => {
  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, orderBy('submittedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  const ideaSubmissions: IdeaSubmission[] = [];

  for (const ideaDoc of querySnapshot.docs) {
    const ideaData = ideaDoc.data() as Omit<IdeaSubmission, 'id'>;
    let applicantDisplayName = 'N/A';
    let applicantEmail = 'N/A';

    if (ideaData.userId) {
      const userProfile = await getUserProfile(ideaData.userId);
      if (userProfile) {
        applicantDisplayName = userProfile.displayName || userProfile.fullName || 'Unknown User';
        applicantEmail = userProfile.email || 'No Email';
      }
    }
    const submittedAt = (ideaData.submittedAt as any) instanceof Timestamp ? (ideaData.submittedAt as Timestamp) : Timestamp.now();
    const updatedAt = (ideaData.updatedAt as any) instanceof Timestamp ? (ideaData.updatedAt as Timestamp) : Timestamp.now();

    ideaSubmissions.push({ 
      id: ideaDoc.id, 
      ...ideaData,
      programPhase: ideaData.programPhase || null,
      submittedAt,
      updatedAt,
      applicantDisplayName,
      applicantEmail,
    } as IdeaSubmission);
  }
  return ideaSubmissions;
};

export const updateIdeaStatusAndPhase = async (
  ideaId: string, 
  newStatus: IdeaStatus, 
  newPhase: ProgramPhase | null = null
): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const updates: Partial<IdeaSubmission> = {
    status: newStatus,
    updatedAt: serverTimestamp(),
  };

  if (newStatus === 'SELECTED') {
    updates.programPhase = newPhase; // Assign the new phase if status is SELECTED
  } else {
    updates.programPhase = null; // Clear the phase if status is not SELECTED
  }
  await updateDoc(ideaRef, updates);
};

export const getUserIdeaSubmissionsWithStatus = async (userId: string): Promise<IdeaSubmission[]> => {
  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, where('userId', '==', userId), orderBy('submittedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  const userIdeas: IdeaSubmission[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const submittedAt = (data.submittedAt as any) instanceof Timestamp ? (data.submittedAt as Timestamp) : Timestamp.now();
    const updatedAt = (data.updatedAt as any) instanceof Timestamp ? (data.updatedAt as Timestamp) : Timestamp.now();
    userIdeas.push({ 
        id: doc.id, 
        ...data, 
        programPhase: data.programPhase || null,
        submittedAt, 
        updatedAt 
    } as IdeaSubmission);
  });
  return userIdeas;
};


export const getTotalIdeasCount = async (): Promise<number> => {
  const ideasCol = collection(db, 'ideas');
  const snapshot = await getCountFromServer(ideasCol);
  return snapshot.data().count;
};

export const getPendingIdeasCount = async (): Promise<number> => {
  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, where('status', '==', 'SUBMITTED'));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

export const getUserIdeaSubmissionsCount = async (userId: string): Promise<number> => {
  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, where('userId', '==', userId));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

export const deleteIdeaSubmission = async (ideaId: string): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  await deleteDoc(ideaRef);
};


// Cohort functions
export const createCohort = async (cohortData: Omit<Cohort, 'id' | 'createdAt'>): Promise<Cohort> => {
  const cohortCol = collection(db, 'cohorts');
  const newCohortPayload = {
    ...cohortData,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(cohortCol, newCohortPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create cohort.");
  return { id: newDocSnap.id, ...newDocSnap.data() } as Cohort;
};


// System Settings Functions
const SYSTEM_SETTINGS_DOC_ID = 'config'; 

export const getSystemSettings = async (): Promise<SystemSettings | null> => {
  const settingsRef = doc(db, 'systemSettings', SYSTEM_SETTINGS_DOC_ID);
  const docSnap = await getDoc(settingsRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as SystemSettings;
  }
  return null; 
};

export const updateSystemSettings = async (settingsData: Partial<Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedByUid'>>, adminUid: string): Promise<void> => {
  const settingsRef = doc(db, 'systemSettings', SYSTEM_SETTINGS_DOC_ID);
  try {
    await setDoc(settingsRef, {
      ...settingsData,
      updatedAt: serverTimestamp(),
      updatedByUid: adminUid,
    }, { merge: true }); 
  } catch (error) {
    console.error("Error updating system settings:", error);
    throw error;
  }
};

export const createIdeaSubmission = async (ideaData: Omit<IdeaSubmission, 'id' | 'submittedAt' | 'updatedAt' | 'status' | 'programPhase'>): Promise<IdeaSubmission> => {
  const ideaCol = collection(db, 'ideas');
  const newIdeaPayload = {
    ...ideaData,
    status: 'SUBMITTED',
    programPhase: null, // Initialize programPhase
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as const; 
  const docRef = await addDoc(ideaCol, newIdeaPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create idea submission.");
  return { id: newDocSnap.id, ...newDocSnap.data() } as IdeaSubmission;
};

