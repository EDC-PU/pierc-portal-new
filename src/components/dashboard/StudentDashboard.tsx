
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Lightbulb, Users, Activity, Loader2, ArrowRight, FileCheck2, Clock, ChevronsRight, UploadCloud, FileQuestion, AlertCircle, Download, CalendarDays, MapPin, ListChecks, Trash2, PlusCircle, Edit2, Save } from 'lucide-react';
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
import type { ProgramPhase, TeamMember } from '@/types';
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
  id: z.string().optional(), // Optional: will exist for loaded members, not for new ones in table
  name: z.string().min(1, "Name is required").max(100).optional().or(z.literal('')),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().min(10, "Contact number must be at least 10 digits").max(15).optional().or(z.literal('')),
  institute: z.string().min(1, "Institute is required").max(100).optional().or(z.literal('')),
  department: z.string().min(1, "Department is required").max(100).optional().or(z.literal('')),
  enrollmentNumber: z.string().max(50).optional().or(z.literal('')),
}).refine(data => {
    // If a name is provided, then email, phone, institute, and department must also be provided.
    if (data.name && data.name.trim() !== '') {
        return !!(data.email && data.email.trim() !== '' &&
                  data.phone && data.phone.trim() !== '' &&
                  data.institute && data.institute.trim() !== '' &&
                  data.department && data.department.trim() !== '');
    }
    // If name is empty, other fields can be empty (representing an empty row)
    return true;
}, {
    message: "If member name is provided, then email, phone, institute, and department are also required.",
    // Path can be more specific if needed, but generally applies to the whole object
    // when a name is present but other fields are missing.
    path: ['name'], 
});


const teamManagementSchema = z.object({
  members: z.array(teamMemberSchema).max(4),
});
type TeamManagementFormData = z.infer<typeof teamManagementSchema>;


