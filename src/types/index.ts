
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

  teamMembers: string; // Comma-separated names, or descriptive text like "Solo". This is the original free-text field.

  enrollmentNumber?: string;
  college?: string;
  instituteName?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  isSuperAdmin: boolean;

  // Fields for team member identification
  isTeamMemberOnly?: boolean;
  associatedIdeaId?: string;
  associatedTeamLeaderUid?: string;
}

export type IdeaStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'IN_EVALUATION' | 'SELECTED' | 'NOT_SELECTED';
export type ProgramPhase = 'PHASE_1' | 'PHASE_2' | 'COHORT';

export interface AdminMark {
  mark: number | null;
  adminDisplayName: string;
  markedAt: Timestamp;
}

export interface TeamMember {
  id: string; // Unique ID for the team member entry, generated client-side (e.g., nanoid)
  name: string;
  email: string;
  phone: string;
  institute: string;
  department: string;
  enrollmentNumber?: string; // Optional
}

export interface IdeaSubmission {
  id?: string;
  userId: string; // UID of the idea owner/leader
  title: string;
  category: string;
  problem: string;
  solution: string;
  uniqueness: string;
  developmentStage: CurrentStage;
  applicantType?: ApplicantCategory;
  teamMembers?: string; // Original free-text field for initial team description from profile
  structuredTeamMembers?: TeamMember[]; // New field for structured team member data
  teamMemberEmails?: string[]; // Flat list of emails for querying

  fileURL?: string;
  fileName?: string;
  studioLocation?: 'SURAT' | 'RAJKOT' | 'BARODA' | 'AHMEDABAD';

  status: IdeaStatus;
  programPhase: ProgramPhase | null;
  phase2Marks?: { [adminUid: string]: AdminMark };

  rejectionRemarks?: string;
  rejectedByUid?: string; // UID of admin who rejected
  rejectedAt?: Timestamp;

  phase2PptUrl?: string;
  phase2PptFileName?: string;
  phase2PptUploadedAt?: Timestamp;

  // Fields for next phase meeting details
  nextPhaseDate?: Timestamp | null;
  nextPhaseStartTime?: string | null;
  nextPhaseEndTime?: string | null;
  nextPhaseVenue?: string | null;
  nextPhaseGuidelines?: string | null;

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
  id?: string;
  portalName: string;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  defaultCohortSize: number;
  updatedAt?: Timestamp;
  updatedByUid?: string;
}
