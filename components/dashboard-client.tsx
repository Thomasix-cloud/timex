'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Timer, Loader2, RefreshCw, Play, Square, Plus, Wand2, Search, ChevronUp, ChevronDown } from 'lucide-react';
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
  format,
} from 'date-fns';

type Project = { id: string; name: string; color: string };
type Tag = { id: string; name: string; color: string };
type Client = { id: string; name: string; color: string; isDefault?: boolean };

const periods = [
  { key: 'today', label: 'Today' },
  { key: 'this-week', label: 'This Week' },
  { key: 'last-week', label: 'Last Week' },
  { key: 'this-month', label: 'This Month' },
  { key: 'last-month', label: 'Last Month' },
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

function formatDecimal(seconds: number): string {
  const hours = seconds / 3600;
  return hours.toFixed(2).replace('.', ',');
}

type Props = {
  projectCount: number;
  runningEntry: { projectName: string | null; startTime: string } | null;
};

export function DashboardClient({ projectCount, runningEntry }: Props) {
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [periodReady, setPeriodReady] = useState(false);

  // Filter state
  const sourceFilters = [
    { key: 'all', label: 'All' },
    { key: 'tracker', label: 'Tracker' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'manual', label: 'Manual' },
  ] as const;
  type SourceKey = (typeof sourceFilters)[number]['key'];
  const [sourceFilter, setSourceFilter] = useState<SourceKey>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [billableFilter, setBillableFilter] = useState<string>('all');
  const [textFilter, setTextFilter] = useState('');

  // Load saved filters from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dashboard-filters');
      if (saved) {
        const f = JSON.parse(saved);
        if (f.period && periods.some((p) => p.key === f.period)) setPeriod(f.period);
        if (f.source && sourceFilters.some((s) => s.key === f.source)) setSourceFilter(f.source);
        if (f.client) setClientFilter(f.client);
        if (f.billable) setBillableFilter(f.billable);
        if (f.text != null) setTextFilter(f.text);
      }
    } catch {}
    setPeriodReady(true);
  }, []);

  // Persist filters to localStorage
  useEffect(() => {
    if (!periodReady) return;
    localStorage.setItem('dashboard-filters', JSON.stringify({
      period,
      source: sourceFilter,
      client: clientFilter,
      billable: billableFilter,
      text: textFilter,
    }));
  }, [period, sourceFilter, clientFilter, billableFilter, textFilter, periodReady]);

  const changePeriod = (p: PeriodKey) => {
    setPeriod(p);
  };
  const [entries, setEntries] = useState<SerializedTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);

  // Tracker state
  const [trackerDesc, setTrackerDesc] = useState('');
  const [trackerProjectId, setTrackerProjectId] = useState('');
  const [trackerTagId, setTrackerTagId] = useState('');
  const [trackerClientId, setTrackerClientId] = useState('');
  const [trackerRunning, setTrackerRunning] = useState<{ id: string; startTime: string; projectName: string | null } | null>(runningEntry ? { id: '', startTime: runningEntry.startTime, projectName: runningEntry.projectName } : null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Manual entry dialog state
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDesc, setManualDesc] = useState('');
  const [manualProjectId, setManualProjectId] = useState('');
  const [manualTagId, setManualTagId] = useState('');
  const [manualClientId, setManualClientId] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualDurationMin, setManualDurationMin] = useState(0);

  const fetchOptions = useCallback(async () => {
    const [pRes, tRes, cRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/tags'),
      fetch('/api/clients'),
    ]);
    if (pRes.ok) setProjects(await pRes.json());
    if (tRes.ok) setTags(await tRes.json());
    if (cRes.ok) {
      const clientsData = await cRes.json();
      setClients(clientsData);
      const defaultClient = clientsData.find((c: Client) => c.isDefault);
      if (defaultClient) {
        setTrackerClientId(defaultClient.id);
      }
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const startTimer = async () => {
    const res = await fetch('/api/time-entries/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: trackerDesc,
        projectId: trackerProjectId || undefined,
        tagId: trackerTagId || undefined,
        clientId: trackerClientId || undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setTrackerRunning({ id: data.id, startTime: data.startTime, projectName: data.project?.name ?? null });
    }
    setTrackerDesc('');
    setTrackerProjectId('');
    setTrackerTagId('');
    const defaultClient = clients.find((c) => c.isDefault);
    setTrackerClientId(defaultClient?.id ?? '');
    await fetchEntries(period);
  };

  const stopTimer = async () => {
    await fetch('/api/time-entries/stop', { method: 'POST' });
    setTrackerRunning(null);
    await fetchEntries(period);
  };

  const openManualEntry = () => {
    setManualDesc('');
    setManualProjectId('');
    setManualTagId('');
    const defaultClient = clients.find((c) => c.isDefault);
    setManualClientId(defaultClient?.id ?? '');
    const now = new Date();
    setManualStart(format(now, "yyyy-MM-dd'T'HH:mm"));
    setManualEnd(format(now, "yyyy-MM-dd'T'HH:mm"));
    setManualDurationMin(0);
    setManualOpen(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: manualDesc,
        startTime: new Date(manualStart).toISOString(),
        endTime: manualEnd ? new Date(manualEnd).toISOString() : undefined,
        projectId: manualProjectId || null,
        tagId: manualTagId || null,
        clientId: manualClientId || null,
      }),
    });
    setManualOpen(false);
    await fetchEntries(period);
  };

  const syncCalendar = async () => {
    setSyncing(true);
    try {
      await fetch('/api/calendar/sync', { method: 'POST' });
      await fetchEntries(period);
    } catch {
      // ignore
    }
    setSyncing(false);
  };

  const applyRules = async () => {
    const ids = filteredEntries.map((e) => e.id);
    if (ids.length === 0) return;
    setApplyingRules(true);
    try {
      await fetch('/api/time-entries/apply-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds: ids }),
      });
      await fetchEntries(period);
    } catch {
      // ignore
    }
    setApplyingRules(false);
  };

  const fetchEntries = useCallback(async (p: PeriodKey, signal?: AbortSignal) => {
    setLoading(true);
    const { from, to } = getRange(p);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    try {
      const res = await fetch(`/api/time-entries?${params}`, { cache: 'no-store', signal });
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
            calendarName: e.calendarName ?? null,
            billable: e.billable !== false,
            project: e.project
              ? { id: (e.project as Record<string, string>).id, name: (e.project as Record<string, string>).name, color: (e.project as Record<string, string>).color }
              : null,
            tag: e.tag
              ? { id: (e.tag as Record<string, string>).id, name: (e.tag as Record<string, string>).name, color: (e.tag as Record<string, string>).color }
              : null,
            client: e.client
              ? { id: (e.client as Record<string, string>).id, name: (e.client as Record<string, string>).name, color: (e.client as Record<string, string>).color }
              : null,
          })),
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (periodReady) {
      const controller = new AbortController();
      fetchEntries(period, controller.signal);
      return () => controller.abort();
    }
  }, [period, periodReady, fetchEntries]);

  const filteredEntries = entries.filter((e) => {
    if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
    if (clientFilter === '_none' && e.client) return false;
    if (clientFilter !== 'all' && clientFilter !== '_none' && (e.client?.id ?? '') !== clientFilter) return false;
    if (billableFilter === 'billable' && !e.billable) return false;
    if (billableFilter === 'non-billable' && e.billable) return false;
    if (textFilter.trim()) {
      const pattern = textFilter.trim().toLowerCase();
      const regex = new RegExp(
        '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
        'i',
      );
      const haystack = [
        e.description,
        e.project?.name,
        e.tag?.name,
        e.client?.name,
        e.calendarName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!regex.test(haystack) && !haystack.includes(pattern.replace(/\*/g, ''))) return false;
    }
    return true;
  });

  const totalSeconds = filteredEntries.reduce((acc, entry) => {
    if (entry.duration) return acc + entry.duration;
    if (entry.endTime) {
      return acc + differenceInSeconds(new Date(entry.endTime), new Date(entry.startTime));
    }
    return acc + differenceInSeconds(new Date(), new Date(entry.startTime));
  }, 0);

  const billableSeconds = filteredEntries.filter((e) => e.billable).reduce((acc, entry) => {
    if (entry.duration) return acc + entry.duration;
    if (entry.endTime) return acc + differenceInSeconds(new Date(entry.endTime), new Date(entry.startTime));
    return acc + differenceInSeconds(new Date(), new Date(entry.startTime));
  }, 0);
  const nonBillableSeconds = totalSeconds - billableSeconds;

  const billablePct = totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 100) : 0;
  const r = 34;
  const halfC = Math.PI * r;
  const fillArc = (billablePct / 100) * halfC;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-5">
          {/* Gauge */}
          <div className="relative shrink-0" style={{ width: 80, height: 48 }}>
            <svg width="80" height="48" viewBox="0 0 80 48" className="overflow-visible">
              <path
                d="M 6 44 A 34 34 0 0 1 74 44"
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinecap="round"
                className="text-muted/40"
              />
              {totalSeconds > 0 && (
                <path
                  d="M 6 44 A 34 34 0 0 1 74 44"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${fillArc} ${halfC}`}
                />
              )}
            </svg>
            <div className="absolute inset-0 flex items-end justify-center pb-0.5">
              <span className="text-sm font-bold">{billablePct}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{formatDecimal(totalSeconds)}h</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Billable</p>
              <p className="text-sm font-bold text-green-600">{formatDecimal(billableSeconds)}h</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Non-billable</p>
              <p className="text-sm font-bold text-muted-foreground">{formatDecimal(nonBillableSeconds)}h</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Running</p>
              <p className="text-sm font-bold">
                {trackerRunning ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Projects</p>
            <p className="text-xl font-bold">{projectCount}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Entries</p>
            <p className="text-xl font-bold">{filteredEntries.length}</p>
          </div>
        </div>
      </div>

      {/* Timer Bar */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={openManualEntry} title="Manual Entry">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={syncCalendar} disabled={syncing} title="Sync Calendar">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={applyRules} disabled={applyingRules || filteredEntries.length === 0} title="Apply Rules">
            <Wand2 className={`h-4 w-4 ${applyingRules ? 'animate-pulse' : ''}`} />
          </Button>
          <Input
            placeholder="What are you working on?"
            value={trackerDesc}
            onChange={(e) => setTrackerDesc(e.target.value)}
            className="flex-[5]"
            disabled={!!trackerRunning}
          />
          <Select
            value={trackerProjectId || '_none'}
            onValueChange={(v) => setTrackerProjectId(!v || v === '_none' ? '' : v)}
            disabled={!!trackerRunning}
          >
            <SelectTrigger className="w-32">
              <span data-slot="select-value" className="flex flex-1 text-left">
                {trackerProjectId
                  ? projects.find((p) => p.id === trackerProjectId)?.name ?? 'Project'
                  : 'Project'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={trackerTagId || '_none'}
            onValueChange={(v) => setTrackerTagId(!v || v === '_none' ? '' : v)}
            disabled={!!trackerRunning}
          >
            <SelectTrigger className="w-32">
              <span data-slot="select-value" className="flex flex-1 text-left">
                {trackerTagId
                  ? tags.find((t) => t.id === trackerTagId)?.name ?? 'Tag'
                  : 'Tag'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {trackerRunning ? (
            <Button size="icon" variant="destructive" onClick={stopTimer}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={startTimer}>
              <Play className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>Entries</CardTitle>
            <div className="flex gap-0.5 shrink-0">
              {periods.map((p) => (
                <Button
                  key={p.key}
                  variant={period === p.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => changePeriod(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-0.5 shrink-0">
              <Button
                variant={clientFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setClientFilter('all')}
              >
                All
              </Button>
              <Button
                variant={clientFilter === '_none' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setClientFilter('_none')}
              >
                No
              </Button>
              {clients.map((c) => (
                <Button
                  key={c.id}
                  variant={clientFilter === c.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setClientFilter(c.id)}
                >
                  <div className="mr-1 h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </Button>
              ))}
            </div>
            <div className="h-4 w-px bg-border shrink-0" />
            <div className="flex gap-0.5 shrink-0">
              <Button
                variant={billableFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setBillableFilter('all')}
              >
                All
              </Button>
              <Button
                variant={billableFilter === 'billable' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setBillableFilter('billable')}
              >
                Bill
              </Button>
              <Button
                variant={billableFilter === 'non-billable' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setBillableFilter('non-billable')}
              >
                NonBill
              </Button>
            </div>
            <div className="h-4 w-px bg-border shrink-0" />
            <div className="flex gap-0.5 shrink-0">
              {sourceFilters.map((s) => (
                <Button
                  key={s.key}
                  variant={sourceFilter === s.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSourceFilter(s.key)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="h-4 w-px bg-border shrink-0" />
            <div className="relative shrink-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter… (* = wildcard)"
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                className="h-7 w-44 pl-7 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <TimeEntryList
              entries={filteredEntries}
              onEntryUpdated={(updated) => {
                if ('_deleted' in updated) {
                  setEntries((prev) => prev.filter((e) => e.id !== updated.id));
                } else {
                  setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e));
                }
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Manual Entry Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Manual Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                placeholder="What did you work on?"
              />
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="datetime-local"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={manualEnd}
                  onChange={(e) => setManualEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="flex items-center rounded-md border h-9">
                  <div className="px-2 text-sm font-medium min-w-[4rem] text-center">
                    {manualDurationMin >= 60 ? `${Math.floor(manualDurationMin / 60)}h ${manualDurationMin % 60}m` : `${manualDurationMin}m`}
                  </div>
                  <div className="flex flex-col border-l">
                    <button
                      type="button"
                      className="px-1 py-0 hover:bg-muted transition-colors leading-none"
                      onClick={() => {
                        const mins = Math.min(Math.floor(manualDurationMin / 15) * 15 + 15, 480);
                        setManualDurationMin(mins);
                        if (manualStart) {
                          const start = new Date(manualStart);
                          const end = new Date(start.getTime() + mins * 60000);
                          setManualEnd(format(end, "yyyy-MM-dd'T'HH:mm"));
                        }
                      }}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="px-1 py-0 hover:bg-muted transition-colors border-t leading-none"
                      onClick={() => {
                        const mins = Math.max(manualDurationMin % 15 === 0 ? manualDurationMin - 15 : Math.floor(manualDurationMin / 15) * 15, 0);
                        setManualDurationMin(mins);
                        if (manualStart) {
                          const start = new Date(manualStart);
                          const end = new Date(start.getTime() + mins * 60000);
                          setManualEnd(format(end, "yyyy-MM-dd'T'HH:mm"));
                        }
                      }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  value={manualProjectId || '_none'}
                  onValueChange={(v) => setManualProjectId(!v || v === '_none' ? '' : v)}
                >
                  <SelectTrigger className="w-full">
                    <span data-slot="select-value" className="flex flex-1 text-left">
                      {manualProjectId
                        ? projects.find((p) => p.id === manualProjectId)?.name ?? 'Select project'
                        : 'None'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tag</Label>
                <Select
                  value={manualTagId || '_none'}
                  onValueChange={(v) => setManualTagId(!v || v === '_none' ? '' : v)}
                >
                  <SelectTrigger className="w-full">
                    <span data-slot="select-value" className="flex flex-1 text-left">
                      {manualTagId
                        ? tags.find((t) => t.id === manualTagId)?.name ?? 'Select tag'
                        : 'None'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {tags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={manualClientId || '_none'}
                onValueChange={(v) => setManualClientId(!v || v === '_none' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <span data-slot="select-value" className="flex flex-1 text-left">
                    {manualClientId
                      ? clients.find((c) => c.id === manualClientId)?.name ?? 'Select client'
                      : 'None'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              Add Entry
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
