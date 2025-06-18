
import { db, functions as firebaseFunctions } from './config'; // functions aliased to avoid conflict
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs, Timestamp, getCountFromServer, deleteField, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage, IdeaSubmission, Cohort, SystemSettings, IdeaStatus, ProgramPhase, AdminMark, TeamMember, MentorName, ActivityLogAction, ActivityLogTarget, ActivityLogEntry } from '@/types';
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
      actorDisplayName: actorDisplayName || 'System/Unknown', // Default if null
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

  const profileDataForWrite: Partial<UserProfile> = {
    uid: userId,
    email: data.email ?? null,
    displayName: data.displayName || data.fullName || 'User',
    photoURL: data.photoURL ?? null,
    role: data.role ?? null, // Role will be determined/validated by AuthContext/rules
    fullName: data.fullName,
    contactNumber: data.contactNumber,
    isSuperAdmin: data.email === 'pranavrathi07@gmail.com' ? true : (data.isSuperAdmin ?? false),
    createdAt: serverTimestamp() as Timestamp, // Firestore will set this
    updatedAt: serverTimestamp() as Timestamp, // Firestore will set this
    isTeamMemberOnly: data.isTeamMemberOnly === true, // Explicitly check for true
  };

  // Conditionally add fields based on whether the user is only a team member or an idea owner
  if (profileDataForWrite.isTeamMemberOnly) {
    profileDataForWrite.associatedIdeaId = data.associatedIdeaId;
    profileDataForWrite.associatedTeamLeaderUid = data.associatedTeamLeaderUid;
    if (data.enrollmentNumber) profileDataForWrite.enrollmentNumber = data.enrollmentNumber;
    if (data.college) profileDataForWrite.college = data.college;
    if (data.instituteName) profileDataForWrite.instituteName = data.instituteName;
    // Ensure idea-specific fields are explicitly null or not present for team members
    profileDataForWrite.applicantCategory = null as any; // Firestore handles null fine
    profileDataForWrite.currentStage = null as any;
    profileDataForWrite.startupTitle = '';
    profileDataForWrite.problemDefinition = '';
    profileDataForWrite.solutionDescription = '';
    profileDataForWrite.uniqueness = '';
    profileDataForWrite.teamMembers = '';

  } else { // Assumed to be an idea owner (or admin setting up their special profile)
    profileDataForWrite.applicantCategory = data.applicantCategory;
    profileDataForWrite.currentStage = data.currentStage;
    profileDataForWrite.startupTitle = data.startupTitle;
    profileDataForWrite.problemDefinition = data.problemDefinition;
    profileDataForWrite.solutionDescription = data.solutionDescription;
    profileDataForWrite.uniqueness = data.uniqueness;
    profileDataForWrite.teamMembers = data.teamMembers || ''; // Can be empty string
    if (data.enrollmentNumber) profileDataForWrite.enrollmentNumber = data.enrollmentNumber;
    if (data.college) profileDataForWrite.college = data.college;
    if (data.instituteName) profileDataForWrite.instituteName = data.instituteName;
  }

  // Remove any undefined properties before writing to Firestore
  const finalProfileData = Object.fromEntries(
    Object.entries(profileDataForWrite).filter(([, value]) => value !== undefined)
  );

  await setDoc(userProfileRef, finalProfileData);

  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    const rawData = docSnap.data();
    // Construct the UserProfile object carefully, providing defaults for potentially missing fields
    const fetchedProfile: UserProfile = {
        uid: docSnap.id,
        email: rawData.email ?? null,
        displayName: rawData.displayName ?? null,
        photoURL: rawData.photoURL ?? null,
        role: rawData.role ?? null,
        fullName: rawData.fullName ?? '',
        contactNumber: rawData.contactNumber ?? '',
        applicantCategory: rawData.applicantCategory as ApplicantCategory, // Assuming it's set or null
        currentStage: rawData.currentStage as CurrentStage, // Assuming it's set or null
        startupTitle: rawData.startupTitle ?? '',
        problemDefinition: rawData.problemDefinition ?? '',
        solutionDescription: rawData.solutionDescription ?? '',
        uniqueness: rawData.uniqueness ?? '',
        teamMembers: rawData.teamMembers ?? '',
        enrollmentNumber: rawData.enrollmentNumber,
        college: rawData.college,
        instituteName: rawData.instituteName,
        createdAt: rawData.createdAt as Timestamp, // Ensure it's cast correctly
        updatedAt: rawData.updatedAt as Timestamp, // Ensure it's cast correctly
        isSuperAdmin: rawData.email === 'pranavrathi07@gmail.com' ? true : (rawData.isSuperAdmin === true),
        isTeamMemberOnly: rawData.isTeamMemberOnly === true,
        associatedIdeaId: rawData.associatedIdeaId,
        associatedTeamLeaderUid: rawData.associatedTeamLeaderUid,
    };
    return fetchedProfile;
  }
  throw new Error("Failed to create or retrieve user profile after creation.");
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
        applicantCategory: data.applicantCategory,
        currentStage: data.currentStage,
        startupTitle: data.startupTitle ?? '',
        problemDefinition: data.problemDefinition ?? '',
        solutionDescription: data.solutionDescription ?? '',
        uniqueness: data.uniqueness ?? '',
        teamMembers: data.teamMembers ?? '',
        enrollmentNumber: data.enrollmentNumber,
        college: data.college,
        instituteName: data.instituteName,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isSuperAdmin: false,
        isTeamMemberOnly: data.isTeamMemberOnly ?? false,
        associatedIdeaId: data.associatedIdeaId,
        associatedTeamLeaderUid: data.associatedTeamLeaderUid,
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
  actorProfile?: UserProfile | null // Profile of the admin performing the action, or null if self-update
): Promise<void> => {
  const userProfileRef = doc(db, 'users', targetUserId);
  const { uid, email, createdAt, role, isSuperAdmin, ...updateData } = data;

  const cleanData = Object.fromEntries(Object.entries(updateData).filter(([, value]) => value !== undefined));

  await updateDoc(userProfileRef, {
    ...cleanData,
    updatedAt: serverTimestamp(),
  });

  const actorUid = actorProfile ? actorProfile.uid : targetUserId;
  const actorDisplayName = actorProfile ? (actorProfile.displayName || actorProfile.fullName) : (data.displayName || data.fullName);
  const targetUserSnap = await getDoc(userProfileRef);
  const targetUserDisplayName = targetUserSnap.exists() ? (targetUserSnap.data().displayName || targetUserSnap.data().fullName) : targetUserId;


  await logUserActivity(
    actorUid,
    actorDisplayName,
    'USER_PROFILE_UPDATED',
    { type: 'USER_PROFILE', id: targetUserId, displayName: targetUserDisplayName || undefined },
    { fieldsUpdated: Object.keys(cleanData) }
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
        applicantCategory: data.applicantCategory,
        currentStage: data.currentStage,
        startupTitle: data.startupTitle ?? '',
        problemDefinition: data.problemDefinition ?? '',
        solutionDescription: data.solutionDescription ?? '',
        uniqueness: data.uniqueness ?? '',
        teamMembers: data.teamMembers ?? '',
        enrollmentNumber: data.enrollmentNumber,
        college: data.college,
        instituteName: data.instituteName,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isSuperAdmin: false,
        isTeamMemberOnly: data.isTeamMemberOnly ?? false,
        associatedIdeaId: data.associatedIdeaId,
        associatedTeamLeaderUid: data.associatedTeamLeaderUid,
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

  await updateDoc(userProfileRef, updates);

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
  const userProfile = await getUserProfile(userId);
  if (userProfile?.role === 'ADMIN_FACULTY' || profileData.startupTitle === 'Administrative Account') {
    console.log("Skipping idea creation for admin or administrative account profile.");
    return null;
  }
  if (userProfile?.isTeamMemberOnly) {
    console.log("Skipping idea creation for a user who is only a team member.");
    return null;
  }
   if (!profileData.startupTitle || !profileData.problemDefinition || !profileData.solutionDescription || !profileData.uniqueness || !profileData.currentStage || !profileData.applicantCategory) {
    console.warn("Skipping idea creation due to missing essential idea fields in profile data.");
    return null;
  }

  const ideaCol = collection(db, 'ideas');
  const newIdeaPayload: Omit<IdeaSubmission, 'id' | 'submittedAt' | 'updatedAt' | 'phase2Marks' | 'rejectionRemarks' | 'rejectedByUid' | 'rejectedAt' | 'phase2PptUrl' | 'phase2PptFileName' | 'phase2PptUploadedAt' | 'nextPhaseDate' | 'nextPhaseStartTime' | 'nextPhaseEndTime' | 'nextPhaseVenue' | 'nextPhaseGuidelines' | 'teamMemberEmails' | 'mentor'> = {
    userId: userId,
    title: profileData.startupTitle,
    category: 'General Profile Submission',
    problem: profileData.problemDefinition,
    solution: profileData.solutionDescription,
    uniqueness: profileData.uniqueness,
    developmentStage: profileData.currentStage,
    applicantType: profileData.applicantCategory,
    teamMembers: profileData.teamMembers || '',
    structuredTeamMembers: [],
    status: 'SUBMITTED',
    programPhase: null,
  };
  const docRef = await addDoc(ideaCol, {
    ...newIdeaPayload,
    teamMemberEmails: [],
    submittedAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  });
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create idea submission from profile.");
  const data = newDocSnap.data();
  const createdIdea = {
    id: newDocSnap.id,
    ...data,
    structuredTeamMembers: data?.structuredTeamMembers || [],
    teamMemberEmails: data?.teamMemberEmails || [],
   } as IdeaSubmission;

  return createdIdea;
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

    const applicantDisplayName = userProfile ? (userProfile.displayName || userProfile.fullName || 'Unknown User') : 'N/A';
    const applicantEmail = userProfile ? (userProfile.email || 'No Email') : 'N/A';

    const submittedAt = (ideaData.submittedAt as any) instanceof Timestamp ? (ideaData.submittedAt as Timestamp) : Timestamp.now();
    const updatedAt = (ideaData.updatedAt as any) instanceof Timestamp ? (ideaData.updatedAt as Timestamp) : Timestamp.now();
    const nextPhaseDate = (ideaData.nextPhaseDate as any) instanceof Timestamp ? (ideaData.nextPhaseDate as Timestamp) : null;


    ideaSubmissions.push({
      id: ideaDoc.id,
      ...ideaData,
      programPhase: ideaData.programPhase || null,
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
    }
    if (newPhase && nextPhaseDetails) {
      updates.nextPhaseDate = nextPhaseDetails.date;
      updates.nextPhaseStartTime = nextPhaseDetails.startTime;
      updates.nextPhaseEndTime = nextPhaseDetails.endTime;
      updates.nextPhaseVenue = nextPhaseDetails.venue;
      updates.nextPhaseGuidelines = nextPhaseDetails.guidelines;
    } else if (!newPhase) {
        updates.nextPhaseDate = null;
        updates.nextPhaseStartTime = null;
        updates.nextPhaseEndTime = null;
        updates.nextPhaseVenue = null;
        updates.nextPhaseGuidelines = null;
        updates.mentor = deleteField();
    }
  } else {
    updates.programPhase = null;
    updates.nextPhaseDate = null;
    updates.nextPhaseStartTime = null;
    updates.nextPhaseEndTime = null;
    updates.nextPhaseVenue = null;
    updates.nextPhaseGuidelines = null;
    updates.mentor = deleteField();
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
  if (adminProfile && adminProfile.uid) { // Check if adminProfile and uid exist
    updates.updatedByMentorAssignerUid = adminProfile.uid;
  }

  if (mentorName === null) {
    updates.mentor = deleteField();
  } else {
    updates.mentor = mentorName;
  }
  await updateDoc(ideaRef, updates);

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

  await updateDoc(ideaRef, {
    [`phase2Marks.${adminProfile.uid}`]: mark !== null ? markData : deleteField(),
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
  const ideaTitle = ideaSnap.exists() ? ideaSnap.data().title : ideaId;

  await deleteDoc(ideaRef);

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
    id: nanoid(), // Placeholder ID, will be updated to user's UID upon their profile setup
  };

  await updateDoc(ideaRef, {
    structuredTeamMembers: arrayUnion(newMemberWithId),
    teamMemberEmails: arrayUnion(newMemberWithId.email.toLowerCase()),
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
  const memberIndex = currentMembers.findIndex(member => member.id === updatedMemberData.id || member.email.toLowerCase() === updatedMemberData.email.toLowerCase());


  if (memberIndex === -1) {
      throw new Error(`Team member with ID ${updatedMemberData.id} or email ${updatedMemberData.email} not found to update.`);
  }


  const oldEmail = currentMembers[memberIndex].email.toLowerCase();
  const newEmail = updatedMemberData.email.toLowerCase();

  const updatedMembersArray = [...currentMembers];
  updatedMembersArray[memberIndex] = updatedMemberData; // Replace the old member data with the new

  const updates: any = {
    structuredTeamMembers: updatedMembersArray,
    updatedAt: serverTimestamp(),
  };

  // If email changed, update the flat list of emails too for querying.
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
  memberUser: User, // The team member who just completed their profile
  memberProfileDataFromForm: { // Data from their profile setup form
    fullName: string;
    contactNumber: string;
    enrollmentNumber?: string;
    college?: string;
    instituteName?: string;
  }
): Promise<void> => {
  if (!memberUser.email) {
    throw new Error("Team member email is missing, cannot update idea.");
  }
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaDoc = await getDoc(ideaRef);

  if (!ideaDoc.exists()) {
    throw new Error(`Idea with ID ${ideaId} not found.`);
  }

  const ideaData = ideaDoc.data() as IdeaSubmission;
  const currentMembers = ideaData.structuredTeamMembers || [];
  let memberUpdated = false;

  const updatedMembersArray = currentMembers.map(member => {
    // Match by email (which was used when leader added them)
    if (member.email.toLowerCase() === memberUser.email!.toLowerCase()) {
      memberUpdated = true;
      return {
        ...member, // Keep existing fields not directly from form (e.g., original nanoid ID if needed for some reason, though it should become uid)
        id: memberUser.uid, // IMPORTANT: Update ID to the member's actual Firebase UID
        name: memberProfileDataFromForm.fullName,
        phone: memberProfileDataFromForm.contactNumber,
        // Update other fields from their profile setup
        institute: memberProfileDataFromForm.instituteName || member.institute || '',
        department: member.department || '', // Assuming department is not in profile form, keep existing
        enrollmentNumber: memberProfileDataFromForm.enrollmentNumber || member.enrollmentNumber || '',
        college: memberProfileDataFromForm.college || member.college || '', // For Parul students
      };
    }
    return member;
  });

  if (!memberUpdated) {
    console.warn(`Team member with email ${memberUser.email} not found in idea ${ideaId} structuredTeamMembers during profile setup update. This indicates an issue with how the member was initially added or matched.`);
    // Potentially log this anomaly. For now, we won't throw an error to allow profile creation,
    // but the idea document might not be perfectly synced for this member.
    // However, their profile IS created.
    return;
  }

  // Strict update: only change structuredTeamMembers and updatedAt
  await updateDoc(ideaRef, {
    structuredTeamMembers: updatedMembersArray,
    updatedAt: serverTimestamp(),
  });

  // Logging for this event is handled by the caller (AuthContext) which has broader context
  // (e.g., USER_PROFILE_CREATED or USER_PROFILE_UPDATED)
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
      console.warn(`Team member with ID ${memberIdToRemove} not found in idea ${ideaId} for removal.`);
    }
  } else {
    throw new Error("Idea not found.");
  }
};

export const getIdeaWhereUserIsTeamMember = async (userEmail: string): Promise<IdeaSubmission | null> => {
  if (!userEmail) return null;
  const ideasCol = collection(db, 'ideas');
  // Ensure the email is queried in lowercase as it's stored that way in teamMemberEmails
  const q = query(ideasCol, where('teamMemberEmails', 'array-contains', userEmail.toLowerCase()));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const ideaDoc = querySnapshot.docs[0]; // Take the first match
    const data = ideaDoc.data();
     const submittedAt = (data.submittedAt as any) instanceof Timestamp ? (data.submittedAt as Timestamp) : Timestamp.now();
    const updatedAt = (data.updatedAt as any) instanceof Timestamp ? (data.updatedAt as Timestamp) : Timestamp.now();
    const nextPhaseDate = (data.nextPhaseDate as any) instanceof Timestamp ? (data.nextPhaseDate as Timestamp) : null;

    return {
        id: ideaDoc.id,
        ...data,
        programPhase: data.programPhase || null,
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
export const createCohort = async (cohortData: Omit<Cohort, 'id' | 'createdAt'>): Promise<Cohort> => {
  const cohortCol = collection(db, 'cohorts');
  const newCohortPayload = {
    ...cohortData,
    createdAt: serverTimestamp() as Timestamp,
  };
  const docRef = await addDoc(cohortCol, newCohortPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create cohort.");
  return { id: newDocSnap.id, ...newDocSnap.data() } as Cohort;
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
  ideaData: Omit<IdeaSubmission, 'id' | 'userId' | 'submittedAt' | 'updatedAt' | 'status' | 'programPhase' | 'phase2Marks' | 'rejectionRemarks' | 'rejectedByUid' | 'rejectedAt' | 'phase2PptUrl' | 'phase2PptFileName' | 'phase2PptUploadedAt' | 'nextPhaseDate' | 'nextPhaseStartTime' | 'nextPhaseEndTime' | 'nextPhaseVenue' | 'nextPhaseGuidelines' | 'teamMembers' | 'structuredTeamMembers' | 'teamMemberEmails'| 'mentor'> & { teamMembers?: string, structuredTeamMembers?: TeamMember[], teamMemberEmails?: string[] }
): Promise<IdeaSubmission> => {
  const ideaCol = collection(db, 'ideas');
  const newIdeaPayload = {
    ...ideaData,
    userId: actorProfile.uid,
    status: 'SUBMITTED',
    programPhase: null,
    phase2Marks: {},
    teamMembers: ideaData.teamMembers || '',
    structuredTeamMembers: ideaData.structuredTeamMembers || [],
    teamMemberEmails: ideaData.teamMemberEmails || [],
    submittedAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  } as const;

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

