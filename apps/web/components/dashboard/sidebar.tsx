'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/dashboard', label: 'Projects' },
  { href: '/settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r bg-white h-screen flex flex-col shrink-0">
      <div className="p-4 border-b">
        <span className="font-bold text-lg tracking-tight">Prodify</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === link.href
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
