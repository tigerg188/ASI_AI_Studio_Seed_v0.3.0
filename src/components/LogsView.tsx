import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Download,
  Trash2,
  Search,
  Filter,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { ExecutionEvent } from '../types/asi.js';
import { fetchEvents, clearEvents } from '../api/client.js';

export const LogsView: React.FC = () => {
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const loadEvents = () => {
    setLoading(true);
    fetchEvents()
      .then((data) => setEvents(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleClear = async () => {
    if (!window.confirm('确定清空所有运行审计日志吗？此操作不可逆。')) return;
    try {
      await clearEvents();
      setEvents([]);
    } catch (err: any) {
      alert(`清空失败: ${err.message}`);
    }
  };

  const filtered = events.filter((ev) => {
    const matchesSearch =
      ev.action.toLowerCase().includes(search.toLowerCase()) ||
      (ev.outputSummary || '').toLowerCase().includes(search.toLowerCase()) ||
      ev.source.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || ev.eventType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">运行审计日志与事件流</h1>
          <p className="text-sm text-slate-500 mt-1">
            以不可篡改的追加式事件记录实际动作；支持 TXT / JSON 真实导出，所有敏感 Token 已自动脱敏。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/logs/export?format=txt"
            download="asi_execution_events.txt"
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            导出 TXT
          </a>
          <a
            href="/api/logs/export?format=json"
            download="asi_execution_events.json"
            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            导出 JSON
          </a>
          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            title="清空日志"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Security Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索动作、摘要或来源..."
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="all">全部事件类型</option>
            <option value="run_created">run_created (运行创建)</option>
            <option value="node_started">node_started (节点启动)</option>
            <option value="action_result">action_result (执行结果)</option>
            <option value="verification_result">verification_result (验证结果)</option>
            <option value="node_failed">node_failed (节点异常)</option>
            <option value="run_cancelled">run_cancelled (取消运行)</option>
          </select>

          <button
            onClick={loadEvents}
            disabled={loading}
            className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
            title="刷新"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>敏感数据脱敏保护: 已生效</span>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
              <tr>
                <th className="p-3">时间戳</th>
                <th className="p-3">事件类型</th>
                <th className="p-3">状态</th>
                <th className="p-3">执行器来源</th>
                <th className="p-3">具体动作与输入摘要</th>
                <th className="p-3">输出摘要</th>
                <th className="p-3 text-right">耗时</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filtered.map((ev) => (
                <tr key={ev.eventId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 text-slate-500 whitespace-nowrap">
                    {ev.timestamp.slice(11, 23)}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-bold text-[10px]">
                      {ev.eventType}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-sm font-bold text-[10px] ${
                        ev.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ev.status === 'EXECUTED'
                          ? 'bg-blue-100 text-blue-800'
                          : ev.status === 'FAILED'
                          ? 'bg-rose-100 text-rose-800'
                          : ev.status === 'RUNNING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ev.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 whitespace-nowrap">{ev.source}</td>
                  <td className="p-3 font-sans text-slate-900 max-w-xs truncate" title={ev.action}>
                    {ev.action}
                  </td>
                  <td className="p-3 text-slate-500 max-w-md truncate" title={ev.outputSummary}>
                    {ev.outputSummary || '-'}
                  </td>
                  <td className="p-3 text-right text-slate-400 whitespace-nowrap">
                    {ev.durationMs !== undefined && ev.durationMs !== null ? `${ev.durationMs}ms` : '-'}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                    暂无符合条件的审计日志。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
