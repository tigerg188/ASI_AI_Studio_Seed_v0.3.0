import React, { useState, useEffect } from 'react';
import {
  Award,
  FileCheck2,
  Download,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { Artifact } from '../types/asi.js';
import { fetchArtifacts } from '../api/client.js';

interface ArtifactsViewProps {
  activeProjectId?: string;
}

export const ArtifactsView: React.FC<ArtifactsViewProps> = ({ activeProjectId }) => {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadArtifacts = () => {
    setLoading(false);
    fetchArtifacts(activeProjectId)
      .then((data) => setArtifacts(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadArtifacts();
  }, [activeProjectId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (artifact: Artifact) => {
    const blob = new Blob([artifact.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = artifact.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">执行成果与独立验证中心</h1>
          <p className="text-sm text-slate-500 mt-1">
            严格区分 EXECUTED（已执行）与 VERIFIED（已验证）。所有成果附带不可篡改的 SHA-256 哈希与独立检验报告。
          </p>
        </div>
        <button
          onClick={loadArtifacts}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium self-start sm:self-auto"
        >
          刷新成果列表
        </button>
      </div>

      {/* Artifacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {artifacts.map((art) => {
          const isVerified = art.verificationStatus === 'VERIFIED';
          return (
            <div
              key={art.artifactId}
              className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-all p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                    <h3 className="font-bold text-slate-900 text-sm truncate">{art.name}</h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1 ${
                      isVerified
                        ? 'bg-emerald-100 text-emerald-800'
                        : art.verificationStatus === 'FAILED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isVerified ? (
                      <>
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        VERIFIED 验证通过
                      </>
                    ) : (
                      'UNVERIFIED 待独立复核'
                    )}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1 font-mono">
                  <div className="text-[11px] text-slate-500">
                    <span className="text-slate-400">来源节点:</span> {art.nodeId}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate" title={art.sha256}>
                    <span className="text-slate-400">SHA-256:</span> {art.sha256.slice(0, 16)}...
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <span className="text-slate-400">体积:</span> {art.sizeBytes} 字节
                  </div>
                </div>

                {art.verificationReport && (
                  <div className="p-2 rounded bg-emerald-50/60 border border-emerald-100 text-[11px] text-emerald-800 space-y-0.5">
                    <div className="font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      独立验证器审查结果:
                    </div>
                    {art.verificationReport.checks.map((c, i) => (
                      <div key={i} className="pl-3 text-[10px] text-emerald-700">
                        ✓ {c.checkName}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setSelectedArtifact(art)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  预览产物
                </button>
                <button
                  onClick={() => handleDownload(art)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载
                </button>
              </div>
            </div>
          );
        })}

        {artifacts.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
            暂无产物。请在“项目运行区”中启动拓扑执行以生成真实分析报告。
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedArtifact.name}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  SHA-256: {selectedArtifact.sha256}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(selectedArtifact.content)}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-white text-slate-600 text-xs flex items-center gap-1"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? '已复制' : '复制全文'}
                </button>
                <button
                  onClick={() => setSelectedArtifact(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs bg-slate-900 text-slate-100 whitespace-pre-wrap leading-relaxed">
              {selectedArtifact.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
