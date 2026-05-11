'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

type Tag = {
  id: string;
  name: string;
  color: string;
  _count?: { timeEntries: number };
};

const COLORS = [
  '#8b5cf6',
  '#6366f1',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#64748b',
];

export function TagsTab() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const fetchTags = async () => {
    const res = await fetch('/api/tags');
    if (res.ok) setTags(await res.json());
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingTag) {
      await fetch(`/api/tags/${editingTag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
    } else {
      await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
    }

    setName('');
    setColor(COLORS[0]);
    setEditingTag(null);
    setOpen(false);
    fetchTags();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    fetchTags();
  };

  const openEdit = (tag: Tag) => {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setOpen(true);
  };

  const openCreate = () => {
    setEditingTag(null);
    setName('');
    setColor(COLORS[0]);
    setOpen(true);
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
            New Tag
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTag ? 'Edit Tag' : 'New Tag'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tag-name">Name</Label>
                <Input
                  id="tag-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tag name"
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
              <Button type="submit" className="w-full">
                {editingTag ? 'Save Changes' : 'Create Tag'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {tags.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tags yet. Create one to categorize your time entries.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 rounded-lg border p-3"
            >
              <Badge variant="outline" className="font-medium text-foreground" style={{ borderColor: tag.color }}>
                {tag.name}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {tag._count?.timeEntries ?? 0} entries
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => openEdit(tag)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => handleDelete(tag.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
