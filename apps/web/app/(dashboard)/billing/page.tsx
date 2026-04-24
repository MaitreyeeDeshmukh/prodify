'use client';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for side projects and personal use',
    features: [
      '3 Projects',
      '1 Team Member',
      'Basic Analytics',
      'Community Support',
    ],
    current: true,
    cta: 'Current Plan',
    accent: 'border-violet-500',
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'Everything you need to scale your SaaS',
    features: [
      'Unlimited Projects',
      'Up to 10 Team Members',
      'Advanced Analytics',
      'Priority Support',
      'Custom Domain',
      'API Access',
    ],
    current: false,
    cta: 'Upgrade to Pro',
    accent: 'border-gray-200',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large teams and organizations',
    features: [
      'Unlimited Everything',
      'Unlimited Team Members',
      'Custom Integrations',
      'Dedicated Support',
      'SLA Guarantee',
      'SSO / SAML',
    ],
    current: false,
    cta: 'Contact Sales',
    accent: 'border-gray-200',
  },
];

export default function BillingPage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1
          className="text-2xl font-black"
          style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
        >
          Billing &amp; Plans
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8589b2' }}>Manage your subscription and payment details</p>
      </div>

      {/* Current plan banner */}
      <div
        className="rounded-2xl p-6 mb-8 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, rgba(87,94,254,0.3) 0%, rgba(139,92,246,0.3) 100%)', border: '1px solid rgba(87,94,254,0.4)', backdropFilter: 'blur(20px)' }}
      >
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: 'rgba(227,244,248,0.7)' }}>Current Plan</p>
          <p
            className="text-2xl font-black"
            style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
          >
            Free
          </p>
          <p className="text-sm mt-1" style={{ color: 'rgba(227,244,248,0.6)' }}>Renews automatically · No payment method on file</p>
        </div>
        <div className="text-right">
          <span
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#e3f4f8' }}
          >
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#10b981' }} />
            Active
          </span>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className="rounded-2xl p-6 flex flex-col"
            style={{
              background: 'rgba(27,30,61,0.5)',
              backdropFilter: 'blur(20px)',
              border: plan.highlight ? '2px solid #575efe' : '1px solid #1a1b2e',
              boxShadow: plan.highlight ? '0 0 32px rgba(87,94,254,0.2)' : 'none',
            }}
          >
            {plan.highlight && (
              <span
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full w-fit mb-3"
                style={{ background: 'rgba(87,94,254,0.2)', color: '#575efe', border: '1px solid rgba(87,94,254,0.3)' }}
              >
                Most Popular
              </span>
            )}
            <h3
              className="font-black text-lg"
              style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
            >
              {plan.name}
            </h3>
            <p className="text-xs mt-1 mb-4" style={{ color: '#8589b2' }}>{plan.description}</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span
                className="text-3xl font-black"
                style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
              >
                {plan.price}
              </span>
              <span className="text-sm" style={{ color: '#8589b2' }}>{plan.period}</span>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm" style={{ color: '#e3f4f8' }}>
                  <svg className="w-4 h-4 shrink-0" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled={plan.current}
              className="w-full py-2.5 rounded-full text-sm font-semibold transition-all disabled:cursor-not-allowed"
              style={
                plan.current
                  ? { background: 'rgba(133,137,178,0.1)', color: '#8589b2', border: '1px solid #323779' }
                  : plan.highlight
                  ? { background: '#575efe', color: '#ffffff', boxShadow: '0 0 20px rgba(87,94,254,0.4)' }
                  : { border: '1px solid #323779', color: '#e3f4f8', background: 'transparent' }
              }
              onMouseEnter={e => {
                if (!plan.current && plan.highlight) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(87,94,254,0.6)';
                if (!plan.current && !plan.highlight) (e.currentTarget as HTMLButtonElement).style.borderColor = '#575efe';
              }}
              onMouseLeave={e => {
                if (!plan.current && plan.highlight) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.4)';
                if (!plan.current && !plan.highlight) (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779';
              }}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Payment info placeholder */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e' }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: '#e3f4f8' }}>Payment Method</h2>
        <div
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{ border: '2px dashed #323779', background: 'transparent' }}
        >
          <svg className="w-8 h-8" style={{ color: '#8589b2' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <div>
            <p className="text-sm" style={{ color: '#8589b2' }}>No payment method added</p>
            <p className="text-xs" style={{ color: '#8589b2' }}>Add a card to upgrade your plan</p>
          </div>
          <button
            className="ml-auto text-xs font-medium px-3 py-1.5 rounded-full transition-all"
            style={{ border: '1px solid #323779', color: '#00d7ff', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#00d7ff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779'; }}
          >
            Add payment method
          </button>
        </div>
      </div>
    </div>
  );
}
