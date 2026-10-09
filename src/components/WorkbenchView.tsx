import React from 'react';
import {
  FolderPlus,
  Play,
  FileCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Code2,
  FileText,
} from 'lucide-react';
import { ProjectManifest, CapabilityItem, Artifact } from '../types/asi.js';
import { TabId } from './Navigation.js';

interface WorkbenchViewProps {
  projects: ProjectManifest[];
  capabilities: CapabilityItem[];
  artifacts: Artifact[];
  onNavigate: (tab: TabId) => void;
  onSelectProject: (project: ProjectManifest) => void;
}

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
  projects,
  capabilities,
  artifacts,
  onNavigate,
  onSelectProject,
}) => {
  const availableCaps = capabilities.filter((c) => c.available).length;
  const restrictedCaps = capabilities.filter((c) => !c.available).length;
  const verifiedArtifacts = artifacts.filter((a) => a.verificationStatus === 'VERIFIED').length;

  return (
    <div className="space-y-6">
      {/* Hero Welcome & Principles Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-blue-500/10 to-transparent pointer-events-none" />
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            严谨生产基线 · 拒绝模拟伪执行
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            通用 Agent / Skill 识别、规则适配与受控验证
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            面向非程序员设计的智能项目底座。自动提取项目规约特征、转换标准拓扑计划、在受控安全边界下执行并由独立验证器进行成果审查。
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('import')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-sm"
            >
              <FolderPlus className="w-4 h-4" />
              导入外部项目
            </button>
            <button
              onClick={() => onNavigate('custom')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm backdrop-blur-xs transition-colors"
            >
              <Code2 className="w-4 h-4" />
              自建需求草案
            </button>
            <button
              onClick={() => onNavigate('capabilities')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-medium text-sm transition-colors"
            >
              查看平台能力边界
            </button>
          </div>
        </div>
      </div>

      {/* Real Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>登记项目数</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{projects.length}</div>
          <div className="text-xs text-slate-500 mt-1">包含多生态导入与自建</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>独立复核产物</span>
            <FileCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{verifiedArtifacts}</div>
          <div className="text-xs text-emerald-600 mt-1">已通过 VERIFIED 独立校验</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>可用系统能力</span>
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{availableCaps}</div>
          <div className="text-xs text-slate-500 mt-1">文件静态分析与受控推理</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>受限安全隔离项</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{restrictedCaps}</div>
          <div className="text-xs text-amber-600 mt-1">禁用未隔离任意脚本执行</div>
        </div>
      </div>

      {/* Main Grid: Projects List + Platform Boundaries Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Projects */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">活跃项目清单</h2>
              <p className="text-xs text-slate-500">已就绪的项目可直接进入运行区生成拓扑并执行</p>
            </div>
            <button
              onClick={() => onNavigate('projects')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              查看全部 ({projects.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {projects.slice(0, 4).map((project) => {
              const primaryRule = project.entryCandidates.find((c) => c.isPrimary) || project.entryCandidates[0];
              return (
                <div
                  key={project.projectId}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 rounded-lg px-2 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm truncate">
                        {project.name}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/50 font-medium">
                        {primaryRule ? primaryRule.ruleName : '通用规约'}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        来源: {project.source.kind}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{project.description}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>包含 {project.files.length} 个文件</span>
                      <span>•</span>
                      <span>候选规则 {project.entryCandidates.length} 项</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        onSelectProject(project);
                        onNavigate('runner');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      进入运行区
                    </button>
                    <button
                      onClick={() => {
                        onSelectProject(project);
                        onNavigate('projects');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors"
                    >
                      详情审查
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Platform Boundary Radar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">平台能力与安全准则</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            依据 ASI 契约，工作台严格执行能力注册探测，绝不以虚假状态或随机数冒充真实执行。
          </p>

          <div className="space-y-3 pt-1">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200/60 text-xs space-y-1">
              <div className="font-semibold text-emerald-900 flex items-center justify-between">
                <span>受控静态分析与规约提取</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-200 text-emerald-800 rounded">可用</span>
              </div>
              <p className="text-emerald-700">
                Node.js 服务端支持 ZIP 安全解包（防 Zip Slip）与 AST/文件树特征提取。
              </p>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200/60 text-xs space-y-1">
              <div className="font-semibold text-blue-900 flex items-center justify-between">
                <span>服务端 Gemini 3.8 推理</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-blue-200 text-blue-800 rounded">
                  {capabilities.find((c) => c.capabilityId === 'gemini_model_invocation')?.available ? '已连接' : '降级规则'}
                </span>
              </div>
              <p className="text-blue-700">
                API Key 严格保留在 Node.js 服务端内存中，绝不暴露至前端或日志。
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200/60 text-xs space-y-1">
              <div className="font-semibold text-amber-900 flex items-center justify-between">
                <span>外部脚本隔离沙箱限制</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-amber-200 text-amber-800 rounded">安全限制</span>
              </div>
              <p className="text-amber-700">
                当前运行环境无物理隔离沙箱，禁止直接执行外部不可信脚本，仅开放受控静态审查。
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('capabilities')}
            className="w-full text-center text-xs text-blue-600 hover:text-blue-800 font-medium pt-2 block"
          >
            查看全部能力与限制明细 →
          </button>
        </div>
      </div>
    </div>
  );
};
