'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Projects', icon: '⊞' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 h-screen flex flex-col shrink-0" style={{ background: '#1b1e3d', borderRight: '1px solid #323779' }}>
      <div className="px-5 py-5" style={{ borderBottom: '1px solid #323779' }}>
        <span className="font-black text-lg tracking-tight" style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}>
          Prodify
        </span>
      </div>
      <nav className="flex-1 p-3 space-y-1 mt-2">
        {links.map(link => {
          const isActive = pathname === link.href || (link.href !== '/dashboard' ? false : pathname.startsWith('/dashboard'));
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: isActive ? '#25284c' : 'transparent',
                color: isActive ? '#e3f4f8' : '#8589b2',
                borderLeft: isActive ? '2px solid #575efe' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: '15px' }}>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4" style={{ borderTop: '1px solid #323779' }}>
        <div className="text-xs" style={{ color: '#8589b2' }}>Sub-project 1 · Auth + Accounts</div>
      </div>
    </aside>
  );
}
