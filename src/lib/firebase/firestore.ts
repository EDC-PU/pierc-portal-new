
import { db, functions as firebaseFunctions, auth } from './config'; 
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs, Timestamp, getCountFromServer, deleteField, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage, IdeaSubmission, Cohort, SystemSettings, IdeaStatus, ProgramPhase, AdminMark, TeamMember, MentorName, ActivityLogAction, ActivityLogTarget, ActivityLogEntry, CohortScheduleEntry, ExpenseEntry, SanctionApprovalStatus } from '@/types';
import { httpsCallable } from 'firebase/functions';
import { nanoid } from 'nanoid';
import type { User } from 'firebase/auth';

// Activity Logging Function
export const logUserActivity = async (
  actorUid: string,
  actorDisplayName: string | null,
  action: ActivityLogAction,
  target?: ActivityLogTarget,
  details?: Record<string, any>
): Promise<void> => {
  try {
    const activityLogRef = collection(db, 'activityLogs');
    const logEntry: Omit<ActivityLogEntry, 'id'> = {
      timestamp: serverTimestamp() as Timestamp,
      actorUid,
      actorDisplayName: actorDisplayName || 'System/Unknown',
      action,
      ...(target && { target }),
      ...(details && { details }),
    };
    await addDoc(activityLogRef, logEntry);
  } catch (error) {
    console.error("Error logging user activity:", error, { actorUid, action, target, details });
  }
};


// User Profile Functions
export const createUserProfileFS = async (userId: string, data: Partial<UserProfile>): Promise<UserProfile> => {
  const userProfileRef = doc(db, 'users', userId);
  const currentAuthUser = auth.currentUser;

  const profileDataForWrite: any = {
    uid: userId,
    email: data.email ?? currentAuthUser?.email ?? null,
    displayName: data.displayName || data.fullName || currentAuthUser?.displayName || 'New User',
    photoURL: data.photoURL ?? currentAuthUser?.photoURL ?? null,
    role: data.role ?? null, 
    isSuperAdmin: (data.email ?? currentAuthUser?.email) === 'pranavrathi07@gmail.com' ? true : (data.isSuperAdmin ?? false),
    fullName: data.fullName || '',
    contactNumber: data.contactNumber || '',
    isTeamMemberOnly: data.isTeamMemberOnly === true, 
    enrollmentNumber: data.enrollmentNumber || null,
    college: data.college || null,
    instituteName: data.instituteName || null,
  };


  if (!profileDataForWrite.isTeamMemberOnly) {
    profileDataForWrite.startupTitle = data.startupTitle || null;
    profileDataForWrite.problemDefinition = data.problemDefinition || null;
    profileDataForWrite.solutionDescription = data.solutionDescription || null;
    profileDataForWrite.uniqueness = data.uniqueness || null;
    profileDataForWrite.applicantCategory = data.applicantCategory || null;
    profileDataForWrite.currentStage = data.currentStage || null;
    profileDataForWrite.teamMembers = data.teamMembers || ''; 
    profileDataForWrite.associatedIdeaId = null;
    profileDataForWrite.associatedTeamLeaderUid = null;
  } else { 
    profileDataForWrite.associatedIdeaId = data.associatedIdeaId || null;
    profileDataForWrite.associatedTeamLeaderUid = data.associatedTeamLeaderUid || null;
    profileDataForWrite.startupTitle = null;
    profileDataForWrite.problemDefinition = null;
    profileDataForWrite.solutionDescription = null;
    profileDataForWrite.uniqueness = null;
    profileDataForWrite.applicantCategory = null;
    profileDataForWrite.currentStage = null;
    profileDataForWrite.teamMembers = null;
  }

  const existingProfileSnap = await getDoc(userProfileRef);
  if (existingProfileSnap.exists()) {
    profileDataForWrite.updatedAt = serverTimestamp() as Timestamp;
    delete profileDataForWrite.createdAt; 
    await updateDoc(userProfileRef, profileDataForWrite);
  } else {
    profileDataForWrite.createdAt = serverTimestamp() as Timestamp;
    profileDataForWrite.updatedAt = serverTimestamp() as Timestamp;
    await setDoc(userProfileRef, profileDataForWrite);
  }

  const docSnap = await getDoc(userProfileRef);
  if (!docSnap.exists()) {
    throw new Error("Failed to create or retrieve user profile after write operation.");
  }
  const rawData = docSnap.data()!;
  return {
    uid: docSnap.id,
    email: rawData.email ?? null,
    displayName: rawData.displayName ?? null,
    photoURL: rawData.photoURL ?? null,
    role: rawData.role ?? null,
    fullName: rawData.fullName ?? '',
    contactNumber: rawData.contactNumber ?? '',
    applicantCategory: rawData.applicantCategory ?? null,
    currentStage: rawData.currentStage ?? null,
    startupTitle: rawData.startupTitle ?? null,
    problemDefinition: rawData.problemDefinition ?? null,
    solutionDescription: rawData.solutionDescription ?? null,
    uniqueness: rawData.uniqueness ?? null,
    teamMembers: rawData.teamMembers ?? '',
    enrollmentNumber: rawData.enrollmentNumber ?? null,
    college: rawData.college ?? null,
    instituteName: rawData.instituteName ?? null,
    createdAt: rawData.createdAt as Timestamp,
    updatedAt: rawData.updatedAt as Timestamp,
    isSuperAdmin: rawData.isSuperAdmin === true,
    isTeamMemberOnly: rawData.isTeamMemberOnly === true, 
    associatedIdeaId: rawData.associatedIdeaId ?? null,
    associatedTeamLeaderUid: rawData.associatedTeamLeaderUid ?? null,
  };
};


export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userProfileRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    const profile: UserProfile = {
        uid: docSnap.id,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        photoURL: data.photoURL ?? null,
        role: data.role ?? null,
        fullName: data.fullName ?? '',
        contactNumber: data.contactNumber ?? '',
        applicantCategory: data.applicantCategory ?? null,
        currentStage: data.currentStage ?? null,
        startupTitle: data.startupTitle ?? null,
        problemDefinition: data.problemDefinition ?? null,
        solutionDescription: data.solutionDescription ?? null,
        uniqueness: data.uniqueness ?? null,
        teamMembers: data.teamMembers ?? '',
        enrollmentNumber: data.enrollmentNumber || null,
        college: data.college || null,
        instituteName: data.instituteName || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isSuperAdmin: false,
        isTeamMemberOnly: data.isTeamMemberOnly === true, 
        associatedIdeaId: data.associatedIdeaId ?? null,
        associatedTeamLeaderUid: data.associatedTeamLeaderUid ?? null,
    };

    if (profile.email === 'pranavrathi07@gmail.com') {
        profile.isSuperAdmin = true;
        if (profile.role !== 'ADMIN_FACULTY') {
            profile.role = 'ADMIN_FACULTY';
        }
    } else if (data.isSuperAdmin === true) {
        profile.isSuperAdmin = true;
    }
    return profile;
  }
  return null;
};

export const updateUserProfile = async (
  targetUserId: string,
  data: Partial<UserProfile>,
  actorProfile?: UserProfile | null
): Promise<void> => {
  const userProfileRef = doc(db, 'users', targetUserId);
  const { uid, email, createdAt, role, isSuperAdmin, ...updateData } = data;

  const cleanedUpdateData: Partial<UserProfile> = { ...updateData };
  if (cleanedUpdateData.enrollmentNumber === '') cleanedUpdateData.enrollmentNumber = null;
  if (cleanedUpdateData.college === '') cleanedUpdateData.college = null;
  if (cleanedUpdateData.instituteName === '') cleanedUpdateData.instituteName = null;
  if ('startupTitle' in cleanedUpdateData && cleanedUpdateData.startupTitle === '') cleanedUpdateData.startupTitle = null;


  const finalCleanData = Object.fromEntries(Object.entries(cleanedUpdateData).filter(([, value]) => value !== undefined));


  await updateDoc(userProfileRef, {
    ...finalCleanData,
    updatedAt: serverTimestamp(),
  });

  const actorUidToLog = actorProfile ? actorProfile.uid : targetUserId;
  const actorDisplayNameToLog = actorProfile ? (actorProfile.displayName || actorProfile.fullName) : (data.displayName || data.fullName);
  const targetUserSnap = await getDoc(userProfileRef);
  const targetUserDisplayName = targetUserSnap.exists() ? (targetUserSnap.data().displayName || targetUserSnap.data().fullName) : targetUserId;


  await logUserActivity(
    actorUidToLog,
    actorDisplayNameToLog,
    'USER_PROFILE_UPDATED',
    { type: 'USER_PROFILE', id: targetUserId, displayName: targetUserDisplayName || undefined },
    { fieldsUpdated: Object.keys(finalCleanData) }
  );
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  const users: UserProfile[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const profile: UserProfile = {
        uid: doc.id,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        photoURL: data.photoURL ?? null,
        role: data.role ?? null,
        fullName: data.fullName ?? '',
        contactNumber: data.contactNumber ?? '',
        applicantCategory: data.applicantCategory ?? null,
        currentStage: data.currentStage ?? null,
        startupTitle: data.startupTitle ?? null,
        problemDefinition: data.problemDefinition ?? null,
        solutionDescription: data.solutionDescription ?? null,
        uniqueness: data.uniqueness ?? null,
        teamMembers: data.teamMembers ?? '',
        enrollmentNumber: data.enrollmentNumber || null,
        college: data.college || null,
        instituteName: data.instituteName || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isSuperAdmin: false,
        isTeamMemberOnly: data.isTeamMemberOnly === true, 
        associatedIdeaId: data.associatedIdeaId ?? null,
        associatedTeamLeaderUid: data.associatedTeamLeaderUid ?? null,
    };
     if (profile.email === 'pranavrathi07@gmail.com') {
        profile.isSuperAdmin = true;
        if (profile.role !== 'ADMIN_FACULTY') {
            profile.role = 'ADMIN_FACULTY';
        }
    } else if (data.isSuperAdmin === true) {
        profile.isSuperAdmin = true;
    }
    users.push(profile);
  });
  return users;
};

export const getTotalUsersCount = async (): Promise<number> => {
  const usersCol = collection(db, 'users');
  const snapshot = await getCountFromServer(usersCol);
  return snapshot.data().count;
};


