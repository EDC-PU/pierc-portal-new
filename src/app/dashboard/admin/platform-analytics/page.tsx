
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { BarChartBig, Users2, Lightbulb, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTotalUsersCount, getTotalIdeasCount, getIdeasCountByStatus, getIdeasCountByApplicantCategory } from '@/lib/firebase/firestore';
import type { ApplicantCategory, IdeaStatus } from '@/types';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface StatCardProps {
  title: string;
  value: number | null;
  icon: React.ElementType;
  isLoading: boolean;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, isLoading, description }) => (
  <Card className="shadow-md hover:shadow-lg transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="h-8 flex items-center">
          <LoadingSpinner size={24} />
        </div>
      ) : (
        <div className="text-2xl font-bold">{value ?? 'N/A'}</div>
      )}
      {description && !isLoading && value !== null && (
        <p className="text-xs text-muted-foreground pt-1">{description}</p>
      )}
    </CardContent>
  </Card>
);

const applicantCategoryLabels: Record<ApplicantCategory, string> = {
  PARUL_STUDENT: 'Parul Students',
  PARUL_STAFF: 'Parul Staff',
  PARUL_ALUMNI: 'Parul Alumni',
  OTHERS: 'Others',
};

const chartConfig = {
  count: {
    label: "Ideas",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function PlatformAnalyticsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalIdeas, setTotalIdeas] = useState<number | null>(null);
  const [selectedIdeasCount, setSelectedIdeasCount] = useState<number | null>(null);
  const [notSelectedIdeasCount, setNotSelectedIdeasCount] = useState<number | null>(null);
  const [ideasByCategoryData, setIdeasByCategoryData] = useState<Array<{ category: string; count: number }>>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    if (initialLoadComplete && !authLoading) {
      if (!userProfile) {
        router.push('/login');
        return;
      }
      if (userProfile.role !== 'ADMIN_FACULTY') {
        toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" });
        router.push('/dashboard');
        return;
      }

      const fetchAnalyticsData = async () => {
        setLoadingAnalytics(true);
        try {
          const [
            users, 
            ideasTotal, 
            ideasSelected, 
            ideasNotSelected, 
            categoryCountsRaw
          ] = await Promise.all([
            getTotalUsersCount(),
            getTotalIdeasCount(),
            getIdeasCountByStatus('SELECTED'),
            getIdeasCountByStatus('NOT_SELECTED'),
            getIdeasCountByApplicantCategory(),
          ]);

          setTotalUsers(users);
          setTotalIdeas(ideasTotal);
          setSelectedIdeasCount(ideasSelected);
          setNotSelectedIdeasCount(ideasNotSelected);

          const categoryChartData = Object.entries(categoryCountsRaw)
            .map(([key, value]) => ({
              category: applicantCategoryLabels[key as ApplicantCategory] || key,
              count: value,
            }))
            .filter(item => item.count > 0); // Optionally filter out categories with 0 ideas
          setIdeasByCategoryData(categoryChartData);

        } catch (error) {
          console.error("Error fetching platform analytics:", error);
          toast({ title: "Analytics Error", description: "Could not load platform analytics data.", variant: "destructive" });
        } finally {
          setLoadingAnalytics(false);
        }
      };

      fetchAnalyticsData();
    }
  }, [userProfile, authLoading, initialLoadComplete, router, toast]);

  if (authLoading || !initialLoadComplete || (!loadingAnalytics && userProfile?.role !== 'ADMIN_FACULTY')) {
     // Show loader if auth is loading, or if initial load isn't complete,
     // or if analytics are done loading but user isn't an admin (they will be redirected soon)
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }
  
  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <BarChartBig className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Platform Analytics</h1>
            <p className="text-muted-foreground">Insights and statistics for portal activity.</p>
          </div>
        </div>
      </header>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={totalUsers} icon={Users2} isLoading={loadingAnalytics} />
        <StatCard title="Total Submitted Ideas" value={totalIdeas} icon={Lightbulb} isLoading={loadingAnalytics} />
        <StatCard title="Ideas Selected" value={selectedIdeasCount} icon={CheckCircle2} isLoading={loadingAnalytics} />
        <StatCard title="Ideas Not Selected" value={notSelectedIdeasCount} icon={XCircle} isLoading={loadingAnalytics} />
      </div>

      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="font-headline text-xl">Ideas by Applicant Category</CardTitle>
            <CardDescription>Distribution of submitted ideas based on the applicant's category.</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          {loadingAnalytics ? (
            <div className="flex justify-center items-center min-h-[300px]">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading chart data...</p>
            </div>
          ) : ideasByCategoryData.length > 0 ? (
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full aspect-auto">
              <BarChart accessibilityLayer data={ideasByCategoryData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis allowDecimals={false} tickMargin={10} axisLine={false} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar dataKey="count" fill="var(--color-count)" radius={5} />
              </BarChart>
            </ChartContainer>
          ) : (
             <p className="text-center text-muted-foreground py-10 min-h-[300px] flex items-center justify-center">No idea submission data available by category yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

