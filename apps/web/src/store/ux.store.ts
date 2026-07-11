import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ExperienceLevel = 'beginner' | 'professional';

interface OnboardingState {
  completed: boolean;
  step: number;
  selectedGoals: string[];
  organizationName: string;
  industryType: string;
  teamSize: string;
  recommendedScanType: string;
  securityMaturity: 'new' | 'learning' | 'experienced';
}

interface UxState {
  // Education mode
  experienceLevel: ExperienceLevel;
  setExperienceLevel: (level: ExperienceLevel) => void;
  isBeginnerMode: () => boolean;

  // Onboarding
  onboarding: OnboardingState;
  setOnboardingCompleted: (completed: boolean) => void;
  setOnboardingStep: (step: number) => void;
  updateOnboarding: (data: Partial<OnboardingState>) => void;

  // Help system
  helpOpen: boolean;
  helpContext: string | null;
  toggleHelp: () => void;
  openHelp: (context?: string) => void;
  closeHelp: () => void;

  // AI Copilot sidebar
  copilotOpen: boolean;
  copilotContext: { page: string; entityId?: string; entityType?: string } | null;
  openCopilot: (context?: UxState['copilotContext']) => void;
  closeCopilot: () => void;

  // Active learning modal
  learningModalOpen: boolean;
  learningConcept: string | null;
  openLearning: (concept: string) => void;
  closeLearning: () => void;

  // Dismissed hints
  dismissedHints: string[];
  dismissHint: (hintId: string) => void;
  isHintDismissed: (hintId: string) => boolean;

  // Scan wizard
  scanWizardOpen: boolean;
  openScanWizard: () => void;
  closeScanWizard: () => void;
}

export const useUxStore = create<UxState>()(
  persist(
    (set, get) => ({
      // ─── Education Mode ──────────────────────────────────────
      experienceLevel: 'beginner',
      setExperienceLevel: (level) => set({ experienceLevel: level }),
      isBeginnerMode: () => get().experienceLevel === 'beginner',

      // ─── Onboarding ──────────────────────────────────────────
      onboarding: {
        completed: false,
        step: 0,
        selectedGoals: [],
        organizationName: '',
        industryType: '',
        teamSize: '',
        recommendedScanType: '',
        securityMaturity: 'new',
      },
      setOnboardingCompleted: (completed) =>
        set((s) => ({ onboarding: { ...s.onboarding, completed } })),
      setOnboardingStep: (step) =>
        set((s) => ({ onboarding: { ...s.onboarding, step } })),
      updateOnboarding: (data) =>
        set((s) => ({ onboarding: { ...s.onboarding, ...data } })),

      // ─── Help System ─────────────────────────────────────────
      helpOpen: false,
      helpContext: null,
      toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
      openHelp: (context) => set({ helpOpen: true, helpContext: context ?? null }),
      closeHelp: () => set({ helpOpen: false, helpContext: null }),

      // ─── AI Copilot Sidebar ───────────────────────────────────
      copilotOpen: false,
      copilotContext: null,
      openCopilot: (context) => set({ copilotOpen: true, copilotContext: context ?? null }),
      closeCopilot: () => set({ copilotOpen: false, copilotContext: null }),

      // ─── Learning Modals ─────────────────────────────────────
      learningModalOpen: false,
      learningConcept: null,
      openLearning: (concept) => set({ learningModalOpen: true, learningConcept: concept }),
      closeLearning: () => set({ learningModalOpen: false, learningConcept: null }),

      // ─── Dismissed Hints ─────────────────────────────────────
      dismissedHints: [],
      dismissHint: (hintId) =>
        set((s) => ({ dismissedHints: [...s.dismissedHints, hintId] })),
      isHintDismissed: (hintId) => get().dismissedHints.includes(hintId),

      // ─── Scan Wizard ─────────────────────────────────────────
      scanWizardOpen: false,
      openScanWizard: () => set({ scanWizardOpen: true }),
      closeScanWizard: () => set({ scanWizardOpen: false }),
    }),
    {
      name: 'sentinelx-ux',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        experienceLevel: state.experienceLevel,
        onboarding: state.onboarding,
        dismissedHints: state.dismissedHints,
      }),
    },
  ),
);