export const updateUserRoleAndPermissionsFS = async (targetUserId: string, newRole: Role, adminProfile: UserProfile, newIsSuperAdmin?: boolean): Promise<void> => {
  const userProfileRef = doc(db, 'users', targetUserId);
  const oldProfileSnap = await getDoc(userProfileRef);
  const oldRole = oldProfileSnap.exists() ? oldProfileSnap.data().role : null;
  const oldIsSuperAdmin = oldProfileSnap.exists() ? oldProfileSnap.data().isSuperAdmin : false;

  const updates: Partial<UserProfile> = {
    role: newRole,
    updatedAt: serverTimestamp() as Timestamp,
  };
  if (newIsSuperAdmin !== undefined) {
    updates.isSuperAdmin = newIsSuperAdmin;
  }

  const userDocSnap = await getDoc(userProfileRef);
  if (userDocSnap.exists() && userDocSnap.data().email === 'pranavrathi07@gmail.com') {
    updates.role = 'ADMIN_FACULTY';
    updates.isSuperAdmin = true;
  }

  await updateDoc(userProfileRef, updates as any);

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_USER_ROLE_UPDATED',
    { type: 'USER_PROFILE', id: targetUserId, displayName: userDocSnap.exists() ? (userDocSnap.data().displayName || userDocSnap.data().fullName) : targetUserId },
    { oldRole, newRole, oldIsSuperAdmin, newIsSuperAdmin: newIsSuperAdmin ?? oldIsSuperAdmin }
  );
};

export const deleteUserAccountAndProfile = async (userIdToDelete: string, adminProfile: UserProfile): Promise<void> => {
  const userProfileRef = doc(db, 'users', userIdToDelete);
  const userDocSnap = await getDoc(userProfileRef);
  const targetUserDisplayName = userDocSnap.exists() ? (userDocSnap.data().displayName || userDocSnap.data().fullName) : userIdToDelete;


  if (userDocSnap.exists() && userDocSnap.data().email === 'pranavrathi07@gmail.com') {
    throw new Error("The primary super admin's profile and account cannot be deleted through this interface.");
  }

  await deleteDoc(userProfileRef);

  try {
    const deleteAuthUserFn = httpsCallable(firebaseFunctions, 'deleteAuthUserCallable');
    await deleteAuthUserFn({ uid: userIdToDelete });

    await logUserActivity(
      adminProfile.uid,
      adminProfile.displayName || adminProfile.fullName,
      'USER_ACCOUNT_DELETED_BY_ADMIN',
      { type: 'USER_PROFILE', id: userIdToDelete, displayName: targetUserDisplayName || undefined }
    );
  } catch (error) {
    console.error("Error calling Firebase Function to delete auth user:", error);
    throw new Error(`Firestore profile deleted, but an error occurred attempting to delete the Firebase Auth account: ${(error as Error).message}. Please check the Cloud Function logs, or manually delete the auth account if necessary.`);
  }
};


// Announcement Functions
export const createAnnouncement = async (announcementData: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>, adminProfile: UserProfile): Promise<Announcement> => {
  const announcementsCol = collection(db, 'announcements');
  const newAnnouncementPayload = {
    ...announcementData,
    cohortId: announcementData.targetAudience === 'SPECIFIC_COHORT' ? announcementData.cohortId : null,
    createdByUid: adminProfile.uid,
    creatorDisplayName: adminProfile.displayName || adminProfile.fullName,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };
  const docRef = await addDoc(announcementsCol, newAnnouncementPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create announcement.");

  const createdAnn = { id: newDocSnap.id, ...newDocSnap.data() } as Announcement;
  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_ANNOUNCEMENT_CREATED',
    { type: 'ANNOUNCEMENT', id: createdAnn.id!, displayName: createdAnn.title },
    { title: createdAnn.title, isUrgent: createdAnn.isUrgent, targetAudience: createdAnn.targetAudience, cohortId: createdAnn.cohortId }
  );
  return createdAnn;
};

export const getAnnouncementsStream = (callback: (announcements: Announcement[]) => void) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol,
    where('isUrgent', '==', false),
    where('targetAudience', '==', 'ALL'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const announcements: Announcement[] = [];
    querySnapshot.forEach((doc) => {
      announcements.push({ id: doc.id, ...doc.data() } as Announcement);
    });
    callback(announcements);
  }, (error) => {
    console.error("Error fetching general announcements:", error);
    callback([]);
  });
};

export const getUrgentAnnouncementsStream = (callback: (announcements: Announcement[]) => void) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol,
    where('isUrgent', '==', true),
    where('targetAudience', '==', 'ALL'), 
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const announcements: Announcement[] = [];
    querySnapshot.forEach((doc) => {
      announcements.push({ id: doc.id, ...doc.data() } as Announcement);
    });
    callback(announcements);
  }, (error) => {
    console.error("Error fetching urgent announcements:", error);
    callback([]);
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
  }, (error) => {
    console.error("Error fetching all announcements for admin:", error);
    callback([]);
  });
};

export const updateAnnouncement = async (announcementId: string, data: Partial<Omit<Announcement, 'id'|'createdAt'|'createdByUid'|'creatorDisplayName'>>, adminProfile: UserProfile): Promise<void> => {
  const announcementRef = doc(db, 'announcements', announcementId);
  
  const updateData = { ...data };
  if (data.targetAudience === 'ALL') {
    updateData.cohortId = null; 
  }

  await updateDoc(announcementRef, {
    ...updateData,
    updatedAt: serverTimestamp(),
  });
  const updatedAnnSnap = await getDoc(announcementRef);
  const updatedAnnTitle = updatedAnnSnap.exists() ? updatedAnnSnap.data().title : announcementId;
  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_ANNOUNCEMENT_UPDATED',
    { type: 'ANNOUNCEMENT', id: announcementId, displayName: updatedAnnTitle },
    { fieldsUpdated: Object.keys(updateData), cohortId: updateData.cohortId }
  );
};

export const deleteAnnouncement = async (announcementId: string, adminProfile: UserProfile): Promise<void> => {
  const announcementRef = doc(db, 'announcements', announcementId);
  const annSnap = await getDoc(announcementRef);
  const annTitle = annSnap.exists() ? annSnap.data().title : announcementId;
  await deleteDoc(announcementRef);
  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_ANNOUNCEMENT_DELETED',
    { type: 'ANNOUNCEMENT', id: announcementId, displayName: annTitle }
  );
};

