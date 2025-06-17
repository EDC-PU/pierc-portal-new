
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { 
    getAllIdeaSubmissionsWithDetails, 
    updateIdeaStatusAndPhase, 
    deleteIdeaSubmission as deleteIdeaSubmissionFS,
    submitOrUpdatePhase2Mark 
} from '@/lib/firebase/firestore';
import type { IdeaSubmission, IdeaStatus, ProgramPhase, UserProfile, AdminMark } from '@/types';
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
import { FileText, Eye, Info, Download, Trash2, ChevronsRight, Star, UserCheck, MessageSquareWarning } from 'lucide-react';
import { format, formatISO } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { getDoc, doc } from 'firebase/firestore'; 
import { db } from '@/lib/firebase/config'; 


const ideaStatuses: IdeaStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'IN_EVALUATION', 'SELECTED', 'NOT_SELECTED'];
const programPhases: ProgramPhase[] = ['PHASE_1', 'PHASE_2', 'COHORT'];
const NO_PHASE_VALUE = "NO_PHASE_ASSIGNED";

const getProgramPhaseLabel = (phase: ProgramPhase | typeof NO_PHASE_VALUE | null | undefined): string => {
  if (!phase || phase === NO_PHASE_VALUE) return 'N/A';
  switch (phase) {
    case 'PHASE_1': return 'Phase 1';
    case 'PHASE_2': return 'Phase 2';
    case 'COHORT': return 'Cohort';
    default: return 'N/A';
  }
};

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

  const [isRejectionDialogVisible, setIsRejectionDialogVisible] = useState(false);
  const [currentIdeaForRejection, setCurrentIdeaForRejection] = useState<IdeaSubmission | null>(null);
  const [rejectionRemarksInput, setRejectionRemarksInput] = useState('');


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

  const handleStatusOrPhaseChange = async (
    ideaId: string,
    newStatus: IdeaStatus,
    newPhaseInputValue: ProgramPhase | typeof NO_PHASE_VALUE | null = null,
    remarks?: string // Optional remarks for rejection
  ) => {
    if (!userProfile) {
        toast({ title: "Error", description: "Admin profile not found.", variant: "destructive" });
        return;
    }

    let actualNewPhase: ProgramPhase | null = null;
    if (newPhaseInputValue && newPhaseInputValue !== NO_PHASE_VALUE) {
        actualNewPhase = newPhaseInputValue as ProgramPhase;
    }

    try {
      await updateIdeaStatusAndPhase(ideaId, newStatus, actualNewPhase, remarks, userProfile.uid);
      toast({ title: "Update Successful", description: `Application updated.` });
      fetchApplications(); 
    } catch (error) {
      console.error("Error updating status/phase:", error);
      toast({ title: "Update Error", description: "Could not update application.", variant: "destructive" });
      fetchApplications(); 
    }
  };

  const triggerStatusChange = (idea: IdeaSubmission, newStatus: IdeaStatus) => {
    if (newStatus === 'NOT_SELECTED') {
        setCurrentIdeaForRejection(idea);
        setRejectionRemarksInput(idea.rejectionRemarks || ''); // Pre-fill if editing
        setIsRejectionDialogVisible(true);
    } else {
        // For other statuses, or if changing from NOT_SELECTED to something else, clear remarks potentially
        handleStatusOrPhaseChange(idea.id!, newStatus, idea.programPhase);
    }
  };

  const handleSubmitRejection = async () => {
    if (!currentIdeaForRejection || !userProfile) return;
    if (!rejectionRemarksInput.trim()) {
        toast({ title: "Remarks Required", description: "Please provide rejection remarks or guidance.", variant: "destructive" });
        return;
    }
    await handleStatusOrPhaseChange(
        currentIdeaForRejection.id!, 
        'NOT_SELECTED', 
        null, 
        rejectionRemarksInput,
    );
    setIsRejectionDialogVisible(false);
    setCurrentIdeaForRejection(null);
    setRejectionRemarksInput('');
  };


  const handleDeleteIdea = async (ideaId: string) => {
    try {
      await deleteIdeaSubmissionFS(ideaId);
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
        await submitOrUpdatePhase2Mark(selectedApplication.id, userProfile, markValue);
        toast({ title: "Mark Saved", description: "Your mark has been successfully submitted." });
        
        const appDocRef = doc(db, 'ideas', selectedApplication.id);
        const updatedAppSnap = await getDoc(appDocRef);
        const updatedAppData = updatedAppSnap.exists() ? ({ id: updatedAppSnap.id, ...updatedAppSnap.data() } as IdeaSubmission) : null;

        if (updatedAppData) {
          setSelectedApplication(prev => prev ? {...prev, phase2Marks: updatedAppData.phase2Marks, updatedAt: updatedAppData.updatedAt} : null);
          setApplications(prevApps => prevApps.map(app => app.id === updatedAppData.id ? {...app, phase2Marks: updatedAppData.phase2Marks, updatedAt: updatedAppData.updatedAt} : app));
        } else {
          fetchApplications(); 
        }
    } catch (error) {
        console.error("Error saving mark:", error);
        toast({ title: "Save Mark Error", description: (error as Error).message || "Could not save your mark.", variant: "destructive" });
    } finally {
        setIsSavingMark(false);
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
    return format(dateToFormat, 'MMM d, yyyy, HH:mm');
  };
  
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
      'ID', 'Title', 'Applicant Name', 'Applicant Email', 'Applicant Category',
      'Development Stage', 'Problem Definition', 'Solution Description', 'Uniqueness',
      'Status', 'Program Phase', 'Rejection Remarks', 'Studio Location', 
      'Attachment URL', 'Attachment Name', 'Phase 2 PPT Name', 'Phase 2 PPT URL',
      'Submitted At', 'Last Updated At', 
    ];
    
    const adminMarkAdminUIDs: string[] = [];
    if (userProfile?.role === 'ADMIN_FACULTY' && applications.length > 0 && applications[0]?.phase2Marks) {
        const allAdminUIDsInMarks = new Set<string>();
        applications.forEach(app => {
            if (app.phase2Marks) {
                Object.keys(app.phase2Marks).forEach(uid => allAdminUIDsInMarks.add(uid));
            }
        });
        adminMarkAdminUIDs.push(...Array.from(allAdminUIDsInMarks).sort());
        adminMarkAdminUIDs.forEach(uid => {
            let adminDisplayName = `Mark by Admin ${uid.substring(0,5)}...`; 
            for (const app of applications) {
                if (app.phase2Marks?.[uid]?.adminDisplayName) {
                    adminDisplayName = `Mark by ${app.phase2Marks[uid].adminDisplayName}`;
                    break;
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
        escapeCsvField(app.developmentStage.replace(/_/g, ' ')),
        escapeCsvField(app.problem),
        escapeCsvField(app.solution),
        escapeCsvField(app.uniqueness),
        escapeCsvField(app.status.replace(/_/g, ' ')),
        escapeCsvField(app.programPhase ? getProgramPhaseLabel(app.programPhase) : 'N/A'),
        escapeCsvField(app.rejectionRemarks),
        escapeCsvField(app.studioLocation),
        escapeCsvField(app.fileURL),
        escapeCsvField(app.fileName),
        escapeCsvField(app.phase2PptFileName),
        escapeCsvField(app.phase2PptUrl),
        escapeCsvField(formatDateISO(app.submittedAt)),
        escapeCsvField(formatDateISO(app.updatedAt)),
      ];

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
            Set status for applications. If 'Selected', assign a Program Phase. If 'Not Selected', provide remarks. For 'Phase 2' ideas, provide marks in the details dialog.
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
                        {formatDate(app.submittedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={app.status}
                            onValueChange={(value) => triggerStatusChange(app, value as IdeaStatus)}
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
                            onValueChange={(value) => handleStatusOrPhaseChange(app.id!, 'SELECTED', value as ProgramPhase | typeof NO_PHASE_VALUE)}
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
                        {selectedApplication.rejectedByUid && <p className="text-xs text-muted-foreground mt-1">By admin: {selectedApplication.rejectedByUid.substring(0,5)}... on {formatDate(selectedApplication.rejectedAt)}</p>}
                    </div>
                )}
                 {selectedApplication.programPhase === 'PHASE_2' && selectedApplication.phase2PptUrl && (
                    <div>
                        <h4 className="font-semibold text-muted-foreground">Phase 2 Presentation</h4>
                        <a href={selectedApplication.phase2PptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {selectedApplication.phase2PptFileName || 'View Phase 2 Presentation'}
                        </a>
                         {selectedApplication.phase2PptUploadedAt && <p className="text-xs text-muted-foreground mt-1">Uploaded on {formatDate(selectedApplication.phase2PptUploadedAt)}</p>}
                    </div>
                 )}
              </div>

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
                      
                      if (!userProfile.isSuperAdmin && isCurrentUserMark && !selectedApplication.phase2Marks?.[userProfile.uid]) {
                         return null; // Regular admin: don't show their own mark in the list if they haven't submitted yet (it's in the input)
                      }
                      // Show all marks for SuperAdmin, or other admins' marks for regular admin
                      if (userProfile.isSuperAdmin || !isCurrentUserMark) {
                        return (
                            <div key={adminUid} className="flex justify-between items-center text-sm p-2 bg-muted/20 rounded-md">
                            <span className="flex items-center">
                                <UserCheck className="h-4 w-4 mr-2 text-muted-foreground" /> 
                                {displayName}
                                {userProfile.isSuperAdmin && isCurrentUserMark && <span className="text-xs text-primary ml-1">(Your Mark)</span>}
                            </span>
                            <Badge variant="secondary">{markEntry.mark !== null ? markEntry.mark : 'N/A'}</Badge>
                            </div>
                        );
                      }
                      return null;
                    })}
                    {(() => {
                        const marksObject = selectedApplication.phase2Marks || {};
                        const totalMarksCount = Object.keys(marksObject).length;
                        
                        if (userProfile.isSuperAdmin) {
                            if (totalMarksCount === 0) {
                                return <p className="text-sm text-muted-foreground text-center py-2">No marks submitted by any admin yet.</p>;
                            }
                        } else { 
                            const otherAdminMarksCount = Object.keys(marksObject).filter(uid => uid !== userProfile.uid).length;
                            if (otherAdminMarksCount === 0 && totalMarksCount > 0 && selectedApplication.phase2Marks?.[userProfile.uid]) {
                               // Current user is the only one who marked
                               return <p className="text-sm text-muted-foreground text-center py-2">You are the only admin who has submitted a mark.</p>;
                            }
                            if (otherAdminMarksCount === 0 && totalMarksCount === 0) {
                                return <p className="text-sm text-muted-foreground text-center py-2">No marks submitted by any admin yet.</p>;
                            }
                             if (otherAdminMarksCount === 0 && totalMarksCount > 0 && !selectedApplication.phase2Marks?.[userProfile.uid]) {
                                return <p className="text-sm text-muted-foreground text-center py-2">No marks submitted by other admins yet.</p>;
                            }
                        }
                        return null;
                    })()}


                    <div className="pt-3 space-y-2">
                        <Label htmlFor="adminMarkInput" className="font-semibold">
                           {userProfile.isSuperAdmin && Object.keys(selectedApplication.phase2Marks || {}).some(uid => uid === userProfile.uid) 
                             ? "Your Mark (Super Admin View - Update if needed)" 
                             : "Your Mark"} (0-100):
                        </Label>
                        <div className="flex items-center gap-2">
                        <Input
                            id="adminMarkInput"
                            type="number"
                            min="0"
                            max="100"
                            value={currentAdminMark}
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
                 // Important: Re-fetch applications to revert optimistic UI change of status dropdown if dialog is cancelled
                fetchApplications();
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
                        fetchApplications(); // Revert status dropdown if cancelled
                    }}>Cancel</Button>
                    <Button onClick={handleSubmitRejection} className="bg-destructive hover:bg-destructive/90">Submit Rejection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

