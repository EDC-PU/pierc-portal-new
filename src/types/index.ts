
import type { Timestamp } from 'firebase/firestore';

export type Role = 'STUDENT' | 'EXTERNAL_USER' | 'ADMIN_FACULTY' | null;

export type ApplicantCategory = 'PARUL_STUDENT' | 'PARUL_STAFF' | 'PARUL_ALUMNI' | 'OTHERS';
export type CurrentStage = 'IDEA' | 'PROTOTYPE_STAGE' | 'STARTUP_STAGE';

export const AVAILABLE_MENTORS = [
  'Prashant Khanna', 'Anup Chaudhari', 'Riddhi Bagha', 'Sonal Sudani',
  'Jay Sudani', 'Nikhil Jumde', 'Vishal SIngh', 'Hardik Kharva',
  'Tushar Thakur', 'Pancham Baraiya', 'Paritosh Sharma', 'Juned Shaikh'
] as const;

export type MentorName = typeof AVAILABLE_MENTORS[number];


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
  id: string; // Unique ID for the team member entry, generated client-side (e.g., nanoid or user's UID after profile setup)
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
  category: string; // This seems to be covered by applicantType, but keeping for now if it has a different meaning.
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
  mentor?: MentorName; // Mentor assigned if in COHORT phase
  cohortId?: string; // ID of the Cohort this idea is assigned to

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

  // Denormalized fields for easier display
  applicantDisplayName?: string;
  applicantEmail?: string;
}

export interface CohortScheduleEntry {
  id: string; 
  date: string; 
  day: string; 
  time: string; 
  category: string;
  topicActivity: string;
  content: string;
  speakerVenue: string;
}

export interface Cohort {
  id?: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  batchSize: number; 
  ideaIds: string[]; 
  schedule?: CohortScheduleEntry[]; 
  createdAt: Timestamp;
  createdByUid: string; 
  creatorDisplayName: string | null;
  updatedAt?: Timestamp; 
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

// Activity Logging Types
export type ActivityLogAction =
  // User Account & Profile
  | 'USER_PROFILE_CREATED'
  | 'USER_PROFILE_UPDATED' // Could be self or by admin
  | 'USER_SIGNED_IN'
  | 'USER_SIGNED_OUT'
  | 'USER_PASSWORD_RESET_REQUESTED'
  | 'USER_ACCOUNT_DELETED_SELF'
  | 'USER_ACCOUNT_DELETED_BY_ADMIN'
  // Idea Submission & Management (by user)
  | 'IDEA_SUBMITTED' // Typically part of profile creation for idea owners
  | 'IDEA_PPT_UPLOADED'
  | 'IDEA_TEAM_MEMBER_ADDED'
  | 'IDEA_TEAM_MEMBER_UPDATED'
  | 'IDEA_TEAM_MEMBER_REMOVED'
  | 'USER_GENERATED_PITCH_DECK_OUTLINE' // New action
  // Admin - User Management
  | 'ADMIN_USER_ROLE_UPDATED'
  // Admin - Idea Management
  | 'ADMIN_IDEA_STATUS_PHASE_UPDATED'
  | 'ADMIN_IDEA_MENTOR_ASSIGNED'
  | 'ADMIN_IDEA_PHASE2_MARK_SUBMITTED'
  | 'ADMIN_IDEA_DELETED'
  | 'ADMIN_IDEA_ASSIGNED_TO_COHORT'
  // Admin - Announcements
  | 'ADMIN_ANNOUNCEMENT_CREATED'
  | 'ADMIN_ANNOUNCEMENT_UPDATED'
  | 'ADMIN_ANNOUNCEMENT_DELETED'
  // Admin - Cohorts
  | 'ADMIN_COHORT_CREATED'
  | 'ADMIN_COHORT_UPDATED' // General update
  | 'ADMIN_COHORT_SCHEDULE_UPDATED' // Specific for schedule
  | 'ADMIN_COHORT_DELETED'
  // Admin - System Settings
  | 'ADMIN_SYSTEM_SETTINGS_UPDATED';

export interface ActivityLogTarget {
  type: string; // e.g., 'USER_PROFILE', 'IDEA', 'ANNOUNCEMENT', 'SYSTEM_SETTINGS'
  id: string;
  displayName?: string; // e.g., user's name, idea title
}

export interface ActivityLogEntry {
  id?: string; // Firestore document ID
  timestamp: Timestamp;
  actorUid: string; // UID of the user performing the action
  actorDisplayName: string | null;
  action: ActivityLogAction;
  target?: ActivityLogTarget;
  details?: Record<string, any>; // e.g., { fieldChanged: 'status', oldValue: 'SUBMITTED', newValue: 'SELECTED' }
}

    