// Idea Submission functions
export const createIdeaFromProfile = async (
  userId: string,
  profileData: Pick<UserProfile, 'startupTitle' | 'problemDefinition' | 'solutionDescription' | 'uniqueness' | 'currentStage' | 'applicantCategory' | 'teamMembers'>
): Promise<IdeaSubmission | null> => {
  const userProfile = await getUserProfile(userId);
  if (!userProfile) {
    console.error("[firestore.ts:createIdeaFromProfile] User profile not found for UID:", userId);
    throw new Error("User profile not found, cannot create idea submission.");
  }

  if (userProfile.isTeamMemberOnly ||
      (userProfile.role === 'ADMIN_FACULTY' &&
       (profileData.startupTitle === 'Administrative Account' || profileData.startupTitle === 'Faculty/Mentor Account'))) {
    return null; 
  }

  if (!profileData.startupTitle || !profileData.problemDefinition || !profileData.solutionDescription || !profileData.uniqueness || !profileData.currentStage || !profileData.applicantCategory) {
    throw new Error("Missing essential idea fields in profile data for idea submission. All idea-related fields must be provided.");
  }

  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, where('userId', '==', userId));
  const existingIdeasSnap = await getDocs(q);

  let existingIdeaToUpdate: IdeaSubmission | null = null;
  let ideaDocRef;

  if (!existingIdeasSnap.empty) {
    const ideas = existingIdeasSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as IdeaSubmission));
    existingIdeaToUpdate = ideas.find(idea => idea.status === 'ARCHIVED_BY_ADMIN') || 
                           ideas.sort((a,b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0))[0];
  }
  
  const ideaPayloadBase = {
    userId: userId,
    applicantDisplayName: userProfile.displayName || userProfile.fullName || 'N/A',
    applicantEmail: userProfile.email || 'N/A',
    title: profileData.startupTitle!,
    problem: profileData.problemDefinition!,
    solution: profileData.solutionDescription!,
    uniqueness: profileData.uniqueness!,
    developmentStage: profileData.currentStage!,
    applicantType: profileData.applicantCategory,
    teamMembers: profileData.teamMembers || '', 
    updatedAt: serverTimestamp() as Timestamp,
  };

  try {
    if (existingIdeaToUpdate) {
      ideaDocRef = doc(db, 'ideas', existingIdeaToUpdate.id!);
      const updateData: Partial<IdeaSubmission> = {
        ...ideaPayloadBase,
        status: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? 'SUBMITTED' : existingIdeaToUpdate.status,
        programPhase: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.programPhase,
        cohortId: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.cohortId,
        phase2Marks: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? {} : existingIdeaToUpdate.phase2Marks,
        mentor: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.mentor,
        rejectionRemarks: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.rejectionRemarks,
        rejectedByUid: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.rejectedByUid,
        rejectedAt: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.rejectedAt,
        phase2PptUrl: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.phase2PptUrl || null),
        phase2PptFileName: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.phase2PptFileName || null),
        phase2PptUploadedAt: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.phase2PptUploadedAt || null),
        nextPhaseDate: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.nextPhaseDate,
        nextPhaseStartTime: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.nextPhaseStartTime,
        nextPhaseEndTime: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.nextPhaseEndTime,
        nextPhaseVenue: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.nextPhaseVenue,
        nextPhaseGuidelines: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.nextPhaseGuidelines,
        structuredTeamMembers: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? [] : (existingIdeaToUpdate.structuredTeamMembers || []),
        teamMemberEmails: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? [] : (existingIdeaToUpdate.teamMemberEmails || []),
        // Reset funding fields if resubmitting archived idea
        totalFundingAllocated: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.totalFundingAllocated,
        sanction1Amount: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.sanction1Amount,
        sanction2Amount: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.sanction2Amount,
        sanction1DisbursedAt: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.sanction1DisbursedAt,
        sanction2DisbursedAt: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.sanction2DisbursedAt,
        sanction1Expenses: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? [] : (existingIdeaToUpdate.sanction1Expenses || []),
        sanction2Expenses: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? [] : (existingIdeaToUpdate.sanction2Expenses || []),
        beneficiaryName: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.beneficiaryName,
        beneficiaryAccountNo: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.beneficiaryAccountNo,
        beneficiaryBankName: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.beneficiaryBankName,
        beneficiaryIfscCode: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.beneficiaryIfscCode,
        sanction1AppliedForNext: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? false : existingIdeaToUpdate.sanction1AppliedForNext,
        sanction1UtilizationStatus: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? 'NOT_APPLICABLE' : (existingIdeaToUpdate.sanction1UtilizationStatus || 'NOT_APPLICABLE'),
        sanction1UtilizationRemarks: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.sanction1UtilizationRemarks,
        sanction1UtilizationReviewedBy: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.sanction1UtilizationReviewedBy,
        sanction1UtilizationReviewedAt: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.sanction1UtilizationReviewedAt,
        sanction2UtilizationStatus: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? 'NOT_APPLICABLE' : (existingIdeaToUpdate.sanction2UtilizationStatus || 'NOT_APPLICABLE'),
        sanction2UtilizationRemarks: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.sanction2UtilizationRemarks,
        sanction2UtilizationReviewedBy: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.sanction2UtilizationReviewedBy,
        sanction2UtilizationReviewedAt: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.sanction2UtilizationReviewedAt,
      };
      await updateDoc(ideaDocRef, updateData as any); 
      await logUserActivity(
        userId,
        userProfile.displayName || userProfile.fullName,
        existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? 'IDEA_RESUBMITTED' : 'IDEA_PROFILE_DATA_UPDATED',
        { type: 'IDEA', id: ideaDocRef.id, displayName: profileData.startupTitle! }
      );
    } else {
      const newIdeaData: Omit<IdeaSubmission, 'id'> = {
        ...(ideaPayloadBase as Omit<IdeaSubmission, 'id' | 'submittedAt'>), 
        structuredTeamMembers: [],
        teamMemberEmails: [],
        status: 'SUBMITTED',
        programPhase: null,
        cohortId: null,
        phase2Marks: {},
        mentor: null,
        rejectionRemarks: null,
        rejectedByUid: null,
        rejectedAt: null,
        phase2PptUrl: null,
        phase2PptFileName: null,
        phase2PptUploadedAt: null,
        nextPhaseDate: null,
        nextPhaseStartTime: null,
        nextPhaseEndTime: null,
        nextPhaseVenue: null,
        nextPhaseGuidelines: null,
        // Initialize funding fields
        totalFundingAllocated: null,
        sanction1Amount: null,
        sanction2Amount: null,
        sanction1DisbursedAt: null,
        sanction2DisbursedAt: null,
        sanction1Expenses: [],
        sanction2Expenses: [],
        beneficiaryName: null,
        beneficiaryAccountNo: null,
        beneficiaryBankName: null,
        beneficiaryIfscCode: null,
        sanction1AppliedForNext: false,
        sanction1UtilizationStatus: 'NOT_APPLICABLE',
        sanction1UtilizationRemarks: null,
        sanction1UtilizationReviewedBy: null,
        sanction1UtilizationReviewedAt: null,
        sanction2UtilizationStatus: 'NOT_APPLICABLE',
        sanction2UtilizationRemarks: null,
        sanction2UtilizationReviewedBy: null,
        sanction2UtilizationReviewedAt: null,
        submittedAt: serverTimestamp() as Timestamp,
      };
      ideaDocRef = await addDoc(collection(db, 'ideas'), newIdeaData);
      await logUserActivity(
        userId,
        userProfile.displayName || userProfile.fullName,
        'IDEA_SUBMITTED',
        { type: 'IDEA', id: ideaDocRef.id, displayName: profileData.startupTitle! }
      );
    }

    const finalDocSnap = await getDoc(ideaDocRef);
    if (!finalDocSnap.exists()) {
      throw new Error("Could not create or update idea submission from profile.");
    }
    return { id: finalDocSnap.id, ...finalDocSnap.data() } as IdeaSubmission;
  } catch (error) {
    console.error("[firestore.ts:createIdeaFromProfile] Firestore operation error:", error);
    if ((error as any).code === 'permission-denied') {
        console.error("[firestore.ts:createIdeaFromProfile] Firestore Permission Denied. Check security rules for /ideas collection. Payload was:", JSON.stringify(ideaPayloadBase, null, 2));
    }
    throw error; 
  }
};


export const getAllIdeaSubmissionsWithDetails = async (): Promise<IdeaSubmission[]> => {
  const ideasCol = collection(db, 'ideas');
  const ideasQuery = query(ideasCol, orderBy('submittedAt', 'desc'));
  const ideasSnapshot = await getDocs(ideasQuery);

  if (ideasSnapshot.empty) {
    return [];
  }

  const applicantIds = new Set<string>();
  ideasSnapshot.docs.forEach(doc => {
    const ideaData = doc.data() as Omit<IdeaSubmission, 'id'>;
    if (ideaData.userId) {
      applicantIds.add(ideaData.userId);
    }
  });

  const profilesMap = new Map<string, UserProfile | null>();
  if (applicantIds.size > 0) {
    const profilePromises = Array.from(applicantIds).map(id => getUserProfile(id).catch(e => {
      console.error(`Failed to fetch profile for ${id}:`, e);
      return null;
    }));
    const profiles = await Promise.all(profilePromises);
    profiles.forEach((profile, index) => {
      if (profile) {
        profilesMap.set(Array.from(applicantIds)[index], profile);
      }
    });
  }

  const ideaSubmissions: IdeaSubmission[] = [];
  ideasSnapshot.docs.forEach(ideaDoc => {
    const ideaData = ideaDoc.data() as Omit<IdeaSubmission, 'id'>;
    const userProfile = ideaData.userId ? profilesMap.get(ideaData.userId) : null;

    const applicantDisplayName = userProfile ? (userProfile.displayName || userProfile.fullName || 'Unknown User') : ideaData.applicantDisplayName || 'N/A';
    const applicantEmail = userProfile ? (userProfile.email || 'No Email') : ideaData.applicantEmail || 'N/A';

    const submittedAt = (ideaData.submittedAt as any) instanceof Timestamp ? (ideaData.submittedAt as Timestamp) : Timestamp.now();
    const updatedAt = (ideaData.updatedAt as any) instanceof Timestamp ? (ideaData.updatedAt as Timestamp) : Timestamp.now();
    const nextPhaseDate = (ideaData.nextPhaseDate as any) instanceof Timestamp ? (ideaData.nextPhaseDate as Timestamp) : null;


    ideaSubmissions.push({
      id: ideaDoc.id,
      ...ideaData,
      programPhase: ideaData.programPhase || null,
      cohortId: ideaData.cohortId || null,
      phase2Marks: ideaData.phase2Marks || {},
      submittedAt,
      updatedAt,
      applicantDisplayName,
      applicantEmail,
      teamMembers: ideaData.teamMembers || '',
      structuredTeamMembers: ideaData.structuredTeamMembers || [],
      teamMemberEmails: ideaData.teamMemberEmails || [],
      rejectionRemarks: ideaData.rejectionRemarks || null,
      rejectedByUid: ideaData.rejectedByUid || null,
      rejectedAt: ideaData.rejectedAt || null,
      phase2PptUrl: ideaData.phase2PptUrl || null,
      phase2PptFileName: ideaData.phase2PptFileName || null,
      phase2PptUploadedAt: ideaData.phase2PptUploadedAt || null,
      nextPhaseDate: nextPhaseDate,
      nextPhaseStartTime: ideaData.nextPhaseStartTime || null,
      nextPhaseEndTime: ideaData.nextPhaseEndTime || null,
      nextPhaseVenue: ideaData.nextPhaseVenue || null,
      nextPhaseGuidelines: ideaData.nextPhaseGuidelines || null,
      mentor: ideaData.mentor,
      // Include new funding fields
      totalFundingAllocated: ideaData.totalFundingAllocated ?? null,
      sanction1Amount: ideaData.sanction1Amount ?? null,
      sanction2Amount: ideaData.sanction2Amount ?? null,
      sanction1DisbursedAt: ideaData.sanction1DisbursedAt ?? null,
      sanction2DisbursedAt: ideaData.sanction2DisbursedAt ?? null,
      sanction1Expenses: ideaData.sanction1Expenses || [],
      sanction2Expenses: ideaData.sanction2Expenses || [],
      beneficiaryName: ideaData.beneficiaryName ?? null,
      beneficiaryAccountNo: ideaData.beneficiaryAccountNo ?? null,
      beneficiaryBankName: ideaData.beneficiaryBankName ?? null,
      beneficiaryIfscCode: ideaData.beneficiaryIfscCode ?? null,
      sanction1AppliedForNext: ideaData.sanction1AppliedForNext ?? false,
      sanction1UtilizationStatus: ideaData.sanction1UtilizationStatus ?? 'NOT_APPLICABLE',
      sanction1UtilizationRemarks: ideaData.sanction1UtilizationRemarks ?? null,
      sanction1UtilizationReviewedBy: ideaData.sanction1UtilizationReviewedBy ?? null,
      sanction1UtilizationReviewedAt: ideaData.sanction1UtilizationReviewedAt ?? null,
      sanction2UtilizationStatus: ideaData.sanction2UtilizationStatus ?? 'NOT_APPLICABLE',
      sanction2UtilizationRemarks: ideaData.sanction2UtilizationRemarks ?? null,
      sanction2UtilizationReviewedBy: ideaData.sanction2UtilizationReviewedBy ?? null,
      sanction2UtilizationReviewedAt: ideaData.sanction2UtilizationReviewedAt ?? null,
    } as IdeaSubmission);
  });

  return ideaSubmissions;
};