export default function StudentDashboard() {
  const { user } = useAuth(); 
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


  const { control, handleSubmit, reset: resetTeamManagementForm, formState: { errors: teamManagementErrors, isSubmitting: isSubmittingTeamTable } } = useForm<TeamManagementFormData>({
    resolver: zodResolver(teamManagementSchema),
    defaultValues: {
      members: Array(4).fill({ id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' }),
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
            // Repopulate form if an idea is selected
            if (updatedSelected) {
                const currentMembers = updatedSelected.structuredTeamMembers || [];
                const formMembers = Array(4).fill(null).map((_, i) => 
                    currentMembers[i] || { id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' }
                );
                resetTeamManagementForm({ members: formMembers });
            } else {
                 resetTeamManagementForm({ members: Array(4).fill({ id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' }) });
            }
        } else if (ideas.length > 0 && !selectedIdeaForTeamMgmt) {
             // If no idea was previously selected for team mgmt, but ideas exist,
             // you might want to auto-select the first one or clear the form.
             // For now, clearing:
             resetTeamManagementForm({ members: Array(4).fill({ id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' }) });
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
    if (user?.uid) {
      fetchUserIdeasAndUpdateState(selectedIdeaForTeamMgmt?.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]); 
  
  // Effect to update form when selectedIdeaForTeamMgmt changes
  useEffect(() => {
    if (selectedIdeaForTeamMgmt) {
        const currentMembers = selectedIdeaForTeamMgmt.structuredTeamMembers || [];
        const formMembersData = Array(4).fill(null).map((_, i) => {
            const member = currentMembers[i];
            return member 
                ? { ...member, id: member.id || nanoid() } // Ensure ID exists for existing members
                : { id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' };
        });
        resetTeamManagementForm({ members: formMembersData });
    } else {
        resetTeamManagementForm({ members: Array(4).fill({ id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' }) });
    }
  }, [selectedIdeaForTeamMgmt, resetTeamManagementForm]);


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
      setUploadingPptIdeaId(null);
      const fileInput = document.getElementById(`ppt-upload-${uploadingPptIdeaId}`) as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const handleSaveTeamTable: SubmitHandler<TeamManagementFormData> = async (formData) => {
    if (!selectedIdeaForTeamMgmt || !selectedIdeaForTeamMgmt.id || !user?.uid) {
      toast({ title: "Error", description: "No idea selected or user not found.", variant: "destructive" });
      return;
    }

    let membersProcessedCount = 0;
    const existingMembers = selectedIdeaForTeamMgmt.structuredTeamMembers || [];
    
    // Filter out invalid entries from the form before processing
    const validFormMembers = formData.members.filter(member => member.name && member.name.trim() !== '');

    if (validFormMembers.length > 4) {
        toast({ title: "Limit Exceeded", description: "You can save a maximum of 4 team members.", variant: "destructive" });
        return;
    }

    try {
        // This simplified loop processes adds and updates based on presence of ID.
        // It does not handle removals by clearing rows, keep separate remove buttons for that.
        for (const formMember of validFormMembers) {
            if (!formMember.name || formMember.name.trim() === '') continue; // Skip empty name entries just in case

            // Validate again with refined schema for individual member if needed, or rely on array item schema.
            // The .refine in teamMemberSchema should catch if name is present but others are not.

            const memberData = {
                name: formMember.name,
                email: formMember.email!, // Assert non-null due to refine or ensure schema makes them non-optional if name is present
                phone: formMember.phone!,
                institute: formMember.institute!,
                department: formMember.department!,
                enrollmentNumber: formMember.enrollmentNumber || '',
            };

            if (formMember.id && existingMembers.some(em => em.id === formMember.id)) { // Existing member, update
                await updateTeamMemberInIdea(selectedIdeaForTeamMgmt.id, { ...memberData, id: formMember.id });
                membersProcessedCount++;
            } else { // New member, add
                 if ((existingMembers.length + (membersProcessedCount - existingMembers.filter(em => validFormMembers.some(fm => fm.id === em.id)).length)) < 4) {
                    await addTeamMemberToIdea(selectedIdeaForTeamMgmt.id, { ...memberData, id: nanoid() });
                    membersProcessedCount++;
                 } else {
                    toast({title: "Info", description: `Could not add member ${formMember.name} as team limit of 4 is reached.`, variant: "default"});
                 }
            }
        }

        if (membersProcessedCount > 0) {
            toast({ title: "Team Updated", description: "Team member details have been saved." });
        } else if (validFormMembers.length === 0 && existingMembers.length > 0) {
             toast({ title: "No Changes", description: "No new member information was provided to save. To remove members, use the delete icon.", variant: "default" });
        } else {
            toast({ title: "No Changes", description: "No team member information was provided to save.", variant: "default" });
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
            {loadingIdeas && !isUploadingPpt ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading your submissions...</p>
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
             {loadingIdeas ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading ideas...</div>
            ) : userIdeas.length === 0 ? (
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
                                        {/* Hidden ID field for existing members */}
                                        <Controller name={`members.${index}.id`} control={control} render={({ field }) => <input type="hidden" {...field} />} />
                                        
                                        {selectedIdeaForTeamMgmt.structuredTeamMembers?.find(m => m.id === item.id || (m.id === fields[index].id && fields[index].id)) && ( // Check if this row corresponds to a saved member
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" onClick={() => {
                                                        const memberId = fields[index].id; // This ID should be from the loaded data
                                                        const member = selectedIdeaForTeamMgmt.structuredTeamMembers?.find(m => m.id === memberId);
                                                        if(member) setMemberToRemove(member);
                                                    }}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                {memberToRemove?.id === fields[index].id && (
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                    <AlertDialogTitle>Remove {memberToRemove?.name || 'this member'}?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Are you sure you want to remove {memberToRemove?.name || 'this member'} from the team for "{selectedIdeaForTeamMgmt.title}"? This action is permanent.
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
    

    


