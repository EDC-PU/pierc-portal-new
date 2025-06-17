
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Lightbulb, Users, Activity, Loader2, ArrowRight, FileCheck2, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserIdeaSubmissionsWithStatus, type IdeaSubmission } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [userIdeas, setUserIdeas] = useState<IdeaSubmission[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);

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

    fetchUserIdeas();
  }, [user, toast]);
  
  const getStatusBadgeVariant = (status?: IdeaSubmission['status']) => {
    if (!status) return 'secondary';
    switch (status) {
      case 'SELECTED': return 'default'; // Primary color
      case 'SUBMITTED': return 'secondary';
      case 'UNDER_REVIEW': return 'outline'; 
      case 'IN_EVALUATION': return 'outline'; 
      case 'NOT_SELECTED': return 'destructive';
      default: return 'secondary';
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
          <CardDescription>Track the status of your innovative ideas submitted to PIERC.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingIdeas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading your submissions...</p>
            </div>
          ) : userIdeas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">You haven't submitted any ideas yet. Complete your profile to submit your first idea!</p>
          ) : (
            <ScrollArea className="h-[200px] pr-3"> {/* Adjust height as needed */}
              <ul className="space-y-3">
                {userIdeas.map((idea) => (
                  <li key={idea.id} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-semibold text-foreground">{idea.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Submitted: {idea.submittedAt ? new Date(idea.submittedAt.toDate()).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(idea.status)} className="capitalize text-xs">
                      {idea.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">Your idea submissions are automatically created/updated when you save your profile.</p>
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
