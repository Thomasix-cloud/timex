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
import { Pencil, Trash2, Play, DollarSign } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';

type Project = { id: string; name: string; color: string };
type Tag = { id: string; name: string; color: string };
type Client = { id: string; name: string; color: string };

export type SerializedTimeEntry = {
  id: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  source: string;
  calendarName: string | null;
  billable: boolean;
  project: Project | null;
  tag: Tag | null;
  client: Client | null;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function TimeEntryList({
  entries,
  initialProjects,
  initialTags,
  onEntryUpdated,
}: {
  entries: SerializedTimeEntry[];
  initialProjects?: Project[];
  initialTags?: Tag[];
  onEntryUpdated?: (entry: SerializedTimeEntry) => void;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects ?? []);
  const [tags, setTags] = useState<Tag[]>(initialTags ?? []);
  const [clients, setClients] = useState<Client[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<SerializedTimeEntry | null>(null);
  const [desc, setDesc] = useState('');
  const [projectId, setProjectId] = useState('');
  const [tagId, setTagId] = useState('');
  const [clientId, setClientId] = useState('');
  const [billable, setBillable] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const fetchOptions = useCallback(async () => {
    const [pRes, tRes, cRes] = await Promise.all([
      initialProjects?.length ? null : fetch('/api/projects'),
      initialTags?.length ? null : fetch('/api/tags'),
      fetch('/api/clients'),
    ]);
    if (pRes?.ok) setProjects(await pRes.json());
    if (tRes?.ok) setTags(await tRes.json());
    if (cRes?.ok) setClients(await cRes.json());
  }, [initialProjects, initialTags]);

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

  const allClients = useMemo(() => {
    const map = new Map<string, Client>();
    entries.forEach((e) => { if (e.client) map.set(e.client.id, e.client); });
    clients.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [clients, entries]);

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{ id: string; message: string; ok: boolean } | null>(null);

  const applyRules = async (entryId: string) => {
    setApplyingId(entryId);
    setApplyResult(null);
    try {
      const res = await fetch(`/api/time-entries/${entryId}/apply-rules`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.matched) {
          setApplyResult({ id: entryId, message: `✓ ${data.ruleName}`, ok: true });
          if (onEntryUpdated && data.entry) {
            onEntryUpdated({
              id: data.entry.id,
              description: data.entry.description,
              startTime: data.entry.startTime,
              endTime: data.entry.endTime ?? null,
              duration: data.entry.duration,
              source: data.entry.source,
              calendarName: data.entry.calendarName ?? null,
              billable: data.entry.billable !== false,
              project: data.entry.project ? { id: data.entry.project.id, name: data.entry.project.name, color: data.entry.project.color } : null,
              tag: data.entry.tag ? { id: data.entry.tag.id, name: data.entry.tag.name, color: data.entry.tag.color } : null,
              client: data.entry.client ? { id: data.entry.client.id, name: data.entry.client.name, color: data.entry.client.color } : null,
            });
          } else {
            router.refresh();
          }
        } else {
          setApplyResult({ id: entryId, message: 'No rules matched', ok: false });
        }
      } else {
        setApplyResult({ id: entryId, message: 'Error', ok: false });
      }
    } finally {
      setApplyingId(null);
      setTimeout(() => setApplyResult(null), 3000);
    }
  };

  const openEdit = (entry: SerializedTimeEntry) => {
    setEditEntry(entry);
    setDesc(entry.description);
    setProjectId(entry.project?.id ?? '');
    setTagId(entry.tag?.id ?? '');
    setClientId(entry.client?.id ?? '');
    setBillable(entry.billable);
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

    const res = await fetch(`/api/time-entries/${editEntry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: desc,
        startTime: new Date(startTime).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        projectId: projectId || null,
        tagId: tagId || null,
        clientId: clientId || null,
        billable,
      }),
    });

    setEditOpen(false);
    if (res.ok && onEntryUpdated) {
      const data = await res.json();
      onEntryUpdated({
        id: data.id,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime ?? null,
        duration: data.duration,
        source: data.source,
        calendarName: data.calendarName ?? null,
        billable: data.billable,
        project: data.project ? { id: data.project.id, name: data.project.name, color: data.project.color } : null,
        tag: data.tag ? { id: data.tag.id, name: data.tag.name, color: data.tag.color } : null,
        client: data.client ? { id: data.client.id, name: data.client.name, color: data.client.color } : null,
      });
    } else {
      router.refresh();
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
    if (onEntryUpdated) {
      // Remove from parent state by signaling with null fields
      onEntryUpdated({ id, description: '', startTime: '', endTime: null, duration: null, source: '', billable: true, project: null, tag: null, client: null, _deleted: true } as SerializedTimeEntry & { _deleted?: boolean });
    } else {
      router.refresh();
    }
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-0"
                title={entry.billable ? 'Billable' : 'Non-billable'}
                onClick={async () => {
                  const res = await fetch(`/api/time-entries/${entry.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ billable: !entry.billable }),
                  });
                  if (res.ok && onEntryUpdated) {
                    const data = await res.json();
                    onEntryUpdated({
                      id: data.id,
                      description: data.description,
                      startTime: data.startTime,
                      endTime: data.endTime ?? null,
                      duration: data.duration,
                      source: data.source,
                      calendarName: data.calendarName ?? null,
                      billable: data.billable,
                      project: data.project ? { id: data.project.id, name: data.project.name, color: data.project.color } : null,
                      tag: data.tag ? { id: data.tag.id, name: data.tag.name, color: data.tag.color } : null,
                      client: data.client ? { id: data.client.id, name: data.client.name, color: data.client.color } : null,
                    });
                  }
                }}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${entry.billable ? 'bg-green-600 text-white' : 'border border-gray-400 text-gray-400'}`}>$</span>
              </Button>
              <div>
                <p className="text-sm font-medium">
                  {entry.description || 'Untitled'}
                </p>
                <div className="flex items-center gap-2">
                  {entry.client && (
                    <Badge variant="outline" className="text-xs text-foreground" style={{ borderColor: entry.client.color }}>
                      {entry.client.name}
                    </Badge>
                  )}
                  {entry.project && (
                    <Badge variant="outline" className="text-xs font-medium text-foreground" style={{ borderColor: entry.project.color }}>
                      {entry.project.name}
                    </Badge>
                  )}
                  {entry.tag && (
                    <Badge variant="secondary" className="text-xs text-foreground" style={{ backgroundColor: entry.tag.color + '20' }}>
                      {entry.tag.name}
                    </Badge>
                  )}
                  {entry.source === 'calendar' && (
                    <Badge variant="outline" className="text-xs">
                      {entry.calendarName || 'Calendar'}
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
                  {format(new Date(entry.startTime), 'd.M.')}
                  {' '}
                  {format(new Date(entry.startTime), 'HH:mm')}
                  {' - '}
                  {entry.endTime
                    ? format(new Date(entry.endTime), 'HH:mm')
                    : 'now'}
                </p>
              </div>
              {applyResult?.id === entry.id && (
                <span className={`text-xs ${applyResult.ok ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {applyResult.message}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600"
                title="Apply mapping rules"
                disabled={applyingId === entry.id}
                onClick={() => applyRules(entry.id)}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
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
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={clientId || '_none'}
                onValueChange={(v) => setClientId(!v || v === '_none' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <span data-slot="select-value" className="flex flex-1 text-left">
                    {clientId
                      ? allClients.find((c) => c.id === clientId)?.name ?? 'Select client'
                      : 'None'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {allClients.map((c) => (
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-muted"
                onClick={() => setBillable(!billable)}
                title={billable ? 'Billable' : 'Non-billable'}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${billable ? 'bg-green-600 text-white' : 'border border-gray-400 text-gray-400'}`}>$</span>
              </button>
              <Label className="text-sm">{billable ? 'Billable' : 'Non-billable'}</Label>
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
