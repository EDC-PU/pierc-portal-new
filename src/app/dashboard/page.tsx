
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AnnouncementsFeed } from '@/components/announcements/AnnouncementsFeed';
import UrgentAnnouncementModal from '@/components/announcements/UrgentAnnouncementModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useEffect, useState } from 'react';
import type { IdeaSubmission, ProgramPhase } from '@/types';
import { getUserIdeaSubmissionsWithStatus, getTotalUsersCount, getTotalIdeasCount, getPendingIdeasCount } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { FileCheck2, ChevronsRight, AlertCircle, Users, BarChart3, Megaphone, Settings, UserCog, BarChartBig, FileText, Loader2, Activity, BookOpen, CalendarDays, ListChecks, MapPin, Clock, Download } from 'lucide-react';

interface DashboardStats {
  totalUsers: number | null;
  activeProjects: number | null; 
  pendingProjects: number | null; 
}

export default function DashboardPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [userIdeas, setUserIdeas] = useState<IdeaSubmission[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: null,
    activeProjects: null,
    pendingProjects: null,
  });
  const [loadingAdminStats, setLoadingAdminStats] = useState(false);

  useEffect(() => {
    if (userProfile?.role === 'STUDENT' && user?.uid) {
      const fetchUserIdeas = async () => {
        setLoadingIdeas(true);
        try {
          const ideas = await getUserIdeaSubmissionsWithStatus(user.uid);
          setUserIdeas(ideas);
        } catch (error) {
          console.error("Error fetching user ideas:", error);
          toast({ title: "Error", description: "Could not load your idea submissions.", variant: "destructive" });
        } finally {
          setLoadingIdeas(false);
        }
      };
      fetchUserIdeas();
    }

    if (userProfile?.role === 'ADMIN_FACULTY') {
      const fetchAdminStats = async () => {
        setLoadingAdminStats(true);
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
          toast({ title: "Error Loading Stats", description: "Could not load dashboard statistics.", variant: "destructive" });
        } finally {
          setLoadingAdminStats(false);
        }
      };
      fetchAdminStats();
    }
  }, [userProfile, user?.uid, toast]);


  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-12rem)]"> {/* Adjusted for potential full screen loading */}
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <Card className="mt-10">
        <CardHeader><CardTitle>Profile Not Found</CardTitle></CardHeader>
        <CardContent>
          <p>Your user profile could not be loaded. Please try again or contact support.</p>
        </CardContent>
      </Card>
    );
  }
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };
  
  const getRoleDisplay = (role: string | null, isSuperAdmin?: boolean) => {
    if (!role) return 'User';
    let display = role.replace('_', ' ').toLowerCase();
    display = display.charAt(0).toUpperCase() + display.slice(1);
    if (isSuperAdmin) display += ' (Super Admin)';
    return display;
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
  
  const formatDateDisplay = (timestamp: any): string => { 
    if (!timestamp) return 'N/A';
    let dateToFormat: Date;
    if (timestamp.toDate) { 
      dateToFormat = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      dateToFormat = timestamp;
    } else {
        return 'Invalid Date';
    }
    if (!isValid(dateToFormat)) return 'Invalid Date';
    return dateToFormat.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); // dd-mm-yyyy format
  };

  const getProgramPhaseDisplayLabel = (phase: ProgramPhase | null | undefined): string => {
    if (!phase) return ''; 
    switch (phase) {
      case 'PHASE_1': return 'Phase 1';
      case 'PHASE_2': return 'Phase 2';
      case 'COHORT': return 'Cohort';
      default: return '';
    }
  };

  const AdminStatDisplay = ({ value }: { value: number | null }) => {
    if (loadingAdminStats) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    if (value === null) return <span className="text-muted-foreground">N/A</span>;
    return <>{value}</>;
  };


  return (
    <div className="space-y-6">
      <UrgentAnnouncementModal />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">
          My Dashboard 
          <span className="text-lg md:text-xl text-muted-foreground font-medium ml-2"> {userProfile.displayName || userProfile.fullName}</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center font-headline"><Megaphone className="mr-2 h-5 w-5 text-primary" />ANNOUNCEMENT</CardTitle>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" className="text-primary p-1 h-auto text-xs underline">Notification</Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary p-1 h-auto text-xs">Circular</Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary p-1 h-auto text-xs">Useful Website</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-6"> {/* Adjust padding for denser content */}
              <AnnouncementsFeed />
            </CardContent>
            <CardFooter className="justify-end py-3">
                <Button variant="link" onClick={() => router.push('/dashboard/announcements')} className="text-sm">Show More <ChevronsRight className="ml-1 h-4 w-4"/></Button>
            </CardFooter>
          </Card>

          {userProfile.role === 'STUDENT' && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center font-headline"><FileCheck2 className="mr-2 h-5 w-5 text-primary"/>MY IDEA SUBMISSIONS</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingIdeas ? (
                  <div className="flex items-center justify-center py-6"><LoadingSpinner /> <span className="ml-2 text-sm">Loading ideas...</span></div>
                ) : userIdeas.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">No ideas submitted yet.</p>
                ) : (
                  <ScrollArea className="h-auto max-h-[250px]"> {/* Slightly reduced height */}
                    <ul className="space-y-2">
                      {userIdeas.slice(0,3).map(idea => ( 
                        <li key={idea.id} className="p-3 bg-card rounded-md border border-border hover:bg-muted/50">
                           <div className="flex justify-between items-center">
                                <p className="font-semibold text-foreground text-sm truncate pr-2" title={idea.title}>{idea.title}</p>
                                <Badge variant={getStatusBadgeVariant(idea.status)} className="capitalize text-xs whitespace-nowrap py-0.5 px-2">
                                    {idea.status.replace(/_/g, ' ').toLowerCase()}
                                    {idea.status === 'SELECTED' && idea.programPhase && ` - ${getProgramPhaseDisplayLabel(idea.programPhase)}`}
                                </Badge>
                            </div>
                             <p className="text-xs text-muted-foreground mt-0.5">Submitted: {formatDateDisplay(idea.submittedAt)}</p>
                            {idea.status === 'NOT_SELECTED' && idea.rejectionRemarks && (
                                <p className="text-xs text-destructive mt-1 truncate" title={idea.rejectionRemarks}>Feedback: {idea.rejectionRemarks}</p>
                            )}
                            {idea.status === 'SELECTED' && idea.nextPhaseDate && (
                                 <p className="text-xs text-primary mt-1">Next Step: {formatDateDisplay(idea.nextPhaseDate)} at {idea.nextPhaseStartTime}</p>
                            )}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </CardContent>
               {userIdeas.length > 3 && (
                <CardFooter className="justify-end py-3">
                    <Button variant="link" onClick={() => {/* Implement navigation or expand */}} className="text-sm">View All Submissions</Button>
                </CardFooter>
              )}
            </Card>
          )}
          
           {userProfile.role === 'ADMIN_FACULTY' && (
             <div className="grid gap-6 md:grid-cols-2">
                 <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">TOTAL USERS</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold"><AdminStatDisplay value={stats.totalUsers} /></div>
                  </CardContent>
                </Card>
                 <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">SUBMITTED IDEAS</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold"><AdminStatDisplay value={stats.activeProjects} /></div>
                    {stats.pendingProjects !== null && !loadingAdminStats && (
                        <p className="text-xs text-muted-foreground">
                            <AdminStatDisplay value={stats.pendingProjects} /> pending review
                        </p>
                    )}
                  </CardContent>
                </Card>
             </div>
           )}

          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center font-headline"><CalendarDays className="mr-2 h-5 w-5 text-primary"/>ATTENDANCE SUMMARY</CardTitle></CardHeader>
            <CardContent className="bg-destructive/10 p-3 rounded-md"><p className="text-destructive text-sm font-medium flex items-center"><AlertCircle className="w-4 h-4 mr-2"/>No Record Found</p></CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center font-headline"><Activity className="mr-2 h-5 w-5 text-primary"/>ACTIVITIES</CardTitle>
                     <div className="flex space-x-1">
                        <Button variant="ghost" size="sm" className="text-primary p-1 h-auto text-xs underline">Today</Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary p-1 h-auto text-xs">Yesterday</Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary p-1 h-auto text-xs">Tomorrow</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="bg-destructive/10 p-3 rounded-md"><p className="text-destructive text-sm font-medium flex items-center"><AlertCircle className="w-4 h-4 mr-2"/>No Scheduled Activities available</p></CardContent>
          </Card>

        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-md">
            <CardContent className="pt-6 text-center">
              <Avatar className="w-20 h-20 mx-auto mb-3 border-2 border-primary">
                <AvatarImage src={userProfile.photoURL || `https://placehold.co/80x80.png?text=${getInitials(userProfile.displayName)}`} data-ai-hint="profile person" alt={userProfile.displayName || 'User'} />
                <AvatarFallback>{getInitials(userProfile.displayName)}</AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-semibold font-headline">{userProfile.displayName || userProfile.fullName}</h3>
              <p className="text-xs text-muted-foreground mb-2">{userProfile.role === 'ADMIN_FACULTY' ? (userProfile.email === 'pranavrathi07@gmail.com' ? 'PIERC Super Admin' : 'PIERC Administrator') : (userProfile.applicantCategory && userProfile.startupTitle ? `${userProfile.startupTitle.substring(0,25)}...` : 'Innovator')}</p>
              
              <div className="text-left text-xs my-3 px-2">
                <span className="text-muted-foreground">Profile Filled</span>
                <span className="float-right font-medium text-primary">97.56%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mb-3">
                <div className="bg-primary h-1.5 rounded-full" style={{ width: '97.56%' }}></div>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/profile-setup')} className="w-full text-sm">My Profile</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium font-headline flex justify-between items-center">
                PAY SLIP
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"><Download className="h-4 w-4" /></Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
                <p className="text-xs text-muted-foreground text-center py-2">This feature is not applicable to PIERC Portal.</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium font-headline">QUICK LINKS</CardTitle>
                    <div className="flex space-x-1">
                        <Button variant="ghost" size="sm" className="text-primary p-1 h-auto text-xs underline">General</Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary p-1 h-auto text-xs">TTM</Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary p-1 h-auto text-xs">LMS</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground text-center py-2">No PIERC-specific quick links configured.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

