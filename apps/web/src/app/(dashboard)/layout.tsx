import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { CommandPalette } from '@/components/layout/command-palette';
import { HelpSidebar } from '@/components/help/help-sidebar';
import { ContextualAiCopilot } from '@/components/help/contextual-ai-copilot';
import { ConceptLearningModal } from '@/components/help/concept-learning-modal';
import { OnboardingGuard } from '@/components/onboarding/onboarding-guard';
import { GuidedScanWizardManager } from '@/components/scans/guided-scan-wizard-manager';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-screen-2xl p-6">{children}</div>
        </main>
      </div>

      {/* Global overlays */}
      <CommandPalette />
      <HelpSidebar />
      <ContextualAiCopilot />
      <ConceptLearningModal />
      <OnboardingGuard />
      <GuidedScanWizardManager />
    </div>
  );
}
