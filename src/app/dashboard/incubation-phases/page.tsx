'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Lightbulb, Rocket, TrendingUp, Target, Users, CheckCircle } from 'lucide-react';
import Image from 'next/image';

interface Phase {
  icon: React.ElementType;
  title: string;
  description: string;
  duration: string;
  keyActivities: string[];
  image?: string;
  imageHint?: string;
}

const incubationPhases: Phase[] = [
  {
    icon: Lightbulb,
    title: 'Phase 1: Ideation & Validation',
    description: 'Transforming raw ideas into viable concepts. Focus on market research, problem validation, and initial concept development.',
    duration: '1-2 Months',
    keyActivities: ['Market Research', 'Problem Definition', 'Solution Brainstorming', 'Initial Feasibility Study', 'Pitch Deck V1'],
    image: "https://placehold.co/600x300.png",
    imageHint: "brainstorming ideas"
  },
  {
    icon: Rocket,
    title: 'Phase 2: Prototyping & MVP Development',
    description: 'Building a Minimum Viable Product (MVP) to test the core functionalities and gather early user feedback.',
    duration: '2-4 Months',
    keyActivities: ['MVP Specification', 'Prototype Development', 'User Testing & Feedback Collection', 'Technology Stack Finalization', 'Business Model Canvas'],
    image: "https://placehold.co/600x300.png",
    imageHint: "product development"
  },
  {
    icon: Target,
    title: 'Phase 3: Market Entry & Early Traction',
    description: 'Launching the MVP, acquiring first users, and iterating based on real-world market feedback. Focus on product-market fit.',
    duration: '3-6 Months',
    keyActivities: ['Soft Launch Strategy', 'Early Adopter Acquisition', 'Feedback Analysis & Iteration', 'Marketing & Sales Plan V1', 'Legal & IP Basics'],
    image: "https://placehold.co/600x300.png",
    imageHint: "business launch"
  },
  {
    icon: TrendingUp,
    title: 'Phase 4: Growth & Scaling',
    description: 'Focusing on sustainable growth, expanding user base, optimizing operations, and preparing for investment.',
    duration: '6-12 Months',
    keyActivities: ['Growth Hacking Strategies', 'Operational Scaling', 'Team Expansion', 'Investor Readiness Program', 'Financial Projections'],
    image: "https://placehold.co/600x300.png",
    imageHint: "business growth chart"
  },
  {
    icon: Users,
    title: 'Phase 5: Graduation & Alumni Support',
    description: 'Successfully launching as an independent entity, with ongoing support and networking opportunities from PIERC.',
    duration: 'Ongoing',
    keyActivities: ['Formal Company Registration', 'Securing Follow-on Funding', 'Alumni Network Integration', 'Mentorship Contribution', 'Success Story Sharing'],
    image: "https://placehold.co/600x300.png",
    imageHint: "graduation success"
  },
];

export default function IncubationPhasesPage() {
  return (
    <div className="space-y-8 animate-slide-in-up">
      <header className="text-center">
        <Zap className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-headline font-bold mb-2">Phases of Incubation</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Guiding your innovative ideas from concept to market success through structured support and mentorship.
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
                <h4 className="font-semibold text-lg mb-1">Duration:</h4>
                <p className="text-muted-foreground">{phase.duration}</p>
              </div>
              <div>
                <h4 className="font-semibold text-lg mb-2">Key Activities:</h4>
                <ul className="space-y-1">
                  {phase.keyActivities.map((activity, actIndex) => (
                    <li key={actIndex} className="flex items-center text-muted-foreground">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                      {activity}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
       <Card className="mt-12 bg-primary/10 border-primary">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">Ready to Innovate?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            If you have an idea or a startup project, PIERC is here to support you. Learn more about our application process and how we can help you succeed.
          </p>
          {/* Placeholder for a button or link to application page */}
          {/* <Button variant="default" size="lg">Apply Now</Button> */}
        </CardContent>
      </Card>
    </div>
  );
}
