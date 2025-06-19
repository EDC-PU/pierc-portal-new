
import { db, functions as firebaseFunctions, auth } from './config'; // functions aliased to avoid conflict, auth added
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs, Timestamp, getCountFromServer, deleteField, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage, IdeaSubmission, Cohort, SystemSettings, IdeaStatus, ProgramPhase, AdminMark, TeamMember, MentorName, ActivityLogAction, ActivityLogTarget, ActivityLogEntry, CohortScheduleEntry } from '@/types';
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
    // console.log(`Activity logged: ${action} by ${actorDisplayName || actorUid}`, target);
  } catch (error) {
    console.error("Error logging user activity:", error, { actorUid, action, target, details });
  }
};


// User Profile Functions
export const createUserProfileFS = async (userId: string, data: Partial<UserProfile>): Promise<UserProfile> => {
  const userProfileRef = doc(db, 'users', userId);
  const currentAuthUser = auth.currentUser;
  // console.log("[firestore.ts:createUserProfileFS] Called for", userId, "with data:", JSON.stringify(data, null, 2));

  const profileDataForWrite: any = {
    uid: userId,
    email: data.email ?? currentAuthUser?.email ?? null,
    displayName: data.displayName || data.fullName || currentAuthUser?.displayName || 'New User',
    photoURL: data.photoURL ?? currentAuthUser?.photoURL ?? null,
    role: data.role ?? null, // Role is set by AuthContext based on form or superadmin email
    isSuperAdmin: (data.email ?? currentAuthUser?.email) === 'pranavrathi07@gmail.com' ? true : (data.isSuperAdmin ?? false),
    fullName: data.fullName || '',
    contactNumber: data.contactNumber || '',
    isTeamMemberOnly: data.isTeamMemberOnly === true, // Explicitly check for true
    enrollmentNumber: data.enrollmentNumber || null,
    college: data.college || null,
    instituteName: data.instituteName || null,
  };
  //  console.log("[firestore.ts:createUserProfileFS] Initial constructed profileDataForWrite:", JSON.stringify(profileDataForWrite, null, 2));


  // Fields for idea owners (if not team member only)
  if (!profileDataForWrite.isTeamMemberOnly) {
    // console.log("[firestore.ts:createUserProfileFS] Profile is for an idea owner. Setting idea-specific fields.");
    profileDataForWrite.startupTitle = data.startupTitle || null;
    profileDataForWrite.problemDefinition = data.problemDefinition || null;
    profileDataForWrite.solutionDescription = data.solutionDescription || null;
    profileDataForWrite.uniqueness = data.uniqueness || null;
    profileDataForWrite.applicantCategory = data.applicantCategory || null;
    profileDataForWrite.currentStage = data.currentStage || null;
    profileDataForWrite.teamMembers = data.teamMembers || ''; // Original free-text
    profileDataForWrite.associatedIdeaId = null;
    profileDataForWrite.associatedTeamLeaderUid = null;
  } else { // Fields for team members only
    // console.log("[firestore.ts:createUserProfileFS] Profile is for a team member only. Nullifying idea fields, setting association.");
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

  // console.log("[firestore.ts:createUserProfileFS] Final profileDataForWrite before DB operation:", JSON.stringify(profileDataForWrite, null, 2));


  const existingProfileSnap = await getDoc(userProfileRef);
  if (existingProfileSnap.exists()) {
    profileDataForWrite.updatedAt = serverTimestamp() as Timestamp;
    delete profileDataForWrite.createdAt; // Do not overwrite createdAt on update
    // console.log("[firestore.ts:createUserProfileFS] Updating existing profile for", userId);
    await updateDoc(userProfileRef, profileDataForWrite);
  } else {
    profileDataForWrite.createdAt = serverTimestamp() as Timestamp;
    profileDataForWrite.updatedAt = serverTimestamp() as Timestamp;
    // console.log("[firestore.ts:createUserProfileFS] Creating new profile for", userId);
    await setDoc(userProfileRef, profileDataForWrite);
  }

  const docSnap = await getDoc(userProfileRef);
  if (!docSnap.exists()) {
    console.error("[firestore.ts:createUserProfileFS] Failed to create/retrieve profile for", userId);
    throw new Error("Failed to create or retrieve user profile after write operation.");
  }
  const rawData = docSnap.data()!;
  // console.log("[firestore.ts:createUserProfileFS] Successfully created/updated profile for", userId, ". Raw data from DB:", JSON.stringify(rawData, null, 2));
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
        isTeamMemberOnly: data.isTeamMemberOnly === true, // Ensure boolean
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
  // Prevent disallowed fields from being updated by self
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
        isTeamMemberOnly: data.isTeamMemberOnly === true, // Ensure boolean
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
    { title: createdAnn.title, isUrgent: createdAnn.isUrgent, targetAudience: createdAnn.targetAudience }
  );
  return createdAnn;
};

