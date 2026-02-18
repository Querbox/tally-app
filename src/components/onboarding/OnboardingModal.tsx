import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sun, Target, Moon, Sparkles, ChevronRight, Shield } from 'lucide-react';

interface OnboardingModalProps {
  onComplete: () => void;
}

/**
 * ZEITLOSES ONBOARDING
 * ====================
 *
 * Dieses Onboarding erklärt die Philosophie, nicht die Features.
 * Es sollte sich selten bis nie ändern müssen.
 *
 * Kernkonzept: "Ein Tag, ein Fokus"
 * - Morgen: Tag starten, Überblick gewinnen
 * - Tag: Fokussiert arbeiten
 * - Abend: Tag beenden, loslassen
 *
 * Tonalität:
 * - Ruhig, nicht aufgeregt
 * - Einladend, nicht belehrend
 * - Philosophisch, nicht technisch
 */

const PHILOSOPHY_STEPS = [
  {
    id: 'welcome',
    title: 'Willkommen bei Tally',
    subtitle: 'Dein Tag. Dein Fokus.',
    description:
      'Tally ist anders. Keine endlosen Listen, kein Chaos. Nur das, was heute zählt.',
    icon: Sparkles,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'morning',
    title: 'Morgens',
    subtitle: 'Den Tag beginnen',
    description:
      'Starte bewusst in den Tag. Schau, was ansteht. Entscheide, was heute wirklich wichtig ist.',
    icon: Sun,
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    id: 'focus',
    title: 'Tagsüber',
    subtitle: 'Fokussiert arbeiten',
    description:
      'Eine Aufgabe nach der anderen. Kein Multitasking. Wenn du ablenkst wirst, holt dich Tally zurück.',
    icon: Target,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'evening',
    title: 'Abends',
    subtitle: 'Den Tag beenden',
    description:
      'Schließe ab, was du geschafft hast. Verschiebe, was warten kann. Und dann: loslassen.',
    icon: Moon,
    gradient: 'from-indigo-500 to-purple-600',
  },
  {
    id: 'privacy',
    title: 'Deine Daten',
    subtitle: 'Bleiben bei dir',
    description:
      'Alles bleibt auf deinem Mac. Keine Cloud, kein Konto, kein Tracking. Nur du und deine Aufgaben.',
    icon: Shield,
    gradient: 'from-emerald-500 to-teal-600',
  },
];

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = PHILOSOPHY_STEPS[currentStep];
  const isLastStep = currentStep === PHILOSOPHY_STEPS.length - 1;
  const Icon = step.icon;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      style={{ zIndex: 99999 }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in mx-4">
        {/* Gradient Header */}
        <div className={`h-40 bg-gradient-to-br ${step.gradient} relative overflow-hidden`}>
          {/* Decorative elements */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
          <div className="absolute -bottom-20 -left-10 w-60 h-60 bg-white/5 rounded-full" />

          {/* Icon */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center translate-y-1/2">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center">
              <Icon className="w-8 h-8 text-gray-900" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-12 px-8 pb-8">
          {/* Text */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{step.title}</h2>
            <p className="text-sm text-gray-500 mb-4">{step.subtitle}</p>
            <p className="text-gray-600 leading-relaxed">{step.description}</p>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mb-6">
            {PHILOSOPHY_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-6 bg-gray-900'
                    : index < currentStep
                      ? 'w-1.5 bg-gray-400'
                      : 'w-1.5 bg-gray-200'
                }`}
                aria-label={`Schritt ${index + 1}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            {!isLastStep ? (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Überspringen
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all text-sm font-medium flex items-center gap-2 btn-press"
            >
              {isLastStep ? (
                <>
                  Los geht's
                  <Sparkles className="w-4 h-4" />
                </>
              ) : (
                <>
                  Weiter
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
