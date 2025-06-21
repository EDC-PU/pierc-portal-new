
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    getAllIdeaSubmissionsWithDetails,
    updateIdeaStatusAndPhase,
    archiveIdeaSubmissionForUserRevisionFS,
    submitOrUpdatePhase2Mark,
    assignMentorFS,
    getAllCohortsStream,
    assignIdeaToCohortFS,
    updateIdeaFundingDetailsFS,
    markSanctionAsDisbursedFS,
    reviewSanctionUtilizationFS,
} from '@/lib/firebase/firestore';
import type { IdeaSubmission, IdeaStatus, ProgramPhase, UserProfile, AdminMark, TeamMember, MentorName, Cohort, ApplicantCategory, SanctionApprovalStatus, ExpenseEntry, FundingSource } from '@/types';
import { AVAILABLE_MENTORS_DATA, ALL_IDEA_STATUSES, ALL_PROGRAM_PHASES, ALL_FUNDING_SOURCES } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogModalContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger as AlertDialogButtonTrigger,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, Eye, Info, Download, Trash2, ChevronsRight, Star, UserCheck, MessageSquareWarning, CalendarIcon, ClockIcon, Users as UsersIconLucide, Award, Users2 as GroupIcon, Archive, Search, Filter, ChevronDown, ChevronUp, Layers, CheckSquare, Square, DollarSign, Banknote, CheckCircle2, XCircle, Hourglass, Sparkles } from 'lucide-react';
import { format, formatISO, isValid } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import ReactMarkdown from 'react-markdown';


const NO_PHASE_VALUE = "NO_PHASE_ASSIGNED";
const UNASSIGN_MENTOR_TRIGGER_VALUE = "__UNASSIGN_MENTOR__";
const UNASSIGN_COHORT_TRIGGER_VALUE = "__UNASSIGN_COHORT__";

const ALL_STATUSES_FILTER_VALUE = "_ALL_STATUSES_";
const ALL_PHASES_FILTER_VALUE = "_ALL_PHASES_";
const ALL_COHORTS_FILTER_VALUE = "_ALL_COHORTS_";

