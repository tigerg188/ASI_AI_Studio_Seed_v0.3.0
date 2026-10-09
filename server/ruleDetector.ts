import { FileItem, EntryCandidate } from '../src/types/asi.js';

export function detectRules(files: FileItem[], projectDescription?: string): EntryCandidate[] {
  const candidates: EntryCandidate[] = [];
  const filePaths = files.map((f) => f.path.toLowerCase());

  // 1. Agent Skills 约定
  const skillFile = files.find((f) => f.path.toLowerCase().endsWith('skill.md'));
  if (skillFile) {
    const preview = skillFile.contentPreview || '';
    const hasYamlFrontmatter = preview.includes('---') && (preview.includes('name:') || preview.includes('description:'));
    candidates.push({
      ruleId: 'rule-agent-skills',
      ruleName: 'Agent Skills 生态规约',
      confidenceLevel: hasYamlFrontmatter ? 'high' : 'medium',
      evidence: [
        {
          path: skillFile.path,
          reason: hasYamlFrontmatter
            ? '发现规范的 SKILL.md 文档，包含 YAML 标头元数据与工具/指令约定定义。'
            : '发现 SKILL.md 文件，但未检测到标准 YAML 标头，需进一步结构核验。',
        },
      ],
      limitations: [
        '规约仅声明了技能意图与入参约束，并不代表宿主执行器（如外部命令行、无限制网络访问）当前可用。',
        '严禁在未沙箱化环境下直接触发任何危险系统调用。',
      ],
      missingPrerequisites: ['需配置服务端模型推理或通过确定性规则驱动任务拆解。'],
      recommendedNextStep: '生成 Agent Skill 执行计划，由模型与独立验证器完成分析与规约输出。',
    });
  }

  // 2. Node.js 规约
  const pkgFile = files.find((f) => f.path.toLowerCase().endsWith('package.json'));
  if (pkgFile) {
    const preview = pkgFile.contentPreview || '';
    let hasStartScript = false;
    try {
      const parsed = JSON.parse(preview);
      hasStartScript = Boolean(parsed.scripts && (parsed.scripts.start || parsed.scripts.dev));
    } catch {
      hasStartScript = preview.includes('"scripts"');
    }

    candidates.push({
      ruleId: 'rule-nodejs',
      ruleName: 'Node.js 应用/模块规约',
      confidenceLevel: hasStartScript ? 'high' : 'medium',
      evidence: [
        {
          path: pkgFile.path,
          reason: hasStartScript
            ? '发现 package.json，并检测到明确的 "scripts.start" 或 "scripts.dev" 启动定义。'
            : '发现 package.json 项目清单，但未检测到标准启动脚本定义。',
        },
      ],
      limitations: [
        '当前 AI Studio 环境不支持在当前服务主进程直接启动外部不可信 Node 脚本（防止端口冲突与特权越权）。',
        '仅开放静态依赖安全审计、打包分析与入口抽取。',
      ],
      missingPrerequisites: ['需安装依赖或校验 package-lock.json。'],
      recommendedNextStep: '提取 Node.js 入口与依赖树，输出静态安全审计报告。',
    });
  }

  // 3. Python 规约
  const pyReq = files.find((f) => f.path.toLowerCase().endsWith('requirements.txt'));
  const pyProject = files.find((f) => f.path.toLowerCase().endsWith('pyproject.toml'));
  const pyFiles = files.filter((f) => f.path.toLowerCase().endsWith('.py'));
  if (pyReq || pyProject || pyFiles.length > 0) {
    const evidenceList = [];
    if (pyReq) evidenceList.push({ path: pyReq.path, reason: '检测到 Python requirements.txt 依赖清单。' });
    if (pyProject) evidenceList.push({ path: pyProject.path, reason: '检测到 pyproject.toml 现代 Python 打包配置。' });
    if (pyFiles.length > 0) evidenceList.push({ path: pyFiles[0].path, reason: `发现 Python 脚本代码文件（共 ${pyFiles.length} 个）。` });

    candidates.push({
      ruleId: 'rule-python',
      ruleName: 'Python 脚本/服务规约',
      confidenceLevel: pyReq || pyProject ? 'high' : 'medium',
      evidence: evidenceList,
      limitations: [
        '平台当前为 Node.js 运行时环境，未挂载独立 Python 虚拟沙箱，无法原生直接运行第三方 Python 解释器。',
        '不可伪造“Python 脚本执行成功”假状态。',
      ],
      missingPrerequisites: ['需要配置外部安全沙箱执行器或本地桥接网关。'],
      recommendedNextStep: '以只读模式分析 Python 脚本入参定义与 AST 结构，输出执行计划草案。',
    });
  }

  // 4. MCP Server 规约
  const mcpConfig = files.find((f) =>
    f.path.toLowerCase().endsWith('mcp.json') ||
    f.path.toLowerCase().includes('claude_desktop_config.json')
  );
  if (mcpConfig) {
    candidates.push({
      ruleId: 'rule-mcp',
      ruleName: 'Model Context Protocol (MCP) 规约',
      confidenceLevel: 'high',
      evidence: [
        {
          path: mcpConfig.path,
          reason: '发现 MCP 配置文件，包含 mcpServers 或工具服务器声明。',
        },
      ],
      limitations: [
        '当前运行环境无本地 stdio 双向通道或受控 SSE 代理网关，无法直接握手 MCP 进程。',
      ],
      missingPrerequisites: ['需在安全网关中注册外部 MCP 端点。'],
      recommendedNextStep: '校验 MCP Tools Schema 格式，生成受支持的工具声明清单。',
    });
  }

  // 5. Claude Code / 指令文件
  const claudeMd = files.find((f) => f.path.toLowerCase().endsWith('claude.md'));
  if (claudeMd) {
    candidates.push({
      ruleId: 'rule-claude-code',
      ruleName: 'Claude Code 指令项目规约',
      confidenceLevel: 'medium',
      evidence: [
        {
          path: claudeMd.path,
          reason: '发现 CLAUDE.md，包含项目上下文、代码风格与命令指引。',
        },
      ],
      limitations: [
        '云端未配置 Claude Code CLI 二进制与授权凭据，不得假装已启动 CLI。',
      ],
      missingPrerequisites: ['需在宿主环境配置专用 CLI 授权。'],
      recommendedNextStep: '将 CLAUDE.md 规约转换为 ASI 统一执行上下文。',
    });
  }

  // 6. 兜底判定
  if (candidates.length === 0) {
    candidates.push({
      ruleId: 'rule-unknown',
      ruleName: '未识别通用规约',
      confidenceLevel: 'unknown',
      evidence: [
        {
          path: files[0]?.path || '/',
          reason: '未检测到 SKILL.md、package.json、requirements.txt 或 MCP 配置文件等典型生态入口标记。',
        },
      ],
      limitations: ['缺少运行入口特征，无法自动适配标准生态规则。'],
      missingPrerequisites: ['需要用户提供项目说明或明确入口文件。'],
      recommendedNextStep: '在“用户自建”工作台中补充描述，或在项目详情中人工指定入口。',
    });
  }

  // 判定主入口：优先依据 README / 描述与最具体规约
  let primaryIndex = 0;
  // 优先级顺序: Agent Skills > MCP > Node.js > Python > Claude Code
  const priorityOrder = ['rule-agent-skills', 'rule-mcp', 'rule-nodejs', 'rule-python', 'rule-claude-code'];
  for (const prio of priorityOrder) {
    const idx = candidates.findIndex((c) => c.ruleId === prio);
    if (idx >= 0) {
      primaryIndex = idx;
      break;
    }
  }

  candidates.forEach((c, idx) => {
    c.isPrimary = idx === primaryIndex;
  });

  return candidates;
}
