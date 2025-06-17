
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useRouter } from 'next/navigation';
import { FcGoogle } from 'react-icons/fc';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

const signUpSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'], 
});


type LoginFormInputs = z.infer<typeof loginSchema>;
type SignUpFormInputs = z.infer<typeof signUpSchema>;

export default function LoginPage() {
  const { user, userProfile, signInWithGoogle, signUpWithEmailPassword, signInWithEmailPassword, loading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  const currentSchema = isSignUpMode ? signUpSchema : loginSchema;
  const { register, handleSubmit, formState: { errors }, reset } = useForm<LoginFormInputs | SignUpFormInputs>({
    resolver: zodResolver(currentSchema),
  });


  useEffect(() => {
    if (initialLoadComplete && user) {
      if (userProfile) {
        // If user is authenticated and has a profile, redirect to dashboard.
        // AuthContext usually handles this, but this is a safeguard if they land here.
        router.push('/dashboard');
      }
      // If user is authenticated but no profile, AuthContext is responsible for
      // redirecting to /profile-setup. The "Redirecting..." message (below)
      // will show during this brief period.
    }
  }, [user, userProfile, initialLoadComplete, router]);

  if (loading && !initialLoadComplete) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh_-_theme(spacing.20))]"> {/* Adjusted for Navbar height (h-20) */}
        <LoadingSpinner size={48} />
      </div>
    );
  }
  
  // This screen shows if auth is complete, user exists, but redirection (by AuthContext or above useEffect) is pending.
  // For a new user, AuthContext will redirect to /profile-setup.
  // For an existing user with profile, the useEffect above will redirect to /dashboard.
  if (user && initialLoadComplete) {
     return (
      <div className="flex items-center justify-center min-h-[calc(100vh_-_theme(spacing.20))]">
        <p>Redirecting...</p>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  // If not loading, and no user, render the login/signup form.
  const onSubmit: SubmitHandler<LoginFormInputs | SignUpFormInputs> = async (data) => {
    try {
      if (isSignUpMode) {
        const { email, password } = data as SignUpFormInputs;
        await signUpWithEmailPassword(email, password);
        // AuthContext will redirect to profile-setup upon successful auth state change
      } else {
        const { email, password } = data as LoginFormInputs;
        await signInWithEmailPassword(email, password);
         // AuthContext will redirect to dashboard or profile-setup
      }
    } catch (error: any) {
      // Errors are handled by toast in AuthContext methods, no need to re-toast here
    }
  };

  const toggleMode = () => {
    setIsSignUpMode(!isSignUpMode);
    reset(); 
  }

  return (
    // Adjusted min-h to ensure it fills space below Navbar if AppShell causes flex-grow issues for this page.
    <div className="flex items-center justify-center py-12 min-h-[calc(100vh_-_theme(spacing.20)_-_theme(spacing.24))] bg-gradient-to-br from-background to-secondary/30 animate-fade-in">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">
            {isSignUpMode ? 'Create Account' : 'Welcome to Parul Innovation & Entrepreneurship Research Centre'}
          </CardTitle>
          <CardDescription>
            {isSignUpMode ? 'Sign up to access your dashboard and resources.' : 'Sign in to access your dashboard and resources.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
            </div>
            {isSignUpMode && (
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" {...register('confirmPassword' as keyof SignUpFormInputs)} />
                {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>}
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <LoadingSpinner size={20} className="mr-2" /> : null}
              {isSignUpMode ? 'Sign Up' : 'Sign In'}
            </Button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            onClick={signInWithGoogle}
            disabled={loading}
            variant="outline"
            className="w-full text-base py-5 bg-card hover:bg-muted border border-border shadow-sm"
          >
            {loading && !isSignUpMode ? ( 
              <LoadingSpinner size={24} className="mr-2" />
            ) : (
              <FcGoogle className="mr-3 h-5 w-5" />
            )}
            Sign in with Google
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center text-sm py-4">
           <Button variant="link" onClick={toggleMode} className="text-muted-foreground hover:text-primary">
            {isSignUpMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </Button>
          <p className="text-center text-xs text-muted-foreground px-4 mt-2">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
