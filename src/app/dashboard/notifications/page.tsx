
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getNotificationsStreamForUser, markNotificationsAsRead } from '@/lib/firebase/firestore';
import type { AppNotification } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function NotificationsPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      setLoading(true);
      const unsubscribe = getNotificationsStreamForUser(user.uid, (fetchedNotifications) => {
        setNotifications(fetchedNotifications);
        setLoading(false);
      }, 50); // Fetch up to 50 notifications for the main page

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, [user?.uid]);

  const handleMarkAllRead = async () => {
    if (!user || !userProfile) return;
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id!);
    if (unreadIds.length > 0) {
      await markNotificationsAsRead(user.uid, unreadIds, userProfile);
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (notification.link) {
      router.push(notification.link);
    }
  };
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-8 animate-slide-in-up">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" /> Notifications
            </CardTitle>
            <CardDescription>
              A log of all your portal updates and alerts.
            </CardDescription>
          </div>
          <Button onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="mr-2 h-4 w-4" /> Mark all as read
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">You have no notifications yet.</p>
          ) : (
            <div className="space-y-4">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`border-l-4 p-4 rounded-md transition-colors ${notif.isRead ? 'border-transparent bg-muted/30' : 'border-primary bg-primary/10'} ${notif.link ? 'cursor-pointer hover:bg-accent/50' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <h3 className={`font-semibold ${!notif.isRead ? 'text-primary-foreground' : 'text-foreground'}`}>{notif.title}</h3>
                    <p className="text-xs text-muted-foreground flex-shrink-0 ml-4">
                      {formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })}
                    </p>
                  </div>
                  <p className="text-sm mt-1">{notif.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
