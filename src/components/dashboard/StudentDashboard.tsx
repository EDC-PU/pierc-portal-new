
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Lightbulb, Users, Activity, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserIdeaSubmissionsCount } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
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
          <p className="text-muted-foreground">Welcome, Student! Here are your resources and tools.</p>
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
              Access workshops & materials.
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
              Find team members & mentors.
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>View Incubation Phases</li>
            <li>Check Announcements</li>
            <li>Access Research Repository (Coming Soon)</li>
            <li>My Profile</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

