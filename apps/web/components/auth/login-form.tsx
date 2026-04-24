'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginSchema, type LoginInput } from '@/lib/validations';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setError('');
    const result = await signIn('credentials', { email: data.email, password: data.password, redirect: false });
    if (result?.error) { setError('Invalid email or password'); return; }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div
      className="rounded-3xl p-8"
      style={{
        background: 'rgba(27,30,61,0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid #323779',
      }}
    >
      <h2
        className="text-2xl font-black mb-1"
        style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
      >
        Welcome back
      </h2>
      <p className="text-sm mb-7" style={{ color: '#8589b2' }}>Sign in to your account</p>

      {/* GitHub button */}
      <button
        type="button"
        onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
        className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-full border text-sm font-medium transition-all duration-200 mb-5 group"
        style={{ borderColor: '#323779', color: '#e3f4f8', background: 'rgba(255,255,255,0.03)' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#575efe';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.2)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        Continue with GitHub
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px" style={{ background: '#323779' }} />
        <span className="text-xs font-medium" style={{ color: '#8589b2' }}>OR</span>
        <div className="flex-1 h-px" style={{ background: '#323779' }} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>Email</label>
          <input
            type="email"
            {...register('email')}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{ background: '#030712', border: '1px solid #323779', color: '#e3f4f8' }}
            onFocus={e => (e.target.style.borderColor = '#575efe')}
            onBlur={e => (e.target.style.borderColor = '#323779')}
            placeholder="you@example.com"
          />
          {errors.email && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-medium" style={{ color: '#8589b2' }}>Password</label>
            <Link
              href="/forgot-password"
              className="text-xs transition-colors"
              style={{ color: '#00d7ff' }}
            >
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            {...register('password')}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{ background: '#030712', border: '1px solid #323779', color: '#e3f4f8' }}
            onFocus={e => (e.target.style.borderColor = '#575efe')}
            onBlur={e => (e.target.style.borderColor = '#323779')}
            placeholder="••••••••"
          />
          {errors.password && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{errors.password.message}</p>}
        </div>

        {error && <p className="text-sm" style={{ color: '#ff6b6b' }}>{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-6 rounded-full font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#575efe', color: '#ffffff', boxShadow: '0 0 20px rgba(87,94,254,0.4)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(87,94,254,0.6)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.4)'; }}
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: '#8589b2' }}>
        No account?{' '}
        <Link href="/signup" className="font-medium transition-colors" style={{ color: '#00d7ff' }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
