import { auth, signOut } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export async function Header() {
  const session = await auth();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div />
      {session?.user && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {session.user.name}
          </span>
          <Avatar className="h-8 w-8">
            <AvatarImage src={session.user.image ?? undefined} />
            <AvatarFallback>
              {session.user.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button variant="ghost" size="icon" type="submit">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </header>
  );
}
