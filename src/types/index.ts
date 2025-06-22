
import type { Timestamp } from 'firebase/firestore';

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  content: string;
  createdAt: Timestamp;
}

export type Role = 'STUDENT' | 'EXTERNAL_USER' | 'ADMIN_FACULTY' | null;

export type ApplicantCategory = 'PARUL_STUDENT' | 'PARUL_STAFF' | 'PARUL_ALUMNI' | 'OTHERS';
export type CurrentStage = 'IDEA' | 'PROTOTYPE_STAGE' | 'STARTUP_STAGE';

export const AVAILABLE_MENTORS_DATA = [
  { name: 'Prashant Khanna', email: 'prashant.khanna8747@paruluniversity.ac.in' },
  { name: 'Riddhi Bagha', email: 'riddhi.bagha29080@paruluniversity.ac.in' },
  { name: 'Nikhil Jumde', email: 'nikhil.jumade24167@paruluniversity.ac.in' },
  { name: 'Jay Sudani', email: 'jay.sudani@paruluniversity.ac.in' },
  { name: 'Hardik Kharva', email: 'hardik.kharva2899@paruluniversity.ac.in' },
  { name: 'Sonal Sudani', email: 'sonal.sudani23321@paruluniversity.ac.in' },
  { name: 'Pancham Baraiya', email: 'panchamkumar.baraiya28771@paruluniversity.ac.in' },
  { name: 'Juned Shaikh', email: 'juned.shaikh32161@paruluniversity.ac.in' },
] as const;

export type MentorName = typeof AVAILABLE_MENTORS_DATA[number]['name'];
export const AVAILABLE_MENTOR_NAMES: MentorName[] = AVAILABLE_MENTORS_DATA.map(m => m.name);
export const AVAILABLE_MENTORS = AVAILABLE_MENTOR_NAMES;

export type FundingSource = 'SSIP_PIET' | 'SSIP_PARUL_UNIVERSITY' | 'SSIP_PIMSR' | 'SSIP_PHYSIOTHERAPY';
export const ALL_FUNDING_SOURCES: FundingSource[] = ['SSIP_PIET', 'SSIP_PARUL_UNIVERSITY', 'SSIP_PIMSR', 'SSIP_PHYSIOTHERAPY'];

export type IncubationDocumentType =
  | 'aadharCard'
  | 'license'
  | 'panCard'
  | 'residentialProof'
  | 'pitchDeck'
  | 'resumeFounder'
  | 'resumeCoFounder'
  | 'incubationAgreement'
  | 'bankPassbook';

export const ALL_INCUBATION_DOCUMENT_TYPES: { type: IncubationDocumentType; label: string; description: string }[] = [
    { type: 'aadharCard', label: 'Aadhar Card', description: 'Copy of founder\'s Aadhar card.' },
    { type: 'license', label: 'Relevant business or professional license, if any.' },
    { type: 'panCard', label: 'PAN Card', description: 'Copy of founder\'s PAN card.' },
    { type: 'residentialProof', label: 'Residential Proof', description: 'Utility bill, rent agreement, etc.' },
    { type: 'pitchDeck', label: 'Pitch Deck', description: 'Your latest pitch deck presentation.' },
    { type: 'resumeFounder', label: 'Resume of Founder', description: 'CV of the primary founder.' },
    { type: 'resumeCoFounder', label: 'Resume of Co-founder', description: 'CV of the co-founder(s), if applicable.' },
    { type: 'incubationAgreement', label: 'Signed Incubation Agreement', description: 'The signed agreement document.' },
    { type: 'bankPassbook', label: 'Bank Passbook Copy', description: 'Front page of the bank passbook or a cancelled cheque.' },
];

export interface IncubationDocument {
  url: string;
  fileName: string;
  uploadedAt: Timestamp;
}

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
  teamMembers?: string; // Legacy

  enrollmentNumber?: string;
  college?: string;
  instituteName?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  isSuperAdmin: boolean;

  isTeamMemberOnly?: boolean;
  associatedIdeaId?: string;
  associatedTeamLeaderUid?: string;
}

export type IdeaStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'IN_EVALUATION' | 'SELECTED' | 'NOT_SELECTED' | 'ARCHIVED_BY_ADMIN';
export const ALL_IDEA_STATUSES: IdeaStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'IN_EVALUATION', 'SELECTED', 'NOT_SELECTED', 'ARCHIVED_BY_ADMIN'];

export type ProgramPhase = 'PHASE_1' | 'PHASE_2' | 'COHORT' | 'INCUBATED';
export const ALL_PROGRAM_PHASES: ProgramPhase[] = ['PHASE_1', 'PHASE_2', 'COHORT', 'INCUBATED'];

export type SanctionApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_APPLICABLE';

export interface ExpenseEntry {
  id: string;
  description: string;
  amount: number;
  proofUrl: string;
  proofFileName: string;
  uploadedAt: Timestamp;
}

export interface AdminMark {
  mark: number | null;
  adminDisplayName: string;
  markedAt: Timestamp;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  institute: string;
  department: string;
  enrollmentNumber?: string;
}

