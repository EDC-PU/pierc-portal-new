
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Users, Settings, BarChart3, Megaphone, UserCog, Loader2, FileText, BarChartBig, Award } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getTotalUsersCount, getTotalIdeasCount, getPendingIdeasCount, getIdeasAssignedToMentor } from '@/lib/firebase/firestore';
import type { IdeaSubmission, MentorName } from '@/types';
import { AVAILABLE_MENTORS } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface DashboardStats {
  totalUsers: number | null;
  activeProjects: number | null; 
  pendingProjects: number | null; 
}

const getProgramPhaseLabel = (phase: IdeaSubmission['programPhase']): string => {
  if (!phase) return 'N/A';
  switch (phase) {
    case 'PHASE_1': return 'Phase 1';
    case 'PHASE_2': return 'Phase 2';
    case 'COHORT': return 'Cohort';
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

    if (userProfile?.role === 'ADMIN_FACULTY') {
      fetchStats();

      const mentorNameFromProfile = (userProfile.displayName || userProfile.fullName) as MentorName;
      const isRecognizedMentor = AVAILABLE_MENTORS.includes(mentorNameFromProfile);
      
      if (isRecognizedMentor) {
        setCurrentMentorName(mentorNameFromProfile);
        setLoadingMentorIdeas(true);
        getIdeasAssignedToMentor(mentorNameFromProfile)
          .then(ideas => {
            setAssignedMentorIdeas(ideas);
          })
          .catch(err => {
            console.error("Error fetching assigned mentor ideas:", err);
            toast({ title: "Error", description: "Could not load your assigned ideas.", variant: "destructive" });
          })
          .finally(() => setLoadingMentorIdeas(false));
      } else {
        setCurrentMentorName(null);
        setAssignedMentorIdeas([]);
      }
    }
  }, [userProfile, toast]);

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
            {/* <p className="text-xs text-muted-foreground">
              +10 this week 
            </p> */}
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
                      {/* Add a "View Details" column later if needed */}
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
    </div>
  );
}

