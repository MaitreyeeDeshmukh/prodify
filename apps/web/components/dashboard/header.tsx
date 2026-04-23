'use client';

import { signOut, useSession } from 'next-auth/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { data: session } = useSession();
  const initials = session?.user?.name?.slice(0, 2).toUpperCase() ?? 'U';

  return (
    <header className="h-14 flex items-center justify-end px-6 shrink-0"
      style={{ background: '#1b1e3d', borderBottom: '1px solid #323779' }}>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 text-sm transition-opacity hover:opacity-80 outline-none">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: '#575efe', color: '#ffffff' }}
          >
            {initials}
          </div>
          <span style={{ color: '#e3f4f8' }}>{session?.user?.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
