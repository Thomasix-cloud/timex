'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
} from 'date-fns';
import { BarChart3 } from 'lucide-react';

type ProjectReport = {
  name: string;
  color: string;
  totalSeconds: number;
  count: number;
};

type DayReport = {
  date: string;
  totalSeconds: number;
  count: number;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1);
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [projectData, setProjectData] = useState<ProjectReport[]>([]);
  const [dayData, setDayData] = useState<DayReport[]>([]);
  const [loading, setLoading] = useState(true);

  const getDateRange = () => {
    const now = new Date();
    if (period === 'week') {
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    }
    return { from: startOfMonth(now), to: endOfMonth(now) };
  };

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      const { from, to } = getDateRange();
      const params = `from=${from.toISOString()}&to=${to.toISOString()}`;

      const [projectRes, dayRes] = await Promise.all([
        fetch(`/api/reports?${params}&groupBy=project`),
        fetch(`/api/reports?${params}&groupBy=day`),
      ]);

      if (projectRes.ok) setProjectData(await projectRes.json());
      if (dayRes.ok) setDayData(await dayRes.json());
      setLoading(false);
    };

    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const totalSeconds = projectData.reduce((s, p) => s + p.totalSeconds, 0);
  const maxDaySeconds = Math.max(...dayData.map((d) => d.totalSeconds), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2">
          <Button
            variant={period === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('week')}
          >
            This Week
          </Button>
          <Button
            variant={period === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('month')}
          >
            This Month
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Time</p>
            <p className="text-3xl font-bold">{formatDuration(totalSeconds)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Hours</p>
            <p className="text-3xl font-bold">{formatHours(totalSeconds)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Projects Active</p>
            <p className="text-3xl font-bold">{projectData.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="byProject">
        <TabsList>
          <TabsTrigger value="byProject">By Project</TabsTrigger>
          <TabsTrigger value="byDay">By Day</TabsTrigger>
        </TabsList>

        <TabsContent value="byProject" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time by Project</CardTitle>
            </CardHeader>
            <CardContent>
              {projectData.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <BarChart3 className="mb-2 h-8 w-8" />
                  <p>No data for this period</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {projectData
                    .sort((a, b) => b.totalSeconds - a.totalSeconds)
                    .map((project) => {
                      const percent =
                        totalSeconds > 0
                          ? (project.totalSeconds / totalSeconds) * 100
                          : 0;
                      return (
                        <div key={project.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: project.color }}
                              />
                              <span className="font-medium">
                                {project.name}
                              </span>
                            </div>
                            <span className="text-muted-foreground">
                              {formatDuration(project.totalSeconds)} (
                              {percent.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${percent}%`,
                                backgroundColor: project.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="byDay" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Hours</CardTitle>
            </CardHeader>
            <CardContent>
              {dayData.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <BarChart3 className="mb-2 h-8 w-8" />
                  <p>No data for this period</p>
                </div>
              ) : (
                <div className="flex items-end gap-2" style={{ height: 200 }}>
                  {dayData.map((day) => {
                    const height = (day.totalSeconds / maxDaySeconds) * 100;
                    return (
                      <div
                        key={day.date}
                        className="flex flex-1 flex-col items-center gap-1"
                      >
                        <span className="text-xs text-muted-foreground">
                          {formatHours(day.totalSeconds)}h
                        </span>
                        <div
                          className="w-full rounded-t bg-primary transition-all"
                          style={{
                            height: `${Math.max(height, 2)}%`,
                          }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(day.date), 'EEE')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
