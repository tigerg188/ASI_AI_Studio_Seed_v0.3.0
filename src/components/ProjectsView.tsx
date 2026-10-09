import React, { useState } from 'react';
import {
  Search,
  Filter,
  Play,
  Trash2,
  RefreshCw,
  FileText,
  FileCheck2,
  AlertTriangle,
  ChevronRight,
  Eye,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { ProjectManifest, EntryCandidate, FileItem } from '../types/asi.js';
import { deleteProject, reDetectRules } from '../api/client.js';

interface ProjectsViewProps {
  projects: ProjectManifest[];
  onSelectProject: (project: ProjectManifest) => void;
  onNavigateToRunner: (project: ProjectManifest) => void;
  onProjectUpdated: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onSelectProject,
  onNavigateToRunner,
  onProjectUpdated,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inspectingProject, setInspectingProject] = useState<ProjectManifest | null>(null);
  const [inspectingFile, setInspectingFile] = useState<FileItem | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`确定删除项目 "${name}" 吗？关联日志与产物也将同步移除。`)) return;
    try {
      await deleteProject(id);
      if (inspectingProject?.projectId === id) setInspectingProject(null);
      onProjectUpdated();
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    }
  };

  const handleReDetect = async (projectId: string) => {
    setLoadingAction(true);
    try {
      const updated = await reDetectRules(projectId);
      setInspectingProject(updated);
      onProjectUpdated();
    } catch (err: any) {
      alert(`重新分析规则失败: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">项目管理与规约审查</h1>
          <p className="text-sm text-slate-500 mt-1">
            查看所有已登记的 Agent / Skill 项目，审查特征证据、置信度评级与前置条件。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索项目名称或描述..."
              className="pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-48 sm:w-64"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="all">全部状态</option>
            <option value="ready">已就绪 (READY)</option>
            <option value="running">运行中 (RUNNING)</option>
            <option value="done">已完成 (DONE)</option>
            <option value="failed">异常 (FAILED)</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((project) => {
          const primaryRule = project.entryCandidates.find((c) => c.isPrimary) || project.entryCandidates[0];
          return (
            <div
              key={project.projectId}
              className="bg-white rounded-xl border border-slate-200 hover:border-blue-400 transition-all p-5 flex flex-col justify-between shadow-xs hover:shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-base line-clamp-1">{project.name}</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium shrink-0">
                    {project.status}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {project.description || '暂无详细描述'}
                </p>

                {/* Rule badge */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">推荐生态规约:</span>
                    <span className="font-semibold text-blue-700">
                      {primaryRule?.ruleName || '通用规则'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>证据点: {primaryRule?.evidence.length || 0} 处</span>
                    <span
                      className={`font-medium ${
                        primaryRule?.confidenceLevel === 'high'
                          ? 'text-emerald-600'
                          : primaryRule?.confidenceLevel === 'medium'
                          ? 'text-blue-600'
                          : 'text-amber-600'
                      }`}
                    >
                      置信等级: {primaryRule?.confidenceLevel || 'unknown'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>文件数: {project.files.length}</span>
                  <span>•</span>
                  <span>来源: {project.source.kind}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setInspectingProject(project)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  审查证据
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDelete(project.projectId, project.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="删除项目"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      onSelectProject(project);
                      onNavigateToRunner(project);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3.5 h-3.5" />
                    进入运行区
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
            没有符合条件的项目。请在“项目导入”中添加新项目。
          </div>
        )}
      </div>

      {/* Inspecting Project Modal */}
      {inspectingProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{inspectingProject.name}</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                    {inspectingProject.source.kind}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{inspectingProject.description}</p>
              </div>
              <button
                onClick={() => setInspectingProject(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Rule Candidates Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">规约候选与可解释证据清单</h3>
                  <button
                    onClick={() => handleReDetect(inspectingProject.projectId)}
                    disabled={loadingAction}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAction ? 'animate-spin' : ''}`} />
                    重新提取规则
                  </button>
                </div>

                <div className="space-y-3">
                  {inspectingProject.entryCandidates.map((c) => (
                    <div
                      key={c.ruleId}
                      className={`p-4 rounded-xl border transition-all ${
                        c.isPrimary
                          ? 'border-blue-300 bg-blue-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{c.ruleName}</span>
                          {c.isPrimary && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-medium text-[10px]">
                              主要入口规则
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-slate-600">
                          置信度: <span className="uppercase text-blue-700">{c.confidenceLevel}</span>
                        </span>
                      </div>

                      {/* Evidence */}
                      <div className="mt-2.5 space-y-1.5">
                        <span className="font-semibold text-slate-700">识别依据与证据位置：</span>
                        {c.evidence.map((ev, i) => (
                          <div key={i} className="pl-3 border-l-2 border-blue-400 text-slate-600">
                            <span className="font-mono text-slate-900 font-medium">{ev.path}</span>: {ev.reason}
                          </div>
                        ))}
                      </div>

                      {/* Limitations */}
                      {c.limitations.length > 0 && (
                        <div className="mt-2.5 space-y-1">
                          <span className="font-semibold text-amber-800">安全限制与边界声明：</span>
                          {c.limitations.map((lim, i) => (
                            <div key={i} className="text-amber-700 flex items-start gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>{lim}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Next Step */}
                      {c.recommendedNextStep && (
                        <div className="mt-2 text-slate-500">
                          <span className="font-semibold text-slate-700">建议下一步：</span>
                          {c.recommendedNextStep}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Files Table Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  项目文件索引 ({inspectingProject.files.length} 个)
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2.5">文件相对路径</th>
                        <th className="p-2.5">大小</th>
                        <th className="p-2.5">特征标记</th>
                        <th className="p-2.5 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspectingProject.files.map((file) => (
                        <tr key={file.path} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-mono text-slate-900">{file.path}</td>
                          <td className="p-2.5 text-slate-500">
                            {file.size > 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`}
                          </td>
                          <td className="p-2.5 text-slate-500">
                            {file.signals?.join(', ') || '-'}
                          </td>
                          <td className="p-2.5 text-right">
                            {file.contentPreview ? (
                              <button
                                onClick={() => setInspectingFile(file)}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                预览内容
                              </button>
                            ) : (
                              <span className="text-slate-300">只读元数据</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                创建时间: {new Date(inspectingProject.createdAt).toLocaleString()}
              </span>
              <button
                onClick={() => {
                  onSelectProject(inspectingProject);
                  onNavigateToRunner(inspectingProject);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5" />
                以当前规则进入运行区
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {inspectingFile && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm font-mono">{inspectingFile.path}</h4>
                <p className="text-[11px] text-slate-400">
                  SHA-256: {inspectingFile.sha256 || '未计算'}
                </p>
              </div>
              <button
                onClick={() => setInspectingFile(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs leading-relaxed">
              {inspectingFile.contentPreview || '（无预览内容）'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
