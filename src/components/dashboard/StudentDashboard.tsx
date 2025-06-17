
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Lightbulb, Users, Activity, Loader2, ArrowRight, FileCheck2, Clock, ChevronsRight, UploadCloud, FileQuestion, AlertCircle, Download, CalendarDays, MapPin, ListChecks } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserIdeaSubmissionsWithStatus, type IdeaSubmission, updateIdeaPhase2PptDetails } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Timestamp } from 'firebase/firestore';
import type { ProgramPhase } from '@/types';
import { Input } from '../ui/input';
import { format, isValid } from 'date-fns';
import { uploadPresentation } from '@/ai/flows/upload-presentation-flow';


const getProgramPhaseLabel = (phase: ProgramPhase | null | undefined): string => {
  if (!phase) return ''; 
  switch (phase) {
    case 'PHASE_1': return 'Phase 1';
    case 'PHASE_2': return 'Phase 2';
    case 'COHORT': return 'Cohort';
    default: return '';
  }
};

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

  useEffect(() => {
    const fetchUserIdeas = async () => {
      if (user?.uid) {
        setLoadingIdeas(true);
        try {
          const ideas = await getUserIdeaSubmissionsWithStatus(user.uid);
          setUserIdeas(ideas);
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
  }, [user?.uid, toast]); 
  
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
      
      // Refresh ideas list
      const ideas = await getUserIdeaSubmissionsWithStatus(user.uid);
      setUserIdeas(ideas);

    } catch (error) {
      console.error("Error during PPT upload process:", error);
      const errorMessage = (error instanceof Error) ? error.message : "Could not process PPT upload.";
      setUploadError(errorMessage);
      toast({ title: "Upload Process Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsUploadingPpt(false);
      setSelectedPptFile(null);
      setUploadingPptIdeaId(null);
      // Clear the file input visually
      const fileInput = document.getElementById(`ppt-upload-${uploadingPptIdeaId}`) as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };


  return (
    <div className="space-y-6">
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
                                        {/* Actual download link for admins might be in admin panel */}
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
    </div>
  );
}
