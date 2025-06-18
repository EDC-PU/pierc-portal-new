
import { db, functions as firebaseFunctions } from './config'; // functions aliased to avoid conflict
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, serverTimestamp, onSnapshot, where, writeBatch, getDocs, Timestamp, getCountFromServer, deleteField, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { UserProfile, Announcement, Role, ApplicantCategory, CurrentStage, IdeaSubmission, Cohort, SystemSettings, IdeaStatus, ProgramPhase, AdminMark, TeamMember, MentorName } from '@/types';
import { httpsCallable } from 'firebase/functions';
import { nanoid } from 'nanoid';
import type { User } from 'firebase/auth';

// User Profile Functions
export const createUserProfileFS = async (userId: string, data: Partial<UserProfile>): Promise<UserProfile> => {
  const userProfileRef = doc(db, 'users', userId);

  const profileToCreate: UserProfile = {
    uid: userId,
    email: data.email ?? null,
    displayName: data.displayName || data.fullName || 'User',
    photoURL: data.photoURL ?? null,
    role: data.role ?? null,
    fullName: data.fullName!,
    contactNumber: data.contactNumber!,
    // These fields might not be present if isTeamMemberOnly is true
    applicantCategory: data.applicantCategory!,
    currentStage: data.currentStage!,
    startupTitle: data.startupTitle!,
    problemDefinition: data.problemDefinition!,
    solutionDescription: data.solutionDescription!,
    uniqueness: data.uniqueness!,
    teamMembers: data.teamMembers || '',


    enrollmentNumber: data.enrollmentNumber,
    college: data.college,
    instituteName: data.instituteName,
    isSuperAdmin: data.email === 'pranavrathi07@gmail.com' ? true : (data.isSuperAdmin ?? false),
    isTeamMemberOnly: data.isTeamMemberOnly ?? false,
    associatedIdeaId: data.associatedIdeaId,
    associatedTeamLeaderUid: data.associatedTeamLeaderUid,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  const cleanProfileData: Partial<UserProfile> = {
    uid: userId,
    email: profileToCreate.email,
    displayName: profileToCreate.displayName,
    photoURL: profileToCreate.photoURL,
    role: profileToCreate.role,
    fullName: profileToCreate.fullName,
    contactNumber: profileToCreate.contactNumber,
    isSuperAdmin: profileToCreate.isSuperAdmin,
    isTeamMemberOnly: profileToCreate.isTeamMemberOnly,
    createdAt: profileToCreate.createdAt,
    updatedAt: profileToCreate.updatedAt,
  };

  if (profileToCreate.isTeamMemberOnly) {
    cleanProfileData.associatedIdeaId = profileToCreate.associatedIdeaId;
    cleanProfileData.associatedTeamLeaderUid = profileToCreate.associatedTeamLeaderUid;
    if (profileToCreate.enrollmentNumber) cleanProfileData.enrollmentNumber = profileToCreate.enrollmentNumber;
    if (profileToCreate.college) cleanProfileData.college = profileToCreate.college;
    if (profileToCreate.instituteName) cleanProfileData.instituteName = profileToCreate.instituteName;
  } else {
    cleanProfileData.applicantCategory = profileToCreate.applicantCategory;
    cleanProfileData.currentStage = profileToCreate.currentStage;
    cleanProfileData.startupTitle = profileToCreate.startupTitle;
    cleanProfileData.problemDefinition = profileToCreate.problemDefinition;
    cleanProfileData.solutionDescription = profileToCreate.solutionDescription;
    cleanProfileData.uniqueness = profileToCreate.uniqueness;
    cleanProfileData.teamMembers = profileToCreate.teamMembers;
    if (profileToCreate.enrollmentNumber) cleanProfileData.enrollmentNumber = profileToCreate.enrollmentNumber;
    if (profileToCreate.college) cleanProfileData.college = profileToCreate.college;
    if (profileToCreate.instituteName) cleanProfileData.instituteName = profileToCreate.instituteName;
  }
  
  const finalProfileToSet = Object.fromEntries(
    Object.entries(cleanProfileData).filter(([, value]) => value !== undefined)
  );

  await setDoc(userProfileRef, finalProfileToSet);

  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    const rawData = docSnap.data();
    return {
        uid: docSnap.id,
        email: rawData.email ?? null,
        displayName: rawData.displayName ?? null,
        photoURL: rawData.photoURL ?? null,
        role: rawData.role ?? null,
        fullName: rawData.fullName ?? '',
        contactNumber: rawData.contactNumber ?? '',
        applicantCategory: rawData.applicantCategory,
        currentStage: rawData.currentStage,
        startupTitle: rawData.startupTitle ?? '',
        problemDefinition: rawData.problemDefinition ?? '',
        solutionDescription: rawData.solutionDescription ?? '',
        uniqueness: rawData.uniqueness ?? '',
        teamMembers: rawData.teamMembers ?? '',
        enrollmentNumber: rawData.enrollmentNumber,
        college: rawData.college,
        instituteName: rawData.instituteName,
        createdAt: rawData.createdAt,
        updatedAt: rawData.updatedAt,
        isSuperAdmin: rawData.email === 'pranavrathi07@gmail.com' ? true : (rawData.isSuperAdmin === true),
        isTeamMemberOnly: rawData.isTeamMemberOnly ?? false,
        associatedIdeaId: rawData.associatedIdeaId,
        associatedTeamLeaderUid: rawData.associatedTeamLeaderUid,
    } as UserProfile;
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

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>): Promise<void> => {
  const userProfileRef = doc(db, 'users', userId);
  // Ensure sensitive fields like email, uid, createdAt are not in `data` or are handled by security rules
  const { uid, email, createdAt, role, isSuperAdmin, ...updateData } = data;
  
  const cleanData = Object.fromEntries(Object.entries(updateData).filter(([, value]) => value !== undefined));

  await updateDoc(userProfileRef, {
    ...cleanData,
    updatedAt: serverTimestamp(),
  });
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


export const updateUserRoleAndPermissionsFS = async (userId: string, newRole: Role, newIsSuperAdmin?: boolean): Promise<void> => {
  const userProfileRef = doc(db, 'users', userId);
  const updates: Partial<UserProfile> = {
    role: newRole,
    updatedAt: serverTimestamp(),
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
};

export const deleteUserAccountAndProfile = async (userId: string): Promise<void> => {
  const userProfileRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userProfileRef);

  if (userDocSnap.exists() && userDocSnap.data().email === 'pranavrathi07@gmail.com') {
    throw new Error("The primary super admin's profile and account cannot be deleted through this interface.");
  }

  await deleteDoc(userProfileRef);

  try {
    const deleteAuthUserFn = httpsCallable(firebaseFunctions, 'deleteAuthUserCallable');
    await deleteAuthUserFn({ uid: userId });
  } catch (error) {
    console.error("Error calling Firebase Function to delete auth user:", error);
    throw new Error(`Firestore profile deleted, but an error occurred attempting to delete the Firebase Auth account: ${(error as Error).message}. Please check the Cloud Function logs, or manually delete the auth account if necessary.`);
  }
};


// Announcement Functions
export const createAnnouncement = async (announcementData: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>): Promise<Announcement> => {
  const announcementsCol = collection(db, 'announcements');
  const newAnnouncementPayload = {
    ...announcementData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(announcementsCol, newAnnouncementPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create announcement.");
  return { id: newDocSnap.id, ...newDocSnap.data() } as Announcement;
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

export const updateAnnouncement = async (announcementId: string, data: Partial<Omit<Announcement, 'id'|'createdAt'>>): Promise<void> => {
  const announcementRef = doc(db, 'announcements', announcementId);
  await updateDoc(announcementRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
  const announcementRef = doc(db, 'announcements', announcementId);
  await deleteDoc(announcementRef);
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
  return {
    id: newDocSnap.id,
    ...data,
    structuredTeamMembers: data?.structuredTeamMembers || [],
    teamMemberEmails: data?.teamMemberEmails || [],
   } as IdeaSubmission;
};


export const getAllIdeaSubmissionsWithDetails = async (): Promise<IdeaSubmission[]> => {
  const ideasCol = collection(db, 'ideas');
  const ideasQuery = query(ideasCol, orderBy('submittedAt', 'desc'));
  const ideasSnapshot = await getDocs(ideasQuery);
  const ideaSubmissions: IdeaSubmission[] = [];

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
    const profilePromises = Array.from(applicantIds).map(id => getUserProfile(id));
    const profiles = await Promise.all(profilePromises);
    profiles.forEach((profile, index) => {
      profilesMap.set(Array.from(applicantIds)[index], profile);
    });
  }

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
  newStatus: IdeaStatus,
  newPhase: ProgramPhase | null = null,
  remarks?: string,
  adminUid?: string,
  nextPhaseDetails?: {
    date: Timestamp | null;
    startTime: string | null;
    endTime: string | null;
    venue: string | null;
    guidelines: string | null;
  }
): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
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
    } else if (newPhase !== 'COHORT') { // Don't clear mentor if moving to other phases, only if becoming not-cohort
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
      updates.rejectedByUid = adminUid;
      updates.rejectedAt = serverTimestamp() as Timestamp;
    } else {
      updates.rejectionRemarks = deleteField();
      updates.rejectedByUid = deleteField();
      updates.rejectedAt = deleteField();
    }
  }
  await updateDoc(ideaRef, updates);
};

export const assignMentorToIdea = async (ideaId: string, mentorName: MentorName | null, adminUid: string): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const updates: { mentor?: MentorName | null | typeof deleteField, updatedAt: Timestamp, updatedByMentorAssignerUid: string } = {
    updatedAt: serverTimestamp() as Timestamp,
    updatedByMentorAssignerUid: adminUid,
  };
  if (mentorName === null) {
    updates.mentor = deleteField();
  } else {
    updates.mentor = mentorName;
  }
  await updateDoc(ideaRef, updates);
};


export const submitOrUpdatePhase2Mark = async (
  ideaId: string,
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

  const markData: AdminMark = {
    mark: mark,
    adminDisplayName: adminProfile.displayName || adminProfile.fullName || 'Admin',
    markedAt: serverTimestamp() as Timestamp,
  };

  await updateDoc(ideaRef, {
    [`phase2Marks.${adminProfile.uid}`]: mark !== null ? markData : deleteField(),
    updatedAt: serverTimestamp(),
  });
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

export const deleteIdeaSubmission = async (ideaId: string): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  await deleteDoc(ideaRef);
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

export const addTeamMemberToIdea = async (ideaId: string, newMemberData: Omit<TeamMember, 'id'>): Promise<void> => {
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
    id: nanoid(), // Generate unique nanoid for this member entry initially
  };

  await updateDoc(ideaRef, {
    structuredTeamMembers: arrayUnion(newMemberWithId),
    teamMemberEmails: arrayUnion(newMemberWithId.email.toLowerCase()),
    updatedAt: serverTimestamp(),
  });
};

export const updateTeamMemberInIdea = async (ideaId: string, updatedMemberData: TeamMember): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  const ideaDoc = await getDoc(ideaRef);

  if (!ideaDoc.exists()) {
    throw new Error("Idea not found.");
  }

  const currentMembers = (ideaDoc.data()?.structuredTeamMembers as TeamMember[] || []);
  const memberIndex = currentMembers.findIndex(member => member.id === updatedMemberData.id || member.email.toLowerCase() === updatedMemberData.email.toLowerCase());


  if (memberIndex === -1) {
    // If not found by ID, try to find by email for cases where ID might not be synced yet (before member profile setup)
    const emailIndex = currentMembers.findIndex(member => member.email.toLowerCase() === updatedMemberData.email.toLowerCase());
    if (emailIndex === -1) {
      throw new Error(`Team member with ID ${updatedMemberData.id} or email ${updatedMemberData.email} not found to update.`);
    }
     // If found by email, use that index and ensure the ID from the form (which might be the user's UID) is used
    currentMembers[emailIndex] = { ...updatedMemberData, id: updatedMemberData.id || currentMembers[emailIndex].id };
  } else {
     currentMembers[memberIndex] = updatedMemberData;
  }


  const oldEmail = currentMembers[memberIndex].email.toLowerCase();
  const newEmail = updatedMemberData.email.toLowerCase();

  const updatedMembersArray = [...currentMembers];
  updatedMembersArray[memberIndex] = updatedMemberData;

  const updates: any = {
    structuredTeamMembers: updatedMembersArray,
    updatedAt: serverTimestamp(),
  };

  if (oldEmail !== newEmail || !(ideaDoc.data()?.teamMemberEmails as string[]).includes(newEmail)) {
    const newTeamMemberEmails = updatedMembersArray.map(m => m.email.toLowerCase());
    updates.teamMemberEmails = newTeamMemberEmails;
  }

  await updateDoc(ideaRef, updates);
};

