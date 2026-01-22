/**
 * Membership Page
 * 
 * Displays membership plans and allows users to upgrade
 * to premium for unlimited card generation.
 */

import { useNavigate } from 'react-router-dom'
import { getUsageInfo } from '../lib/usageLimit'

export default function Membership() {
  const navigate = useNavigate()
  const usageInfo = getUsageInfo()

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        `${usageInfo.limit} card generations`,
        'Basic flashcard modes',
        'Local storage',
        'Study streak tracking',
      ],
      current: true,
      buttonText: 'Current Plan',
      buttonDisabled: true,
    },
    {
      name: 'Pro',
      price: '$9.99',
      period: '/month',
      features: [
        'Unlimited card generations',
        'All study modes (Quiz, ELI5, Speed)',
        'Cloud sync across devices',
        'Advanced analytics',
        'Priority AI processing',
        'Export to Anki/PDF',
      ],
      popular: true,
      buttonText: 'Upgrade to Pro',
      buttonDisabled: false,
    },
    {
      name: 'Lifetime',
      price: '$79',
      period: 'one-time',
      features: [
        'Everything in Pro',
        'Lifetime access',
        'Early access to new features',
        'Priority support',
      ],
      buttonText: 'Get Lifetime',
      buttonDisabled: false,
    },
  ]

  const handlePurchase = (planName: string) => {
    // TODO: Integrate with payment provider (Stripe, etc.)
    alert(`Payment integration coming soon! You selected the ${planName} plan.`)
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background-light/90 backdrop-blur-md border-b border-slate-200/50">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-600">arrow_back</span>
        </button>
        <h1 className="text-lg font-semibold text-slate-900">Membership</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Usage Status */}
      <div className="px-5 pt-6">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-600">bolt</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-amber-800 font-medium">Free Tier Usage</p>
              <p className="text-lg font-bold text-amber-900">
                {usageInfo.count} / {usageInfo.limit} generations used
              </p>
            </div>
          </div>
          {usageInfo.hasReachedLimit && (
            <p className="mt-3 text-sm text-amber-700">
              You've reached your free tier limit. Upgrade to continue generating cards!
            </p>
          )}
        </div>
      </div>

      {/* Plans */}
      <div className="px-5 pt-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Choose Your Plan</h2>
        
        <div className="space-y-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border-2 p-5 transition-all ${
                plan.popular
                  ? 'border-primary bg-primary/5 shadow-lg'
                  : plan.current
                  ? 'border-slate-200 bg-slate-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full">
                  MOST POPULAR
                </div>
              )}

              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-slate-500 text-sm">{plan.period}</span>
              </div>

              <h3 className="text-lg font-semibold text-slate-900 mb-3">{plan.name}</h3>

              <ul className="space-y-2 mb-5">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !plan.buttonDisabled && handlePurchase(plan.name)}
                disabled={plan.buttonDisabled}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  plan.buttonDisabled
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : plan.popular
                    ? 'bg-primary text-white hover:bg-primary-dark active:scale-[0.98]'
                    : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]'
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="px-5 pt-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
        
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">Why is there a limit?</h3>
            <p className="text-sm text-slate-600">
              We use advanced AI to generate high-quality flashcards, which requires expensive API calls. 
              The free tier helps us offer the service sustainably while you try it out.
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">Can I cancel anytime?</h3>
            <p className="text-sm text-slate-600">
              Yes! Pro subscriptions can be cancelled at any time. You'll keep access until the end of your billing period.
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">What payment methods are accepted?</h3>
            <p className="text-sm text-slate-600">
              We accept all major credit cards, debit cards, and digital wallets through our secure payment processor.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