export const getAnnouncementsStream = (callback: (announcements: Announcement[]) => void) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol,
    where('isUrgent', '==', false),
    where('targetAudience', '==', 'ALL'), // TODO: Expand to handle cohort-specific for users
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
    where('targetAudience', '==', 'ALL'), // TODO: Expand to handle cohort-specific for users
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
  await updateDoc(announcementRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
  const updatedAnnSnap = await getDoc(announcementRef);
  const updatedAnnTitle = updatedAnnSnap.exists() ? updatedAnnSnap.data().title : announcementId;
  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_ANNOUNCEMENT_UPDATED',
    { type: 'ANNOUNCEMENT', id: announcementId, displayName: updatedAnnTitle },
    { fieldsUpdated: Object.keys(data) }
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
  // console.log("[firestore.ts:createIdeaFromProfile] Attempting for user:", userId, "with profile data:", JSON.stringify(profileData, null, 2));
  const userProfile = await getUserProfile(userId);
  if (!userProfile) {
    console.error("[firestore.ts:createIdeaFromProfile] User profile not found for UID:", userId);
    throw new Error("User profile not found, cannot create idea submission.");
  }

  if ((userProfile.role === 'ADMIN_FACULTY' && profileData.startupTitle === 'Administrative Account') || userProfile.isTeamMemberOnly) {
    // console.log("[firestore.ts:createIdeaFromProfile] Skipping idea creation for admin or team-member-only profile.");
    return null;
  }

  if (!profileData.startupTitle || !profileData.problemDefinition || !profileData.solutionDescription || !profileData.uniqueness || !profileData.currentStage || !profileData.applicantCategory) {
    // console.warn("[firestore.ts:createIdeaFromProfile] Skipping: missing essential idea fields in profileData:", JSON.stringify(profileData, null, 2));
    throw new Error("Missing essential idea fields in profile data for idea submission. All idea-related fields must be provided.");
  }

  const finalPayload: Omit<IdeaSubmission, 'id'> = {
    userId: userId,
    applicantDisplayName: userProfile.displayName || userProfile.fullName || 'N/A',
    applicantEmail: userProfile.email || 'N/A',
    title: profileData.startupTitle!,
    category: profileData.applicantCategory, // Ensure this makes sense for 'category'
    problem: profileData.problemDefinition!,
    solution: profileData.solutionDescription!,
    uniqueness: profileData.uniqueness!,
    developmentStage: profileData.currentStage!,
    applicantType: profileData.applicantCategory,
    teamMembers: profileData.teamMembers || '', // Original free-text
    structuredTeamMembers: [], // Initialize as empty
    teamMemberEmails: [], // Initialize as empty
    status: 'SUBMITTED',
    programPhase: null,
    cohortId: null,
    // Ensure phase2Marks is initialized if needed by rules or logic, or omit if truly optional at create
    phase2Marks: {}, // Explicitly initialize as an empty map
    submittedAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    // Omitted: fileURL, fileName, studioLocation, mentor, cohortId, rejectionRemarks, rejectedByUid, rejectedAt, etc.
    // These will not be part of the initial document unless explicitly set, preventing 'undefined' errors.
  };

  // console.log("[firestore.ts:createIdeaFromProfile] Final payload for addDoc:", JSON.stringify(finalPayload, null, 2));

  try {
    const docRef = await addDoc(collection(db, 'ideas'), finalPayload);
    // console.log("[firestore.ts:createIdeaFromProfile] Idea document created with ID:", docRef.id);
    const newDocSnap = await getDoc(docRef);
    if (!newDocSnap.exists()) {
      console.error("[firestore.ts:createIdeaFromProfile] Created idea doc not found for ID:", docRef.id);
      throw new Error("Could not create idea submission from profile (doc not found after creation).");
    }
    const data = newDocSnap.data()!;
    return { id: newDocSnap.id, ...data } as IdeaSubmission;
  } catch (error) {
    console.error("[firestore.ts:createIdeaFromProfile] Firestore addDoc error:", error);
    // Log the error more explicitly for Firestore permission issues
    if ((error as any).code === 'permission-denied') {
        console.error("[firestore.ts:createIdeaFromProfile] Firestore Permission Denied. Check security rules for /ideas collection create operation. Payload was:", JSON.stringify(finalPayload, null, 2));
    }
    throw error; // Re-throw to be caught by AuthContext
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
      rejectionRemarks: ideaData.rejectionRemarks,
      rejectedByUid: ideaData.rejectedByUid,
      rejectedAt: ideaData.rejectedAt,
      phase2PptUrl: ideaData.phase2PptUrl,
      phase2PptFileName: ideaData.phase2PptFileName,
      phase2PptUploadedAt: ideaData.phase2PptUploadedAt,
      nextPhaseDate: nextPhaseDate,
      nextPhaseStartTime: ideaData.nextPhaseStartTime,
      nextPhaseEndTime: ideaData.nextPhaseEndTime,
      nextPhaseVenue: ideaData.nextPhaseVenue,
      nextPhaseGuidelines: ideaData.nextPhaseGuidelines,
      mentor: ideaData.mentor,
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
    } else if (newPhase !== 'COHORT') {
        updates.mentor = deleteField();
        // updates.cohortId = deleteField(); // If moving out of cohort phase, cohortId should also be cleared here.
    }
    if (newPhase && nextPhaseDetails) {
      updates.nextPhaseDate = nextPhaseDetails.date;
      updates.nextPhaseStartTime = nextPhaseDetails.startTime;
      updates.nextPhaseEndTime = nextPhaseDetails.endTime;
      updates.nextPhaseVenue = nextPhaseDetails.venue;
      updates.nextPhaseGuidelines = nextPhaseDetails.guidelines;
    } else if (!newPhase) { // If phase is set to null (e.g. selected but no phase assigned yet)
        updates.nextPhaseDate = null;
        updates.nextPhaseStartTime = null;
        updates.nextPhaseEndTime = null;
        updates.nextPhaseVenue = null;
        updates.nextPhaseGuidelines = null;
        updates.mentor = deleteField();
        updates.cohortId = deleteField(); // Clear cohortId if phase is not COHORT or no phase.
    }
  } else { // Status is not 'SELECTED'
    updates.programPhase = null;
    updates.nextPhaseDate = null;
    updates.nextPhaseStartTime = null;
    updates.nextPhaseEndTime = null;
    updates.nextPhaseVenue = null;
    updates.nextPhaseGuidelines = null;
    updates.mentor = deleteField();
    updates.cohortId = deleteField(); // Clear cohortId
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
    'ADMIN_IDEA_STATUS_PHASE_UPDATED',
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
  const q = query(ideasCol, where('userId', '==', userId), orderBy('submittedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  const userIdeas: IdeaSubmission[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const submittedAt = (data.submittedAt as any) instanceof Timestamp ? (data.submittedAt as Timestamp) : Timestamp.now();
    const updatedAt = (data.updatedAt as any) instanceof Timestamp ? (data.updatedAt as Timestamp) : Timestamp.now();
    const nextPhaseDate = (data.nextPhaseDate as any) instanceof Timestamp ? (data.nextPhaseDate as Timestamp) : null;

    userIdeas.push({
        id: doc.id,
        ...data,
        programPhase: data.programPhase || null,
        cohortId: data.cohortId || null,
        phase2Marks: data.phase2Marks || {},
        teamMembers: data.teamMembers || '',
        structuredTeamMembers: data.structuredTeamMembers || [],
        teamMemberEmails: data.teamMemberEmails || [],
        submittedAt,
        updatedAt,
        rejectionRemarks: data.rejectionRemarks,
        rejectedByUid: data.rejectedByUid,
        rejectedAt: data.rejectedAt,
        phase2PptUrl: data.phase2PptUrl,
        phase2PptFileName: data.phase2PptFileName,
        phase2PptUploadedAt: data.phase2PptUploadedAt,
        nextPhaseDate: nextPhaseDate,
        nextPhaseStartTime: data.nextPhaseStartTime,
        nextPhaseEndTime: data.nextPhaseEndTime,
        nextPhaseVenue: data.nextPhaseVenue,
        nextPhaseGuidelines: data.nextPhaseGuidelines,
        mentor: data.mentor,
    } as IdeaSubmission);
  });
  return userIdeas;
};


