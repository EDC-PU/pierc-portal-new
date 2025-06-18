
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
    // This effect handles redirection once all necessary data from AuthContext is available
    if (initialLoadComplete && user && userProfile) {
      router.push('/dashboard');
    }
    // If initialLoadComplete && user && !userProfile, 
    // AuthContext will handle redirecting to /profile-setup if needed.
    // Login page doesn't need to explicitly redirect to /profile-setup.
  }, [user, userProfile, initialLoadComplete, router]);


  const onSubmit: SubmitHandler<LoginFormInputs | SignUpFormInputs> = async (data) => {
    try {
      if (isSignUpMode) {
        const { email, password } = data as SignUpFormInputs;
        await signUpWithEmailPassword(email, password);
        // AuthContext's onAuthStateChanged will handle post-signup flow (profile fetch, redirect to setup)
      } else {
        const { email, password } = data as LoginFormInputs;
        await signInWithEmailPassword(email, password);
        // AuthContext's onAuthStateChanged will handle post-signin flow (profile fetch, redirect to dashboard/setup)
      }
    } catch (error: any) {
      // Errors are handled by toast in AuthContext methods, no need to re-toast here
    }
  };

  const toggleMode = () => {
    setIsSignUpMode(!isSignUpMode);
    reset(); 
  }

  // 1. Initial AuthContext Loading (before `initialLoadComplete` is true)
  // This spinner is for the very first time the AuthContext is initializing.
  if (!initialLoadComplete) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh_-_theme(spacing.20))] p-4 text-center">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  // After initialLoadComplete is true:
  // 2. User is authenticated and has a profile (ready for dashboard)
  if (user && userProfile) {
    // The useEffect above will handle the router.push. Show "Redirecting to dashboard..."
     return (
      <div className="flex items-center justify-center min-h-[calc(100vh_-_theme(spacing.20))] p-4 text-center">
        <div className="flex flex-col sm:flex-row items-center gap-3">
            <p className="text-lg text-muted-foreground">Redirecting to dashboard...</p>
            <LoadingSpinner size={32} />
        </div>
      </div>
    );
  }

  // 3. User is authenticated but profile doesn't exist yet (or is being fetched by AuthContext)
  // AuthContext will redirect them to /profile-setup. Show a generic message.
  if (user && !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh_-_theme(spacing.20))] p-4 text-center">
        <div className="flex flex-col sm:flex-row items-center gap-3">
            <p className="text-lg text-muted-foreground">Checking profile status...</p>
            <LoadingSpinner size={32} />
        </div>
      </div>
    );
  }
  
  // 4. Initial load is complete and no user is authenticated: Show the login form.
  // The `loading` prop on the submit button handles the spinner during the sign-in API call itself.
  return (
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
            {/* Show spinner on Google button if loading is true and it's not due to email/password sign-up in progress */}
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
