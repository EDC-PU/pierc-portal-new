
import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage, IdeaSubmission, Cohort } from '@/types';

// User Profile Functions
export const createUserProfileFS = async (userId: string, data: Partial<UserProfile>): Promise<UserProfile> => {
  const userProfileRef = doc(db, 'users', userId);
  
  // Construct the full profile ensuring all fields from UserProfile type are handled.
  // Form validation (Zod) is responsible for ensuring `data` contains valid values for mandatory fields.
  const profileToCreate: UserProfile = {
    uid: userId,
    email: data.email ?? null,
    displayName: data.displayName ?? null, // Firebase Auth display name
    photoURL: data.photoURL ?? null,
    role: data.role ?? null, // Role determined by form logic or AuthContext

    // Fields from PRD - these should be present in `data` due to form validation
    fullName: data.fullName!, // User-entered full name
    contactNumber: data.contactNumber!,
    applicantCategory: data.applicantCategory!,
    currentStage: data.currentStage!,
    startupTitle: data.startupTitle!,
    problemDefinition: data.problemDefinition!,
    solutionDescription: data.solutionDescription!,
    uniqueness: data.uniqueness!,
    teamMembers: data.teamMembers || '', // Default to empty string if not provided (Zod default)

    // Conditional fields, will be present in `data` if applicable and validated by Zod
    enrollmentNumber: data.enrollmentNumber, 
    college: data.college,
    instituteName: data.instituteName,

    isSuperAdmin: data.email === 'pranavrathi07@gmail.com' ? true : (data.isSuperAdmin ?? false),
    
    createdAt: serverTimestamp() as Timestamp, // Cast for type consistency before write
    updatedAt: serverTimestamp() as Timestamp,
  };

  // Filter out undefined values before setting to Firestore, as Firestore cannot store 'undefined'.
  // Note: serverTimestamp() will be resolved by Firestore server.
  const cleanProfileToCreate = Object.fromEntries(
    Object.entries(profileToCreate).filter(([, value]) => value !== undefined)
  );


  await setDoc(userProfileRef, cleanProfileToCreate);
  
  // Fetch the newly created profile to get server-generated timestamps and ensure consistency
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    // The data returned from Firestore will have actual Timestamp objects for createdAt/updatedAt
    return docSnap.data() as UserProfile;
  }
  throw new Error("Failed to create or retrieve user profile after creation.");
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userProfileRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    const profile = docSnap.data() as UserProfile;
    // Ensure superAdmin status is correctly reflected based on email, overriding stored value if necessary.
    if (profile.email === 'pranavrathi07@gmail.com') {
        profile.isSuperAdmin = true;
    }
    return profile;
  }
  return null;
};

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>): Promise<void> => {
  const userProfileRef = doc(db, 'users', userId);
  // Filter out undefined values before updating
  const cleanData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  await updateDoc(userProfileRef, {
    ...cleanData,
    updatedAt: serverTimestamp(),
  });
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

// Stream for general (non-urgent) announcements visible to all
export const getAnnouncementsStream = (callback: (announcements: Announcement[]) => void) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol, 
    where('isUrgent', '==', false), 
    where('targetAudience', '==', 'ALL'), // Only 'ALL' target audience for this general feed
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
    callback([]); // Send empty array on error
  });
};

// Stream for urgent announcements visible to all
export const getUrgentAnnouncementsStream = (callback: (announcements: Announcement[]) => void) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol, 
    where('isUrgent', '==', true),
    where('targetAudience', '==', 'ALL'), // Assuming urgent modals are for 'ALL' for now
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

// Stream for all announcements for Admin dashboard (no audience filtering)
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


export const updateAnnouncement = async (announcementId: string, data: Partial<Omit<Announcement, 'id'|'createdAt'|'updatedAt'>>): Promise<void> => {
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


// Placeholder for Idea Submission functions
export const createIdeaSubmission = async (ideaData: Omit<IdeaSubmission, 'id' | 'submittedAt' | 'updatedAt' | 'status'>): Promise<IdeaSubmission> => {
  const ideaCol = collection(db, 'ideas');
  const newIdeaPayload = {
    ...ideaData,
    status: 'SUBMITTED',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as const; // Add 'as const' for stricter type checking if needed
  const docRef = await addDoc(ideaCol, newIdeaPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create idea submission.");
  return { id: newDocSnap.id, ...newDocSnap.data() } as IdeaSubmission;
};


// Placeholder for Cohort functions
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


export const deleteUserAndProfile = async (userId: string): Promise<void> => {
  // This function should also handle deletion of user's Firebase Auth account
  // and potentially other user-related data (e.g., their idea submissions).
  // For now, it only deletes the Firestore profile.
  // Actual user deletion from Auth requires Admin SDK in a Cloud Function.
  const batch = writeBatch(db);
  const userProfileRef = doc(db, 'users', userId);
  batch.delete(userProfileRef);
  
  // Example: Query and delete user's idea submissions (consider batch limits)
  // const ideasQuery = query(collection(db, 'ideas'), where('userId', '==', userId));
  // const ideasSnapshot = await getDocs(ideasQuery);
  // ideasSnapshot.forEach(doc => batch.delete(doc.ref));

  await batch.commit();
  // Note: Deleting the Firebase Auth user record typically needs to be done
  // from a backend environment (e.g., Cloud Function) using the Admin SDK.
};

