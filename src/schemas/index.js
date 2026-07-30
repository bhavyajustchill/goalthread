import { z } from 'zod';

// Deliverable requirement sub-schema
export const DeliverableRequirementSchema = z.object({
  id: z.string().describe('Unique identifier for deliverable requirement'),
  name: z.string().describe('Name of expected deliverable'),
  description: z.string().describe('Detailed description of deliverable requirement'),
  format: z.enum(['markdown', 'json', 'text', 'file']).default('markdown'),
  mandatory: z.boolean().default(true),
});

// Phase definition sub-schema
export const PhaseDefinitionSchema = z.object({
  phaseId: z.string().describe('Phase identifier'),
  title: z.string().describe('Title of phase'),
  description: z.string().describe('Objective of this phase'),
  sequence: z.number().describe('Execution order sequence'),
});

// FR-002: Goal Specification Schema
export const GoalSpecificationSchema = z.object({
  goalId: z.string().describe('Unique goal identifier'),
  title: z.string().describe('Short title summarizing goal'),
  objective: z.string().describe('Detailed primary objective'),
  scope: z.object({
    included: z.array(z.string()).describe('Items strictly in scope'),
    excluded: z.array(z.string()).describe('Items strictly out of scope'),
  }),
  expectedDeliverables: z.array(DeliverableRequirementSchema),
  qualityStandards: z.array(z.string()).describe('Quality standards to enforce'),
  completionCriteria: z.array(z.string()).describe('Measurable completion criteria'),
  assumptions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  userInputsRequired: z.array(z.string()).default([]),
  proposedPhases: z.array(PhaseDefinitionSchema),
});

// Artifact reference sub-schema
export const ArtifactReferenceSchema = z.object({
  artifactId: z.string(),
  name: z.string(),
  summary: z.string(),
  filePath: z.string().optional(),
});

// Acceptance criterion sub-schema
export const AcceptanceCriterionSchema = z.object({
  criterionId: z.string().describe('Criterion identifier e.g. AC-1'),
  description: z.string().describe('Requirement description'),
  weight: z.number().min(0).max(1).default(1),
  mandatory: z.boolean().default(true),
});

// FR-003: Task Contract Schema
export const TaskContractSchema = z.object({
  taskId: z.string().describe('Unique task ID'),
  runId: z.string().describe('Associated run ID'),
  phaseId: z.string().describe('Associated phase ID'),
  assignedWorkerId: z.string().default('worker_1').describe('ID of assigned worker thread e.g. worker_1 or worker_2'),
  sequence: z.number().describe('Sequence number in execution timeline'),
  title: z.string().describe('Short task title'),
  objective: z.string().describe('Single primary task objective'),
  context: z.object({
    goalSummary: z.string(),
    acceptedInputs: z.array(ArtifactReferenceSchema).default([]),
    priorTaskSummary: z.string().optional(),
  }),
  instructions: z.array(z.string()).describe('Step-by-step execution instructions'),
  constraints: z.array(z.string()).default([]),
  requiredTools: z.array(z.string()).default([]),
  permittedTools: z.array(z.string()).default([]),
  expectedOutput: z.object({
    format: z.enum(['json', 'markdown', 'text', 'file']),
    schemaName: z.string().optional(),
    fields: z.array(z.string()).optional(),
    artifactNames: z.array(z.string()).optional(),
  }),
  evidenceRequirements: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema),
  maxAttempts: z.number().default(3),
  attemptNumber: z.number().default(1),
  timeoutMs: z.number().default(300000),
  createdAt: z.string(),
});

// Evidence item sub-schema
export const EvidenceItemSchema = z.object({
  id: z.string(),
  source: z.string(),
  content: z.string(),
  relevance: z.string(),
});

// Citation record sub-schema
export const CitationRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.array(z.string()).default([]),
  year: z.number().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  verified: z.boolean().default(false),
});

