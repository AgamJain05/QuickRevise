import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'

interface OnboardingProps {
  onComplete: () => void
}

const slides = [
  {
    title: 'Scroll and Learn',
    description: 'Turn your heavy notes into bite-sized cards you can master in seconds.',
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80',
    icon: 'bolt',
    badge: { icon: 'school', text: 'PHYSICS 101' },
    cardTitle: "Newton's Second Law of Motion",
  },
  {
    title: 'Learn Smarter and Faster',
    description: 'AI-powered active recall with ghost words and ELI5 mode to boost retention.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',
    icon: 'psychology',
    badge: { icon: 'biotech', text: 'BIOLOGY' },
    cardTitle: 'Cell Structure & Function',
  },
  {
    title: 'Track Progress',
    description: 'See your learning streaks, accuracy, and mastery grow over time.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80',
    icon: 'trending_up',
    badge: { icon: 'analytics', text: 'YOUR STATS' },
    cardTitle: '85% Mastery Rate',
  },
]

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const navigate = useNavigate()

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      // Navigate to auth page for login/register
      onComplete()
      navigate('/auth')
    }
  }

  const slide = slides[currentSlide]

  return (
    <div className="relative flex min-h-dvh w-full flex-col mx-auto max-w-md bg-background-light overflow-hidden">
      {/* Top safe area */}
      <div className="h-12 w-full" />

      {/* Main visual area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
        {/* Card stack visual */}
        <div className="relative w-full max-w-[320px] aspect-[3/4] flex flex-col justify-end items-center mb-8">
          {/* Background cards (stack effect) */}
          <div className="absolute inset-0 bg-white rounded-2xl shadow-soft card-stack-back border border-slate-100" />
          <div className="absolute inset-0 bg-white rounded-2xl shadow-soft card-stack-middle border border-slate-100" />
          
          {/* Main foreground card */}
          <div 
            className="relative w-full h-full bg-white rounded-2xl shadow-xl card-stack-front overflow-hidden border border-slate-100 flex flex-col animate-fade-in-up"
            key={currentSlide}
          >
            {/* Card image */}
            <div 
              className="h-full w-full bg-center bg-no-repeat bg-cover relative"
              style={{ backgroundImage: `url("${slide.image}")` }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              
              {/* Card content overlay */}
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-white text-lg">
                    {slide.badge.icon}
                  </span>
                  <span className="text-white text-xs font-bold uppercase tracking-wider">
                    {slide.badge.text}
                  </span>
                </div>
                <h3 className="text-white text-xl font-bold leading-tight">
                  {slide.cardTitle}
                </h3>
                <div className="mt-3 flex gap-2">
                  {slides.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        index === currentSlide
                          ? 'w-12 bg-primary'
                          : index < currentSlide
                          ? 'w-6 bg-white/60'
                          : 'w-6 bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating icon badge */}
          <div className="absolute -right-4 top-10 bg-primary text-white p-3 rounded-full shadow-glow z-30 animate-bounce-soft">
            <span className="material-symbols-outlined text-2xl">{slide.icon}</span>
          </div>
        </div>
      </div>

      {/* Bottom content */}
      <div className="flex flex-col items-center justify-end pb-8 pt-2 bg-background-light z-20 rounded-t-3xl">
        {/* Headline */}
        <div className="w-full px-8 text-center animate-fade-in" key={`text-${currentSlide}`}>
          <h1 className="text-slate-900 tracking-tight text-[32px] font-extrabold leading-tight mb-3">
            {slide.title}
          </h1>
          <p className="text-slate-500 text-base font-normal leading-relaxed">
            {slide.description}
          </p>
        </div>

        {/* Page indicators */}
        <div className="flex w-full flex-row items-center justify-center gap-2.5 py-8">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? 'w-6 bg-primary shadow-sm shadow-primary/30'
                  : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>

        {/* Primary button */}
        <div className="w-full px-6 pb-6">
          <Button
            onClick={handleNext}
            icon="arrow_forward"
            iconPosition="right"
            size="lg"
            className="w-full"
          >
            {currentSlide < slides.length - 1 ? 'Next' : 'Get Started'}
          </Button>
        </div>

        {/* Skip button */}
        {currentSlide < slides.length - 1 && (
          <button
            onClick={() => {navigate('/auth')
              onComplete()
            }}
            className="text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
          >
            Skip
          </button>
        )}

        {/* Safe area bottom */}
        <div className="h-2 w-full" />
      </div>
    </div>
  )
}
