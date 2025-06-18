
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    getAllIdeaSubmissionsWithDetails,
    updateIdeaStatusAndPhase,
    deleteIdeaSubmission as deleteIdeaSubmissionFS,
    submitOrUpdatePhase2Mark,
    assignMentorToIdea as assignMentorFS
} from '@/lib/firebase/firestore';
import type { IdeaSubmission, IdeaStatus, ProgramPhase, UserProfile, AdminMark, TeamMember, MentorName } from '@/types';
import { AVAILABLE_MENTORS } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, Eye, Info, Download, Trash2, ChevronsRight, Star, UserCheck, MessageSquareWarning, CalendarIcon, ClockIcon, Users as UsersIconLucide, Award } from 'lucide-react';
import { format, formatISO, isValid } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';


const ideaStatuses: IdeaStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'IN_EVALUATION', 'SELECTED', 'NOT_SELECTED'];
const programPhases: ProgramPhase[] = ['PHASE_1', 'PHASE_2', 'COHORT'];
const NO_PHASE_VALUE = "NO_PHASE_ASSIGNED";
const UNASSIGN_MENTOR_TRIGGER_VALUE = "__UNASSIGN_MENTOR__"; // Unique value for unassigning

const getProgramPhaseLabel = (phase: ProgramPhase | typeof NO_PHASE_VALUE | null | undefined): string => {
  if (!phase || phase === NO_PHASE_VALUE) return 'N/A';
  switch (phase) {
    case 'PHASE_1': return 'Phase 1';
    case 'PHASE_2': return 'Phase 2';
    case 'COHORT': return 'Cohort';
    default: return 'N/A';
  }
};

interface PhaseDetailsFormData {
    date: Date | null;
    startTime: string;
    endTime: string;
    venue: string;
    guidelines: string;
}