export type BeneficiaryAccountType = 'SAVINGS' | 'CURRENT';

export interface IdeaSubmission {
  id?: string;
  userId: string;
  title: string;
  category: string;
  problem: string;
  solution: string;
  uniqueness: string;
  developmentStage: CurrentStage;
  applicantType?: ApplicantCategory;
  teamMembers?: string; // Legacy text field for team members
  structuredTeamMembers?: TeamMember[];
  teamMemberEmails?: string[];
  comments?: Comment[];

  fileURL?: string;
  fileName?: string;
  studioLocation?: 'SURAT' | 'RAJKOT' | 'BARODA' | 'AHMEDABAD';

  status: IdeaStatus;
  programPhase: ProgramPhase | null;
  phase2Marks?: { [adminUid: string]: AdminMark }; // Added for Phase 2 marking
  mentor?: MentorName | null; // Added for mentor assignment
  cohortId?: string | null;

  rejectionRemarks?: string | null;
  rejectedByUid?: string | null;
  rejectedAt?: Timestamp | null;

  phase2PptUrl?: string | null;
  phase2PptFileName?: string | null;
  phase2PptUploadedAt?: Timestamp | null;
  isOutlineAIGenerated?: boolean;

  nextPhaseDate?: Timestamp | null;
  nextPhaseStartTime?: string | null;
  nextPhaseEndTime?: string | null;
  nextPhaseVenue?: string | null;
  nextPhaseGuidelines?: string | null;

  // Incubation Funding Fields
  fundingSource?: FundingSource | null;
  totalFundingAllocated?: number | null;
  sanction1Amount?: number | null;
  sanction2Amount?: number | null;
  sanction1DisbursedAt?: Timestamp | null;
  sanction2DisbursedAt?: Timestamp | null;
  sanction1Expenses?: ExpenseEntry[];
  sanction2Expenses?: ExpenseEntry[];

  beneficiaryName?: string | null;
  beneficiaryAccountNo?: string | null;
  beneficiaryBankName?: string | null;
  beneficiaryIfscCode?: string | null;
  beneficiaryAccountType?: BeneficiaryAccountType | null;
  beneficiaryCity?: string | null;
  beneficiaryBranchName?: string | null;

  sanction1AppliedForNext?: boolean;
  sanction1UtilizationStatus?: SanctionApprovalStatus;
  sanction1UtilizationRemarks?: string | null;
  sanction1UtilizationReviewedBy?: string | null; // Admin UID
  sanction1UtilizationReviewedAt?: Timestamp | null;

  sanction2UtilizationStatus?: SanctionApprovalStatus;
  sanction2UtilizationRemarks?: string | null;
  sanction2UtilizationReviewedBy?: string | null; // Admin UID
  sanction2UtilizationReviewedAt?: Timestamp | null;
  
  incubationDocuments?: Partial<Record<IncubationDocumentType, IncubationDocument>>;


  submittedAt: Timestamp;
  updatedAt: Timestamp;
  createdAt: Timestamp; // Added for consistency if needed on new ideas

