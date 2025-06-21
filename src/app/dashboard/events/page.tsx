
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAllEventsStream, toggleRsvpForEvent } from '@/lib/firebase/firestore';
import type { PortalEvent } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Calendar, Clock, MapPin, Users, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export default function EventsPage() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpingEventId, setRsvpingEventId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = getAllEventsStream((fetchedEvents) => {
      setEvents(fetchedEvents);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRsvp = async (event: PortalEvent) => {
    if (!user || !userProfile) {
      toast({ title: "Authentication Required", description: "You must be logged in to RSVP.", variant: "destructive" });
      return;
    }
    setRsvpingEventId(event.id!);
    try {
      await toggleRsvpForEvent(event.id!, event.title, user.uid, userProfile);
      const isNowRsvpd = !event.rsvps.includes(user.uid);
      toast({
        title: "Success",
        description: isNowRsvpd ? `You have RSVP'd for "${event.title}".` : `Your RSVP for "${event.title}" has been cancelled.`,
      });
    } catch (error) {
      console.error("Error toggling RSVP:", error);
      toast({ title: "Error", description: "Could not update your RSVP status.", variant: "destructive" });
    } finally {
      setRsvpingEventId(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return format(timestamp.toDate(), 'eeee, MMMM d, yyyy');
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return format(timestamp.toDate(), 'h:mm a');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-12rem)]">
        <LoadingSpinner size={36} />
        <p className="ml-3 text-muted-foreground">Loading Events...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-in-up">
      <header className="text-center">
        <Calendar className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-headline font-bold mb-2">Events & Workshops</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Stay informed about upcoming workshops, deadlines, and networking opportunities at PIERC.
        </p>
      </header>

      {events.length === 0 ? (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle>No Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Check back soon for new events and workshops!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const hasRsvpd = user ? event.rsvps.includes(user.uid) : false;
            const isRsvping = rsvpingEventId === event.id;
            return (
              <Card key={event.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                {event.flyerUrl && (
                  <div className="relative h-48 w-full">
                    <Image 
                      src={event.flyerUrl} 
                      alt={event.title} 
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      style={{objectFit: 'cover'}}
                      data-ai-hint="event flyer"
                    />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="font-headline text-xl text-primary">{event.title}</CardTitle>
                  <CardDescription className="text-xs uppercase font-medium tracking-wider">{event.category.replace('_', ' ')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-3">
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                  <div className="space-y-2 text-sm pt-2">
                    <p className="flex items-center"><Calendar className="h-4 w-4 mr-2" /> {formatDate(event.startDateTime)}</p>
                    <p className="flex items-center"><Clock className="h-4 w-4 mr-2" /> {formatTime(event.startDateTime)} - {formatTime(event.endDateTime)}</p>
                    <p className="flex items-center"><MapPin className="h-4 w-4 mr-2" /> {event.location}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center bg-muted/50 p-4 mt-auto">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="h-4 w-4 mr-2" />
                    <span>{event.rsvpCount} RSVP'd</span>
                  </div>
                  <Button
                    onClick={() => handleRsvp(event)}
                    disabled={isRsvping}
                    variant={hasRsvpd ? "secondary" : "default"}
                  >
                    {isRsvping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (hasRsvpd && <Check className="mr-2 h-4 w-4" />)}
                    {hasRsvpd ? "You're Going" : "RSVP"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
