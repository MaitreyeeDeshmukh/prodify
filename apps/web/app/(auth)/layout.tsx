export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: '#030712' }}>
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden">
        {/* Aurora blobs */}
        <div
          className="absolute top-[-180px] left-[-180px] w-[600px] h-[600px] rounded-full animate-pulse"
          style={{ background: 'radial-gradient(circle, rgba(87,94,254,0.35) 0%, transparent 65%)', filter: 'blur(60px)' }}
        />
        <div
          className="absolute bottom-[-150px] right-[-100px] w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,215,255,0.25) 0%, transparent 65%)', filter: 'blur(60px)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(87,94,254,0.5) 0%, transparent 70%)', filter: 'blur(80px)' }}
        />

        {/* Subtle grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-md w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #575efe 0%, #00d7ff 100%)' }}
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <span
              className="text-xl font-black tracking-tight"
              style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
            >
              Prodify
            </span>
          </div>

          {/* Tagline */}
          <h2
            className="text-4xl font-black leading-tight mb-4"
            style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
          >
            One command.{' '}
            <span style={{ background: 'linear-gradient(90deg, #575efe, #00d7ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Production-ready
            </span>{' '}
            SaaS.
          </h2>
          <p className="text-base mb-10" style={{ color: '#8589b2' }}>
            Prodify analyzes your repo and injects auth, payments, and database infrastructure — automatically.
          </p>

          {/* Terminal window */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(27,30,61,0.7)', border: '1px solid #323779', backdropFilter: 'blur(20px)' }}
          >
            {/* Terminal title bar */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #323779' }}>
              <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
              <span className="ml-2 text-xs" style={{ color: '#8589b2', fontFamily: 'var(--font-geist-mono)' }}>
                terminal
              </span>
            </div>
            {/* Terminal body */}
            <div className="p-5 space-y-2" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              <div className="flex items-center gap-2">
                <span style={{ color: '#575efe' }}>$</span>
                <span className="text-sm" style={{ color: '#e3f4f8' }}>npx prodify analyze your-repo</span>
              </div>
              <div className="text-xs space-y-1 pl-4" style={{ color: '#8589b2' }}>
                <p><span style={{ color: '#00d7ff' }}>✓</span> Cloning repository...</p>
                <p><span style={{ color: '#00d7ff' }}>✓</span> Detecting stack: Next.js 14, TypeScript</p>
                <p><span style={{ color: '#00d7ff' }}>✓</span> Found 0 auth providers — injecting NextAuth</p>
                <p><span style={{ color: '#00d7ff' }}>✓</span> Found 0 payment layers — injecting Stripe</p>
                <p><span style={{ color: '#10b981' }}>✓</span> Analysis complete — 3 injection opportunities</p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span style={{ color: '#575efe' }}>$</span>
                <span className="text-sm" style={{ color: '#e3f4f8' }}>npx prodify inject</span>
                <span className="inline-block w-2 h-4 ml-0.5 animate-pulse" style={{ background: '#575efe' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div
        className="flex-1 lg:w-1/2 flex items-center justify-center p-6 lg:p-12"
        style={{ background: '#0a0b1a' }}
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8 lg:hidden">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #575efe 0%, #00d7ff 100%)' }}
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <span
              className="text-lg font-black"
              style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
            >
              Prodify
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
