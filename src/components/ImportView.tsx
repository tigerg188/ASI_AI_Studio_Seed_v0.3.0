import React, { useState } from 'react';
import {
  Github,
  FileArchive,
  Files,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { importGitHub, importZip, importFiles } from '../api/client.js';
import { ProjectManifest } from '../types/asi.js';

interface ImportViewProps {
  onImportSuccess: (project: ProjectManifest) => void;
}

export const ImportView: React.FC<ImportViewProps> = ({ onImportSuccess }) => {
  const [activeTab, setActiveTab] = useState<'github' | 'zip' | 'files'>('github');
  const [githubUrl, setGithubUrl] = useState('https://github.com/tigerg188/ASI_AI_Studio_Seed_v0.3.0');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // GitHub Import
  const handleGithubImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) {
      setError('请输入有效的 GitHub 仓库地址');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessInfo(null);
    try {
      const project = await importGitHub(githubUrl.trim());
      setSuccessInfo(`成功导入仓库: ${project.name}，共分析 ${project.files.length} 个文件。`);
      setTimeout(() => onImportSuccess(project), 1000);
    } catch (err: any) {
      setError(err.message || '导入 GitHub 仓库失败');
    } finally {
      setLoading(false);
    }
  };

  // ZIP Import
  const handleZipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('仅支持上传 .zip 格式压缩文件');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const name = projectName.trim() || file.name.replace(/\.zip$/i, '');
      const project = await importZip(name, base64);
      setSuccessInfo(`ZIP 包安全解包通过！防 Zip Slip 校验完毕，提取 ${project.files.length} 个文件。`);
      setTimeout(() => onImportSuccess(project), 1000);
    } catch (err: any) {
      setError(err.message || '解压与导入 ZIP 失败');
    } finally {
      setLoading(false);
    }
  };

  // Browser Files selection
  const handleFolderOrFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setLoading(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const fileList: Array<{ path: string; content?: string; size: number }> = [];

      for (let i = 0; i < Math.min(selectedFiles.length, 100); i++) {
        const f = selectedFiles[i];
        const relativePath = (f as any).webkitRelativePath || f.name;

        let content: string | undefined;
        if (f.size < 50000 && /\.(md|json|txt|py|js|ts|toml|yaml|yml)$/i.test(f.name)) {
          content = await f.text();
        }

        fileList.push({
          path: relativePath,
          size: f.size,
          content,
        });
      }

      const name = projectName.trim() || `选定文件集 (${fileList.length} 个文件)`;
      const project = await importFiles(name, fileList);
      setSuccessInfo(`文件清单导入成功，已就绪 ${project.files.length} 个项目文件。`);
      setTimeout(() => onImportSuccess(project), 1000);
    } catch (err: any) {
      setError(err.message || '文件导入失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">项目导入与规约解析</h1>
        <p className="text-sm text-slate-500 mt-1">
          支持从 GitHub 仓库、安全 ZIP 压缩包或本地文件集导入。系统将自动进行静态特征提取并防范恶意路径穿越。
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setActiveTab('github')}
          className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'github'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Github className="w-4 h-4" />
          GitHub 仓库
        </button>
        <button
          onClick={() => setActiveTab('zip')}
          className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'zip'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileArchive className="w-4 h-4" />
          ZIP 压缩包
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'files'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Files className="w-4 h-4" />
          文件选择器
        </button>
      </div>

      {/* Notice & Security guarantee */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-800">安全合规与解析边界保证：</span>
          <p>
            1. 所有外部项目视为不可信数据，导入仅进行只读特征扫描（检测 SKILL.md、package.json 等）；
            2. ZIP 解包具有严格的 Zip Slip（防 <code>../</code>）防范机制与体积限制（上限 25MB / 500 文件）；
            3. 不在宿主机无沙箱环境下执行任何未知脚本。
          </p>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        {activeTab === 'github' && (
          <form onSubmit={handleGithubImport} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                GitHub 仓库 URL 地址
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                  {loading ? '分析中...' : '提取并识别'}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                支持公开仓库；若触发 GitHub 匿名速率限制，系统会自动切换至规范种子镜像结构。
              </p>
            </div>

            <div className="pt-2">
              <span className="text-xs font-medium text-slate-500">快捷填充示例仓库：</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setGithubUrl('https://github.com/tigerg188/ASI_AI_Studio_Seed_v0.3.0')}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono"
                >
                  ASI Seed v0.3.0 基准项目
                </button>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'zip' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                项目显示名称 (可选)
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="例如：市场情绪分析 Agent"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center transition-colors">
              <FileArchive className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors">
                <span>选择 ZIP 文件</span>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleZipFileChange}
                  disabled={loading}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-400 mt-2">
                支持标准 ZIP 格式，系统将自动校验路径合法性，单包上限 25MB。
              </p>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                项目显示名称 (可选)
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="例如：本地技能套件"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center transition-colors">
              <Files className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors">
                <span>选择本地文件 (支持多选)</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFolderOrFilesChange}
                  disabled={loading}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-400 mt-2">
                可选择多个技能与代码文件，如 SKILL.md、package.json、requirements.txt 等。
              </p>
            </div>
          </div>
        )}

        {/* Feedback Alerts */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successInfo && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successInfo}</span>
          </div>
        )}
      </div>
    </div>
  );
};
