
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { History, Filter as FilterIcon, Search as SearchIcon, X as ClearIcon } from 'lucide-react';
import { getActivityLogsStream } from '@/lib/firebase/firestore';
import type { ActivityLogEntry, ActivityLogAction } from '@/types';
import { ALL_ACTIVITY_LOG_ACTIONS } from '@/types';
import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

const ALL_ACTIONS_FILTER_VALUE = "_ALL_ACTIONS_";

interface ActivityLogFilters {
  actorName: string;
  actionType: ActivityLogAction | '';
}

export default function ActivityLogsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [filters, setFilters] = useState<ActivityLogFilters>({
    actorName: '',
    actionType: '',
  });

  useEffect(() => {
    if (initialLoadComplete && !authLoading) {
      if (!userProfile) {
        router.push('/login');
        return;
      }
      if (userProfile.role !== 'ADMIN_FACULTY') {
        toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" });
        router.push('/dashboard');
      }
    }
  }, [userProfile, authLoading, initialLoadComplete, router, toast]);

  useEffect(() => {
    if (userProfile?.role === 'ADMIN_FACULTY') {
      setLoadingLogs(true);
      const unsubscribe = getActivityLogsStream(
        {
          actorName: filters.actorName.trim() || undefined, 
          actionType: filters.actionType || undefined,    
        },
        (fetchedLogs) => {
          setLogs(fetchedLogs);
          setLoadingLogs(false);
        },
        100 
      );
      return () => unsubscribe();
    }
  }, [userProfile, filters]);

  const handleFilterChange = (filterName: keyof ActivityLogFilters, value: string) => {
    if (filterName === 'actionType' && value === ALL_ACTIONS_FILTER_VALUE) {
      setFilters(prev => ({ ...prev, actionType: '' }));
    } else {
      setFilters(prev => ({ ...prev, [filterName]: value }));
    }
  };

  const clearFilters = () => {
    setFilters({ actorName: '', actionType: '' });
  };

  const formatDate = (timestamp: Timestamp | Date | undefined | null): string => {
    if (!timestamp) return 'N/A';
    let dateToFormat: Date;
    if ((timestamp as Timestamp)?.toDate) {
      dateToFormat = (timestamp as Timestamp).toDate();
    } else if (timestamp instanceof Date) {
      dateToFormat = timestamp;
    } else {
      return 'Invalid Date';
    }
    return format(dateToFormat, 'MMM d, yyyy, HH:mm:ss');
  };

  if (authLoading || !initialLoadComplete) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }

  if (!userProfile || userProfile.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Verifying access or redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <History className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Activity Logs</h1>
            <p className="text-muted-foreground">Track user and system actions across the portal.</p>
          </div>
        </div>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="h-5 w-5" />
            Filter Logs
          </CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4">
            <div className="space-y-1">
              <label htmlFor="actorNameFilter" className="text-sm font-medium">Actor Name/UID</label>
              <Input
                id="actorNameFilter"
                placeholder="Search by actor..."
                value={filters.actorName}
                onChange={(e) => handleFilterChange('actorName', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="actionTypeFilter" className="text-sm font-medium">Action Type</label>
              <Select
                value={filters.actionType || ALL_ACTIONS_FILTER_VALUE}
                onValueChange={(value) => handleFilterChange('actionType', value as ActivityLogAction | '')}
              >
                <SelectTrigger id="actionTypeFilter" className="h-9">
                  <SelectValue placeholder="All Action Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ACTIONS_FILTER_VALUE} className="text-xs">All Action Types</SelectItem>
                  {ALL_ACTIVITY_LOG_ACTIONS.map(action => (
                    <SelectItem key={action} value={action} className="text-xs">
                      {action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={clearFilters} variant="outline" size="sm" className="h-9">
                <ClearIcon className="h-4 w-4 mr-1" /> Clear Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex justify-center items-center py-10">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading activity logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No activity logs found matching your criteria, or no logs available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Timestamp</TableHead>
                    <TableHead className="min-w-[150px]">Actor</TableHead>
                    <TableHead className="min-w-[200px]">Action</TableHead>
                    <TableHead className="min-w-[200px]">Target</TableHead>
                    <TableHead className="min-w-[250px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</TableCell>
                      <TableCell className="text-xs">
                        {log.actorDisplayName || 'System'} ({log.actorUid.substring(0, 6)}...)
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {log.action.replace(/_/g, ' ').toLowerCase()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.target ? `${log.target.type}: ${log.target.displayName || log.target.id.substring(0, 6)}...` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.details ? (
                          <pre className="whitespace-pre-wrap max-w-md overflow-auto bg-muted/50 p-1 rounded text-[0.7rem]">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    