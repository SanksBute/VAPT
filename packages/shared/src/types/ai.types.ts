export type AIProviderType = 'OPENAI' | 'ANTHROPIC' | 'OLLAMA' | 'AZURE_OPENAI' | 'GOOGLE_VERTEX' | 'COHERE' | 'MISTRAL';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: AIToolCall[];
  name?: string;
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AICompletionOptions {
  model: string;
  provider: AIProviderType;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  tools?: AITool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'json_object' | 'text' };
  systemPrompt?: string;
}

export interface AITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AICompletionResult {
  id: string;
  content: string;
  toolCalls?: AIToolCall[];
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
  provider: AIProviderType;
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

export interface AIStreamChunk {
  id: string;
  content: string;
  delta: string;
  isComplete: boolean;
  toolCalls?: Partial<AIToolCall>[];
}

export interface VulnerabilityAnalysis {
  technicalAnalysis: string;
  businessImpact: string;
  exploitationLikelihood: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  attackScenarios: string[];
  immediateActions: string[];
  longTermRemediation: string[];
  verificationSteps: string[];
  relatedVulnerabilities: string[];
  mitreAttackMapping: MitreMapping[];
  complianceImpact: ComplianceImpact[];
  aiConfidence: number;
}

export interface MitreMapping {
  techniqueId: string;
  techniqueName: string;
  tacticId: string;
  tacticName: string;
  relevance: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ComplianceImpact {
  framework: string;
  controlIds: string[];
  impact: 'DIRECT' | 'INDIRECT';
  description: string;
}

export interface AISecurityInsight {
  type: 'vulnerability' | 'threat' | 'compliance' | 'risk' | 'remediation';
  title: string;
  summary: string;
  details: string;
  confidence: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  recommendations: string[];
  references: string[];
  generatedAt: string;
  model: string;
  tokensUsed: number;
}

export interface AIContext {
  organizationId: string;
  userId: string;
  contextType: string;
  contextId?: string;
  relevantData?: Record<string, unknown>;
  userRole?: string;
  customInstructions?: string;
}
