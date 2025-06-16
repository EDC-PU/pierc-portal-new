'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useRouter } from 'next/navigation';
import { FcGoogle } from 'react-icons/fc'; // Using react-icons for Google logo

export default function LoginPage() {
  const { user, signInWithGoogle, loading, initialLoadComplete } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initialLoadComplete && user) {
      // User is already logged in, check if profile exists
      // AuthContext handles redirection to /dashboard or /profile-setup
      // This page is mainly for users who are not logged in.
      // If they land here while logged in and profile complete, redirect.
      // Handled by AuthContext effect, but an explicit check can be here too.
      // router.push('/dashboard'); 
    }
  }, [user, initialLoadComplete, router]);

  if (loading && !initialLoadComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={48} />
      </div>
    );
  }
  
  // If user is loaded and exists, and they somehow landed here, AuthContext should redirect.
  // This avoids flicker if they are already logged in.
  if (user && initialLoadComplete) {
     return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting...</p>
        <LoadingSpinner size={32} />
      </div>
    );
  }


  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] bg-gradient-to-br from-background to-secondary/30 animate-fade-in">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">Welcome to PIERC Portal</CardTitle>
          <CardDescription>Sign in to access your dashboard and resources.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Button
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full text-lg py-6 bg-card hover:bg-muted border border-border shadow"
            >
              {loading ? (
                <LoadingSpinner size={24} className="mr-2" />
              ) : (
                <FcGoogle className="mr-3 h-6 w-6" />
              )}
              Sign in with Google
            </Button>
            <p className="text-center text-xs text-muted-foreground px-4">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
