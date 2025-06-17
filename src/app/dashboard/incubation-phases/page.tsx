
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Lightbulb, Rocket, CheckCircle, Users, TrendingUp } from 'lucide-react'; // Adjusted icons
import Image from 'next/image';

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
    icon: Users, // Using Users for evaluation/review
    title: 'Phase 2: Evaluation',
    description: 'Applications Undergo Expert Review And Pitch Presentations In Two Rounds.',
    keyActivities: ['Expert Review of Application', 'First Round Pitch Presentation', 'Second Round Pitch Presentation', 'Feedback Incorporation'],
    image: "https://placehold.co/600x300.png",
    imageHint: "expert review meeting"
  },
  {
    icon: Rocket, // Rocket for program launch/training
    title: 'Phase 3: Pre-Incubation Program (Cohort)',
    description: 'Begin With The 2–Week Training Program And Enter The Idea Stage Of Incubation.',
    keyActivities: ['2-Week Intensive Training', 'Cohort Formation', 'Mentorship Assignment', 'Business Model Development', 'MVP Scoping'],
    image: "https://placehold.co/600x300.png",
    imageHint: "training program cohort"
  },
];

export default function IncubationPhasesPage() {
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
                  layout="fill" 
                  objectFit="cover" 
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
        <CardContent>
          <p className="text-muted-foreground mb-4">
            If you have an idea or a startup project, PIERC is here to support you. The first step is to submit your application. Make sure your profile is complete!
          </p>
          {/* Placeholder for a button or link to application page (Startup Support Tab) */}
          {/* e.g. <Button variant="default" size="lg" onClick={() => router.push('/dashboard/submit-idea')}>Submit Your Idea</Button> */}
        </CardContent>
      </Card>
    </div>
  );
}

