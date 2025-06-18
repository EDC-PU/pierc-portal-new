
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ArrowRight, Zap, Lightbulb, Rocket, Users } from 'lucide-react';
import Image from 'next/image';

export default function HomePage() {
  const { user, loading, initialLoadComplete } = useAuth();
  const router = useRouter();

  if (initialLoadComplete && user) {
    // router.push('/dashboard'); // Option to redirect if logged in
    // return null; 
  }

  return (
    <div className="flex flex-col items-center text-center animate-fade-in py-8 md:py-12"> 
      
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 w-full mb-16 md:mb-24">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="text-center md:text-left">
            <Zap className="h-20 w-20 text-primary mx-auto md:mx-0 mb-4" />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-headline font-bold mb-6">
              Welcome to <span className="text-primary">Parul Innovation & Entrepreneurship Research Centre</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-xl mx-auto md:mx-0">
              Your central hub for incubation, research, announcements, and innovation at PIERC.
            </p>
            {!loading && initialLoadComplete && (
              <div className="space-y-4 sm:space-y-0 sm:space-x-4 flex flex-col sm:flex-row items-center justify-center md:justify-start">
                {user ? (
                  <Button size="lg" onClick={() => router.push('/dashboard')} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                    Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                ) : (
                  <Button size="lg" onClick={() => router.push('/login')} className="bg-accent hover:bg-accent/90 w-full sm:w-auto">
                    Login / Sign Up <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
              </div>
            )}
            {loading && !initialLoadComplete && <p className="text-muted-foreground mt-4">Loading portal...</p>}
          </div>
          <div className="flex justify-center items-center">
            <Image 
              src="https://www.pierc.org/_next/image?url=%2F_next%2Fstatic%2Fmedia%2FmainBgImage.05039c52.png&w=1920&q=75" 
              alt="Innovation Hub at PIERC" 
              width={600} 
              height={400} 
              className="rounded-xl shadow-2xl object-cover aspect-video max-w-full"
              data-ai-hint='innovation tech'
              priority
            />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 w-full mb-12 md:mb-20">
        <h2 className="text-3xl md:text-4xl font-headline font-semibold mb-10 text-center">Core Pillars</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-card p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex flex-col items-center">
            <Lightbulb className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-2xl font-headline font-semibold mb-2 text-primary">Incubation</h3>
            <p className="text-muted-foreground text-sm">Explore our incubation phases and support for startups.</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex flex-col items-center">
            <Rocket className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-2xl font-headline font-semibold mb-2 text-primary">Research</h3>
            <p className="text-muted-foreground text-sm">Access resources and information for ongoing research projects.</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex flex-col items-center">
            <Users className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-2xl font-headline font-semibold mb-2 text-primary">Community</h3>
            <p className="text-muted-foreground text-sm">Connect with students, faculty, and external collaborators.</p>
          </div>
        </div>
      </section>
      
      <p className="mt-12 text-sm text-muted-foreground">
        Powered by innovation and collaboration.
      </p>
    </div>
  );
}
