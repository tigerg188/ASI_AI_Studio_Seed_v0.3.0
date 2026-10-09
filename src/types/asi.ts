/**
 * ASI (Agent / Skill Intelligence) 核心契约与数据模型定义
 * 依据:
 * - specs/ASI_PRODUCT_CONTRACT.md
 * - contracts/project-manifest.schema.json
 * - contracts/execution-event.schema.json
 * - contracts/topology-node.example.json
 */

export type SourceKind = 'github' | 'zip' | 'folder' | 'files' | 'natural_language' | 'generated';

export interface ProjectSource {
  kind: SourceKind;
  uri?: string;
  revision?: string;
  originalName?: string;
}

export interface FileItem {
  path: string;
  size: number;
  sha256?: string;
  signals?: string[];
  contentPreview?: string;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface RuleEvidence {
  path: string;
  reason: string;
}

export interface EntryCandidate {
  ruleId: string;
  ruleName: string;
  confidenceLevel: ConfidenceLevel;
  evidence: RuleEvidence[];
  limitations: string[];
  missingPrerequisites?: string[];
  recommendedNextStep?: string;
  isPrimary?: boolean;
}

export interface CapabilityItem {
  capabilityId: string;
  name: string;
  available: boolean;
  reason: string;
  category: 'core' | 'runtime' | 'model' | 'sandbox';
}

export interface ProjectManifest {
  projectId: string;
  name: string;
  description: string;
  source: ProjectSource;
  createdAt: string;
  updatedAt: string;
  files: FileItem[];
  capabilities: CapabilityItem[];
  entryCandidates: EntryCandidate[];
  selectedRuleId?: string;
  status: 'DRAFT' | 'READY' | 'RUNNING' | 'DONE' | 'FAILED';
}

export type TopologyRelation = 'NEXT' | 'PARALLEL' | 'CONDITION' | 'MERGE' | 'LOOP' | 'TRIGGER';

export type NodeStatus =
  | 'DRAFT'
  | 'READY'
  | 'BLOCKED'
  | 'QUEUED'
  | 'RUNNING'
  | 'EXECUTED'
  | 'VERIFIED'
  | 'FAILED'
  | 'CANCELLED'
  | 'NEEDS_CONFIRMATION';

export interface TopologyInput {
  name: string;
  type: string;
  required: boolean;
  value?: any;
}

export interface TopologyOutput {
  name: string;
  type: string;
  value?: any;
}

export interface TopologyNode {
  nodeId: string;
  name: string;
  nodeType: 'file_analysis' | 'rule_matching' | 'plan_synthesis' | 'artifact_generation' | 'verification' | 'script_exec' | 'custom_prompt';
  description: string;
  dependsOn: string[];
  relationToNext: TopologyRelation;
  inputs: TopologyInput[];
  outputs: TopologyOutput[];
  status: NodeStatus;
  timeoutSeconds: number;
  maxRetries: number;
  currentRetries?: number;
  riskLevel: 'low' | 'medium' | 'high';
  requiredCapabilities: string[];
  executedResult?: any;
  verifiedResult?: any;
  errorMessage?: string;
}

export interface ExecutionTopology {
  planId: string;
  projectId: string;
  title: string;
  nodes: TopologyNode[];
  createdAt: string;
}

export type EventType =
  | 'run_created'
  | 'node_started'
  | 'action_invoked'
  | 'action_result'
  | 'artifact_created'
  | 'verification_result'
  | 'node_failed'
  | 'run_cancelled'
  | 'warning'
  | 'user_confirmation';

export interface ExecutionEvent {
  eventId: string;
  runId: string;
  nodeId: string | null;
  timestamp: string;
  eventType: EventType;
  status: NodeStatus;
  source: string;
  action: string;
  inputSummary?: string;
  outputSummary?: string;
  exitCode?: number | null;
  durationMs?: number | null;
  artifactIds?: string[];
  errorCode?: string | null;
  redactionsApplied: boolean;
  details?: Record<string, any>;
}

export type ArtifactType = 'text' | 'json' | 'markdown' | 'report' | 'code' | 'schema';
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'FAILED';

export interface Artifact {
  artifactId: string;
  runId: string;
  nodeId: string;
  projectId: string;
  name: string;
  type: ArtifactType;
  content: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  verificationStatus: VerificationStatus;
  verificationReport?: {
    verifiedAt: string;
    passed: boolean;
    checks: Array<{
      checkName: string;
      passed: boolean;
      detail: string;
    }>;
  };
}

export interface RunInstance {
  runId: string;
  projectId: string;
  planId: string;
  status: NodeStatus;
  strategy: 'step_by_step' | 'auto_dependency';
  currentNodeId?: string | null;
  startedAt: string;
  finishedAt?: string;
  progressPercent: number;
  totalNodes: number;
  executedNodes: number;
  verifiedNodes: number;
  failedNodes: number;
  topology: ExecutionTopology;
}
