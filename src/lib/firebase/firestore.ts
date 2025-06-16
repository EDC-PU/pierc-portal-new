import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs } from 'firebase/firestore';
import type { UserProfile, Announcement, Role } from '@/types';

// User Profile Functions
export const createUserProfileFS = async (userId: string, data: Partial<UserProfile>): Promise<UserProfile> => {
  const userProfileRef = doc(db, 'users', userId);
  const profileData: UserProfile = {
    uid: userId,
    email: data.email || null,
    displayName: data.displayName || null,
    photoURL: data.photoURL || null,
    role: data.role || null,
    fullName: data.fullName || data.displayName || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...data,
  };
  await setDoc(userProfileRef, profileData);
  return profileData;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userProfileRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
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
  return { id: docRef.id, ...newAnnouncementData } as Announcement; // Timestamps will be resolved by server
};

export const getAnnouncementsStream = (callback: (announcements: Announcement[]) => void, limitCount: number = 20) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol, orderBy('createdAt', 'desc'), where('isUrgent', '==', false)); // Initially, only non-urgent

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
  // Get recent urgent announcements (e.g., created in the last 24 hours, or just latest few)
  // For simplicity, let's get all urgent ones ordered by creation time.
  // You might want to add a 'dismissedBy' field or similar for per-user dismissal.
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

// Example of a batch delete for users, if needed in future (e.g. GDPR)
export const deleteUserAndProfile = async (userId: string): Promise<void> => {
  const batch = writeBatch(db);
  const userProfileRef = doc(db, 'users', userId);
  batch.delete(userProfileRef);
  // Add other related data to delete in batch, e.g., user's posts, comments etc.
  // const userPostsQuery = query(collection(db, 'posts'), where('authorId', '==', userId));
  // const postDocs = await getDocs(userPostsQuery);
  // postDocs.forEach(doc => batch.delete(doc.ref));
  
  await batch.commit();
  // Note: This does not delete the Firebase Auth user. That must be done separately via Admin SDK or client SDK if user is authenticated.
};
