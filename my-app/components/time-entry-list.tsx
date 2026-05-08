'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
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
import { Pencil, Trash2 } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';

type Project = { id: string; name: string; color: string };
type Tag = { id: string; name: string; color: string };

export type SerializedTimeEntry = {
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
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function TimeEntryList({
  entries,
}: {
  entries: SerializedTimeEntry[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<SerializedTimeEntry | null>(null);
  const [desc, setDesc] = useState('');
  const [projectId, setProjectId] = useState('');
  const [tagId, setTagId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const fetchOptions = useCallback(async () => {
    const [pRes, tRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/tags'),
    ]);
    if (pRes.ok) setProjects(await pRes.json());
    if (tRes.ok) setTags(await tRes.json());
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  // Merge fetched projects/tags with any from entries to avoid showing raw IDs
  const allProjects = useMemo(() => {
    const map = new Map<string, Project>();
    entries.forEach((e) => { if (e.project) map.set(e.project.id, e.project); });
    projects.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [projects, entries]);

  const allTags = useMemo(() => {
    const map = new Map<string, Tag>();
    entries.forEach((e) => { if (e.tag) map.set(e.tag.id, e.tag); });
    tags.forEach((t) => map.set(t.id, t));
    return Array.from(map.values());
  }, [tags, entries]);

  const openEdit = (entry: SerializedTimeEntry) => {
    setEditEntry(entry);
    setDesc(entry.description);
    setProjectId(entry.project?.id ?? '');
    setTagId(entry.tag?.id ?? '');
    setStartTime(format(new Date(entry.startTime), "yyyy-MM-dd'T'HH:mm"));
    setEndTime(
      entry.endTime
        ? format(new Date(entry.endTime), "yyyy-MM-dd'T'HH:mm")
        : '',
    );
    setEditOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEntry) return;

    await fetch(`/api/time-entries/${editEntry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: desc,
        startTime: new Date(startTime).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        projectId: projectId || null,
        tagId: tagId || null,
      }),
    });

    setEditOpen(false);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No time entries today. Start tracking or sync your calendar!
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
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
                <p className="text-sm font-medium">
                  {entry.endTime
                    ? formatDuration(
                        entry.duration ??
                          differenceInSeconds(
                            new Date(entry.endTime),
                            new Date(entry.startTime),
                          ),
                      )
                    : 'Running...'}
                </p>
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
                onClick={() => openEdit(entry)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => handleDelete(entry.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What did you work on?"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  value={projectId || '_none'}
                  onValueChange={(v) => setProjectId(!v || v === '_none' ? '' : v)}
                >
                  <SelectTrigger className="w-full">
                    <span data-slot="select-value" className="flex flex-1 text-left">
                      {projectId
                        ? allProjects.find((p) => p.id === projectId)?.name ?? 'Select project'
                        : 'None'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {allProjects.map((p) => (
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
                  value={tagId || '_none'}
                  onValueChange={(v) => setTagId(!v || v === '_none' ? '' : v)}
                >
                  <SelectTrigger className="w-full">
                    <span data-slot="select-value" className="flex flex-1 text-left">
                      {tagId
                        ? allTags.find((t) => t.id === tagId)?.name ?? 'Select tag'
                        : 'None'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {allTags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
