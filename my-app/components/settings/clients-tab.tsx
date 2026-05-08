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
import { Plus, Pencil, Trash2, Star } from 'lucide-react';

type Client = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  _count?: { timeEntries: number };
};

const COLORS = [
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#64748b',
];

export function ClientsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [isDefault, setIsDefault] = useState(false);

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    if (res.ok) setClients(await res.json());
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingClient) {
      await fetch(`/api/clients/${editingClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, isDefault }),
      });
    } else {
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, isDefault }),
      });
    }

    setName('');
    setColor(COLORS[0]);
    setIsDefault(false);
    setEditingClient(null);
    setOpen(false);
    fetchClients();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    fetchClients();
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setColor(client.color);
    setIsDefault(client.isDefault);
    setOpen(true);
  };

  const openCreate = () => {
    setEditingClient(null);
    setName('');
    setColor(COLORS[0]);
    setIsDefault(false);
    setOpen(true);
  };

  const toggleDefault = async (client: Client) => {
    await fetch(`/api/clients/${client.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: !client.isDefault }),
    });
    fetchClients();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Client
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Edit Client' : 'New Client'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Name</Label>
                <Input
                  id="client-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Client name"
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`flex h-8 w-8 items-center justify-center rounded-md border ${isDefault ? 'border-yellow-500 bg-yellow-50 text-yellow-600' : 'border-muted text-muted-foreground'}`}
                  onClick={() => setIsDefault(!isDefault)}
                >
                  <Star className="h-4 w-4" fill={isDefault ? 'currentColor' : 'none'} />
                </button>
                <Label className="text-sm">{isDefault ? 'Default client' : 'Not default'}</Label>
              </div>
              <Button type="submit" className="w-full">
                {editingClient ? 'Save Changes' : 'Create Client'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No clients yet. Create one to start organizing your time entries.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: client.color }}
                  />
                  <CardTitle className="text-base">{client.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${client.isDefault ? 'text-yellow-500' : 'text-muted-foreground'}`}
                    title={client.isDefault ? 'Remove default' : 'Set as default'}
                    onClick={() => toggleDefault(client)}
                  >
                    <Star className="h-3.5 w-3.5" fill={client.isDefault ? 'currentColor' : 'none'} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(client)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(client.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {client._count?.timeEntries ?? 0} entries
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
