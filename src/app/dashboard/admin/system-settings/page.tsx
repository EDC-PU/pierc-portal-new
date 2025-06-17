
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { SystemSettingsForm } from '@/components/admin/SystemSettingsForm';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Settings } from 'lucide-react';

export default function SystemSettingsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (initialLoadComplete && !authLoading) {
      if (!userProfile) {
        // This case should ideally be handled by DashboardLayout redirecting to /login
        // or AuthContext redirecting to /profile-setup if user exists but no profile.
        // For robustness, redirect if somehow userProfile is null here.
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

  // Fallback check if useEffect hasn't redirected yet or userProfile became null
  if (!userProfile || userProfile.role !== 'ADMIN_FACULTY') {
    // This message is shown briefly if redirection is in progress or if access is denied.
    return <div className="flex justify-center items-center h-screen"><p>Verifying access or redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <Settings className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">System Settings</h1>
            <p className="text-muted-foreground">Manage portal configuration and access controls.</p>
          </div>
        </div>
      </header>
      
      <SystemSettingsForm currentUserProfile={userProfile} />
    </div>
  );
}
