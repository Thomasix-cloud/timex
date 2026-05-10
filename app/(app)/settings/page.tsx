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
  Plus,
  Trash2,
  Mail,
  ChevronDown,
  ChevronUp,
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
  accountId: string | null;
  accountEmail: string;
  connection: {
    id: string;
    syncEnabled: boolean;
    lastSyncAt: string | null;
  } | null;
};

type CalendarAccount = {
  id: string;
  provider: string;
  email: string;
  createdAt: string;
  connections: Array<{
    id: string;
    calendarId: string;
    calendarName: string;
    syncEnabled: boolean;
    lastSyncAt: string | null;
  }>;
};

type SyncResult = {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
};

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/calendar/accounts');
      if (res.ok) {
        setAccounts(await res.json());
      }
    } catch {
      // silently fail, accounts list is supplementary
    }
  };

  const fetchCalendars = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/calendar/calendars');
      if (res.ok) {
        setCalendars(await res.json());
      } else {
        const data = await res.json();
        setError(data.detail || data.error || 'Failed to load calendars');
      }
    } catch {
      setError('No calendar accounts connected.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
    fetchCalendars();
  }, []);

  const connectGoogleAccount = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/calendar/connect');
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        setError('Failed to start connection');
        setConnecting(false);
      }
    } catch {
      setError('Failed to connect');
      setConnecting(false);
    }
  };

  const disconnectAccount = async (accountId: string) => {
    await fetch('/api/calendar/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });
    fetchAccounts();
    fetchCalendars();
  };

  const toggleCalendar = async (cal: CalendarInfo) => {
    await fetch('/api/calendar/calendars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendarId: cal.id,
        calendarName: cal.name,
        syncEnabled: !cal.connected || !cal.connection?.syncEnabled,
        accountId: cal.accountId,
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
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={connectGoogleAccount}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Connect Account
                  </Button>
                  <Button
                    size="sm"
                    onClick={syncNow}
                    disabled={syncing || accounts.length === 0}
                  >
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
            <CardContent className="space-y-6">
              {accounts.length === 0 && !loading && (
                <div className="text-center py-6 space-y-3">
                  <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No calendar accounts connected. Connect a Google account to
                    start syncing calendar events.
                  </p>
                  <Button onClick={connectGoogleAccount} disabled={connecting}>
                    {connecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Connect Google Account
                  </Button>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading calendars...
                </div>
              )}

              {/* Error */}
              {error && accounts.length > 0 && !loading && (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button variant="outline" size="sm" onClick={fetchCalendars}>
                    Retry
                  </Button>
                </div>
              )}

              {/* Accounts with calendars */}
              {!loading && accounts.map((account) => {
                const accountCalendars = calendars.filter(
                  (c) => c.accountId === account.id,
                );
                // Also include legacy calendars (accountId === null) for the first account
                const legacyCalendars = accounts.indexOf(account) === 0
                  ? calendars.filter((c) => c.accountId === null)
                  : [];
                const allAccountCalendars = [...accountCalendars, ...legacyCalendars];

                const syncedCalendars = allAccountCalendars.filter(
                  (c) => c.connection?.syncEnabled,
                );
                const otherCalendars = allAccountCalendars.filter(
                  (c) => !c.connection?.syncEnabled,
                );
                const isExpanded = expandedAccounts.has(account.id);

                return (
                  <div key={account.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{account.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {syncedCalendars.length} of {allAccountCalendars.length} calendars syncing
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => disconnectAccount(account.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    {/* Synced calendars - always visible */}
                    {syncedCalendars.length > 0 && (
                      <div className="space-y-1.5 ml-7">
                        {syncedCalendars.map((cal) => (
                          <div
                            key={cal.id}
                            className="flex items-center justify-between rounded-md border p-2.5"
                          >
                            <div className="flex items-center gap-2.5">
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
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
                                    {new Date(cal.connection.lastSyncAt).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => toggleCalendar(cal)}
                            >
                              Disable
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Other calendars - behind expand button */}
                    {otherCalendars.length > 0 && (
                      <div className="ml-7">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => {
                            setExpandedAccounts((prev) => {
                              const next = new Set(prev);
                              if (next.has(account.id)) {
                                next.delete(account.id);
                              } else {
                                next.add(account.id);
                              }
                              return next;
                            });
                          }}
                        >
                          {isExpanded ? (
                            <ChevronUp className="mr-1.5 h-4 w-4" />
                          ) : (
                            <ChevronDown className="mr-1.5 h-4 w-4" />
                          )}
                          {otherCalendars.length} more calendars
                        </Button>
                        {isExpanded && (
                          <div className="space-y-1.5 mt-1.5">
                            {otherCalendars.map((cal) => (
                              <div
                                key={cal.id}
                                className="flex items-center justify-between rounded-md border border-dashed p-2.5"
                              >
                                <div className="flex items-center gap-2.5">
                                  <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div>
                                    <p className="text-sm">{cal.name}</p>
                                    {cal.primary && (
                                      <Badge variant="secondary" className="text-xs">
                                        Primary
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => toggleCalendar(cal)}
                                >
                                  Enable
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {accounts.indexOf(account) < accounts.length - 1 && (
                      <Separator />
                    )}
                  </div>
                );
              })}

              {syncResult && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Synced: {syncResult.synced} events, {syncResult.created}{' '}
                      new, {syncResult.updated} updated, {syncResult.skipped}{' '}
                      skipped
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
