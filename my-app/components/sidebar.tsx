'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Clock,
  LayoutDashboard,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  const settingsActive = pathname.startsWith('/settings');

  return (
    <aside className={cn('flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200', collapsed ? 'w-14' : 'w-44')}>
      <div className={cn('flex h-16 items-center border-b', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 shrink-0 text-sidebar-primary" />
          {!collapsed && <span className="text-lg font-bold">TimeX</span>}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground" onClick={toggle} title={collapsed ? 'Rozbalit' : 'Sbalit'}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                collapsed ? 'justify-center' : 'gap-3',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <Link
          href="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={cn(
            'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
            collapsed ? 'justify-center' : 'gap-3',
            settingsActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && 'Settings'}
        </Link>
      </div>
      <div className={cn('border-t p-3', collapsed ? 'flex justify-center' : '')}>
        {!collapsed && (
          <span className="text-xs text-sidebar-foreground/40">{process.env.NEXT_PUBLIC_COMMIT_DATE ?? '0000000000'}-{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}-{process.env.NEXT_PUBLIC_GIT_COMMIT ?? 'dev'}</span>
        )}
      </div>
    </aside>
  );
}