export default function ViewApplicationsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [applications, setApplications] = useState<IdeaSubmission[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<IdeaSubmission | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<IdeaSubmission | null>(null);
  const [currentAdminMark, setCurrentAdminMark] = useState<string>('');
  const [isSavingMark, setIsSavingMark] = useState(false);
  const [isAssigningMentor, setIsAssigningMentor] = useState(false);

  const [isRejectionDialogVisible, setIsRejectionDialogVisible] = useState(false);
  const [currentIdeaForRejection, setCurrentIdeaForRejection] = useState<IdeaSubmission | null>(null);
  const [rejectionRemarksInput, setRejectionRemarksInput] = useState('');

  const [isPhaseDetailsDialogVisible, setIsPhaseDetailsDialogVisible] = useState(false);
  const [currentIdeaForPhaseDetails, setCurrentIdeaForPhaseDetails] = useState<IdeaSubmission | null>(null);
  const [currentPhaseForDialog, setCurrentPhaseForDialog] = useState<ProgramPhase | null>(null);
  const [phaseDetailsForm, setPhaseDetailsForm] = useState<PhaseDetailsFormData>({
    date: null,
    startTime: '',
    endTime: '',
    venue: '',
    guidelines: '',
  });


  useEffect(() => {
    if (initialLoadComplete && !authLoading) {
      if (!userProfile) {
        router.push('/login');
        return;
      }
      if (userProfile.role !== 'ADMIN_FACULTY') {
        toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" });
        router.push('/dashboard');
      } else {
        fetchApplications();
      }
    }
  }, [userProfile, authLoading, initialLoadComplete, router, toast]);

  useEffect(() => {
    if (selectedApplication && userProfile && selectedApplication.programPhase === 'PHASE_2') {
      const markEntry = selectedApplication.phase2Marks?.[userProfile.uid];
      setCurrentAdminMark(markEntry?.mark?.toString() || '');
    } else {
      setCurrentAdminMark('');
    }
  }, [selectedApplication, userProfile]);

  useEffect(() => {
    if (isDetailModalOpen && selectedApplication?.id) {
        const updatedVersionInList = applications.find(app => app.id === selectedApplication.id);
        if (updatedVersionInList) {
            const hasChanged = 
                updatedVersionInList.programPhase !== selectedApplication.programPhase ||
                updatedVersionInList.status !== selectedApplication.status ||
                updatedVersionInList.mentor !== selectedApplication.mentor ||
                (updatedVersionInList.phase2Marks && selectedApplication.phase2Marks && JSON.stringify(updatedVersionInList.phase2Marks) !== JSON.stringify(selectedApplication.phase2Marks)) ||
                (updatedVersionInList.updatedAt && selectedApplication.updatedAt && updatedVersionInList.updatedAt.toMillis() !== selectedApplication.updatedAt.toMillis());

            if (hasChanged) {
                setSelectedApplication(updatedVersionInList);
            }
        } else {
            // The selected application is no longer in the list, e.g., it was deleted.
            setIsDetailModalOpen(false);
            setSelectedApplication(null);
        }
    }
  }, [applications, isDetailModalOpen, selectedApplication]);


  const fetchApplications = async () => {
    setLoadingApplications(true);
    try {
      const fetchedApplications = await getAllIdeaSubmissionsWithDetails();
      setApplications(fetchedApplications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast({ title: "Error", description: "Could not fetch incubation applications.", variant: "destructive" });
    } finally {
      setLoadingApplications(false);
    }
  };

  const getDefaultPhaseDetails = (phase: ProgramPhase): Partial<PhaseDetailsFormData> => {
    switch (phase) {
        case 'PHASE_1':
            return {
                venue: 'PIERC Office, BBA Building, Ground Floor',
                guidelines: 'Each team will have 5 minutes for verbal discussion followed by 2 minutes for questions by the jury members.\nNo PPT or presentation is required for this phase.',
                startTime: '10:00',
                endTime: '12:00',
            };
        case 'PHASE_2':
            return {
                venue: 'PIERC Presentation Hall (To be confirmed by Admin)',
                guidelines: 'Please prepare a presentation (PPT recommended).\nEach team will have approximately [X] minutes for presentation and [Y] minutes for Q&A.\nFurther details will be confirmed by PIERC Admin.',
                startTime: '10:00',
                endTime: '13:00',
            };
        case 'COHORT':
            return {
                venue: 'Founders Studio, BBA Building, Parul University, Vadodara Campus',
                guidelines: 'Welcome to the PIERC Incubation Cohort!\nThe induction session will cover the program structure and next steps.\nPlease bring your laptops.',
                startTime: '14:00',
                endTime: '16:00',
            };
        default:
            return {};
    }
  };

  const openPhaseDetailsDialog = (idea: IdeaSubmission, phase: ProgramPhase) => {
    setCurrentIdeaForPhaseDetails(idea);
    setCurrentPhaseForDialog(phase);
    const defaults = getDefaultPhaseDetails(phase);
    setPhaseDetailsForm({
        date: idea.nextPhaseDate?.toDate() || null,
        startTime: idea.nextPhaseStartTime || defaults.startTime || '',
        endTime: idea.nextPhaseEndTime || defaults.endTime || '',
        venue: idea.nextPhaseVenue || defaults.venue || '',
        guidelines: idea.nextPhaseGuidelines || defaults.guidelines || '',
    });
    setIsPhaseDetailsDialogVisible(true);
  };

  const handleStatusOrPhaseChange = async (
    idea: IdeaSubmission,
    newStatus: IdeaStatus,
    newPhaseInputValue: ProgramPhase | typeof NO_PHASE_VALUE | null = null
  ) => {
    if (!userProfile) {
        toast({ title: "Error", description: "Admin profile not found.", variant: "destructive" });
        return;
    }

    let actualNewPhase: ProgramPhase | null = null;
    if (newPhaseInputValue && newPhaseInputValue !== NO_PHASE_VALUE) {
        actualNewPhase = newPhaseInputValue as ProgramPhase;
    }

    // Optimistically update local state for select dropdowns before opening dialogs
    const updatedApplications = applications.map(app =>
        app.id === idea.id ? {...app, status: newStatus, programPhase: actualNewPhase } : app
    );
    setApplications(updatedApplications);


    if (newStatus === 'SELECTED' && actualNewPhase) {
        openPhaseDetailsDialog(idea, actualNewPhase);
        // No immediate return, allow optimistic update to reflect, then dialog handles final save.
    } else if (newStatus === 'NOT_SELECTED') {
        setCurrentIdeaForRejection(idea);
        setRejectionRemarksInput(idea.rejectionRemarks || '');
        setIsRejectionDialogVisible(true);
        // No immediate return, allow optimistic update, dialog handles final save.
    } else {
        // For other status changes that don't open a dialog (e.g., to UNDER_REVIEW)
        try {
          await updateIdeaStatusAndPhase(idea.id!, idea.title, newStatus, userProfile, actualNewPhase, undefined);
          toast({ title: "Update Successful", description: `Application updated.` });
          fetchApplications(); // Re-fetch to confirm and get latest timestamps
        } catch (error) {
          console.error("Error updating status/phase:", error);
          toast({ title: "Update Error", description: "Could not update application.", variant: "destructive" });
          fetchApplications(); // Revert optimistic update by re-fetching
        }
    }
  };

  const handleSubmitPhaseDetails = async () => {
    if (!currentIdeaForPhaseDetails || !currentPhaseForDialog || !userProfile) return;
    if (!phaseDetailsForm.date || !phaseDetailsForm.startTime || !phaseDetailsForm.endTime || !phaseDetailsForm.venue.trim() || !phaseDetailsForm.guidelines.trim()) {
        toast({ title: "Missing Information", description: "Please fill in all date, time, venue, and guideline fields.", variant: "destructive" });
        return;
    }

    try {
        await updateIdeaStatusAndPhase(
            currentIdeaForPhaseDetails.id!,
            currentIdeaForPhaseDetails.title,
            'SELECTED',
            userProfile,
            currentPhaseForDialog,
            undefined,
            {
                date: Timestamp.fromDate(phaseDetailsForm.date),
                startTime: phaseDetailsForm.startTime,
                endTime: phaseDetailsForm.endTime,
                venue: phaseDetailsForm.venue,
                guidelines: phaseDetailsForm.guidelines,
            }
        );
        toast({ title: "Phase Details Saved", description: `${getProgramPhaseLabel(currentPhaseForDialog)} details saved.` });
        fetchApplications();
        setIsPhaseDetailsDialogVisible(false);
        setCurrentIdeaForPhaseDetails(null);
        setCurrentPhaseForDialog(null);
    } catch (error) {
        console.error("Error saving phase details:", error);
        toast({ title: "Save Error", description: "Could not save phase details.", variant: "destructive" });
        fetchApplications(); // Revert optimistic updates if save fails
    }
  };


  const handleSubmitRejection = async () => {
    if (!currentIdeaForRejection || !userProfile) return;
    if (!rejectionRemarksInput.trim()) {
        toast({ title: "Remarks Required", description: "Please provide rejection remarks or guidance.", variant: "destructive" });
        return;
    }
    try {
        await updateIdeaStatusAndPhase(
            currentIdeaForRejection.id!,
            currentIdeaForRejection.title,
            'NOT_SELECTED',
            userProfile,
            null,
            rejectionRemarksInput
        );
        toast({ title: "Rejection Submitted", description: "Rejection remarks saved." });
        fetchApplications();
        setIsRejectionDialogVisible(false);
        setCurrentIdeaForRejection(null);
        setRejectionRemarksInput('');
    } catch (error) {
        console.error("Error submitting rejection:", error);
        toast({ title: "Rejection Error", description: "Could not submit rejection.", variant: "destructive" });
        fetchApplications(); // Revert optimistic updates if save fails
    }
  };


  const handleDeleteIdea = async (ideaId: string) => {
    if (!userProfile) {
        toast({ title: "Authentication Error", description: "Admin profile not found.", variant: "destructive" });
        return;
    }
    try {
      await deleteIdeaSubmissionFS(ideaId, userProfile);
      toast({ title: "Idea Deleted", description: "The idea submission has been successfully deleted." });
      fetchApplications();
    } catch (error) {
      console.error("Error deleting idea:", error);
      toast({ title: "Delete Error", description: "Could not delete the idea submission.", variant: "destructive" });
    }
    setApplicationToDelete(null);
  };

  const handleSaveMark = async () => {
    if (!selectedApplication || !selectedApplication.id || !userProfile) return;
    if (selectedApplication.programPhase !== 'PHASE_2') {
        toast({ title: "Marking Not Allowed", description: "Marks can only be submitted for ideas in Phase 2.", variant: "destructive" });
        return;
    }

    const markValue = currentAdminMark === '' ? null : parseInt(currentAdminMark, 10);
    if (markValue !== null && (isNaN(markValue) || markValue < 0 || markValue > 100)) {
        toast({ title: "Invalid Mark", description: "Mark must be a number between 0 and 100, or empty to clear.", variant: "destructive" });
        return;
    }

    setIsSavingMark(true);
    try {
        await submitOrUpdatePhase2Mark(selectedApplication.id, selectedApplication.title, userProfile, markValue);
        toast({ title: "Mark Saved", description: "Your mark has been successfully submitted." });

        // No need to re-fetch all applications here, the useEffect will update selectedApplication
        // if 'applications' list is a dependency, or simply update selectedApplication directly:
        const updatedMarks = {
            ...(selectedApplication.phase2Marks || {}),
            [userProfile.uid]: {
                mark: markValue,
                adminDisplayName: userProfile.displayName || userProfile.fullName || 'Admin',
                markedAt: Timestamp.now() // Approximate, server will set actual
            }
        };
        if(markValue === null) {
            delete updatedMarks[userProfile.uid];
        }
        
        setSelectedApplication(prev => prev ? {...prev, phase2Marks: updatedMarks, updatedAt: Timestamp.now()} : null);
        // Also update the main list for consistency if other modals might be opened
        setApplications(prevApps => prevApps.map(app => 
            app.id === selectedApplication.id ? {...app, phase2Marks: updatedMarks, updatedAt: Timestamp.now()} : app
        ));


    } catch (error) {
        console.error("Error saving mark:", error);
        toast({ title: "Save Mark Error", description: (error as Error).message || "Could not save your mark.", variant: "destructive" });
    } finally {
        setIsSavingMark(false);
    }
  };

  const handleAssignMentor = async (ideaId: string, ideaTitle: string, mentorName: MentorName | null) => {
    if (!userProfile || !userProfile.isSuperAdmin) {
        toast({title: "Unauthorized", description: "Only Super Admins can assign mentors.", variant: "destructive"});
        return;
    }
    setIsAssigningMentor(true);
    try {
        await assignMentorFS(ideaId, ideaTitle, mentorName, userProfile);
        toast({title: "Mentor Assignment Updated", description: `Mentor ${mentorName ? 'assigned: '+mentorName : 'unassigned'}.`});

        // Update local state immediately
        setSelectedApplication(prev => prev ? {...prev, mentor: mentorName || undefined, updatedAt: Timestamp.now()} : null);
        setApplications(prevApps => prevApps.map(app => 
            app.id === ideaId ? {...app, mentor: mentorName || undefined, updatedAt: Timestamp.now()} : app
        ));

    } catch (error) {
        console.error("Error assigning mentor:", error);
        toast({title: "Mentor Assignment Error", description: (error as Error).message || "Could not update mentor assignment.", variant: "destructive"});
    } finally {
        setIsAssigningMentor(false);
    }
  };


  const getStatusBadgeVariant = (status: IdeaStatus) => {
    switch (status) {
      case 'SELECTED': return 'default';
      case 'SUBMITTED': return 'secondary';
      case 'UNDER_REVIEW': return 'outline';
      case 'IN_EVALUATION': return 'outline';
      case 'NOT_SELECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  const openDetailModal = (application: IdeaSubmission) => {
    setSelectedApplication(application);
    setIsDetailModalOpen(true);
  };

  const formatDate = (dateValue: Date | Timestamp | undefined | null): string => {
    if (!dateValue) return 'N/A';
    let dateToFormat: Date;
    if (typeof (dateValue as Timestamp)?.toDate === 'function') {
      dateToFormat = (dateValue as Timestamp).toDate();
    } else if (dateValue instanceof Date) {
      dateToFormat = dateValue;
    } else {
      return 'Invalid Date';
    }
    if (!isValid(dateToFormat)) return 'Invalid Date';
    return format(dateToFormat, 'MMM d, yyyy, HH:mm');
  };

  const formatDateOnly = (dateValue: Date | Timestamp | undefined | null): string => {
    if (!dateValue) return 'N/A';
    let dateToFormat: Date;
     if (typeof (dateValue as Timestamp)?.toDate === 'function') {
      dateToFormat = (dateValue as Timestamp).toDate();
    } else if (dateValue instanceof Date) {
      dateToFormat = dateValue;
    } else {
      return 'Invalid Date';
    }
    if (!isValid(dateToFormat)) return 'Invalid Date';
    return format(dateToFormat, 'MMM d, yyyy');
  }

  const formatDateISO = (dateValue: Date | Timestamp | undefined | null): string => {
    if (!dateValue) return 'N/A';
    let dateToFormat: Date;
    if (typeof (dateValue as Timestamp)?.toDate === 'function') {
      dateToFormat = (dateValue as Timestamp).toDate();
    } else if (dateValue instanceof Date) {
      dateToFormat = dateValue;
    } else {
      return 'Invalid Date';
    }
    if (!isValid(dateToFormat)) return 'Invalid Date';
    return formatISO(dateToFormat);
  };


  const escapeCsvField = (field: string | number | null | undefined): string => {
    if (field === null || field === undefined) {
      return '';
    }
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  };

  const handleExportCSV = () => {
    if (applications.length === 0) {
      toast({ title: "No Data", description: "There are no applications to export.", variant: "default" });
      return;
    }

    const headers = [
      'ID', 'Title', 'Applicant Name', 'Applicant Email', 'Applicant Category', 'Team Members (Free Text)',
      'Development Stage', 'Problem Definition', 'Solution Description', 'Uniqueness',
      'Status', 'Program Phase', 'Assigned Mentor', 'Rejection Remarks', 'Studio Location',
      'Attachment URL', 'Attachment Name', 'Phase 2 PPT Name', 'Phase 2 PPT URL',
      'Next Phase Date', 'Next Phase Start Time', 'Next Phase End Time', 'Next Phase Venue', 'Next Phase Guidelines',
      'Submitted At', 'Last Updated At',
    ];

    const maxTeamMembers = Math.max(0, ...applications.map(app => app.structuredTeamMembers?.length || 0));
    for (let i = 1; i <= maxTeamMembers; i++) {
        headers.push(
            `Member ${i} Name`, `Member ${i} Email`, `Member ${i} Phone`,
            `Member ${i} Institute`, `Member ${i} Department`, `Member ${i} Enrollment No.`
        );
    }

    const adminMarkAdminUIDs: string[] = [];
    if (userProfile?.role === 'ADMIN_FACULTY' && applications.length > 0 && applications.some(app => app.phase2Marks && Object.keys(app.phase2Marks).length > 0)) {
        const allAdminUIDsInMarks = new Set<string>();
        applications.forEach(app => {
            if (app.phase2Marks) {
                Object.keys(app.phase2Marks).forEach(uid => allAdminUIDsInMarks.add(uid));
            }
        });
        adminMarkAdminUIDs.push(...Array.from(allAdminUIDsInMarks).sort());
        adminMarkAdminUIDs.forEach(uid => {
            let adminDisplayName = `Mark by Admin ${uid.substring(0,5)}...`;
            // Attempt to find a display name for this admin UID from any application
            const adminProfileEntry = applications.find(app => app.phase2Marks?.[uid]?.adminDisplayName);
            if (adminProfileEntry && adminProfileEntry.phase2Marks?.[uid]?.adminDisplayName) {
                 adminDisplayName = `Mark by ${adminProfileEntry.phase2Marks[uid].adminDisplayName}`;
            } else {
                 // Fallback if no display name found for this UID across all marks (less likely with current logic)
                 const profileForUID = applications.find(app => app.userId === uid); // Check if this admin is an applicant
                 if (profileForUID) {
                     adminDisplayName = `Mark by ${profileForUID.applicantDisplayName || `Admin ${uid.substring(0,5)}...`}`;
                 }
            }
            headers.push(adminDisplayName);
        });
    }


    const csvRows = [headers.join(',')];

    applications.forEach(app => {
      const row = [
        escapeCsvField(app.id),
        escapeCsvField(app.title),
        escapeCsvField(app.applicantDisplayName),
        escapeCsvField(app.applicantEmail),
        escapeCsvField(app.applicantType?.replace(/_/g, ' ')),
        escapeCsvField(app.teamMembers),
        escapeCsvField(app.developmentStage.replace(/_/g, ' ')),
        escapeCsvField(app.problem),
        escapeCsvField(app.solution),
        escapeCsvField(app.uniqueness),
        escapeCsvField(app.status.replace(/_/g, ' ')),
        escapeCsvField(app.programPhase ? getProgramPhaseLabel(app.programPhase) : 'N/A'),
        escapeCsvField(app.mentor || 'N/A'),
        escapeCsvField(app.rejectionRemarks),
        escapeCsvField(app.studioLocation),
        escapeCsvField(app.fileURL),
        escapeCsvField(app.fileName),
        escapeCsvField(app.phase2PptFileName),
        escapeCsvField(app.phase2PptUrl),
        escapeCsvField(app.nextPhaseDate ? formatDateOnly(app.nextPhaseDate) : 'N/A'),
        escapeCsvField(app.nextPhaseStartTime),
        escapeCsvField(app.nextPhaseEndTime),
        escapeCsvField(app.nextPhaseVenue),
        escapeCsvField(app.nextPhaseGuidelines),
        escapeCsvField(formatDateISO(app.submittedAt)),
        escapeCsvField(formatDateISO(app.updatedAt)),
      ];

      for (let i = 0; i < maxTeamMembers; i++) {
        const member = app.structuredTeamMembers?.[i];
        row.push(
            escapeCsvField(member?.name),
            escapeCsvField(member?.email),
            escapeCsvField(member?.phone),
            escapeCsvField(member?.institute),
            escapeCsvField(member?.department),
            escapeCsvField(member?.enrollmentNumber)
        );
      }

      if (userProfile?.role === 'ADMIN_FACULTY') {
         adminMarkAdminUIDs.forEach(adminUid => {
            row.push(escapeCsvField(app.phase2Marks?.[adminUid]?.mark ?? 'N/A'));
         });
      }
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `pierc_applications_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Export Successful", description: "Applications CSV has been downloaded." });
    } else {
      toast({ title: "Export Failed", description: "Your browser does not support direct CSV download.", variant: "destructive" });
    }
  };


  if (authLoading || !initialLoadComplete || loadingApplications) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }

  if (!userProfile || userProfile.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Verifying access or redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <FileText className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">View Incubation Applications</h1>
            <p className="text-muted-foreground">Review and manage all submitted ideas and innovations.</p>
          </div>
        </div>
        <Button onClick={handleExportCSV} disabled={applications.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export to CSV
        </Button>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Submitted Applications</CardTitle>
          <CardDescription>
            Set status for applications. If 'Selected', assign a Program Phase & meeting details. If 'Not Selected', provide remarks. For 'Phase 2' ideas, provide marks. For 'COHORT' phase, Super Admins can assign a mentor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No applications found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px] md:min-w-[200px]">Idea Title</TableHead>
                    <TableHead className="hidden md:table-cell">Applicant Name</TableHead>
                    <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                    <TableHead className="min-w-[180px]">Status</TableHead>
                    <TableHead className="min-w-[200px]">Program Phase</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium max-w-[150px] md:max-w-xs truncate" title={app.title}>
                        {app.title}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{app.applicantDisplayName}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDateOnly(app.submittedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={app.status}
                            onValueChange={(value) => handleStatusOrPhaseChange(app, value as IdeaStatus, app.programPhase)}
                          >
                            <SelectTrigger className="w-[150px] h-9 text-xs">
                              <SelectValue placeholder="Set status" />
                            </SelectTrigger>
                            <SelectContent>
                              {ideaStatuses.map(statusVal => (
                                <SelectItem key={statusVal} value={statusVal} className="text-xs">
                                  {statusVal.replace(/_/g, ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                           <Badge variant={getStatusBadgeVariant(app.status)} className="capitalize hidden xl:inline-flex text-xs">
                            {app.status.replace(/_/g, ' ').toLowerCase()}
                          </Badge>
                        </div>
                      </TableCell>
                       <TableCell>
                        {app.status === 'SELECTED' ? (
                          <Select
                            value={app.programPhase || NO_PHASE_VALUE}
                            onValueChange={(value) => handleStatusOrPhaseChange(app, 'SELECTED', value as ProgramPhase | typeof NO_PHASE_VALUE)}
                          >
                            <SelectTrigger className="w-[150px] h-9 text-xs">
                              <SelectValue placeholder="Assign Phase" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_PHASE_VALUE} className="text-xs italic">Not Assigned</SelectItem>
                              {programPhases.map(phaseVal => (
                                <SelectItem key={phaseVal} value={phaseVal} className="text-xs">
                                  {getProgramPhaseLabel(phaseVal)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {app.status === 'NOT_SELECTED' ? 'N/A (Rejected)' : "N/A (Status not 'Selected')"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1 sm:space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openDetailModal(app)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Details
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" onClick={() => setApplicationToDelete(app)}>
                               <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                           {applicationToDelete && applicationToDelete.id === app.id && (
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the idea submission titled "{applicationToDelete.title}".
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setApplicationToDelete(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteIdea(applicationToDelete.id!)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                           )}
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedApplication && userProfile && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl flex items-center">
                <Info className="h-6 w-6 mr-2 text-primary" /> Application Details
              </DialogTitle>
              <DialogDescription>
                Full information for: <span className="font-semibold">{selectedApplication.title}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <h4 className="font-semibold text-muted-foreground">Idea Title</h4>
                  <p>{selectedApplication.title}</p>
                </div>
                 <div>
                  <h4 className="font-semibold text-muted-foreground">Status</h4>
                  <Badge variant={getStatusBadgeVariant(selectedApplication.status)} className="capitalize text-sm">
                      {selectedApplication.status.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </div>
                {selectedApplication.status === 'SELECTED' && (
                    <div>
                        <h4 className="font-semibold text-muted-foreground">Program Phase</h4>
                        <p>{getProgramPhaseLabel(selectedApplication.programPhase)}</p>
                    </div>
                )}
                <div>
                  <h4 className="font-semibold text-muted-foreground">Applicant Name</h4>
                  <p>{selectedApplication.applicantDisplayName || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Applicant Email</h4>
                  <p>{selectedApplication.applicantEmail || 'N/A'}</p>
                </div>
                 <div>
                  <h4 className="font-semibold text-muted-foreground">Applicant Category</h4>
                  <p>{selectedApplication.applicantType?.replace(/_/g, ' ') || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Development Stage</h4>
                  <p>{selectedApplication.developmentStage.replace(/_/g, ' ') || 'N/A'}</p>
                </div>
                <div>
                    <h4 className="font-semibold text-muted-foreground flex items-center"><UsersIconLucide className="h-4 w-4 mr-1.5"/> Team Members (Initial Description)</h4>
                    <p className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md text-sm">
                        {selectedApplication.teamMembers || 'N/A (No team members described initially or Solo innovator)'}
                    </p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Submitted At</h4>
                   <p>{formatDate(selectedApplication.submittedAt)}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Last Updated At</h4>
                  <p>{formatDate(selectedApplication.updatedAt)}</p>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div>
                  <h4 className="font-semibold text-muted-foreground">Problem Definition</h4>
                  <p className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{selectedApplication.problem}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Proposed Solution</h4>
                  <p className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{selectedApplication.solution}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Uniqueness/Distinctiveness</h4>
                  <p className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{selectedApplication.uniqueness}</p>
                </div>
                 {selectedApplication.fileURL && (
                    <div>
                        <h4 className="font-semibold text-muted-foreground">Attachment (Pitch Deck)</h4>
                        <a href={selectedApplication.fileURL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {selectedApplication.fileName || 'View Attachment'}
                        </a>
                    </div>
                )}
                {selectedApplication.studioLocation && (
                    <div>
                        <h4 className="font-semibold text-muted-foreground">Preferred Studio Location</h4>
                        <p>{selectedApplication.studioLocation}</p>
                    </div>
                )}
                {selectedApplication.status === 'NOT_SELECTED' && selectedApplication.rejectionRemarks && (
                    <div>
                        <h4 className="font-semibold text-muted-foreground text-destructive flex items-center"><MessageSquareWarning className="h-4 w-4 mr-1" /> Rejection Remarks & Guidance</h4>
                        <p className="whitespace-pre-wrap bg-destructive/10 p-2 rounded-md text-destructive-foreground/90">{selectedApplication.rejectionRemarks}</p>
                        {selectedApplication.rejectedByUid && <p className="text-xs text-muted-foreground mt-1">By admin: {selectedApplication.rejectedByDisplayName || `UID ${selectedApplication.rejectedByUid.substring(0,5)}...`} on {formatDateOnly(selectedApplication.rejectedAt)}</p>}
                    </div>
                )}
                 {selectedApplication.programPhase === 'PHASE_2' && selectedApplication.phase2PptUrl && (
                    <div>
                        <h4 className="font-semibold text-muted-foreground">Phase 2 Presentation</h4>
                        <a href={selectedApplication.phase2PptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {selectedApplication.phase2PptFileName || 'View Phase 2 Presentation'}
                        </a>
                         {selectedApplication.phase2PptUploadedAt && <p className="text-xs text-muted-foreground mt-1">Uploaded on {formatDateOnly(selectedApplication.phase2PptUploadedAt)}</p>}
                    </div>
                 )}
                 {selectedApplication.status === 'SELECTED' && selectedApplication.programPhase && selectedApplication.nextPhaseDate && (
                    <Card className="mt-3 border-primary/30">
                        <CardHeader className="pb-2 pt-3 px-4">
                            <CardTitle className="text-base font-semibold text-primary flex items-center">
                                <ChevronsRight className="h-5 w-5 mr-2"/> Next Step: {getProgramPhaseLabel(selectedApplication.programPhase)} Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm px-4 pb-3 space-y-1">
                            <p><strong>Date:</strong> {formatDateOnly(selectedApplication.nextPhaseDate)}</p>
                            <p><strong>Time:</strong> {selectedApplication.nextPhaseStartTime} - {selectedApplication.nextPhaseEndTime}</p>
                            <p><strong>Venue:</strong> {selectedApplication.nextPhaseVenue}</p>
                            <p className="font-semibold mt-2">Guidelines:</p>
                            <p className="whitespace-pre-wrap text-xs bg-muted/20 p-2 rounded-md">{selectedApplication.nextPhaseGuidelines}</p>
                        </CardContent>
                    </Card>
                 )}

                {selectedApplication.structuredTeamMembers && selectedApplication.structuredTeamMembers.length > 0 && (
                    <div className="pt-3">
                        <h4 className="font-semibold text-muted-foreground flex items-center mb-2"><UsersIconLucide className="h-5 w-5 mr-2"/> Team Members (Detailed)</h4>
                        <div className="space-y-3">
                        {selectedApplication.structuredTeamMembers.map((member, index) => (
                            <Card key={member.id || index} className="bg-muted/40 p-3 shadow-sm">
                                <CardHeader className="p-0 pb-1">
                                     <CardTitle className="text-sm font-medium">Member {index + 1}: {member.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 text-xs text-foreground/80 space-y-0.5">
                                    <p><strong>Email:</strong> {member.email}</p>
                                    <p><strong>Phone:</strong> {member.phone}</p>
                                    <p><strong>Institute:</strong> {member.institute}</p>
                                    <p><strong>Department:</strong> {member.department}</p>
                                    {member.enrollmentNumber && <p><strong>Enrollment No:</strong> {member.enrollmentNumber}</p>}
                                </CardContent>
                            </Card>
                        ))}
                        </div>
                    </div>
                )}

              </div>

                {selectedApplication.status === 'SELECTED' && selectedApplication.programPhase === 'COHORT' && (
                    <Card className="mt-4 pt-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-headline flex items-center">
                                <Award className="h-5 w-5 mr-2 text-amber-500" /> Mentor Assignment
                            </CardTitle>
                            <CardDescription>Assign or view the mentor for this COHORT idea.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {userProfile.isSuperAdmin ? (
                                <div>
                                    <Label htmlFor="mentorSelect">Assign Mentor</Label>
                                    <Select
                                        value={selectedApplication.mentor || ""}
                                        onValueChange={(value) => handleAssignMentor(selectedApplication.id!, selectedApplication.title, value === UNASSIGN_MENTOR_TRIGGER_VALUE ? null : value as MentorName)}
                                        disabled={isAssigningMentor}
                                    >
                                        <SelectTrigger id="mentorSelect" className="w-full md:w-[250px]">
                                            <SelectValue placeholder="Select a mentor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={UNASSIGN_MENTOR_TRIGGER_VALUE}>Unassign Mentor</SelectItem>
                                            {AVAILABLE_MENTORS.map(mentor => (
                                                <SelectItem key={mentor} value={mentor}>{mentor}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {isAssigningMentor && <LoadingSpinner size={16} className="ml-2 inline-block" />}
                                </div>
                            ) : (
                                <div>
                                    <h4 className="font-semibold text-muted-foreground">Assigned Mentor</h4>
                                    <p>{selectedApplication.mentor || 'Not yet assigned'}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}


              {selectedApplication.programPhase === 'PHASE_2' && (
                <Card className="mt-4 pt-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-headline flex items-center">
                        <Star className="h-5 w-5 mr-2 text-amber-500" /> Phase 2 Presentation Marks
                    </CardTitle>
                    <CardDescription>Marks submitted by administrators for this idea.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(selectedApplication.phase2Marks || {}).map(([adminUid, markEntry]) => {
                      const displayName = markEntry.adminDisplayName || 'Admin';
                      const isCurrentUserMark = adminUid === userProfile.uid;

                      // Show other admins' marks only if current user is SuperAdmin OR it's not the current user's mark
                      // (This logic was a bit complex, let's simplify: SuperAdmins see all. Regular admins only see their own edit field below)
                      if (userProfile.isSuperAdmin && !isCurrentUserMark) {
                        return (
                            <div key={adminUid} className="flex justify-between items-center text-sm p-2 bg-muted/20 rounded-md">
                            <span className="flex items-center">
                                <UserCheck className="h-4 w-4 mr-2 text-muted-foreground" />
                                {displayName}
                            </span>
                            <Badge variant="secondary">{markEntry.mark !== null ? markEntry.mark : 'N/A'}</Badge>
                            </div>
                        );
                      }
                      return null; // Regular admins don't see other admin's marks listed here
                    })}
                    {(() => {
                        const marksObject = selectedApplication.phase2Marks || {};
                        const totalMarksCount = Object.keys(marksObject).length;
                        const currentUserHasMarked = !!marksObject[userProfile.uid];

                        if (userProfile.isSuperAdmin) {
                            if (totalMarksCount === 0) {
                                return <p className="text-sm text-muted-foreground text-center py-2">No marks submitted by any admin yet.</p>;
                            }
                            // SuperAdmins see their own mark in the input field if they've marked.
                            // Other admin marks are listed above if they exist.
                        } else { // Regular Admin
                            if (!currentUserHasMarked && totalMarksCount > 0) {
                                // A regular admin hasn't marked, but others might have (they won't see those marks directly)
                                return <p className="text-sm text-muted-foreground text-center py-2">Other marks may exist. Submit yours below.</p>;
                            }
                            if (totalMarksCount === 0) {
                                 return <p className="text-sm text-muted-foreground text-center py-2">No marks submitted yet. Submit yours below.</p>;
                            }
                        }
                        return null;
                    })()}

                    <div className="pt-3 space-y-2">
                        <Label htmlFor="adminMarkInput" className="font-semibold">
                           Your Mark (0-100):
                        </Label>
                        <div className="flex items-center gap-2">
                        <Input
                            id="adminMarkInput"
                            type="number"
                            min="0"
                            max="100"
                            value={currentAdminMark} // This is already state-managed based on selectedApplication & userProfile.uid
                            onChange={(e) => setCurrentAdminMark(e.target.value)}
                            placeholder="Enter your mark"
                            className="max-w-[150px]"
                            disabled={isSavingMark}
                        />
                        <Button onClick={handleSaveMark} disabled={isSavingMark}>
                            {isSavingMark ? <LoadingSpinner size={16} className="mr-2"/> : null}
                            Save My Mark
                        </Button>
                        </div>
                    </div>
                  </CardContent>
                   <CardFooter>
                        <p className="text-xs text-muted-foreground">Leave the mark empty and save to clear your previously submitted mark.</p>
                   </CardFooter>
                </Card>
              )}
            </div>
             <div className="pt-4 flex justify-end">
                <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isRejectionDialogVisible && currentIdeaForRejection && (
        <Dialog open={isRejectionDialogVisible} onOpenChange={(isOpen) => {
            if(!isOpen) {
                setIsRejectionDialogVisible(false);
                setCurrentIdeaForRejection(null);
                setRejectionRemarksInput('');
                fetchApplications(); // Re-fetch to ensure UI consistency if cancel
            } else {
                setIsRejectionDialogVisible(isOpen);
            }
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center"><MessageSquareWarning className="h-5 w-5 mr-2 text-destructive"/> Provide Rejection Remarks</DialogTitle>
                    <DialogDescription>
                        For idea: <span className="font-semibold">{currentIdeaForRejection.title}</span>.
                        Please provide constructive feedback or reasons for not selecting this idea.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label htmlFor="rejectionRemarks">Remarks/Guidance</Label>
                    <Textarea
                        id="rejectionRemarks"
                        value={rejectionRemarksInput}
                        onChange={(e) => setRejectionRemarksInput(e.target.value)}
                        placeholder="Explain why the idea was not selected and suggest areas for improvement..."
                        rows={5}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => {
                        setIsRejectionDialogVisible(false);
                        setCurrentIdeaForRejection(null);
                        setRejectionRemarksInput('');
                        fetchApplications(); // Re-fetch as the optimistic update might have changed table
                    }}>Cancel</Button>
                    <Button onClick={handleSubmitRejection} className="bg-destructive hover:bg-destructive/90">Submit Rejection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

      {isPhaseDetailsDialogVisible && currentIdeaForPhaseDetails && currentPhaseForDialog && (
        <Dialog open={isPhaseDetailsDialogVisible} onOpenChange={(isOpen) => {
            if (!isOpen) {
                setIsPhaseDetailsDialogVisible(false);
                setCurrentIdeaForPhaseDetails(null);
                setCurrentPhaseForDialog(null);
                fetchApplications(); // Re-fetch to ensure UI consistency if cancel
            } else {
                setIsPhaseDetailsDialogVisible(isOpen);
            }
        }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center">
                        <CalendarIcon className="h-5 w-5 mr-2 text-primary"/> Set Meeting Details for {getProgramPhaseLabel(currentPhaseForDialog)}
                    </DialogTitle>
                    <DialogDescription>
                        Provide date, time, venue, and guidelines for <span className="font-semibold">{currentIdeaForPhaseDetails.title}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div>
                        <Label htmlFor="phaseDate">Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="phaseDate"
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !phaseDetailsForm.date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {phaseDetailsForm.date ? format(phaseDetailsForm.date, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={phaseDetailsForm.date || undefined}
                                    onSelect={(date) => setPhaseDetailsForm(prev => ({...prev, date: date || null}))}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="phaseStartTime">Start Time</Label>
                            <Input
                                id="phaseStartTime"
                                type="time"
                                value={phaseDetailsForm.startTime}
                                onChange={(e) => setPhaseDetailsForm(prev => ({...prev, startTime: e.target.value}))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="phaseEndTime">End Time</Label>
                            <Input
                                id="phaseEndTime"
                                type="time"
                                value={phaseDetailsForm.endTime}
                                onChange={(e) => setPhaseDetailsForm(prev => ({...prev, endTime: e.target.value}))}
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="phaseVenue">Venue</Label>
                        <Input
                            id="phaseVenue"
                            value={phaseDetailsForm.venue}
                            onChange={(e) => setPhaseDetailsForm(prev => ({...prev, venue: e.target.value}))}
                            placeholder="e.g., PIERC Office, BBA Building"
                        />
                    </div>
                    <div>
                        <Label htmlFor="phaseGuidelines">Guidelines</Label>
                        <Textarea
                            id="phaseGuidelines"
                            value={phaseDetailsForm.guidelines}
                            onChange={(e) => setPhaseDetailsForm(prev => ({...prev, guidelines: e.target.value}))}
                            placeholder="Enter guidelines for this phase meeting..."
                            rows={4}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => {
                        setIsPhaseDetailsDialogVisible(false);
                        setCurrentIdeaForPhaseDetails(null);
                        setCurrentPhaseForDialog(null);
                        fetchApplications(); // Re-fetch as the optimistic update might have changed table
                    }}>Cancel</Button>
                    <Button onClick={handleSubmitPhaseDetails}>Save Details</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

    
