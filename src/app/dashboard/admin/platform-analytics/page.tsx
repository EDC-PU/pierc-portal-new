
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { BarChartBig } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PlatformAnalyticsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (initialLoadComplete && !authLoading) {
      if (!userProfile) {
        router.push('/login');
        return;
      }
      if (userProfile.role !== 'ADMIN_FACULTY') {
        toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" });
        router.push('/dashboard');
      }
    }
  }, [userProfile, authLoading, initialLoadComplete, router, toast]);

  if (authLoading || !initialLoadComplete) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }

  if (!userProfile || userProfile.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Verifying access or redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <BarChartBig className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Platform Analytics</h1>
            <p className="text-muted-foreground">Insights and statistics for portal activity.</p>
          </div>
        </div>
      </header>
      
      <Card>
        <CardHeader>
            <CardTitle>Analytics Overview</CardTitle>
            <CardDescription>Key metrics and trends will be displayed here.</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px] flex items-center justify-center">
            <p className="text-xl text-muted-foreground">Platform Analytics Feature - Coming Soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}
