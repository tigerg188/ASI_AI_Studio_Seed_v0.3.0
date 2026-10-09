import {
  ProjectManifest,
  RunInstance,
  ExecutionEvent,
  Artifact,
  CapabilityItem,
  ExecutionTopology,
} from '../types/asi.js';

export async function fetchCapabilities(): Promise<CapabilityItem[]> {
  const res = await fetch('/api/capabilities');
  if (!res.ok) throw new Error('获取系统能力注册表失败');
  return res.json();
}

export async function fetchModelStatus(): Promise<{
  provider: string;
  model: string;
  configured: boolean;
  keyMask: string;
  fallbackAvailable: boolean;
  fallbackName: string;
}> {
  const res = await fetch('/api/model/status');
  if (!res.ok) throw new Error('获取模型配置状态失败');
  return res.json();
}

export async function testModelPrompt(prompt: string): Promise<{ text: string }> {
  const res = await fetch('/api/model/test-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '模型测试失败');
  }
  return res.json();
}

export async function fetchProjects(): Promise<ProjectManifest[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('获取项目列表失败');
  return res.json();
}

export async function fetchProject(id: string): Promise<ProjectManifest> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error('获取项目详情失败');
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('删除项目失败');
}

export async function clearAllProjects(): Promise<void> {
  const res = await fetch('/api/projects', { method: 'DELETE' });
  if (!res.ok) throw new Error('清空项目列表失败');
}

export async function clearPresetProjects(): Promise<{ success: boolean; count: number; remaining: ProjectManifest[] }> {
  const res = await fetch('/api/projects/clear-preset', { method: 'POST' });
  if (!res.ok) throw new Error('清理预设项目失败');
  return res.json();
}

export async function resetDefaultProjects(): Promise<{ success: boolean; projects: ProjectManifest[] }> {
  const res = await fetch('/api/projects/reset-defaults', { method: 'POST' });
  if (!res.ok) throw new Error('恢复默认项目失败');
  return res.json();
}

export async function importGitHub(url: string): Promise<ProjectManifest> {
  const res = await fetch('/api/projects/import-github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '导入 GitHub 仓库失败');
  }
  return res.json();
}

export async function importZip(name: string, base64: string): Promise<ProjectManifest> {
  const res = await fetch('/api/projects/import-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, base64 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '导入 ZIP 压缩包失败');
  }
  return res.json();
}

export async function importFiles(
  name: string,
  files: Array<{ path: string; content?: string; size: number }>
): Promise<ProjectManifest> {
  const res = await fetch('/api/projects/import-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, files }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '导入选定文件失败');
  }
  return res.json();
}

export async function importCustomText(name: string, description: string): Promise<ProjectManifest> {
  const res = await fetch('/api/projects/import-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '生成自建项目失败');
  }
  return res.json();
}

export async function reDetectRules(projectId: string): Promise<ProjectManifest> {
  const res = await fetch(`/api/projects/${projectId}/detect-rules`, { method: 'POST' });
  if (!res.ok) throw new Error('重新分析规则失败');
  return res.json();
}

export async function fetchPlan(
  projectId: string
): Promise<{ topology: ExecutionTopology; validation: { valid: boolean; issues: any[] } }> {
  const res = await fetch(`/api/projects/${projectId}/plan`, { method: 'POST' });
  if (!res.ok) throw new Error('生成拓扑计划失败');
  return res.json();
}

export async function startRun(
  projectId: string,
  strategy: 'step_by_step' | 'auto_dependency' = 'auto_dependency'
): Promise<RunInstance> {
  const res = await fetch('/api/runs/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, strategy }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '启动执行失败');
  }
  return res.json();
}

export async function stepRun(runId: string, nodeId: string): Promise<any> {
  const res = await fetch(`/api/runs/${runId}/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId }),
  });
  if (!res.ok) throw new Error('单步执行失败');
  return res.json();
}

export async function stopRun(runId: string): Promise<void> {
  const res = await fetch(`/api/runs/${runId}/stop`, { method: 'POST' });
  if (!res.ok) throw new Error('停止执行失败');
}

export async function fetchRun(runId: string): Promise<RunInstance> {
  const res = await fetch(`/api/runs/${runId}`);
  if (!res.ok) throw new Error('获取运行状态失败');
  return res.json();
}

export async function fetchEvents(runId?: string): Promise<ExecutionEvent[]> {
  const url = runId ? `/api/events?runId=${encodeURIComponent(runId)}` : '/api/events';
  const res = await fetch(url);
  if (!res.ok) throw new Error('获取运行事件失败');
  return res.json();
}

export async function clearEvents(): Promise<void> {
  const res = await fetch('/api/events', { method: 'DELETE' });
  if (!res.ok) throw new Error('清理日志失败');
}

export async function fetchArtifacts(projectId?: string): Promise<Artifact[]> {
  const url = projectId ? `/api/artifacts?projectId=${encodeURIComponent(projectId)}` : '/api/artifacts';
  const res = await fetch(url);
  if (!res.ok) throw new Error('获取执行成果失败');
  return res.json();
}
