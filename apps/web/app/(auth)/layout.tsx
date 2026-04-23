export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#1b1e3d' }}>
      {/* Background glow blobs */}
      <div className="absolute top-[-120px] left-[-120px] w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #575efe 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #00d7ff 0%, transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}>
            Prodify
          </h1>
          <p className="text-sm mt-2" style={{ color: '#8589b2' }}>
            Production-ready SaaS in one command
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
