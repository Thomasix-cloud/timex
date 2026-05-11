'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Play, Square, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

type Project = { id: string; name: string; color: string };
type Tag = { id: string; name: string; color: string };
type TimeEntry = {
  id: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  source: string;
  project: Project | null;
  tag: Tag | null;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="font-mono text-lg font-bold text-green-600">
      {formatDuration(elapsed)}
    </span>
  );
}

export default function TrackerPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);

  // Timer form
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [tagId, setTagId] = useState<string>('');

  // Manual entry dialog
  const [manualOpen, setManualOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [manualDesc, setManualDesc] = useState('');
  const [manualProjectId, setManualProjectId] = useState<string>('');
  const [manualTagId, setManualTagId] = useState<string>('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualDurationMin, setManualDurationMin] = useState(0);

  const fetchAll = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [entriesRes, projectsRes, tagsRes] = await Promise.all([
      fetch(`/api/time-entries?from=${today.toISOString()}`),
      fetch('/api/projects'),
      fetch('/api/tags'),
    ]);
    if (entriesRes.ok) {
      const data: TimeEntry[] = await entriesRes.json();
      setEntries(data);
      setRunningEntry(data.find((e) => !e.endTime) ?? null);
    }
    if (projectsRes.ok) setProjects(await projectsRes.json());
    if (tagsRes.ok) setTags(await tagsRes.json());
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const startTimer = async () => {
    await fetch('/api/time-entries/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        projectId: projectId || undefined,
        tagId: tagId || undefined,
      }),
    });
    setDescription('');
    setProjectId('');
    setTagId('');
    fetchAll();
  };

  const stopTimer = async () => {
    await fetch('/api/time-entries/stop', { method: 'POST' });
    fetchAll();
  };

  const deleteEntry = async (id: string) => {
    await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const openManualEntry = () => {
    setEditEntry(null);
    setManualDesc('');
    setManualProjectId('');
    setManualTagId('');
    const now = new Date();
    setManualStart(format(now, "yyyy-MM-dd'T'HH:mm"));
    setManualEnd(format(now, "yyyy-MM-dd'T'HH:mm"));
    setManualDurationMin(0);
    setManualOpen(true);
  };

  const openEditEntry = (entry: TimeEntry) => {
    setEditEntry(entry);
    setManualDesc(entry.description);
    setManualProjectId(entry.project?.id ?? '');
    setManualTagId(entry.tag?.id ?? '');
    setManualStart(format(new Date(entry.startTime), "yyyy-MM-dd'T'HH:mm"));
    const endStr = entry.endTime
      ? format(new Date(entry.endTime), "yyyy-MM-dd'T'HH:mm")
      : '';
    setManualEnd(endStr);
    const dur = entry.endTime
      ? Math.min(60, Math.max(0, Math.round((new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 60000)))
      : 0;
    setManualDurationMin(dur);
    setManualOpen(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editEntry) {
      await fetch(`/api/time-entries/${editEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: manualDesc,
          startTime: new Date(manualStart).toISOString(),
          endTime: manualEnd ? new Date(manualEnd).toISOString() : undefined,
          projectId: manualProjectId || null,
          tagId: manualTagId || null,
        }),
      });
    } else {
      await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: manualDesc,
          startTime: new Date(manualStart).toISOString(),
          endTime: manualEnd ? new Date(manualEnd).toISOString() : undefined,
          projectId: manualProjectId || null,
          tagId: manualTagId || null,
        }),
      });
    }

    setManualOpen(false);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tracker</h1>
        <Button variant="outline" onClick={openManualEntry}>
          <Plus className="mr-2 h-4 w-4" />
          Manual Entry
        </Button>
      </div>

      {/* Timer Bar */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <Input
            placeholder="What are you working on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex-1"
            disabled={!!runningEntry}
          />
          <Select
            value={projectId}
            onValueChange={(v) => setProjectId(v ?? '')}
            disabled={!!runningEntry}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
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
            value={tagId}
            onValueChange={(v) => setTagId(v ?? '')}
            disabled={!!runningEntry}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {runningEntry ? (
            <div className="flex items-center gap-3">
              <LiveTimer startTime={runningEntry.startTime} />
              <Button size="icon" variant="destructive" onClick={stopTimer}>
                <Square className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button size="icon" onClick={startTimer}>
              <Play className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Entries List */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entries today. Start the timer or add a manual entry.
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    {entry.project && (
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: entry.project.color }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {entry.description || 'Untitled'}
                      </p>
                      <div className="flex items-center gap-2">
                        {entry.project && (
                          <span className="text-xs text-muted-foreground">
                            {entry.project.name}
                          </span>
                        )}
                        {entry.tag && (
                          <Badge variant="secondary" className="text-xs">
                            {entry.tag.name}
                          </Badge>
                        )}
                        {entry.source === 'calendar' && (
                          <Badge variant="outline" className="text-xs">
                            Calendar
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {entry.endTime ? (
                        <p className="text-sm font-medium">
                          {formatDuration(entry.duration ?? 0)}
                        </p>
                      ) : (
                        <LiveTimer startTime={entry.startTime} />
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.startTime), 'HH:mm')}
                        {' - '}
                        {entry.endTime
                          ? format(new Date(entry.endTime), 'HH:mm')
                          : 'now'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditEntry(entry)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteEntry(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Entry / Edit Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editEntry ? 'Edit Entry' : 'Add Manual Entry'}
            </DialogTitle>
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
                  value={manualProjectId}
                  onValueChange={(v) => setManualProjectId(v ?? '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
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
                  value={manualTagId}
                  onValueChange={(v) => setManualTagId(v ?? '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full">
              {editEntry ? 'Save Changes' : 'Add Entry'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
