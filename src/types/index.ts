
import type { Timestamp } from 'firebase/firestore';

export type Role = 'STUDENT' | 'EXTERNAL_USER' | 'ADMIN_FACULTY' | null;

export type ApplicantCategory = 'PARUL_STUDENT' | 'PARUL_STAFF' | 'PARUL_ALUMNI' | 'OTHERS';
export type CurrentStage = 'IDEA' | 'PROTOTYPE_STAGE' | 'STARTUP_STAGE';

export interface UserProfile {
  uid: string;
  email: string | null; // Firebase Auth email
  displayName: string | null; // Firebase Auth display name (used as a fallback for fullName if not provided)
  photoURL: string | null; // Firebase Auth photo URL
  role: Role;

  // Fields from PRD for profile setup
  fullName: string; // User-entered full name
  contactNumber: string;
  applicantCategory: ApplicantCategory;
  currentStage: CurrentStage;
  startupTitle: string;
  problemDefinition: string;
  solutionDescription: string;
  uniqueness: string;
  
  teamMembers: string; // Comma-separated names, can be empty if no team members. Zod handles optionality display.

  // Conditional fields
  enrollmentNumber?: string; // Mandatory if applicantCategory is 'PARUL_STUDENT'
  college?: string; // Mandatory if applicantCategory is 'PARUL_STUDENT', 'PARUL_STAFF', or 'PARUL_ALUMNI'
  instituteName?: string; // Mandatory if applicantCategory is 'OTHERS'
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isSuperAdmin?: boolean; // True if email is pranavrathi07@gmail.com
}

export interface IdeaSubmission {
  id?: string;
  userId: string;
  title: string;
  category: string; // Example: 'Tech', 'Social Impact', etc. - needs definition
  problem: string;
  solution: string;
  developmentStage: CurrentStage; // Re-use CurrentStage or define specific stages for ideas
  fileURL?: string; // Path to uploaded file in Firebase Storage
  fileName?: string;
  studioLocation?: 'SURAT' | 'RAJKOT' | 'BARODA' | 'AHMEDABAD'; // Optional, for admin filtering
  applicantType?: ApplicantCategory; // For admin filtering, denormalized from UserProfile
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'IN_EVALUATION' | 'SELECTED' | 'NOT_SELECTED';
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  cohortId?: string; // If assigned to a cohort
}

export interface Cohort {
  id?: string;
  name: string;
  ideaIds: string[]; // Array of IdeaSubmission IDs
  startDate: Timestamp;
  endDate: Timestamp;
  createdAt: Timestamp;
  createdByUid: string;
}

export interface Announcement {
  id?: string; // Firestore document ID
  title: string;
  content: string;
  isUrgent: boolean;
  targetAudience: 'ALL' | 'SPECIFIC_COHORT'; // Default to ALL, admin can specify cohort
  cohortId?: string; // if targetAudience is 'SPECIFIC_COHORT'
  attachmentURL?: string;
  attachmentName?: string;
  createdByUid: string; 
  creatorDisplayName: string | null; 
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