const getProgramPhaseLabel = (phase: ProgramPhase | typeof NO_PHASE_VALUE | null | undefined): string => {
  if (!phase || phase === NO_PHASE_VALUE) return 'N/A';
  switch (phase) {
    case 'PHASE_1': return 'Phase 1';
    case 'PHASE_2': return 'Phase 2';
    case 'COHORT': return 'Cohort';
    case 'INCUBATED': return 'Incubated (Funding)';
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

interface FundingDetailsFormData {
    totalFundingAllocated: number | string;
    sanction1Amount: number | string;
    sanction2Amount: number | string;
    fundingSource: FundingSource | '';
}

interface SanctionReviewFormData {
    status: SanctionApprovalStatus;
    remarks: string;
}


type SortableKeys = 'title' | 'applicantDisplayName' | 'submittedAt' | 'status' | 'programPhase' | 'isOutlineAIGenerated';
interface SortConfig {
  key: SortableKeys;
  direction: 'ascending' | 'descending';
}
interface ApplicationFilters {
  searchTerm: string;
  status: IdeaStatus | '';
  programPhase: ProgramPhase | '';
  cohortId: string | '';
}

const MarkdownDisplayComponents = {
  p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
  ul: ({node, ...props}: any) => <ul className="list-disc pl-5 mb-2" {...props} />,
  ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 mb-2" {...props} />,
  li: ({node, ...props}: any) => <li className="mb-1" {...props} />,
  strong: ({node, ...props}: any) => <strong className="font-semibold" {...props} />,
  em: ({node, ...props}: any) => <em className="italic" {...props} />,
};

const fundingSourceLabels: Record<FundingSource, string> = {
  SSIP_PIET: "SSIP PIET",
  SSIP_PARUL_UNIVERSITY: "SSIP Parul University",
  SSIP_PIMSR: "SSIP PIMSR",
  SSIP_PHYSIOTHERAPY: "SSIP PHYSIOTHERAPY",
};

export default function ViewApplicationsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [applications, setApplications] = useState<IdeaSubmission[]>([]);
  const [allCohorts, setAllCohorts] = useState<Cohort[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<IdeaSubmission | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [applicationToArchive, setApplicationToArchive] = useState<IdeaSubmission | null>(null);
  const [currentAdminMark, setCurrentAdminMark] = useState<string>('');
  const [isSavingMark, setIsSavingMark] = useState(false);
  const [isAssigningMentor, setIsAssigningMentor] = useState(false);
  const [isAssigningCohort, setIsAssigningCohort] = useState(false);

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

  const [filters, setFilters] = useState<ApplicationFilters>({
    searchTerm: '',
    status: '',
    programPhase: '',
    cohortId: '',
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'submittedAt', direction: 'descending' });
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [bulkActionTarget, setBulkActionTarget] = useState<string | null>(null);
  const [isFundingFormOpen, setIsFundingFormOpen] = useState(false);
  const [fundingForm, setFundingForm] = useState<FundingDetailsFormData>({
    totalFundingAllocated: '', sanction1Amount: '', sanction2Amount: '', fundingSource: ''
  });
  const [isSanctionReviewFormOpen, setIsSanctionReviewFormOpen] = useState(false);
  const [sanctionToReview, setSanctionToReview] = useState<'SANCTION_1' | 'SANCTION_2' | null>(null);
  const [sanctionReviewForm, setSanctionReviewForm] = useState<SanctionReviewFormData>({ status: 'PENDING', remarks: ''});


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
        fetchCohorts();
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
            const hasRelevantChange =
                updatedVersionInList.programPhase !== selectedApplication.programPhase ||
                updatedVersionInList.status !== selectedApplication.status ||
                updatedVersionInList.mentor !== selectedApplication.mentor ||
                updatedVersionInList.cohortId !== selectedApplication.cohortId ||
                updatedVersionInList.isOutlineAIGenerated !== selectedApplication.isOutlineAIGenerated ||
                JSON.stringify(updatedVersionInList.phase2Marks) !== JSON.stringify(selectedApplication.phase2Marks) ||
                updatedVersionInList.fundingSource !== selectedApplication.fundingSource ||
                updatedVersionInList.totalFundingAllocated !== selectedApplication.totalFundingAllocated ||
                updatedVersionInList.sanction1Amount !== selectedApplication.sanction1Amount ||
                updatedVersionInList.sanction2Amount !== selectedApplication.sanction2Amount ||
                updatedVersionInList.sanction1DisbursedAt?.toMillis() !== selectedApplication.sanction1DisbursedAt?.toMillis() ||
                updatedVersionInList.sanction2DisbursedAt?.toMillis() !== selectedApplication.sanction2DisbursedAt?.toMillis() ||
                updatedVersionInList.sanction1UtilizationStatus !== selectedApplication.sanction1UtilizationStatus ||
                updatedVersionInList.sanction2UtilizationStatus !== selectedApplication.sanction2UtilizationStatus ||
                (updatedVersionInList.updatedAt && selectedApplication.updatedAt && updatedVersionInList.updatedAt.toMillis() !== selectedApplication.updatedAt.toMillis());

            if (hasRelevantChange) {
                setSelectedApplication(updatedVersionInList);
            }
        } else { // Idea might have been removed from the list by a filter or action
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
      setSelectedRowIds(new Set());
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast({ title: "Error", description: "Could not fetch incubation applications.", variant: "destructive" });
    } finally {
      setLoadingApplications(false);
    }
  };

  const fetchCohorts = () => {
    if (userProfile?.role === 'ADMIN_FACULTY') {
      setLoadingCohorts(true);
      const unsubscribe = getAllCohortsStream((fetchedCohorts) => {
        setAllCohorts(fetchedCohorts);
        setLoadingCohorts(false);
      });
      return unsubscribe;
    }
    return () => {};
  };

  const displayedApplications = useMemo(() => {
    let filtered = [...applications];

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(app =>
        app.title.toLowerCase().includes(term) ||
        (app.applicantDisplayName && app.applicantDisplayName.toLowerCase().includes(term))
      );
    }
    if (filters.status && filters.status !== ALL_STATUSES_FILTER_VALUE) {
      filtered = filtered.filter(app => app.status === filters.status);
    }
    if (filters.programPhase && filters.programPhase !== ALL_PHASES_FILTER_VALUE) {
      filtered = filtered.filter(app => app.programPhase === filters.programPhase);
    }
    if (filters.cohortId && filters.cohortId !== ALL_COHORTS_FILTER_VALUE) {
      filtered = filtered.filter(app => app.cohortId === filters.cohortId);
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (aValue instanceof Timestamp && bValue instanceof Timestamp) {
          comparison = aValue.toMillis() - bValue.toMillis();
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
          comparison = (aValue === bValue) ? 0 : (aValue ? -1 : 1); // true before false for descending (AI generated first)
        }
         else {
          const strA = String(aValue).toLowerCase();
          const strB = String(bValue).toLowerCase();
          comparison = strA.localeCompare(strB);
        }
        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return filtered;
  }, [applications, filters, sortConfig]);


  const handleSort = (key: SortableKeys) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  };

  const handleSelectRow = (id: string) => {
    setSelectedRowIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAllRows = () => {
    if (selectedRowIds.size === displayedApplications.length && displayedApplications.length > 0) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(displayedApplications.map(app => app.id!)));
    }
  };

  const handleBulkAction = async (action: 'changeStatus' | 'assignCohort' | 'archive', targetValue?: string | null) => {
    if (!userProfile || selectedRowIds.size === 0) {
      toast({ title: "No Selection", description: "Please select applications to perform bulk action.", variant: "default" });
      return;
    }
    setIsBulkActionLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const ideaId of Array.from(selectedRowIds)) {
      const idea = applications.find(app => app.id === ideaId);
      if (!idea) continue;

      try {
        if (action === 'changeStatus' && targetValue) {
          await updateIdeaStatusAndPhase(idea.id!, idea.title, targetValue as IdeaStatus, userProfile, idea.programPhase);
        } else if (action === 'assignCohort') {
          if (!userProfile.isSuperAdmin) {
             toast({ title: "Unauthorized", description: "Only Super Admins can assign ideas to cohorts.", variant: "destructive" });
             errorCount++;
             continue;
          }
          await assignIdeaToCohortFS(idea.id!, idea.title, targetValue === 'UNASSIGN' ? null : targetValue, userProfile);
        } else if (action === 'archive') {
          await archiveIdeaSubmissionForUserRevisionFS(idea.id!, userProfile);
        }
        successCount++;
      } catch (error: any) {
        errorCount++;
        toast({ title: `Error with ${idea.title}`, description: error.message || "Bulk action failed for this item.", variant: "destructive" });
      }
    }
    setIsBulkActionLoading(false);
    fetchApplications();
    setSelectedRowIds(new Set());
    toast({
      title: "Bulk Action Complete",
      description: `${successCount} application(s) processed successfully. ${errorCount > 0 ? `${errorCount} failed.` : ''}`
    });
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
                guidelines: 'Details for the cohort program will be shared upon official assignment.',
                startTime: 'N/A',
                endTime: 'N/A',
            };
        case 'INCUBATED':
             return {
                venue: 'PIERC Office / Remote Coordination',
                guidelines: 'Funding disbursement and milestone tracking will be managed through the portal and direct communication.',
                startTime: 'N/A',
                endTime: 'N/A',
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

    if (newStatus === 'SELECTED') {
        if (actualNewPhase === 'PHASE_1' || actualNewPhase === 'PHASE_2') {
            openPhaseDetailsDialog(idea, actualNewPhase);
        } else if (actualNewPhase === 'INCUBATED') {
            try {
                await updateIdeaStatusAndPhase(idea.id!, idea.title, newStatus, userProfile, actualNewPhase, undefined, undefined);
                toast({ title: "Update Successful", description: `Application moved to ${getProgramPhaseLabel(actualNewPhase)}.` });

                const updatedApps = await getAllIdeaSubmissionsWithDetails();
                setApplications(updatedApps);

                const freshlyFetchedIdea = updatedApps.find(app => app.id === idea.id);
                setSelectedApplication(freshlyFetchedIdea || idea); // Update selectedApplication with fresh data or fallback

                setFundingForm({
                    totalFundingAllocated: freshlyFetchedIdea?.totalFundingAllocated || idea.totalFundingAllocated || '',
                    sanction1Amount: freshlyFetchedIdea?.sanction1Amount || idea.sanction1Amount || '',
                    sanction2Amount: freshlyFetchedIdea?.sanction2Amount || idea.sanction2Amount || '',
                    fundingSource: freshlyFetchedIdea?.fundingSource || idea.fundingSource || '',
                });
                setIsFundingFormOpen(true);

            } catch (error) {
                console.error("Error updating status/phase to INCUBATED:", error);
                toast({ title: "Update Error", description: "Could not update application to Incubated.", variant: "destructive" });
                fetchApplications();
            }
        } else if (actualNewPhase === 'COHORT') {
            try {
                await updateIdeaStatusAndPhase(idea.id!, idea.title, newStatus, userProfile, actualNewPhase, undefined, undefined);
                toast({ title: "Update Successful", description: `Application moved to ${getProgramPhaseLabel(actualNewPhase)}.` });
                fetchApplications();
            } catch (error) {
                console.error("Error updating status/phase to COHORT:", error);
                toast({ title: "Update Error", description: "Could not update application to Cohort.", variant: "destructive" });
                fetchApplications();
            }
        }
    } else if (newStatus === 'NOT_SELECTED') {
        setCurrentIdeaForRejection(idea);
        setRejectionRemarksInput(idea.rejectionRemarks || '');
        setIsRejectionDialogVisible(true);
    } else {
        try {
          await updateIdeaStatusAndPhase(idea.id!, idea.title, newStatus, userProfile, actualNewPhase, undefined, undefined);
          toast({ title: "Update Successful", description: `Application updated.` });
          fetchApplications();
        } catch (error) {
          console.error("Error updating status/phase:", error);
          toast({ title: "Update Error", description: "Could not update application.", variant: "destructive" });
          fetchApplications();
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
        fetchApplications();
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
        fetchApplications();
    }
  };


  const handleArchiveIdea = async (ideaId: string) => {
    if (!userProfile) {
        toast({ title: "Authentication Error", description: "Admin profile not found.", variant: "destructive" });
        return;
    }
    try {
      await archiveIdeaSubmissionForUserRevisionFS(ideaId, userProfile);
      toast({ title: "Idea Archived", description: "The idea submission has been archived for user revision." });
      fetchApplications();
    } catch (error) {
      console.error("Error archiving idea:", error);
      toast({ title: "Archive Error", description: "Could not archive the idea submission.", variant: "destructive" });
    }
    setApplicationToArchive(null);
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

        const updatedMarks = {
            ...(selectedApplication.phase2Marks || {}),
            [userProfile.uid]: {
                mark: markValue,
                adminDisplayName: userProfile.displayName || userProfile.fullName || 'Admin',
                markedAt: Timestamp.now()
            }
        };
        if(markValue === null) {
            delete updatedMarks[userProfile.uid];
        }

        setSelectedApplication(prev => prev ? {...prev, phase2Marks: updatedMarks, updatedAt: Timestamp.now()} : null);
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

  const handleAssignCohort = async (idea: IdeaSubmission, newCohortId: string | null) => {
    if (!userProfile || !userProfile.isSuperAdmin) {
        toast({ title: "Unauthorized", description: "Only Super Admins can assign ideas to cohorts.", variant: "destructive" });
        return;
    }
    setIsAssigningCohort(true);
    try {
      await assignIdeaToCohortFS(idea.id!, idea.title, newCohortId, userProfile);
      toast({ title: "Cohort Assignment Updated", description: `Idea "${idea.title}" ${newCohortId ? 'assigned to cohort' : 'unassigned from cohort'}.` });
      fetchApplications();
    } catch (error: any) {
      console.error("Error assigning idea to cohort:", error);
      toast({ title: "Cohort Assignment Error", description: error.message || "Could not update cohort assignment.", variant: "destructive" });
      fetchApplications();
    } finally {
      setIsAssigningCohort(false);
    }
  };

  const handleSaveFundingDetails = async () => {
    if (!selectedApplication || !selectedApplication.id || !userProfile || !userProfile.isSuperAdmin) {
        toast({ title: "Error", description: "Context missing or unauthorized.", variant: "destructive" });
        return;
    }
    const total = parseFloat(String(fundingForm.totalFundingAllocated));
    const s1 = parseFloat(String(fundingForm.sanction1Amount));
    const s2 = parseFloat(String(fundingForm.sanction2Amount));
    const source = fundingForm.fundingSource || null;

    if (isNaN(total) || isNaN(s1) || isNaN(s2) || total <= 0 || s1 <= 0 || s2 <= 0) {
        toast({ title: "Invalid Amounts", description: "All funding amounts must be positive numbers.", variant: "destructive" });
        return;
    }
    if (s1 + s2 !== total) {
        toast({ title: "Amount Mismatch", description: "Sanction 1 and Sanction 2 amounts must sum up to the Total Funding Allocated.", variant: "destructive" });
        return;
    }
    if (!source) {
        toast({ title: "Funding Source Required", description: "Please select a funding source.", variant: "destructive" });
        return;
    }

    try {
        await updateIdeaFundingDetailsFS(selectedApplication.id, selectedApplication.title, {
            totalFundingAllocated: total,
            sanction1Amount: s1,
            sanction2Amount: s2,
            fundingSource: source
        }, userProfile);
        toast({ title: "Funding Details Saved", description: "Funding allocation has been updated."});
        fetchApplications();
        setIsFundingFormOpen(false);
    } catch (error: any) {
        toast({ title: "Save Error", description: error.message || "Could not save funding details.", variant: "destructive" });
    }
  };

  const handleDisburseSanction = async (sanctionNumber: 1 | 2) => {
    if (!selectedApplication || !selectedApplication.id || !userProfile || !userProfile.isSuperAdmin) return;
    try {
        await markSanctionAsDisbursedFS(selectedApplication.id, selectedApplication.title, sanctionNumber, userProfile);
        toast({title: `Sanction ${sanctionNumber} Disbursed`, description: `Marked as disbursed successfully.`});
        fetchApplications();
    } catch (error: any) {
        toast({ title: "Disbursement Error", description: error.message || `Could not mark Sanction ${sanctionNumber} as disbursed.`, variant: "destructive" });
    }
  };

  const openSanctionReviewForm = (sanction: 'SANCTION_1' | 'SANCTION_2') => {
    if (!selectedApplication) return;
    setSanctionToReview(sanction);
    const currentStatus = sanction === 'SANCTION_1' ? selectedApplication.sanction1UtilizationStatus : selectedApplication.sanction2UtilizationStatus;
    const currentRemarks = sanction === 'SANCTION_1' ? selectedApplication.sanction1UtilizationRemarks : selectedApplication.sanction2UtilizationRemarks;
    setSanctionReviewForm({ status: currentStatus || 'PENDING', remarks: currentRemarks || ''});
    setIsSanctionReviewFormOpen(true);
  };

  const handleSaveSanctionReview = async () => {
    if (!selectedApplication || !selectedApplication.id || !userProfile || !userProfile.isSuperAdmin || !sanctionToReview) return;
    if (sanctionReviewForm.status === 'REJECTED' && !sanctionReviewForm.remarks.trim()) {
        toast({ title: "Remarks Required", description: "Please provide remarks if rejecting.", variant: "destructive" });
        return;
    }
    try {
        await reviewSanctionUtilizationFS(
            selectedApplication.id,
            selectedApplication.title,
            sanctionToReview,
            sanctionReviewForm.status,
            sanctionReviewForm.remarks,
            userProfile
        );
        toast({ title: `Sanction ${sanctionToReview === 'SANCTION_1' ? 1 : 2} Review Saved`, description: "Utilization review has been updated."});
        fetchApplications();
        setIsSanctionReviewFormOpen(false);
        setSanctionToReview(null);
    } catch (error: any) {
        toast({ title: "Review Save Error", description: error.message || "Could not save sanction review.", variant: "destructive" });
    }
  };


  const getStatusBadgeVariant = (status: IdeaStatus) => {
    switch (status) {
      case 'SELECTED': return 'default';
      case 'SUBMITTED': return 'secondary';
      case 'UNDER_REVIEW': return 'outline';
      case 'IN_EVALUATION': return 'outline';
      case 'ARCHIVED_BY_ADMIN': return 'outline';
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


  const handleExportXLSX = () => {
    if (applications.length === 0) {
      toast({ title: "No Data", description: "There are no applications to export.", variant: "default" });
      return;
    }

    const sheetTitle = "PIERC Applications Export";
    let headers = [
      'ID', 'Title', 'Applicant Name', 'Applicant Email', 'Applicant Category', 'Team Members (Free Text)',
      'Development Stage', 'Problem Definition', 'Solution Description', 'Uniqueness',
      'Status', 'Program Phase', 'Assigned Mentor', 'Assigned Cohort', 'AI Generated Outline', 'Rejection Remarks', 'Studio Location',
      'Attachment URL', 'Attachment Name', 'Phase 2 PPT Name', 'Phase 2 PPT URL',
      'Next Phase Date', 'Next Phase Start Time', 'Next Phase End Time', 'Next Phase Venue', 'Next Phase Guidelines',
      'Submitted At', 'Last Updated At',
      // Funding Headers
      'Funding Source',
      'Total Funding Allocated', 'Sanction 1 Amount', 'Sanction 2 Amount',
      'Sanction 1 Disbursed At', 'Sanction 2 Disbursed At',
      'Beneficiary Name', 'Account No', 'Bank Name', 'IFSC Code', 'Account Type', 'Branch Name', 'City',
      'Sanction 1 Applied for S2?', 'S1 Utilization Status', 'S1 Utilization Remarks', 'S1 Reviewed By', 'S1 Reviewed At',
      'S2 Utilization Status', 'S2 Utilization Remarks', 'S2 Reviewed By', 'S2 Reviewed At',
    ];

    const maxTeamMembers = Math.max(0, ...applications.map(app => app.structuredTeamMembers?.length || 0));
    for (let i = 1; i <= maxTeamMembers; i++) {
        headers.push(
            `Member ${i} Name`, `Member ${i} Email`, `Member ${i} Phone`,
            `Member ${i} Institute`, `Member ${i} Department`, `Member ${i} Enrollment No.`
        );
    }

    const maxS1Expenses = Math.max(0, ...applications.map(app => app.sanction1Expenses?.length || 0));
    for (let i = 1; i <= maxS1Expenses; i++) {
        headers.push(`S1 Expense ${i} Desc`, `S1 Expense ${i} Amt`, `S1 Expense ${i} Proof`);
    }
    const maxS2Expenses = Math.max(0, ...applications.map(app => app.sanction2Expenses?.length || 0));
     for (let i = 1; i <= maxS2Expenses; i++) {
        headers.push(`S2 Expense ${i} Desc`, `S2 Expense ${i} Amt`, `S2 Expense ${i} Proof`);
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
            const adminProfileEntry = applications.find(app => app.phase2Marks?.[uid]?.adminDisplayName);
            if (adminProfileEntry && adminProfileEntry.phase2Marks?.[uid]?.adminDisplayName) {
                 adminDisplayName = `Mark by ${adminProfileEntry.phase2Marks[uid].adminDisplayName}`;
            } else {
                 const profileForUID = applications.find(app => app.userId === uid);
                 if (profileForUID) {
                     adminDisplayName = `Mark by ${profileForUID.applicantDisplayName || `Admin ${uid.substring(0,5)}...`}`;
                 }
            }
            headers.push(adminDisplayName);
        });
    }

    const dataForSheet: any[][] = [];
    dataForSheet.push(headers.map(header => ({ v: header, s: { font: { bold: true } } })));

    applications.forEach(app => {
      const assignedCohort = allCohorts.find(c => c.id === app.cohortId);
      const rowValues: any[] = [
        app.id, app.title, app.applicantDisplayName, app.applicantEmail,
        app.applicantType?.replace(/_/g, ' '), app.teamMembers,
        app.developmentStage.replace(/_/g, ' '), app.problem, app.solution, app.uniqueness,
        app.status.replace(/_/g, ' '), app.programPhase ? getProgramPhaseLabel(app.programPhase) : 'N/A',
        app.mentor || 'N/A',
        assignedCohort ? assignedCohort.name : (app.cohortId ? 'Cohort ID: '+app.cohortId : 'N/A'),
        app.isOutlineAIGenerated ? 'Yes' : 'No',
        app.rejectionRemarks, app.studioLocation,
        app.fileURL, app.fileName, app.phase2PptFileName, app.phase2PptUrl,
        app.nextPhaseDate ? formatDateOnly(app.nextPhaseDate) : 'N/A',
        app.nextPhaseStartTime, app.nextPhaseEndTime, app.nextPhaseVenue, app.nextPhaseGuidelines,
        formatDateISO(app.submittedAt), formatDateISO(app.updatedAt),
        // Funding Data
        app.fundingSource ? fundingSourceLabels[app.fundingSource] : 'N/A', 
        app.totalFundingAllocated ?? 'N/A', app.sanction1Amount ?? 'N/A', app.sanction2Amount ?? 'N/A',
        app.sanction1DisbursedAt ? formatDateOnly(app.sanction1DisbursedAt) : 'N/A',
        app.sanction2DisbursedAt ? formatDateOnly(app.sanction2DisbursedAt) : 'N/A',
        app.beneficiaryName || 'N/A', app.beneficiaryAccountNo || 'N/A', app.beneficiaryBankName || 'N/A', app.beneficiaryIfscCode || 'N/A', app.beneficiaryAccountType || 'N/A', app.beneficiaryCity || 'N/A', app.beneficiaryBranchName || 'N/A',
        app.sanction1AppliedForNext ? 'Yes' : 'No',
        app.sanction1UtilizationStatus || 'N/A', app.sanction1UtilizationRemarks || 'N/A', app.sanction1UtilizationReviewedBy || 'N/A', app.sanction1UtilizationReviewedAt ? formatDateOnly(app.sanction1UtilizationReviewedAt) : 'N/A',
        app.sanction2UtilizationStatus || 'N/A', app.sanction2UtilizationRemarks || 'N/A', app.sanction2UtilizationReviewedBy || 'N/A', app.sanction2UtilizationReviewedAt ? formatDateOnly(app.sanction2UtilizationReviewedAt) : 'N/A',
      ];

      for (let i = 0; i < maxTeamMembers; i++) {
        const member = app.structuredTeamMembers?.[i];
        rowValues.push(
            member?.name || '', member?.email || '', member?.phone || '',
            member?.institute || '', member?.department || '', member?.enrollmentNumber || ''
        );
      }

      for (let i = 0; i < maxS1Expenses; i++) {
        const expense = app.sanction1Expenses?.[i];
        rowValues.push(expense?.description || '', expense?.amount || '', expense?.proofUrl || '');
      }
      for (let i = 0; i < maxS2Expenses; i++) {
        const expense = app.sanction2Expenses?.[i];
        rowValues.push(expense?.description || '', expense?.amount || '', expense?.proofUrl || '');
      }

      if (userProfile?.role === 'ADMIN_FACULTY') {
         adminMarkAdminUIDs.forEach(adminUid => {
            rowValues.push(app.phase2Marks?.[adminUid]?.mark ?? 'N/A');
         });
      }
      dataForSheet.push(rowValues);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");
    XLSX.writeFile(workbook, `pierc_applications_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Export Successful", description: "Applications XLSX has been downloaded." });
  };


  if (authLoading || !initialLoadComplete || loadingApplications || loadingCohorts) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }

  if (!userProfile || userProfile.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Verifying access or redirecting...</p></div>;
  }

  const SortIcon = ({ columnKey }: { columnKey: SortableKeys }) => {
    if (sortConfig.key !== columnKey) return <ChevronDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'ascending' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />;
  };

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
        <Button onClick={handleExportXLSX} disabled={applications.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export to XLSX
        </Button>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Filter & Manage Applications</CardTitle>
          <div className="flex flex-wrap gap-4 items-end pt-4">
            <div className="flex-grow min-w-[200px]">
              <Label htmlFor="searchTerm" className="text-xs">Search (Title/Applicant)</Label>
              <Input
                id="searchTerm"
                placeholder="Search..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="h-9"
              />
            </div>
            <div className="flex-grow min-w-[150px]">
              <Label htmlFor="statusFilter" className="text-xs">Status</Label>
              <Select
                value={filters.status || ALL_STATUSES_FILTER_VALUE}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === ALL_STATUSES_FILTER_VALUE ? '' : value as IdeaStatus | '' }))}
              >
                <SelectTrigger id="statusFilter" className="h-9 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES_FILTER_VALUE} className="text-xs">All Statuses</SelectItem>
                  {ALL_IDEA_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-grow min-w-[150px]">
              <Label htmlFor="phaseFilter" className="text-xs">Program Phase</Label>
              <Select
                value={filters.programPhase || ALL_PHASES_FILTER_VALUE}
                onValueChange={(value) => setFilters(prev => ({ ...prev, programPhase: value === ALL_PHASES_FILTER_VALUE ? '' : value as ProgramPhase | ''}))}
              >
                <SelectTrigger id="phaseFilter" className="h-9 text-xs"><SelectValue placeholder="All Phases" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PHASES_FILTER_VALUE} className="text-xs">All Phases</SelectItem>
                  {ALL_PROGRAM_PHASES.map(p => <SelectItem key={p} value={p} className="text-xs">{getProgramPhaseLabel(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-grow min-w-[150px]">
              <Label htmlFor="cohortFilter" className="text-xs">Cohort</Label>
              <Select
                value={filters.cohortId || ALL_COHORTS_FILTER_VALUE}
                onValueChange={(value) => setFilters(prev => ({ ...prev, cohortId: value === ALL_COHORTS_FILTER_VALUE ? '' : value as string | ''}))}
                disabled={loadingCohorts}
              >
                <SelectTrigger id="cohortFilter" className="h-9 text-xs">
                  <SelectValue placeholder={loadingCohorts ? "Loading..." : "All Cohorts"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_COHORTS_FILTER_VALUE} className="text-xs">All Cohorts</SelectItem>
                  {allCohorts.map(c => <SelectItem key={c.id!} value={c.id!} className="text-xs">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedRowIds.size > 0 && (
            <div className="mt-4 pt-3 border-t">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isBulkActionLoading}>
                    {isBulkActionLoading ? <LoadingSpinner className="mr-2" /> : <Layers className="mr-2 h-4 w-4" />}
                    Bulk Actions ({selectedRowIds.size} selected) <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Apply to Selected</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs px-2">Change Status to</DropdownMenuLabel>
                    {ALL_IDEA_STATUSES.filter(s => s !== 'ARCHIVED_BY_ADMIN').map(status => (
                       <AlertDialog key={`status-alert-${status}`}>
                        <AlertDialogButtonTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); if (selectedRowIds.size > 0) setBulkActionTarget(status); else toast({ title: "No Selection", description: "Please select applications for bulk action.", variant: "default" }); }}>
                                {status.replace(/_/g, ' ')}
                            </DropdownMenuItem>
                        </AlertDialogButtonTrigger>
                        {bulkActionTarget === status && selectedRowIds.size > 0 && (
                            <AlertDialogModalContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    Change status of {selectedRowIds.size} application(s) to "{status.replace(/_/g,' ')}"?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setBulkActionTarget(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => { handleBulkAction('changeStatus', status); setBulkActionTarget(null); }}>
                                    Proceed
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogModalContent>
                        )}
                       </AlertDialog>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                   {userProfile.isSuperAdmin && (
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs px-2">Assign to Cohort</DropdownMenuLabel>
                      <AlertDialog key="cohort-alert-UNASSIGN">
                        <AlertDialogButtonTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => {e.preventDefault(); if (selectedRowIds.size > 0) setBulkActionTarget('UNASSIGN'); else toast({ title: "No Selection", description: "Please select applications for bulk action.", variant: "default" }); }}>Unassign Cohort</DropdownMenuItem>
                        </AlertDialogButtonTrigger>
                         {bulkActionTarget === 'UNASSIGN' && selectedRowIds.size > 0 && (
                            <AlertDialogModalContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    Unassign {selectedRowIds.size} application(s) from any cohort?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setBulkActionTarget(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => { handleBulkAction('assignCohort', 'UNASSIGN'); setBulkActionTarget(null); }}>
                                    Proceed
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogModalContent>
                         )}
                      </AlertDialog>
                      {allCohorts.map(cohort => (
                        <AlertDialog key={`cohort-alert-${cohort.id}`}>
                            <AlertDialogButtonTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); if (selectedRowIds.size > 0) setBulkActionTarget(cohort.id!); else toast({ title: "No Selection", description: "Please select applications for bulk action.", variant: "default" }); }}>
                                {cohort.name}
                                </DropdownMenuItem>
                            </AlertDialogButtonTrigger>
                            {bulkActionTarget === cohort.id! && selectedRowIds.size > 0 && (
                                <AlertDialogModalContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        Assign {selectedRowIds.size} application(s) to cohort: "{cohort.name}"?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setBulkActionTarget(null)}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => { handleBulkAction('assignCohort', cohort.id!); setBulkActionTarget(null); }}>
                                        Proceed
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogModalContent>
                            )}
                        </AlertDialog>
                      ))}
                    </DropdownMenuGroup>
                  )}
                  <DropdownMenuSeparator />
                  <AlertDialog key="archive-alert-BULK">
                    <AlertDialogButtonTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); if (selectedRowIds.size > 0) setBulkActionTarget('ARCHIVE_BULK'); else toast({ title: "No Selection", description: "Please select applications for bulk action.", variant: "default" }); }} className="text-amber-600 focus:text-amber-700 focus:bg-amber-100">
                            <Archive className="mr-2 h-4 w-4" /> Archive for User Revision
                        </DropdownMenuItem>
                    </AlertDialogButtonTrigger>
                     {bulkActionTarget === 'ARCHIVE_BULK' && selectedRowIds.size > 0 && (
                        <AlertDialogModalContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
                                <AlertDialogDescription>
                                Are you sure you want to archive {selectedRowIds.size} selected application(s) for user revision?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setBulkActionTarget(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { handleBulkAction('archive'); setBulkActionTarget(null); }} className="bg-amber-600 hover:bg-amber-700">
                                Proceed
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogModalContent>
                    )}
                   </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {displayedApplications.length === 0 && !loadingApplications ? (
            <p className="text-center text-muted-foreground py-8">No applications found matching your criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                       <Checkbox
                        checked={selectedRowIds.size > 0 && selectedRowIds.size === displayedApplications.length && displayedApplications.length > 0}
                        indeterminate={selectedRowIds.size > 0 && selectedRowIds.size < displayedApplications.length}
                        onCheckedChange={handleSelectAllRows}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                    <TableHead className="min-w-[150px] md:min-w-[200px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('title')}>
                      Idea Title <SortIcon columnKey="title" />
                    </TableHead>
                    <TableHead className="hidden md:table-cell cursor-pointer hover:bg-muted/50" onClick={() => handleSort('applicantDisplayName')}>
                      Applicant <SortIcon columnKey="applicantDisplayName" />
                    </TableHead>
                    <TableHead className="hidden lg:table-cell cursor-pointer hover:bg-muted/50" onClick={() => handleSort('isOutlineAIGenerated')}>
                      AI Outline <SortIcon columnKey="isOutlineAIGenerated" />
                    </TableHead>
                    <TableHead className="hidden lg:table-cell cursor-pointer hover:bg-muted/50" onClick={() => handleSort('submittedAt')}>
                      Submitted <SortIcon columnKey="submittedAt" />
                    </TableHead>
                    <TableHead className="min-w-[180px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                      Status <SortIcon columnKey="status" />
                    </TableHead>
                    <TableHead className="min-w-[200px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('programPhase')}>
                      Program Phase <SortIcon columnKey="programPhase" />
                    </TableHead>
                    <TableHead className="min-w-[200px] hidden xl:table-cell">Assigned Cohort</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedApplications.map((app) => (
                    <TableRow key={app.id} data-state={selectedRowIds.has(app.id!) ? "selected" : ""}>
                       <TableCell>
                        <Checkbox
                          checked={selectedRowIds.has(app.id!)}
                          onCheckedChange={() => handleSelectRow(app.id!)}
                          aria-label={`Select row for ${app.title}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[150px] md:max-w-xs truncate" title={app.title}>
                        {app.title}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{app.applicantDisplayName}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {app.isOutlineAIGenerated ? <Badge variant="secondary" className="bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30"><Sparkles className="h-3 w-3 mr-1"/>Yes</Badge> : <Badge variant="outline">No</Badge>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDateOnly(app.submittedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={app.status}
                            onValueChange={(value) => handleStatusOrPhaseChange(app, value as IdeaStatus, app.programPhase)}
                            disabled={isBulkActionLoading && selectedRowIds.has(app.id!)}
                          >
                            <SelectTrigger className="w-[150px] h-9 text-xs">
                              <SelectValue placeholder="Set status" />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_IDEA_STATUSES.map(statusVal => (
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
                            disabled={isBulkActionLoading && selectedRowIds.has(app.id!)}
                          >
                            <SelectTrigger className="w-[150px] h-9 text-xs">
                              <SelectValue placeholder="Assign Phase" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_PHASE_VALUE} className="text-xs italic">Not Assigned</SelectItem>
                              {ALL_PROGRAM_PHASES.map(phaseVal => (
                                <SelectItem key={phaseVal} value={phaseVal} className="text-xs">
                                  {getProgramPhaseLabel(phaseVal)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {app.status === 'NOT_SELECTED' ? 'N/A (Rejected)' : (app.status === 'ARCHIVED_BY_ADMIN' ? 'N/A (Archived)' : "N/A (Status not 'Selected')")}
                          </span>
                        )}
                      </TableCell>
                       <TableCell className="hidden xl:table-cell">
                        {app.programPhase === 'COHORT' && userProfile.isSuperAdmin ? (
                            <Select
                                value={app.cohortId || UNASSIGN_COHORT_TRIGGER_VALUE}
                                onValueChange={(value) => handleAssignCohort(app, value === UNASSIGN_COHORT_TRIGGER_VALUE ? null : value)}
                                disabled={isAssigningCohort || (isBulkActionLoading && selectedRowIds.has(app.id!))}
                            >
                                <SelectTrigger className="w-full max-w-[180px] h-9 text-xs">
                                <SelectValue placeholder="Assign to Cohort" />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value={UNASSIGN_COHORT_TRIGGER_VALUE} className="text-xs italic">Unassign Cohort</SelectItem>
                                {allCohorts.length === 0 && <SelectItem value="no-cohorts" disabled className="text-xs text-muted-foreground">No cohorts available</SelectItem>}
                                {allCohorts.map(cohort => (
                                    <SelectItem key={cohort.id} value={cohort.id!} className="text-xs">
                                    {cohort.name} ({cohort.ideaIds?.length || 0} ideas)
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        ) : app.programPhase === 'COHORT' && app.cohortId ? (
                             <Badge variant="outline" className="text-xs">
                                {allCohorts.find(c => c.id === app.cohortId)?.name || 'Unknown Cohort'}
                            </Badge>
                        ) : (
                            <span className="text-xs text-muted-foreground italic">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1 sm:space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openDetailModal(app)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Details
                        </Button>
                        <AlertDialog open={applicationToArchive?.id === app.id} onOpenChange={(isOpen) => { if (!isOpen) setApplicationToArchive(null); }}>
                            <AlertDialogButtonTrigger asChild>
                                <Button variant="destructive" size="sm" onClick={() => setApplicationToArchive(app)}>
                                   <Archive className="mr-1 h-3.5 w-3.5" /> Archive
                                </Button>
                            </AlertDialogButtonTrigger>
                           {applicationToArchive && applicationToArchive.id === app.id && (
                            <AlertDialogModalContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Archive for Revision</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will archive the idea "{applicationToArchive.title}", allowing the user to edit and resubmit it.
                                    It will be removed from active review processes.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setApplicationToArchive(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleArchiveIdea(applicationToArchive.id!)} className="bg-destructive hover:bg-destructive/90">
                                    Archive Idea
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogModalContent>
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
                <Accordion type="multiple" defaultValue={['basic', 'team', 'fundingAdmin']} className="w-full">
                    <AccordionItem value="basic">
                        <AccordionTrigger>Basic Idea & Applicant Info</AccordionTrigger>
                        <AccordionContent className="space-y-3">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Idea Title</h4><p>{selectedApplication.title}</p></div>
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Status</h4><Badge variant={getStatusBadgeVariant(selectedApplication.status)} className="capitalize text-sm">{selectedApplication.status.replace(/_/g, ' ').toLowerCase()}</Badge></div>
                                {selectedApplication.status === 'SELECTED' && (<div><h4 className="font-semibold text-muted-foreground text-xs">Program Phase</h4><p>{getProgramPhaseLabel(selectedApplication.programPhase)}</p></div>)}
                                {selectedApplication.programPhase === 'COHORT' && selectedApplication.cohortId && (<div><h4 className="font-semibold text-muted-foreground text-xs">Assigned Cohort</h4><p className="flex items-center gap-1"><GroupIcon className="h-4 w-4 text-primary" />{allCohorts.find(c => c.id === selectedApplication.cohortId)?.name || 'Unknown Cohort'}</p></div>)}
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Applicant Name</h4><p>{selectedApplication.applicantDisplayName || 'N/A'}</p></div>
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Applicant Email</h4><p>{selectedApplication.applicantEmail || 'N/A'}</p></div>
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Applicant Category</h4><p>{selectedApplication.applicantType?.replace(/_/g, ' ') || 'N/A'}</p></div>
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Development Stage</h4><p>{selectedApplication.developmentStage.replace(/_/g, ' ') || 'N/A'}</p></div>
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Submitted At</h4><p>{formatDate(selectedApplication.submittedAt)}</p></div>
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Last Updated At</h4><p>{formatDate(selectedApplication.updatedAt)}</p></div>
                                <div><h4 className="font-semibold text-muted-foreground text-xs">AI Generated Outline?</h4><p>{selectedApplication.isOutlineAIGenerated ? <span className="flex items-center text-green-600"><Sparkles className="h-4 w-4 mr-1"/>Yes</span> : 'No'}</p></div>
                                {selectedApplication.fundingSource && (<div><h4 className="font-semibold text-muted-foreground text-xs">Funding Source</h4><p>{fundingSourceLabels[selectedApplication.fundingSource] || selectedApplication.fundingSource.replace(/_/g, ' ')}</p></div>)}
                            </div>
                            <div className="space-y-2 pt-2">
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Problem Definition</h4><div className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md text-sm markdown-container"><ReactMarkdown components={MarkdownDisplayComponents}>{selectedApplication.problem || ''}</ReactMarkdown></div></div>
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Proposed Solution</h4><div className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md text-sm markdown-container"><ReactMarkdown components={MarkdownDisplayComponents}>{selectedApplication.solution || ''}</ReactMarkdown></div></div>
                                <div><h4 className="font-semibold text-muted-foreground text-xs">Uniqueness/Distinctiveness</h4><div className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md text-sm markdown-container"><ReactMarkdown components={MarkdownDisplayComponents}>{selectedApplication.uniqueness || ''}</ReactMarkdown></div></div>
                                {selectedApplication.fileURL && (<div><h4 className="font-semibold text-muted-foreground text-xs">Attachment (Pitch Deck)</h4><a href={selectedApplication.fileURL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{selectedApplication.fileName || 'View Attachment'}</a></div>)}
                                {selectedApplication.studioLocation && (<div><h4 className="font-semibold text-muted-foreground text-xs">Preferred Studio Location</h4><p>{selectedApplication.studioLocation}</p></div>)}
                                {selectedApplication.status === 'NOT_SELECTED' && selectedApplication.rejectionRemarks && (<div><h4 className="font-semibold text-muted-foreground text-xs text-destructive flex items-center"><MessageSquareWarning className="h-4 w-4 mr-1" /> Rejection Remarks & Guidance</h4><p className="whitespace-pre-wrap bg-destructive/10 p-2 rounded-md text-destructive-foreground/90 text-sm">{selectedApplication.rejectionRemarks}</p>{selectedApplication.rejectedByUid && <p className="text-xs text-muted-foreground mt-1">By admin: {selectedApplication.rejectedByDisplayName || `UID ${selectedApplication.rejectedByUid.substring(0,5)}...`} on {formatDateOnly(selectedApplication.rejectedAt)}</p>}</div>)}
                                {selectedApplication.programPhase === 'PHASE_2' && selectedApplication.phase2PptUrl && (<div><h4 className="font-semibold text-muted-foreground text-xs">Phase 2 Presentation</h4><a href={selectedApplication.phase2PptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{selectedApplication.phase2PptFileName || 'View Phase 2 Presentation'}</a>{selectedApplication.phase2PptUploadedAt && <p className="text-xs text-muted-foreground mt-1">Uploaded on {formatDateOnly(selectedApplication.phase2PptUploadedAt)}</p>}</div>)}
                                {selectedApplication.status === 'SELECTED' && selectedApplication.programPhase && (selectedApplication.programPhase === 'PHASE_1' || selectedApplication.programPhase === 'PHASE_2' || selectedApplication.programPhase === 'INCUBATED') && selectedApplication.nextPhaseDate && (
                                    <Card className="mt-2 border-primary/30 text-sm"><CardHeader className="pb-1 pt-2 px-3"><CardTitle className="text-sm font-semibold text-primary flex items-center"><ChevronsRight className="h-4 w-4 mr-1"/> Next Step: {getProgramPhaseLabel(selectedApplication.programPhase)} Details</CardTitle></CardHeader><CardContent className="px-3 pb-2 space-y-0.5"><p><strong>Date:</strong> {formatDateOnly(selectedApplication.nextPhaseDate)}</p><p><strong>Time:</strong> {selectedApplication.nextPhaseStartTime} - {selectedApplication.nextPhaseEndTime}</p><p><strong>Venue:</strong> {selectedApplication.nextPhaseVenue}</p><p className="font-medium mt-1">Guidelines:</p><p className="text-xs whitespace-pre-wrap bg-muted/20 p-1.5 rounded-md">{selectedApplication.nextPhaseGuidelines}</p></CardContent></Card>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="team">
                        <AccordionTrigger>Team Information</AccordionTrigger>
                        <AccordionContent className="space-y-2">
                             <div><h4 className="font-semibold text-muted-foreground text-xs">Team Members (Initial Description)</h4><p className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md text-sm">{selectedApplication.teamMembers || 'N/A (No team members described initially or Solo innovator)'}</p></div>
                             {selectedApplication.structuredTeamMembers && selectedApplication.structuredTeamMembers.length > 0 && (
                                <div className="pt-1"><h4 className="font-semibold text-muted-foreground text-xs flex items-center mb-1"><UsersIconLucide className="h-4 w-4 mr-1.5"/> Team Members (Detailed)</h4><div className="space-y-2">
                                {selectedApplication.structuredTeamMembers.map((member, index) => (
                                    <Card key={member.id || index} className="bg-muted/40 p-2 shadow-sm text-xs"><CardHeader className="p-0 pb-0.5"><CardTitle className="text-xs font-medium">Member {index + 1}: {member.name}</CardTitle></CardHeader><CardContent className="p-0 text-foreground/80 space-y-0.5"><p><strong>Email:</strong> {member.email}</p><p><strong>Phone:</strong> {member.phone}</p><p><strong>Institute:</strong> {member.institute}</p><p><strong>Department:</strong> {member.department}</p>{member.enrollmentNumber && <p><strong>Enrollment No:</strong> {member.enrollmentNumber}</p>}</CardContent></Card>
                                ))}</div></div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                    {selectedApplication.programPhase === 'COHORT' && (
                        <AccordionItem value="mentor">
                            <AccordionTrigger>Mentor Assignment</AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                {userProfile.isSuperAdmin ? (
                                    <div><Label htmlFor="mentorSelect">Assign Mentor</Label><Select value={selectedApplication.mentor || UNASSIGN_MENTOR_TRIGGER_VALUE} onValueChange={(value) => handleAssignMentor(selectedApplication.id!, selectedApplication.title, value === UNASSIGN_MENTOR_TRIGGER_VALUE ? null : value as MentorName)} disabled={isAssigningMentor}><SelectTrigger id="mentorSelect" className="w-full md:w-[250px]"><SelectValue placeholder="Select a mentor" /></SelectTrigger><SelectContent><SelectItem value={UNASSIGN_MENTOR_TRIGGER_VALUE}>Unassign Mentor</SelectItem>{AVAILABLE_MENTORS_DATA.map(mentor => (<SelectItem key={mentor.name} value={mentor.name}>{mentor.name} ({mentor.email})</SelectItem>))}</SelectContent></Select>{isAssigningMentor && <LoadingSpinner size={16} className="ml-2 inline-block" />}</div>
                                ) : (<div><h4 className="font-semibold text-muted-foreground text-xs">Assigned Mentor</h4><p>{selectedApplication.mentor || 'Not yet assigned'}</p></div>)}
                            </AccordionContent>
                        </AccordionItem>
                    )}
                    {selectedApplication.programPhase === 'PHASE_2' && (
                        <AccordionItem value="marks">
                            <AccordionTrigger>Phase 2 Marks</AccordionTrigger>
                            <AccordionContent className="space-y-3">
                                {Object.entries(selectedApplication.phase2Marks || {}).map(([adminUid, markEntry]) => {
                                  const displayName = markEntry.adminDisplayName || 'Admin'; const isCurrentUserMark = adminUid === userProfile.uid;
                                  if (userProfile.isSuperAdmin && !isCurrentUserMark) { return (<div key={adminUid} className="flex justify-between items-center text-sm p-2 bg-muted/20 rounded-md"><span className="flex items-center"><UserCheck className="h-4 w-4 mr-2 text-muted-foreground" />{displayName}</span><Badge variant="secondary">{markEntry.mark !== null ? markEntry.mark : 'N/A'}</Badge></div>);} return null;
                                })}
                                {(() => {const marksObject = selectedApplication.phase2Marks || {}; const totalMarksCount = Object.keys(marksObject).length; const currentUserHasMarked = !!marksObject[userProfile.uid]; if (userProfile.isSuperAdmin) { if (totalMarksCount === 0) {return <p className="text-sm text-muted-foreground text-center py-1">No marks submitted by any admin yet.</p>;}} else { if (!currentUserHasMarked && totalMarksCount > 0) {return <p className="text-sm text-muted-foreground text-center py-1">Other marks may exist. Submit yours below.</p>;} if (totalMarksCount === 0) { return <p className="text-sm text-muted-foreground text-center py-1">No marks submitted yet. Submit yours below.</p>;}} return null; })()}
                                <div className="pt-2 space-y-1"><Label htmlFor="adminMarkInput" className="font-semibold text-xs">Your Mark (0-100):</Label><div className="flex items-center gap-2"><Input id="adminMarkInput" type="number" min="0" max="100" value={currentAdminMark} onChange={(e) => setCurrentAdminMark(e.target.value)} placeholder="Enter mark" className="max-w-[120px] h-9 text-sm" disabled={isSavingMark} /><Button onClick={handleSaveMark} disabled={isSavingMark} size="sm">{isSavingMark ? <LoadingSpinner size={16} className="mr-1"/> : null}Save My Mark</Button></div></div>
                                <p className="text-xs text-muted-foreground">Leave the mark empty and save to clear your previously submitted mark.</p>
                            </AccordionContent>
                        </AccordionItem>
                    )}
                     {selectedApplication.programPhase === 'INCUBATED' && userProfile.isSuperAdmin && (
                        <AccordionItem value="fundingAdmin">
                            <AccordionTrigger>Funding & Sanction Management (Admin)</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <Button onClick={() => {
                                    setFundingForm({ totalFundingAllocated: selectedApplication?.totalFundingAllocated || '', sanction1Amount: selectedApplication?.sanction1Amount || '', sanction2Amount: selectedApplication?.sanction2Amount || '', fundingSource: selectedApplication?.fundingSource || '' });
                                    setIsFundingFormOpen(true);
                                }} variant="outline" size="sm"><DollarSign className="mr-2 h-4 w-4" />Set/Update Funding Allocation</Button>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Card>
                                        <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-sm font-semibold">Sanction 1</CardTitle></CardHeader>
                                        <CardContent className="px-3 pb-3 space-y-2">
                                            <p className="text-xs">Amount: {selectedApplication.sanction1Amount ? `₹${selectedApplication.sanction1Amount.toLocaleString()}` : 'Not Set'}</p>
                                            {selectedApplication.sanction1DisbursedAt ? (<p className="text-xs text-green-600">Disbursed: {formatDateOnly(selectedApplication.sanction1DisbursedAt)}</p>) : (<Button size="sm" onClick={() => handleDisburseSanction(1)} disabled={!selectedApplication.sanction1Amount}>Mark Disbursed</Button>)}
                                            <p className="text-xs">Student Applied for S2: {selectedApplication.sanction1AppliedForNext ? 'Yes' : 'No'}</p>
                                            <p className="text-xs">Status: {selectedApplication.sanction1UtilizationStatus || 'N/A'}</p>
                                            {selectedApplication.sanction1Expenses && selectedApplication.sanction1Expenses.length > 0 && <p className="text-xs font-medium mt-1">Expenses ({selectedApplication.sanction1Expenses.length}):</p>}
                                            {selectedApplication.sanction1Expenses?.map(exp => (<div key={exp.id} className="text-xs border-t pt-1 mt-1"><p>{exp.description}: ₹{exp.amount.toLocaleString()} (<a href={exp.proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">View Proof</a>)</p></div>))}
                                            <Button size="sm" variant="outline" onClick={() => openSanctionReviewForm('SANCTION_1')} className="mt-2">Review S1 Utilization</Button>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-sm font-semibold">Sanction 2</CardTitle></CardHeader>
                                        <CardContent className="px-3 pb-3 space-y-2">
                                            <p className="text-xs">Amount: {selectedApplication.sanction2Amount ? `₹${selectedApplication.sanction2Amount.toLocaleString()}` : 'Not Set'}</p>
                                            {selectedApplication.sanction2DisbursedAt ? (<p className="text-xs text-green-600">Disbursed: {formatDateOnly(selectedApplication.sanction2DisbursedAt)}</p>) : (<Button size="sm" onClick={() => handleDisburseSanction(2)} disabled={!selectedApplication.sanction2Amount || selectedApplication.sanction1UtilizationStatus !== 'APPROVED'}>Mark Disbursed</Button>)}
                                            <p className="text-xs">Status: {selectedApplication.sanction2UtilizationStatus || 'N/A'}</p>
                                            {selectedApplication.sanction2Expenses && selectedApplication.sanction2Expenses.length > 0 && <p className="text-xs font-medium mt-1">Expenses ({selectedApplication.sanction2Expenses.length}):</p>}
                                            {selectedApplication.sanction2Expenses?.map(exp => (<div key={exp.id} className="text-xs border-t pt-1 mt-1"><p>{exp.description}: ₹{exp.amount.toLocaleString()} (<a href={exp.proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">View Proof</a>)</p></div>))}
                                            <Button size="sm" variant="outline" onClick={() => openSanctionReviewForm('SANCTION_2')} className="mt-2" disabled={selectedApplication.sanction1UtilizationStatus !== 'APPROVED' || !selectedApplication.sanction2DisbursedAt}>Review S2 Utilization</Button>
                                        </CardContent>
                                    </Card>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                     )}
                </Accordion>
            </div>
             <div className="pt-4 flex justify-end">
                <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isRejectionDialogVisible && currentIdeaForRejection && (
        <Dialog open={isRejectionDialogVisible} onOpenChange={(isOpen) => {
            if(!isOpen) { setIsRejectionDialogVisible(false); setCurrentIdeaForRejection(null); setRejectionRemarksInput(''); fetchApplications(); } else { setIsRejectionDialogVisible(isOpen); }
        }}>
            <DialogContent><DialogHeader><DialogTitle className="flex items-center"><MessageSquareWarning className="h-5 w-5 mr-2 text-destructive"/> Provide Rejection Remarks</DialogTitle><DialogDescription>For idea: <span className="font-semibold">{currentIdeaForRejection.title}</span>. Please provide constructive feedback or reasons for not selecting this idea.</DialogDescription></DialogHeader><div className="py-4 space-y-2"><Label htmlFor="rejectionRemarks">Remarks/Guidance</Label><Textarea id="rejectionRemarks" value={rejectionRemarksInput} onChange={(e) => setRejectionRemarksInput(e.target.value)} placeholder="Explain why the idea was not selected and suggest areas for improvement..." rows={5} /></div><DialogFooter><Button variant="outline" onClick={() => { setIsRejectionDialogVisible(false); setCurrentIdeaForRejection(null); setRejectionRemarksInput(''); fetchApplications(); }}>Cancel</Button><Button onClick={handleSubmitRejection} className="bg-destructive hover:bg-destructive/90">Submit Rejection</Button></DialogFooter></DialogContent>
        </Dialog>
      )}

      {isPhaseDetailsDialogVisible && currentIdeaForPhaseDetails && currentPhaseForDialog && (
        <Dialog open={isPhaseDetailsDialogVisible} onOpenChange={(isOpen) => {
            if (!isOpen) { setIsPhaseDetailsDialogVisible(false); setCurrentIdeaForPhaseDetails(null); setCurrentPhaseForDialog(null); fetchApplications(); } else { setIsPhaseDetailsDialogVisible(isOpen); }
        }}>
            <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="flex items-center"><CalendarIcon className="h-5 w-5 mr-2 text-primary"/> Set Meeting Details for {getProgramPhaseLabel(currentPhaseForDialog)}</DialogTitle><DialogDescription>Provide date, time, venue, and guidelines for <span className="font-semibold">{currentIdeaForPhaseDetails.title}</span>.</DialogDescription></DialogHeader><div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2"><div><Label htmlFor="phaseDate">Date</Label><Popover><PopoverTrigger asChild><Button id="phaseDate" variant={"outline"} className={cn("w-full justify-start text-left font-normal",!phaseDetailsForm.date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{phaseDetailsForm.date ? format(phaseDetailsForm.date, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={phaseDetailsForm.date || undefined} onSelect={(date) => setPhaseDetailsForm(prev => ({...prev, date: date || null}))} initialFocus /></PopoverContent></Popover></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="phaseStartTime">Start Time</Label><Input id="phaseStartTime" type="time" value={phaseDetailsForm.startTime} onChange={(e) => setPhaseDetailsForm(prev => ({...prev, startTime: e.target.value}))}/></div><div><Label htmlFor="phaseEndTime">End Time</Label><Input id="phaseEndTime" type="time" value={phaseDetailsForm.endTime} onChange={(e) => setPhaseDetailsForm(prev => ({...prev, endTime: e.target.value}))}/></div></div><div><Label htmlFor="phaseVenue">Venue</Label><Input id="phaseVenue" value={phaseDetailsForm.venue} onChange={(e) => setPhaseDetailsForm(prev => ({...prev, venue: e.target.value}))} placeholder="e.g., PIERC Office, BBA Building"/></div><div><Label htmlFor="phaseGuidelines">Guidelines</Label><Textarea id="phaseGuidelines" value={phaseDetailsForm.guidelines} onChange={(e) => setPhaseDetailsForm(prev => ({...prev, guidelines: e.target.value}))} placeholder="Enter guidelines for this phase meeting..." rows={4}/></div></div><DialogFooter><Button variant="outline" onClick={() => { setIsPhaseDetailsDialogVisible(false); setCurrentIdeaForPhaseDetails(null); setCurrentPhaseForDialog(null); fetchApplications(); }}>Cancel</Button><Button onClick={handleSubmitPhaseDetails}>Save Details</Button></DialogFooter></DialogContent>
        </Dialog>
      )}

      {isFundingFormOpen && selectedApplication && userProfile?.isSuperAdmin && (
        <Dialog open={isFundingFormOpen} onOpenChange={(isOpen) => { if(!isOpen) setIsFundingFormOpen(false); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5"/>Set Funding Allocation for {selectedApplication.title}</DialogTitle></DialogHeader>
                <div className="py-4 space-y-3">
                    <div>
                        <Label htmlFor="fundingSource">Funding Source</Label>
                        <Select value={fundingForm.fundingSource} onValueChange={(value) => setFundingForm(prev => ({...prev, fundingSource: value as FundingSource | ''}))}>
                            <SelectTrigger id="fundingSource">
                                <SelectValue placeholder="Select funding source" />
                            </SelectTrigger>
                            <SelectContent>
                                {ALL_FUNDING_SOURCES.map(source => (
                                    <SelectItem key={source} value={source}>
                                        {fundingSourceLabels[source]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label htmlFor="totalFunding">Total Funding Allocated (INR)</Label><Input id="totalFunding" type="number" value={fundingForm.totalFundingAllocated} onChange={(e) => setFundingForm(prev => ({...prev, totalFundingAllocated: e.target.value}))} placeholder="e.g., 50000" /></div>
                    <div><Label htmlFor="sanction1Amount">Sanction 1 Amount (INR)</Label><Input id="sanction1Amount" type="number" value={fundingForm.sanction1Amount} onChange={(e) => setFundingForm(prev => ({...prev, sanction1Amount: e.target.value}))} placeholder="e.g., 25000" /></div>
                    <div><Label htmlFor="sanction2Amount">Sanction 2 Amount (INR)</Label><Input id="sanction2Amount" type="number" value={fundingForm.sanction2Amount} onChange={(e) => setFundingForm(prev => ({...prev, sanction2Amount: e.target.value}))} placeholder="e.g., 25000" /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setIsFundingFormOpen(false)}>Cancel</Button><Button onClick={handleSaveFundingDetails}>Save Allocation</Button></DialogFooter>
            </DialogContent>
        </Dialog>
      )}

      {isSanctionReviewFormOpen && selectedApplication && sanctionToReview && userProfile?.isSuperAdmin && (
        <Dialog open={isSanctionReviewFormOpen} onOpenChange={(isOpen) => { if(!isOpen) setIsSanctionReviewFormOpen(false); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle className="flex items-center"><CheckSquare className="mr-2 h-5 w-5"/>Review Sanction {sanctionToReview === 'SANCTION_1' ? 1 : 2} Utilization</DialogTitle><DialogDescription>For idea: {selectedApplication.title}</DialogDescription></DialogHeader>
                <div className="py-4 space-y-3">
                    <div><Label htmlFor="sanctionStatus">Approval Status</Label>
                        <Select value={sanctionReviewForm.status} onValueChange={(value) => setSanctionReviewForm(prev => ({...prev, status: value as SanctionApprovalStatus}))}>
                            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="APPROVED">Approve</SelectItem>
                                <SelectItem value="REJECTED">Reject</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label htmlFor="sanctionRemarks">Admin Remarks</Label><Textarea id="sanctionRemarks" value={sanctionReviewForm.remarks} onChange={(e) => setSanctionReviewForm(prev => ({...prev, remarks: e.target.value}))} placeholder="Provide feedback or reasons..." rows={3} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setIsSanctionReviewFormOpen(false)}>Cancel</Button><Button onClick={handleSaveSanctionReview}>Save Review</Button></DialogFooter>
            </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
