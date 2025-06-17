
import type { Timestamp } from 'firebase/firestore';

export type Role = 'STUDENT' | 'EXTERNAL_USER' | 'ADMIN_FACULTY' | null;

export type ApplicantCategory = 'PARUL_STUDENT' | 'PARUL_STAFF' | 'PARUL_ALUMNI' | 'OTHERS';
export type CurrentStage = 'IDEA' | 'PROTOTYPE_STAGE' | 'STARTUP_STAGE';

export interface UserProfile {
  uid: string;
  email: string | null; 
  displayName: string | null; 
  photoURL: string | null; 
  role: Role;

  fullName: string; 
  contactNumber: string;
  applicantCategory: ApplicantCategory;
  currentStage: CurrentStage;
  startupTitle: string;
  problemDefinition: string;
  solutionDescription: string;
  uniqueness: string;
  
  teamMembers: string;

  enrollmentNumber?: string; 
  college?: string; 
  instituteName?: string; 
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isSuperAdmin: boolean; // Changed from optional
}

export type IdeaStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'IN_EVALUATION' | 'SELECTED' | 'NOT_SELECTED';
export type ProgramPhase = 'PHASE_1' | 'PHASE_2' | 'COHORT';

export interface AdminMark {
  mark: number | null; // Allow null if admin wants to clear their mark
  adminDisplayName: string;
  markedAt: Timestamp;
}

export interface IdeaSubmission {
  id?: string;
  userId: string; // UID of the user who submitted
  title: string;
  category: string; // e.g., "General Profile Submission", "Specific Call for Ideas"
  problem: string;
  solution: string;
  uniqueness: string;
  developmentStage: CurrentStage;
  applicantType?: ApplicantCategory; // From user's profile
  
  fileURL?: string; 
  fileName?: string;
  studioLocation?: 'SURAT' | 'RAJKOT' | 'BARODA' | 'AHMEDABAD'; 
  
  status: IdeaStatus;
  programPhase: ProgramPhase | null; 
  phase2Marks?: { [adminUid: string]: AdminMark }; // Marks given by admins for phase 2

  submittedAt: Timestamp;
  updatedAt: Timestamp;
  cohortId?: string; 
  
  applicantDisplayName?: string;
  applicantEmail?: string;
}

export interface Cohort {
  id?: string;
  name: string;
  ideaIds: string[]; 
  startDate: Timestamp;
  endDate: Timestamp;
  createdAt: Timestamp;
  createdByUid: string;
}

export interface Announcement {
  id?: string; 
  title: string;
  content: string;
  isUrgent: boolean;
  targetAudience: 'ALL' | 'SPECIFIC_COHORT'; 
  cohortId?: string; 
  attachmentURL?: string;
  attachmentName?: string;
  createdByUid: string; 
  creatorDisplayName: string | null; 
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SystemSettings {
  id?: string; // Typically a single 'config' document
  portalName: string;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  defaultCohortSize: number;
  updatedAt?: Timestamp;
  updatedByUid?: string;
}