  // Denormalized applicant info for easier display if profile is not fetched
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
  cohortId?: string | null;
  attachmentURL?: string | null;
  attachmentName?: string | null;
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

// New Event Type
export type EventCategory = 'WORKSHOP' | 'DEADLINE' | 'MEETING' | 'WEBINAR' | 'OTHER';
export interface PortalEvent {
    id?: string;
    title: string;
    description: string;
    startDateTime: Timestamp;
    endDateTime: Timestamp;
    location: string;
    category: EventCategory;
    targetAudience: 'ALL' | 'SPECIFIC_COHORT';
    cohortId?: string | null;
    flyerUrl?: string | null;
    flyerFileName?: string | null;
    rsvps: string[]; // Array of user UIDs who have RSVP'd
    rsvpCount: number;
    createdByUid: string;
    creatorDisplayName: string | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// New Notification Type
export interface AppNotification {
    id?: string;
    userId: string; // The user this notification is for
    title: string;
    message: string;
    link?: string; // Optional link to navigate to (e.g., /dashboard/idea/xyz)
    isRead: boolean;
    createdAt: Timestamp;
}

export type ActivityLogAction =
  | 'USER_PROFILE_CREATED'
  | 'USER_PROFILE_UPDATED'
  | 'USER_SIGNED_IN'
  | 'USER_SIGNED_OUT'
  | 'USER_PASSWORD_RESET_REQUESTED'
  | 'USER_ACCOUNT_DELETED_SELF'
  | 'USER_ACCOUNT_DELETED_BY_ADMIN'
  | 'USER_NOTIFICATIONS_READ'
  | 'USER_RSVP_SUBMITTED'
  | 'IDEA_SUBMITTED'
  | 'IDEA_PROFILE_DATA_UPDATED'
  | 'IDEA_RESUBMITTED'
  | 'IDEA_PPT_UPLOADED'
  | 'IDEA_TEAM_MEMBER_ADDED'
  | 'IDEA_TEAM_MEMBER_UPDATED'
  | 'IDEA_TEAM_MEMBER_REMOVED'
  | 'USER_GENERATED_PITCH_DECK_OUTLINE'
  | 'IDEA_BENEFICIARY_DETAILS_UPDATED'
  | 'IDEA_EXPENSE_UPLOADED'
  | 'IDEA_APPLIED_FOR_NEXT_SANCTION'
  | 'IDEA_INCUBATION_DOCUMENT_UPLOADED'
  | 'ADMIN_COMMENT_ADDED'
  | 'USER_COMMENT_ADDED'
  | 'ADMIN_USER_ROLE_UPDATED'
  | 'ADMIN_IDEA_STATUS_PHASE_UPDATED'
  | 'ADMIN_IDEA_MENTOR_ASSIGNED'
  | 'ADMIN_IDEA_PHASE2_MARK_SUBMITTED'
  | 'ADMIN_IDEA_ARCHIVED_FOR_REVISION'
  | 'ADMIN_IDEA_ASSIGNED_TO_COHORT'
  | 'ADMIN_IDEA_FUNDING_DETAILS_SET'
  | 'ADMIN_IDEA_SANCTION_DISBURSED'
  | 'ADMIN_IDEA_SANCTION_UTILIZATION_REVIEWED'
  | 'ADMIN_ANNOUNCEMENT_CREATED'
  | 'ADMIN_ANNOUNCEMENT_UPDATED'
  | 'ADMIN_ANNOUNCEMENT_DELETED'
  | 'ADMIN_COHORT_CREATED'
  | 'ADMIN_COHORT_UPDATED'
  | 'ADMIN_COHORT_SCHEDULE_UPDATED'
  | 'ADMIN_COHORT_DELETED'
  | 'ADMIN_SYSTEM_SETTINGS_UPDATED'
  | 'ADMIN_EVENT_CREATED'
  | 'ADMIN_EVENT_UPDATED'
  | 'ADMIN_EVENT_DELETED'
  | 'ADMIN_NOTIFICATION_SENT_COHORT'
  | 'ADMIN_NOTIFICATION_SENT_GLOBAL';


export const ALL_ACTIVITY_LOG_ACTIONS: ActivityLogAction[] = [
  'USER_PROFILE_CREATED', 'USER_PROFILE_UPDATED', 'USER_SIGNED_IN', 'USER_SIGNED_OUT',
  'USER_PASSWORD_RESET_REQUESTED', 'USER_ACCOUNT_DELETED_SELF', 'USER_ACCOUNT_DELETED_BY_ADMIN',
  'USER_NOTIFICATIONS_READ', 'USER_RSVP_SUBMITTED',
  'IDEA_SUBMITTED', 'IDEA_PROFILE_DATA_UPDATED', 'IDEA_RESUBMITTED', 'IDEA_PPT_UPLOADED',
  'IDEA_TEAM_MEMBER_ADDED', 'IDEA_TEAM_MEMBER_UPDATED', 'IDEA_TEAM_MEMBER_REMOVED',
  'USER_GENERATED_PITCH_DECK_OUTLINE',
  'IDEA_BENEFICIARY_DETAILS_UPDATED', 'IDEA_EXPENSE_UPLOADED', 'IDEA_APPLIED_FOR_NEXT_SANCTION', 'IDEA_INCUBATION_DOCUMENT_UPLOADED',
  'ADMIN_COMMENT_ADDED', 'USER_COMMENT_ADDED',
  'ADMIN_USER_ROLE_UPDATED', 'ADMIN_IDEA_STATUS_PHASE_UPDATED', 'ADMIN_IDEA_MENTOR_ASSIGNED',
  'ADMIN_IDEA_PHASE2_MARK_SUBMITTED', 'ADMIN_IDEA_ARCHIVED_FOR_REVISION', 'ADMIN_IDEA_ASSIGNED_TO_COHORT',
  'ADMIN_IDEA_FUNDING_DETAILS_SET', 'ADMIN_IDEA_SANCTION_DISBURSED', 'ADMIN_IDEA_SANCTION_UTILIZATION_REVIEWED',
  'ADMIN_ANNOUNCEMENT_CREATED', 'ADMIN_ANNOUNCEMENT_UPDATED', 'ADMIN_ANNOUNCEMENT_DELETED',
  'ADMIN_COHORT_CREATED', 'ADMIN_COHORT_UPDATED', 'ADMIN_COHORT_SCHEDULE_UPDATED', 'ADMIN_COHORT_DELETED',
  'ADMIN_SYSTEM_SETTINGS_UPDATED',
  'ADMIN_EVENT_CREATED', 'ADMIN_EVENT_UPDATED', 'ADMIN_EVENT_DELETED',
  'ADMIN_NOTIFICATION_SENT_COHORT', 'ADMIN_NOTIFICATION_SENT_GLOBAL'
];


export interface ActivityLogTarget {
  type: string;
  id: string;
  displayName?: string;
}

export interface ActivityLogEntry {
  id?: string;
  timestamp: Timestamp;
  actorUid: string;
  actorDisplayName: string | null;
  action: ActivityLogAction;
  target?: ActivityLogTarget;
  details?: Record<string, any>;
}
