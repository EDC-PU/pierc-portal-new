'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, userProfile, loading, initialLoadComplete } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initialLoadComplete) {
      if (!user) {
        router.replace('/login');
      } else if (!userProfile) {
        // User is authenticated but profile setup is not complete
        router.replace('/profile-setup');
      }
    }
  }, [user, userProfile, initialLoadComplete, router]);

  if (loading || !initialLoadComplete) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (!user || !userProfile) {
    // This case should ideally be handled by the useEffect redirecting,
    // but this is a fallback to prevent rendering children if auth checks are in progress or failed.
     return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <p>Authenticating...</p>
      </div>
    );
  }

  // User is authenticated and profile exists
  return (
    <div className="animate-fade-in">
      {/* Add dashboard-specific layout elements here if needed, e.g., a sub-navbar or sidebar */}
      {/* For now, it's a simple container for dashboard pages */}
      {children}
    </div>
  );
}
