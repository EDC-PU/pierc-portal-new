'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ArrowRight, Zap } from 'lucide-react';
import Image from 'next/image';

export default function HomePage() {
  const { user, loading, initialLoadComplete } = useAuth();
  const router = useRouter();

  if (initialLoadComplete && user) {
    // Option: redirect to dashboard if logged in, or show a different message.
    // For now, let's allow viewing the landing page even if logged in.
    // router.push('/dashboard');
    // return null; // Or a loading indicator while redirecting
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center animate-fade-in">
      <header className="mb-12">
        <Zap className="h-24 w-24 text-primary mx-auto mb-6" />
        <h1 className="text-5xl md:text-6xl font-headline font-bold mb-4">
          Welcome to <span className="text-primary">PIERC Portal</span>
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
          Your central hub for incubation, research, announcements, and innovation at PIERC.
        </p>
      </header>

      <div className="mb-12 max-w-3xl w-full">
        <Image 
          src="https://placehold.co/800x400.png" 
          alt="Innovation Hub" 
          width={800} 
          height={400} 
          className="rounded-lg shadow-xl object-cover data-ai-hint='innovation tech'"
          priority
        />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 max-w-4xl w-full">
        <div className="bg-card p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300">
          <h3 className="text-2xl font-headline font-semibold mb-2 text-primary">Incubation</h3>
          <p className="text-muted-foreground">Explore our incubation phases and support for startups.</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300">
          <h3 className="text-2xl font-headline font-semibold mb-2 text-primary">Research</h3>
          <p className="text-muted-foreground">Access resources and information for ongoing research projects.</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300">
          <h3 className="text-2xl font-headline font-semibold mb-2 text-primary">Community</h3>
          <p className="text-muted-foreground">Connect with students, faculty, and external collaborators.</p>
        </div>
      </section>

      {!loading && initialLoadComplete && (
        <div className="space-x-4">
          {user ? (
            <Button size="lg" onClick={() => router.push('/dashboard')} className="bg-primary hover:bg-primary/90">
              Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button size="lg" onClick={() => router.push('/login')} className="bg-accent hover:bg-accent/90">
              Login / Sign Up <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          )}
        </div>
      )}
      {loading && !initialLoadComplete && <p className="text-muted-foreground">Loading portal...</p>}
      
      <p className="mt-12 text-sm text-muted-foreground">
        Powered by innovation and collaboration.
      </p>
    </div>
  );
}
