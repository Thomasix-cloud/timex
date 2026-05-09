import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { DashboardClient } from '@/components/dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [projectCount, runningEntry] = await Promise.all([
    prisma.project.count({ where: { userId: session.user.id } }),
    prisma.timeEntry.findFirst({
      where: { userId: session.user.id, endTime: null },
      include: { project: true },
    }),
  ]);

  return (
    <DashboardClient
      projectCount={projectCount}
      runningEntry={
        runningEntry
          ? {
              projectName: runningEntry.project?.name ?? null,
              startTime: runningEntry.startTime.toISOString(),
            }
          : null
      }
    />
  );
}
