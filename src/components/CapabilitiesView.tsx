import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Key,
  Terminal,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { CapabilityItem } from '../types/asi.js';
import { fetchCapabilities, fetchModelStatus, testModelPrompt } from '../api/client.js';

export const CapabilitiesView: React.FC = () => {
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const [modelStatus, setModelStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testPrompt, setTestPrompt] = useState('请简述通用 Agent 规范的核心价值。');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingModel, setTestingModel] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCapabilities(), fetchModelStatus()])
      .then(([caps, model]) => {
        setCapabilities(caps);
        setModelStatus(model);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleTestPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPrompt.trim()) return;
    setTestingModel(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await testModelPrompt(testPrompt.trim());
      setTestResult(res.text);
    } catch (err: any) {
      setTestError(err.message);
    } finally {
      setTestingModel(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">模型推理与平台能力注册表</h1>
        <p className="text-sm text-slate-500 mt-1">
          透明展示当前 AI Studio 云端运行环境的真实可用能力与安全受限边界，拒绝黑盒与伪造。
        </p>
      </div>

      {/* Model Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">服务端模型推理连接</h2>
              <p className="text-xs text-slate-500">
                严格经由 Node.js 服务端代理调用，API Key 绝不下发至前端或暴露于日志
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              modelStatus?.configured
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {modelStatus?.configured ? 'Gemini 3.8 Flash 已连接' : '降级规则引擎模式'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block">提供方 / 模型标的</span>
            <span className="font-semibold text-slate-800 mt-1 block">
              {modelStatus?.provider || 'Google Gemini'} / {modelStatus?.model || 'gemini-3.8-flash'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block">服务端凭据状态</span>
            <span className="font-mono text-slate-800 mt-1 block">
              {modelStatus?.keyMask || '未配置'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block">零依赖保底策略</span>
            <span className="font-semibold text-slate-800 mt-1 block">
              {modelStatus?.fallbackName || '确定性规则适配引擎'}
            </span>
          </div>
        </div>

        {/* Live Model Test */}
        <form onSubmit={handleTestPrompt} className="pt-2 space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            在线连通性验证（触发真实服务端调用）
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="输入测试提示词..."
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={testingModel}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
            >
              {testingModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {testingModel ? '推理中...' : '测试调用'}
            </button>
          </div>

          {testResult && (
            <div className="p-4 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {testResult}
            </div>
          )}

          {testError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{testError}</span>
            </div>
          )}
        </form>
      </div>

      {/* Capabilities Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">平台执行能力与安全边界清单</h2>
            <p className="text-xs text-slate-500">
              各生态规约（Agent Skills、Node、Python、MCP、Claude Code）根据以下可用能力执行降级或拦截
            </p>
          </div>
          <span className="text-xs text-slate-400">共 {capabilities.length} 项审计标的</span>
        </div>

        <div className="divide-y divide-slate-100">
          {capabilities.map((cap) => (
            <div key={cap.capabilityId} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{cap.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600">
                    {cap.capabilityId}
                  </span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-sm bg-blue-50 text-blue-700 font-medium">
                    {cap.category}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{cap.reason}</p>
              </div>

              <div className="shrink-0">
                {cap.available ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    已就绪可用
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    平台限制/禁用
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