// FR-005: Worker Result Contract
export const WorkerResultSchema = z.object({
  taskId: z.string(),
  runId: z.string(),
  workerId: z.string().default('worker_1').describe('ID of executing worker thread'),
  reasoning: z.string().optional().describe('Worker thought process or reasoning'),
  status: z.enum(['completed', 'partial', 'blocked', 'failed']),
  summary: z.string().describe('Concise summary of work performed'),
  deliverables: z.record(z.unknown()).describe('Output data or key-value deliverables'),
  evidence: z.array(EvidenceItemSchema).default([]),
  citations: z.array(CitationRecordSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  criterionSelfAssessment: z.array(
    z.object({
      criterionId: z.string(),
      status: z.enum(['met', 'partially_met', 'not_met']),
      evidenceReference: z.string().optional(),
    })
  ).default([]),
  confidence: z.number().min(0).max(1).describe('Worker self-assessed confidence (0 to 1)'),
  completedAt: z.string(),
});

// Review issue sub-schema
export const ReviewIssueSchema = z.object({
  issueId: z.string(),
  severity: z.enum(['critical', 'major', 'minor']),
  description: z.string(),
  remediation: z.string(),
});

// FR-006: Supervisor Review Schema
export const SupervisorReviewSchema = z.object({
  reviewId: z.string(),
  taskId: z.string(),
  decision: z.enum(['PASS', 'FAIL', 'PARTIAL', 'BLOCKED', 'NEEDS_USER_INPUT']),
  score: z.number().min(0).max(100),
  criterionResults: z.array(
    z.object({
      criterionId: z.string(),
      passed: z.boolean(),
      score: z.number().min(0).max(100),
      comments: z.string(),
      evidenceReferences: z.array(z.string()).default([]),
    })
  ),
  strengths: z.array(z.string()).default([]),
  issues: z.array(ReviewIssueSchema).default([]),
  missingItems: z.array(z.string()).default([]),
  unsupportedClaims: z.array(z.string()).default([]),
  inconsistencies: z.array(z.string()).default([]),
  correctiveAction: z.object({
    required: z.boolean(),
    instructions: z.array(z.string()).default([]),
  }).optional(),
  taskAccepted: z.boolean(),
  goalComplete: z.boolean(),
  reviewSummary: z.string(),
});

// Final Quality Report Schema
export const FinalQualityReportSchema = z.object({
  passed: z.boolean(),
  checkedCriteria: z.array(
    z.object({
      name: z.string(),
      passed: z.boolean(),
      notes: z.string(),
    })
  ),
  missingItems: z.array(z.string()).default([]),
  criticalIssues: z.array(z.string()).default([]),
  synthesisSummary: z.string(),
  completedAt: z.string(),
});

// Execution Limits Schema
export const ExecutionLimitsSchema = z.object({
  maxTasks: z.number().default(100),
  maxAttemptsPerTask: z.number().default(3),
  maxSupervisorCalls: z.number().default(150),
  maxWorkerCalls: z.number().default(150),
  maxTotalTokens: z.number().default(1000000),
  maxEstimatedCostUsd: z.number().default(25),
  maxRuntimeMinutes: z.number().default(120),
});

// Configuration Schema
export const RunConfigSchema = z.object({
  supervisor: z.object({
    provider: z.string().default('groq'),
    model: z.string().default('llama-3.3-70b-versatile'),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    baseUrl: z.string().optional(),
    temperature: z.number().default(0.1),
    maxOutputTokens: z.number().default(8000),
  }),
  worker: z.object({
    provider: z.string().default('openrouter'),
    model: z.string().default('anthropic/claude-3.5-sonnet'),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    baseUrl: z.string().optional(),
    temperature: z.number().default(0.2),
    maxOutputTokens: z.number().default(12000),
  }),
  execution: ExecutionLimitsSchema.default({}),
  storage: z.object({
    driver: z.string().default('sqlite'),
    path: z.string().default('./.goalthread/goalthread.db'),
  }).default({}),
  artifacts: z.object({
    directory: z.string().default('./goalthread-runs'),
  }).default({}),
  permissions: z.object({
    network: z.boolean().default(false),
    shell: z.boolean().default(false),
  }).default({}),
});
