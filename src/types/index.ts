import type { Timestamp } from 'firebase/firestore';

export type Role = 'STUDENT' | 'EXTERNAL_USER' | 'ADMIN_FACULTY' | null;

export type ApplicantCategory = 'PARUL_STUDENT' | 'PARUL_STAFF' | 'PARUL_ALUMNI' | 'OTHERS';
export type CurrentStage = 'IDEA' | 'PROTOTYPE_STAGE' | 'STARTUP_STAGE';

export interface UserProfile {
  uid: string;
  email: string | null; // Firebase Auth email
  displayName: string | null; // Firebase Auth display name
  photoURL: string | null; // Firebase Auth photo URL
  role: Role; // Derived role: STUDENT, EXTERNAL_USER, ADMIN_FACULTY

  // Mandatory fields from PRD for profile setup
  fullName: string; // User-entered full name
  contactNumber: string;
  enrollmentNumber?: string; // Mandatory if applicantCategory is 'PARUL_STUDENT'
  applicantCategory: ApplicantCategory;
  instituteName?: string; // Mandatory if applicantCategory is 'OTHERS'
  teamMembers?: string; // Comma-separated names, optional
  startupTitle: string;
  problemDefinition: string;
  solutionDescription: string;
  uniqueness: string;
  college?: string; // Mandatory for Parul affiliates (Student, Staff, Alumni)
  currentStage: CurrentStage;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isSuperAdmin?: boolean; // True if email is pranavrathi07@gmail.com
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
