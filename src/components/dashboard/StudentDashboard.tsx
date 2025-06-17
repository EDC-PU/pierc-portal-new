
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Lightbulb, Users, Activity, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserIdeaSubmissionsCount } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    const fetchProjectCount = async () => {
      if (user?.uid) {
        setLoadingProjects(true);
        try {
          const count = await getUserIdeaSubmissionsCount(user.uid);
          setProjectCount(count);
        } catch (error) {
          console.error("Error fetching project count:", error);
          toast({ title: "Error", description: "Could not load project data.", variant: "destructive" });
          setProjectCount(0);
        } finally {
          setLoadingProjects(false);
        }
      } else {
        setProjectCount(0);
        setLoadingProjects(false);
      }
    };

    fetchProjectCount();
  }, [user, toast]);

  const StatDisplay = ({ value, isLoading }: { value: number | null, isLoading: boolean }) => {
    if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
    if (value === null) return <span className="text-muted-foreground">0</span>;
    return <>{value}</>;
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Idea Submissions</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <StatDisplay value={projectCount} isLoading={loadingProjects} />
            </div>
            <p className="text-xs text-muted-foreground">
              Total ideas submitted to PIERC.
            </p>
          </CardContent>
        </Card>
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
