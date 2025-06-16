'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Role } from '@/types';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

const profileSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters').max(100),
  role: z.enum(['STUDENT', 'EXTERNAL_USER', 'ADMIN_FACULTY'], {
    required_error: 'You need to select a role.',
  }),
  department: z.string().optional(), // Optional, could be conditional
  organization: z.string().optional(), // Optional, could be conditional
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfileSetupPage() {
  const { user, userProfile, setRoleAndCompleteProfile, loading, signOut, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.displayName || '',
      role: undefined,
      department: '',
      organization: '',
    },
  });

  const selectedRole = watch('role');

  useEffect(() => {
    if (initialLoadComplete && !user) {
      router.push('/login'); // If no user, redirect to login
    }
    if (initialLoadComplete && user && userProfile) {
      // User already has a profile, redirect to dashboard
      router.push('/dashboard');
    }
  }, [user, userProfile, initialLoadComplete, router]);

  useEffect(() => {
    // Populate fullName if user data becomes available after form init
    if (user && !control._formValues.fullName) {
       control.setValue('fullName', user.displayName || '');
    }
  }, [user, control]);


  const onSubmit = async (data: ProfileFormData) => {
    if (!user) {
      toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
      return;
    }
    try {
      const additionalData: Partial<any> = { fullName: data.fullName };
      if (data.role === 'STUDENT' || data.role === 'ADMIN_FACULTY') {
        additionalData.department = data.department;
      } else if (data.role === 'EXTERNAL_USER') {
        additionalData.organization = data.organization;
      }
      await setRoleAndCompleteProfile(data.role as Role, additionalData);
    } catch (error) {
      console.error("Profile setup failed", error);
      // Toast is handled in AuthContext
    }
  };
  
  if (!initialLoadComplete || loading && !userProfile) { // Show loader if still loading or if user exists but profile is being checked
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (!user) { // Should be caught by useEffect, but as a safeguard
    return <p>Redirecting to login...</p>;
  }
  
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12 animate-fade-in">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Complete Your Profile</CardTitle>
          <CardDescription>Welcome, {user?.displayName || 'User'}! Please provide a few more details to get started.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Controller
                name="fullName"
                control={control}
                render={({ field }) => <Input id="fullName" placeholder="Enter your full name" {...field} />}
              />
              {errors.fullName && <p className="text-sm text-destructive mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <Label>Select Your Role</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2"
                  >
                    {(['STUDENT', 'EXTERNAL_USER', 'ADMIN_FACULTY'] as const).map((roleValue) => (
                      <Label
                        key={roleValue}
                        htmlFor={roleValue}
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                      >
                        <RadioGroupItem value={roleValue} id={roleValue} className="sr-only" />
                        {roleValue.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                    ))}
                  </RadioGroup>
                )}
              />
              {errors.role && <p className="text-sm text-destructive mt-1">{errors.role.message}</p>}
            </div>

            {selectedRole === 'STUDENT' && (
              <div>
                <Label htmlFor="department">Department (Students)</Label>
                <Controller
                  name="department"
                  control={control}
                  render={({ field }) => <Input id="department" placeholder="e.g., Computer Science" {...field} />}
                />
                 {errors.department && <p className="text-sm text-destructive mt-1">{errors.department.message}</p>}
              </div>
            )}
            {selectedRole === 'ADMIN_FACULTY' && (
              <div>
                <Label htmlFor="department">Department (Faculty/Admin)</Label>
                <Controller
                  name="department"
                  control={control}
                  render={({ field }) => <Input id="department" placeholder="e.g., Research Office" {...field} />}
                />
                {errors.department && <p className="text-sm text-destructive mt-1">{errors.department.message}</p>}
              </div>
            )}
            {selectedRole === 'EXTERNAL_USER' && (
              <div>
                <Label htmlFor="organization">Organization (External Users)</Label>
                <Controller
                  name="organization"
                  control={control}
                  render={({ field }) => <Input id="organization" placeholder="e.g., Tech Solutions Inc." {...field} />}
                />
                {errors.organization && <p className="text-sm text-destructive mt-1">{errors.organization.message}</p>}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
              {isSubmitting || loading ? <LoadingSpinner className="mr-2" /> : null}
              Save Profile
            </Button>
            <Button variant="link" onClick={signOut} className="text-muted-foreground">
              Logout
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
