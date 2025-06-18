
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UrgentAnnouncementModal from '@/components/announcements/UrgentAnnouncementModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useEffect } from 'react'; // Removed useState as stats are now in specific dashboards

// Import role-specific dashboards
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import StudentDashboard from '@/components/dashboard/StudentDashboard';
import ExternalUserDashboard from '@/components/dashboard/ExternalUserDashboard';

export default function DashboardPage() {
  const { user, userProfile, loading: authLoading, initialLoadComplete } = useAuth(); // Added initialLoadComplete
  const router = useRouter();

  // This useEffect handles redirection based on auth state,
  // ensuring it runs after initial auth check is complete.
  useEffect(() => {
    if (initialLoadComplete) {
      if (!user) {
        router.replace('/login');
      } else if (!userProfile) {
        router.replace('/profile-setup');
      }
    }
  }, [user, userProfile, initialLoadComplete, router]);

  if (authLoading || !initialLoadComplete) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-12rem)]">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  // This second check is for the case where initialLoadComplete is true,
  // but user/userProfile might still be null (e.g., during the brief moment of redirection).
  if (!user || !userProfile) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-12rem)]">
        <p className="text-muted-foreground">Verifying session...</p>
        <LoadingSpinner size={32} className="ml-2" />
      </div>
    );
  }
  
  // Render role-specific dashboards
  // The UrgentAnnouncementModal is an overlay, so it's fine here.
  // The main content will be one of the specific dashboard components.
  return (
    <div className="space-y-6 animate-slide-in-up">
      <UrgentAnnouncementModal />
      {userProfile.role === 'ADMIN_FACULTY' && <AdminDashboard />}
      {userProfile.role === 'STUDENT' && <StudentDashboard />}
      {userProfile.role === 'EXTERNAL_USER' && <ExternalUserDashboard />}
      {userProfile.role !== 'ADMIN_FACULTY' && userProfile.role !== 'STUDENT' && userProfile.role !== 'EXTERNAL_USER' && (
        <Card>
          <CardHeader><CardTitle>Unsupported Role</CardTitle></CardHeader>
          <CardContent><p>Your user role ({userProfile.role || 'N/A'}) is not recognized or your profile is incomplete. Please contact support if this is an error.</p></CardContent>
        </Card>
      )}
    </div>
  );
}
