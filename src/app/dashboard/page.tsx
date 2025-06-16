'use client';

import { useAuth } from '@/contexts/AuthContext';
import StudentDashboard from '@/components/dashboard/StudentDashboard';
import ExternalUserDashboard from '@/components/dashboard/ExternalUserDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UrgentAnnouncementModal from '@/components/announcements/UrgentAnnouncementModal';


export default function DashboardPage() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Your user profile could not be loaded. Please try logging out and back in, or contact support if the issue persists.</p>
        </CardContent>
      </Card>
    );
  }
  
  // Urgent announcements can be shown on any dashboard page
  // The modal itself handles logic of when to show (based on new urgent items)
  // It needs to be placed here or in a layout that wraps dashboard content.
  // Let's put it here for now.
  // Note: UrgentAnnouncementModal needs to be implemented to listen to Firestore
  // and manage its own visibility (e.g. via Dialog).

  const renderDashboard = () => {
    switch (userProfile.role) {
      case 'STUDENT':
        return <StudentDashboard />;
      case 'EXTERNAL_USER':
        return <ExternalUserDashboard />;
      case 'ADMIN_FACULTY':
        return <AdminDashboard />;
      default:
        return (
            <Card>
                <CardHeader><CardTitle>Role Not Assigned</CardTitle></CardHeader>
                <CardContent>
                    <p>Your role is not properly configured. Please contact an administrator.</p>
                </CardContent>
            </Card>
        );
    }
  };

  return (
    <div className="space-y-8">
      <UrgentAnnouncementModal />
      {renderDashboard()}
    </div>
  );
}
