'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validations';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordInput) {
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="glass-card rounded-3xl p-8 text-center">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#e3f4f8' }}>Check your email</h2>
        <p className="text-sm mb-6" style={{ color: '#8589b2' }}>
          If an account exists for that email, we sent a reset link. It expires in 1 hour.
        </p>
        <Link href="/login" className="text-sm font-medium" style={{ color: '#00d7ff' }}>Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl p-8">
      <h2 className="text-xl font-bold mb-1" style={{ color: '#e3f4f8' }}>Forgot password</h2>
      <p className="text-sm mb-6" style={{ color: '#8589b2' }}>Enter your email and we will send a reset link</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>Email</label>
          <input
            type="email"
            {...register('email')}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{ background: '#1b1e3d', border: '1px solid #323779', color: '#e3f4f8' }}
            onFocus={e => (e.target.style.borderColor = '#575efe')}
            onBlur={e => (e.target.style.borderColor = '#323779')}
            placeholder="you@example.com"
          />
          {errors.email && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{errors.email.message}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-6 rounded-full font-semibold text-sm transition-all duration-200 btn-glow disabled:opacity-50"
          style={{ background: '#575efe', color: '#ffffff' }}
        >
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-sm mt-6">
        <Link href="/login" className="font-medium" style={{ color: '#00d7ff' }}>Back to sign in</Link>
      </p>
    </div>
  );
}