export const getIdeasAssignedToMentor = async (mentorName: MentorName): Promise<IdeaSubmission[]> => {
  const ideasCol = collection(db, 'ideas');
  const ideasQuery = query(
    ideasCol,
    where('mentor', '==', mentorName),
    orderBy('updatedAt', 'desc') 
  );
  const ideasSnapshot = await getDocs(ideasQuery);

  if (ideasSnapshot.empty) {
    return [];
  }

  const applicantIds = new Set<string>();
  ideasSnapshot.docs.forEach(doc => {
    const ideaData = doc.data() as Omit<IdeaSubmission, 'id'>;
    if (ideaData.userId) {
      applicantIds.add(ideaData.userId);
    }
  });

  const profilesMap = new Map<string, UserProfile | null>();
  if (applicantIds.size > 0) {
    const profilePromises = Array.from(applicantIds).map(id => getUserProfile(id).catch(e => {
      console.error(`Failed to fetch profile for ${id}:`, e);
      return null;
    }));
    const profiles = await Promise.all(profilePromises);
    profiles.forEach((profile, index) => {
      if (profile) {
        profilesMap.set(Array.from(applicantIds)[index], profile);
      }
    });
  }

  const ideaSubmissions: IdeaSubmission[] = [];
  ideasSnapshot.docs.forEach(ideaDoc => {
    const ideaData = ideaDoc.data() as Omit<IdeaSubmission, 'id'>;
    const userProfile = ideaData.userId ? profilesMap.get(ideaData.userId) : null;

    const applicantDisplayName = userProfile ? (userProfile.displayName || userProfile.fullName || 'Unknown User') : ideaData.applicantDisplayName || 'N/A';
    const applicantEmail = userProfile ? (userProfile.email || 'No Email') : ideaData.applicantEmail || 'N/A';

    const submittedAt = (ideaData.submittedAt as any) instanceof Timestamp ? (ideaData.submittedAt as Timestamp) : Timestamp.now();
    const updatedAt = (ideaData.updatedAt as any) instanceof Timestamp ? (ideaData.updatedAt as Timestamp) : Timestamp.now();
    const nextPhaseDate = (ideaData.nextPhaseDate as any) instanceof Timestamp ? (ideaData.nextPhaseDate as Timestamp) : null;

    ideaSubmissions.push({
      id: ideaDoc.id,
      ...ideaData,
      programPhase: ideaData.programPhase || null,
      cohortId: ideaData.cohortId || null,
      phase2Marks: ideaData.phase2Marks || {},
      submittedAt,
      updatedAt,
      applicantDisplayName,
      applicantEmail,
      teamMembers: ideaData.teamMembers || '',
      structuredTeamMembers: ideaData.structuredTeamMembers || [],
      teamMemberEmails: ideaData.teamMemberEmails || [],
      rejectionRemarks: ideaData.rejectionRemarks || null,
      rejectedByUid: ideaData.rejectedByUid || null,
      rejectedAt: ideaData.rejectedAt || null,
      phase2PptUrl: ideaData.phase2PptUrl || null,
      phase2PptFileName: ideaData.phase2PptFileName || null,
      phase2PptUploadedAt: ideaData.phase2PptUploadedAt || null,
      nextPhaseDate: nextPhaseDate,
      nextPhaseStartTime: ideaData.nextPhaseStartTime || null,
      nextPhaseEndTime: ideaData.nextPhaseEndTime || null,
      nextPhaseVenue: ideaData.nextPhaseVenue || null,
      nextPhaseGuidelines: ideaData.nextPhaseGuidelines || null,
      mentor: ideaData.mentor,
      // Include new funding fields
      totalFundingAllocated: ideaData.totalFundingAllocated ?? null,
      sanction1Amount: ideaData.sanction1Amount ?? null,
      sanction2Amount: ideaData.sanction2Amount ?? null,
      sanction1DisbursedAt: ideaData.sanction1DisbursedAt ?? null,
      sanction2DisbursedAt: ideaData.sanction2DisbursedAt ?? null,
      sanction1Expenses: ideaData.sanction1Expenses || [],
      sanction2Expenses: ideaData.sanction2Expenses || [],
      beneficiaryName: ideaData.beneficiaryName ?? null,
      beneficiaryAccountNo: ideaData.beneficiaryAccountNo ?? null,
      beneficiaryBankName: ideaData.beneficiaryBankName ?? null,
      beneficiaryIfscCode: ideaData.beneficiaryIfscCode ?? null,
      sanction1AppliedForNext: ideaData.sanction1AppliedForNext ?? false,
      sanction1UtilizationStatus: ideaData.sanction1UtilizationStatus ?? 'NOT_APPLICABLE',
      sanction1UtilizationRemarks: ideaData.sanction1UtilizationRemarks ?? null,
      sanction1UtilizationReviewedBy: ideaData.sanction1UtilizationReviewedBy ?? null,
      sanction1UtilizationReviewedAt: ideaData.sanction1UtilizationReviewedAt ?? null,
      sanction2UtilizationStatus: ideaData.sanction2UtilizationStatus ?? 'NOT_APPLICABLE',
      sanction2UtilizationRemarks: ideaData.sanction2UtilizationRemarks ?? null,
      sanction2UtilizationReviewedBy: ideaData.sanction2UtilizationReviewedBy ?? null,
      sanction2UtilizationReviewedAt: ideaData.sanction2UtilizationReviewedAt ?? null,
    } as IdeaSubmission);
  });

  return ideaSubmissions;
};


export const updateIdeaStatusAndPhase = async (
  ideaId: string,
  ideaTitle: string,
  newStatus: IdeaStatus,
  adminProfile: UserProfile,
  newPhase: ProgramPhase | null = null,
  remarks?: string,
  nextPhaseDetails?: {
    date: Timestamp | null;
    startTime: string | null;
    endTime: string | null;
    venue: string | null;
    guidelines: string | null;
  }
): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const oldIdeaSnap = await getDoc(ideaRef);
  const oldStatus = oldIdeaSnap.exists() ? oldIdeaSnap.data().status : null;
  const oldPhase = oldIdeaSnap.exists() ? oldIdeaSnap.data().programPhase : null;

  const updates: {[key: string]: any} = {
    status: newStatus,
    updatedAt: serverTimestamp(),
  };

  if (newStatus === 'SELECTED') {
    updates.programPhase = newPhase;
    updates.rejectionRemarks = deleteField();
    updates.rejectedByUid = deleteField();
    updates.rejectedAt = deleteField();
    
    if (newPhase === 'PHASE_2') {
      const currentDoc = await getDoc(ideaRef);
      if (currentDoc.exists() && !currentDoc.data().phase2Marks) {
        updates.phase2Marks = {};
      }
    } else if (newPhase !== 'COHORT' && newPhase !== 'INCUBATED') { 
        updates.mentor = deleteField();
    }
     if (newPhase === 'INCUBATED') {
        // Initialize funding status if not already set
        const currentData = oldIdeaSnap.exists() ? oldIdeaSnap.data() : {};
        if (currentData && !currentData.sanction1UtilizationStatus) updates.sanction1UtilizationStatus = 'NOT_APPLICABLE';
        if (currentData && !currentData.sanction2UtilizationStatus) updates.sanction2UtilizationStatus = 'NOT_APPLICABLE';
        if (currentData && !currentData.sanction1Expenses) updates.sanction1Expenses = [];
        if (currentData && !currentData.sanction2Expenses) updates.sanction2Expenses = [];
    }
    
    if (newPhase && (newPhase === 'PHASE_1' || newPhase === 'PHASE_2' || newPhase === 'INCUBATED') && nextPhaseDetails) {
      updates.nextPhaseDate = nextPhaseDetails.date;
      updates.nextPhaseStartTime = nextPhaseDetails.startTime;
      updates.nextPhaseEndTime = nextPhaseDetails.endTime;
      updates.nextPhaseVenue = nextPhaseDetails.venue;
      updates.nextPhaseGuidelines = nextPhaseDetails.guidelines;
    } else if (newPhase === 'COHORT' || !newPhase) { 
        updates.nextPhaseDate = null;
        updates.nextPhaseStartTime = null;
        updates.nextPhaseEndTime = null;
        updates.nextPhaseVenue = null;
        updates.nextPhaseGuidelines = null;
        if (newPhase !== 'COHORT' && newPhase !== 'INCUBATED') {
          updates.mentor = deleteField();
        }
    }
  } else if (newStatus === 'ARCHIVED_BY_ADMIN') { 
    updates.programPhase = null;
    updates.phase2Marks = {};
    updates.mentor = deleteField();
    updates.cohortId = deleteField(); 
    updates.rejectionRemarks = deleteField();
    updates.rejectedByUid = deleteField();
    updates.rejectedAt = deleteField();
    updates.nextPhaseDate = null;
    updates.nextPhaseStartTime = null;
    updates.nextPhaseEndTime = null;
    updates.nextPhaseVenue = null;
    updates.nextPhaseGuidelines = null;
     // Reset funding fields on archive
    updates.totalFundingAllocated = deleteField();
    updates.sanction1Amount = deleteField();
    updates.sanction2Amount = deleteField();
    updates.sanction1DisbursedAt = deleteField();
    updates.sanction2DisbursedAt = deleteField();
    updates.sanction1Expenses = [];
    updates.sanction2Expenses = [];
    updates.beneficiaryName = deleteField();
    updates.beneficiaryAccountNo = deleteField();
    updates.beneficiaryBankName = deleteField();
    updates.beneficiaryIfscCode = deleteField();
    updates.sanction1AppliedForNext = false;
    updates.sanction1UtilizationStatus = 'NOT_APPLICABLE';
    updates.sanction1UtilizationRemarks = deleteField();
    updates.sanction1UtilizationReviewedBy = deleteField();
    updates.sanction1UtilizationReviewedAt = deleteField();
    updates.sanction2UtilizationStatus = 'NOT_APPLICABLE';
    updates.sanction2UtilizationRemarks = deleteField();
    updates.sanction2UtilizationReviewedBy = deleteField();
    updates.sanction2UtilizationReviewedAt = deleteField();
  } else { 
    updates.programPhase = null;
    updates.nextPhaseDate = null;
    updates.nextPhaseStartTime = null;
    updates.nextPhaseEndTime = null;
    updates.nextPhaseVenue = null;
    updates.nextPhaseGuidelines = null;
    updates.mentor = deleteField();
    updates.cohortId = deleteField(); 
    if (newStatus === 'NOT_SELECTED') {
      updates.rejectionRemarks = remarks || 'No specific remarks provided.';
      updates.rejectedByUid = adminProfile.uid;
      updates.rejectedAt = serverTimestamp() as Timestamp;
    } else {
      updates.rejectionRemarks = deleteField();
      updates.rejectedByUid = deleteField();
      updates.rejectedAt = deleteField();
    }
  }
  await updateDoc(ideaRef, updates);

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    newStatus === 'ARCHIVED_BY_ADMIN' ? 'ADMIN_IDEA_ARCHIVED_FOR_REVISION' : 'ADMIN_IDEA_STATUS_PHASE_UPDATED',
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { oldStatus, newStatus, oldPhase, newPhase, remarks: newStatus === 'NOT_SELECTED' ? remarks : undefined }
  );
};

