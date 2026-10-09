import fs from 'node:fs';
import path from 'node:path';
import { ProjectManifest, RunInstance, ExecutionEvent, Artifact } from '../src/types/asi.js';

interface StoreData {
  projects: ProjectManifest[];
  runs: RunInstance[];
  events: ExecutionEvent[];
  artifacts: Artifact[];
  hasSeeded?: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'asi_store.json');

class Store {
  private data: StoreData = {
    projects: [],
    runs: [],
    events: [],
    artifacts: [],
    hasSeeded: false,
  };

  constructor() {
    this.load();
    this.seedDefaultsIfEmpty();
  }

  private load(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[Store] Failed to load store, initializing fresh:', err);
    }
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Store] Failed to write store:', err);
    }
  }

  private seedDefaultsIfEmpty(): void {
    if (!this.data.hasSeeded && this.data.projects.length === 0) {
      this.data.hasSeeded = true;
      // Seed initial sample projects strictly tagged as example/demo
      const seedProject: ProjectManifest = {
        projectId: 'proj-seed-asi-01',
        name: 'ASI Seed 规约与多生态基准项目',
        description: '官方种子包示例项目，包含 Agent Skills 规约、MCP 工具配置与 Node.js 启动脚本。',
        source: {
          kind: 'github',
          uri: 'https://github.com/tigerg188/ASI_AI_Studio_Seed_v0.3.0',
          revision: 'v0.3.0',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'READY',
        files: [
          {
            path: 'SKILL.md',
            size: 2450,
            sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            signals: ['skill_entry', 'markdown_spec'],
            contentPreview: '---\nname: asi-core-skill\ndescription: ASI 核心规范执行工具包\n---\n# ASI Core Skill',
          },
          {
            path: 'package.json',
            size: 890,
            sha256: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
            signals: ['node_manifest', 'scripts_defined'],
            contentPreview: '{\n  "name": "asi-agent-seed",\n  "version": "0.3.0",\n  "scripts": { "start": "node server.js" }\n}',
          },
          {
            path: 'mcp.json',
            size: 620,
            sha256: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
            signals: ['mcp_config'],
            contentPreview: '{\n  "mcpServers": {\n    "asi-tools": { "command": "node", "args": ["./dist/index.js"] }\n  }\n}',
          },
          {
            path: 'README.md',
            size: 3200,
            sha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
            signals: ['documentation'],
            contentPreview: '# ASI Agent Seed\n面向通用智能项目识别与受控执行的种子套件。',
          },
        ],
        capabilities: [
          { capabilityId: 'read_imported_files', name: '文件读取', available: true, reason: '文件已解析', category: 'core' },
          { capabilityId: 'static_rule_detection', name: '规则识别', available: true, reason: '特征提取完毕', category: 'core' },
        ],
        entryCandidates: [
          {
            ruleId: 'rule-agent-skills',
            ruleName: 'Agent Skills 生态约定',
            confidenceLevel: 'high',
            isPrimary: true,
            evidence: [
              { path: 'SKILL.md', reason: '根目录检测到标准的 YAML 元数据标头与工具契约声明。' },
            ],
            limitations: ['仅能进行只读规则扫描与任务规划，当前禁止直接在宿主机进行未沙箱化工具调用。'],
            missingPrerequisites: ['需在模型与环境配置中激活服务端模型调用接口。'],
            recommendedNextStep: '执行拓扑规划，生成符合 Skill 契约的任务分析报告与独立验证。',
          },
          {
            ruleId: 'rule-nodejs',
            ruleName: 'Node.js 项目约定',
            confidenceLevel: 'medium',
            isPrimary: false,
            evidence: [
              { path: 'package.json', reason: '检测到项目清单及 "start" 脚本。' },
            ],
            limitations: ['云端为非特权受限容器，不支持执行含有破坏性命令的启动脚本。'],
            missingPrerequisites: ['需检查依赖锁定文件。'],
            recommendedNextStep: '执行只读依赖安全性审计。',
          },
          {
            ruleId: 'rule-mcp',
            ruleName: 'MCP Server / 工具规约',
            confidenceLevel: 'medium',
            isPrimary: false,
            evidence: [
              { path: 'mcp.json', reason: '声明了 MCP 工具与服务定义。' },
            ],
            limitations: ['当前环境不支持 stdio 本地双向管道，仅支持协议格式验证。'],
            missingPrerequisites: ['需本地桥接网关。'],
            recommendedNextStep: '执行 MCP Schema 契约校验。',
          },
        ],
      };

      this.data.projects.push(seedProject);
      this.save();
    }
  }

  // Projects
  getProjects(): ProjectManifest[] {
    return this.data.projects;
  }

  getProject(id: string): ProjectManifest | undefined {
    return this.data.projects.find((p) => p.projectId === id);
  }

  saveProject(project: ProjectManifest): void {
    const idx = this.data.projects.findIndex((p) => p.projectId === project.projectId);
    if (idx >= 0) {
      this.data.projects[idx] = project;
    } else {
      this.data.projects.unshift(project);
    }
    this.save();
  }

  deleteProject(id: string): boolean {
    const before = this.data.projects.length;
    this.data.projects = this.data.projects.filter((p) => p.projectId !== id);
    this.data.runs = this.data.runs.filter((r) => r.projectId !== id);
    this.data.artifacts = this.data.artifacts.filter((a) => a.projectId !== id);
    this.save();
    return this.data.projects.length < before;
  }

  clearAllProjects(): void {
    this.data.projects = [];
    this.data.runs = [];
    this.data.artifacts = [];
    this.data.hasSeeded = true;
    this.save();
  }

  clearPresetProjects(): number {
    const before = this.data.projects.length;
    this.data.projects = this.data.projects.filter(
      (p) =>
        !p.projectId.startsWith('proj-seed') &&
        !p.projectId.startsWith('test-run') &&
        p.projectId !== 'p1' &&
        p.projectId !== 'p2' &&
        p.projectId !== 'p3'
    );
    this.data.hasSeeded = true;
    this.save();
    return before - this.data.projects.length;
  }

  reseedDefaults(): void {
    this.data.hasSeeded = false;
    this.seedDefaultsIfEmpty();
  }

  // Runs
  getRuns(projectId?: string): RunInstance[] {
    if (projectId) {
      return this.data.runs.filter((r) => r.projectId === projectId);
    }
    return this.data.runs;
  }

  getRun(runId: string): RunInstance | undefined {
    return this.data.runs.find((r) => r.runId === runId);
  }

  saveRun(run: RunInstance): void {
    const idx = this.data.runs.findIndex((r) => r.runId === run.runId);
    if (idx >= 0) {
      this.data.runs[idx] = run;
    } else {
      this.data.runs.unshift(run);
    }
    this.save();
  }

  // Events
  getEvents(runId?: string): ExecutionEvent[] {
    if (runId) {
      return this.data.events.filter((e) => e.runId === runId);
    }
    return this.data.events;
  }

  addEvent(event: ExecutionEvent): void {
    this.data.events.push(event);
    this.save();
  }

  clearEvents(): void {
    this.data.events = [];
    this.save();
  }

  // Artifacts
  getArtifacts(projectId?: string): Artifact[] {
    if (projectId) {
      return this.data.artifacts.filter((a) => a.projectId === projectId);
    }
    return this.data.artifacts;
  }

  getArtifact(artifactId: string): Artifact | undefined {
    return this.data.artifacts.find((a) => a.artifactId === artifactId);
  }

  saveArtifact(artifact: Artifact): void {
    const idx = this.data.artifacts.findIndex((a) => a.artifactId === artifact.artifactId);
    if (idx >= 0) {
      this.data.artifacts[idx] = artifact;
    } else {
      this.data.artifacts.unshift(artifact);
    }
    this.save();
  }
}

export const store = new Store();
