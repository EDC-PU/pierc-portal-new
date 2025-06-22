
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Users, Settings, BarChart3, Megaphone, UserCog, Loader2, FileText, BarChartBig, Award, Eye, Info, Star, UserCheck as UserCheckIcon, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
    getTotalUsersCount, 
    getTotalIdeasCount, 
    getPendingIdeasCount, 
    getIdeasAssignedToMentor,
    submitOrUpdatePhase2Mark,
    getIdeaById
} from '@/lib/firebase/firestore';
import type { IdeaSubmission, MentorName, AdminMark } from '@/types';
import { AVAILABLE_MENTORS_DATA } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import { IdeaComments } from './IdeaComments';
import type { Timestamp } from 'firebase/firestore';


interface DashboardStats {
  totalUsers: number | null;
  activeProjects: number | null;
  pendingProjects: number | null;
}

const MarkdownDisplayComponents = {
  p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
  ul: ({node, ...props}: any) => <ul className="list-disc pl-5 mb-2" {...props} />,
  ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 mb-2" {...props} />,
  li: ({node, ...props}: any) => <li className="mb-1" {...props} />,
  strong: ({node, ...props}: any) => <strong className="font-semibold" {...props} />,
  em: ({node, ...props}: any) => <em className="italic" {...props} />,
};


const getProgramPhaseLabel = (phase: IdeaSubmission['programPhase']): string => {
  if (!phase) return 'N/A';
  switch (phase) {
    case 'PHASE_1': return 'Phase 1';
    case 'PHASE_2': return 'Phase 2';
    case 'COHORT': return 'Cohort';
    case 'INCUBATED': return 'Incubated (Funding)';
    default: return 'N/A';
  }
};

const getStatusBadgeVariant = (status?: IdeaSubmission['status']) => {
    if (!status) return 'secondary';
    switch (status) {
      case 'SELECTED': return 'default';
      case 'SUBMITTED': return 'secondary';
      case 'UNDER_REVIEW': return 'outline';
      case 'IN_EVALUATION': return 'outline';
      case 'ARCHIVED_BY_ADMIN': return 'destructive';
      case 'NOT_SELECTED': return 'destructive';
      default: return 'secondary';
    }
};