export const assignMentorToIdea = async (ideaId: string, ideaTitle: string, mentorName: MentorName | null, adminProfile: UserProfile): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const oldIdeaSnap = await getDoc(ideaRef);
  const oldMentor = oldIdeaSnap.exists() ? oldIdeaSnap.data().mentor : null;

  const updates: { mentor?: MentorName | null | typeof deleteField, updatedAt: Timestamp, updatedByMentorAssignerUid?: string } = {
    updatedAt: serverTimestamp() as Timestamp,
  };
  if (adminProfile && adminProfile.uid) {
    updates.updatedByMentorAssignerUid = adminProfile.uid;
  }

  if (mentorName === null) {
    updates.mentor = deleteField();
  } else {
    updates.mentor = mentorName;
  }
  await updateDoc(ideaRef, updates as any);

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_IDEA_MENTOR_ASSIGNED',
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { oldMentor, newMentor: mentorName }
  );
};


export const submitOrUpdatePhase2Mark = async (
  ideaId: string,
  ideaTitle: string,
  adminProfile: UserProfile,
  mark: number | null
): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaDoc = await getDoc(ideaRef);

  if (!ideaDoc.exists()) {
    throw new Error("Idea submission not found.");
  }
  const ideaData = ideaDoc.data() as IdeaSubmission;
  if (ideaData.programPhase !== 'PHASE_2') {
    throw new Error("Marking is only allowed for ideas in Phase 2.");
  }
  const oldMarkEntry = ideaData.phase2Marks?.[adminProfile.uid];
  const oldMarkValue = oldMarkEntry ? oldMarkEntry.mark : null;

  const markData: AdminMark = {
    mark: mark,
    adminDisplayName: adminProfile.displayName || adminProfile.fullName || 'Admin',
    markedAt: serverTimestamp() as Timestamp,
  };

  const updatePath = `phase2Marks.${adminProfile.uid}`;
  await updateDoc(ideaRef, {
    [updatePath]: mark !== null ? markData : deleteField(),
    updatedAt: serverTimestamp(),
  });

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_IDEA_PHASE2_MARK_SUBMITTED',
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { adminMarked: adminProfile.uid, oldMark: oldMarkValue, newMark: mark }
  );
};


export const getUserIdeaSubmissionsWithStatus = async (userId: string): Promise<IdeaSubmission[]> => {
  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, where('userId', '==', userId), orderBy('updatedAt', 'desc')); 
  const querySnapshot = await getDocs(q);
  const userIdeas: IdeaSubmission[] = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const submittedAt = (data.submittedAt as any) instanceof Timestamp ? (data.submittedAt as Timestamp) : Timestamp.now();
    const updatedAt = (data.updatedAt as any) instanceof Timestamp ? (data.updatedAt as Timestamp) : Timestamp.now();
    const nextPhaseDate = (data.nextPhaseDate as any) instanceof Timestamp ? (data.nextPhaseDate as Timestamp) : null;

    userIdeas.push({
        id: docSnap.id,
        ...data,
        programPhase: data.programPhase || null,
        cohortId: data.cohortId || null,
        phase2Marks: data.phase2Marks || {},
        teamMembers: data.teamMembers || '',
        structuredTeamMembers: data.structuredTeamMembers || [],
        teamMemberEmails: data.teamMemberEmails || [],
        submittedAt,
        updatedAt,
        rejectionRemarks: data.rejectionRemarks || null,
        rejectedByUid: data.rejectedByUid || null,
        rejectedAt: data.rejectedAt || null,
        phase2PptUrl: data.phase2PptUrl || null,
        phase2PptFileName: data.phase2PptFileName || null,
        phase2PptUploadedAt: data.phase2PptUploadedAt || null,
        nextPhaseDate: nextPhaseDate,
        nextPhaseStartTime: data.nextPhaseStartTime || null,
        nextPhaseEndTime: data.nextPhaseEndTime || null,
        nextPhaseVenue: data.nextPhaseVenue || null,
        nextPhaseGuidelines: data.nextPhaseGuidelines || null,
        mentor: data.mentor,
        // Include new funding fields
        totalFundingAllocated: data.totalFundingAllocated ?? null,
        sanction1Amount: data.sanction1Amount ?? null,
        sanction2Amount: data.sanction2Amount ?? null,
        sanction1DisbursedAt: data.sanction1DisbursedAt ?? null,
        sanction2DisbursedAt: data.sanction2DisbursedAt ?? null,
        sanction1Expenses: data.sanction1Expenses || [],
        sanction2Expenses: data.sanction2Expenses || [],
        beneficiaryName: data.beneficiaryName ?? null,
        beneficiaryAccountNo: data.beneficiaryAccountNo ?? null,
        beneficiaryBankName: data.beneficiaryBankName ?? null,
        beneficiaryIfscCode: data.beneficiaryIfscCode ?? null,
        sanction1AppliedForNext: data.sanction1AppliedForNext ?? false,
        sanction1UtilizationStatus: data.sanction1UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction1UtilizationRemarks: data.sanction1UtilizationRemarks ?? null,
        sanction1UtilizationReviewedBy: data.sanction1UtilizationReviewedBy ?? null,
        sanction1UtilizationReviewedAt: data.sanction1UtilizationReviewedAt ?? null,
        sanction2UtilizationStatus: data.sanction2UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction2UtilizationRemarks: data.sanction2UtilizationRemarks ?? null,
        sanction2UtilizationReviewedBy: data.sanction2UtilizationReviewedBy ?? null,
        sanction2UtilizationReviewedAt: data.sanction2UtilizationReviewedAt ?? null,
    } as IdeaSubmission);
  });
  return userIdeas;
};


export const getTotalIdeasCount = async (): Promise<number> => {
  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, where('status', '!=', 'ARCHIVED_BY_ADMIN')); 
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

export const getPendingIdeasCount = async (): Promise<number> => {
  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, where('status', '==', 'SUBMITTED'));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

export const getUserIdeaSubmissionsCount = async (userId: string): Promise<number> => {
  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, where('userId', '==', userId), where('status', '!=', 'ARCHIVED_BY_ADMIN'));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

export const archiveIdeaSubmissionForUserRevisionFS = async (ideaId: string, adminProfile: UserProfile): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaSnap = await getDoc(ideaRef);
  if (!ideaSnap.exists()) {
    throw new Error("Idea not found.");
  }
  const ideaData = ideaSnap.data();
  const ideaTitle = ideaData.title;
  const oldCohortId = ideaData.cohortId;

  const updates = {
    status: 'ARCHIVED_BY_ADMIN' as IdeaStatus,
    programPhase: null,
    phase2Marks: {},
    mentor: deleteField(),
    cohortId: deleteField(), 
    rejectionRemarks: deleteField(),
    rejectedByUid: deleteField(),
    rejectedAt: deleteField(),
    nextPhaseDate: null,
    nextPhaseStartTime: null,
    nextPhaseEndTime: null,
    nextPhaseVenue: null,
    nextPhaseGuidelines: null,
    // Reset funding fields as well when archiving
    totalFundingAllocated: deleteField(),
    sanction1Amount: deleteField(),
    sanction2Amount: deleteField(),
    sanction1DisbursedAt: deleteField(),
    sanction2DisbursedAt: deleteField(),
    sanction1Expenses: [],
    sanction2Expenses: [],
    beneficiaryName: deleteField(),
    beneficiaryAccountNo: deleteField(),
    beneficiaryBankName: deleteField(),
    beneficiaryIfscCode: deleteField(),
    sanction1AppliedForNext: false,
    sanction1UtilizationStatus: 'NOT_APPLICABLE',
    sanction1UtilizationRemarks: deleteField(),
    sanction1UtilizationReviewedBy: deleteField(),
    sanction1UtilizationReviewedAt: deleteField(),
    sanction2UtilizationStatus: 'NOT_APPLICABLE',
    sanction2UtilizationRemarks: deleteField(),
    sanction2UtilizationReviewedBy: deleteField(),
    sanction2UtilizationReviewedAt: deleteField(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.update(ideaRef, updates);

  if (oldCohortId) {
    const cohortRef = doc(db, 'cohorts', oldCohortId);
    batch.update(cohortRef, {
      ideaIds: arrayRemove(ideaId),
      updatedAt: serverTimestamp()
    });
  }
  await batch.commit();

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_IDEA_ARCHIVED_FOR_REVISION',
    { type: 'IDEA', id: ideaId, displayName: ideaTitle }
  );
};

export const getIdeasCountByStatus = async (status: IdeaStatus): Promise<number> => {
  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, where('status', '==', status));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

export const getIdeasCountByApplicantCategory = async (): Promise<Record<ApplicantCategory, number>> => {
  const categories: ApplicantCategory[] = ['PARUL_STUDENT', 'PARUL_STAFF', 'PARUL_ALUMNI', 'OTHERS'];
  const counts: Record<ApplicantCategory, number> = {
    PARUL_STUDENT: 0,
    PARUL_STAFF: 0,
    PARUL_ALUMNI: 0,
    OTHERS: 0,
  };
  const ideasCol = collection(db, 'ideas');

  for (const category of categories) {
    const q = query(ideasCol, where('applicantType', '==', category), where('status', '!=', 'ARCHIVED_BY_ADMIN'));
    const snapshot = await getCountFromServer(q);
    counts[category] = snapshot.data().count;
  }
  return counts;
};

