'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Timer, FolderKanban, Calendar, Loader2 } from 'lucide-react';
import { TimeEntryList, type SerializedTimeEntry } from '@/components/time-entry-list';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  differenceInSeconds,
} from 'date-fns';

const periods = [
  { key: 'today', label: 'Dnes' },
  { key: 'this-week', label: 'Tento týden' },
  { key: 'last-week', label: 'Minulý týden' },
  { key: 'this-month', label: 'Tento měsíc' },
  { key: 'last-month', label: 'Minulý měsíc' },
] as const;

type PeriodKey = (typeof periods)[number]['key'];

function getRange(key: PeriodKey): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'this-week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'last-week': {
      const lw = subWeeks(now, 1);
      return { from: startOfWeek(lw, { weekStartsOn: 1 }), to: endOfWeek(lw, { weekStartsOn: 1 }) };
    }
    case 'this-month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last-month': {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type Props = {
  projectCount: number;
  runningEntry: { projectName: string | null; startTime: string } | null;
};

export function DashboardClient({ projectCount, runningEntry }: Props) {
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [entries, setEntries] = useState<SerializedTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async (p: PeriodKey) => {
    setLoading(true);
    const { from, to } = getRange(p);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    try {
      const res = await fetch(`/api/time-entries?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(
          data.map((e: Record<string, unknown>) => ({
            id: e.id,
            description: e.description,
            startTime: e.startTime,
            endTime: e.endTime ?? null,
            duration: e.duration,
            source: e.source,
            project: e.project
              ? { id: (e.project as Record<string, string>).id, name: (e.project as Record<string, string>).name, color: (e.project as Record<string, string>).color }
              : null,
            tag: e.tag
              ? { id: (e.tag as Record<string, string>).id, name: (e.tag as Record<string, string>).name, color: (e.tag as Record<string, string>).color }
              : null,
          })),
        );
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries(period);
  }, [period, fetchEntries]);

  const totalSeconds = entries.reduce((acc, entry) => {
    if (entry.duration) return acc + entry.duration;
    if (entry.endTime) {
      return acc + differenceInSeconds(new Date(entry.endTime), new Date(entry.startTime));
    }
    return acc + differenceInSeconds(new Date(), new Date(entry.startTime));
  }, 0);

  const periodLabel = periods.find((p) => p.key === period)?.label ?? '';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{periodLabel}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(totalSeconds)}
            </div>
            <p className="text-xs text-muted-foreground">
              {entries.length} entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runningEntry ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
            {runningEntry && (
              <p className="text-xs text-muted-foreground">
                {runningEntry.projectName ?? 'No project'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Period</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries.length}</div>
            <p className="text-xs text-muted-foreground">entries</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Entries</CardTitle>
          <div className="flex flex-wrap gap-1">
            {periods.map((p) => (
              <Button
                key={p.key}
                variant={period === p.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <TimeEntryList entries={entries} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
