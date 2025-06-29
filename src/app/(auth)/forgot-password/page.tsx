'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import Link from 'next/link';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { KeyRound } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

type ForgotPasswordFormInputs = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { sendPasswordResetForEmail, loading } = useAuth();
  const [emailSent, setEmailSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormInputs>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit: SubmitHandler<ForgotPasswordFormInputs> = async (data) => {
    await sendPasswordResetForEmail(data.email);
    setEmailSent(true);
  };
  
  const pageMinHeight = "min-h-[calc(100vh_-_theme(spacing.20)_-_theme(spacing.12))]";

  return (
    <div className={`flex items-center justify-center py-12 animate-fade-in ${pageMinHeight}`}>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-primary/80 mb-4" />
          <CardTitle className="text-3xl font-headline">Reset Your Password</CardTitle>
          <CardDescription>
            {emailSent 
              ? "If an account with that email exists, a reset link has been sent."
              : "No problem. Enter your email and we'll send you a link to get back into your account."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="text-center text-foreground py-4">
              <p>Please check your inbox (and spam folder) for the password reset email.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <LoadingSpinner size={20} className="mr-2" /> : null}
                Send Reset Link
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center text-sm py-4">
          <Button asChild variant="link" className="text-muted-foreground hover:text-primary p-0 h-auto">
            <Link href="/login">Back to Sign In</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
