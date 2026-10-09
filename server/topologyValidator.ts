import { TopologyNode, ExecutionTopology, CapabilityItem } from '../src/types/asi.js';

export interface ValidationIssue {
  type: 'error' | 'warning';
  nodeId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateTopology(
  topology: ExecutionTopology,
  systemCapabilities: CapabilityItem[]
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const nodeMap = new Map<string, TopologyNode>();
  const availableCaps = new Set(systemCapabilities.filter((c) => c.available).map((c) => c.capabilityId));

  for (const node of topology.nodes) {
    if (nodeMap.has(node.nodeId)) {
      issues.push({
        type: 'error',
        nodeId: node.nodeId,
        message: `存在重复的节点 ID: ${node.nodeId}`,
      });
    }
    nodeMap.set(node.nodeId, node);
  }

  for (const node of topology.nodes) {
    // 依赖有效性校验
    for (const depId of node.dependsOn) {
      if (!nodeMap.has(depId)) {
        issues.push({
          type: 'error',
          nodeId: node.nodeId,
          message: `节点 [${node.name}] 依赖了不存在的节点: ${depId}`,
        });
      }
    }

    // 循环上限校验
    if (node.relationToNext === 'LOOP') {
      if (!node.maxRetries || node.maxRetries <= 0) {
        issues.push({
          type: 'error',
          nodeId: node.nodeId,
          message: `节点 [${node.name}] 属于 LOOP 拓扑关系，但未设置有效的最大循环限制 (maxRetries > 0)`,
        });
      }
    }

    // 能力匹配校验
    for (const reqCap of node.requiredCapabilities) {
      if (!availableCaps.has(reqCap)) {
        issues.push({
          type: 'warning',
          nodeId: node.nodeId,
          message: `节点 [${node.name}] 所需能力 "${reqCap}" 当前受限，将以安全模式执行。`,
        });
      }
    }
  }

  return {
    valid: issues.filter((i) => i.type === 'error').length === 0,
    issues,
  };
}

export function generateStandardTopology(
  projectId: string,
  ruleId?: string,
  projectName?: string
): ExecutionTopology {
  const planId = `plan-${Date.now()}`;

  const nodes: TopologyNode[] = [
    {
      nodeId: 'start',
      name: '项目入口与输入',
      nodeType: 'file_analysis',
      description: '接收用户任务和项目输入，校验文件哈希并提取项目元数据。',
      dependsOn: [],
      relationToNext: 'NEXT',
      inputs: [{ name: '用户任务/资料', type: 'ProjectManifest', required: true }],
      outputs: [{ name: '标准化任务输入', type: 'StandardTaskInput' }],
      status: 'READY',
      timeoutSeconds: 30,
      maxRetries: 1,
      riskLevel: 'low',
      requiredCapabilities: ['read_imported_files'],
    },
    {
      nodeId: 'load',
      name: '按原生规则加载',
      nodeType: 'rule_matching',
      description: '复刻项目原生规约，读取并解析规则文档（如 SKILL.md、package.json 等）。',
      dependsOn: ['start'],
      relationToNext: 'NEXT',
      inputs: [{ name: '项目规则与文件', type: 'RawProjectFiles', required: true }],
      outputs: [{ name: '加载记录', type: 'RuleLoadRecord' }],
      status: 'READY',
      timeoutSeconds: 30,
      maxRetries: 1,
      riskLevel: 'low',
      requiredCapabilities: ['static_rule_detection'],
    },
    {
      nodeId: 'prep',
      name: '资料准备',
      nodeType: 'file_analysis',
      description: '整理输入资料、上下文约束与执行前置条件，准备分支任务包。',
      dependsOn: ['load'],
      relationToNext: 'PARALLEL',
      inputs: [{ name: '标准化任务输入', type: 'StandardTaskInput', required: true }],
      outputs: [{ name: '资料包', type: 'AnalysisContextPackage' }],
      status: 'READY',
      timeoutSeconds: 30,
      maxRetries: 1,
      riskLevel: 'low',
      requiredCapabilities: ['read_imported_files'],
    },
    {
      nodeId: 'market',
      name: '市场分析',
      nodeType: 'plan_synthesis',
      description: '并行分支：提取项目行业需求、目标受众与核心价值定义。',
      dependsOn: ['prep'],
      relationToNext: 'MERGE',
      inputs: [{ name: '资料包', type: 'AnalysisContextPackage', required: true }],
      outputs: [{ name: '市场分析草稿', type: 'MarketAnalysisDraft' }],
      status: 'READY',
      timeoutSeconds: 60,
      maxRetries: 2,
      riskLevel: 'low',
      requiredCapabilities: ['static_rule_detection'],
    },
    {
      nodeId: 'comp',
      name: '竞争分析',
      nodeType: 'plan_synthesis',
      description: '并行分支：对比同类生态方案，提取差异化技术特征与依赖约束。',
      dependsOn: ['prep'],
      relationToNext: 'MERGE',
      inputs: [{ name: '资料包', type: 'AnalysisContextPackage', required: true }],
      outputs: [{ name: '竞争分析草稿', type: 'CompAnalysisDraft' }],
      status: 'READY',
      timeoutSeconds: 60,
      maxRetries: 2,
      riskLevel: 'low',
      requiredCapabilities: ['static_rule_detection'],
    },
    {
      nodeId: 'finance',
      name: '财务分析',
      nodeType: 'plan_synthesis',
      description: '并行分支：分析资源消耗、Token 成本预算与环境部署经济性。',
      dependsOn: ['prep'],
      relationToNext: 'MERGE',
      inputs: [{ name: '资料包', type: 'AnalysisContextPackage', required: true }],
      outputs: [{ name: '财务分析草稿', type: 'FinanceAnalysisDraft' }],
      status: 'READY',
      timeoutSeconds: 60,
      maxRetries: 2,
      riskLevel: 'low',
      requiredCapabilities: ['static_rule_detection'],
    },
    {
      nodeId: 'merge',
      name: '综合判断',
      nodeType: 'plan_synthesis',
      description: '汇总市场、竞争与财务三路分支成果，对齐上下文并标记缺失项。',
      dependsOn: ['market', 'comp', 'finance'],
      relationToNext: 'NEXT',
      inputs: [{ name: '分支成果', type: 'BranchDeliverables', required: true }],
      outputs: [{ name: '综合判断稿', type: 'ConsolidatedDraft' }],
      status: 'READY',
      timeoutSeconds: 30,
      maxRetries: 1,
      riskLevel: 'low',
      requiredCapabilities: ['static_rule_detection'],
    },
    {
      nodeId: 'verify',
      name: '交付物检查',
      nodeType: 'verification',
      description: '独立验证器复核：检查生成内容的非空性、Markdown 格式、SHA-256 哈希与元数据。',
      dependsOn: ['merge'],
      relationToNext: 'NEXT',
      inputs: [{ name: '综合判断稿', type: 'ConsolidatedDraft', required: true }],
      outputs: [{ name: '验证记录', type: 'VerificationRecord' }],
      status: 'READY',
      timeoutSeconds: 30,
      maxRetries: 1,
      riskLevel: 'low',
      requiredCapabilities: ['independent_verification'],
    },
    {
      nodeId: 'final',
      name: '最终交付',
      nodeType: 'artifact_generation',
      description: '生成最终经独立验证通过的可审计产物并存入成果库，完成运行流。',
      dependsOn: ['verify'],
      relationToNext: 'NEXT',
      inputs: [{ name: '通过检查的成果', type: 'VerifiedDeliverable', required: true }],
      outputs: [{ name: '最终报告', type: 'FinalArtifact' }],
      status: 'READY',
      timeoutSeconds: 30,
      maxRetries: 1,
      riskLevel: 'low',
      requiredCapabilities: ['read_imported_files'],
    },
  ];

  return {
    planId,
    projectId,
    title: `${projectName || '项目'} 执行拓扑计划`,
    nodes,
    createdAt: new Date().toISOString(),
  };
}
