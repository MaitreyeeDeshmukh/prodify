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
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your subscription and payment details</p>
      </div>

      {/* Current plan banner */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 mb-8 text-white flex items-center justify-between">
        <div>
          <p className="text-violet-200 text-sm font-medium mb-1">Current Plan</p>
          <p className="text-2xl font-bold">Free</p>
          <p className="text-violet-200 text-sm mt-1">Renews automatically · No payment method on file</p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-sm font-medium px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-emerald-400 rounded-full inline-block" />
            Active
          </span>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className={`bg-white rounded-xl border-2 p-6 flex flex-col ${plan.accent} ${plan.highlight ? 'shadow-md' : ''}`}
          >
            {plan.highlight && (
              <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-full w-fit mb-3">
                Most Popular
              </span>
            )}
            <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
            <p className="text-gray-500 text-xs mt-1 mb-4">{plan.description}</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
              <span className="text-gray-500 text-sm">{plan.period}</span>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled={plan.current}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                plan.current
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : plan.highlight
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'border border-gray-300 hover:border-violet-500 hover:text-violet-600 text-gray-700'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Payment info placeholder */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Payment Method</h2>
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <div>
            <p className="text-sm text-gray-500">No payment method added</p>
            <p className="text-xs text-gray-400">Add a card to upgrade your plan</p>
          </div>
          <button className="ml-auto text-xs font-medium text-violet-600 hover:text-violet-700 border border-violet-200 hover:border-violet-400 px-3 py-1.5 rounded-lg transition-colors">
            Add payment method
          </button>
        </div>
      </div>
    </div>
  );
}