export const getTotalIdeasCount = async (): Promise<number> => {
  const ideasCol = collection(db, 'ideas');
  const snapshot = await getCountFromServer(ideasCol);
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
  const q = query(ideasCol, where('userId', '==', userId));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

export const deleteIdeaSubmission = async (ideaId: string, adminProfile: UserProfile): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaSnap = await getDoc(ideaRef);
  if (!ideaSnap.exists()) {
    throw new Error("Idea not found.");
  }
  const ideaTitle = ideaSnap.data().title;
  const ideaCohortId = ideaSnap.data().cohortId;

  const batch = writeBatch(db);
  batch.delete(ideaRef);

  if (ideaCohortId) {
    const cohortRef = doc(db, 'cohorts', ideaCohortId);
    batch.update(cohortRef, {
      ideaIds: arrayRemove(ideaId),
      updatedAt: serverTimestamp()
    });
  }
  await batch.commit();

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    'ADMIN_IDEA_DELETED',
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
    const q = query(ideasCol, where('applicantType', '==', category));
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
      // console.warn(`Team member with ID ${updatedMemberData.id} or email ${updatedMemberData.email} not found in idea ${ideaId} to update. Attempting to add if slots available.`);
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
        id: memberUser.uid, // Update member ID to user's UID now that they have a profile
        name: memberProfileDataFromForm.fullName,
        email: memberUser.email!,
        phone: memberProfileDataFromForm.contactNumber,
        institute: memberProfileDataFromForm.instituteName || member.institute || '', // Prefer form data, fallback to existing
        department: member.department || '', // Department is not typically on profile-setup, keep existing
        enrollmentNumber: memberProfileDataFromForm.enrollmentNumber || member.enrollmentNumber || '', // Prefer form data
      };
    }
    return member;
  });

  if (!memberFoundAndUpdated) {
    // console.warn(`Team member with email ${memberUser.email} not found in idea ${ideaId} to update after profile setup. No changes made to idea document.`);
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
    'IDEA_TEAM_MEMBER_UPDATED', // Or a more specific action like 'IDEA_TEAM_MEMBER_PROFILE_SYNCED'
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { memberEmail: memberUser.email, detailsUpdated: ['id (to UID)', 'name', 'phone', 'institute', 'enrollmentNumber'] }
  );
};