export const updateTeamMemberDetailsInIdeaAfterProfileSetup = async (
  ideaId: string,
  memberUser: User, 
  memberProfileDataFromForm: { 
    fullName: string;
    contactNumber: string;
    enrollmentNumber?: string;
    college?: string;
    instituteName?: string;
  }
): Promise<void> => {
  if (!memberUser.email) {
    throw new Error("Team member email is missing.");
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
    // Match by email initially, as the ID in structuredTeamMembers might be a nanoid before profile setup
    if (member.email.toLowerCase() === memberUser.email!.toLowerCase()) {
      memberUpdated = true;
      return {
        ...member, 
        id: memberUser.uid, // CRITICAL: Update ID to the member's actual Firebase UID
        name: memberProfileDataFromForm.fullName,
        phone: memberProfileDataFromForm.contactNumber,
        enrollmentNumber: memberProfileDataFromForm.enrollmentNumber || member.enrollmentNumber || '',
        college: memberProfileDataFromForm.college || member.college || '',
        institute: memberProfileDataFromForm.instituteName || member.institute || '', 
        // department: member.department // Keep existing department or clear if not in form
      };
    }
    return member;
  });

  if (!memberUpdated) {
    console.warn(`Team member with email ${memberUser.email} not found in idea ${ideaId} during profile setup update. This should ideally not happen if member was added correctly.`);
    return;
  }

  await updateDoc(ideaRef, {
    structuredTeamMembers: updatedMembersArray,
    // teamMemberEmails should already contain the email, so no change needed here unless email itself was editable (which it's not here)
    updatedAt: serverTimestamp(),
  });
};


