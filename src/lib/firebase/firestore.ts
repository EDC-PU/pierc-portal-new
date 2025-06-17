
import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage, IdeaSubmission, Cohort } from '@/types';

// User Profile Functions
export const createUserProfileFS = async (userId: string, data: Partial<UserProfile>): Promise<UserProfile> => {
  const userProfileRef = doc(db, 'users', userId);
  
  const profileToCreate: UserProfile = {
    uid: userId,
    email: data.email ?? null,
    displayName: data.displayName ?? data.fullName ?? 'User',
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

// Announcement Functions
export const createAnnouncement = async (announcementData: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>): Promise<Announcement> => {
  const announcementsCol = collection(db, 'announcements');
  // Ensure createdByUid and creatorDisplayName are part of announcementData passed in
  const newAnnouncementPayload = {
    ...announcementData, // This should include title, content, isUrgent, targetAudience, createdByUid, creatorDisplayName etc.
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

// Stream for urgent announcements visible to all
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

// Stream for all announcements for Admin dashboard (no audience filtering initially, can be refined)
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
  // Ensure createdByUid and creatorDisplayName are part of data if they are being updated
  await updateDoc(announcementRef, {
    ...data, // This should include title, content, isUrgent, targetAudience, etc.
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
  } as const;
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
  const batch = writeBatch(db);
  const userProfileRef = doc(db, 'users', userId);
  batch.delete(userProfileRef);
  
  await batch.commit();
};

