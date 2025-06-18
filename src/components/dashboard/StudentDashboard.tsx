
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Lightbulb, Users, Activity, Loader2, ArrowRight, FileCheck2, Clock, ChevronsRight, UploadCloud, FileQuestion, AlertCircle, Download, CalendarDays, MapPin, ListChecks, Trash2, PlusCircle, Edit2, Save, UserCheck as UserCheckIcon, Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserIdeaSubmissionsWithStatus,
  type IdeaSubmission,
  updateIdeaPhase2PptDetails,
  addTeamMemberToIdea,
  removeTeamMemberFromIdea,
  updateTeamMemberInIdea
} from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Timestamp } from 'firebase/firestore';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ProgramPhase, TeamMember, UserProfile } from '@/types';
import { format, isValid } from 'date-fns';
import { uploadPresentation } from '@/ai/flows/upload-presentation-flow';
import { useForm, Controller, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { nanoid } from 'nanoid';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


const getProgramPhaseLabel = (phase: ProgramPhase | null | undefined): string => {
  if (!phase) return '';
  switch (phase) {
    case 'PHASE_1': return 'Phase 1';
    case 'PHASE_2': return 'Phase 2';
    case 'COHORT': return 'Cohort';
    default: return '';
  }
};

const teamMemberSchema = z.object({
  id: z.string().optional(), // nanoid or UID
  name: z.string().min(1, "Name is required").max(100).optional().or(z.literal('')),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().min(10, "Contact number must be at least 10 digits").max(15).optional().or(z.literal('')),
  institute: z.string().min(1, "Institute is required").max(100).optional().or(z.literal('')),
  department: z.string().min(1, "Department is required").max(100).optional().or(z.literal('')),
  enrollmentNumber: z.string().max(50).optional().or(z.literal('')),
}).refine(data => {
    // If a name is provided, other core fields become required
    if (data.name && data.name.trim() !== '') {
        return !!(data.email && data.email.trim() !== '' &&
                  data.phone && data.phone.trim() !== '' &&
                  data.institute && data.institute.trim() !== '' &&
                  data.department && data.department.trim() !== '');
    }
    return true; // If no name, it's an empty row, no validation needed here.
}, {
    message: "If member name is provided, then email, phone, institute, and department are also required.",
    // Apply this custom error at a common path or a specific one that makes sense
    path: ['name'], // Or use a more general path if preferred
});


const teamManagementSchema = z.object({
  members: z.array(teamMemberSchema).max(4, "You can add a maximum of 4 team members."),
});
type TeamManagementFormData = z.infer<typeof teamManagementSchema>;


export default function StudentDashboard() {
  const { user, isTeamMemberForIdea, teamLeaderProfileForMember } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [userIdeas, setUserIdeas] = useState<IdeaSubmission[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [selectedPptFile, setSelectedPptFile] = useState<File | null>(null);
  const [uploadingPptIdeaId, setUploadingPptIdeaId] = useState<string | null>(null);
  const [isUploadingPpt, setIsUploadingPpt] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [selectedIdeaForTeamMgmt, setSelectedIdeaForTeamMgmt] = useState<IdeaSubmission | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);


  const { control, handleSubmit, reset: resetTeamManagementForm, formState: { errors: teamManagementErrors, isSubmitting: isSubmittingTeamTable }, getValues } = useForm<TeamManagementFormData>({
    resolver: zodResolver(teamManagementSchema),
    defaultValues: {
      members: Array(4).fill(null).map(() => ({ id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' })),
    },
  });

  const { fields, replace } = useFieldArray({
    control,
    name: "members",
  });


  const fetchUserIdeasAndUpdateState = async (currentSelectedIdeaId?: string) => {
    if (!user?.uid) {
        setUserIdeas([]);
        setLoadingIdeas(false);
        return;
    }
    setLoadingIdeas(true);
    try {
        const ideas = await getUserIdeaSubmissionsWithStatus(user.uid);
        setUserIdeas(ideas);
        if (currentSelectedIdeaId) {
            const updatedSelected = ideas.find(idea => idea.id === currentSelectedIdeaId);
            setSelectedIdeaForTeamMgmt(updatedSelected || null);
            if (updatedSelected) {
                const currentMembers = updatedSelected.structuredTeamMembers || [];
                const formMembers = Array(4).fill(null).map((_, i) => {
                    const member = currentMembers[i];
                    return member
                        ? { ...member, id: member.id || nanoid() } // Ensure ID exists, even if temporary
                        : { id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' };
                });
                resetTeamManagementForm({ members: formMembers });
            } else {
                 resetTeamManagementForm({ members: Array(4).fill(null).map(() => ({ id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' })) });
            }
        } else if (ideas.length > 0 && !selectedIdeaForTeamMgmt) { // Default to empty form if no idea selected for mgmt yet
             resetTeamManagementForm({ members: Array(4).fill(null).map(() => ({ id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' })) });
        }
    } catch (error) {
        console.error("Error fetching user ideas:", error);
        toast({ title: "Error", description: "Could not load your idea submissions.", variant: "destructive" });
        setUserIdeas([]);
    } finally {
        setLoadingIdeas(false);
    }
  };

  useEffect(() => {
    if (user?.uid && !isTeamMemberForIdea) {
      fetchUserIdeasAndUpdateState(selectedIdeaForTeamMgmt?.id);
    } else if (isTeamMemberForIdea) {
      setLoadingIdeas(false);
      setUserIdeas([]); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isTeamMemberForIdea]); 

  useEffect(() => {
    if (selectedIdeaForTeamMgmt && !isTeamMemberForIdea) { 
        const currentMembers = selectedIdeaForTeamMgmt.structuredTeamMembers || [];
        const formMembersData = Array(4).fill(null).map((_, i) => {
            const member = currentMembers[i];
            return member
                ? { ...member, id: member.id || nanoid() }
                : { id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' };
        });
        resetTeamManagementForm({ members: formMembersData });
    } else if (!isTeamMemberForIdea) { 
        resetTeamManagementForm({ members: Array(4).fill(null).map(() => ({ id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' })) });
    }
  }, [selectedIdeaForTeamMgmt, resetTeamManagementForm, isTeamMemberForIdea]);


  const getStatusBadgeVariant = (status?: IdeaSubmission['status']) => {
    if (!status) return 'secondary';
    switch (status) {
      case 'SELECTED': return 'default';
      case 'SUBMITTED': return 'secondary';
      case 'UNDER_REVIEW': return 'outline';
      case 'IN_EVALUATION': return 'outline';
      case 'NOT_SELECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatDate = (timestamp: Timestamp | Date | undefined | null): string => {
    if (!timestamp) return 'N/A';
    let dateToFormat: Date;
    if ((timestamp as Timestamp)?.toDate) {
      dateToFormat = (timestamp as Timestamp).toDate();
    } else if (timestamp instanceof Date) {
      dateToFormat = timestamp;
    } else {
        return 'Invalid Date';
    }
    if (!isValid(dateToFormat)) return 'Invalid Date';
    return dateToFormat.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  
  const formatDateWithTime = (timestamp: Timestamp | Date | undefined | null): string => {
    if (!timestamp) return 'N/A';
    let dateToFormat: Date;
    if ((timestamp as Timestamp)?.toDate) {
      dateToFormat = (timestamp as Timestamp).toDate();
    } else if (timestamp instanceof Date) {
      dateToFormat = timestamp;
    } else {
        return 'Invalid Date';
    }
    if (!isValid(dateToFormat)) return 'Invalid Date';
    return format(dateToFormat, 'MMM d, yyyy');
  };

  const fileToDataUri = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePptFileChange = (event: React.ChangeEvent<HTMLInputElement>, ideaId: string) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === "application/vnd.ms-powerpoint" || file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        setSelectedPptFile(file);
        setUploadingPptIdeaId(ideaId);
        setUploadError(null);
      } else {
        toast({ title: "Invalid File Type", description: "Please upload a PPT or PPTX file.", variant: "destructive" });
        setSelectedPptFile(null);
        setUploadingPptIdeaId(null);
        setUploadError("Invalid file type. Please upload PPT or PPTX.");
        event.target.value = '';
      }
    }
  };

  const handlePptUpload = async () => {
    if (!selectedPptFile || !uploadingPptIdeaId || !user?.uid) {
      toast({ title: "Upload Error", description: "No file selected or idea context missing.", variant: "destructive" });
      return;
    }

    setIsUploadingPpt(true);
    setUploadError(null);

    try {
      const fileDataUri = await fileToDataUri(selectedPptFile);
      const flowResult = await uploadPresentation({
        ideaId: uploadingPptIdeaId,
        fileName: selectedPptFile.name,
        fileDataUri: fileDataUri,
      });

      await updateIdeaPhase2PptDetails(uploadingPptIdeaId, flowResult.pptUrl, flowResult.pptFileName);
      toast({ title: "Presentation Info Saved", description: `${flowResult.pptFileName} details recorded (Simulated Upload).` });

      fetchUserIdeasAndUpdateState(uploadingPptIdeaId);


    } catch (error) {
      console.error("Error during PPT upload process:", error);
      const errorMessage = (error instanceof Error) ? error.message : "Could not process PPT upload.";
      setUploadError(errorMessage);
      toast({ title: "Upload Process Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsUploadingPpt(false);
      setSelectedPptFile(null);
      const fileInput = document.getElementById(`ppt-upload-${uploadingPptIdeaId}`) as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      setUploadingPptIdeaId(null); 
    }
  };

  const handleSaveTeamTable: SubmitHandler<TeamManagementFormData> = async (formData) => {
    if (!selectedIdeaForTeamMgmt || !selectedIdeaForTeamMgmt.id || !user?.uid) {
      toast({ title: "Error", description: "No idea selected or user not found.", variant: "destructive" });
      return;
    }

    const existingMembers = selectedIdeaForTeamMgmt.structuredTeamMembers || [];
    let membersAddedOrUpdatedCount = 0;

    try {
        for (const formMember of formData.members) { 
            if (!formMember.name || formMember.name.trim() === '') {
                // If name is empty, skip this row (treat as empty/not to be saved)
                continue;
            }

            // All other fields are now required by schema if name is present
            const memberData: TeamMember = {
                id: formMember.id || nanoid(), // Use existing ID or generate new for add
                name: formMember.name,
                email: formMember.email!,
                phone: formMember.phone!,
                institute: formMember.institute!,
                department: formMember.department!,
                enrollmentNumber: formMember.enrollmentNumber || '',
            };
            
            const isExistingMemberInForm = formMember.id && existingMembers.some(em => em.id === formMember.id);

            if (isExistingMemberInForm) { 
                await updateTeamMemberInIdea(selectedIdeaForTeamMgmt.id, memberData);
                membersAddedOrUpdatedCount++;
            } else { // This is a new member to add (no existing ID or ID not in current members)
                const ideaDocRef = doc(db, 'ideas', selectedIdeaForTeamMgmt.id);
                const ideaDocSnap = await getDoc(ideaDocRef);
                const currentIdeaData = ideaDocSnap.exists() ? ideaDocSnap.data() as IdeaSubmission : null;
                const currentIdeaMemberCount = currentIdeaData?.structuredTeamMembers?.length || 0;
                
                if (currentIdeaMemberCount < 4) {
                   // Pass data without ID for addTeamMemberToIdea, it will assign one
                   const { id, ...newMemberData } = memberData;
                   await addTeamMemberToIdea(selectedIdeaForTeamMgmt.id, newMemberData);
                   membersAddedOrUpdatedCount++;
                } else {
                   toast({title: "Team Full", description: `Could not add member ${memberData.name}. Maximum 4 members allowed.`, variant: "default"});
                }
            }
        }

        if (membersAddedOrUpdatedCount > 0) {
            toast({ title: "Team Updated", description: "Team member details have been saved." });
        } else {
            toast({ title: "No Changes", description: "No new or modified team member information was provided to save.", variant: "default" });
        }

        fetchUserIdeasAndUpdateState(selectedIdeaForTeamMgmt.id);

    } catch (error) {
        console.error("Error saving team table:", error);
        toast({ title: "Error Saving Team", description: (error as Error).message || "Could not save team member details.", variant: "destructive" });
    }
  };


  const handleRemoveTeamMember = async (memberId: string) => {
    if (!selectedIdeaForTeamMgmt || !selectedIdeaForTeamMgmt.id || !memberId || !user?.uid) return;

    try {
      await removeTeamMemberFromIdea(selectedIdeaForTeamMgmt.id, memberId);
      toast({ title: "Team Member Removed", description: `Member has been removed from the team.` });
      fetchUserIdeasAndUpdateState(selectedIdeaForTeamMgmt.id);
    } catch (error) {
      console.error("Error removing team member:", error);
      toast({ title: "Error Removing Member", description: (error as Error).message || "Could not remove team member.", variant: "destructive" });
    }
    setMemberToRemove(null);
  };

  if (loadingIdeas) { // General loading state for initial data fetch
     return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-12rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading Dashboard...</p>
      </div>
    );
  }

  if (isTeamMemberForIdea) {
    // TEAM MEMBER DASHBOARD VIEW
    return (
      <div className="space-y-6 animate-slide-in-up">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center">
              <Briefcase className="mr-3 h-7 w-7 text-primary" /> Team Member Dashboard
            </CardTitle>
            <CardDescription>
              Welcome, {user?.displayName || userProfile?.fullName || 'Team Member'}! You are part of the following project.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{isTeamMemberForIdea.title}</CardTitle>
            <CardDescription>Project Details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Problem</Label>
              <p className="text-sm whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{isTeamMemberForIdea.problem}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Solution</Label>
              <p className="text-sm whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{isTeamMemberForIdea.solution}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <p><Badge variant={getStatusBadgeVariant(isTeamMemberForIdea.status)} className="capitalize text-sm">{isTeamMemberForIdea.status.replace(/_/g, ' ').toLowerCase()}</Badge></p>
              </div>
              {isTeamMemberForIdea.programPhase && (
                <div>
                  <Label className="text-xs text-muted-foreground">Current Phase</Label>
                  <p><Badge variant="outline" className="capitalize text-sm">{getProgramPhaseLabel(isTeamMemberForIdea.programPhase)}</Badge></p>
                </div>
              )}
            </div>
             {isTeamMemberForIdea.nextPhaseDate && (
                <Card className="mt-3 border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-base font-semibold text-primary flex items-center">
                        <CalendarDays className="h-5 w-5 mr-2"/> Next Step: {getProgramPhaseLabel(isTeamMemberForIdea.programPhase)} Meeting
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm px-4 pb-3 space-y-1 text-foreground/90">
                        <p><strong>Date:</strong> {formatDateWithTime(isTeamMemberForIdea.nextPhaseDate)}</p>
                        <p><strong>Time:</strong> {isTeamMemberForIdea.nextPhaseStartTime} - {isTeamMemberForIdea.nextPhaseEndTime}</p>
                        <p><strong>Venue:</strong> {isTeamMemberForIdea.nextPhaseVenue}</p>
                         {isTeamMemberForIdea.nextPhaseGuidelines && <p className="mt-1"><strong className="text-primary/90">Guidelines:</strong> <span className="text-xs whitespace-pre-wrap">{isTeamMemberForIdea.nextPhaseGuidelines}</span></p>}
                    </CardContent>
                </Card>
            )}
             {isTeamMemberForIdea.programPhase === 'PHASE_2' && isTeamMemberForIdea.phase2PptUrl && (
                <Card className="mt-3 border-primary/30">
                    <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm font-semibold text-primary flex items-center">
                        <Download className="h-4 w-4 mr-2"/> Phase 2 Presentation (Submitted by Team)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs px-4 pb-3">
                        <a href={isTeamMemberForIdea.phase2PptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {isTeamMemberForIdea.phase2PptFileName || 'View Presentation'}
                        </a>
                    </CardContent>
                </Card>
            )}
          </CardContent>
        </Card>

        {teamLeaderProfileForMember && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center">
                <UserCheckIcon className="mr-2 h-6 w-6 text-primary" /> Team Leader Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p><strong>Name:</strong> {teamLeaderProfileForMember.fullName || teamLeaderProfileForMember.displayName}</p>
              <p><strong>Email:</strong> {teamLeaderProfileForMember.email}</p>
              <p><strong>Contact:</strong> {teamLeaderProfileForMember.contactNumber}</p>
            </CardContent>
          </Card>
        )}
         <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => router.push('/dashboard/incubation-phases')}>
                View Incubation Phases <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/announcements')}>
                Check Announcements <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  // IDEA OWNER DASHBOARD VIEW
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="flex w-full flex-wrap items-center justify-start rounded-md bg-muted/60 p-1 mb-4 border-b-2 border-primary/30">
        <TabsTrigger value="overview">Overview & Submissions</TabsTrigger>
        <TabsTrigger value="manageTeam">Manage Team (Max 4)</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Student Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Welcome, {user?.displayName || 'Student'}! Here are your resources and tools.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-6 w-6 text-primary" />
              <CardTitle className="font-headline text-xl">My Idea Submissions</CardTitle>
            </div>
            <CardDescription>Track the status and phase of your innovative ideas submitted to PIERC.</CardDescription>
          </CardHeader>
          <CardContent>
            {isUploadingPpt ? ( // Show a specific loader for PPT uploads
                 <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Uploading presentation...</p>
                </div>
            ) : userIdeas.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">You haven't submitted any ideas yet. Your ideas will appear here once your profile (including startup details) is saved.</p>
            ) : (
              <ScrollArea className="h-auto max-h-[calc(100vh-26rem)] pr-3">
                <ul className="space-y-4">
                  {userIdeas.map((idea) => (
                    <li key={idea.id} className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors shadow-sm">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                          <div>
                              <p className="font-semibold text-foreground text-lg">{idea.title}</p>
                              <p className="text-xs text-muted-foreground">
                                  Submitted: {formatDate(idea.submittedAt)} | Last Updated: {formatDate(idea.updatedAt)}
                              </p>
                              {idea.teamMembers && idea.teamMembers.trim() !== '' && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                      <span className="font-medium">Team Description:</span> {idea.teamMembers}
                                  </p>
                              )}
                              {(idea.structuredTeamMembers && idea.structuredTeamMembers.length > 0) && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    <span className="font-medium">Team Members ({idea.structuredTeamMembers.length}):</span> {idea.structuredTeamMembers.map(m => m.name).join(', ')}
                                </p>
                              )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2 sm:mt-0 flex-shrink-0">
                              <Badge variant={getStatusBadgeVariant(idea.status)} className="capitalize text-xs py-1 px-2.5">
                              {idea.status.replace(/_/g, ' ').toLowerCase()}
                              </Badge>
                              {idea.status === 'SELECTED' && idea.programPhase && (
                                  <Badge variant="outline" className="capitalize text-xs py-1 px-2.5 flex items-center">
                                      <ChevronsRight className="h-3 w-3 mr-1" />
                                      {getProgramPhaseLabel(idea.programPhase)}
                                  </Badge>
                              )}
                              {idea.programPhase === 'PHASE_2' && idea.phase2Marks && (
                              <Badge variant="outline" className="text-xs py-1 px-2.5">
                                      {Object.keys(idea.phase2Marks).length > 0 ? `Marked` : 'Awaiting Marks'}
                              </Badge>
                              )}
                          </div>
                      </div>
                      {idea.status === 'NOT_SELECTED' && idea.rejectionRemarks && (
                          <Card className="mt-3 bg-destructive/10 border-destructive/30">
                              <CardHeader className="pb-2 pt-3 px-4">
                                  <CardTitle className="text-sm font-semibold text-destructive-foreground/90 flex items-center">
                                      <AlertCircle className="h-4 w-4 mr-2"/> Feedback & Guidance
                                  </CardTitle>
                              </CardHeader>
                              <CardContent className="text-xs text-destructive-foreground/80 px-4 pb-3 whitespace-pre-wrap">
                                  {idea.rejectionRemarks}
                                  {idea.rejectedAt && <p className="mt-1 text-destructive-foreground/60">Provided on: {formatDate(idea.rejectedAt)}</p>}
                              </CardContent>
                          </Card>
                      )}
                      {idea.status === 'SELECTED' && idea.programPhase && idea.nextPhaseDate && (
                          <Card className="mt-3 border-primary/30 bg-primary/5">
                              <CardHeader className="pb-2 pt-3 px-4">
                                  <CardTitle className="text-base font-semibold text-primary flex items-center">
                                    <CalendarDays className="h-5 w-5 mr-2"/> Next Step: {getProgramPhaseLabel(idea.programPhase)} Meeting Scheduled
                                  </CardTitle>
                                  <CardDescription className="text-xs">Please find the details for your upcoming meeting below.</CardDescription>
                              </CardHeader>
                              <CardContent className="text-sm px-4 pb-3 space-y-2 text-foreground/90">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                      <p><strong className="text-primary/90">Date:</strong> {formatDateWithTime(idea.nextPhaseDate)}</p>
                                      <p><strong className="text-primary/90">Time:</strong> {idea.nextPhaseStartTime} - {idea.nextPhaseEndTime}</p>
                                  </div>
                                  <p><strong className="text-primary/90">Venue:</strong> {idea.nextPhaseVenue}</p>
                                  {idea.nextPhaseGuidelines && (
                                      <div className="mt-2">
                                          <p className="font-semibold text-primary/90 flex items-center"><ListChecks className="h-4 w-4 mr-1.5"/>Guidelines:</p>
                                          <p className="whitespace-pre-wrap text-xs bg-background/50 p-2 rounded-md mt-1 border border-border">{idea.nextPhaseGuidelines}</p>
                                      </div>
                                  )}
                              </CardContent>
                          </Card>
                      )}
                      {idea.programPhase === 'PHASE_2' && (
                          <Card className="mt-3 border-primary/30">
                              <CardHeader className="pb-2 pt-3 px-4">
                                  <CardTitle className="text-sm font-semibold text-primary flex items-center">
                                    <UploadCloud className="h-4 w-4 mr-2"/> Phase 2 Presentation
                                  </CardTitle>
                              </CardHeader>
                              <CardContent className="text-xs px-4 pb-3 space-y-2">
                                  {idea.phase2PptUrl && idea.phase2PptFileName ? (
                                      <div className="flex items-center justify-between">
                                          <p>Uploaded: <span className="font-medium">{idea.phase2PptFileName}</span></p>
                                          <a href={idea.phase2PptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center">
                                              <Download className="h-3 w-3 mr-1" /> View (Simulated Link)
                                          </a>
                                      </div>
                                  ) : (
                                      <p className="text-muted-foreground">No presentation uploaded yet.</p>
                                  )}
                                  <div className="flex items-center gap-2 pt-1">
                                      <Input
                                          id={`ppt-upload-${idea.id}`}
                                          type="file"
                                          accept=".ppt, .pptx"
                                          onChange={(e) => handlePptFileChange(e, idea.id!)}
                                          className="text-xs h-8 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                          disabled={isUploadingPpt}
                                      />
                                      <Button
                                          size="sm"
                                          onClick={handlePptUpload}
                                          disabled={!selectedPptFile || uploadingPptIdeaId !== idea.id || isUploadingPpt}
                                          className="h-8"
                                      >
                                          {isUploadingPpt && uploadingPptIdeaId === idea.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UploadCloud className="h-4 w-4 mr-1"/>}
                                          Upload
                                      </Button>
                                  </div>
                                  {uploadError && uploadingPptIdeaId === idea.id && <p className="text-destructive text-xs mt-1">{uploadError}</p>}
                                  <p className="text-muted-foreground text-xs italic">Upload uses a simulated flow. Actual storage integration is a future step.</p>
                              </CardContent>
                          </Card>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
          <CardFooter>
              <p className="text-xs text-muted-foreground">Your idea submissions are automatically created when you save your profile with startup details.</p>
          </CardFooter>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Learning Resources</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Explore</div>
              <p className="text-xs text-muted-foreground">
                Access workshops & materials (Coming Soon).
              </p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collaboration Hub</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Connect</div>
              <p className="text-xs text-muted-foreground">
                Find team members & mentors (Coming Soon).
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => router.push('/dashboard/incubation-phases')}>
                View Incubation Phases <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/announcements')}>
                Check Announcements <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" disabled>
                Research Repository (Coming Soon)
              </Button>
              <Button variant="outline" onClick={() => router.push('/profile-setup')}>
                My Profile <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="manageTeam" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl">Manage Team Members</CardTitle>
            <CardDescription>Select an idea to add, edit, or view its team members. You can add up to 4 members.</CardDescription>
          </CardHeader>
          <CardContent>
            {userIdeas.length === 0 ? (
              <p className="text-muted-foreground">You have no submitted ideas to manage teams for.</p>
            ) : (
              <div className="space-y-2 mb-6">
                <Label>Select an Idea to Manage its Team:</Label>
                <ScrollArea className="h-auto max-h-40 border rounded-md">
                  <div className="p-2 space-y-1">
                  {userIdeas.map(idea => (
                    <Button
                      key={idea.id}
                      variant={selectedIdeaForTeamMgmt?.id === idea.id ? "default" : "outline"}
                      className="w-full justify-start text-left"
                      onClick={() => setSelectedIdeaForTeamMgmt(idea)}
                    >
                      {idea.title}
                    </Button>
                  ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {selectedIdeaForTeamMgmt && (
              <form onSubmit={handleSubmit(handleSaveTeamTable)} className="space-y-6">
                <h3 className="text-lg font-semibold mb-1">Edit Team for: <span className="text-primary">{selectedIdeaForTeamMgmt.title}</span></h3>
                <p className="text-sm text-muted-foreground mb-3">
                    Current Members: {selectedIdeaForTeamMgmt.structuredTeamMembers?.length || 0} / 4.
                    Fill in the table below. Empty rows with no name will be ignored.
                </p>

                {teamManagementErrors.members?.root && <p className="text-sm text-destructive -mt-2 mb-2">{teamManagementErrors.members.root.message}</p>}
                {teamManagementErrors.members?.message && <p className="text-sm text-destructive -mt-2 mb-2">{teamManagementErrors.members.message}</p>}


                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Member #</TableHead>
                                <TableHead className="min-w-[150px]">Name</TableHead>
                                <TableHead className="min-w-[200px]">Email</TableHead>
                                <TableHead className="min-w-[120px]">Phone</TableHead>
                                <TableHead className="min-w-[150px]">Institute</TableHead>
                                <TableHead className="min-w-[150px]">Department</TableHead>
                                <TableHead className="min-w-[150px]">Enrollment No.</TableHead>
                                <TableHead className="w-[50px] text-right">Del</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((item, index) => (
                                <TableRow key={item.id}>
                                    <TableCell className="p-1 font-medium text-muted-foreground">Member {index + 1}</TableCell>
                                    <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.name`}
                                            control={control}
                                            render={({ field }) => <Input {...field} className="text-xs h-9" />}
                                        />
                                        {teamManagementErrors.members?.[index]?.name && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.name?.message}</p>}
                                        {teamManagementErrors.members?.[index]?.root && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.root?.message}</p>}
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.email`}
                                            control={control}
                                            render={({ field }) => <Input type="email" {...field} className="text-xs h-9" />}
                                        />
                                        {teamManagementErrors.members?.[index]?.email && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.email?.message}</p>}
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.phone`}
                                            control={control}
                                            render={({ field }) => <Input type="tel" {...field} className="text-xs h-9" />}
                                        />
                                        {teamManagementErrors.members?.[index]?.phone && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.phone?.message}</p>}
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.institute`}
                                            control={control}
                                            render={({ field }) => <Input {...field} className="text-xs h-9" />}
                                        />
                                        {teamManagementErrors.members?.[index]?.institute && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.institute?.message}</p>}
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.department`}
                                            control={control}
                                            render={({ field }) => <Input {...field} className="text-xs h-9" />}
                                        />
                                        {teamManagementErrors.members?.[index]?.department && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.department?.message}</p>}
                                    </TableCell>
                                     <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.enrollmentNumber`}
                                            control={control}
                                            render={({ field }) => <Input {...field} className="text-xs h-9" />}
                                        />
                                    </TableCell>
                                    <TableCell className="p-1 text-right">
                                        <Controller name={`members.${index}.id`} control={control} render={({ field }) => <input type="hidden" {...field} />} />
                                        
                                        {getValues(`members.${index}.id`) && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" onClick={() => {
                                                        const memberDataForThisRow = getValues(`members.${index}`);
                                                        if(memberDataForThisRow && memberDataForThisRow.id) {
                                                            setMemberToRemove(memberDataForThisRow as TeamMember);
                                                        }
                                                    }}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                {memberToRemove && memberToRemove.id === getValues(`members.${index}.id`) && (
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                        <AlertDialogTitle>Remove {memberToRemove.name || 'this member'}?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to remove {memberToRemove.name || 'this member'} from the team for "{selectedIdeaForTeamMgmt!.title}"? This action is permanent.
                                                        </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setMemberToRemove(null)}>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleRemoveTeamMember(memberToRemove!.id)} className="bg-destructive hover:bg-destructive/90">
                                                            Remove Member
                                                        </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                )}
                                            </AlertDialog>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 {teamManagementErrors && Object.keys(teamManagementErrors).length > 0 && !teamManagementErrors.members && (
                    <p className="text-sm text-destructive mt-1">
                        Please correct the errors in the form. Remember, if a name is provided for a member, all other fields (except Enrollment No.) for that member become required.
                    </p>
                )}


                <Button type="submit" disabled={isSubmittingTeamTable} className="mt-4">
                    {isSubmittingTeamTable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4"/> Save Team Changes
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
    