export const removeTeamMemberFromIdea = async (ideaId: string, memberIdToRemove: string): Promise<void> => {
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
    createdAt: serverTimestamp(),
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

export const updateSystemSettings = async (settingsData: Partial<Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedByUid'>>, adminUid: string): Promise<void> => {
  const settingsRef = doc(db, 'systemSettings', SYSTEM_SETTINGS_DOC_ID);
  try {
    await setDoc(settingsRef, {
      ...settingsData,
      updatedAt: serverTimestamp(),
      updatedByUid: adminUid,
    }, { merge: true });
  } catch (error) {
    console.error("Error updating system settings:", error);
    throw error;
  }
};

export const createIdeaSubmission = async (ideaData: Omit<IdeaSubmission, 'id' | 'submittedAt' | 'updatedAt' | 'status' | 'programPhase' | 'phase2Marks' | 'rejectionRemarks' | 'rejectedByUid' | 'rejectedAt' | 'phase2PptUrl' | 'phase2PptFileName' | 'phase2PptUploadedAt' | 'nextPhaseDate' | 'nextPhaseStartTime' | 'nextPhaseEndTime' | 'nextPhaseVenue' | 'nextPhaseGuidelines' | 'teamMembers' | 'structuredTeamMembers' | 'teamMemberEmails'| 'mentor'> & { teamMembers?: string, structuredTeamMembers?: TeamMember[], teamMemberEmails?: string[] }): Promise<IdeaSubmission> => {
  const ideaCol = collection(db, 'ideas');
  const newIdeaPayload = {
    ...ideaData,
    status: 'SUBMITTED',
    programPhase: null,
    phase2Marks: {},
    teamMembers: ideaData.teamMembers || '',
    structuredTeamMembers: ideaData.structuredTeamMembers || [],
    teamMemberEmails: ideaData.teamMemberEmails || [], 
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as const;
  const docRef = await addDoc(ideaCol, newIdeaPayload);
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Could not create idea submission.");
   const data = newDocSnap.data();
  return {
    id: newDocSnap.id,
    ...data,
    structuredTeamMembers: data?.structuredTeamMembers || [],
    teamMemberEmails: data?.teamMemberEmails || [],
   } as IdeaSubmission;
};

export const updateIdeaPhase2PptDetails = async (ideaId: string, fileUrl: string, fileName: string): Promise<void> => {
  const ideaRef = doc(db, 'ideas', ideaId);
  await updateDoc(ideaRef, {
    phase2PptUrl: fileUrl,
    phase2PptFileName: fileName,
    phase2PptUploadedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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

    

    