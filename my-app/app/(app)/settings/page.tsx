'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Calendar,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  FolderKanban,
  Users,
  Tags,
  Wand2,
} from 'lucide-react';
import { ProjectsTab } from '@/components/settings/projects-tab';
import { ClientsTab } from '@/components/settings/clients-tab';
import { TagsTab } from '@/components/settings/tags-tab';
import { RulesTab } from '@/components/settings/rules-tab';

type CalendarInfo = {
  id: string;
  name: string;
  primary: boolean;
  connected: boolean;
  connection: {
    id: string;
    syncEnabled: boolean;
    lastSyncAt: string | null;
  } | null;
};

type SyncResult = {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
};

export default function SettingsPage() {
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendars = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/calendar/calendars');
      if (res.ok) {
        setCalendars(await res.json());
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to load calendars');
      }
    } catch {
      setError('Failed to connect. Please sign in again with Google.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCalendars();
  }, []);

  const toggleCalendar = async (cal: CalendarInfo) => {
    await fetch('/api/calendar/calendars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendarId: cal.id,
        calendarName: cal.name,
        syncEnabled: !cal.connected || !cal.connection?.syncEnabled,
      }),
    });
    fetchCalendars();
  };

  const syncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setSyncResult(result);
      } else {
        const data = await res.json();
        setError(data.error || 'Sync failed');
      }
    } catch {
      setError('Sync failed');
    }
    setSyncing(false);
    fetchCalendars();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Tabs defaultValue={0}>
        <TabsList>
          <TabsTrigger value={0}>
            <FolderKanban className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value={1}>
            <Users className="h-4 w-4" />
            Clients
          </TabsTrigger>
          <TabsTrigger value={2}>
            <Tags className="h-4 w-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger value={3}>
            <Wand2 className="h-4 w-4" />
            Rules
          </TabsTrigger>
          <TabsTrigger value={4}>
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value={0}>
          <ProjectsTab />
        </TabsContent>

        <TabsContent value={1}>
          <ClientsTab />
        </TabsContent>

        <TabsContent value={2}>
          <TagsTab />
        </TabsContent>

        <TabsContent value={3}>
          <RulesTab />
        </TabsContent>

        <TabsContent value={4}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Google Calendar
                <div className="ml-auto">
                  <Button size="sm" onClick={syncNow} disabled={syncing}>
                    {syncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Now
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading calendars...
                </div>
              ) : error ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button variant="outline" size="sm" onClick={fetchCalendars}>
                    Retry
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Select which calendars to sync. Events from enabled calendars
                    will be automatically logged as time entries.
                  </p>
                  <div className="space-y-2">
                    {calendars.map((cal) => (
                      <div
                        key={cal.id}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div className="flex items-center gap-3">
                          {cal.connection?.syncEnabled ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{cal.name}</p>
                            {cal.primary && (
                              <Badge variant="secondary" className="text-xs">
                                Primary
                              </Badge>
                            )}
                            {cal.connection?.lastSyncAt && (
                              <p className="text-xs text-muted-foreground">
                                Last synced:{' '}
                                {new Date(
                                  cal.connection.lastSyncAt,
                                ).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant={
                            cal.connection?.syncEnabled ? 'destructive' : 'default'
                          }
                          size="sm"
                          onClick={() => toggleCalendar(cal)}
                        >
                          {cal.connection?.syncEnabled ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {syncResult && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Synced: {syncResult.synced} events, {syncResult.created} new,{' '}
                      {syncResult.updated} updated, {syncResult.skipped} skipped
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
