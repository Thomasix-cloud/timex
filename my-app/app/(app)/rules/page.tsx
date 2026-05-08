'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Plus, Pencil, Trash2, Wand2, TestTube } from 'lucide-react';

type Project = { id: string; name: string; color: string };
type Tag = { id: string; name: string; color: string };
type MappingRule = {
  id: string;
  name: string;
  matchPattern: string;
  matchField: string;
  matchType: string;
  priority: number;
  isActive: boolean;
  project: Project | null;
  tag: Tag | null;
};

export default function RulesPage() {
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MappingRule | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [matchPattern, setMatchPattern] = useState('');
  const [matchField, setMatchField] = useState('title');
  const [matchType, setMatchType] = useState('contains');
  const [priority, setPriority] = useState(0);
  const [projectId, setProjectId] = useState('');
  const [tagId, setTagId] = useState('');

  // Test state
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testPattern, setTestPattern] = useState('');
  const [testMatchType, setTestMatchType] = useState('wildcard');

  const fetchAll = async () => {
    const [rulesRes, projectsRes, tagsRes] = await Promise.all([
      fetch('/api/rules'),
      fetch('/api/projects'),
      fetch('/api/tags'),
    ]);
    if (rulesRes.ok) {
      const data: MappingRule[] = await rulesRes.json();
      data.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
      setRules(data);
    }
    if (projectsRes.ok) setProjects(await projectsRes.json());
    if (tagsRes.ok) setTags(await tagsRes.json());
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const resetForm = () => {
    setName('');
    setMatchPattern('');
    setMatchField('title');
    setMatchType('contains');
    setPriority(0);
    setProjectId('');
    setTagId('');
    setEditingRule(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (rule: MappingRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setMatchPattern(rule.matchPattern);
    setMatchField(rule.matchField);
    setMatchType(rule.matchType);
    setPriority(rule.priority);
    setProjectId(rule.project?.id ?? '');
    setTagId(rule.tag?.id ?? '');
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name,
      matchPattern,
      matchField,
      matchType,
      priority,
      projectId: projectId || null,
      tagId: tagId || null,
    };

    if (editingRule) {
      await fetch(`/api/rules/${editingRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    setOpen(false);
    resetForm();
    fetchAll();
  };

  const deleteRule = async (id: string) => {
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const toggleRule = async (rule: MappingRule) => {
    await fetch(`/api/rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    fetchAll();
  };

  const testRules = () => {
    if (!testText.trim()) {
      setTestResult(null);
      return;
    }

    for (const rule of rules) {
      if (!rule.isActive) continue;

      let matches = false;
      switch (rule.matchType) {
        case 'contains':
          matches = testText
            .toLowerCase()
            .includes(rule.matchPattern.toLowerCase());
          break;
        case 'exact':
          matches = testText.toLowerCase() === rule.matchPattern.toLowerCase();
          break;
        case 'wildcard': {
          const escaped = rule.matchPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
          const wildcardRegex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
          matches = wildcardRegex.test(testText);
          break;
        }
        case 'regex':
          try {
            matches = new RegExp(rule.matchPattern, 'i').test(testText);
          } catch {
            matches = false;
          }
          break;
      }

      if (matches) {
        const parts = [];
        if (rule.project) parts.push(`Project: ${rule.project.name}`);
        if (rule.tag) parts.push(`Tag: ${rule.tag.name}`);
        setTestResult(
          `Matched rule "${rule.name}" → ${parts.join(', ') || 'No assignment'}`,
        );
        return;
      }
    }

    setTestResult('No rules matched');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mapping Rules</h1>
          <p className="text-sm text-muted-foreground">
            Define rules to automatically assign projects and tags to calendar
            events
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Rule
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Rule' : 'New Rule'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='e.g. "Standup meetings"'
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Match Field</Label>
                  <Select
                    value={matchField}
                    onValueChange={(v) => setMatchField(v ?? 'title')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title">Event Title</SelectItem>
                      <SelectItem value="description">Description</SelectItem>
                      <SelectItem value="organizer">Organizer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Match Type</Label>
                  <Select
                    value={matchType}
                    onValueChange={(v) => setMatchType(v ?? 'contains')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="wildcard">Wildcard (*)</SelectItem>
                      <SelectItem value="exact">Exact Match</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pattern</Label>
                <Input
                  value={matchPattern}
                  onChange={(e) => setMatchPattern(e.target.value)}
                  placeholder='e.g. "standup" or "sprint.*review"'
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Priority (higher = checked first)</Label>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Assign Project</Label>
                  <Select
                    value={projectId}
                    onValueChange={(v) => setProjectId(v ?? '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None">
                        {projectId ? (() => {
                          const p = projects.find((p) => p.id === projectId);
                          return p ? (
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full inline-block"
                                style={{ backgroundColor: p.color }}
                              />
                              {p.name}
                            </span>
                          ) : null;
                        })() : null}
                      </SelectValue>
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
                  <Label>Assign Tag</Label>
                  <Select
                    value={tagId}
                    onValueChange={(v) => setTagId(v ?? '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None">
                        {tagId ? tags.find((t) => t.id === tagId)?.name ?? null : null}
                      </SelectValue>
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
                {editingRule ? 'Save Changes' : 'Create Rule'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Test Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TestTube className="h-4 w-4" />
            Test Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Input
              placeholder="Paste an event title to test matching..."
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={testRules}>
              Test All Rules
            </Button>
          </div>
          {testResult && (
            <span className="text-sm text-muted-foreground">
              {testResult}
            </span>
          )}
          <Separator />
          <p className="text-xs text-muted-foreground">Quick pattern test</p>
          <div className="flex gap-3">
            <Select value={testMatchType} onValueChange={(v) => setTestMatchType(v ?? 'wildcard')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="wildcard">Wildcard (*)</SelectItem>
                <SelectItem value="exact">Exact Match</SelectItem>
                <SelectItem value="regex">Regex</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Pattern e.g. Tipsport*issues"
              value={testPattern}
              onChange={(e) => setTestPattern(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={() => {
              if (!testText.trim() || !testPattern.trim()) return;
              let matches = false;
              switch (testMatchType) {
                case 'contains':
                  matches = testText.toLowerCase().includes(testPattern.toLowerCase());
                  break;
                case 'exact':
                  matches = testText.toLowerCase() === testPattern.toLowerCase();
                  break;
                case 'wildcard': {
                  const escaped = testPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
                  const wcRegex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
                  matches = wcRegex.test(testText);
                  break;
                }
                case 'regex':
                  try { matches = new RegExp(testPattern, 'i').test(testText); } catch { matches = false; }
                  break;
              }
              setTestResult(matches ? `Pattern matches!` : `Pattern does not match.`);
            }}>
              Test Pattern
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Wand2 className="mx-auto mb-3 h-8 w-8" />
            <p>No mapping rules yet.</p>
            <p className="text-sm">
              Create rules to auto-assign projects and tags to calendar events.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={rule.isActive ? '' : 'opacity-50'}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{rule.name}</p>
                    <Badge variant="outline" className="text-xs">
                      Priority: {rule.priority}
                    </Badge>
                    {!rule.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    If <strong>{rule.matchField}</strong>{' '}
                    <strong>{rule.matchType}</strong> &quot;{rule.matchPattern}
                    &quot;
                    {rule.project && (
                      <>
                        {' → '}
                        <span
                          className="font-medium"
                          style={{ color: rule.project.color }}
                        >
                          {rule.project.name}
                        </span>
                      </>
                    )}
                    {rule.tag && (
                      <>
                        {' + '}
                        <Badge
                          style={{
                            backgroundColor: rule.tag.color,
                            color: 'white',
                          }}
                          className="text-xs"
                        >
                          {rule.tag.name}
                        </Badge>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRule(rule)}
                  >
                    {rule.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(rule)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
