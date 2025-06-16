import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage } from '@/types';

// User Profile Functions
export const createUserProfileFS = async (userId: string, data: Partial<UserProfile>): Promise<UserProfile> => {
  const userProfileRef = doc(db, 'users', userId);
  
  // Explicitly define all fields for UserProfile, merging with provided data
  const profileData: UserProfile = {
    uid: userId,
    email: data.email || null,
    displayName: data.displayName || null, // From Firebase Auth
    photoURL: data.photoURL || null,     // From Firebase Auth
    role: data.role || null, // This should be determined and passed in `data`

    // PRD Mandatory Fields
    fullName: data.fullName || data.displayName || '', // User-provided, fallback to Auth display name
    contactNumber: data.contactNumber || '',
    applicantCategory: data.applicantCategory || 'OTHERS', // Default, should be set
    currentStage: data.currentStage || 'IDEA', // Default, should be set
    startupTitle: data.startupTitle || '',
    problemDefinition: data.problemDefinition || '',
    solutionDescription: data.solutionDescription || '',
    uniqueness: data.uniqueness || '',
    
    // Optional / Conditional based on PRD logic handled in form/context
    enrollmentNumber: data.enrollmentNumber || undefined,
    instituteName: data.instituteName || undefined,
    college: data.college || undefined,
    teamMembers: data.teamMembers || undefined,

    isSuperAdmin: data.email === 'pranavrathi07@gmail.com' ? true : data.isSuperAdmin || false,
    
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...data, // Spread any other fields passed in, ensures all UserProfile fields are covered
  };

  // Ensure all keys from UserProfile are present, even if undefined from data
  // This is a bit redundant if profileData is typed correctly and fully populated above.
  // However, spreading `data` last ensures its values take precedence for fields it defines.

  await setDoc(userProfileRef, profileData);
  
  // Fetch the just-created document to ensure server timestamps are resolved for the return value
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  // Should not happen if setDoc was successful
  throw new Error("Failed to create or retrieve user profile after creation.");
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userProfileRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    const profile = docSnap.data() as UserProfile;
    // Ensure isSuperAdmin is correctly set if email matches, even if not in DB (for robustness)
    if (profile.email === 'pranavrathi07@gmail.com' && !profile.isSuperAdmin) {
        profile.isSuperAdmin = true;
    }
    return profile;
  }
  return null;
};

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>): Promise<void> => {
  const userProfileRef = doc(db, 'users', userId);
  await updateDoc(userProfileRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

// Announcement Functions
export const createAnnouncement = async (announcement: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>): Promise<Announcement> => {
  const announcementsCol = collection(db, 'announcements');
  const newAnnouncementData = {
    ...announcement,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(announcementsCol, newAnnouncementData);
  // Fetch the document to get server-resolved timestamps
  const newDocSnap = await getDoc(docRef);
  return { id: newDocSnap.id, ...newDocSnap.data() } as Announcement;
};

export const getAnnouncementsStream = (callback: (announcements: Announcement[]) => void, limitCount: number = 20) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol, orderBy('createdAt', 'desc'), where('isUrgent', '==', false)); 

  return onSnapshot(q, (querySnapshot) => {
    const announcements: Announcement[] = [];
    querySnapshot.forEach((doc) => {
      announcements.push({ id: doc.id, ...doc.data() } as Announcement);
    });
    callback(announcements);
  });
};

export const getUrgentAnnouncementsStream = (callback: (announcements: Announcement[]) => void) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol, where('isUrgent', '==', true), orderBy('createdAt', 'desc'));

  return onSnapshot(q, (querySnapshot) => {
    const announcements: Announcement[] = [];
    querySnapshot.forEach((doc) => {
      announcements.push({ id: doc.id, ...doc.data() } as Announcement);
    });
    callback(announcements);
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
  });
};


export const updateAnnouncement = async (announcementId: string, data: Partial<Announcement>): Promise<void> => {
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

export const deleteUserAndProfile = async (userId: string): Promise<void> => {
  const batch = writeBatch(db);
  const userProfileRef = doc(db, 'users', userId);
  batch.delete(userProfileRef);
  await batch.commit();
};