export default function AdminDashboard() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: null,
    activeProjects: null,
    pendingProjects: null,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const [assignedMentorIdeas, setAssignedMentorIdeas] = useState<IdeaSubmission[]>([]);
  const [loadingMentorIdeas, setLoadingMentorIdeas] = useState(false);
  const [currentMentorName, setCurrentMentorName] = useState<MentorName | null>(null);

  const [selectedIdea, setSelectedIdea] = useState<IdeaSubmission | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [currentAdminMark, setCurrentAdminMark] = useState<string>('');
  const [isSavingMark, setIsSavingMark] = useState(false);


  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const [usersCount, ideasCount, pendingIdeas] = await Promise.all([
          getTotalUsersCount(),
          getTotalIdeasCount(),
          getPendingIdeasCount()
        ]);
        setStats({
          totalUsers: usersCount,
          activeProjects: ideasCount,
          pendingProjects: pendingIdeas,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        toast({
          title: "Error Loading Stats",
          description: "Could not load dashboard statistics.",
          variant: "destructive",
        });
        setStats({ totalUsers: 0, activeProjects: 0, pendingProjects: 0 });
      } finally {
        setLoadingStats(false);
      }
    };
    
    const fetchMentorData = async (mentorName: MentorName) => {
        setLoadingMentorIdeas(true);
        try {
            const ideas = await getIdeasAssignedToMentor(mentorName);
            setAssignedMentorIdeas(ideas);
        } catch (err) {
            console.error("Error fetching assigned mentor ideas:", err);
            toast({ title: "Error", description: "Could not load your assigned ideas.", variant: "destructive" });
        } finally {
            setLoadingMentorIdeas(false);
        }
    };


    if (userProfile?.role === 'ADMIN_FACULTY') {
      fetchStats();

      if (userProfile.email) {
        const adminEmail = userProfile.email.toLowerCase();
        const matchedMentor = AVAILABLE_MENTORS_DATA.find(mentor => mentor.email.toLowerCase() === adminEmail);

        if (matchedMentor) {
          const mentorName = matchedMentor.name as MentorName; 
          setCurrentMentorName(mentorName); 
          fetchMentorData(mentorName);
        } else {
          setCurrentMentorName(null);
          setAssignedMentorIdeas([]);
          setLoadingMentorIdeas(false); 
        }
      } else {
        setCurrentMentorName(null);
        setAssignedMentorIdeas([]);
        setLoadingMentorIdeas(false); 
      }
    }
  }, [userProfile, toast]);

  useEffect(() => {
    if (selectedIdea && userProfile && selectedIdea.programPhase === 'PHASE_2') {
      const markEntry = selectedIdea.phase2Marks?.[userProfile.uid];
      setCurrentAdminMark(markEntry?.mark?.toString() || '');
    } else {
      setCurrentAdminMark('');
    }
  }, [selectedIdea, userProfile]);

  const openDetailModal = async (ideaId: string) => {
    const ideaDetails = await getIdeaById(ideaId);
    if(ideaDetails){
      setSelectedIdea(ideaDetails);
      setIsDetailModalOpen(true);
    } else {
      toast({ title: "Error", description: "Could not fetch idea details.", variant: "destructive" });
    }
  };

  const handleSaveMark = async () => {
    if (!selectedIdea || !selectedIdea.id || !userProfile) return;
    if (selectedIdea.programPhase !== 'PHASE_2') {
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
        await submitOrUpdatePhase2Mark(selectedIdea.id, selectedIdea.title, userProfile, markValue);
        toast({ title: "Mark Saved", description: "Your mark has been successfully submitted." });
        
        const updatedMarks = {
            ...(selectedIdea.phase2Marks || {}),
            [userProfile.uid]: { mark: markValue, adminDisplayName: userProfile.displayName || 'Admin', markedAt: new Date() } as AdminMark
        };
        if(markValue === null) delete updatedMarks[userProfile.uid];
        setSelectedIdea(prev => prev ? {...prev, phase2Marks: updatedMarks} : null);

    } catch (error) {
        toast({ title: "Save Mark Error", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsSavingMark(false);
    }
  };
  
  const formatDateOnly = (dateValue: Date | Timestamp | undefined | null): string => {
    if (!dateValue) return 'N/A';
    let dateToFormat: Date;
     if ((dateValue as Timestamp)?.toDate) {
      dateToFormat = (dateValue as Timestamp).toDate();
    } else if (dateValue instanceof Date) {
      dateToFormat = dateValue;
    } else {
      return 'Invalid Date';
    }
    if (!isValid(dateToFormat)) return 'Invalid Date';
    return format(dateToFormat, 'MMM d, yyyy');
  }
  
  const refetchMentorIdeas = async () => {
    if (currentMentorName) {
        setLoadingMentorIdeas(true);
        try {
            const ideas = await getIdeasAssignedToMentor(currentMentorName);
            setAssignedMentorIdeas(ideas);
        } catch (err) {
            console.error("Error refetching mentor ideas:", err);
            toast({ title: "Error", description: "Could not refresh your assigned ideas.", variant: "destructive" });
        } finally {
            setLoadingMentorIdeas(false);
        }
    }
  };


  const StatDisplay = ({ value }: { value: number | null }) => {
    if (loadingStats) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
    if (value === null) return <span className="text-muted-foreground">N/A</span>;
    return <>{value}</>;
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Administrator & Faculty Dashboard</CardTitle>
          <CardDescription>Manage portal content, users, and view analytics. {currentMentorName ? `Mentoring as: ${currentMentorName}.` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Overview of portal activities and management tools.</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <StatDisplay value={stats.totalUsers} />
            </div>
          </CardContent>
        </Card>
         <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submitted Ideas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <StatDisplay value={stats.activeProjects} />
            </div>
            {stats.pendingProjects !== null && !loadingStats && (
                <p className="text-xs text-muted-foreground">
                    <StatDisplay value={stats.pendingProjects} /> pending submission review
                </p>
            )}
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Announcements</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Manage</div>
             <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => router.push('/dashboard/admin/manage-announcements')}>Access</Button>
          </CardContent>
        </Card>
         <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Settings</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">Configuration</div>
            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => router.push('/dashboard/admin/system-settings')}>Access</Button>
          </CardContent>
        </Card>
      </div>

      {currentMentorName && (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center">
                <Award className="mr-2 h-5 w-5 text-primary" /> My Assigned Ideas for Mentorship
            </CardTitle>
            <CardDescription>Overview of ideas you are mentoring.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMentorIdeas ? (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading assigned ideas...</p>
                </div>
            ) : assignedMentorIdeas.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">You currently have no ideas assigned for mentorship.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Idea Title</TableHead>
                      <TableHead className="hidden md:table-cell">Applicant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Phase</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedMentorIdeas.map((idea) => (
                      <TableRow key={idea.id}>
                        <TableCell className="font-medium max-w-xs truncate" title={idea.title}>{idea.title}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{idea.applicantDisplayName}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(idea.status)} className="capitalize text-xs">
                            {idea.status.replace(/_/g, ' ').toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground capitalize">
                          {getProgramPhaseLabel(idea.programPhase)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openDetailModal(idea.id!)}>
                            <Eye className="mr-2 h-4 w-4"/> View & Act
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Management Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="outline" onClick={() => router.push('/dashboard/admin/manage-announcements')}>
            <Megaphone className="mr-2 h-4 w-4" /> Manage Announcements
          </Button>
           <Button variant="outline" onClick={() => router.push('/dashboard/admin/system-settings')}>
            <Settings className="mr-2 h-4 w-4" /> System Settings
          </Button>
           {userProfile?.isSuperAdmin && (
            <Button variant="outline" onClick={() => router.push('/dashboard/admin/manage-users')}>
              <UserCog className="mr-2 h-4 w-4" /> Manage Users & Permissions
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/dashboard/admin/view-applications')}>
            <FileText className="mr-2 h-4 w-4" /> View Incubation Applications
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/admin/platform-analytics')}>
            <BarChartBig className="mr-2 h-4 w-4" /> Platform Analytics
          </Button>
        </CardContent>
      </Card>

      {selectedIdea && userProfile && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl flex items-center">
                <Info className="h-6 w-6 mr-2 text-primary" /> Mentorship View: Idea Details
              </DialogTitle>
              <DialogDescription>
                Reviewing: <span className="font-semibold">{selectedIdea.title}</span> by {selectedIdea.applicantDisplayName}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 flex-grow overflow-y-auto pr-4">
              <Accordion type="multiple" defaultValue={['basic', 'discussion']} className="w-full">
                <AccordionItem value="basic">
                  <AccordionTrigger>Basic Idea Info</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="space-y-2 pt-2">
                        <div><h4 className="font-semibold text-muted-foreground text-xs">Problem Definition</h4><div className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md text-sm markdown-container"><ReactMarkdown components={MarkdownDisplayComponents}>{selectedIdea.problem || ''}</ReactMarkdown></div></div>
                        <div><h4 className="font-semibold text-muted-foreground text-xs">Proposed Solution</h4><div className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md text-sm markdown-container"><ReactMarkdown components={MarkdownDisplayComponents}>{selectedIdea.solution || ''}</ReactMarkdown></div></div>
                        <div><h4 className="font-semibold text-muted-foreground text-xs">Uniqueness/Distinctiveness</h4><div className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md text-sm markdown-container"><ReactMarkdown components={MarkdownDisplayComponents}>{selectedIdea.uniqueness || ''}</ReactMarkdown></div></div>
                        {selectedIdea.phase2PptUrl && (<div><h4 className="font-semibold text-muted-foreground text-xs">Phase 2 Presentation</h4><a href={selectedIdea.phase2PptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{selectedIdea.phase2PptFileName || 'View Phase 2 Presentation'}</a>{selectedIdea.phase2PptUploadedAt && <p className="text-xs text-muted-foreground mt-1">Uploaded on {formatDateOnly(selectedIdea.phase2PptUploadedAt)}</p>}</div>)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="team">
                  <AccordionTrigger>Team Information</AccordionTrigger>
                  <AccordionContent>
                    {selectedIdea.structuredTeamMembers && selectedIdea.structuredTeamMembers.length > 0 ? (
                      <div className="pt-1"><h4 className="font-semibold text-muted-foreground text-xs flex items-center mb-1"><UserCheckIcon className="h-4 w-4 mr-1.5"/> Team Members</h4><div className="space-y-2">
                      {selectedIdea.structuredTeamMembers.map((member, index) => (
                          <Card key={member.id || index} className="bg-muted/40 p-2 shadow-sm text-xs"><CardHeader className="p-0 pb-0.5"><CardTitle className="text-xs font-medium">Member {index + 1}: {member.name}</CardTitle></CardHeader><CardContent className="p-0 text-foreground/80 space-y-0.5"><p><strong>Email:</strong> {member.email}</p><p><strong>Phone:</strong> {member.phone}</p><p><strong>Institute:</strong> {member.institute}</p></CardContent></Card>
                      ))}</div></div>
                    ) : <p className="text-sm text-muted-foreground">No detailed team members listed.</p>}
                  </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="discussion">
                    <AccordionTrigger>Feedback & Discussion</AccordionTrigger>
                    <AccordionContent>
                        <IdeaComments 
                            idea={selectedIdea} 
                            currentUserProfile={userProfile} 
                            onCommentPosted={refetchMentorIdeas} 
                        />
                    </AccordionContent>
                </AccordionItem>
                {selectedIdea.programPhase === 'PHASE_2' && (
                  <AccordionItem value="marks">
                    <AccordionTrigger>Submit Phase 2 Marks</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-4">
                        <p className="text-xs text-muted-foreground">As a mentor or admin, your evaluation is crucial. Please provide a mark out of 100 for this idea's Phase 2 presentation and progress.</p>
                        <div className="pt-2 space-y-1"><Label htmlFor="adminMarkInput" className="font-semibold text-sm">Your Mark (0-100):</Label><div className="flex items-center gap-2"><Input id="adminMarkInput" type="number" min="0" max="100" value={currentAdminMark} onChange={(e) => setCurrentAdminMark(e.target.value)} placeholder="Enter mark" className="max-w-[120px] h-9" disabled={isSavingMark} /><Button onClick={handleSaveMark} disabled={isSavingMark} size="sm">{isSavingMark ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Star className="mr-1 h-4 w-4" />}Save My Mark</Button></div></div>
                        <p className="text-xs text-muted-foreground">Leave the mark empty and save to clear your previously submitted mark.</p>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
