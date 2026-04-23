'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({ name: z.string().min(1, 'Name is required') });
type FormData = z.infer<typeof schema>;

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: session?.user?.name ?? '' },
  });

  async function onSubmit(data: FormData) {
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await update({ name: data.name });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const initials = session?.user?.name?.slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-black tracking-tight mb-6" style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}>
        Settings
      </h1>

      <div className="rounded-3xl p-6 mb-4" style={{ background: '#25284c', border: '1px solid #323779' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#e3f4f8' }}>Profile</h3>
        <p className="text-xs mb-5" style={{ color: '#8589b2' }}>Update your display name</p>

        <div className="flex items-center gap-4 mb-5">
          <div
            className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
            style={{ background: 'rgba(87,94,254,0.2)', color: '#575efe', border: '1px solid rgba(87,94,254,0.3)' }}
          >
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#e3f4f8' }}>{session?.user?.email}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8589b2' }}>Avatar is pulled from GitHub or Google</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>Display name</label>
            <input
              {...register('name')}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{ background: '#1b1e3d', border: '1px solid #323779', color: '#e3f4f8' }}
              onFocus={e => (e.target.style.borderColor = '#575efe')}
              onBlur={e => (e.target.style.borderColor = '#323779')}
            />
            {errors.name && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{errors.name.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 btn-glow disabled:opacity-50"
            style={{ background: saved ? '#00d7ff' : '#575efe', color: '#ffffff' }}
          >
            {saved ? 'Saved!' : isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="rounded-3xl p-6" style={{ background: '#25284c', border: '1px solid #323779' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#e3f4f8' }}>Connected accounts</h3>
        <p className="text-xs mb-4" style={{ color: '#8589b2' }}>OAuth providers linked to your account</p>
        <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: '#1b1e3d', border: '1px solid #323779' }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="#e3f4f8"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          <span className="text-sm font-medium" style={{ color: '#e3f4f8' }}>GitHub</span>
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,215,255,0.1)', color: '#00d7ff' }}>
            Connected
          </span>
        </div>
      </div>
    </div>
  );
}
