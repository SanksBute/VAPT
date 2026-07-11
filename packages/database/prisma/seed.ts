import { PrismaClient, OrgTier, UserRole, OrgStatus, UserStatus, SubscriptionStatus, BillingInterval, AIProvider } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');

  // ─── System Settings ───────────────────────────────────────────
  console.log('  Creating system settings...');
  const systemSettings = [
    { key: 'platform.name', value: 'SentinelX AI', description: 'Platform display name', isPublic: true },
    { key: 'platform.version', value: '1.0.0', description: 'Platform version', isPublic: true },
    { key: 'platform.maintenance', value: false, description: 'Maintenance mode', isPublic: true },
    { key: 'auth.mfa_required_for_roles', value: ['SUPER_ADMIN', 'PLATFORM_ADMIN'], description: 'Roles requiring MFA', isPublic: false },
    { key: 'auth.session_duration_hours', value: 24, description: 'Session duration in hours', isPublic: false },
    { key: 'auth.refresh_token_days', value: 30, description: 'Refresh token duration in days', isPublic: false },
    { key: 'auth.max_failed_attempts', value: 5, description: 'Max failed login attempts before lock', isPublic: false },
    { key: 'auth.lock_duration_minutes', value: 30, description: 'Account lock duration', isPublic: false },
    { key: 'scanner.max_concurrent_scans', value: 10, description: 'Max concurrent scans per org', isPublic: false },
    { key: 'scanner.default_timeout_hours', value: 24, description: 'Default scan timeout', isPublic: false },
    { key: 'reporting.retention_days', value: 365, description: 'Report retention days', isPublic: false },
    { key: 'ai.default_provider', value: 'OPENAI', description: 'Default AI provider', isPublic: false },
    { key: 'ai.default_model', value: 'gpt-4o', description: 'Default AI model', isPublic: false },
    { key: 'billing.trial_days', value: 14, description: 'Trial period days', isPublic: true },
    { key: 'notifications.email_enabled', value: true, description: 'Email notifications enabled', isPublic: false },
    { key: 'notifications.slack_enabled', value: true, description: 'Slack notifications enabled', isPublic: false },
  ];

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        isPublic: setting.isPublic,
      },
    });
  }

  // ─── Subscription Plans ────────────────────────────────────────
  console.log('  Creating subscription plans...');
  const plans = [
    {
      name: 'free',
      displayName: 'Free',
      description: 'Perfect for individuals and small teams getting started',
      tier: OrgTier.FREE,
      monthlyPrice: 0,
      annualPrice: 0,
      trialDays: 0,
      features: {
        assetDiscovery: true,
        vulnerabilityScanning: true,
        webApplicationScanning: false,
        apiSecurity: false,
        cloudSecurity: false,
        containerSecurity: false,
        aiCopilot: false,
        complianceManagement: false,
        reporting: 'basic',
        customIntegrations: false,
        ssoEnabled: false,
        apiAccess: false,
        whiteLabel: false,
        prioritySupport: false,
      },
      limits: {
        users: 3,
        assets: 25,
        scansPerMonth: 5,
        apiCallsPerDay: 100,
        reportStorage: '1GB',
        dataRetentionDays: 90,
        concurrentScans: 1,
        webhooks: 0,
        integrations: 0,
      },
      sortOrder: 0,
    },
    {
      name: 'starter',
      displayName: 'Starter',
      description: 'For growing security teams with essential capabilities',
      tier: OrgTier.STARTER,
      monthlyPrice: 29900,
      annualPrice: 287040,
      trialDays: 14,
      features: {
        assetDiscovery: true,
        vulnerabilityScanning: true,
        webApplicationScanning: true,
        apiSecurity: true,
        cloudSecurity: false,
        containerSecurity: false,
        aiCopilot: true,
        complianceManagement: false,
        reporting: 'standard',
        customIntegrations: true,
        ssoEnabled: false,
        apiAccess: true,
        whiteLabel: false,
        prioritySupport: false,
      },
      limits: {
        users: 10,
        assets: 250,
        scansPerMonth: 50,
        apiCallsPerDay: 5000,
        reportStorage: '25GB',
        dataRetentionDays: 180,
        concurrentScans: 3,
        webhooks: 5,
        integrations: 5,
      },
      sortOrder: 1,
    },
    {
      name: 'professional',
      displayName: 'Professional',
      description: 'Complete security platform for professional security teams',
      tier: OrgTier.PROFESSIONAL,
      monthlyPrice: 99900,
      annualPrice: 959040,
      trialDays: 14,
      features: {
        assetDiscovery: true,
        vulnerabilityScanning: true,
        webApplicationScanning: true,
        apiSecurity: true,
        cloudSecurity: true,
        containerSecurity: true,
        aiCopilot: true,
        complianceManagement: true,
        reporting: 'advanced',
        customIntegrations: true,
        ssoEnabled: true,
        apiAccess: true,
        whiteLabel: false,
        prioritySupport: true,
      },
      limits: {
        users: 50,
        assets: 2500,
        scansPerMonth: 500,
        apiCallsPerDay: 50000,
        reportStorage: '250GB',
        dataRetentionDays: 365,
        concurrentScans: 10,
        webhooks: 25,
        integrations: 25,
      },
      sortOrder: 2,
    },
    {
      name: 'enterprise',
      displayName: 'Enterprise',
      description: 'Unlimited scale for enterprise organizations',
      tier: OrgTier.ENTERPRISE,
      monthlyPrice: 299900,
      annualPrice: 2879040,
      trialDays: 30,
      features: {
        assetDiscovery: true,
        vulnerabilityScanning: true,
        webApplicationScanning: true,
        apiSecurity: true,
        cloudSecurity: true,
        containerSecurity: true,
        kubernetesSecuirty: true,
        adSecurity: true,
        sourceCodeSecurity: true,
        secretDetection: true,
        aiCopilot: true,
        complianceManagement: true,
        reporting: 'enterprise',
        customIntegrations: true,
        ssoEnabled: true,
        apiAccess: true,
        whiteLabel: true,
        prioritySupport: true,
        dedicatedCsm: true,
        customContracts: true,
      },
      limits: {
        users: -1,
        assets: -1,
        scansPerMonth: -1,
        apiCallsPerDay: -1,
        reportStorage: 'unlimited',
        dataRetentionDays: 2555,
        concurrentScans: 100,
        webhooks: -1,
        integrations: -1,
      },
      sortOrder: 3,
    },
    {
      name: 'government',
      displayName: 'Government',
      description: 'FedRAMP-compliant platform for government agencies',
      tier: OrgTier.GOVERNMENT,
      monthlyPrice: 499900,
      annualPrice: 4799040,
      trialDays: 0,
      features: {
        everything: true,
        fedrampCompliant: true,
        fipsEncryption: true,
        govCloudDeployment: true,
        dedicatedInfrastructure: true,
        securityClearanceSupport: true,
      },
      limits: {
        users: -1,
        assets: -1,
        scansPerMonth: -1,
        apiCallsPerDay: -1,
        reportStorage: 'unlimited',
        dataRetentionDays: 3650,
        concurrentScans: 250,
        webhooks: -1,
        integrations: -1,
      },
      isPublic: false,
      sortOrder: 4,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        features: plan.features,
        limits: plan.limits,
        sortOrder: plan.sortOrder,
        trialDays: plan.trialDays,
      },
      create: {
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description ?? '',
        tier: plan.tier,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        currency: 'USD',
        features: plan.features,
        limits: plan.limits,
        isActive: true,
        isPublic: plan.isPublic ?? true,
        sortOrder: plan.sortOrder,
        trialDays: plan.trialDays,
      },
    });
  }

  // ─── AI Model Configs ──────────────────────────────────────────
  console.log('  Creating AI model configs...');
  const aiModels = [
    { provider: AIProvider.OPENAI, modelId: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, inputCostPer1k: 0.005, outputCostPer1k: 0.015, maxTokens: 16384, supportsVision: true, supportsFunctions: true, isDefault: true, capabilities: ['reasoning', 'code', 'security', 'analysis'] },
    { provider: AIProvider.OPENAI, modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, maxTokens: 16384, supportsVision: true, supportsFunctions: true, capabilities: ['fast', 'cost-effective'] },
    { provider: AIProvider.OPENAI, modelId: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', contextWindow: 128000, inputCostPer1k: 0.01, outputCostPer1k: 0.03, maxTokens: 4096, supportsVision: true, supportsFunctions: true, capabilities: ['reasoning', 'code', 'security'] },
    { provider: AIProvider.ANTHROPIC, modelId: 'claude-opus-4-5', displayName: 'Claude Opus 4.5', contextWindow: 200000, inputCostPer1k: 0.015, outputCostPer1k: 0.075, maxTokens: 8192, supportsVision: true, supportsFunctions: true, capabilities: ['reasoning', 'security', 'analysis', 'long-context'] },
    { provider: AIProvider.ANTHROPIC, modelId: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', contextWindow: 200000, inputCostPer1k: 0.003, outputCostPer1k: 0.015, maxTokens: 8192, supportsVision: true, supportsFunctions: true, capabilities: ['balanced', 'security', 'code'] },
    { provider: AIProvider.ANTHROPIC, modelId: 'claude-haiku-3-5', displayName: 'Claude Haiku 3.5', contextWindow: 200000, inputCostPer1k: 0.00025, outputCostPer1k: 0.00125, maxTokens: 4096, supportsVision: true, supportsFunctions: true, capabilities: ['fast', 'cost-effective'] },
    { provider: AIProvider.OLLAMA, modelId: 'llama3.2', displayName: 'Llama 3.2', contextWindow: 131072, inputCostPer1k: 0, outputCostPer1k: 0, maxTokens: 4096, supportsVision: false, supportsFunctions: false, capabilities: ['open-source', 'local', 'private'] },
    { provider: AIProvider.OLLAMA, modelId: 'mistral', displayName: 'Mistral 7B', contextWindow: 32768, inputCostPer1k: 0, outputCostPer1k: 0, maxTokens: 4096, supportsVision: false, supportsFunctions: false, capabilities: ['open-source', 'local', 'fast'] },
  ];

  for (const model of aiModels) {
    await prisma.aIModelConfig.upsert({
      where: { provider_modelId: { provider: model.provider, modelId: model.modelId } },
      update: { displayName: model.displayName, isActive: true },
      create: model,
    });
  }

  // ─── AI Prompt Templates ───────────────────────────────────────
  console.log('  Creating AI prompt templates...');
  const promptTemplates = [
    {
      name: 'vulnerability_analysis',
      description: 'Analyze a vulnerability and provide detailed security assessment',
      category: 'vulnerability',
      version: '1.0.0',
      template: `You are an expert cybersecurity analyst specializing in vulnerability assessment and penetration testing.

Analyze the following vulnerability and provide a comprehensive security assessment:

**Vulnerability Details:**
- Title: {{title}}
- CVE: {{cveIds}}
- CVSS Score: {{cvssScore}} ({{cvssVector}})
- Category: {{category}}
- Affected Component: {{affectedComponent}}
- Description: {{description}}

**Asset Context:**
- Asset Type: {{assetType}}
- Environment: {{environment}}
- Business Criticality: {{criticality}}

Please provide:
1. **Technical Analysis**: Detailed explanation of the vulnerability mechanism
2. **Business Impact**: Potential impact on business operations and data
3. **Exploitation Likelihood**: Assessment of real-world exploitability
4. **Attack Scenarios**: Step-by-step attack scenarios an adversary might use
5. **Immediate Actions**: Emergency mitigation steps (< 24 hours)
6. **Long-term Remediation**: Permanent fix recommendations
7. **Verification Steps**: How to verify the vulnerability is remediated
8. **Related Vulnerabilities**: Similar vulnerabilities to check for
9. **MITRE ATT&CK Mapping**: Relevant tactics and techniques
10. **Compliance Impact**: Affected compliance frameworks and controls

Format your response as structured JSON.`,
      isSystem: true,
    },
    {
      name: 'scan_summary',
      description: 'Generate an executive summary of scan results',
      category: 'reporting',
      version: '1.0.0',
      template: `You are a senior cybersecurity consultant preparing an executive briefing.

Analyze the following security scan results and prepare an executive summary:

**Scan Information:**
- Scan Type: {{scanType}}
- Target: {{target}}
- Duration: {{duration}}
- Date: {{date}}

**Findings Overview:**
- Critical: {{criticalCount}}
- High: {{highCount}}
- Medium: {{mediumCount}}
- Low: {{lowCount}}
- Informational: {{infoCount}}

**Top Vulnerabilities:**
{{topVulnerabilities}}

**Asset Summary:**
{{assetSummary}}

Generate:
1. **Executive Summary** (2-3 paragraphs, business-focused, no technical jargon)
2. **Risk Posture** (current security risk level with justification)
3. **Key Findings** (top 5 critical issues with business impact)
4. **Immediate Priorities** (what must be fixed in next 7 days)
5. **30-Day Remediation Roadmap** (prioritized action plan)
6. **Security Metrics** (KPIs and trend analysis if historical data available)
7. **Executive Recommendations** (3-5 strategic recommendations)

Return as structured JSON with both executive-friendly language and technical details.`,
      isSystem: true,
    },
    {
      name: 'penetration_test_report',
      description: 'Generate a comprehensive penetration test report',
      category: 'reporting',
      version: '1.0.0',
      template: `You are a certified penetration tester (OSCP, CEH) writing a professional penetration testing report.

Based on the following findings, generate a comprehensive penetration testing report:

**Engagement Details:**
- Target Organization: {{organizationName}}
- Scope: {{scope}}
- Test Type: {{testType}}
- Duration: {{duration}}
- Tester: {{testerName}}

**Findings:**
{{findings}}

Generate a professional report with:
1. Executive Summary
2. Scope and Objectives
3. Methodology (based on OWASP/PTES/NIST)
4. Attack Narrative (timeline of the test)
5. Detailed Findings (each with: description, risk rating, CVSS, PoC steps, evidence, remediation)
6. Risk Summary and Heat Map
7. Recommendations (prioritized)
8. Appendices (tools used, raw output summaries)

Use professional pentesting report language. Include risk ratings aligned with CVSS 3.1.`,
      isSystem: true,
    },
    {
      name: 'remediation_plan',
      description: 'Generate detailed remediation guidance for vulnerabilities',
      category: 'remediation',
      version: '1.0.0',
      template: `You are a senior security engineer providing remediation guidance.

Generate a detailed remediation plan for the following vulnerabilities:

**Organization Context:**
- Industry: {{industry}}
- Technology Stack: {{techStack}}
- Team Size: {{teamSize}}
- Timeline Constraint: {{timeline}}

**Vulnerabilities to Remediate:**
{{vulnerabilities}}

Provide:
1. **Prioritization Matrix** (CVSS + business impact + ease of fix)
2. **Quick Wins** (vulnerabilities fixable in < 1 hour)
3. **Sprint Plan** (2-week remediation sprints)
4. **Technical Remediation Steps** (code examples, config changes, commands)
5. **Testing Verification** (how to confirm each fix)
6. **Regression Prevention** (how to prevent recurrence)
7. **Resource Estimation** (hours/effort per vulnerability)
8. **Dependencies** (order of operations for fixes)

Include specific code examples in the relevant programming languages.`,
      isSystem: true,
    },
    {
      name: 'threat_intelligence_briefing',
      description: 'Generate a threat intelligence briefing',
      category: 'threat_intelligence',
      version: '1.0.0',
      template: `You are a threat intelligence analyst providing a security briefing.

Analyze the following threat intelligence data and asset profile to generate a targeted threat briefing:

**Organization Profile:**
- Industry: {{industry}}
- Technology Stack: {{techStack}}
- Geographic Presence: {{geography}}
- Asset Criticality Profile: {{assetProfile}}

**Threat Intelligence Data:**
{{threatData}}

**Recent Vulnerabilities:**
{{recentVulnerabilities}}

Generate:
1. **Threat Landscape** (current threat actors targeting this industry)
2. **Relevant CVEs** (recently weaponized vulnerabilities)
3. **Indicators of Compromise** (IOCs to monitor)
4. **Attack Vectors** (most likely attack paths)
5. **Defensive Recommendations** (specific to threat landscape)
6. **Monitoring Recommendations** (what to log and alert on)
7. **Intelligence Sources** (recommended threat intel feeds)
8. **Risk Forecast** (30/60/90 day threat assessment)`,
      isSystem: true,
    },
    {
      name: 'compliance_gap_analysis',
      description: 'Analyze compliance gaps and provide remediation guidance',
      category: 'compliance',
      version: '1.0.0',
      template: `You are a compliance expert specializing in cybersecurity frameworks.

Analyze the following compliance assessment results and provide gap analysis:

**Framework:** {{framework}}
**Organization:** {{organizationName}}
**Assessment Date:** {{assessmentDate}}

**Control Results:**
{{controlResults}}

**Current Vulnerabilities:**
{{vulnerabilities}}

**Existing Security Controls:**
{{existingControls}}

Generate:
1. **Compliance Posture** (overall score and maturity level)
2. **Critical Gaps** (non-compliant controls with highest risk)
3. **Gap Analysis** (detailed per-control analysis)
4. **Remediation Roadmap** (prioritized path to compliance)
5. **Evidence Requirements** (what evidence to collect for each control)
6. **Effort Estimation** (time and resources for compliance)
7. **Quick Wins** (controls achievable in < 30 days)
8. **Risk Acceptance** (recommendations for acceptable risk exceptions)
9. **Audit Preparation** (checklist for next audit)`,
      isSystem: true,
    },
  ];

  for (const template of promptTemplates) {
    await prisma.aIPromptTemplate.upsert({
      where: { name: template.name },
      update: { template: template.template, version: template.version },
      create: template,
    });
  }

  // ─── Report Templates ──────────────────────────────────────────
  console.log('  Creating report templates...');

  // ─── Feature Flags ─────────────────────────────────────────────
  console.log('  Creating feature flags...');
  const featureFlags = [
    { key: 'ai_copilot', name: 'AI Security Copilot', description: 'Enable AI-powered security assistant', isEnabled: true, rolloutPercent: 100 },
    { key: 'advanced_threat_intel', name: 'Advanced Threat Intelligence', description: 'Enhanced threat intelligence feeds', isEnabled: true, rolloutPercent: 100 },
    { key: 'kubernetes_security', name: 'Kubernetes Security Module', description: 'Kubernetes cluster security assessment', isEnabled: true, rolloutPercent: 100 },
    { key: 'ad_security', name: 'Active Directory Security', description: 'AD/LDAP security assessment module', isEnabled: true, rolloutPercent: 100 },
    { key: 'cloud_security', name: 'Cloud Security Module', description: 'Multi-cloud security assessment', isEnabled: true, rolloutPercent: 100 },
    { key: 'mobile_security', name: 'Mobile Application Security', description: 'iOS/Android app security testing', isEnabled: false, rolloutPercent: 0 },
    { key: 'marketplace', name: 'Plugin Marketplace', description: 'Community plugin marketplace', isEnabled: true, rolloutPercent: 100 },
    { key: 'white_label', name: 'White Label', description: 'White label customization for MSPs', isEnabled: true, rolloutPercent: 100 },
    { key: 'ai_pentest_orchestration', name: 'AI Pentest Orchestration', description: 'AI-driven penetration test automation', isEnabled: true, rolloutPercent: 50 },
    { key: 'real_time_scanning', name: 'Real-time Scanning', description: 'Continuous real-time security monitoring', isEnabled: true, rolloutPercent: 100 },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { isEnabled: flag.isEnabled, rolloutPercent: flag.rolloutPercent },
      create: flag,
    });
  }

  // ─── Super Admin User ──────────────────────────────────────────
  console.log('  Creating super admin user...');
  const superAdminEmail = process.env['SUPER_ADMIN_EMAIL'] ?? 'admin@sentinelx.io';
  const superAdminPassword = process.env['SUPER_ADMIN_PASSWORD'] ?? 'SentinelX@Admin2024!';
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      passwordHash,
      firstName: 'Platform',
      lastName: 'Administrator',
      displayName: 'Platform Admin',
      status: UserStatus.ACTIVE,
      isSuperAdmin: true,
      theme: 'dark',
      locale: 'en',
      timezone: 'UTC',
    },
  });

  // ─── Demo Organization ─────────────────────────────────────────
  console.log('  Creating demo organization...');
  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'demo-corp' },
    update: {},
    create: {
      slug: 'demo-corp',
      name: 'Demo Corporation',
      displayName: 'Demo Corp',
      status: OrgStatus.ACTIVE,
      tier: OrgTier.ENTERPRISE,
      maxUsers: -1,
      maxAssets: -1,
      maxScansPerMonth: -1,
      timezone: 'UTC',
      billingEmail: 'billing@democorp.example',
      technicalEmail: 'security@democorp.example',
      enabledFeatures: ['ai_copilot', 'cloud_security', 'kubernetes_security', 'marketplace'],
    },
  });

  // Attach super admin to demo org
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: demoOrg.id, userId: superAdmin.id } },
    update: {},
    create: {
      organizationId: demoOrg.id,
      userId: superAdmin.id,
      role: UserRole.ORG_OWNER,
      isOwner: true,
    },
  });

  // Enterprise plan subscription for demo org
  const enterprisePlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'enterprise' } });
  if (enterprisePlan) {
    await prisma.subscription.upsert({
      where: { organizationId: demoOrg.id },
      update: {},
      create: {
        organizationId: demoOrg.id,
        planId: enterprisePlan.id,
        status: SubscriptionStatus.ACTIVE,
        billingInterval: BillingInterval.ANNUALLY,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        quantity: 1,
        unitAmount: enterprisePlan.annualPrice,
        currency: 'USD',
      },
    });
  }

  // Demo project
  await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      organizationId: demoOrg.id,
      name: 'Default Project',
      description: 'Default project for demo organization',
      isDefault: true,
      color: '#6366f1',
    },
  });

  // Demo compliance profiles
  const frameworks = ['SOC2_TYPE2', 'PCI_DSS_V4', 'ISO27001', 'NIST_CSF', 'OWASP_TOP10'] as const;
  for (const framework of frameworks) {
    await prisma.complianceProfile.upsert({
      where: { organizationId_framework: { organizationId: demoOrg.id, framework } },
      update: {},
      create: {
        organizationId: demoOrg.id,
        framework,
        name: `${framework.replace(/_/g, ' ')} Compliance`,
        description: `Compliance profile for ${framework}`,
        isActive: true,
        scope: { includeAllAssets: true },
      },
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log(`\n  Super Admin: ${superAdminEmail}`);
  console.log(`  Password: ${superAdminPassword}`);
  console.log('\n  ⚠️  Change the admin password immediately in production!\n');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
