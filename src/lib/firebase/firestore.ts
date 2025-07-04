
import { db, functions as firebaseFunctions, auth } from './config';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs, Timestamp, getCountFromServer, deleteField, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage, IdeaSubmission, Cohort, SystemSettings, IdeaStatus, ProgramPhase, AdminMark, TeamMember, MentorName, ActivityLogAction, ActivityLogTarget, ActivityLogEntry, CohortScheduleEntry, ExpenseEntry, SanctionApprovalStatus, BeneficiaryAccountType, FundingSource, PortalEvent, EventCategory, AppNotification, IncubationDocumentType, Comment } from '@/types';
import { AVAILABLE_MENTORS_DATA } from '@/types';
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
    // profileDataForWrite.teamMembers = data.teamMembers || ''; // Removed
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
    // profileDataForWrite.teamMembers = null; // Removed
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
    // teamMembers: rawData.teamMembers ?? '', // Removed
    enrollmentNumber: rawData.enrollmentNumber ?? null,
    college: rawData.college ?? null,
    instituteName: rawData.instituteName || null,
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
        // teamMembers: data.teamMembers ?? '', // Removed
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
        // teamMembers: data.teamMembers ?? '', // Removed
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

export const getAllAdminUids = async (): Promise<string[]> => {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('role', '==', 'ADMIN_FACULTY'));
  const querySnapshot = await getDocs(q);
  const uids: string[] = [];
  querySnapshot.forEach((doc) => {
    uids.push(doc.id);
  });
  return uids;
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

const getUidsForCohort = async (cohortId: string): Promise<string[]> => {
    if (!cohortId) return [];
    
    const ideasCol = collection(db, 'ideas');
    const q = query(ideasCol, where('cohortId', '==', cohortId));
    const ideasSnapshot = await getDocs(q);

    if (ideasSnapshot.empty) return [];

    const uids = new Set<string>();
    ideasSnapshot.forEach(doc => {
        const idea = doc.data() as IdeaSubmission;
        if (idea.userId) {
            uids.add(idea.userId);
        }
        if (idea.structuredTeamMembers) {
            idea.structuredTeamMembers.forEach(member => {
                // Assuming member.id is the UID. Add a check to ensure it's not a nanoid placeholder.
                if (member.id && member.id.length > 10) { 
                    uids.add(member.id);
                }
            });
        }
    });
    return Array.from(uids);
};

const getAllActiveUserIds = async (): Promise<string[]> => {
    const usersCol = collection(db, 'users');
    const querySnapshot = await getDocs(query(usersCol, where('role', '!=', null)));
    const userIds: string[] = [];
    querySnapshot.forEach(doc => {
        userIds.push(doc.id);
    });
    return userIds;
};


// Announcement Functions
export const createAnnouncement = async (announcementData: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>, adminProfile: UserProfile): Promise<Announcement> => {
  const announcementsCol = collection(db, 'announcements');
  const newAnnouncementPayload = {
    ...announcementData,
    cohortId: announcementData.targetAudience === 'SPECIFIC_COHORT' ? announcementData.cohortId : null,
    createdByUid: adminProfile.uid,
    creatorDisplayName: adminProfile.displayName || adminProfile.fullName,
    attachmentURL: announcementData.attachmentURL || null,
    attachmentName: announcementData.attachmentName || null,
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
  
  // --- Create Notifications ---
  try {
      let userIds: string[] = [];
      let logDetails: any = {};

      if (createdAnn.targetAudience === 'SPECIFIC_COHORT' && createdAnn.cohortId) {
          // Send notifications to specific cohort users
          userIds = await getUidsForCohort(createdAnn.cohortId);
          logDetails = { userCount: userIds.length, cohortId: createdAnn.cohortId };
      } else if (createdAnn.targetAudience === 'ALL') {
          // Send notifications to all active users
          userIds = await getAllActiveUserIds();
          logDetails = { userCount: userIds.length, targetAudience: 'ALL' };
      }

      if (userIds.length > 0) {
          const batch = writeBatch(db);
          userIds.forEach(uid => {
              const notifRef = doc(collection(db, 'notifications'));
              batch.set(notifRef, {
                  userId: uid,
                  title: `New Announcement: ${createdAnn.title}`,
                  message: createdAnn.content.substring(0, 100) + (createdAnn.content.length > 100 ? '...' : ''),
                  link: '/dashboard/announcements',
                  isRead: false,
                  createdAt: serverTimestamp()
              });
          });
          await batch.commit();
          
          const logAction = createdAnn.targetAudience === 'SPECIFIC_COHORT' ? 'ADMIN_NOTIFICATION_SENT_COHORT' : 'ADMIN_NOTIFICATION_SENT_ALL';
          await logUserActivity(adminProfile.uid, adminProfile.displayName, logAction, { type: 'ANNOUNCEMENT', id: createdAnn.id!, displayName: createdAnn.title }, logDetails);
      }
  } catch (e) {
      console.error(`Failed to send notifications for announcement ${createdAnn.id}`, e);
  }

  return createdAnn;
};

export const getAnnouncementsStream = (callback: (announcements: Announcement[]) => void, limitCount?: number) => {
  const announcementsCol = collection(db, 'announcements');
  let q = query(announcementsCol,
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    let announcements: Announcement[] = [];
    querySnapshot.forEach((doc) => {
      announcements.push({ id: doc.id, ...doc.data() } as Announcement);
    });
    // Client-side filtering
    announcements = announcements.filter(ann => !ann.isUrgent);
    if(limitCount) {
        callback(announcements.slice(0, limitCount));
    } else {
        callback(announcements);
    }
  }, (error) => {
    console.error("Error fetching general announcements:", error);
    callback([]);
  });
};

export const getUrgentAnnouncementsStream = (callback: (announcements: Announcement[]) => void) => {
  const announcementsCol = collection(db, 'announcements');
  const q = query(announcementsCol,
    where('isUrgent', '==', true),
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
  const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));

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

  const updateData: any = { ...data };
  if (data.targetAudience === 'ALL') {
    updateData.cohortId = null;
  }
  if (data.attachmentURL === null) {
      updateData.attachmentURL = deleteField();
      updateData.attachmentName = deleteField();
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

export const getDashboardAnnouncementsStream = (cohortId: string | null, callback: (announcements: Announcement[]) => void, limitCount: number) => {
    const announcementsCol = collection(db, 'announcements');
    const announcementsMap = new Map<string, Announcement>();

    const processAndCallback = () => {
        const announcements = Array.from(announcementsMap.values());
        // Client-side filtering for isUrgent and sorting
        const filteredAndSorted = announcements
            .filter(ann => !ann.isUrgent)
            .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        callback(filteredAndSorted.slice(0, limitCount));
    };

    // Query for ALL, no sorting on server
    const qAll = query(announcementsCol,
        where('targetAudience', '==', 'ALL')
    );

    const unsubAll = onSnapshot(qAll, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
                announcementsMap.delete(change.doc.id);
            } else {
                announcementsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as Announcement);
            }
        });
        processAndCallback();
    }, (error) => console.error("Error fetching 'ALL' audience announcements:", error));

    let unsubCohort: (() => void) | null = null;
    if (cohortId) {
        // Query for SPECIFIC_COHORT, no sorting on server
        const qCohort = query(announcementsCol,
            where('targetAudience', '==', 'SPECIFIC_COHORT'),
            where('cohortId', '==', cohortId)
        );
        unsubCohort = onSnapshot(qCohort, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "removed") {
                    announcementsMap.delete(change.doc.id);
                } else {
                    announcementsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as Announcement);
                }
            });
            processAndCallback();
        }, (error) => console.error(`Error fetching announcements for cohort ${cohortId}:`, error));
    }
    
    return () => {
        unsubAll();
        if (unsubCohort) unsubCohort();
    };
};

