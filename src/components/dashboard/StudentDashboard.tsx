
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Lightbulb, Users, Activity, Loader2, ArrowRight, FileCheck2, Clock, ChevronsRight, UploadCloud, FileQuestion, AlertCircle, Download, CalendarDays, MapPin, ListChecks, Trash2, PlusCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getUserIdeaSubmissionsWithStatus, 
  type IdeaSubmission, 
  updateIdeaPhase2PptDetails,
  addTeamMemberToIdea,
  removeTeamMemberFromIdea
} from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Timestamp } from 'firebase/firestore';
import type { ProgramPhase, TeamMember } from '@/types';
import { format, isValid } from 'date-fns';
import { uploadPresentation } from '@/ai/flows/upload-presentation-flow';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
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
  name: z.string().min(3, "Full name must be at least 3 characters").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Contact number must be at least 10 digits").max(15),
  institute: z.string().min(2, "Institute name is required").max(100),
  department: z.string().min(2, "Department name is required").max(100),
  enrollmentNumber: z.string().max(50).optional(),
});
type TeamMemberFormData = z.infer<typeof teamMemberSchema>;

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
  const [isTeamMemberFormOpen, setIsTeamMemberFormOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);


  const { control, handleSubmit, reset: resetTeamMemberForm, formState: { errors: teamMemberErrors, isSubmitting: isSubmittingTeamMember } } = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      institute: '',
      department: '',
      enrollmentNumber: '',
    },
  });

  useEffect(() => {
    const fetchUserIdeas = async () => {
      if (user?.uid) {
        setLoadingIdeas(true);
        try {
          const ideas = await getUserIdeaSubmissionsWithStatus(user.uid);
          setUserIdeas(ideas);
           if (ideas.length > 0 && !selectedIdeaForTeamMgmt) {
            // Optionally pre-select the first idea for team management
            // setSelectedIdeaForTeamMgmt(ideas[0]);
          }
        } catch (error) {
          console.error("Error fetching user ideas:", error);
          toast({ title: "Error", description: "Could not load your idea submissions.", variant: "destructive" });
          setUserIdeas([]);
        } finally {
          setLoadingIdeas(false);
        }
      } else {
        setUserIdeas([]); 
        setLoadingIdeas(false);
      }
    };

    if (user?.uid) {
      fetchUserIdeas();
    }
  }, [user?.uid, toast, selectedIdeaForTeamMgmt]); 
  
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
      
      const ideas = await getUserIdeaSubmissionsWithStatus(user.uid);
      setUserIdeas(ideas);
      const updatedSelectedIdea = ideas.find(idea => idea.id === selectedIdeaForTeamMgmt?.id);
      if (updatedSelectedIdea) setSelectedIdeaForTeamMgmt(updatedSelectedIdea);


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

  const handleAddTeamMember: SubmitHandler<TeamMemberFormData> = async (data) => {
    if (!selectedIdeaForTeamMgmt || !selectedIdeaForTeamMgmt.id) {
      toast({ title: "Error", description: "No idea selected for team management.", variant: "destructive" });
      return;
    }
    if ((selectedIdeaForTeamMgmt.structuredTeamMembers?.length || 0) >= 4) {
      toast({ title: "Limit Reached", description: "You can add a maximum of 4 team members.", variant: "destructive" });
      return;
    }

    const newMember: TeamMember = {
      id: nanoid(), // Generate unique ID for the member
      ...data,
    };

    try {
      await addTeamMemberToIdea(selectedIdeaForTeamMgmt.id, newMember);
      toast({ title: "Team Member Added", description: `${data.name} has been added to the team for "${selectedIdeaForTeamMgmt.title}".` });
      resetTeamMemberForm();
      setIsTeamMemberFormOpen(false);
      // Refresh ideas or just the selected one
      const updatedIdeas = await getUserIdeaSubmissionsWithStatus(user!.uid);
      setUserIdeas(updatedIdeas);
      const updatedSelected = updatedIdeas.find(idea => idea.id === selectedIdeaForTeamMgmt.id);
      setSelectedIdeaForTeamMgmt(updatedSelected || null);
    } catch (error) {
      console.error("Error adding team member:", error);
      toast({ title: "Error Adding Member", description: (error as Error).message || "Could not add team member.", variant: "destructive" });
    }
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    if (!selectedIdeaForTeamMgmt || !selectedIdeaForTeamMgmt.id || !memberId) return;
    
    try {
      await removeTeamMemberFromIdea(selectedIdeaForTeamMgmt.id, memberId);
      toast({ title: "Team Member Removed", description: `Member has been removed from the team for "${selectedIdeaForTeamMgmt.title}".` });
      // Refresh ideas or just the selected one
      const updatedIdeas = await getUserIdeaSubmissionsWithStatus(user!.uid);
      setUserIdeas(updatedIdeas);
      const updatedSelected = updatedIdeas.find(idea => idea.id === selectedIdeaForTeamMgmt.id);
      setSelectedIdeaForTeamMgmt(updatedSelected || null);
    } catch (error) {
      console.error("Error removing team member:", error);
      toast({ title: "Error Removing Member", description: (error as Error).message || "Could not remove team member.", variant: "destructive" });
    }
    setMemberToRemove(null); // Close dialog
  };


  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="flex w-full flex-wrap items-center justify-start rounded-md bg-muted/60 p-1 mb-4 border-b-2 border-primary/30">
        <TabsTrigger value="overview">Overview & Submissions</TabsTrigger>
        <TabsTrigger value="manageTeam">Manage Team</TabsTrigger>
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
            <CardDescription>Add or remove team members for your submitted ideas. Max 4 members per idea (excluding yourself as leader).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingIdeas ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading ideas...</div>
            ) : userIdeas.length === 0 ? (
              <p className="text-muted-foreground">You have no submitted ideas to manage teams for.</p>
            ) : (
              <div className="space-y-2">
                <Label>Select an Idea to Manage its Team:</Label>
                <ScrollArea className="h-auto max-h-40 border rounded-md">
                  <div className="p-2 space-y-1">
                  {userIdeas.map(idea => (
                    <Button 
                      key={idea.id} 
                      variant={selectedIdeaForTeamMgmt?.id === idea.id ? "default" : "outline"} 
                      className="w-full justify-start text-left"
                      onClick={() => {
                        setSelectedIdeaForTeamMgmt(idea);
                        setIsTeamMemberFormOpen(false); // Close form if open for another idea
                        resetTeamMemberForm(); // Reset form when switching ideas
                      }}
                    >
                      {idea.title}
                    </Button>
                  ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {selectedIdeaForTeamMgmt && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-3">Team for: <span className="text-primary">{selectedIdeaForTeamMgmt.title}</span></h3>
                
                {(selectedIdeaForTeamMgmt.structuredTeamMembers?.length || 0) > 0 ? (
                  <div className="space-y-3 mb-4">
                    <h4 className="text-md font-medium">Current Team Members ({selectedIdeaForTeamMgmt.structuredTeamMembers?.length || 0}/4):</h4>
                    <ul className="space-y-2">
                      {selectedIdeaForTeamMgmt.structuredTeamMembers?.map(member => (
                        <li key={member.id} className="flex justify-between items-center p-3 border rounded-md bg-card hover:bg-muted/50">
                          <div>
                            <p className="font-semibold">{member.name} <span className="text-xs text-muted-foreground">({member.email})</span></p>
                            <p className="text-xs text-muted-foreground">{member.institute} - {member.department}</p>
                            {member.phone && <p className="text-xs text-muted-foreground">Phone: {member.phone}</p>}
                            {member.enrollmentNumber && <p className="text-xs text-muted-foreground">Enrollment: {member.enrollmentNumber}</p>}
                          </div>
                           <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setMemberToRemove(member)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              {memberToRemove?.id === member.id && (
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove {member.name} from the team for "{selectedIdeaForTeamMgmt.title}"?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setMemberToRemove(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemoveTeamMember(member.id)} className="bg-destructive hover:bg-destructive/90">
                                      Remove Member
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              )}
                            </AlertDialog>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground mb-4">No team members added yet for this idea.</p>
                )}

                {(!selectedIdeaForTeamMgmt.structuredTeamMembers || selectedIdeaForTeamMgmt.structuredTeamMembers.length < 4) && (
                  <Button onClick={() => { setIsTeamMemberFormOpen(prev => !prev); resetTeamMemberForm(); }} variant="outline" className="mb-4">
                    <PlusCircle className="mr-2 h-4 w-4"/> {isTeamMemberFormOpen ? 'Cancel Adding Member' : 'Add New Team Member'}
                  </Button>
                )}
                {selectedIdeaForTeamMgmt.structuredTeamMembers && selectedIdeaForTeamMgmt.structuredTeamMembers.length >= 4 && (
                    <p className="text-sm text-primary mb-4">Maximum of 4 team members reached.</p>
                )}

                {isTeamMemberFormOpen && (!selectedIdeaForTeamMgmt.structuredTeamMembers || selectedIdeaForTeamMgmt.structuredTeamMembers.length < 4) && (
                  <form onSubmit={handleSubmit(handleAddTeamMember)} className="space-y-4 p-4 border rounded-md bg-muted/20">
                    <h4 className="text-md font-medium mb-2">New Team Member Details:</h4>
                    <div>
                      <Label htmlFor="memberName">Full Name</Label>
                      <Controller name="name" control={control} render={({ field }) => <Input id="memberName" placeholder="Team member's full name" {...field} />} />
                      {teamMemberErrors.name && <p className="text-sm text-destructive mt-1">{teamMemberErrors.name.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="memberEmail">Email</Label>
                      <Controller name="email" control={control} render={({ field }) => <Input id="memberEmail" type="email" placeholder="member@example.com" {...field} />} />
                      {teamMemberErrors.email && <p className="text-sm text-destructive mt-1">{teamMemberErrors.email.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="memberPhone">Phone Number</Label>
                      <Controller name="phone" control={control} render={({ field }) => <Input id="memberPhone" type="tel" placeholder="+91 XXXXXXXXXX" {...field} />} />
                      {teamMemberErrors.phone && <p className="text-sm text-destructive mt-1">{teamMemberErrors.phone.message}</p>}
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="memberInstitute">Institute/Organization</Label>
                          <Controller name="institute" control={control} render={({ field }) => <Input id="memberInstitute" placeholder="e.g., Parul University" {...field} />} />
                          {teamMemberErrors.institute && <p className="text-sm text-destructive mt-1">{teamMemberErrors.institute.message}</p>}
                        </div>
                        <div>
                          <Label htmlFor="memberDepartment">Department/Branch</Label>
                          <Controller name="department" control={control} render={({ field }) => <Input id="memberDepartment" placeholder="e.g., Computer Engineering" {...field} />} />
                          {teamMemberErrors.department && <p className="text-sm text-destructive mt-1">{teamMemberErrors.department.message}</p>}
                        </div>
                    </div>
                    <div>
                      <Label htmlFor="memberEnrollmentNumber">Enrollment Number (Optional)</Label>
                      <Controller name="enrollmentNumber" control={control} render={({ field }) => <Input id="memberEnrollmentNumber" placeholder="If applicable" {...field} />} />
                      {teamMemberErrors.enrollmentNumber && <p className="text-sm text-destructive mt-1">{teamMemberErrors.enrollmentNumber.message}</p>}
                    </div>
                    <Button type="submit" disabled={isSubmittingTeamMember}>
                      {isSubmittingTeamMember && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Member to "{selectedIdeaForTeamMgmt.title}"
                    </Button>
                  </form>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