export const removeTeamMemberFromIdea = async (ideaId: string, ideaTitle: string, memberIdToRemove: string, actorProfile: UserProfile): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaDoc = await getDoc(ideaRef);
  if (ideaDoc.exists()) {
    const currentMembers = (ideaDoc.data()?.structuredTeamMembers as TeamMember[] || []);
    const memberToRemove = currentMembers.find(m => m.id === memberIdToRemove);
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
      // console.warn(`Team member with ID ${memberIdToRemove} not found in idea ${ideaId} for removal.`);
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
        rejectionRemarks: data.rejectionRemarks,
        rejectedByUid: data.rejectedByUid,
        rejectedAt: data.rejectedAt,
        phase2PptUrl: data.phase2PptUrl,
        phase2PptFileName: data.phase2PptFileName,
        phase2PptUploadedAt: data.phase2PptUploadedAt,
        nextPhaseDate: nextPhaseDate,
        nextPhaseStartTime: data.nextPhaseStartTime,
        nextPhaseEndTime: data.nextPhaseEndTime,
        nextPhaseVenue: data.nextPhaseVenue,
        nextPhaseGuidelines: data.nextPhaseGuidelines,
        mentor: data.mentor,
    } as IdeaSubmission;
  }
  return null;
};


// Cohort functions
export const createCohortFS = async (cohortData: Omit<Cohort, 'id' | 'createdAt' | 'createdByUid' | 'creatorDisplayName' | 'ideaIds' | 'updatedAt' | 'schedule'>, adminProfile: UserProfile): Promise<Cohort> => {
  const cohortCol = collection(db, 'cohorts');
  const newCohortPayload: Omit<Cohort, 'id'> = {
    ...cohortData,
    ideaIds: [], // Initialize with no ideas
    schedule: [], // Initialize with an empty schedule
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
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      cohorts.push({ id: doc.id, schedule: data.schedule || [], ...data } as Cohort); // Ensure schedule defaults to []
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
  ideaData: Omit<IdeaSubmission, 'id' | 'userId' | 'submittedAt' | 'updatedAt' | 'status' | 'programPhase' | 'phase2Marks' | 'rejectionRemarks' | 'rejectedByUid' | 'rejectedAt' | 'phase2PptUrl' | 'phase2PptFileName' | 'phase2PptUploadedAt' | 'nextPhaseDate' | 'nextPhaseStartTime' | 'nextPhaseEndTime' | 'nextPhaseVenue' | 'nextPhaseGuidelines' | 'teamMembers' | 'structuredTeamMembers' | 'teamMemberEmails'| 'mentor' | 'applicantDisplayName' | 'applicantEmail' | 'category' | 'cohortId'> & { teamMembers?: string, structuredTeamMembers?: TeamMember[], teamMemberEmails?: string[] }
): Promise<IdeaSubmission> => {
  const ideaCol = collection(db, 'ideas');
  const newIdeaPayload: any = {
    userId: actorProfile.uid,
    applicantDisplayName: actorProfile.displayName || actorProfile.fullName || 'N/A',
    applicantEmail: actorProfile.email || 'N/A',
    title: ideaData.title,
    // category: ideaData.category, // This seems to be covered by applicantType, removing to avoid confusion
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
    submittedAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    // Optional fields are not included if they don't have a value
  };

  if (ideaData.fileURL) newIdeaPayload.fileURL = ideaData.fileURL;
  if (ideaData.fileName) newIdeaPayload.fileName = ideaData.fileName;
  if (ideaData.studioLocation) newIdeaPayload.studioLocation = ideaData.studioLocation;
  // if (ideaData.cohortId) newIdeaPayload.cohortId = ideaData.cohortId; // This is handled by assignIdeaToCohort


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
        rejectionRemarks: data.rejectionRemarks,
        rejectedByUid: data.rejectedByUid,
        rejectedAt: data.rejectedAt,
        phase2PptUrl: data.phase2PptUrl,
        phase2PptFileName: data.phase2PptFileName,
        phase2PptUploadedAt: data.phase2PptUploadedAt,
        nextPhaseDate: nextPhaseDate,
        nextPhaseStartTime: data.nextPhaseStartTime,
        nextPhaseEndTime: data.nextPhaseEndTime,
        nextPhaseVenue: data.nextPhaseVenue,
        nextPhaseGuidelines: data.nextPhaseGuidelines,
        mentor: data.mentor,
    } as IdeaSubmission;
  }
  return null;
};

// Assign an idea to a cohort
export const assignIdeaToCohort = async (ideaId: string, ideaTitle: string, newCohortId: string | null, adminProfile: UserProfile): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const batch = writeBatch(db);

  const oldIdeaSnap = await getDoc(ideaRef);
  if (!oldIdeaSnap.exists()) throw new Error("Idea not found to assign to cohort.");
  const oldCohortId = oldIdeaSnap.data().cohortId as string | undefined | null;

  // Update the idea document with the new cohortId (or null if unassigning)
  batch.update(ideaRef, {
    cohortId: newCohortId,
    updatedAt: serverTimestamp()
  });

  // If previously assigned to a different cohort, remove it from that cohort's ideaIds list
  if (oldCohortId && oldCohortId !== newCohortId) {
    const oldCohortRef = doc(db, 'cohorts', oldCohortId);
    batch.update(oldCohortRef, {
      ideaIds: arrayRemove(ideaId),
      updatedAt: serverTimestamp()
    });
  }

  // If assigning to a new cohort, add it to the new cohort's ideaIds list
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

    
