import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { getSystemCapabilities } from './server/capabilityRegistry.js';
import { store } from './server/store.js';
import {
  parseZipBuffer,
  parseGitHubRepo,
  createNaturalLanguageProject,
} from './server/scanner.js';
import { detectRules } from './server/ruleDetector.js';
import {
  generateStandardTopology,
  validateTopology,
} from './server/topologyValidator.js';
import { executionEngine } from './server/executor.js';
import { RunInstance, FileItem } from './src/types/asi.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();

  // Support JSON and large payloads for project uploads
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // --- API Routes ---

  // Health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Capabilities
  app.get('/api/capabilities', (req, res) => {
    res.json(getSystemCapabilities());
  });

  // Model status (Server-side check only; never leaks API Key to browser)
  app.get('/api/model/status', (req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
    res.json({
      provider: 'Google Gemini',
      model: 'gemini-3.8-flash',
      configured: hasKey,
      keyMask: hasKey ? 'AIza***已注入服务端***' : '未配置',
      fallbackAvailable: true,
      fallbackName: 'ASI 内置确定性规则适配引擎',
    });
  });

  // Test prompt with server-side SDK
  app.post('/api/model/test-prompt', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: '未配置 GEMINI_API_KEY，模型调用不可用。已安全降级为规则分析。',
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error('[Model API Error]:', err);
      res.status(500).json({ error: err.message || '模型调用失败' });
    }
  });

  // Projects CRUD
  app.get('/api/projects', (req, res) => {
    res.json(store.getProjects());
  });

  app.get('/api/projects/:id', (req, res) => {
    const project = store.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: '项目未找到' });
    res.json(project);
  });

  app.delete('/api/projects/:id', (req, res) => {
    const ok = store.deleteProject(req.params.id);
    res.json({ success: true, deleted: ok });
  });

  app.delete('/api/projects', (req, res) => {
    store.clearAllProjects();
    res.json({ success: true });
  });

  app.post('/api/projects/clear-preset', (req, res) => {
    const count = store.clearPresetProjects();
    res.json({ success: true, count, remaining: store.getProjects() });
  });

  app.post('/api/projects/reset-defaults', (req, res) => {
    store.reseedDefaults();
    res.json({ success: true, projects: store.getProjects() });
  });

  // Import: GitHub
  app.post('/api/projects/import-github', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: '请提供有效的 GitHub 仓库地址' });
      const project = await parseGitHubRepo(url);
      store.saveProject(project);
      res.json(project);
    } catch (err: any) {
      res.status(400).json({ error: err.message || '导入 GitHub 仓库失败' });
    }
  });

  // Import: ZIP (base64 payload)
  app.post('/api/projects/import-zip', async (req, res) => {
    try {
      const { base64, name } = req.body;
      if (!base64) return res.status(400).json({ error: '请提供 ZIP 压缩包数据' });
      const buffer = Buffer.from(base64, 'base64');
      const project = await parseZipBuffer(buffer, name || '导入的 ZIP 项目');
      store.saveProject(project);
      res.json(project);
    } catch (err: any) {
      res.status(400).json({ error: err.message || '解析 ZIP 压缩包失败' });
    }
  });

  // Import: Browser selected files
  app.post('/api/projects/import-files', (req, res) => {
    try {
      const { name, files } = req.body as { name: string; files: Array<{ path: string; content?: string; size: number }> };
      if (!files || files.length === 0) {
        return res.status(400).json({ error: '未选择任何有效文件' });
      }

      const fileItems: FileItem[] = files.map((f) => {
        const signals: string[] = [];
        if (f.path.toLowerCase().endsWith('skill.md')) signals.push('skill_doc');
        if (f.path.toLowerCase().endsWith('package.json')) signals.push('node_manifest');
        if (f.path.toLowerCase().endsWith('requirements.txt')) signals.push('python_deps');
        if (f.path.toLowerCase().includes('mcp')) signals.push('mcp_spec');

        return {
          path: f.path,
          size: f.size || (f.content ? Buffer.byteLength(f.content, 'utf-8') : 0),
          signals,
          contentPreview: f.content ? f.content.slice(0, 3000) : undefined,
        };
      });

      const projectId = `proj-files-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const capabilities = getSystemCapabilities();
      const entryCandidates = detectRules(fileItems);

      const project = {
        projectId,
        name: name || '用户上传项目',
        description: `包含 ${fileItems.length} 个本地选定文件。已完成受控静态审查。`,
        source: { kind: 'files' as const },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'READY' as const,
        files: fileItems,
        capabilities,
        entryCandidates,
        selectedRuleId: entryCandidates[0]?.ruleId,
      };

      store.saveProject(project);
      res.json(project);
    } catch (err: any) {
      res.status(400).json({ error: err.message || '导入文件列表失败' });
    }
  });

  // Import: Natural language / User custom
  app.post('/api/projects/import-text', (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name || !description) {
        return res.status(400).json({ error: '请提供项目名称与需求描述' });
      }
      const project = createNaturalLanguageProject(name, description);
      store.saveProject(project);
      res.json(project);
    } catch (err: any) {
      res.status(400).json({ error: err.message || '生成自建项目失败' });
    }
  });

  // Rule Detection trigger
  app.post('/api/projects/:id/detect-rules', (req, res) => {
    const project = store.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: '项目未找到' });

    project.entryCandidates = detectRules(project.files, project.description);
    project.selectedRuleId = project.entryCandidates[0]?.ruleId;
    project.updatedAt = new Date().toISOString();
    store.saveProject(project);
    res.json(project);
  });

  // Plan Generation & Validation
  app.post('/api/projects/:id/plan', (req, res) => {
    const project = store.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: '项目未找到' });

    const topology = generateStandardTopology(project.projectId, project.selectedRuleId, project.name);
    const validation = validateTopology(topology, project.capabilities);

    res.json({
      topology,
      validation,
    });
  });

  // Runs & Execution
  app.get('/api/runs', (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    res.json(store.getRuns(projectId));
  });

  app.get('/api/runs/:runId', (req, res) => {
    const run = store.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: '运行实例未找到' });
    res.json(run);
  });

  app.post('/api/runs/start', async (req, res) => {
    const { projectId, strategy } = req.body;
    const project = store.getProject(projectId);
    if (!project) return res.status(404).json({ error: '项目未找到' });

    const topology = generateStandardTopology(project.projectId, project.selectedRuleId, project.name);
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const runInstance: RunInstance = {
      runId,
      projectId: project.projectId,
      planId: topology.planId,
      status: 'QUEUED',
      strategy: strategy || 'auto_dependency',
      startedAt: new Date().toISOString(),
      progressPercent: 0,
      totalNodes: topology.nodes.length,
      executedNodes: 0,
      verifiedNodes: 0,
      failedNodes: 0,
      topology,
    };

    store.saveRun(runInstance);

    // 启动受控执行
    executionEngine.startRun(project, runInstance, strategy || 'auto_dependency').catch((err) => {
      console.error('[Execution Engine] Uncaught error during run:', err);
    });

    res.json(runInstance);
  });

  app.post('/api/runs/:runId/step', async (req, res) => {
    const { nodeId } = req.body;
    const run = store.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: '运行实例未找到' });
    const project = store.getProject(run.projectId);
    if (!project) return res.status(404).json({ error: '关联项目未找到' });

    const node = await executionEngine.executeSingleNode(project, run, nodeId);
    if (!node) return res.status(404).json({ error: '指定节点不存在' });

    res.json({ node, run });
  });

  app.post('/api/runs/:runId/stop', (req, res) => {
    const stopped = executionEngine.stopRun(req.params.runId);
    res.json({ success: stopped });
  });

  // Events
  app.get('/api/events', (req, res) => {
    const runId = req.query.runId as string | undefined;
    res.json(store.getEvents(runId));
  });

  app.delete('/api/events', (req, res) => {
    store.clearEvents();
    res.json({ success: true });
  });

  // Artifacts
  app.get('/api/artifacts', (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    res.json(store.getArtifacts(projectId));
  });

  app.get('/api/artifacts/:id', (req, res) => {
    const art = store.getArtifact(req.params.id);
    if (!art) return res.status(404).json({ error: '成果未找到' });
    res.json(art);
  });

  // Log Export (JSON or readable TXT)
  app.get('/api/logs/export', (req, res) => {
    const format = req.query.format === 'json' ? 'json' : 'txt';
    const events = store.getEvents();

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="asi_execution_events.json"');
      return res.send(JSON.stringify(events, null, 2));
    }

    let txt = '================ ASI 运行事件审计日志 ================\n';
    txt += `导出时间: ${new Date().toISOString()}\n`;
    txt += `事件总数: ${events.length}\n`;
    txt += '====================================================\n\n';

    for (const ev of events) {
      txt += `[${ev.timestamp}] [${ev.eventType.toUpperCase()}] [${ev.status}]\n`;
      txt += `来源: ${ev.source} | 动作: ${ev.action}\n`;
      if (ev.nodeId) txt += `节点: ${ev.nodeId}\n`;
      if (ev.durationMs !== undefined && ev.durationMs !== null) txt += `耗时: ${ev.durationMs}ms\n`;
      if (ev.outputSummary) txt += `摘要: ${ev.outputSummary}\n`;
      if (ev.errorCode) txt += `错误代码: ${ev.errorCode}\n`;
      txt += '----------------------------------------------------\n';
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="asi_execution_events.txt"');
    res.send(txt);
  });

  // --- Frontend integration ---
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ASI Server] Running on http://0.0.0.0:${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[ASI Server] Fatal startup error:', err);
  process.exit(1);
});
