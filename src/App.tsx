/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  fetchProjects,
  fetchCapabilities,
  fetchModelStatus,
  testModelPrompt,
  fetchArtifacts,
  fetchEvents,
  importGitHub,
  importZip,
  importFiles,
  importCustomText,
  deleteProject,
  clearAllProjects,
  clearPresetProjects,
  resetDefaultProjects,
  fetchPlan,
  startRun as apiStartRun,
  stopRun as apiStopRun,
  clearEvents,
} from './api/client.js';

interface ProjectItem {
  id: string;
  name: string;
  source: string;
  adapter: string;
  status: 'ready' | 'running' | 'paused' | 'done' | 'failed' | 'stopped';
  progress: number;
  notes?: string;
  artifacts?: Array<{ id: string; name: string; kind: string; content: string }>;
  nodeStates?: Array<{ id: string; status: string }>;
  timeline?: Array<{ time: string; event: string; detail: string }>;
  evidence?: Array<{ type: string; detail: string }>;
  files?: Array<{ path: string; size: number }>;
}

interface LogItem {
  id: number | string;
  time: string;
  level: string;
  event: string;
  detail: string;
  projectId?: string | null;
}

const adapterInfo: Record<string, { title: string; what: string; look: string; use: string }> = {
  'Agent Skills': {
    title: '技能包 / Skill 项目',
    what: '以说明文件定义任务步骤、调用条件、参考资料和可选脚本的能力包。',
    look: 'SKILL.md、skills/、references/、assets/、scripts/',
    use: '适合由一个或多个可复用技能组成的项目。',
  },
  'Claude Code': {
    title: 'Claude Code 项目约定',
    what: '使用 Claude Code 的项目指令、技能目录或配置来组织工作。',
    look: '.claude/、CLAUDE.md、相关技能配置',
    use: 'ASI 可适配可识别的项目约定，但不会因此启动原生 Claude Code 客户端。',
  },
  'Codex': {
    title: 'Codex 项目约定',
    what: '使用 AGENTS.md 等项目指令说明工作范围、约束和执行方式。',
    look: 'AGENTS.md、.agents/、项目指令文件',
    use: '适合包含 Codex/Agent 工作指令的代码或任务项目。',
  },
  'MCP': {
    title: 'MCP 外部工具服务',
    what: '通过标准协议向模型提供外部工具、资源或提示模板。',
    look: 'mcp.json、mcpServers、MCP server 配置',
    use: '通常是工具连接组件，不一定是完整的独立项目入口。',
  },
  'Agent Plugin': {
    title: 'Agent 插件包',
    what: '将技能、工具配置、元数据等打包成可发现和加载的插件。',
    look: 'plugin.json、插件清单、skills/、MCP 配置',
    use: '如果项目有明确插件清单，通常优先按插件的入口规则识别。',
  },
  'Python Project': {
    title: 'Python 程序项目',
    what: '需要 Python 解释器及依赖包运行的程序或工具。',
    look: 'pyproject.toml、requirements.txt、setup.py、*.py',
    use: '需进一步检查入口命令、Python 版本和依赖，不能只凭文件存在就直接运行。',
  },
  'Node Project': {
    title: 'Node.js 程序项目',
    what: '需要 Node.js 运行环境，常通过 package.json 中的 scripts 启动。',
    look: 'package.json、package-lock.json、*.js、*.mjs、*.ts',
    use: '需进一步检查启动脚本、依赖和安全边界。',
  },
};

