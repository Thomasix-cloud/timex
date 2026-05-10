'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';

type Client = { id: string; name: string; color: string; isDefault?: boolean };

type Project = {
  id: string;
  name: string;
  color: string;
  client?: Client | null;
  _count?: { timeEntries: number };
};

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#64748b',
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);

  const fetchProjects = async () => {
    const res = await fetch('/api/projects');
    if (res.ok) setProjects(await res.json());
  };

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    if (res.ok) setClients(await res.json());
  };

  useEffect(() => {
    fetchProjects();
    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingProject) {
      await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, clientId: clientId || null }),
      });
    } else {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, clientId: clientId || null }),
      });
    }

    setName('');
    setColor(COLORS[0]);
    setClientId('');
    setEditingProject(null);
    setOpen(false);
    fetchProjects();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    fetchProjects();
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setColor(project.color);
    setClientId(project.client?.id ?? '');
    setOpen(true);
  };

  const openCreate = () => {
    setEditingProject(null);
    setName('');
    setColor(COLORS[0]);
    const defaultClient = clients.find((c) => c.isDefault);
    setClientId(defaultClient?.id ?? '');
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Project
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProject ? 'Edit Project' : 'New Project'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        color === c
                          ? 'border-foreground scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
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
                        ? clients.find((c) => c.id === clientId)?.name ?? 'Select client'
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
                {editingProject ? 'Save Changes' : 'Create Project'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No projects yet. Create one to start tracking time.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <CardTitle className="text-base">{project.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(project)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(project.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {project._count?.timeEntries ?? 0} entries
                  </p>
                  {project.client && (
                    <Badge variant="outline" className="text-xs" style={{ borderColor: project.client.color, color: project.client.color }}>
                      {project.client.name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
