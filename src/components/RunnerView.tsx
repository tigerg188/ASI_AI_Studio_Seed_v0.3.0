import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ChevronRight,
  Layers,
  FileCheck,
  Sparkles,
  Award,
} from 'lucide-react';
import {
  ProjectManifest,
  RunInstance,
  TopologyNode,
  ExecutionTopology,
  ExecutionEvent,
} from '../types/asi.js';
import { fetchPlan, startRun, stopRun, stepRun, fetchRun, fetchEvents } from '../api/client.js';

interface RunnerViewProps {
  project?: ProjectManifest;
  onNavigateToArtifacts: () => void;
  onNavigateToProjects: () => void;
}

export const RunnerView: React.FC<RunnerViewProps> = ({
  project,
  onNavigateToArtifacts,
  onNavigateToProjects,
}) => {
  const [topology, setTopology] = useState<ExecutionTopology | null>(null);
  const [validationIssues, setValidationIssues] = useState<any[]>([]);
  const [currentRun, setCurrentRun] = useState<RunInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [strategy, setStrategy] = useState<'step_by_step' | 'auto_dependency'>('auto_dependency');
  const [loading, setLoading] = useState(false);
  const [pollInterval, setPollInterval] = useState<any>(null);

  // Initialize or load plan for project
  useEffect(() => {
    if (!project) return;
    setLoading(true);
    fetchPlan(project.projectId)
      .then((data) => {
        setTopology(data.topology);
        setValidationIssues(data.validation?.issues || []);
        if (data.topology.nodes.length > 0) {
          setSelectedNode(data.topology.nodes[0]);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [project]);

  // Polling for active run updates
  useEffect(() => {
    if (!currentRun || (currentRun.status !== 'RUNNING' && currentRun.status !== 'QUEUED')) {
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await fetchRun(currentRun.runId);
        setCurrentRun(updated);
        setTopology(updated.topology);
        if (selectedNode) {
          const matched = updated.topology.nodes.find((n) => n.nodeId === selectedNode.nodeId);
          if (matched) setSelectedNode(matched);
        }

        const evs = await fetchEvents(currentRun.runId);
        setEvents(evs);

        if (updated.status !== 'RUNNING' && updated.status !== 'QUEUED') {
          clearInterval(interval);
          setPollInterval(null);
        }
      } catch (err) {
        console.error('[Runner Poll Error]:', err);
      }
    }, 1000);

    setPollInterval(interval);
    return () => clearInterval(interval);
  }, [currentRun?.runId, currentRun?.status]);

  if (!project) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4">
        <Layers className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">尚未选择待运行项目</h2>
        <p className="text-xs text-slate-500">
          请在项目管理列表或工作台中选择一个已登记的 Agent / Skill 项目进入运行区。
        </p>
        <button
          onClick={onNavigateToProjects}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
        >
          前往项目管理
        </button>
      </div>
    );
  }

  const handleStart = async () => {
    setLoading(true);
    try {
      const run = await startRun(project.projectId, strategy);
      setCurrentRun(run);
      setTopology(run.topology);
      const evs = await fetchEvents(run.runId);
      setEvents(evs);
    } catch (err: any) {
      alert(`启动执行失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!currentRun) return;
    try {
      await stopRun(currentRun.runId);
    } catch (err: any) {
      alert(`停止失败: ${err.message}`);
    }
  };

  const handleStep = async (nodeId: string) => {
    if (!currentRun) return;
    setLoading(true);
    try {
      const res = await stepRun(currentRun.runId, nodeId);
      setCurrentRun(res.run);
      setTopology(res.run.topology);
      setSelectedNode(res.node);
      const evs = await fetchEvents(currentRun.runId);
      setEvents(evs);
    } catch (err: any) {
      alert(`单步执行失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getNodeStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">VERIFIED 验证通过</span>;
      case 'EXECUTED':
        return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">EXECUTED 已执行</span>;
      case 'RUNNING':
        return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold animate-pulse">RUNNING 运行中</span>;
      case 'BLOCKED':
        return <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">BLOCKED 依赖阻塞</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">FAILED 失败</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">CANCELLED 取消</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">READY 待运行</span>;
    }
  };

  const nodes = topology?.nodes || [];
  const progress = currentRun ? currentRun.progressPercent : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200/50">
              {project.entryCandidates.find((c) => c.isPrimary)?.ruleName || '通用规约'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            拓扑图为受控状态机驱动的可视化映射；状态由真实动作推进，严格区分 EXECUTED 与 VERIFIED。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateToProjects}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium"
          >
            ← 项目列表
          </button>
          <button
            onClick={onNavigateToArtifacts}
            className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            查看成果
          </button>
        </div>
      </div>

      {/* Control Bar & Progress */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Controls Card */}
        <div className="md:col-span-1 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">执行策略与控制</h3>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-500">调度策略</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as any)}
              disabled={currentRun?.status === 'RUNNING'}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="auto_dependency">按依赖自动受控推进</option>
              <option value="step_by_step">单步确认调试模式</option>
            </select>
          </div>

          <div className="space-y-2 pt-2">
            {(!currentRun || currentRun.status !== 'RUNNING') ? (
              <button
                onClick={handleStart}
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                {currentRun ? '重新启动受控执行' : '开始受控执行'}
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                中止 / 取消当前执行
              </button>
            )}

            {strategy === 'step_by_step' && currentRun && selectedNode && (
              <button
                onClick={() => handleStep(selectedNode.nodeId)}
                disabled={loading || selectedNode.status === 'RUNNING'}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                单步执行选中节点 ({selectedNode.name})
              </button>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Real Progress indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">拓扑推进完成度</span>
              <span className="font-bold text-slate-900">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 text-right">
              状态: <span className="font-semibold text-slate-700">{currentRun?.status || '待启动'}</span>
            </div>
          </div>
        </div>

        {/* Interactive Topology Graph Column */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                执行拓扑有向图 ({nodes.length} 个节点)
              </h3>
              <span className="text-[11px] text-slate-400">点击节点查看入参契约与输出证据</span>
            </div>

            {/* Topology Nodes List with arrows */}
            <div className="space-y-2.5">
              {nodes.map((node, index) => {
                const isSelected = selectedNode?.nodeId === node.nodeId;
                return (
                  <div key={node.nodeId} className="space-y-2">
                    <div
                      onClick={() => setSelectedNode(node)}
                      className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-mono font-bold shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs truncate">{node.name}</div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            类型: {node.nodeType} · 拓扑关系: {node.relationToNext}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">{getNodeStatusBadge(node.status)}</div>
                    </div>

                    {index < nodes.length - 1 && (
                      <div className="flex items-center justify-center text-slate-300 py-0.5">
                        <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                        <span className="text-[9px] text-slate-400 font-mono ml-1">
                          {node.relationToNext}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation Issues if any */}
          {validationIssues.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
              <span className="font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> 拓扑校验声明：
              </span>
              {validationIssues.map((issue, idx) => (
                <div key={idx} className="text-[11px] text-amber-700 pl-4">
                  • {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Node Details Column */}
        <div className="md:col-span-1 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">节点详情与契约</h3>

          {selectedNode ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                <div className="font-bold text-slate-900">{selectedNode.name}</div>
                <div className="text-slate-500 text-[11px]">{selectedNode.description}</div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">当前状态:</span>
                <div>{getNodeStatusBadge(selectedNode.status)}</div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">风险级别:</span>
                <span
                  className={`px-2 py-0.5 rounded-sm font-semibold uppercase ${
                    selectedNode.riskLevel === 'high'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedNode.riskLevel}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">输入契约:</span>
                <div className="space-y-1">
                  {selectedNode.inputs.map((inp, idx) => (
                    <div key={idx} className="bg-slate-50 p-1.5 rounded font-mono text-[11px] text-slate-700">
                      {inp.name}: <span className="text-blue-600">{inp.type}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">所需能力:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.requiredCapabilities.map((cap) => (
                    <span key={cap} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono text-[10px]">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {selectedNode.executedResult && (
                <div>
                  <span className="text-slate-400 block mb-1">执行结果证据:</span>
                  <pre className="p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[10px] overflow-x-auto max-h-40">
                    {JSON.stringify(selectedNode.executedResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-400 text-xs py-10 text-center">请在拓扑中选择节点</div>
          )}
        </div>
      </div>

      {/* Real-time Execution Timeline & Evidence */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">运行时间线与证据流</h3>
          </div>
          <span className="text-xs text-slate-400">已捕获 {events.length} 条审计事件</span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          {events.length > 0 ? (
            <div className="divide-y divide-slate-100 text-xs">
              {events.map((ev) => (
                <div key={ev.eventId} className="p-3 hover:bg-slate-50 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-slate-400 text-[10px]">{ev.timestamp.slice(11, 19)}</span>
                      <span className="font-semibold text-slate-900">{ev.action}</span>
                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] rounded font-mono">
                        {ev.source}
                      </span>
                    </div>
                    {ev.outputSummary && (
                      <p className="text-slate-500 font-mono text-[11px] truncate">{ev.outputSummary}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {ev.durationMs !== undefined && ev.durationMs !== null && (
                      <span className="text-slate-400 text-[10px]">{ev.durationMs}ms</span>
                    )}
                    {getNodeStatusBadge(ev.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              暂无运行事件。点击“开始受控执行”触发动作。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
