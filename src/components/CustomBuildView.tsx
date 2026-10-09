import React, { useState } from 'react';
import { Sparkles, ArrowRight, CheckCircle2, AlertCircle, FileCode2 } from 'lucide-react';
import { importCustomText } from '../api/client.js';
import { ProjectManifest } from '../types/asi.js';

interface CustomBuildViewProps {
  onProjectCreated: (project: ProjectManifest) => void;
}

export const CustomBuildView: React.FC<CustomBuildViewProps> = ({ onProjectCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      setError('请完整填写项目名称与需求描述');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const project = await importCustomText(name.trim(), description.trim());
      onProjectCreated(project);
    } catch (err: any) {
      setError(err.message || '自建项目生成失败');
    } finally {
      setLoading(false);
    }
  };

  const fillTemplate = (tmplName: string, tmplDesc: string) => {
    setName(tmplName);
    setDescription(tmplDesc);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">用户自建项目</h1>
        <p className="text-sm text-slate-500 mt-1">
          通过自然语言定义任务目标、分支顺序与交付物。系统将依据 Agent Skills 规范生成结构化草案。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">项目名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：财报关键指标提取 Agent"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              目标、输入契约、执行步骤与最终交付物说明
            </label>
            <textarea
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="详细说明此 Agent 需要处理的数据输入、必须经历的分析步骤、并行与依赖关系，以及期望生成的报告或配置文件..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              将自动生成 SKILL.md、TASK_SPEC 与 README 规约
            </span>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? '生成中...' : '生成标准项目草案'}
            </button>
          </div>
        </form>

        {/* Templates and Tips */}
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">快捷预置模板</h3>
            <p className="text-xs text-slate-500">点击自动填充结构化需求范例：</p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  fillTemplate(
                    '安全漏洞与依赖审计 Skill',
                    '目标：扫描项目内的依赖清单 (package.json / requirements.txt)，对比已知高危漏洞库，提取可审计的风险项，并生成整改报告。'
                  )
                }
                className="w-full text-left p-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 transition-colors text-xs space-y-1 block"
              >
                <div className="font-semibold text-slate-800">安全漏洞依赖审计</div>
                <div className="text-slate-400 text-[11px] line-clamp-1">依赖合规性与版本安全审查</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  fillTemplate(
                    '多源数据对比与报告合成 Agent',
                    '目标：汇总两份业务报表，执行关键数值对齐与异常差值标记，最后输出 Markdown 格式的核对结论。'
                  )
                }
                className="w-full text-left p-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 transition-colors text-xs space-y-1 block"
              >
                <div className="font-semibold text-slate-800">多源数据比对合成</div>
                <div className="text-slate-400 text-[11px] line-clamp-1">数值对齐与异常报告生成</div>
              </button>
            </div>
          </div>

          <div className="bg-blue-50/60 rounded-xl border border-blue-200/60 p-4 text-xs text-blue-900 space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5 text-blue-800">
              <FileCode2 className="w-4 h-4 text-blue-600" />
              符合 ASI 契约
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              自建项目同样享有完备的拓扑校验与独立验证器审查，绝不跳过安全性与 SHA-256 完整性检验。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