export const addTeamMemberToIdea = async (ideaId: string, ideaTitle: string, newMemberData: Omit<TeamMember, 'id'>, actorProfile: UserProfile): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaDoc = await getDoc(ideaRef);
  if (!ideaDoc.exists()) {
    throw new Error("Idea not found.");
  }
  const currentMembers = (ideaDoc.data()?.structuredTeamMembers as TeamMember[] || []);
  if (currentMembers.length >= 4) {
    throw new Error("Maximum of 4 team members already reached for this idea.");
  }

  const newMemberWithId: TeamMember = {
    ...newMemberData,
    id: nanoid(),
  };

  await updateDoc(ideaRef, {
    structuredTeamMembers: arrayUnion(newMemberWithId),
    teamMemberEmails: arrayUnion(newMemberData.email.toLowerCase()),
    updatedAt: serverTimestamp(),
  });

  await logUserActivity(
    actorProfile.uid,
    actorProfile.displayName || actorProfile.fullName,
    'IDEA_TEAM_MEMBER_ADDED',
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { memberName: newMemberData.name, memberEmail: newMemberData.email }
  );
};

export const updateTeamMemberInIdea = async (ideaId: string, ideaTitle: string, updatedMemberData: TeamMember, actorProfile: UserProfile): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaDoc = await getDoc(ideaRef);

  if (!ideaDoc.exists()) {
    throw new Error("Idea not found.");
  }

  const currentMembers = (ideaDoc.data()?.structuredTeamMembers as TeamMember[] || []);
  const memberIndex = currentMembers.findIndex(member => member.id === updatedMemberData.id || (member.email.toLowerCase() === updatedMemberData.email.toLowerCase() && !updatedMemberData.id));


  if (memberIndex === -1) {
       if (currentMembers.length < 4) {
        const memberToAdd = updatedMemberData.id ? updatedMemberData : {...updatedMemberData, id: nanoid()};
        await addTeamMemberToIdea(ideaId, ideaTitle, memberToAdd, actorProfile);
        return;
      } else {
         throw new Error(`Team member not found for update, and team is full for idea ${ideaId}.`);
      }
  }


  const oldEmail = currentMembers[memberIndex].email.toLowerCase();
  const newEmail = updatedMemberData.email.toLowerCase();

  const updatedMembersArray = [...currentMembers];
  updatedMembersArray[memberIndex] = updatedMemberData;

  const updates: any = {
    structuredTeamMembers: updatedMembersArray,
    updatedAt: serverTimestamp(),
  };


  if (oldEmail !== newEmail) {
    const newTeamMemberEmails = updatedMembersArray.map(m => m.email.toLowerCase());
    updates.teamMemberEmails = newTeamMemberEmails;
  }

  await updateDoc(ideaRef, updates);
  await logUserActivity(
    actorProfile.uid,
    actorProfile.displayName || actorProfile.fullName,
    'IDEA_TEAM_MEMBER_UPDATED',
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { memberName: updatedMemberData.name, memberEmail: updatedMemberData.email, memberId: updatedMemberData.id }
  );
};

export const updateTeamMemberDetailsInIdeaAfterProfileSetup = async (
  ideaId: string,
  ideaTitle: string,
  memberUser: User,
  memberProfileDataFromForm: {
    fullName: string;
    contactNumber: string;
    enrollmentNumber?: string | null;
    college?: string | null;
    instituteName?: string | null;
  }
): Promise<void> => {
  if (!memberUser.email) {
    console.error("Team member email is missing, cannot update idea.");
    return;
  }
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaDocSnap = await getDoc(ideaRef);

  if (!ideaDocSnap.exists()) {
    console.error(`Idea with ID ${ideaId} not found for updating team member details.`);
    return;
  }

  const ideaData = ideaDocSnap.data() as IdeaSubmission;
  const currentMembers = ideaData.structuredTeamMembers || [];
  let memberFoundAndUpdated = false;

  const updatedStructuredMembersArray = currentMembers.map(member => {
    if (member.email.toLowerCase() === memberUser.email!.toLowerCase()) {
      memberFoundAndUpdated = true;
      return {
        id: memberUser.uid, 
        name: memberProfileDataFromForm.fullName,
        email: memberUser.email!,
        phone: memberProfileDataFromForm.contactNumber,
        institute: memberProfileDataFromForm.instituteName || member.institute || '', 
        department: member.department || '', 
        enrollmentNumber: memberProfileDataFromForm.enrollmentNumber || member.enrollmentNumber || '', 
      };
    }
    return member;
  });

  if (!memberFoundAndUpdated) {
    return;
  }

  const updatePayload: { structuredTeamMembers: TeamMember[], updatedAt: Timestamp } = {
    structuredTeamMembers: updatedStructuredMembersArray,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await updateDoc(ideaRef, updatePayload);

  await logUserActivity(
    memberUser.uid,
    memberProfileDataFromForm.fullName,
    'IDEA_TEAM_MEMBER_UPDATED', 
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { memberEmail: memberUser.email, detailsUpdated: ['id (to UID)', 'name', 'phone', 'institute', 'enrollmentNumber'] }
  );
};


export const removeTeamMemberFromIdea = async (ideaId: string, ideaTitle: string, memberToRemove: TeamMember, actorProfile: UserProfile): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaDoc = await getDoc(ideaRef);
  if (ideaDoc.exists()) {
    // const currentMembers = (ideaDoc.data()?.structuredTeamMembers as TeamMember[] || []);
    // const memberToRemove = currentMembers.find(m => m.id === memberIdToRemove);
    if (memberToRemove) {
      await updateDoc(ideaRef, {
        structuredTeamMembers: arrayRemove(memberToRemove),
        teamMemberEmails: arrayRemove(memberToRemove.email.toLowerCase()),
        updatedAt: serverTimestamp(),
      });
      await logUserActivity(
        actorProfile.uid,
        actorProfile.displayName || actorProfile.fullName,
        'IDEA_TEAM_MEMBER_REMOVED',
        { type: 'IDEA', id: ideaId, displayName: ideaTitle },
        { memberName: memberToRemove.name, memberEmail: memberToRemove.email, memberId: memberToRemove.id }
      );
    } else {
    }
  } else {
    throw new Error("Idea not found.");
  }
};

export const getIdeaWhereUserIsTeamMember = async (userEmail: string): Promise<IdeaSubmission | null> => {
  if (!userEmail) return null;
  const ideasCol = collection(db, 'ideas');

  const q = query(ideasCol, where('teamMemberEmails', 'array-contains', userEmail.toLowerCase()));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {

    const ideaDoc = querySnapshot.docs[0];
    const data = ideaDoc.data();
     const submittedAt = (data.submittedAt as any) instanceof Timestamp ? (data.submittedAt as Timestamp) : Timestamp.now();
    const updatedAt = (data.updatedAt as any) instanceof Timestamp ? (data.updatedAt as Timestamp) : Timestamp.now();
    const nextPhaseDate = (data.nextPhaseDate as any) instanceof Timestamp ? (data.nextPhaseDate as Timestamp) : null;

    return {
        id: ideaDoc.id,
        ...data,
        programPhase: data.programPhase || null,
        cohortId: data.cohortId || null,
        phase2Marks: data.phase2Marks || {},
        teamMembers: data.teamMembers || '',
        structuredTeamMembers: data.structuredTeamMembers || [],
        teamMemberEmails: data.teamMemberEmails || [],
        submittedAt,
        updatedAt,
        rejectionRemarks: data.rejectionRemarks || null,
        rejectedByUid: data.rejectedByUid || null,
        rejectedAt: data.rejectedAt || null,
        phase2PptUrl: data.phase2PptUrl || null,
        phase2PptFileName: data.phase2PptFileName || null,
        phase2PptUploadedAt: data.phase2PptUploadedAt || null,
        nextPhaseDate: nextPhaseDate,
        nextPhaseStartTime: data.nextPhaseStartTime || null,
        nextPhaseEndTime: data.nextPhaseEndTime || null,
        nextPhaseVenue: data.nextPhaseVenue || null,
        nextPhaseGuidelines: data.nextPhaseGuidelines || null,
        mentor: data.mentor,
        // Include new funding fields
        totalFundingAllocated: data.totalFundingAllocated ?? null,
        sanction1Amount: data.sanction1Amount ?? null,
        sanction2Amount: data.sanction2Amount ?? null,
        sanction1DisbursedAt: data.sanction1DisbursedAt ?? null,
        sanction2DisbursedAt: data.sanction2DisbursedAt ?? null,
        sanction1Expenses: data.sanction1Expenses || [],
        sanction2Expenses: data.sanction2Expenses || [],
        beneficiaryName: data.beneficiaryName ?? null,
        beneficiaryAccountNo: data.beneficiaryAccountNo ?? null,
        beneficiaryBankName: data.beneficiaryBankName ?? null,
        beneficiaryIfscCode: data.beneficiaryIfscCode ?? null,
        sanction1AppliedForNext: data.sanction1AppliedForNext ?? false,
        sanction1UtilizationStatus: data.sanction1UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction1UtilizationRemarks: data.sanction1UtilizationRemarks ?? null,
        sanction1UtilizationReviewedBy: data.sanction1UtilizationReviewedBy ?? null,
        sanction1UtilizationReviewedAt: data.sanction1UtilizationReviewedAt ?? null,
        sanction2UtilizationStatus: data.sanction2UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction2UtilizationRemarks: data.sanction2UtilizationRemarks ?? null,
        sanction2UtilizationReviewedBy: data.sanction2UtilizationReviewedBy ?? null,
        sanction2UtilizationReviewedAt: data.sanction2UtilizationReviewedAt ?? null,
    } as IdeaSubmission;
  }
  return null;
};


// Cohort functions
export const createCohortFS = async (cohortData: Omit<Cohort, 'id' | 'createdAt' | 'createdByUid' | 'creatorDisplayName' | 'ideaIds' | 'updatedAt' | 'schedule'>, adminProfile: UserProfile): Promise<Cohort> => {
  const cohortCol = collection(db, 'cohorts');
  const newCohortPayload: Omit<Cohort, 'id'> = {
    ...cohortData,
    ideaIds: [], 
    schedule: [], 
    createdByUid: adminProfile.uid,
    creatorDisplayName: adminProfile.displayName || adminProfile.fullName,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };
  const docRef = await addDoc(cohortCol, newCohortPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create cohort.");

  const createdCohort = { id: newDocSnap.id, ...newDocSnap.data() } as Cohort;

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_COHORT_CREATED',
    { type: 'COHORT', id: createdCohort.id!, displayName: createdCohort.name },
    { name: createdCohort.name, batchSize: createdCohort.batchSize }
  );
  return createdCohort;
};

