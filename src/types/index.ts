import type { Timestamp } from 'firebase/firestore';

export type Role = 'STUDENT' | 'EXTERNAL_USER' | 'ADMIN_FACULTY' | null;

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
  fullName?: string; // Example mandatory field
  department?: string; // Example for student/faculty
  organization?: string; // Example for external user
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Announcement {
  id?: string; // Firestore document ID
  title: string;
  content: string;
  isUrgent: boolean;
  createdByUid: string; // UID of the admin/faculty who created it
  creatorDisplayName: string | null; // Display name of creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
