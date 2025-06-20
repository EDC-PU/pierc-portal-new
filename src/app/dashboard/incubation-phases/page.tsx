
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Zap, Lightbulb, Rocket, CheckCircle, Users, TrendingUp, Edit } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { SubmitIdeaModalForm } from '@/components/dashboard/SubmitIdeaModalForm';

interface Phase {
  icon: React.ElementType;
  title: string;
  description: string;
  keyActivities: string[];
  image?: string;
  imageHint?: string;
}

const incubationPhases: Phase[] = [
  {
    icon: Lightbulb,
    title: 'Phase 1: Application Stage',
    description: 'Submit Your Idea Through The Startup Support Tab On Our Website.',
    keyActivities: ['Idea Submission', 'Initial Concept Outline', 'Team Formation (if any)'],
    image: "https://placehold.co/600x300.png",
    imageHint: "idea submission form"
  },
  {
    icon: Users,
    title: 'Phase 2: Evaluation',
    description: 'Applications Undergo Expert Review And Pitch Presentations In Two Rounds.',
    keyActivities: ['Expert Review of Application', 'First Round Pitch Presentation', 'Second Round Pitch Presentation', 'Feedback Incorporation'],
    image: "https://placehold.co/600x300.png",
    imageHint: "expert review meeting"
  },
  {
    icon: Rocket,
    title: 'Phase 3: Pre-Incubation Program (Cohort)',
    description: 'Begin With The 2–Week Training Program And Enter The Idea Stage Of Incubation.',
    keyActivities: ['2-Week Intensive Training', 'Cohort Formation', 'Mentorship Assignment', 'Business Model Development', 'MVP Scoping'],
    image: "https://placehold.co/600x300.png",
    imageHint: "training program cohort"
  },
];

export default function IncubationPhasesPage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [isProfilePromptModalOpen, setIsProfilePromptModalOpen] = useState(false);

  const canSubmitIdeaDetails = !!userProfile && !!userProfile.applicantCategory && !!userProfile.currentStage;

  const handleOpenSubmitIdeaModal = () => {
    if (loading) return;
    if (!userProfile) {
      // Should not happen if page is protected, but good to check
      router.push('/login');
      return;
    }
    if (canSubmitIdeaDetails) {
      setIsIdeaModalOpen(true);
    } else {
      setIsProfilePromptModalOpen(true);
    }
  };

  return (
    <div className="space-y-8 animate-slide-in-up">
      <header className="text-center">
        <Zap className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-headline font-bold mb-2">Phases of Incubation</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Our structured program to guide your innovative ideas from concept to market readiness.
        </p>
      </header>

      <div className="space-y-12">
        {incubationPhases.map((phase, index) => (
          <Card key={index} className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300">
            {phase.image && (
              <div className="relative h-48 md:h-64 w-full">
                <Image 
                  src={phase.image} 
                  alt={phase.title} 
                  fill={true}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{objectFit: "cover"}}
                  data-ai-hint={phase.imageHint}
                />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                 <div className="absolute bottom-4 left-4">
                    <h2 className="text-3xl font-headline font-semibold text-primary-foreground">{phase.title}</h2>
                 </div>
              </div>
            )}
            <CardHeader className={!phase.image ? "" : "pt-4"}>
              {!phase.image && <CardTitle className="font-headline text-2xl flex items-center"><phase.icon className="mr-3 h-8 w-8 text-primary" />{phase.title}</CardTitle>}
              <CardDescription className="text-base">{phase.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-lg mb-2">Key Activities:</h4>
                <ul className="space-y-1">
                  {phase.keyActivities.map((activity, actIndex) => (
                    <li key={actIndex} className="flex items-start text-muted-foreground">
                      <CheckCircle className="h-4 w-4 mr-2 mt-1 text-green-500 flex-shrink-0" />
                      <span>{activity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-12 bg-primary/10 border-primary shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">Ready to Innovate?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center text-center">
          <p className="text-muted-foreground mb-6">
            If you have an idea or a startup project, PIERC is here to support you.
            {userProfile && !canSubmitIdeaDetails && " First, ensure your innovator profile (including applicant category and current stage) is complete on the Profile Setup page."}
            {userProfile && canSubmitIdeaDetails && " You can submit or update your core idea details below."}
            {!userProfile && !loading && " Please log in and complete your profile to get started."}
          </p>
          {userProfile && (
            <Button
              size="lg"
              onClick={handleOpenSubmitIdeaModal}
              disabled={loading}
              className="bg-accent hover:bg-accent/90"
            >
              <Edit className="mr-2 h-5 w-5" /> {canSubmitIdeaDetails ? "Submit / Update Your Idea Details" : "Complete Profile to Submit Idea"}
            </Button>
          )}
          {!userProfile && !loading && (
             <Button size="lg" onClick={() => router.push('/login')} className="bg-accent hover:bg-accent/90">
                Login to Get Started
              </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={isIdeaModalOpen} onOpenChange={setIsIdeaModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">Submit / Update Your Idea Details</DialogTitle>
            <DialogDescription>
              Fill in the core details of your innovation. You can elaborate further on your Profile Setup page.
            </DialogDescription>
          </DialogHeader>
          {userProfile && canSubmitIdeaDetails && (
            <SubmitIdeaModalForm
              currentUserProfile={userProfile}
              onSuccess={() => setIsIdeaModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isProfilePromptModalOpen} onOpenChange={setIsProfilePromptModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">Complete Your Profile First</DialogTitle>
            <DialogDescription>
              To submit or update your idea details, please first ensure your core innovator profile is complete.
              This includes setting your "Applicant Category" and "Current Stage of Idea/Startup" on the Profile Setup page.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex justify-center">
            <Button onClick={() => { router.push('/profile-setup'); setIsProfilePromptModalOpen(false); }}>
              Go to Profile Setup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