export const updateCohortFS = async (cohortId: string, dataToUpdate: Omit<Cohort, 'id' | 'createdAt' | 'createdByUid' | 'creatorDisplayName' | 'ideaIds' | 'updatedAt' | 'schedule'>, adminProfile: UserProfile): Promise<void> => {
  const cohortRef = doc(db, 'cohorts', cohortId);
  const oldCohortSnap = await getDoc(cohortRef);
  if (!oldCohortSnap.exists()) {
    throw new Error("Cohort not found for update.");
  }
  const oldCohortData = oldCohortSnap.data();

  const updatePayload = {
    ...dataToUpdate,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await updateDoc(cohortRef, updatePayload);

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_COHORT_UPDATED',
    { type: 'COHORT', id: cohortId, displayName: dataToUpdate.name },
    {
      oldName: oldCohortData.name, newName: dataToUpdate.name,
      oldStartDate: oldCohortData.startDate, newStartDate: dataToUpdate.startDate,
      oldEndDate: oldCohortData.endDate, newEndDate: dataToUpdate.endDate,
      oldBatchSize: oldCohortData.batchSize, newBatchSize: dataToUpdate.batchSize,
    }
  );
};

export const deleteCohortFS = async (cohortId: string, adminProfile: UserProfile): Promise<void> => {
  const cohortRef = doc(db, 'cohorts', cohortId);
  const cohortSnap = await getDoc(cohortRef);
  if (!cohortSnap.exists()) {
    throw new Error("Cohort not found.");
  }
  const cohortData = cohortSnap.data() as Cohort;
  if (cohortData.ideaIds && cohortData.ideaIds.length > 0) {
    throw new Error(`Cohort "${cohortData.name}" cannot be deleted because it has ${cohortData.ideaIds.length} idea(s) assigned. Please unassign all ideas first.`);
  }

  await deleteDoc(cohortRef);

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_COHORT_DELETED',
    { type: 'COHORT', id: cohortId, displayName: cohortData.name },
    { name: cohortData.name }
  );
};


export const updateCohortScheduleFS = async (cohortId: string, newSchedule: CohortScheduleEntry[], adminProfile: UserProfile): Promise<void> => {
  const cohortRef = doc(db, 'cohorts', cohortId);
  const cohortSnap = await getDoc(cohortRef);
  if (!cohortSnap.exists()) {
    throw new Error("Cohort not found.");
  }
  const cohortName = cohortSnap.data().name;

  await updateDoc(cohortRef, {
    schedule: newSchedule,
    updatedAt: serverTimestamp(),
  });

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_COHORT_SCHEDULE_UPDATED',
    { type: 'COHORT', id: cohortId, displayName: cohortName },
    { scheduleEntryCount: newSchedule.length }
  );
};


export const getAllCohortsStream = (callback: (cohorts: Cohort[]) => void) => {
  const cohortsCol = collection(db, 'cohorts');
  const q = query(cohortsCol, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (querySnapshot) => {
    const cohorts: Cohort[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      cohorts.push({ id: docSnap.id, schedule: data.schedule || [], ...data } as Cohort); 
    });
    callback(cohorts);
  }, (error) => {
    console.error("Error fetching cohorts:", error);
    callback([]);
  });
};

// System Settings Functions
const SYSTEM_SETTINGS_DOC_ID = 'config';

export const getSystemSettings = async (): Promise<SystemSettings | null> => {
  const settingsRef = doc(db, 'systemSettings', SYSTEM_SETTINGS_DOC_ID);
  const docSnap = await getDoc(settingsRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as SystemSettings;
  }
  return null;
};

export const updateSystemSettings = async (settingsData: Partial<Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedByUid'>>, adminProfile: UserProfile): Promise<void> => {
  const settingsRef = doc(db, 'systemSettings', SYSTEM_SETTINGS_DOC_ID);
  try {
    await setDoc(settingsRef, {
      ...settingsData,
      updatedAt: serverTimestamp(),
      updatedByUid: adminProfile.uid,
    }, { merge: true });

    await logUserActivity(
      adminProfile.uid,
      adminProfile.displayName || adminProfile.fullName,
      'ADMIN_SYSTEM_SETTINGS_UPDATED',
      { type: 'SYSTEM_SETTINGS', id: SYSTEM_SETTINGS_DOC_ID, displayName: 'Portal Configuration' },
      { settingsChanged: Object.keys(settingsData) }
    );
  } catch (error) {
    console.error("Error updating system settings:", error);
    throw error;
  }
};

export const createIdeaSubmission = async (
  actorProfile: UserProfile,
  ideaData: Omit<IdeaSubmission, 'id' | 'userId' | 'submittedAt' | 'updatedAt' | 'status' | 'programPhase' | 'phase2Marks' | 'rejectionRemarks' | 'rejectedByUid' | 'rejectedAt' | 'phase2PptUrl' | 'phase2PptFileName' | 'phase2PptUploadedAt' | 'nextPhaseDate' | 'nextPhaseStartTime' | 'nextPhaseEndTime' | 'nextPhaseVenue' | 'nextPhaseGuidelines' | 'teamMembers' | 'structuredTeamMembers' | 'teamMemberEmails'| 'mentor' | 'applicantDisplayName' | 'applicantEmail' | 'category' | 'cohortId' | 'totalFundingAllocated' | 'sanction1Amount' | 'sanction2Amount' | 'sanction1DisbursedAt' | 'sanction2DisbursedAt' | 'sanction1Expenses' | 'sanction2Expenses' | 'beneficiaryName' | 'beneficiaryAccountNo' | 'beneficiaryBankName' | 'beneficiaryIfscCode' | 'sanction1AppliedForNext' | 'sanction1UtilizationStatus' | 'sanction1UtilizationRemarks' | 'sanction1UtilizationReviewedBy' | 'sanction1UtilizationReviewedAt' | 'sanction2UtilizationStatus' | 'sanction2UtilizationRemarks' | 'sanction2UtilizationReviewedBy' | 'sanction2UtilizationReviewedAt'> & { teamMembers?: string, structuredTeamMembers?: TeamMember[], teamMemberEmails?: string[] }
): Promise<IdeaSubmission> => {
  const ideaCol = collection(db, 'ideas');
  const newIdeaPayload: any = {
    userId: actorProfile.uid,
    applicantDisplayName: actorProfile.displayName || actorProfile.fullName || 'N/A',
    applicantEmail: actorProfile.email || 'N/A',
    title: ideaData.title,
    problem: ideaData.problem,
    solution: ideaData.solution,
    uniqueness: ideaData.uniqueness,
    developmentStage: ideaData.developmentStage,
    applicantType: ideaData.applicantType,
    teamMembers: ideaData.teamMembers || '',
    structuredTeamMembers: ideaData.structuredTeamMembers || [],
    teamMemberEmails: ideaData.teamMemberEmails || [],
    status: 'SUBMITTED',
    programPhase: null,
    cohortId: null,
    phase2Marks: {},
     // Initialize funding fields
    totalFundingAllocated: null,
    sanction1Amount: null,
    sanction2Amount: null,
    sanction1DisbursedAt: null,
    sanction2DisbursedAt: null,
    sanction1Expenses: [],
    sanction2Expenses: [],
    beneficiaryName: null,
    beneficiaryAccountNo: null,
    beneficiaryBankName: null,
    beneficiaryIfscCode: null,
    sanction1AppliedForNext: false,
    sanction1UtilizationStatus: 'NOT_APPLICABLE',
    sanction1UtilizationRemarks: null,
    sanction1UtilizationReviewedBy: null,
    sanction1UtilizationReviewedAt: null,
    sanction2UtilizationStatus: 'NOT_APPLICABLE',
    sanction2UtilizationRemarks: null,
    sanction2UtilizationReviewedBy: null,
    sanction2UtilizationReviewedAt: null,
    submittedAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  if (ideaData.fileURL) newIdeaPayload.fileURL = ideaData.fileURL;
  if (ideaData.fileName) newIdeaPayload.fileName = ideaData.fileName;
  if (ideaData.studioLocation) newIdeaPayload.studioLocation = ideaData.studioLocation;


  const docRef = await addDoc(ideaCol, newIdeaPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create idea submission.");

  const createdIdea = {
    id: newDocSnap.id,
    ...newDocSnap.data(),
    structuredTeamMembers: newDocSnap.data()?.structuredTeamMembers || [],
    teamMemberEmails: newDocSnap.data()?.teamMemberEmails || [],
  } as IdeaSubmission;

  await logUserActivity(
    actorProfile.uid,
    actorProfile.displayName || actorProfile.fullName,
    'IDEA_SUBMITTED',
    { type: 'IDEA', id: createdIdea.id!, displayName: createdIdea.title },
    { title: createdIdea.title, applicantType: createdIdea.applicantType }
  );
  return createdIdea;
};

export const updateIdeaPhase2PptDetails = async (ideaId: string, ideaTitle: string, fileUrl: string, fileName: string, actorProfile: UserProfile): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  await updateDoc(ideaRef, {
    phase2PptUrl: fileUrl,
    phase2PptFileName: fileName,
    phase2PptUploadedAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp(),
  });
  await logUserActivity(
    actorProfile.uid,
    actorProfile.displayName || actorProfile.fullName,
    'IDEA_PPT_UPLOADED',
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { fileName }
  );
};

export const getIdeaById = async (ideaId: string): Promise<IdeaSubmission | null> => {
  if (!ideaId) return null;
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaDoc = await getDoc(ideaRef);

  if (ideaDoc.exists()) {
    const data = ideaDoc.data();
    const submittedAt = (data.submittedAt as any) instanceof Timestamp ? (data.submittedAt as Timestamp) : Timestamp.now();
    const updatedAt = (data.updatedAt as any) instanceof Timestamp ? (data.updatedAt as Timestamp) : Timestamp.now();
    const nextPhaseDate = (data.nextPhaseDate as any) instanceof Timestamp ? (data.nextPhaseDate as Timestamp) : null;

    return {
        id: ideaDoc.id,
        ...data,
        programPhase: data.programPhase || null,
        cohortId: data.cohortId || null,
        phase2Marks: data.phase2Marks || {},
        teamMembers: data.teamMembers || '',
        structuredTeamMembers: data.structuredTeamMembers || [],
        teamMemberEmails: data.teamMemberEmails || [],
        submittedAt,
        updatedAt,
        rejectionRemarks: data.rejectionRemarks || null,
        rejectedByUid: data.rejectedByUid || null,
        rejectedAt: data.rejectedAt || null,
        phase2PptUrl: data.phase2PptUrl || null,
        phase2PptFileName: data.phase2PptFileName || null,
        phase2PptUploadedAt: data.phase2PptUploadedAt || null,
        nextPhaseDate: nextPhaseDate,
        nextPhaseStartTime: data.nextPhaseStartTime || null,
        nextPhaseEndTime: data.nextPhaseEndTime || null,
        nextPhaseVenue: data.nextPhaseVenue || null,
        nextPhaseGuidelines: data.nextPhaseGuidelines || null,
        mentor: data.mentor,
        // Include new funding fields
        totalFundingAllocated: data.totalFundingAllocated ?? null,
        sanction1Amount: data.sanction1Amount ?? null,
        sanction2Amount: data.sanction2Amount ?? null,
        sanction1DisbursedAt: data.sanction1DisbursedAt ?? null,
        sanction2DisbursedAt: data.sanction2DisbursedAt ?? null,
        sanction1Expenses: data.sanction1Expenses || [],
        sanction2Expenses: data.sanction2Expenses || [],
        beneficiaryName: data.beneficiaryName ?? null,
        beneficiaryAccountNo: data.beneficiaryAccountNo ?? null,
        beneficiaryBankName: data.beneficiaryBankName ?? null,
        beneficiaryIfscCode: data.beneficiaryIfscCode ?? null,
        sanction1AppliedForNext: data.sanction1AppliedForNext ?? false,
        sanction1UtilizationStatus: data.sanction1UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction1UtilizationRemarks: data.sanction1UtilizationRemarks ?? null,
        sanction1UtilizationReviewedBy: data.sanction1UtilizationReviewedBy ?? null,
        sanction1UtilizationReviewedAt: data.sanction1UtilizationReviewedAt ?? null,
        sanction2UtilizationStatus: data.sanction2UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction2UtilizationRemarks: data.sanction2UtilizationRemarks ?? null,
        sanction2UtilizationReviewedBy: data.sanction2UtilizationReviewedBy ?? null,
        sanction2UtilizationReviewedAt: data.sanction2UtilizationReviewedAt ?? null,
    } as IdeaSubmission;
  }
  return null;
};

export const assignIdeaToCohortFS = async (ideaId: string, ideaTitle: string, newCohortId: string | null, adminProfile: UserProfile): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const batch = writeBatch(db);

  const oldIdeaSnap = await getDoc(ideaRef);
  if (!oldIdeaSnap.exists()) throw new Error("Idea not found to assign to cohort.");
  const oldCohortId = oldIdeaSnap.data().cohortId as string | undefined | null;

  batch.update(ideaRef, {
    cohortId: newCohortId, 
    updatedAt: serverTimestamp()
  });

  if (oldCohortId && oldCohortId !== newCohortId) {
    const oldCohortRef = doc(db, 'cohorts', oldCohortId);
    batch.update(oldCohortRef, {
      ideaIds: arrayRemove(ideaId),
      updatedAt: serverTimestamp()
    });
  }

  if (newCohortId && newCohortId !== oldCohortId) {
    const newCohortRef = doc(db, 'cohorts', newCohortId);
    batch.update(newCohortRef, {
      ideaIds: arrayUnion(ideaId),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_IDEA_ASSIGNED_TO_COHORT',
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { oldCohortId: oldCohortId || null, newCohortId }
  );
};

export const getActivityLogsStream = (
  filters: { actorName?: string; actionType?: ActivityLogAction },
  callback: (logs: ActivityLogEntry[]) => void,
  limitCount: number = 50
) => {
  const logsCol = collection(db, 'activityLogs');
  let q = query(logsCol, orderBy('timestamp', 'desc'), limit(limitCount));

  if (filters.actorName) {
  }
  if (filters.actionType) {
    q = query(q, where('action', '==', filters.actionType));
  }
  
  return onSnapshot(q, (querySnapshot) => {
    let logs: ActivityLogEntry[] = [];
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as ActivityLogEntry);
    });

    if (filters.actorName) {
      const searchTerm = filters.actorName.toLowerCase();
      logs = logs.filter(log => 
        log.actorDisplayName?.toLowerCase().includes(searchTerm) || 
        log.actorUid.toLowerCase().includes(searchTerm)
      );
    }

    callback(logs);
  }, (error) => {
    console.error("Error fetching activity logs:", error);
    callback([]);
  });
};

