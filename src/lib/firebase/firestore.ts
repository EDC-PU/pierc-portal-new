
import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage } from '@/types';

// User Profile Functions
export const createUserProfileFS = async (userId: string, data: Partial<UserProfile>): Promise<UserProfile> => {
  const userProfileRef = doc(db, 'users', userId);
  
  // Ensure all fields from UserProfile are initialized, using `data` where available,
  // and falling back to defaults or nulls as appropriate for the type.
  // Zod validation on the form should ensure that `data` contains valid values for required fields.
  const profileToCreate: UserProfile = {
    uid: userId,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    role: data.role ?? null,

    fullName: data.fullName ?? (data.displayName || ''), // Fallback to displayName if fullName not provided from form
    contactNumber: data.contactNumber ?? '',
    
    // `applicantCategory` and `currentStage` are required by Zod in the form.
    // The `?? 'OTHERS'` or `?? 'IDEA'` acts as a type-safe fallback if `data.*` was null/undefined,
    // though form validation should prevent this scenario.
    applicantCategory: data.applicantCategory ?? 'OTHERS', 
    currentStage: data.currentStage ?? 'IDEA',         

    startupTitle: data.startupTitle ?? '',
    problemDefinition: data.problemDefinition ?? '',
    solutionDescription: data.solutionDescription ?? '',
    uniqueness: data.uniqueness ?? '',
    
    // Optional fields from UserProfile type. If `data.fieldName` is undefined, it will remain undefined.
    // Firestore omits fields with undefined values.
    enrollmentNumber: data.enrollmentNumber,
    instituteName: data.instituteName,
    college: data.college,
    teamMembers: data.teamMembers,

    // Super admin status
    isSuperAdmin: data.email === 'pranavrathi07@gmail.com' ? true : (data.isSuperAdmin ?? false),
    
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(userProfileRef, profileToCreate);
  
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
