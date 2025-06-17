
import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage, IdeaSubmission, Cohort, SystemSettings } from '@/types';

// User Profile Functions
export const createUserProfileFS = async (userId: string, data: Partial<UserProfile>): Promise<UserProfile> => {
  const userProfileRef = doc(db, 'users', userId);
  
  // Ensure all required fields for UserProfile are present, using defaults or null where appropriate
  const profileToCreate: UserProfile = {
    uid: userId,
    email: data.email ?? null,
    displayName: data.displayName || data.fullName || 'User', // Firebase displayName or User-provided fullName
    photoURL: data.photoURL ?? null,
    role: data.role ?? null, // Role is determined and passed in
    fullName: data.fullName!, // Assert non-null as it's mandatory from form
    contactNumber: data.contactNumber!, // Assert non-null
    applicantCategory: data.applicantCategory!, // Assert non-null
    currentStage: data.currentStage!, // Assert non-null
    startupTitle: data.startupTitle!, // Assert non-null
    problemDefinition: data.problemDefinition!, // Assert non-null
    solutionDescription: data.solutionDescription!, // Assert non-null
    uniqueness: data.uniqueness!, // Assert non-null
    teamMembers: data.teamMembers || '', // Default to empty string if not provided
    enrollmentNumber: data.enrollmentNumber, // Optional
    college: data.college, // Optional
    instituteName: data.instituteName, // Optional
    isSuperAdmin: data.email === 'pranavrathi07@gmail.com' ? true : (data.isSuperAdmin ?? false),
    createdAt: serverTimestamp() as Timestamp, // Firestore server timestamp
    updatedAt: serverTimestamp() as Timestamp, // Firestore server timestamp
  };

  // Remove undefined properties before sending to Firestore
  const cleanProfileToCreate = Object.fromEntries(
    Object.entries(profileToCreate).filter(([, value]) => value !== undefined)
  );

  await setDoc(userProfileRef, cleanProfileToCreate);
  
  // Fetch the just-created profile to return the complete object with server timestamps
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  // This should ideally not be reached if setDoc was successful
  throw new Error("Failed to create or retrieve user profile after creation.");
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userProfileRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    const profile = docSnap.data() as UserProfile;
    if (profile.email === 'pranavrathi07@gmail.com') {
        profile.isSuperAdmin = true; // Ensure super admin status for the specific email
    }
    return profile;
  }
  return null;
};

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>): Promise<void> => {
  const userProfileRef = doc(db, 'users', userId);
  // Remove undefined properties before sending to Firestore
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
export const createIdeaSubmission = async (ideaData: Omit<IdeaSubmission, 'id' | 'submittedAt' | 'updatedAt' | 'status'>): Promise<IdeaSubmission> => {
  const ideaCol = collection(db, 'ideas');
  const newIdeaPayload = {
    ...ideaData,
    status: 'SUBMITTED',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as const;
  const docRef = await addDoc(ideaCol, newIdeaPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create idea submission.");
  return { id: newDocSnap.id, ...newDocSnap.data() } as IdeaSubmission;
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

export const deleteUserAndProfile = async (userId: string): Promise<void> => {
  const batch = writeBatch(db);
  const userProfileRef = doc(db, 'users', userId);
  batch.delete(userProfileRef);
  
  // Future: Add deletion of user's ideas, etc., to the batch
  await batch.commit();
  // Note: Deleting the Firebase Auth user is a separate operation, typically done server-side.
};

// System Settings Functions
const SYSTEM_SETTINGS_DOC_ID = 'config'; // Use a fixed ID for the single settings document

export const getSystemSettings = async (): Promise<SystemSettings | null> => {
  const settingsRef = doc(db, 'systemSettings', SYSTEM_SETTINGS_DOC_ID);
  const docSnap = await getDoc(settingsRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as SystemSettings;
  }
  // Return null or default settings if the document doesn't exist
  return null; 
};

export const updateSystemSettings = async (settingsData: Partial<Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedByUid'>>, adminUid: string): Promise<void> => {
  const settingsRef = doc(db, 'systemSettings', SYSTEM_SETTINGS_DOC_ID);
  try {
    await setDoc(settingsRef, {
      ...settingsData,
      updatedAt: serverTimestamp(),
      updatedByUid: adminUid,
    }, { merge: true }); // Use setDoc with merge:true to create if not exists, or update
  } catch (error) {
    console.error("Error updating system settings:", error);
    throw error;
  }
};