// Funding and Expense Management Functions
export const updateIdeaFundingDetailsFS = async (
    ideaId: string,
    ideaTitle: string,
    fundingData: { totalFundingAllocated: number; sanction1Amount: number; sanction2Amount: number; },
    adminProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    await updateDoc(ideaRef, {
        totalFundingAllocated: fundingData.totalFundingAllocated,
        sanction1Amount: fundingData.sanction1Amount,
        sanction2Amount: fundingData.sanction2Amount,
        updatedAt: serverTimestamp(),
    });
    await logUserActivity(adminProfile.uid, adminProfile.displayName || adminProfile.fullName, 'ADMIN_IDEA_FUNDING_DETAILS_SET', { type: 'IDEA', id: ideaId, displayName: ideaTitle }, fundingData);
};

export const updateIdeaBeneficiaryDetailsFS = async (
    ideaId: string,
    ideaTitle: string,
    beneficiaryData: { beneficiaryName: string; beneficiaryAccountNo: string; beneficiaryBankName: string; beneficiaryIfscCode: string; },
    userProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    await updateDoc(ideaRef, {
        ...beneficiaryData,
        updatedAt: serverTimestamp(),
    });
    await logUserActivity(userProfile.uid, userProfile.displayName || userProfile.fullName, 'IDEA_BENEFICIARY_DETAILS_UPDATED', { type: 'IDEA', id: ideaId, displayName: ideaTitle }, { beneficiaryName: beneficiaryData.beneficiaryName });
};

export const addExpenseToSanctionFS = async (
    ideaId: string,
    ideaTitle: string,
    sanctionNumber: 1 | 2,
    expenseData: Omit<ExpenseEntry, 'id' | 'uploadedAt'>,
    userProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    const newExpense: ExpenseEntry = {
        ...expenseData,
        id: nanoid(),
        uploadedAt: serverTimestamp() as Timestamp,
    };
    const expenseField = sanctionNumber === 1 ? 'sanction1Expenses' : 'sanction2Expenses';
    await updateDoc(ideaRef, {
        [expenseField]: arrayUnion(newExpense),
        updatedAt: serverTimestamp(),
    });
     await logUserActivity(userProfile.uid, userProfile.displayName || userProfile.fullName, 'IDEA_EXPENSE_UPLOADED', { type: 'IDEA', id: ideaId, displayName: ideaTitle }, { sanction: sanctionNumber, expenseDescription: expenseData.description, amount: expenseData.amount });
};

export const markSanctionAsDisbursedFS = async (
    ideaId: string,
    ideaTitle: string,
    sanctionNumber: 1 | 2,
    adminProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    const disbursementField = sanctionNumber === 1 ? 'sanction1DisbursedAt' : 'sanction2DisbursedAt';
    const utilizationStatusField = sanctionNumber === 1 ? 'sanction1UtilizationStatus' : 'sanction2UtilizationStatus';
    await updateDoc(ideaRef, {
        [disbursementField]: serverTimestamp(),
        [utilizationStatusField]: 'PENDING', // Set to pending review upon disbursement
        updatedAt: serverTimestamp(),
    });
    await logUserActivity(adminProfile.uid, adminProfile.displayName || adminProfile.fullName, 'ADMIN_IDEA_SANCTION_DISBURSED', { type: 'IDEA', id: ideaId, displayName: ideaTitle }, { sanction: sanctionNumber });
};

export const reviewSanctionUtilizationFS = async (
    ideaId: string,
    ideaTitle: string,
    sanctionNumber: 'SANCTION_1' | 'SANCTION_2',
    status: SanctionApprovalStatus,
    remarks: string | null,
    adminProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    const statusField = sanctionNumber === 'SANCTION_1' ? 'sanction1UtilizationStatus' : 'sanction2UtilizationStatus';
    const remarksField = sanctionNumber === 'SANCTION_1' ? 'sanction1UtilizationRemarks' : 'sanction2UtilizationRemarks';
    const reviewedByField = sanctionNumber === 'SANCTION_1' ? 'sanction1UtilizationReviewedBy' : 'sanction2UtilizationReviewedBy';
    const reviewedAtField = sanctionNumber === 'SANCTION_1' ? 'sanction1UtilizationReviewedAt' : 'sanction2UtilizationReviewedAt';

    await updateDoc(ideaRef, {
        [statusField]: status,
        [remarksField]: remarks,
        [reviewedByField]: adminProfile.uid,
        [reviewedAtField]: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    await logUserActivity(adminProfile.uid, adminProfile.displayName || adminProfile.fullName, 'ADMIN_IDEA_SANCTION_UTILIZATION_REVIEWED', { type: 'IDEA', id: ideaId, displayName: ideaTitle }, { sanction: sanctionNumber, status, remarks });
};

export const applyForNextSanctionFS = async (
    ideaId: string,
    ideaTitle: string,
    currentSanctionNumber: 1, // Currently only S1 applying for S2 is supported this way
    userProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    if (currentSanctionNumber === 1) {
        await updateDoc(ideaRef, {
            sanction1AppliedForNext: true,
            // When user applies for S2, set S1 utilization to PENDING for admin review if it wasn't already.
            sanction1UtilizationStatus: 'PENDING', 
            updatedAt: serverTimestamp(),
        });
        await logUserActivity(userProfile.uid, userProfile.displayName || userProfile.fullName, 'IDEA_APPLIED_FOR_NEXT_SANCTION', { type: 'IDEA', id: ideaId, displayName: ideaTitle }, { appliedForSanction: 2 });
    } else {
        throw new Error("Application for sanctions beyond Sanction 2 via this method is not supported.");
    }
};
    

    



    