export const getDashboardEventsStream = (cohortId: string | null, callback: (events: PortalEvent[]) => void, limitCount: number) => {
    const eventsCol = collection(db, 'events');
    const q = query(
        eventsCol,
        where('startDateTime', '>=', Timestamp.now()),
        orderBy('startDateTime', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
        const allFutureEvents: PortalEvent[] = [];
        snapshot.forEach((doc) => {
            allFutureEvents.push({ id: doc.id, ...doc.data() } as PortalEvent);
        });

        // Client-side filtering
        const userVisibleEvents = allFutureEvents.filter(event => 
            event.targetAudience === 'ALL' || 
            (event.targetAudience === 'SPECIFIC_COHORT' && event.cohortId === cohortId)
        );
        
        callback(userVisibleEvents.slice(0, limitCount));

    }, (error) => {
        console.error("Error fetching upcoming events:", error);
        callback([]);
    });
};


// Idea Submission functions
export const createIdeaFromProfile = async (
  userId: string,
  profileData: Pick<UserProfile, 'startupTitle' | 'problemDefinition' | 'solutionDescription' | 'uniqueness' | 'currentStage' | 'applicantCategory'>
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
    const ideas = existingIdeasSnap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            userId: data.userId ?? null,
            title: data.title ?? '',
            problem: data.problem ?? '',
            solution: data.solution ?? '',
            uniqueness: data.uniqueness ?? '',
            developmentStage: data.developmentStage ?? null,
            applicantType: data.applicantType ?? null,
            teamMembers: data.teamMembers || '',
            structuredTeamMembers: data.structuredTeamMembers || [],
            teamMemberEmails: data.teamMemberEmails || [],
            teamMemberUids: data.teamMemberUids || [],
            comments: data.comments || [],
            fileURL: data.fileURL ?? null,
            fileName: data.fileName ?? null,
            studioLocation: data.studioLocation ?? null,
            status: data.status ?? 'SUBMITTED',
            programPhase: data.programPhase || null,
            phase2Marks: data.phase2Marks || {},
            mentor: data.mentor ?? null,
            cohortId: data.cohortId || null,
            rejectionRemarks: data.rejectionRemarks || null,
            rejectedByUid: data.rejectedByUid || null,
            rejectedAt: data.rejectedAt || null,
            phase2PptUrl: data.phase2PptUrl || null,
            phase2PptFileName: data.phase2PptFileName || null,
            phase2PptUploadedAt: data.phase2PptUploadedAt || null,
            isOutlineAIGenerated: data.isOutlineAIGenerated ?? false,
            nextPhaseDate: data.nextPhaseDate || null,
            nextPhaseStartTime: data.nextPhaseStartTime || null,
            nextPhaseEndTime: data.nextPhaseEndTime || null,
            nextPhaseVenue: data.nextPhaseVenue || null,
            nextPhaseGuidelines: data.nextPhaseGuidelines || null,
            fundingSource: data.fundingSource ?? null,
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
            beneficiaryAccountType: data.beneficiaryAccountType ?? null,
            beneficiaryCity: data.beneficiaryCity ?? null,
            beneficiaryBranchName: data.beneficiaryBranchName ?? null,
            sanction1AppliedForNext: data.sanction1AppliedForNext ?? false,
            sanction1UtilizationStatus: data.sanction1UtilizationStatus || 'NOT_APPLICABLE',
            sanction1UtilizationRemarks: data.sanction1UtilizationRemarks ?? null,
            sanction1UtilizationReviewedBy: data.sanction1UtilizationReviewedBy ?? null,
            sanction1UtilizationReviewedAt: data.sanction1UtilizationReviewedAt ?? null,
            sanction2UtilizationStatus: data.sanction2UtilizationStatus || 'NOT_APPLICABLE',
            sanction2UtilizationRemarks: data.sanction2UtilizationRemarks ?? null,
            sanction2UtilizationReviewedBy: data.sanction2UtilizationReviewedBy ?? null,
            sanction2UtilizationReviewedAt: data.sanction2UtilizationReviewedAt ?? null,
            incubationDocuments: data.incubationDocuments || {},
            submittedAt: data.submittedAt as Timestamp,
            updatedAt: data.updatedAt as Timestamp,
            createdAt: data.createdAt as Timestamp, 
            applicantDisplayName: data.applicantDisplayName ?? '',
            applicantEmail: data.applicantEmail ?? '',
            category: data.category ?? '', // Ensure category is handled
            yuktiId: data.yuktiId ?? null,
            yuktiPassword: data.yuktiPassword ?? null,
            yuktiScreenshotUrl: data.yuktiScreenshotUrl ?? null,
            yuktiScreenshotFileName: data.yuktiScreenshotFileName ?? null,
        } as IdeaSubmission;
    });
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
    teamMembers: '', 
    updatedAt: serverTimestamp() as Timestamp,
  };

  try {
    if (existingIdeaToUpdate) {
      ideaDocRef = doc(db, 'ideas', existingIdeaToUpdate.id!);
      const updateData: Partial<IdeaSubmission> = {
        ...ideaPayloadBase,
        submittedAt: existingIdeaToUpdate.submittedAt, 
        createdAt: existingIdeaToUpdate.createdAt, 
        status: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? 'SUBMITTED' : existingIdeaToUpdate.status,
        programPhase: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.programPhase,
        cohortId: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.cohortId,
        phase2Marks: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? {} : existingIdeaToUpdate.phase2Marks,
        mentor: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.mentor,
        category: existingIdeaToUpdate.category || '', // Ensure category is preserved or defaulted
        isOutlineAIGenerated: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? false : (existingIdeaToUpdate.isOutlineAIGenerated || false),
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
        teamMemberUids: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? [] : (existingIdeaToUpdate.teamMemberUids || []),
        comments: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? [] : (existingIdeaToUpdate.comments || []),
        fileURL: existingIdeaToUpdate.fileURL || null,
        fileName: existingIdeaToUpdate.fileName || null,
        studioLocation: existingIdeaToUpdate.studioLocation || null,
        fundingSource: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.fundingSource ?? null),
        totalFundingAllocated: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.totalFundingAllocated ?? null),
        sanction1Amount: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.sanction1Amount ?? null),
        sanction2Amount: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.sanction2Amount ?? null),
        sanction1DisbursedAt: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.sanction1DisbursedAt ?? null),
        sanction2DisbursedAt: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.sanction2DisbursedAt ?? null),
        sanction1Expenses: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? [] : (existingIdeaToUpdate.sanction1Expenses || []),
        sanction2Expenses: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? [] : (existingIdeaToUpdate.sanction2Expenses || []),
        beneficiaryName: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.beneficiaryName ?? null),
        beneficiaryAccountNo: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.beneficiaryAccountNo ?? null),
        beneficiaryBankName: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.beneficiaryBankName ?? null),
        beneficiaryIfscCode: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.beneficiaryIfscCode ?? null),
        beneficiaryAccountType: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.beneficiaryAccountType ?? null),
        beneficiaryCity: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.beneficiaryCity ?? null),
        beneficiaryBranchName: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.beneficiaryBranchName ?? null),
        sanction1AppliedForNext: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? false : (existingIdeaToUpdate.sanction1AppliedForNext ?? false),
        sanction1UtilizationStatus: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? 'NOT_APPLICABLE' : (existingIdeaToUpdate.sanction1UtilizationStatus || 'NOT_APPLICABLE'),
        sanction1UtilizationRemarks: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.sanction1UtilizationRemarks ?? null),
        sanction1UtilizationReviewedBy: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.sanction1UtilizationReviewedBy ?? null),
        sanction1UtilizationReviewedAt: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.sanction1UtilizationReviewedAt ?? null),
        sanction2UtilizationStatus: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? 'NOT_APPLICABLE' : (existingIdeaToUpdate.sanction2UtilizationStatus || 'NOT_APPLICABLE'),
        sanction2UtilizationRemarks: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.sanction2UtilizationRemarks ?? null),
        sanction2UtilizationReviewedBy: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.sanction2UtilizationReviewedBy ?? null),
        sanction2UtilizationReviewedAt: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : (existingIdeaToUpdate.sanction2UtilizationReviewedAt ?? null),
        incubationDocuments: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? {} : (existingIdeaToUpdate.incubationDocuments || {}),
        yuktiId: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.yuktiId,
        yuktiPassword: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.yuktiPassword,
        yuktiScreenshotUrl: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.yuktiScreenshotUrl,
        yuktiScreenshotFileName: existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? null : existingIdeaToUpdate.yuktiScreenshotFileName,
      };
      await updateDoc(ideaDocRef, updateData);
      await logUserActivity(
        userId,
        userProfile.displayName || userProfile.fullName,
        existingIdeaToUpdate.status === 'ARCHIVED_BY_ADMIN' ? 'IDEA_RESUBMITTED' : 'IDEA_PROFILE_DATA_UPDATED',
        { type: 'IDEA', id: ideaDocRef.id, displayName: profileData.startupTitle! }
      );
    } else {
      const newIdeaData: Omit<IdeaSubmission, 'id'> = {
        ...(ideaPayloadBase as Omit<IdeaSubmission, 'id' | 'submittedAt' | 'createdAt'>),
        createdAt: serverTimestamp() as Timestamp,
        submittedAt: serverTimestamp() as Timestamp,
        structuredTeamMembers: [],
        teamMemberEmails: [],
        teamMemberUids: [],
        comments: [],
        status: 'SUBMITTED',
        programPhase: null,
        cohortId: null,
        phase2Marks: {},
        isOutlineAIGenerated: false,
        fundingSource: null,
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
        beneficiaryAccountType: null,
        beneficiaryCity: null,
        beneficiaryBranchName: null,
        sanction1AppliedForNext: false,
        sanction1UtilizationStatus: 'NOT_APPLICABLE',
        sanction1UtilizationRemarks: null,
        sanction1UtilizationReviewedBy: null,
        sanction1UtilizationReviewedAt: null,
        sanction2UtilizationStatus: 'NOT_APPLICABLE',
        sanction2UtilizationRemarks: null,
        sanction2UtilizationReviewedBy: null,
        sanction2UtilizationReviewedAt: null,
        incubationDocuments: {},
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
        mentor: null, // Explicitly set to null
        category: '', // Explicitly set to empty string
        fileURL: null, // Explicitly set to null
        fileName: null, // Explicitly set to null
        studioLocation: null, // Explicitly set to null
        applicantDisplayName: userProfile.displayName || userProfile.fullName || 'N/A',
        applicantEmail: userProfile.email || 'N/A',
        yuktiId: null,
        yuktiPassword: null,
        yuktiScreenshotUrl: null,
        yuktiScreenshotFileName: null,
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

export const getIncubatedIdeas = async (): Promise<IdeaSubmission[]> => {
  const ideasCol = collection(db, 'ideas');
  const q = query(ideasCol, where('programPhase', '==', 'INCUBATED'), orderBy('updatedAt', 'desc'));
  
  const ideasSnapshot = await getDocs(q);

  if (ideasSnapshot.empty) {
    return [];
  }
  
  const ideaSubmissions: IdeaSubmission[] = [];
  ideasSnapshot.docs.forEach(ideaDoc => {
    const ideaData = ideaDoc.data();
    ideaSubmissions.push({
      id: ideaDoc.id,
      ...ideaData
    } as IdeaSubmission);
  });
  
   const applicantIds = new Set<string>();
   ideaSubmissions.forEach(idea => {
     if (idea.userId) applicantIds.add(idea.userId);
   });
   
   const profilesMap = new Map<string, UserProfile | null>();
   if (applicantIds.size > 0) {
      const profilePromises = Array.from(applicantIds).map(id => getUserProfile(id));
      const profiles = await Promise.all(profilePromises);
      profiles.forEach((profile, index) => {
         if (profile) profilesMap.set(Array.from(applicantIds)[index], profile);
      });
   }
   
   return ideaSubmissions.map(idea => {
      const profile = idea.userId ? profilesMap.get(idea.userId) : null;
      return {
         ...idea,
         applicantDisplayName: profile ? (profile.displayName || profile.fullName) : idea.applicantDisplayName,
         applicantEmail: profile ? profile.email : idea.applicantEmail,
      };
   });
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
      isOutlineAIGenerated: ideaData.isOutlineAIGenerated ?? false,
      submittedAt,
      updatedAt,
      applicantDisplayName,
      applicantEmail,
      teamMembers: ideaData.teamMembers || '',
      structuredTeamMembers: ideaData.structuredTeamMembers || [],
      teamMemberEmails: ideaData.teamMemberEmails || [],
      teamMemberUids: ideaData.teamMemberUids || [],
      comments: ideaData.comments || [],
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
      fundingSource: ideaData.fundingSource ?? null,
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
      beneficiaryAccountType: ideaData.beneficiaryAccountType ?? null,
      beneficiaryCity: ideaData.beneficiaryCity ?? null,
      beneficiaryBranchName: ideaData.beneficiaryBranchName ?? null,
      sanction1AppliedForNext: ideaData.sanction1AppliedForNext ?? false,
      sanction1UtilizationStatus: ideaData.sanction1UtilizationStatus ?? 'NOT_APPLICABLE',
      sanction1UtilizationRemarks: ideaData.sanction1UtilizationRemarks ?? null,
      sanction1UtilizationReviewedBy: ideaData.sanction1UtilizationReviewedBy ?? null,
      sanction1UtilizationReviewedAt: ideaData.sanction1UtilizationReviewedAt ?? null,
      sanction2UtilizationStatus: ideaData.sanction2UtilizationStatus ?? 'NOT_APPLICABLE',
      sanction2UtilizationRemarks: ideaData.sanction2UtilizationRemarks ?? null,
      sanction2UtilizationReviewedBy: ideaData.sanction2UtilizationReviewedBy ?? null,
      sanction2UtilizationReviewedAt: ideaData.sanction2UtilizationReviewedAt ?? null,
      incubationDocuments: ideaData.incubationDocuments || {},
      yuktiId: ideaData.yuktiId ?? null,
      yuktiPassword: ideaData.yuktiPassword ?? null,
      yuktiScreenshotUrl: ideaData.yuktiScreenshotUrl ?? null,
      yuktiScreenshotFileName: ideaData.yuktiScreenshotFileName ?? null,
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
      isOutlineAIGenerated: ideaData.isOutlineAIGenerated ?? false,
      submittedAt,
      updatedAt,
      applicantDisplayName,
      applicantEmail,
      teamMembers: ideaData.teamMembers || '',
      structuredTeamMembers: ideaData.structuredTeamMembers || [],
      teamMemberEmails: ideaData.teamMemberEmails || [],
      teamMemberUids: ideaData.teamMemberUids || [],
      comments: ideaData.comments || [],
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
      fundingSource: ideaData.fundingSource ?? null,
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
      beneficiaryAccountType: ideaData.beneficiaryAccountType ?? null,
      beneficiaryCity: ideaData.beneficiaryCity ?? null,
      beneficiaryBranchName: ideaData.beneficiaryBranchName ?? null,
      sanction1AppliedForNext: ideaData.sanction1AppliedForNext ?? false,
      sanction1UtilizationStatus: ideaData.sanction1UtilizationStatus ?? 'NOT_APPLICABLE',
      sanction1UtilizationRemarks: ideaData.sanction1UtilizationRemarks ?? null,
      sanction1UtilizationReviewedBy: ideaData.sanction1UtilizationReviewedBy ?? null,
      sanction1UtilizationReviewedAt: ideaData.sanction1UtilizationReviewedAt ?? null,
      sanction2UtilizationStatus: ideaData.sanction2UtilizationStatus ?? 'NOT_APPLICABLE',
      sanction2UtilizationRemarks: ideaData.sanction2UtilizationRemarks ?? null,
      sanction2UtilizationReviewedBy: ideaData.sanction2UtilizationReviewedBy ?? null,
      sanction2UtilizationReviewedAt: ideaData.sanction2UtilizationReviewedAt ?? null,
      incubationDocuments: ideaData.incubationDocuments || {},
      yuktiId: ideaData.yuktiId ?? null,
      yuktiPassword: ideaData.yuktiPassword ?? null,
      yuktiScreenshotUrl: ideaData.yuktiScreenshotUrl ?? null,
      yuktiScreenshotFileName: ideaData.yuktiScreenshotFileName ?? null,
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
  if (!oldIdeaSnap.exists()) {
    throw new Error("Idea not found");
  }
  const oldIdeaData = oldIdeaSnap.data() as IdeaSubmission;
  const oldStatus = oldIdeaData.status;
  const oldPhase = oldIdeaData.programPhase;

  // Do not proceed if status is not changing, unless phase is also changing
  if (oldStatus === newStatus && oldPhase === newPhase && !remarks && !nextPhaseDetails) {
    return;
  }

  const updates: {[key: string]: any} = {
    status: newStatus,
    updatedAt: serverTimestamp(),
  };

  if (newStatus === 'SELECTED') {
    updates.programPhase = newPhase;
    updates.rejectionRemarks = deleteField();
    updates.rejectedByUid = deleteField();
    updates.rejectedAt = deleteField();

    if (newPhase === 'PHASE_2' && !oldIdeaData.phase2Marks) {
        updates.phase2Marks = {};
    } else if (newPhase !== 'COHORT' && newPhase !== 'INCUBATED') {
        updates.mentor = deleteField();
    }
     if (newPhase === 'INCUBATED') {
        if (!oldIdeaData.sanction1UtilizationStatus) updates.sanction1UtilizationStatus = 'NOT_APPLICABLE';
        if (!oldIdeaData.sanction2UtilizationStatus) updates.sanction2UtilizationStatus = 'NOT_APPLICABLE';
        if (!oldIdeaData.sanction1Expenses) updates.sanction1Expenses = [];
        if (!oldIdeaData.sanction2Expenses) updates.sanction2Expenses = [];
        if (!oldIdeaData.incubationDocuments) updates.incubationDocuments = {};
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
    updates.isOutlineAIGenerated = false;
    updates.comments = [];
    updates.rejectionRemarks = deleteField();
    updates.rejectedByUid = deleteField();
    updates.rejectedAt = deleteField();
    updates.nextPhaseDate = null;
    updates.nextPhaseStartTime = null;
    updates.nextPhaseEndTime = null;
    updates.nextPhaseVenue = null;
    updates.nextPhaseGuidelines = null;
    updates.fundingSource = deleteField();
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
    updates.beneficiaryAccountType = deleteField();
    updates.beneficiaryCity = deleteField();
    updates.beneficiaryBranchName = deleteField();
    updates.sanction1AppliedForNext = false;
    updates.sanction1UtilizationStatus = 'NOT_APPLICABLE';
    updates.sanction1UtilizationRemarks = deleteField();
    updates.sanction1UtilizationReviewedBy = deleteField();
    updates.sanction1UtilizationReviewedAt = deleteField();
    updates.sanction2UtilizationStatus = 'NOT_APPLICABLE';
    updates.sanction2UtilizationRemarks = deleteField();
    updates.sanction2UtilizationReviewedBy = deleteField();
    updates.sanction2UtilizationReviewedAt = deleteField();
    updates.incubationDocuments = {};
    updates.updatedAt = serverTimestamp();
    updates.yuktiId = deleteField();
    updates.yuktiPassword = deleteField();
    updates.yuktiScreenshotUrl = deleteField();
    updates.yuktiScreenshotFileName = deleteField();
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

  // --- Notification Logic ---
  if (oldStatus !== newStatus) {
    const getProgramPhaseLabel = (phase: ProgramPhase | null | undefined): string => {
      if (!phase) return 'N/A';
      switch (phase) {
          case 'PHASE_1': return 'Phase 1';
          case 'PHASE_2': return 'Phase 2';
          case 'COHORT': return 'Cohort';
          case 'INCUBATED': return 'Incubated (Funding)';
          default: return 'N/A';
      }
    };

    let notificationTitle = `Update on your Idea: "${ideaTitle}"`;
    let notificationMessage = `The status of your idea has been updated to: ${newStatus.replace(/_/g, ' ').toLowerCase()}.`;

    if (newStatus === 'SELECTED') {
      notificationTitle = `🎉 Congratulations! Your Idea is now Incubated! 🎉`;
      notificationMessage = newPhase ? `🎉 Congratulations! Your idea, "${ideaTitle}", has been selected for ${getProgramPhaseLabel(newPhase)}! We're excited to see you at the next stage.` : `🎉 Congratulations! Your idea, "${ideaTitle}", has been selected! More details to follow.`;
    } else if (newStatus === 'NOT_SELECTED') {
      notificationTitle = `Update on your Idea: "${ideaTitle}"`;
      notificationMessage = `Your idea has been reviewed. Please check your dashboard for feedback and guidance from our team.`;
    } else if (newStatus === 'ARCHIVED_BY_ADMIN') {
        notificationTitle = `Your Idea "${ideaTitle}" has been Archived`;
        notificationMessage = `Your idea has been archived for revision. Please update your details on the profile page and save to resubmit.`;
    }

    const teamUids = new Set<string>();
    if (oldIdeaData.userId) {
        teamUids.add(oldIdeaData.userId);
    }
    if (oldIdeaData.structuredTeamMembers) {
        oldIdeaData.structuredTeamMembers.forEach(member => {
            // A simple check to see if the ID is a UID and not a placeholder
            if (member.id && member.id.length > 10) { 
                teamUids.add(member.id);
            }
        });
    }
    
    if (teamUids.size > 0) {
        const batch = writeBatch(db);
        Array.from(teamUids).forEach(uid => {
            const notifRef = doc(collection(db, 'notifications'));
            const link = allAdminUids.includes(uid) ? `/dashboard/admin/view-applications` : `/dashboard`;

            batch.set(notifRef, {
                userId: uid,
                title: notificationTitle,
                message: notificationMessage,
                link: '/dashboard/',
                isRead: false,
                createdAt: serverTimestamp()
            });
        });
        await batch.commit();
    }
  }

  await logUserActivity(
    adminProfile.uid,
    adminProfile.displayName || adminProfile.fullName,
    newStatus === 'ARCHIVED_BY_ADMIN' ? 'ADMIN_IDEA_ARCHIVED_FOR_REVISION' : 'ADMIN_IDEA_STATUS_PHASE_UPDATED',
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { oldStatus, newStatus, oldPhase, newPhase, remarks: newStatus === 'NOT_SELECTED' ? remarks : undefined }
  );
};

export const assignMentorFS = async (ideaId: string, ideaTitle: string, mentorName: MentorName | null, adminProfile: UserProfile): Promise<void> => {
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
        isOutlineAIGenerated: data.isOutlineAIGenerated ?? false,
        teamMembers: data.teamMembers || '',
        structuredTeamMembers: data.structuredTeamMembers || [],
        teamMemberEmails: data.teamMemberEmails || [],
        teamMemberUids: data.teamMemberUids || [],
        comments: data.comments || [],
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
        fundingSource: data.fundingSource ?? null,
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
        beneficiaryAccountType: data.beneficiaryAccountType ?? null,
        beneficiaryCity: data.beneficiaryCity ?? null,
        beneficiaryBranchName: data.beneficiaryBranchName ?? null,
        sanction1AppliedForNext: data.sanction1AppliedForNext ?? false,
        sanction1UtilizationStatus: data.sanction1UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction1UtilizationRemarks: data.sanction1UtilizationRemarks ?? null,
        sanction1UtilizationReviewedBy: data.sanction1UtilizationReviewedBy ?? null,
        sanction1UtilizationReviewedAt: data.sanction1UtilizationReviewedAt ?? null,
        sanction2UtilizationStatus: data.sanction2UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction2UtilizationRemarks: data.sanction2UtilizationRemarks ?? null,
        sanction2UtilizationReviewedBy: data.sanction2UtilizationReviewedBy ?? null,
        sanction2UtilizationReviewedAt: data.sanction2UtilizationReviewedAt ?? null,
        incubationDocuments: data.incubationDocuments || {},
        yuktiId: data.yuktiId ?? null,
        yuktiPassword: data.yuktiPassword ?? null,
        yuktiScreenshotUrl: data.yuktiScreenshotUrl ?? null,
        yuktiScreenshotFileName: data.yuktiScreenshotFileName ?? null,
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
    isOutlineAIGenerated: false,
    comments: [],
    rejectionRemarks: deleteField(),
    rejectedByUid: deleteField(),
    rejectedAt: deleteField(),
    nextPhaseDate: null,
    nextPhaseStartTime: null,
    nextPhaseEndTime: null,
    nextPhaseVenue: null,
    nextPhaseGuidelines: null,
    fundingSource: deleteField(),
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
    beneficiaryAccountType: deleteField(),
    beneficiaryCity: deleteField(),
    beneficiaryBranchName: deleteField(),
    sanction1AppliedForNext: false,
    sanction1UtilizationStatus: 'NOT_APPLICABLE',
    sanction1UtilizationRemarks: deleteField(),
    sanction1UtilizationReviewedBy: deleteField(),
    sanction1UtilizationReviewedAt: deleteField(),
    sanction2UtilizationStatus: 'NOT_APPLICABLE',
    sanction2UtilizationRemarks: deleteField(),
    sanction2UtilizationReviewedBy: deleteField(),
    sanction2UtilizationReviewedAt: deleteField(),
    incubationDocuments: {},
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

  const updatePayload: any = {
    structuredTeamMembers: updatedStructuredMembersArray,
    teamMemberUids: arrayUnion(memberUser.uid),
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
    if (memberToRemove) {
      await updateDoc(ideaRef, {
        structuredTeamMembers: arrayRemove(memberToRemove),
        teamMemberEmails: arrayRemove(memberToRemove.email.toLowerCase()),
        teamMemberUids: arrayRemove(memberToRemove.id),
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
        isOutlineAIGenerated: data.isOutlineAIGenerated ?? false,
        teamMembers: data.teamMembers || '',
        structuredTeamMembers: data.structuredTeamMembers || [],
        teamMemberEmails: data.teamMemberEmails || [],
        teamMemberUids: data.teamMemberUids || [],
        comments: data.comments || [],
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
        fundingSource: data.fundingSource ?? null,
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
        beneficiaryAccountType: data.beneficiaryAccountType ?? null,
        beneficiaryCity: data.beneficiaryCity ?? null,
        beneficiaryBranchName: data.beneficiaryBranchName ?? null,
        sanction1AppliedForNext: data.sanction1AppliedForNext ?? false,
        sanction1UtilizationStatus: data.sanction1UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction1UtilizationRemarks: data.sanction1UtilizationRemarks ?? null,
        sanction1UtilizationReviewedBy: data.sanction1UtilizationReviewedBy ?? null,
        sanction1UtilizationReviewedAt: data.sanction1UtilizationReviewedAt ?? null,
        sanction2UtilizationStatus: data.sanction2UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction2UtilizationRemarks: data.sanction2UtilizationRemarks ?? null,
        sanction2UtilizationReviewedBy: data.sanction2UtilizationReviewedBy ?? null,
        sanction2UtilizationReviewedAt: data.sanction2UtilizationReviewedAt ?? null,
        incubationDocuments: data.incubationDocuments || {},
        yuktiId: data.yuktiId ?? null,
        yuktiPassword: data.yuktiPassword ?? null,
        yuktiScreenshotUrl: data.yuktiScreenshotUrl ?? null,
        yuktiScreenshotFileName: data.yuktiScreenshotFileName ?? null,
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
  ideaData: Omit<IdeaSubmission, 'id' | 'userId' | 'submittedAt' | 'updatedAt' | 'status' | 'programPhase' | 'phase2Marks' | 'rejectionRemarks' | 'rejectedByUid' | 'rejectedAt' | 'phase2PptUrl' | 'phase2PptFileName' | 'phase2PptUploadedAt' | 'nextPhaseDate' | 'nextPhaseStartTime' | 'nextPhaseEndTime' | 'nextPhaseVenue' | 'nextPhaseGuidelines' | 'teamMembers' | 'structuredTeamMembers' | 'teamMemberEmails'| 'mentor' | 'applicantDisplayName' | 'applicantEmail' | 'category' | 'cohortId' | 'isOutlineAIGenerated' | 'fundingSource' | 'totalFundingAllocated' | 'sanction1Amount' | 'sanction2Amount' | 'sanction1DisbursedAt' | 'sanction2DisbursedAt' | 'sanction1Expenses' | 'sanction2Expenses' | 'beneficiaryName' | 'beneficiaryAccountNo' | 'beneficiaryBankName' | 'beneficiaryIfscCode' | 'beneficiaryAccountType' | 'beneficiaryCity' | 'beneficiaryBranchName' | 'sanction1AppliedForNext' | 'sanction1UtilizationStatus' | 'sanction1UtilizationRemarks' | 'sanction1UtilizationReviewedBy' | 'sanction1UtilizationReviewedAt' | 'sanction2UtilizationStatus' | 'sanction2UtilizationRemarks' | 'sanction2UtilizationReviewedBy' | 'sanction2UtilizationReviewedAt' | 'createdAt' | 'incubationDocuments' | 'comments' | 'yuktiId' | 'yuktiPassword' | 'yuktiScreenshotUrl' | 'yuktiScreenshotFileName' | 'teamMemberUids'> & { teamMembers?: string, structuredTeamMembers?: TeamMember[], teamMemberEmails?: string[], teamMemberUids?: string[] }
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
    teamMemberUids: ideaData.teamMemberUids || [],
    comments: [],
    status: 'SUBMITTED',
    programPhase: null,
    cohortId: null,
    phase2Marks: {},
    isOutlineAIGenerated: false,
    fundingSource: null,
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
    beneficiaryAccountType: null,
    beneficiaryCity: null,
    beneficiaryBranchName: null,
    sanction1AppliedForNext: false,
    sanction1UtilizationStatus: 'NOT_APPLICABLE',
    sanction1UtilizationRemarks: null,
    sanction1UtilizationReviewedBy: null,
    sanction1UtilizationReviewedAt: null,
    sanction2UtilizationStatus: 'NOT_APPLICABLE',
    sanction2UtilizationRemarks: null,
    sanction2UtilizationReviewedBy: null,
    sanction2UtilizationReviewedAt: null,
    incubationDocuments: {},
    submittedAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    createdAt: serverTimestamp() as Timestamp,
    yuktiId: null,
    yuktiPassword: null,
    yuktiScreenshotUrl: null,
    yuktiScreenshotFileName: null,
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
    teamMemberUids: newDocSnap.data()?.teamMemberUids || [],
    isOutlineAIGenerated: newDocSnap.data()?.isOutlineAIGenerated ?? false,
    incubationDocuments: newDocSnap.data()?.incubationDocuments || {},
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

export const updateIncubationDocumentFS = async (
    ideaId: string,
    ideaTitle: string,
    docType: IncubationDocumentType,
    docData: { url: string; fileName: string },
    actorProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    const docToStore: IncubationDocument = {
        ...docData,
        uploadedAt: Timestamp.now(),
    };
    
    const updatePath = `incubationDocuments.${docType}`;
    await updateDoc(ideaRef, {
        [updatePath]: docToStore,
        updatedAt: serverTimestamp(),
    });

    await logUserActivity(
        actorProfile.uid,
        actorProfile.displayName || actorProfile.fullName,
        'IDEA_INCUBATION_DOCUMENT_UPLOADED',
        { type: 'IDEA', id: ideaId, displayName: ideaTitle },
        { docType, fileName: docData.fileName }
    );
};

export const updateIdeaOutlineAIGeneratedStatus = async (
  ideaId: string,
  ideaTitle: string,
  status: boolean,
  actorProfile: UserProfile
): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  await updateDoc(ideaRef, {
    isOutlineAIGenerated: status,
    updatedAt: serverTimestamp(),
  });

  await logUserActivity(
    actorProfile.uid,
    actorProfile.displayName || actorProfile.fullName,
    'USER_GENERATED_PITCH_DECK_OUTLINE',
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { aiGenerated: status }
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
        isOutlineAIGenerated: data.isOutlineAIGenerated ?? false,
        teamMembers: data.teamMembers || '',
        structuredTeamMembers: data.structuredTeamMembers || [],
        teamMemberEmails: data.teamMemberEmails || [],
        teamMemberUids: data.teamMemberUids || [],
        comments: data.comments || [],
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
        fundingSource: data.fundingSource ?? null,
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
        beneficiaryAccountType: data.beneficiaryAccountType ?? null,
        beneficiaryCity: data.beneficiaryCity ?? null,
        beneficiaryBranchName: data.beneficiaryBranchName ?? null,
        sanction1AppliedForNext: data.sanction1AppliedForNext ?? false,
        sanction1UtilizationStatus: data.sanction1UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction1UtilizationRemarks: data.sanction1UtilizationRemarks ?? null,
        sanction1UtilizationReviewedBy: data.sanction1UtilizationReviewedBy ?? null,
        sanction1UtilizationReviewedAt: data.sanction1UtilizationReviewedAt ?? null,
        sanction2UtilizationStatus: data.sanction2UtilizationStatus ?? 'NOT_APPLICABLE',
        sanction2UtilizationRemarks: data.sanction2UtilizationRemarks ?? null,
        sanction2UtilizationReviewedBy: data.sanction2UtilizationReviewedBy ?? null,
        sanction2UtilizationReviewedAt: data.sanction2UtilizationReviewedAt ?? null,
        incubationDocuments: data.incubationDocuments || {},
        yuktiId: data.yuktiId ?? null,
        yuktiPassword: data.yuktiPassword ?? null,
        yuktiScreenshotUrl: data.yuktiScreenshotUrl ?? null,
        yuktiScreenshotFileName: data.yuktiScreenshotFileName ?? null,
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

  // Safely unassign from the old cohort
  if (oldCohortId && oldCohortId !== newCohortId) {
    const oldCohortRef = doc(db, 'cohorts', oldCohortId);
    const oldCohortSnap = await getDoc(oldCohortRef);
    if (oldCohortSnap.exists()) {
        batch.update(oldCohortRef, {
          ideaIds: arrayRemove(ideaId),
          updatedAt: serverTimestamp()
        });
    } else {
        console.warn(`Old cohort with ID ${oldCohortId} not found while unassigning. The operation will proceed, but the old cohort document was not updated as it doesn't exist.`);
    }
  }

  // Safely assign to the new cohort
  if (newCohortId && newCohortId !== oldCohortId) {
    const newCohortRef = doc(db, 'cohorts', newCohortId);
    const newCohortSnap = await getDoc(newCohortRef);
    if (!newCohortSnap.exists()) {
        throw new Error(`Assigning idea failed: The target cohort does not exist. Please ensure the cohort is created before assigning ideas to it.`);
    }
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

  // Apply server-side filter for actionType if provided
  if (filters.actionType) {
    q = query(q, where('action', '==', filters.actionType));
  }

  return onSnapshot(q, (querySnapshot) => {
    let logs: ActivityLogEntry[] = [];
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as ActivityLogEntry);
    });

    // Apply client-side filter for actorName if provided
    if (filters.actorName) {
      const searchTerm = filters.actorName.toLowerCase();
      logs = logs.filter(log =>
        (log.actorDisplayName && log.actorDisplayName.toLowerCase().includes(searchTerm)) ||
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
    fundingData: {
        totalFundingAllocated: number;
        sanction1Amount: number;
        sanction2Amount: number;
        fundingSource: FundingSource | null; 
    },
    adminProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    await updateDoc(ideaRef, {
        fundingSource: fundingData.fundingSource,
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
    beneficiaryData: {
        beneficiaryName: string;
        beneficiaryAccountNo: string;
        beneficiaryBankName: string;
        beneficiaryIfscCode: string;
        beneficiaryAccountType: BeneficiaryAccountType;
        beneficiaryCity: string;
        beneficiaryBranchName: string;
    },
    userProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    const updatePayload = {
        beneficiaryName: beneficiaryData.beneficiaryName,
        beneficiaryAccountNo: beneficiaryData.beneficiaryAccountNo,
        beneficiaryBankName: beneficiaryData.beneficiaryBankName,
        beneficiaryIfscCode: beneficiaryData.beneficiaryIfscCode,
        beneficiaryAccountType: beneficiaryData.beneficiaryAccountType,
        beneficiaryCity: beneficiaryData.beneficiaryCity,
        beneficiaryBranchName: beneficiaryData.beneficiaryBranchName,
        updatedAt: serverTimestamp(),
    };
    await updateDoc(ideaRef, updatePayload);
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
        uploadedAt: Timestamp.now(), // Use client-side timestamp for array elements
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
        [utilizationStatusField]: 'PENDING',
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
    currentSanctionNumber: 1,
    userProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    if (currentSanctionNumber === 1) {
        await updateDoc(ideaRef, {
            sanction1AppliedForNext: true,
            sanction1UtilizationStatus: 'PENDING', // Set to PENDING when applying, admin will review then approve/reject
            updatedAt: serverTimestamp(),
        });
        await logUserActivity(userProfile.uid, userProfile.displayName || userProfile.fullName, 'IDEA_APPLIED_FOR_NEXT_SANCTION', { type: 'IDEA', id: ideaId, displayName: ideaTitle }, { appliedForSanction: 2 });
    } else {
        throw new Error("Application for sanctions beyond Sanction 2 via this method is not supported.");
    }
};

// Event Management Functions
export const createEventFS = async (eventData: Omit<PortalEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'creatorDisplayName' | 'rsvps' | 'rsvpCount'>, adminProfile: UserProfile): Promise<PortalEvent> => {
    const eventCol = collection(db, 'events');
    const newEventPayload: Omit<PortalEvent, 'id'> = {
        ...eventData,
        cohortId: eventData.targetAudience === 'SPECIFIC_COHORT' ? eventData.cohortId : null,
        rsvps: [],
        rsvpCount: 0,
        createdByUid: adminProfile.uid,
        creatorDisplayName: adminProfile.displayName || adminProfile.fullName,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
    };
    const docRef = await addDoc(eventCol, newEventPayload);
    const newDocSnap = await getDoc(docRef);
    if (!newDocSnap.exists()) throw new Error("Could not create event.");

    const createdEvent = { id: newDocSnap.id, ...newDocSnap.data() } as PortalEvent;
    await logUserActivity(adminProfile.uid, adminProfile.displayName || adminProfile.fullName, 'ADMIN_EVENT_CREATED', { type: 'EVENT', id: createdEvent.id!, displayName: createdEvent.title }, { title: createdEvent.title });

    if (createdEvent.targetAudience === 'SPECIFIC_COHORT' && createdEvent.cohortId) {
      try {
          const userIds = await getUidsForCohort(createdEvent.cohortId);
          if (userIds.length > 0) {
              const batch = writeBatch(db);
              userIds.forEach(uid => {
                  const notifRef = doc(collection(db, 'notifications'));
                  batch.set(notifRef, {
                      userId: uid,
                      title: `New Event: ${createdEvent.title}`,
                      message: createdEvent.description.substring(0, 100) + (createdEvent.description.length > 100 ? '...' : ''),
                      link: '/dashboard/events',
                      isRead: false,
                      createdAt: serverTimestamp()
                  });
              });
              await batch.commit();
              await logUserActivity(adminProfile.uid, adminProfile.displayName, 'ADMIN_NOTIFICATION_SENT_COHORT', { type: 'EVENT', id: createdEvent.id!, displayName: createdEvent.title }, { userCount: userIds.length, cohortId: createdEvent.cohortId });
          }
      } catch (e) {
          console.error(`Failed to send notifications for cohort event ${createdEvent.id}`, e);
      }
    }

    return createdEvent;
};

export const updateEventFS = async (eventId: string, dataToUpdate: Partial<Omit<PortalEvent, 'id'>>, adminProfile: UserProfile): Promise<void> => {
    const eventRef = doc(db, 'events', eventId);
    const updateData = { ...dataToUpdate };
    if (dataToUpdate.targetAudience === 'ALL') {
        updateData.cohortId = null;
    }
    await updateDoc(eventRef, { ...updateData, updatedAt: serverTimestamp() });
    await logUserActivity(adminProfile.uid, adminProfile.displayName || adminProfile.fullName, 'ADMIN_EVENT_UPDATED', { type: 'EVENT', id: eventId, displayName: dataToUpdate.title || undefined }, { fieldsUpdated: Object.keys(dataToUpdate) });
};

export const deleteEventFS = async (eventId: string, adminProfile: UserProfile): Promise<void> => {
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    const eventTitle = eventSnap.exists() ? eventSnap.data().title : eventId;
    await deleteDoc(eventRef);
    await logUserActivity(adminProfile.uid, adminProfile.displayName || adminProfile.fullName, 'ADMIN_EVENT_DELETED', { type: 'EVENT', id: eventId, displayName: eventTitle });
};

export const getAllEventsStream = (callback: (events: PortalEvent[]) => void) => {
    const eventsCol = collection(db, 'events');
    const q = query(eventsCol, orderBy('startDateTime', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
        const events: PortalEvent[] = [];
        querySnapshot.forEach((doc) => {
            events.push({ id: doc.id, ...doc.data() } as PortalEvent);
        });
        callback(events);
    }, (error) => {
        console.error("Error fetching events:", error);
        callback([]);
    });
};

export const getPublicUpcomingEventsStream = (callback: (events: PortalEvent[]) => void, limitCount: number) => {
    const eventsCol = collection(db, 'events');
    const q = query(
        eventsCol,
        where('startDateTime', '>=', Timestamp.now()),
        where('targetAudience', '==', 'ALL'),
        orderBy('startDateTime', 'asc'),
        limit(limitCount)
    );

    return onSnapshot(q, (querySnapshot) => {
        const events: PortalEvent[] = [];
        querySnapshot.forEach((doc) => {
            events.push({ id: doc.id, ...doc.data() } as PortalEvent);
        });
        callback(events);
    }, (error) => {
        console.error("Error fetching upcoming events:", error);
        callback([]);
    });
};

export const toggleRsvpForEvent = async (eventId: string, eventTitle: string, userId: string, actorProfile: UserProfile): Promise<void> => {
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) throw new Error("Event not found");

    const currentRsvps = (eventSnap.data().rsvps as string[]) || [];
    let updatedRsvps: string[];
    let newRsvpCount: number;

    if (currentRsvps.includes(userId)) {
        updatedRsvps = currentRsvps.filter(id => id !== userId);
    } else {
        updatedRsvps = [...currentRsvps, userId];
    }
    newRsvpCount = updatedRsvps.length;

    await updateDoc(eventRef, { rsvps: updatedRsvps, rsvpCount: newRsvpCount });
    await logUserActivity(actorProfile.uid, actorProfile.displayName || actorProfile.fullName, 'USER_RSVP_SUBMITTED', { type: 'EVENT', id: eventId, displayName: eventTitle }, { rsvp: !currentRsvps.includes(userId) });
};

export const getProfilesForUids = async (uids: string[]): Promise<UserProfile[]> => {
  if (!uids || uids.length === 0) {
    return [];
  }

  const profiles: UserProfile[] = [];
  const usersCol = collection(db, 'users');

  const CHUNK_SIZE = 30;
  for (let i = 0; i < uids.length; i += CHUNK_SIZE) {
    const uidsChunk = uids.slice(i, i + CHUNK_SIZE);
    if (uidsChunk.length > 0) {
        const q = query(usersCol, where('uid', 'in', uidsChunk));
        const querySnapshot = await getDocs(q);
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
            } else if (data.isSuperAdmin === true) {
                profile.isSuperAdmin = true;
            }
            profiles.push(profile);
        });
    }
  }

  return profiles;
};


// Notification Functions
export const createNotification = async (userId: string, title: string, message: string, link?: string): Promise<void> => {
    const notificationsCol = collection(db, 'notifications');
    const newNotification: Omit<AppNotification, 'id'> = {
        userId,
        title,
        message,
        link: link || '',
        isRead: false,
        createdAt: serverTimestamp() as Timestamp,
    };
    await addDoc(notificationsCol, newNotification);
};

export const getNotificationsStreamForUser = (userId: string, callback: (notifications: AppNotification[]) => void, limitCount: number = 10) => {
    const notificationsCol = collection(db, 'notifications');
    const q = query(notificationsCol, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(limitCount));
    return onSnapshot(q, (querySnapshot) => {
        const notifications: AppNotification[] = [];
        querySnapshot.forEach((doc) => {
            notifications.push({ id: doc.id, ...doc.data() } as AppNotification);
        });
        callback(notifications);
    }, (error) => {
        console.error(`Error fetching notifications for user ${userId}:`, error);
        callback([]);
    });
};

export const markNotificationsAsRead = async (userId: string, notificationIds: string[], actorProfile: UserProfile): Promise<void> => {
    if (notificationIds.length === 0) return;
    const batch = writeBatch(db);
    notificationIds.forEach(id => {
        const notifRef = doc(db, 'notifications', id);
        batch.update(notifRef, { isRead: true });
    });
    await batch.commit();
    await logUserActivity(userId, actorProfile.displayName || actorProfile.fullName, 'USER_NOTIFICATIONS_READ', undefined, { count: notificationIds.length });
};

// Commenting Functions
export const addCommentToIdea = async (
  ideaId: string,
  ideaTitle: string,
  commentContent: string,
  actorProfile: UserProfile
): Promise<void> => {
  if (!commentContent.trim()) {
    throw new Error("Comment cannot be empty.");
  }

  const ideaRef = doc(db, 'ideas', ideaId);
  const newComment: Comment = {
    id: nanoid(),
    authorId: actorProfile.uid,
    authorName: actorProfile.displayName || actorProfile.fullName || 'User',
    authorRole: actorProfile.role,
    content: commentContent,
    createdAt: Timestamp.now(),
  };

  await updateDoc(ideaRef, {
    comments: arrayUnion(newComment),
    updatedAt: serverTimestamp(),
  });

  const logAction: ActivityLogAction = actorProfile.role === 'ADMIN_FACULTY' ? 'ADMIN_COMMENT_ADDED' : 'USER_COMMENT_ADDED';
  await logUserActivity(
    actorProfile.uid,
    actorProfile.displayName || actorProfile.fullName,
    logAction,
    { type: 'IDEA', id: ideaId, displayName: ideaTitle },
    { commentContent: commentContent.substring(0, 50) + '...' }
  );

  // --- Comprehensive Notification Logic ---
  const ideaSnap = await getDoc(ideaRef);
  if (!ideaSnap.exists()) return;
  const ideaData = ideaSnap.data() as IdeaSubmission;

  const notificationTitle = `New Comment on "${ideaTitle}"`;
  const notificationMessage = `${newComment.authorName}: "${commentContent.substring(0, 50)}..."`;
  
  const userIdsToNotify = new Set<string>();

  // 1. Add the idea owner (team leader)
  if (ideaData.userId) {
    userIdsToNotify.add(ideaData.userId);
  }
  // 2. Add all structured team members
  ideaData.structuredTeamMembers?.forEach(member => {
    if (member.id && member.id.length > 10) userIdsToNotify.add(member.id);
  });

  // 3. Add all admins/mentors
  const allAdminUids = await getAllAdminUids();
  allAdminUids.forEach(uid => userIdsToNotify.add(uid));

  // 4. Remove the author of the comment to prevent self-notification
  userIdsToNotify.delete(actorProfile.uid);

  // 5. Create and send notifications
  if (userIdsToNotify.size > 0) {
      const batch = writeBatch(db);
      Array.from(userIdsToNotify).forEach(uid => {
          const notifRef = doc(collection(db, 'notifications'));
          const link = allAdminUids.includes(uid) ? `/dashboard/admin/view-applications` : `/dashboard`;

          batch.set(notifRef, {
              userId: uid,
              title: notificationTitle,
              message: notificationMessage,
              link: link, // Use a more specific link for admins
              isRead: false,
              createdAt: serverTimestamp()
          });
      });
      await batch.commit();
  }
};

// Yukti Portal Functions
export const updateYuktiDetailsFS = async (
    ideaId: string,
    ideaTitle: string,
    yuktiData: {
        yuktiId: string;
        yuktiPassword?: string;
        screenshotUrl: string;
        screenshotFileName: string;
    },
    actorProfile: UserProfile
): Promise<void> => {
    const ideaRef = doc(db, 'ideas', ideaId);
    const updates = {
        yuktiId: yuktiData.yuktiId,
        yuktiPassword: yuktiData.yuktiPassword,
        yuktiScreenshotUrl: yuktiData.screenshotUrl,
        yuktiScreenshotFileName: yuktiData.screenshotFileName,
        updatedAt: serverTimestamp(),
    };
    await updateDoc(ideaRef, updates as any);

    await logUserActivity(
        actorProfile.uid,
        actorProfile.displayName || actorProfile.fullName,
        'IDEA_YUKTI_DETAILS_SUBMITTED',
        { type: 'IDEA', id: ideaId, displayName: ideaTitle },
        { yuktiId: yuktiData.yuktiId }
    );
};

export const getAllIdeasWithYuktiDetails = async (): Promise<IdeaSubmission[]> => {
    const ideasCol = collection(db, 'ideas');
    const q = query(ideasCol, where('yuktiId', '>', ''), orderBy('yuktiId'), orderBy('updatedAt', 'desc'));
    const ideasSnapshot = await getDocs(q);

    if (ideasSnapshot.empty) {
        return [];
    }
    
    const ideaSubmissions: IdeaSubmission[] = [];
    ideasSnapshot.docs.forEach(ideaDoc => {
        ideaSubmissions.push({
            id: ideaDoc.id,
            ...ideaDoc.data()
        } as IdeaSubmission);
    });

    return ideaSubmissions;
};
    