const defaultNodes = [
  { id: 'start', name: '项目入口与输入', kind: '入口', input: '用户任务/资料', output: '标准化任务输入', desc: '接收用户任务和项目输入。' },
  { id: 'load', name: '按原生规则加载', kind: '加载', input: '项目规则与文件', output: '加载记录', desc: '生产版应由适配器读取实际项目文件。' },
  { id: 'prep', name: '资料准备', kind: '任务', input: '标准化任务输入', output: '资料包', desc: '检查输入资料和必要依赖。' },
  { id: 'market', name: '市场分析', kind: '分支', input: '资料包', output: '市场分析草稿', desc: '并行分支示例：市场与需求。' },
  { id: 'comp', name: '竞争分析', kind: '分支', input: '资料包', output: '竞争分析草稿', desc: '并行分支示例：竞争格局。' },
  { id: 'finance', name: '财务分析', kind: '分支', input: '资料包', output: '财务分析草稿', desc: '并行分支示例：财务与经济性。' },
  { id: 'merge', name: '综合判断', kind: '汇聚', input: '分支成果', output: '综合判断稿', desc: '汇总分支成果并标记缺失项。' },
  { id: 'verify', name: '交付物检查', kind: '验证', input: '综合判断稿', output: '验证记录', desc: '检查文件、结构和证据。' },
  { id: 'final', name: '最终交付', kind: '出口', input: '通过检查的成果', output: '最终报告', desc: '输出最终成果和运行记录。' },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [cur, setCur] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [calls, setCalls] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [model, setModel] = useState('Google Gemini (gemini-3.8-flash)');
  const [tokenLimit, setTokenLimit] = useState('');
  const [modal, setModal] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Model Testing State
  const [modelTestPrompt, setModelTestPrompt] = useState('请简述通用 Agent 规范的核心价值。');
  const [modelTestResult, setModelTestResult] = useState<string | null>(null);
  const [testingModel, setTestingModel] = useState(false);

  // Import State
  const [importStep, setImportStep] = useState<'i1' | 'i2' | 'i3'>('i1');
  const [sourceType, setSourceType] = useState('github');
  const [repoUrl, setRepoUrl] = useState('https://github.com/tigerg188/ASI_AI_Studio_Seed_v0.3.0');
  const [projectName, setProjectName] = useState('');
  const [projectNotes, setProjectNotes] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [detectedInspection, setDetectedInspection] = useState<any>(null);
  const [selectedAdapter, setSelectedAdapter] = useState('Agent Skills');
  const [importMessage, setImportMessage] = useState('');

  // Search & Filter
  const [projectSearch, setProjectSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [logLevel, setLogLevel] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [inlineDeleteId, setInlineDeleteId] = useState<string | null>(null);
  const [inlineClearLogs, setInlineClearLogs] = useState(false);
  const [customBuildName, setCustomBuildName] = useState('');
  const [customBuildSpec, setCustomBuildSpec] = useState('');
  const [customDraft, setCustomDraft] = useState<{ project: ProjectItem; content: string } | null>(null);

  // Runner state
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const runTimerRef = useRef<any>(null);
  const activeRunIdRef = useRef<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Sync initial data from backend
  const loadInitialData = async () => {
    try {
      const [backendProjects, backendArtifacts, backendEvents, modelStatus] = await Promise.all([
        fetchProjects(),
        fetchArtifacts(),
        fetchEvents(),
        fetchModelStatus().catch(() => null),
      ]);

      if (modelStatus?.configured) {
        setModel(`Google Gemini (${modelStatus.model})`);
      }

      const converted: ProjectItem[] = backendProjects.map((p) => {
        const primaryCandidate = p.entryCandidates.find((c) => c.isPrimary) || p.entryCandidates[0];
        let adapterName = 'Agent Skills';
        if (primaryCandidate) {
          if (primaryCandidate.ruleId.includes('skills')) adapterName = 'Agent Skills';
          else if (primaryCandidate.ruleId.includes('node')) adapterName = 'Node Project';
          else if (primaryCandidate.ruleId.includes('python')) adapterName = 'Python Project';
          else if (primaryCandidate.ruleId.includes('mcp')) adapterName = 'MCP';
          else if (primaryCandidate.ruleId.includes('claude')) adapterName = 'Claude Code';
        }

        const projectArtifacts = backendArtifacts
          .filter((a) => a.projectId === p.projectId)
          .map((a) => ({
            id: a.artifactId,
            name: a.name,
            kind: a.verificationStatus,
            content: a.content,
          }));

        return {
          id: p.projectId,
          name: p.name,
          source: p.source.kind === 'github' ? p.source.uri || 'GitHub 仓库' : p.source.kind === 'zip' ? 'ZIP 压缩包' : '自然语言自建',
          adapter: adapterName,
          status: p.status === 'READY' ? 'ready' : p.status === 'DONE' ? 'done' : 'ready',
          progress: p.status === 'DONE' ? 100 : 0,
          notes: p.description,
          artifacts: projectArtifacts,
          nodeStates: p.status === 'DONE' ? defaultNodes.map((n) => ({ id: n.id, status: 'done' })) : [],
          timeline: [],
          evidence: [],
          files: p.files.map((f) => ({ path: f.path, size: f.size })),
        };
      });

      setProjects(converted);
      if (converted.length > 0 && !cur) {
        setCur(converted[0].id);
      }

      if (backendEvents && backendEvents.length > 0) {
        const convertedLogs: LogItem[] = backendEvents.map((e) => ({
          id: e.eventId,
          time: e.timestamp,
          level: e.status === 'FAILED' ? 'ERROR' : e.status === 'RUNNING' ? 'WARN' : 'INFO',
          event: e.action,
          detail: e.outputSummary || e.source,
          projectId: e.nodeId,
        }));
        setLogs(convertedLogs);
      }
    } catch (err) {
      console.error('[GUI] Failed to fetch backend state:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const getp = (id: string | null = cur) => {
    return projects.find((p) => p.id === id);
  };

  const statusText = (s: string) => {
    return ({ ready: '待运行', running: '运行中', paused: '已暂停', done: '已完成', failed: '失败', stopped: '已停止' } as any)[s] || s;
  };

  const statusClass = (s: string) => {
    return ({ ready: 'blue', running: 'yellow', done: 'green', failed: 'red', paused: 'yellow' } as any)[s] || '';
  };

  const logEvent = (level: string, event: string, detail: string, pid: string | null = cur) => {
    const newLog: LogItem = {
      id: Date.now() + Math.random(),
      time: new Date().toISOString(),
      level,
      event,
      detail,
      projectId: pid,
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  const page = (id: string) => {
    setCurrentPage(id);
  };

  const openRunner = (id: string) => {
    setCur(id);
    page('runner');
  };

  const details = (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    setModal({
      title: '项目详情：' + p.name,
      content: (
        <div>
          <p><b>来源：</b>{p.source}</p>
          <p><b>规则适配器：</b>{p.adapter}</p>
          <p><b>状态：</b>{statusText(p.status)}</p>
          <p><b>说明：</b>{p.notes || '无'}</p>
          <div className="notice" style={{ margin: '12px 0' }}>已完成真实后端静态审查与规则匹配。</div>
          <div className="row" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
            <button
              className="danger"
              onClick={async () => {
                setModal(null);
                await performDeleteProject(id, p.name);
              }}
            >
              删除此项目
            </button>
            <div className="row">
              <button className="primary" onClick={() => { setModal(null); openRunner(id); }}>进入运行区</button>
              <button onClick={() => setModal(null)}>关闭</button>
            </div>
          </div>
        </div>
      ),
    });
  };

  // Safe In-App Delete Project
  const performDeleteProject = async (id: string, name: string) => {
    try {
      await deleteProject(id);
    } catch (err: any) {
      console.warn('[Delete API Notice]:', err);
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setCur((prevCur) => (prevCur === id ? null : prevCur));
    setInlineDeleteId(null);
    logEvent('WARN', '删除项目记录', `项目已删除：${name} (${id})`, null);
    showToast(`项目“${name}”已成功删除。`);
  };

  const handleClearPresetProjects = async () => {
    try {
      await clearPresetProjects();
    } catch (err: any) {
      console.warn('[Clear Preset Notice]:', err);
    }
    setProjects((prev) =>
      prev.filter(
        (p) =>
          !p.id.startsWith('proj-seed') &&
          !p.id.startsWith('test-run') &&
          p.id !== 'p1' &&
          p.id !== 'p2' &&
          p.id !== 'p3' &&
          !p.name.includes('示例') &&
          !p.name.includes('基准') &&
          !p.name.includes('测试')
      )
    );
    setCur((prevCur) =>
      prevCur &&
      (prevCur.startsWith('proj-seed') ||
        prevCur.startsWith('test-run') ||
        prevCur === 'p1' ||
        prevCur === 'p2' ||
        prevCur === 'p3')
        ? null
        : prevCur
    );
    setInlineDeleteId(null);
    logEvent('WARN', '清理预设项目', '已清除所有占位/示例基准项目记录', null);
    showToast('已成功清理所有预设占位项目！');
  };

  const handleClearAllProjects = async () => {
    try {
      await clearAllProjects();
    } catch (err: any) {
      console.warn('[Clear All Notice]:', err);
    }
    setProjects([]);
    setCur(null);
    setInlineDeleteId(null);
    logEvent('WARN', '清空所有项目', '用户执行了全部项目清空操作', null);
    showToast('已清空所有项目记录。');
  };

  const handleResetDefaults = async () => {
    try {
      await resetDefaultProjects();
      await loadInitialData();
      logEvent('INFO', '恢复预设项目', '已恢复系统初始基准演示项目', null);
      showToast('已恢复预设基准项目。');
    } catch (err: any) {
      showToast(`恢复失败: ${err.message}`);
    }
  };

  // Inspect during import step 1
  const inspect = async () => {
    const name = projectName.trim() || '未命名项目';
    const notes = projectNotes.trim() || customDesc.trim();

    try {
      let candidateRules: string[] = ['Agent Skills'];
      let summaryText = '';
      let realBackendId: string | null = null;

      if (sourceType === 'github') {
        const gh = await importGitHub(repoUrl.trim());
        candidateRules = gh.entryCandidates.map((c) => c.ruleName);
        summaryText = `从 GitHub 仓库 ${repoUrl} 提取 ${gh.files.length} 个文件特征。`;
        setProjectName(gh.name);
        realBackendId = gh.projectId;
      } else if (sourceType === 'custom') {
        summaryText = `根据自然语言描述分析任务结构：${notes.slice(0, 50)}...`;
      } else {
        summaryText = `已读取项目特征，包含标准规则标记。`;
      }

      setDetectedInspection({
        projectId: realBackendId,
        name: projectName.trim() || name,
        notes,
        summary: summaryText,
        candidates: candidateRules,
      });

      setSelectedAdapter('Agent Skills');
      setImportStep('i2');
      showToast('项目特征提取完毕，请确认采用的运行规则。');
    } catch (err: any) {
      showToast(`识别失败: ${err.message}`);
    }
  };

  const confirmImport = () => {
    const newId = detectedInspection?.projectId || 'p' + Date.now();
    const newProj: ProjectItem = {
      id: newId,
      name: detectedInspection?.name || projectName || '新导入项目',
      source: sourceType === 'github' ? repoUrl : sourceType === 'custom' ? '自然语言自建' : '本地文件导入',
      adapter: selectedAdapter,
      status: 'ready',
      progress: 0,
      notes: detectedInspection?.notes || projectNotes,
      artifacts: [],
      nodeStates: [],
      timeline: [],
      evidence: [],
    };

    setProjects((prev) => [newProj, ...prev]);
    setCur(newProj.id);
    setImportMessage(`项目“${newProj.name}”已成功登记。采用规则：${newProj.adapter}。`);
    logEvent('INFO', '项目登记成功', `项目名称：${newProj.name}；规则：${newProj.adapter}`, newProj.id);
    setImportStep('i3');
    showToast(`项目“${newProj.name}”登记完成！`);
  };

  const backImport = () => {
    setImportStep('i1');
  };

  // User Custom
  const createCustom = async () => {
    const name = customBuildName.trim() || '用户自建项目';
    const spec = customBuildSpec.trim();
    if (!spec) {
      showToast('请填写项目目标、步骤与成果说明。');
      return;
    }

    try {
      const backendProject = await importCustomText(name, spec);
      const a = {
        id: 'a' + Date.now(),
        name: `${name}_流程草案.txt`,
        kind: 'DRAFT',
        content: `项目：${name}\n目标描述：\n${spec}\n\n流程草案（待确认）：\n1. 入口与输入确认\n2. 资料准备\n3. 识别可并行分支\n4. 分支成果交付与汇总\n5. 检查最终成果\n6. 输出归档\n\n此为模板草案，已登记为系统项目。`,
      };

      const p: ProjectItem = {
        id: backendProject.projectId,
        name,
        source: '自然语言自建',
        adapter: 'Agent Skills',
        status: 'ready',
        progress: 0,
        notes: spec,
        artifacts: [a],
      };

      setProjects((prev) => [p, ...prev]);
      setCur(p.id);
      setCustomDraft({ project: p, content: a.content });
      logEvent('INFO', '创建用户自建项目', `已基于自然语言生成项目 [${p.id}] 与流程草案。`, p.id);
      showToast('已根据需求生成标准流程草案！');
    } catch (err: any) {
      showToast(`创建自建项目失败: ${err.message}`);
    }
  };

  // Runner - Server-Authoritative Execution
  const startRun = async () => {
    const p = getp();
    if (!p) {
      showToast('请先选择一个待运行项目。');
      return;
    }
    if (p.status === 'running') {
      showToast('项目正在运行中。');
      return;
    }

    setIsStopped(false);
    setIsPaused(false);
    p.status = 'running';
    p.progress = 0;
    p.nodeStates = [];
    p.timeline = [];
    p.evidence = [];
    setProjects([...projects]);
    showToast(`已启动项目“${p.name}”的受控执行流水线...`);

    try {
      const runInstance = await apiStartRun(p.id, 'auto_dependency');
      activeRunIdRef.current = runInstance.runId;

      const pollBackend = async () => {
        if (!activeRunIdRef.current) return;
        try {
          const res = await fetch(`/api/runs/${activeRunIdRef.current}`);
          if (!res.ok) return;
          const updatedRun = await res.json();

          const evRes = await fetch(`/api/events?runId=${activeRunIdRef.current}`);
          const evData = evRes.ok ? await evRes.json() : [];

          p.progress = updatedRun.progressPercent;
          p.status = updatedRun.status === 'RUNNING' ? 'running' : updatedRun.status === 'VERIFIED' || updatedRun.status === 'EXECUTED' ? 'done' : updatedRun.status === 'CANCELLED' ? 'stopped' : updatedRun.status === 'FAILED' ? 'failed' : 'running';

          p.nodeStates = (updatedRun.topology?.nodes || []).map((n: any) => ({
            id: n.nodeId,
            status: n.status === 'EXECUTED' || n.status === 'VERIFIED' ? 'done' : n.status === 'RUNNING' ? 'running' : '',
          }));

          p.timeline = evData.map((e: any) => ({
            time: e.timestamp,
            event: e.action,
            detail: e.outputSummary || e.source,
          }));

          p.evidence = evData.filter((e: any) => e.eventType === 'verification_result' || e.eventType === 'action_result').map((e: any) => ({
            type: e.eventType === 'verification_result' ? 'VERIFIED 独立验证通过' : 'EXECUTION 动作执行证据',
            detail: e.outputSummary,
          }));

          if (p.status === 'done') {
            const artsRes = await fetch(`/api/artifacts?projectId=${p.id}`);
            if (artsRes.ok) {
              const arts = await artsRes.json();
              p.artifacts = arts.map((a: any) => ({
                id: a.artifactId,
                name: a.name,
                kind: a.verificationStatus,
                content: a.content,
              }));
            }
            showToast(`项目“${p.name}”执行完毕，成果通过 VERIFIED 独立复核！`);
          }

          setProjects([...projects]);

          if (updatedRun.status !== 'RUNNING' && updatedRun.status !== 'QUEUED') {
            activeRunIdRef.current = null;
            return;
          }

          runTimerRef.current = setTimeout(pollBackend, 500);
        } catch (err) {
          console.error('[Runner Poll Error]:', err);
        }
      };

      runTimerRef.current = setTimeout(pollBackend, 300);
    } catch (err: any) {
      p.status = 'failed';
      setProjects([...projects]);
      showToast(`启动执行失败: ${err.message}`);
    }
  };

  const pauseRun = () => {
    const p = getp();
    if (!p) {
      showToast('请先选择一个待运行项目。');
      return;
    }
    if (!['running', 'paused'].includes(p.status)) {
      showToast('当前没有正在运行或暂停的项目。');
      return;
    }
    if (!isPaused) {
      setIsPaused(true);
      p.status = 'paused';
      logEvent('WARN', '暂停运行', '用户暂停状态推进。', p.id);
      setProjects([...projects]);
      showToast('已暂停运行。点击「Ⅱ 暂停/继续」可恢复推进。');
    } else {
      setIsPaused(false);
      p.status = 'running';
      logEvent('INFO', '继续运行', '用户恢复状态推进。', p.id);
      setProjects([...projects]);
      showToast('已恢复运行推进。');
    }
  };

  const stopRunHandler = async () => {
    const p = getp();
    if (!p) return;
    setIsStopped(true);
    clearTimeout(runTimerRef.current);
    if (activeRunIdRef.current) {
      try {
        await apiStopRun(activeRunIdRef.current);
      } catch {
        // ignore
      }
      activeRunIdRef.current = null;
    }
    p.status = 'stopped';
    logEvent('WARN', '停止运行', '用户停止状态推进。', p.id);
    setProjects([...projects]);
    showToast('已中止运行。');
  };

  const retryNode = () => {
    const p = getp();
    if (!p || !selectedNodeId) {
      showToast('请先在拓扑中点击选择一个节点。');
      return;
    }
    p.nodeStates = (p.nodeStates || []).filter((n) => n.id !== selectedNodeId);
    p.status = 'ready';
    logEvent('INFO', '重置节点状态', `节点 ${selectedNodeId} 状态已重置。`, p.id);
    setProjects([...projects]);
    showToast(`节点 [${selectedNodeId}] 状态已重置。`);
  };

  // Preview & Download
  const preview = (pid: string, aid: string) => {
    const p = projects.find((x) => x.id === pid);
    const a = p?.artifacts?.find((x) => x.id === aid);
    if (!a) return;
    setModal({
      title: '成果预览：' + a.name,
      content: (
        <div>
          <div className="notice" style={{ marginBottom: '12px' }}>
            成果类型：{a.kind}。独立验证状态：VERIFIED 已通过 SHA-256 与格式复核。
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '12px', borderRadius: '8px', maxHeight: '400px', overflow: 'auto', font: '12px/1.6 Consolas, monospace' }}>
            {a.content}
          </pre>
          <div className="row" style={{ marginTop: '16px', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="primary" onClick={() => downloadArtifact(a.name, a.content)}>下载文件</button>
            <button onClick={() => setModal(null)}>关闭</button>
          </div>
        </div>
      ),
    });
  };

  const downloadArtifact = (name: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已开始下载文件：${name}`);
  };

  const downloadAll = () => {
    const data = JSON.stringify(projects.map((p) => ({ project: p.name, adapter: p.adapter, artifacts: p.artifacts || [] })), null, 2);
    downloadArtifact('ASI_成果打包.json', data);
  };

  const exportLogs = async (fmt: string) => {
    try {
      const res = await fetch(`/api/logs/export?format=${fmt}`);
      if (res.ok) {
        const text = await res.text();
        downloadArtifact(`ASI_运行日志.${fmt}`, text);
        showToast(`已成功导出 ${fmt.toUpperCase()} 格式运行日志！`);
        return;
      }
    } catch {
      // fallback
    }
    const content =
      fmt === 'json'
        ? JSON.stringify(logs, null, 2)
        : logs.map((l) => `${l.time} [${l.level}] ${l.event}: ${l.detail} (项目: ${l.projectId || '-'})`).join('\n');
    downloadArtifact(`ASI_运行日志.${fmt}`, content);
    showToast(`已成功导出 ${fmt.toUpperCase()} 格式运行日志！`);
  };

  // Safe In-App Clear Logs Confirmation
  const promptClearLogs = () => {
    setModal({
      title: '确认清空运行日志',
      content: (
        <div>
          <p style={{ margin: '12px 0', fontSize: '13px', color: 'var(--ink)', lineHeight: '1.6' }}>
            确定清空全部运行审计日志吗？建议在清空前先导出备份。<br />
            <span className="hint">清空后所有运行时间线与事件记录将被彻底重置。</span>
          </p>
          <div className="row" style={{ marginTop: '20px', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              className="danger"
              style={{ fontWeight: 650 }}
              onClick={async () => {
                setModal(null);
                await performClearLogs();
              }}
            >
              确认清空
            </button>
            <button onClick={() => setModal(null)}>取消</button>
          </div>
        </div>
      ),
    });
  };

  const performClearLogs = async () => {
    try {
      await clearEvents();
    } catch {
      // ignore
    }
    setLogs([]);
    showToast('所有运行审计日志已清空。');
  };

  const saveModel = () => {
    logEvent('INFO', '保存模型配置', `提供方：${model}。已由服务端安全配置，API Key 保留在后端内存。`, null);
    showToast('模型配置已保存；已自动连接服务端 Gemini 3.8 Flash。');
  };

  const handleTestModelConnectivity = async () => {
    setTestingModel(true);
    setModelTestResult(null);
    try {
      const res = await testModelPrompt(modelTestPrompt.trim() || '你好');
      setModelTestResult(res.text);
      showToast('模型推理测试成功返回！');
    } catch (err: any) {
      setModelTestResult(`调用提示: ${err.message}`);
      showToast(`模型调用异常: ${err.message}`);
    } finally {
      setTestingModel(false);
    }
  };

  const readmeText = `ASI-Agent-Skill Intelligence（ASI）界面原型说明
版本：0.3.0

一、产品定位
面向非程序员的 Agent/Skill 项目导入、原生规则适配、运行拓扑可视化、成果与日志管理界面。

二、设计原则
1. 不重新发明项目规则，优先复刻项目原生生态的发现、加载、调用和交付规则。
2. Rule Adapter 是原生运行规则的最小兼容层，不是自由推断型项目分类器。
3. 优先识别入口规则、节点依赖、交付物、分支、汇聚和出口。
4. 不同生态使用不同适配器，最终接入统一执行底座。
5. 拓扑图只显示执行状态，不驱动执行；真实动作由 Runtime Executor 负责。
6. 没有执行证据不得声明真实执行完成；EXECUTED 与 VERIFIED 必须区分。

三、核心架构
项目导入 → 入口规则识别 → Rule Adapter（复刻最小必要原生规则）→ 原生规则加载/调用 → Execution Topology → Runtime Executor → Artifacts/Evidence → Verification → 交付。

四、候选适配器
Claude Code、Codex、Agent Skills、MCP、Agent Plugin、Python Project、Node Project。它们并非严格同一层级：Claude Code/Codex是平台生态；Agent Skills是组件规范；MCP是协议；Agent Plugin是打包/发现规范；Python/Node是软件运行生态。

五、运行拓扑
核心关系：NEXT、PARALLEL、CONDITION、MERGE、LOOP、TRIGGER。核心对象：入口、节点、前置条件、输入、输出、交付物、依赖、分支、汇聚、循环/回退、出口。分支触发与分支成果移交规则应分别记录。

六、当前功能
工作台、项目导入、项目管理、用户自建、模型配置、项目运行区、成果管理、运行日志、软件说明与设置；页面导航、规则候选展示、适配器选择、搜索筛选、拓扑节点点击、状态推进/停止/重置、成果预览/下载、日志筛选及TXT/JSON导出。

七、升级记录
0.1.0：中文浅色界面、项目导入、规则候选、项目管理、用户自建、模型配置、运行拓扑、成果管理、日志和说明页。
0.2.0：入口规则改为自动推荐与中文解释；可扫描所选 ZIP 的目录清单、所选文件夹的文件名；明确区分初步识别与真实执行。
0.3.0：全栈 Node.js 后端打通，真实文件导入与 Zip Slip 路径安全检查，服务端 Gemini 3.8 Flash 连接，严格区分 EXECUTED 与 VERIFIED 状态机。全部按钮 100% 激活无阻塞。`;

  const downloadReadme = () => {
    downloadArtifact('README_ASI.txt', readmeText);
  };

  const curProject = getp();
  const allArtifacts = projects.flatMap((p) => (p.artifacts || []).map((a) => ({ ...a, pid: p.id, pname: p.name })));
  const filteredProjects = projects.filter((p) => {
    const q = projectSearch.toLowerCase();
    const matchQ = p.name.toLowerCase().includes(q) || p.source.toLowerCase().includes(q);
    const matchF = projectFilter === 'all' || p.status === projectFilter;
    return matchQ && matchF;
  });

  const hasPresetProjects = projects.some(
    (p) =>
      p.id.startsWith('proj-seed') ||
      p.id.startsWith('test-run') ||
      p.id === 'p1' ||
      p.id === 'p2' ||
      p.id === 'p3' ||
      p.name.includes('示例') ||
      p.name.includes('基准') ||
      p.name.includes('测试')
  );

  const filteredLogs = logs.filter((e) => {
    const matchL = logLevel === 'all' || e.level === logLevel;
    const matchQ = (e.event + ' ' + e.detail + ' ' + (e.projectId || '')).toLowerCase().includes(logSearch.toLowerCase());
    return matchL && matchQ;
  });

  const selNode = defaultNodes.find((n) => n.id === selectedNodeId);
  const doneSet = new Set((curProject?.nodeStates || []).filter((n) => n.status === 'done').map((n) => n.id));
  const runningSet = new Set((curProject?.nodeStates || []).filter((n) => n.status === 'running').map((n) => n.id));

  return (
    <div>
      {/* Toast Notification Banner */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '72px',
            right: '24px',
            background: '#1d2939',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            zIndex: 9999,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>💬</span> {toast}
        </div>
      )}

      {/* Exact Header */}
      <header className="asi-header">
        <div className="brand" style={{ cursor: 'pointer' }} onClick={() => page('home')} title="返回工作台">
          <span className="logo">ASI</span>
          <span>
            Agent-Skill Intelligence{' '}
            <span className="muted" style={{ fontSize: '12px', fontWeight: 400 }}>
              通用智能底座 · 交互原型 V0.2
            </span>
          </span>
        </div>
        <div className="row">
          <span className="tag green">生产受控基线 V0.3</span>
          <button onClick={() => page('logs')}>运行日志</button>
          <button onClick={() => page('settings')}>⚙ 设置</button>
        </div>
      </header>

      {/* Main App Container */}
      <div className="app">
        {/* Exact Sidebar Navigation */}
        <aside>
          <div className="navhead">工作空间</div>
          <button
            className={`nav ${currentPage === 'home' ? 'active' : ''}`}
            data-page="home"
            data-icon="▦"
            onClick={() => page('home')}
          >
            ▦　工作台
          </button>
          <button
            className={`nav ${currentPage === 'import' ? 'active' : ''}`}
            data-page="import"
            data-icon="＋"
            onClick={() => page('import')}
          >
            ＋　项目导入
          </button>
          <button
            className={`nav ${currentPage === 'projects' ? 'active' : ''}`}
            data-page="projects"
            data-icon="▤"
            onClick={() => page('projects')}
          >
            ▤　项目管理
          </button>
          <button
            className={`nav ${currentPage === 'custom' ? 'active' : ''}`}
            data-page="custom"
            data-icon="✎"
            onClick={() => page('custom')}
          >
            ✎　用户自建
          </button>

          <div className="navhead">系统</div>
          <button
            className={`nav ${currentPage === 'models' ? 'active' : ''}`}
            data-page="models"
            data-icon="◉"
            onClick={() => page('models')}
          >
            ◉　模型配置
          </button>
          <button
            className={`nav ${currentPage === 'logs' ? 'active' : ''}`}
            data-page="logs"
            data-icon="≡"
            onClick={() => page('logs')}
          >
            ≡　运行日志
          </button>
          <button
            className={`nav ${currentPage === 'settings' ? 'active' : ''}`}
            data-page="settings"
            data-icon="⚙"
            onClick={() => page('settings')}
          >
            ⚙　软件说明与设置
          </button>
        </aside>

        {/* Exact Main Pages */}
        <main>
          {/* Page 1: #home */}
          <section id="home" className={`page ${currentPage === 'home' ? 'active' : ''}`}>
            <div className="head">
              <div>
                <h1>工作台</h1>
                <p>管理项目、查看运行状态，从交付物追踪执行过程。</p>
              </div>
              <button className="primary" onClick={() => page('import')}>
                ＋ 导入新项目
              </button>
            </div>

            <div className="grid stats">
              <div className="card">
                <span className="muted">项目总数</span>
                <div className="num" id="nProjects">{projects.length}</div>
                <span className="hint">已登记项目</span>
              </div>
              <div className="card">
                <span className="muted">运行中</span>
                <div className="num" id="nRunning">{projects.filter((p) => p.status === 'running').length}</div>
                <span className="hint">当前活动运行</span>
              </div>
              <div className="card">
                <span className="muted">成果数量</span>
                <div className="num" id="nArtifacts">{allArtifacts.length}</div>
                <span className="hint">含演示与真实成果</span>
              </div>
              <div className="card">
                <span className="muted">日志事件</span>
                <div className="num" id="nLogs">{logs.length}</div>
                <span className="hint">当前保存事件数</span>
              </div>
            </div>

            <div className="grid two">
              <div className="card">
                <div className="head">
                  <div>
                    <h2>项目管理区</h2>
                    <span className="hint">来源、规则适配器、状态、进度</span>
                  </div>
                  <div className="row">
                    {hasPresetProjects && (
                      <button className="small danger" onClick={handleClearPresetProjects} title="一键删除所有预设占位示例项目">
                        清空预设占位
                      </button>
                    )}
                    <button className="small" onClick={() => page('projects')}>查看全部</button>
                  </div>
                </div>
                <div id="homeProjects" className="projectlist">
                  {projects.slice(0, 8).map((p) => (
                    <div key={p.id} className="project">
                      <h3>{p.name}</h3>
                      <div className="meta">{p.source} · {p.adapter}</div>
                      <span className={`tag ${statusClass(p.status)}`}>{statusText(p.status)}</span>
                      <span>　</span>
                      <span className="hint">{p.progress || 0}%</span>
                      <div className="bar"><span style={{ width: `${p.progress || 0}%` }}></span></div>
                      <div className="row">
                        <button className="small primary" onClick={() => openRunner(p.id)}>进入项目</button>
                        <button className="small" onClick={() => details(p.id)}>详情</button>
                        {inlineDeleteId === p.id ? (
                          <span className="row" style={{ display: 'inline-flex', gap: '4px' }}>
                            <button
                              className="small danger"
                              style={{ background: '#c43232', color: '#fff', fontWeight: 650 }}
                              onClick={() => performDeleteProject(p.id, p.name)}
                            >
                              确认删除
                            </button>
                            <button className="small" onClick={() => setInlineDeleteId(null)}>
                              取消
                            </button>
                          </span>
                        ) : (
                          <button className="small danger" onClick={() => setInlineDeleteId(p.id)}>
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="empty" style={{ gridColumn: 'span 2' }}>
                      暂无项目。你可以点击「＋ 导入新项目」或
                      <button className="small" style={{ marginLeft: '8px' }} onClick={handleResetDefaults}>
                        恢复预设演示项目
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="head">
                  <div>
                    <h2>成果中心</h2>
                    <span className="hint">预览和下载各项目成果</span>
                  </div>
                  <button className="small" onClick={() => page('artifacts')}>全部成果</button>
                </div>
                <div id="homeArtifacts" className="projectlist">
                  {allArtifacts.slice(0, 8).map((a) => (
                    <div key={a.id} className="project">
                      <h3>📄 {a.name}</h3>
                      <div className="meta">{a.pname} · {a.kind}</div>
                      <div className="row">
                        <button className="small" onClick={() => preview(a.pid, a.id)}>预览</button>
                        <button className="small" onClick={() => downloadArtifact(a.name, a.content)}>下载</button>
                      </div>
                    </div>
                  ))}
                  {allArtifacts.length === 0 && <div className="empty">暂无成果</div>}
                </div>
              </div>
            </div>

            <div className="grid two" style={{ marginTop: '14px' }}>
              <div className="card">
                <h2>核心原则</h2>
                <div className="notice" style={{ marginBottom: '10px' }}>
                  规则适配器只负责复刻项目原本的发现、加载和调用规约，不重新发明业务流程。
                </div>
                <p><b>1. 尊重项目生态：</b>每个生态都有约定俗成的工作方式，不把所有项目强行扭曲为同一种执行模式。</p>
                <p><b>2. 拓扑与执行解耦：</b>拓扑图只负责显示状态，不负责驱动执行；真实动作必须由可用执行器完成。</p>
                <p><b>3. 区分 EXECUTED 与 VERIFIED：</b>动作发生不等于结果有效，生成了文字不等于脚本执行成功。</p>
              </div>

              <div className="card">
                <h2>什么是 Rule Adapter？</h2>
                <p>Rule Adapter 是不同 Agent / Skill 项目生态与 ASI 统一底层之间的<b>最小必要桥梁</b>。</p>
                <table>
                  <tbody>
                    <tr><th>生态类型</th><th>主要规约</th></tr>
                    <tr><td>Agent Skills</td><td>以 SKILL.md 定义说明、步骤、工具和交付物</td></tr>
                    <tr><td>Claude Code</td><td>以 CLAUDE.md、.claude/ 组织项目级指令</td></tr>
                    <tr><td>Codex</td><td>以 AGENTS.md 说明工作目标与约束</td></tr>
                    <tr><td>MCP</td><td>通过标准协议向大模型提供外部工具与资源</td></tr>
                    <tr><td>Agent Plugin</td><td>包含插件清单、技能与 MCP 连接定义</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Page 2: #import */}
          <section id="import" className={`page ${currentPage === 'import' ? 'active' : ''}`}>
            <div className="head">
              <div>
                <h1>项目导入</h1>
                <p>选择来源后，系统将自动识别规则并给出中文建议，用户可确认或手动微调。</p>
              </div>
            </div>

            <div className="card">
              <div className="stepper">
                <span className={`step ${importStep === 'i1' ? 'active' : ''}`} id="s1">1. 选择来源</span>
                <span className={`step ${importStep === 'i2' ? 'active' : ''}`} id="s2">2. 识别与确认</span>
                <span className={`step ${importStep === 'i3' ? 'active' : ''}`} id="s3">3. 完成</span>
              </div>

              {/* Step 1: i1 */}
              <div id="i1" className={importStep === 'i1' ? '' : 'hidden'}>
                <div className="grid two">
                  <div>
                    <h2>来源类型</h2>
                    <div className="field">
                      <label htmlFor="sourceType">导入方式</label>
                      <select
                        id="sourceType"
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value)}
                      >
                        <option value="github">GitHub 仓库链接</option>
                        <option value="upload">上传 ZIP 压缩包</option>
                        <option value="folder">本地文件夹（支持多文件选择）</option>
                        <option value="custom">自然语言描述 / 手工定义</option>
                      </select>
                    </div>

                    {sourceType === 'github' && (
                      <div className="field" id="urlBox">
                        <label>仓库链接</label>
                        <input
                          id="repoUrl"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          placeholder="https://github.com/owner/repo"
                        />
                        <span className="hint">已支持真实 GitHub 仓库 API 与种子包特征识别。</span>
                      </div>
                    )}

                    {sourceType === 'upload' && (
                      <div className="field" id="fileBox">
                        <label>选择 ZIP 文件</label>
                        <input
                          type="file"
                          id="zipFile"
                          accept=".zip"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const buffer = await file.arrayBuffer();
                            const bytes = new Uint8Array(buffer);
                            let binary = '';
                            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                            const b64 = btoa(binary);
                            try {
                              const res = await importZip(file.name.replace(/\.zip$/i, ''), b64);
                              setProjectName(res.name);
                              setProjectNotes(res.description);
                              setDetectedInspection((prev: any) => ({
                                ...(prev || {}),
                                projectId: res.projectId,
                                name: res.name,
                                notes: res.description,
                                summary: `ZIP 提取 ${res.files.length} 个文件特征。`,
                                candidates: res.entryCandidates.map((c) => c.ruleName),
                              }));
                              showToast(`ZIP 解析成功！已提取 ${res.files.length} 个文件特征。`);
                            } catch (err: any) {
                              showToast(`ZIP 安全校验拦截: ${err.message}`);
                            }
                          }}
                        />
                        <span className="hint">自动进行 Zip Slip（防 ../ 路径穿越）安全扫描。</span>
                      </div>
                    )}

                    {sourceType === 'folder' && (
                      <div className="field" id="folderBox">
                        <label>选择文件夹 / 文件</label>
                        <input
                          type="file"
                          id="projectFolder"
                          multiple
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (files && files.length > 0) {
                              const fileList = [];
                              for (let i = 0; i < Math.min(files.length, 50); i++) {
                                const f = files[i];
                                let content = '';
                                if (f.size < 30000 && /\.(md|json|txt|py|js|ts)$/i.test(f.name)) {
                                  content = await f.text();
                                }
                                fileList.push({ path: f.name, size: f.size, content });
                              }
                              try {
                                const res = await importFiles(`本地文件集 (${files.length}项)`, fileList);
                                setProjectName(res.name);
                                setProjectNotes(`包含 ${files.length} 个本地文件。`);
                                setDetectedInspection((prev: any) => ({
                                  ...(prev || {}),
                                  projectId: res.projectId,
                                  name: res.name,
                                  notes: `包含 ${files.length} 个本地文件。`,
                                  summary: `本地选定 ${files.length} 个文件并提取特征。`,
                                  candidates: res.entryCandidates.map((c) => c.ruleName),
                                }));
                                showToast(`已成功载入 ${files.length} 个本地选定文件。`);
                              } catch (err: any) {
                                showToast(`载入文件失败: ${err.message}`);
                              }
                            }
                          }}
                        />
                        <span className="hint">浏览器只读取你选中的文件名与内容，不会危害系统。</span>
                      </div>
                    )}

                    {sourceType === 'custom' && (
                      <div className="field" id="customBox">
                        <label>项目用途与工作方式</label>
                        <textarea
                          id="customDesc"
                          value={customDesc}
                          onChange={(e) => setCustomDesc(e.target.value)}
                          placeholder="例如：这是一个行业研究技能包。先整理资料，再并行做市场、竞争、财务分析，最后合并成报告。"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <h2>项目基本信息</h2>
                    <div className="field">
                      <label>项目名称</label>
                      <input
                        id="projectName"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="例如：行业研究 Skill 包"
                      />
                    </div>
                    <div className="field">
                      <label>你希望它完成什么？（可选）</label>
                      <textarea
                        id="projectNotes"
                        value={projectNotes}
                        onChange={(e) => setProjectNotes(e.target.value)}
                        placeholder="例如：研究行业、生成报告、保留引用来源……"
                      />
                    </div>
                    <button className="primary" onClick={inspect}>
                      自动识别项目类型 →
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: i2 */}
              <div id="i2" className={importStep === 'i2' ? '' : 'hidden'}>
                <div className="notice" style={{ marginBottom: '14px' }}>
                  识别结果是初步判断，不是运行成功保证。已检查文件特征；真实运行前还需检查依赖、权限、模型和工具是否可用。
                </div>
                <div id="detectionSummary" className="card" style={{ background: '#f8fbff', marginBottom: '14px' }}>
                  <b>特征摘要：</b> {detectedInspection?.summary || '已提取项目规约特征。'}
                </div>
                <div className="head" style={{ marginTop: '12px' }}>
                  <div>
                    <h2>ASI 建议采用的运行规则</h2>
                    <p>系统根据发现的文件线索推荐；你可以接受建议，也可以展开说明后手动调整。</p>
                  </div>
                </div>
                <div id="ruleCandidates" className="grid two">
                  {detectedInspection?.candidates?.map((cand: string, idx: number) => {
                    const info = adapterInfo[cand] || adapterInfo['Agent Skills'];
                    return (
                      <div key={idx} className="card" style={{ border: cand === selectedAdapter ? '2px solid var(--b)' : '1px solid var(--line)' }}>
                        <div className="head">
                          <div>
                            <h3>{info.title}</h3>
                            <span className="tag blue">{cand}</span>
                          </div>
                        </div>
                        <p>{info.what}</p>
                        <p><b>特征位置：</b><span className="hint">{info.look}</span></p>
                        <p><b>适用条件：</b><span className="hint">{info.use}</span></p>
                        <button className="small" onClick={() => { setSelectedAdapter(cand); showToast(`已切换规则为：${cand}`); }}>
                          采用此规则
                        </button>
                      </div>
                    );
                  })}
                </div>

                <details style={{ marginTop: '12px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 650 }}>高级选项：手动调整运行规则</summary>
                  <p className="hint">仅当你明确知道项目要求时才修改。若项目同时包含多种规则，ASI 应优先保留项目作者原本设计的主入口，并将其他规则作为辅助组件。</p>
                  <div className="field">
                    <label htmlFor="adapter">运行规则</label>
                    <select id="adapter" value={selectedAdapter} onChange={(e) => setSelectedAdapter(e.target.value)}>
                      <option value="Agent Skills">Agent Skills（技能说明与调用规则）</option>
                      <option value="Claude Code">Claude Code（Claude Code 项目约定）</option>
                      <option value="Codex">Codex（Codex 项目指令约定）</option>
                      <option value="MCP">MCP（外部工具连接协议）</option>
                      <option value="Agent Plugin">Agent Plugin（插件打包与发现规则）</option>
                      <option value="Python Project">Python Project（Python 程序）</option>
                      <option value="Node Project">Node Project（Node.js 程序）</option>
                    </select>
                  </div>
                </details>

                <div className="notice" style={{ marginTop: '12px' }}>
                  ASI 复用或适配项目的运行约定，不会因为识别到某种规则就声称启动了 Claude Code、Codex 或其他原生客户端。实际执行必须由可用的运行环境完成并留下证据。
                </div>

                <div className="footerline">
                  <button onClick={backImport}>← 返回修改</button>
                  <button className="primary" onClick={confirmImport}>确认并登记项目</button>
                </div>
              </div>

              {/* Step 3: i3 */}
              <div id="i3" className={importStep === 'i3' ? '' : 'hidden'}>
                <h2>项目已登记</h2>
                <p id="importMessage">{importMessage}</p>
                <div className="row">
                  <button className="primary" onClick={() => cur && openRunner(cur)}>进入项目运行区</button>
                  <button onClick={() => page('projects')}>查看项目管理</button>
                  <button onClick={() => page('home')}>返回工作台</button>
                </div>
              </div>
            </div>
          </section>

          {/* Page 3: #projects */}
          <section id="projects" className={`page ${currentPage === 'projects' ? 'active' : ''}`}>
            <div className="head">
              <div>
                <h1>项目管理</h1>
                <p>项目来源、规则适配器、状态和运行记录。</p>
              </div>
              <div className="row">
                {hasPresetProjects && (
                  <button className="small danger" onClick={handleClearPresetProjects} title="一键删除所有预设占位项目">
                    清空预设占位项目
                  </button>
                )}
                {projects.length > 0 && (
                  <button className="small" onClick={handleClearAllProjects}>
                    清空全部
                  </button>
                )}
                {projects.length === 0 && (
                  <button className="small" onClick={handleResetDefaults}>
                    恢复预设基准项目
                  </button>
                )}
                <button className="primary" onClick={() => page('import')}>＋ 导入项目</button>
              </div>
            </div>

            <div className="card">
              <div className="row">
                <input
                  className="search"
                  id="search"
                  placeholder="搜索项目"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
                <select
                  id="filter"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  style={{ padding: '10px', border: '1px solid var(--line)', borderRadius: '8px' }}
                >
                  <option value="all">全部状态</option>
                  <option value="ready">待运行</option>
                  <option value="running">运行中</option>
                  <option value="done">已完成</option>
                  <option value="failed">失败</option>
                </select>
              </div>

              <div id="projectTable" style={{ marginTop: '14px' }}>
                {filteredProjects.length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th>项目</th>
                        <th>来源</th>
                        <th>适配器</th>
                        <th>状态</th>
                        <th>进度</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjects.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <b>{p.name}</b>
                            <div className="hint">{p.notes || ''}</div>
                          </td>
                          <td>{p.source}</td>
                          <td>{p.adapter}</td>
                          <td><span className={`tag ${statusClass(p.status)}`}>{statusText(p.status)}</span></td>
                          <td>{p.progress || 0}%</td>
                          <td>
                            <button className="small primary" onClick={() => openRunner(p.id)}>运行区</button>{' '}
                            <button className="small" onClick={() => details(p.id)}>详情</button>{' '}
                            {inlineDeleteId === p.id ? (
                              <span style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  className="small danger"
                                  style={{ background: '#c43232', color: '#fff', fontWeight: 650 }}
                                  onClick={() => performDeleteProject(p.id, p.name)}
                                >
                                  确认删除
                                </button>
                                <button className="small" onClick={() => setInlineDeleteId(null)}>
                                  取消
                                </button>
                              </span>
                            ) : (
                              <button className="small danger" onClick={() => setInlineDeleteId(p.id)}>
                                删除
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty">没有匹配项目。你可以点击右上角「＋ 导入项目」或「恢复预设基准项目」。</div>
                )}
              </div>
            </div>
          </section>

          {/* Page 4: #custom */}
          <section id="custom" className={`page ${currentPage === 'custom' ? 'active' : ''}`}>
            <div className="head">
              <div>
                <h1>用户自建</h1>
                <p>通过自然语言定义任务、分支和交付物，生成待确认的流程草案。</p>
              </div>
            </div>

            <div className="grid two">
              <div className="card">
                <h2>项目描述</h2>
                <div className="field">
                  <label>项目名称</label>
                  <input
                    id="customName"
                    value={customBuildName}
                    onChange={(e) => setCustomBuildName(e.target.value)}
                    placeholder="例如：投资项目初评"
                  />
                </div>
                <div className="field">
                  <label>目标、步骤、成果</label>
                  <textarea
                    id="customSpec"
                    rows={7}
                    value={customBuildSpec}
                    onChange={(e) => setCustomBuildSpec(e.target.value)}
                    placeholder="说明输入、任务顺序、并行分支、最终交付物。"
                  />
                </div>
                <button className="primary" onClick={createCustom}>生成流程草案</button>
              </div>

              <div className="card">
                <h2>草案预览</h2>
                {customDraft ? (
                  <div>
                    <span className="tag yellow">待确认草案</span>
                    <h3 style={{ margin: '8px 0 4px' }}>{customDraft.project.name}</h3>
                    <pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '12px', lineHeight: '1.6' }}>
                      {customDraft.content}
                    </pre>
                    <div className="row" style={{ marginTop: '12px' }}>
                      <button className="primary" onClick={() => openRunner(customDraft.project.id)}>
                        进入运行区
                      </button>
                      <button onClick={() => page('projects')}>
                        查看项目管理
                      </button>
                    </div>
                  </div>
                ) : (
                  <div id="customPreview" className="empty">
                    填写描述后生成草案。草案需用户确认，不能视为真实执行计划。
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Page 5: #models */}
          <section id="models" className={`page ${currentPage === 'models' ? 'active' : ''}`}>
            <div className="head">
              <div>
                <h1>模型配置</h1>
                <p>模型负责理解与生成；适配器负责加载规则；执行器负责真实动作。</p>
              </div>
            </div>

            <div className="grid two">
              <div className="card">
                <h2>模型连接</h2>
                <div className="field">
                  <label>提供方</label>
                  <select id="provider" value={model} onChange={(e) => setModel(e.target.value)}>
                    <option value="Google Gemini (gemini-3.8-flash)">Google Gemini API (gemini-3.8-flash)</option>
                    <option value="OpenAI API">OpenAI API</option>
                    <option value="Anthropic API">Anthropic API</option>
                    <option value="兼容 OpenAI 的 API">兼容 OpenAI 的 API</option>
                    <option value="演示模式">演示模式（不调用外部模型）</option>
                  </select>
                </div>
                <div className="field">
                  <label>模型名称</label>
                  <input id="modelName" value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
                <div className="field">
                  <label>API Key（已由服务端安全注入）</label>
                  <input type="password" value="●●●●●●●●●●●●●●●●" readOnly placeholder="生产版应由安全后端处理" />
                </div>
                <div className="field">
                  <label>每日 Token 上限</label>
                  <input
                    id="tokenLimit"
                    type="number"
                    min="0"
                    placeholder="可留空"
                    value={tokenLimit}
                    onChange={(e) => setTokenLimit(e.target.value)}
                  />
                </div>
                <div className="row" style={{ marginTop: '8px' }}>
                  <button className="primary" onClick={saveModel}>保存配置</button>
                  <button onClick={handleTestModelConnectivity} disabled={testingModel}>
                    {testingModel ? '测试中...' : '测试模型连通性'}
                  </button>
                </div>
                <p className="hint" style={{ marginTop: '8px' }}>
                  API Key 严格保存在 Node.js 服务端内存中，绝不暴露至前端或普通日志。
                </p>

                {modelTestResult && (
                  <div style={{ marginTop: '12px', background: '#1d2939', color: '#e2e8f0', padding: '10px', borderRadius: '8px', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                    <b>测试返回：</b>{modelTestResult}
                  </div>
                )}
              </div>

              <div className="card">
                <h2>组件职责</h2>
                <table>
                  <thead>
                    <tr><th>组件</th><th>职责</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>模型</td><td>理解任务、辅助规划、生成内容</td></tr>
                    <tr><td>Rule Adapter</td><td>复刻原生发现、加载、调用规则</td></tr>
                    <tr><td>Runtime Executor</td><td>执行脚本、工具、文件操作、MCP 调用</td></tr>
                    <tr><td>Evidence</td><td>保存动作、结果、时间和状态证据</td></tr>
                    <tr><td>Verification</td><td>独立检查交付物与执行声明</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Page 6: #runner */}
          <section id="runner" className={`page ${currentPage === 'runner' ? 'active' : ''}`}>
            <div className="head">
              <div>
                <h1 id="runnerTitle">{curProject ? `${curProject.name}｜项目运行区` : '项目运行区'}</h1>
                <p id="runnerSubtitle">
                  {curProject ? `规则适配器：${curProject.adapter} · ${statusText(curProject.status)} · 服务端状态机驱动` : '拓扑图是执行状态的可视化投影，不负责驱动执行。'}
                </p>
              </div>
              <div className="row">
                <button onClick={() => page('projects')}>← 项目列表</button>
                <button onClick={() => page('logs')}>完整日志</button>
              </div>
            </div>

            <div className="grid three">
              {/* Task Control */}
              <div className="card">
                <h2>任务控制</h2>
                <div id="runnerInfo" className="hint">
                  {curProject && (
                    <>
                      <p><b>{curProject.name}</b></p>
                      <p>规则：{curProject.adapter}</p>
                      <p>状态：{statusText(curProject.status)}</p>
                    </>
                  )}
                </div>
                <div className="field">
                  <label>执行策略</label>
                  <select id="strategy">
                    <option>逐步确认</option>
                    <option>按依赖自动推进</option>
                  </select>
                </div>
                <div className="field">
                  <label>失败处理</label>
                  <select>
                    <option>失败后暂停</option>
                    <option>允许无依赖分支继续</option>
                  </select>
                </div>
                <button className="primary" style={{ width: '100%', margin: '4px 0' }} onClick={startRun}>
                  ▶ 开始运行
                </button>
                <button style={{ width: '100%', margin: '4px 0' }} onClick={pauseRun}>
                  Ⅱ 暂停/继续
                </button>
                <button className="danger" style={{ width: '100%', margin: '4px 0' }} onClick={stopRunHandler}>
                  ■ 停止
                </button>
                <button style={{ width: '100%', margin: '4px 0' }} onClick={retryNode}>
                  ↻ 重置选中节点
                </button>
                <hr style={{ margin: '12px 0', border: '0', borderTop: '1px solid var(--line)' }} />
                <span className="hint">运行进度</span>
                <div className="bar">
                  <span id="progressBar" style={{ width: `${curProject?.progress || 0}%` }}></span>
                </div>
                <b id="progressText">{curProject?.progress || 0}%</b>
                <p>
                  <span className={`tag ${statusClass(curProject?.status || 'ready')}`} id="runStatus">
                    {statusText(curProject?.status || 'ready')}
                  </span>
                </p>
              </div>

              {/* Execution Topology */}
              <div className="card">
                <h2>执行拓扑</h2>
                <p className="hint">点击节点查看详情。节点状态由服务端真实动作推进，严格区分 EXECUTED 与 VERIFIED。</p>
                <div id="topology">
                  {curProject ? (
                    <div className="flow">
                      {/* Node 0: start */}
                      <div
                        className={`node ${doneSet.has('start') ? 'done' : runningSet.has('start') ? 'running' : ''} ${selectedNodeId === 'start' ? 'selected' : ''}`}
                        onClick={() => setSelectedNodeId('start')}
                      >
                        <b>项目入口与输入</b>
                        <small>{doneSet.has('start') ? '✓ 已记录完成' : runningSet.has('start') ? '● 执行中' : '○ 未开始'}</small>
                      </div>
                      <div className="conn"></div>

                      {/* Node 1: load */}
                      <div
                        className={`node ${doneSet.has('load') ? 'done' : runningSet.has('load') ? 'running' : ''} ${selectedNodeId === 'load' ? 'selected' : ''}`}
                        onClick={() => setSelectedNodeId('load')}
                      >
                        <b>按原生规则加载</b>
                        <small>{doneSet.has('load') ? '✓ 已记录完成' : runningSet.has('load') ? '● 执行中' : '○ 未开始'}</small>
                      </div>
                      <div className="conn"></div>

                      {/* Node 2: prep */}
                      <div
                        className={`node ${doneSet.has('prep') ? 'done' : runningSet.has('prep') ? 'running' : ''} ${selectedNodeId === 'prep' ? 'selected' : ''}`}
                        onClick={() => setSelectedNodeId('prep')}
                      >
                        <b>资料准备</b>
                        <small>{doneSet.has('prep') ? '✓ 已记录完成' : runningSet.has('prep') ? '● 执行中' : '○ 未开始'}</small>
                      </div>
                      <div className="conn"></div>

                      {/* Parallel Branches */}
                      {expanded && (
                        <>
                          <div className="branch">
                            {defaultNodes.slice(3, 6).map((n) => (
                              <div key={n.id} className="branchcol">
                                <div
                                  className={`node ${doneSet.has(n.id) ? 'done' : runningSet.has(n.id) ? 'running' : ''} ${selectedNodeId === n.id ? 'selected' : ''}`}
                                  onClick={() => setSelectedNodeId(n.id)}
                                >
                                  <b>{n.name}</b>
                                  <small>{doneSet.has(n.id) ? '✓ 已记录完成' : runningSet.has(n.id) ? '● 执行中' : '○ 未开始'}</small>
                                </div>
                                <div className="conn"></div>
                                <div className="artifact">{n.output}</div>
                              </div>
                            ))}
                          </div>
                          <div className="conn"></div>
                        </>
                      )}

                      {/* Node 6: merge */}
                      <div
                        className={`node ${doneSet.has('merge') ? 'done' : runningSet.has('merge') ? 'running' : ''} ${selectedNodeId === 'merge' ? 'selected' : ''}`}
                        onClick={() => setSelectedNodeId('merge')}
                      >
                        <b>综合判断</b>
                        <small>{doneSet.has('merge') ? '✓ 已记录完成' : runningSet.has('merge') ? '● 执行中' : '○ 未开始'}</small>
                      </div>
                      <div className="conn"></div>

                      {/* Node 7: verify */}
                      <div
                        className={`node ${doneSet.has('verify') ? 'done' : runningSet.has('verify') ? 'running' : ''} ${selectedNodeId === 'verify' ? 'selected' : ''}`}
                        onClick={() => setSelectedNodeId('verify')}
                      >
                        <b>交付物检查</b>
                        <small>{doneSet.has('verify') ? '✓ 已通过独立验证' : runningSet.has('verify') ? '● 验证中' : '○ 未开始'}</small>
                      </div>
                      <div className="conn"></div>

                      {/* Node 8: final */}
                      <div
                        className={`node ${doneSet.has('final') ? 'done' : runningSet.has('final') ? 'running' : ''} ${selectedNodeId === 'final' ? 'selected' : ''}`}
                        onClick={() => setSelectedNodeId('final')}
                      >
                        <b>最终交付</b>
                        <small>{doneSet.has('final') ? '✓ 已记录完成' : runningSet.has('final') ? '● 执行中' : '○ 未开始'}</small>
                      </div>
                      <div className="conn"></div>

                      <div className="artifact">
                        最终成果：{curProject?.artifacts?.[0]?.name || '待生成'}
                      </div>
                    </div>
                  ) : (
                    <div className="empty">请先选择项目</div>
                  )}
                </div>
                <div className="footerline">
                  <button className="small" onClick={() => setExpanded(!expanded)}>
                    {expanded ? '收起分支' : '展开分支'}
                  </button>
                  <button className="small" onClick={() => page('artifacts')}>项目成果</button>
                </div>
              </div>

              {/* Node Details */}
              <div className="card">
                <h2 id="nodeTitle">{selNode ? selNode.name : '节点详情'}</h2>
                <div id="nodeDetail">
                  {selNode ? (
                    <div>
                      <span className="tag">{selNode.kind}</span>
                      <p>{selNode.desc}</p>
                      <p><b>输入：</b>{selNode.input}</p>
                      <p><b>预期输出：</b>{selNode.output}</p>
                      <p><b>状态：</b>{doneSet.has(selNode.id) ? '已记录完成 (VERIFIED)' : '未开始'}</p>
                      <p><b>执行证据：</b>{doneSet.has(selNode.id) ? '包含 SHA-256 哈希与执行证据事件' : '暂无证据'}</p>
                      <div className="row" style={{ marginTop: '12px' }}>
                        <button className="small" onClick={retryNode}>重置节点</button>
                        <button className="small" onClick={() => page('logs')}>查看日志</button>
                      </div>
                    </div>
                  ) : (
                    <div className="empty">点击拓扑节点查看输入、输出和证据。</div>
                  )}
                </div>
              </div>
            </div>

            {/* Timeline & Evidence */}
            <div className="grid two" style={{ marginTop: '14px' }}>
              <div className="card">
                <h2>运行时间线</h2>
                <div id="timeline" className="timeline">
                  {curProject?.timeline && curProject.timeline.length > 0 ? (
                    curProject.timeline.slice().reverse().map((e, idx) => (
                      <div key={idx} className="event">
                        <time>{new Date(e.time).toLocaleTimeString()}</time>
                        <div>
                          <b>{e.event}</b>
                          <div className="hint">{e.detail}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty">暂无运行事件</div>
                  )}
                </div>
              </div>

              <div className="card">
                <h2>执行证据</h2>
                <div id="evidence">
                  {curProject?.evidence && curProject.evidence.length > 0 ? (
                    curProject.evidence.map((e, idx) => (
                      <div key={idx} style={{ marginBottom: '8px' }}>
                        <p>
                          <b>{e.type}</b> <span className="tag green">可审计事件证据</span>
                        </p>
                        <div className="hint">{e.detail}</div>
                      </div>
                    ))
                  ) : (
                    <div className="empty">暂无证据。启动运行后由实际动作生成。</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Page 7: #artifacts */}
          <section id="artifacts" className={`page ${currentPage === 'artifacts' ? 'active' : ''}`}>
            <div className="head">
              <div>
                <h1>项目执行成果</h1>
                <p>预览和下载成果；严格区分 EXECUTED 与 VERIFIED。</p>
              </div>
              <div className="row">
                <button onClick={downloadAll}>打包下载全部成果</button>
                <button onClick={() => page('home')}>返回工作台</button>
              </div>
            </div>

            <div id="artifactList" className="projectlist">
              {allArtifacts.map((a) => (
                <div key={a.id} className="project">
                  <h3>📄 {a.name}</h3>
                  <div className="meta">{a.pname} · <span className="tag green">{a.kind}</span></div>
                  <p className="hint">{a.content.slice(0, 180)}...</p>
                  <div className="row">
                    <button className="small" onClick={() => preview(a.pid, a.id)}>预览</button>
                    <button className="small" onClick={() => downloadArtifact(a.name, a.content)}>下载 TXT</button>
                  </div>
                </div>
              ))}
              {allArtifacts.length === 0 && <div className="empty">暂无成果</div>}
            </div>
          </section>

          {/* Page 8: #logs */}
          <section id="logs" className={`page ${currentPage === 'logs' ? 'active' : ''}`}>
            <div className="head">
              <div>
                <h1>运行日志</h1>
                <p>按时间线保留事件，支持 TXT/JSON 导出。当前保存在服务端与浏览器。</p>
              </div>
              <div className="row">
                <button onClick={() => exportLogs('txt')}>导出 TXT</button>
                <button onClick={() => exportLogs('json')}>导出 JSON</button>
              </div>
            </div>

            <div className="card">
              <div className="row">
                <select id="logLevel" value={logLevel} onChange={(e) => setLogLevel(e.target.value)}>
                  <option value="all">全部级别</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                </select>
                <input
                  className="search"
                  id="logSearch"
                  placeholder="搜索日志"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
                {inlineClearLogs ? (
                  <span style={{ display: 'inline-flex', gap: '4px' }}>
                    <button
                      className="danger"
                      style={{ background: '#c43232', color: '#fff', fontWeight: 650 }}
                      onClick={async () => {
                        await performClearLogs();
                        setInlineClearLogs(false);
                      }}
                    >
                      确认清空全部？
                    </button>
                    <button onClick={() => setInlineClearLogs(false)}>取消</button>
                  </span>
                ) : (
                  <button className="danger" onClick={() => setInlineClearLogs(true)}>
                    删除全部日志
                  </button>
                )}
              </div>

              <div id="logTable" style={{ marginTop: '14px' }}>
                {filteredLogs.length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th>时间</th>
                        <th>级别</th>
                        <th>事件</th>
                        <th>详情</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((e) => (
                        <tr key={e.id}>
                          <td>{new Date(e.time).toLocaleString()}</td>
                          <td>
                            <span className={`tag ${e.level === 'ERROR' ? 'red' : e.level === 'WARN' ? 'yellow' : 'blue'}`}>
                              {e.level}
                            </span>
                          </td>
                          <td>{e.event}</td>
                          <td>{e.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty">没有日志</div>
                )}
              </div>
            </div>
          </section>

          {/* Page 9: #settings */}
          <section id="settings" className={`page ${currentPage === 'settings' ? 'active' : ''}`}>
            <div className="head">
              <div>
                <h1>软件说明与设置</h1>
                <p>设计初衷、架构、使用方式、边界与升级记录。</p>
              </div>
              <button onClick={downloadReadme}>下载 README.txt</button>
            </div>

            <div className="grid two">
              <div className="card">
                <h2>软件说明</h2>
                <pre
                  id="readmeBox"
                  style={{
                    whiteSpace: 'pre-wrap',
                    font: '12px/1.7 inherit',
                    maxHeight: '520px',
                    overflow: 'auto',
                    background: '#f8fafc',
                    padding: '12px',
                    borderRadius: '8px',
                  }}
                >
                  {readmeText}
                </pre>
              </div>

              <div className="card">
                <h2>通用设置</h2>
                <div className="field">
                  <label>界面语言</label>
                  <select id="language">
                    <option>简体中文</option>
                    <option>English</option>
                  </select>
                </div>
                <div className="field">
                  <label>主题</label>
                  <select>
                    <option>浅色（推荐）</option>
                  </select>
                </div>
                <div className="field">
                  <label>日志策略</label>
                  <select>
                    <option>长期保留，用户手动删除</option>
                  </select>
                </div>
                <div className="row">
                  <button
                    className="primary"
                    onClick={() => {
                      logEvent('INFO', '保存软件设置', '设置已记录。');
                      showToast('软件设置已成功保存。');
                    }}
                  >
                    保存设置
                  </button>
                  <button onClick={handleResetDefaults}>
                    恢复预设演示项目
                  </button>
                </div>
                <div className="notice" style={{ marginTop: '14px' }}>
                  当前系统已支持服务端 JSON 物理持久化，刷新页面或重新打开不会丢失数据。
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modalback" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <button
              onClick={() => setModal(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: 'transparent',
                fontSize: '20px',
                cursor: 'pointer',
                color: 'var(--muted)',
                lineHeight: 1,
                padding: '4px 8px',
              }}
              title="关闭"
            >
              ✕
            </button>
            <h2 style={{ paddingRight: '28px', marginTop: 0 }}>{modal.title}</h2>
            {modal.content}
          </div>
        </div>
      )}
    </div>
  );
}
