'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validations';

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenFromUrl = params.get('token');
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const [token, setToken] = useState(tokenFromUrl || '');

  async function onSubmit(data: ResetPasswordInput) {
    setError('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, token: tokenFromUrl || data.token }),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      setError(json.error ?? 'Something went wrong');
      return;
    }
    router.push('/login?reset=1');
  }

  const inputStyle = { background: '#1b1e3d', border: '1px solid #323779', color: '#e3f4f8' };

  return (
    <div className="glass-card rounded-3xl p-8">
      <h2 className="text-xl font-bold mb-1" style={{ color: '#e3f4f8' }}>Set new password</h2>
      <p className="text-sm mb-6" style={{ color: '#8589b2' }}>Enter the code from your email and choose a new password</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {!tokenFromUrl && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>Reset Code</label>
            <input
              type="text"
              {...register('token')}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#575efe')}
              onBlur={e => (e.target.style.borderColor = '#323779')}
              placeholder="Enter 6-digit code"
            />
            {errors.token && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{errors.token.message}</p>}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>New password</label>
          <input
            type="password"
            {...register('password')}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#575efe')}
            onBlur={e => (e.target.style.borderColor = '#323779')}
            placeholder="8+ chars, uppercase, number"
          />
          {errors.password && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>Confirm password</label>
          <input
            type="password"
            {...register('confirmPassword')}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#575efe')}
            onBlur={e => (e.target.style.borderColor = '#323779')}
            placeholder="••••••••"
          />
          {errors.confirmPassword && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{errors.confirmPassword.message}</p>}
        </div>
        {error && <p className="text-sm" style={{ color: '#ff6b6b' }}>{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-6 rounded-full font-semibold text-sm transition-all duration-200 btn-glow disabled:opacity-50"
          style={{ background: '#575efe', color: '#ffffff' }}
        >
          {isSubmitting ? 'Saving...' : 'Set password'}
        </button>
        <p className="text-center text-xs" style={{ color: '#8589b2' }}>
          <Link href="/forgot-password" style={{ color: '#00d7ff' }}>Request a new code</Link>
        </p>
      </form>
    </div>
  );
}
