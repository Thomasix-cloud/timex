import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { startOfDay, endOfDay, differenceInSeconds, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Timer, FolderKanban, Calendar } from 'lucide-react';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [todayEntries, runningEntry, projectCount, totalEntriesThisWeek] =
    await Promise.all([
      prisma.timeEntry.findMany({
        where: {
          userId: session.user.id,
          startTime: { gte: todayStart, lte: todayEnd },
        },
        include: { project: true, tag: true },
        orderBy: { startTime: 'desc' },
      }),
      prisma.timeEntry.findFirst({
        where: { userId: session.user.id, endTime: null },
        include: { project: true },
      }),
      prisma.project.count({ where: { userId: session.user.id } }),
      prisma.timeEntry.count({
        where: {
          userId: session.user.id,
          startTime: {
            gte: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - now.getDay(),
            ),
          },
        },
      }),
    ]);

  const totalSecondsToday = todayEntries.reduce((acc, entry) => {
    if (entry.duration) return acc + entry.duration;
    if (entry.endTime) {
      return acc + differenceInSeconds(entry.endTime, entry.startTime);
    }
    return acc + differenceInSeconds(now, entry.startTime);
  }, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(totalSecondsToday)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayEntries.length} entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runningEntry ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
            {runningEntry && (
              <p className="text-xs text-muted-foreground">
                {runningEntry.project?.name ?? 'No project'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEntriesThisWeek}</div>
            <p className="text-xs text-muted-foreground">entries</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {todayEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No time entries today. Start tracking or sync your calendar!
            </p>
          ) : (
            <div className="space-y-3">
              {todayEntries.map((entry) => (
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
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {entry.endTime
                        ? formatDuration(
                            entry.duration ??
                              differenceInSeconds(
                                entry.endTime,
                                entry.startTime,
                              ),
                          )
                        : 'Running...'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(entry.startTime, 'HH:mm')}
                      {' - '}
                      {entry.endTime ? format(entry.endTime, 'HH:mm') : 'now'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
