import React from 'react';
import {
  LayoutDashboard,
  FolderInput,
  FolderKanban,
  FileCode2,
  Cpu,
  PlayCircle,
  Award,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { ProjectManifest } from '../types/asi.js';

export type TabId =
  | 'workbench'
  | 'import'
  | 'projects'
  | 'custom'
  | 'capabilities'
  | 'runner'
  | 'artifacts'
  | 'logs'
  | 'settings';

interface NavigationProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  activeProject?: ProjectManifest;
  hasModelKey: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  activeProject,
  hasModelKey,
}) => {
  const tabs = [
    { id: 'workbench' as TabId, label: '工作台', icon: LayoutDashboard },
    { id: 'import' as TabId, label: '项目导入', icon: FolderInput },
    { id: 'projects' as TabId, label: '项目管理', icon: FolderKanban },
    { id: 'custom' as TabId, label: '用户自建', icon: FileCode2 },
    { id: 'capabilities' as TabId, label: '模型与环境', icon: Cpu },
    { id: 'runner' as TabId, label: '项目运行区', icon: PlayCircle },
    { id: 'artifacts' as TabId, label: '成果中心', icon: Award },
    { id: 'logs' as TabId, label: '运行日志', icon: ScrollText },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              ASI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                  ASI 智能工作台
                </span>
                <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium border border-blue-200/60">
                  v0.3.0
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Agent / Skill 识别、规则适配与受控验证
              </p>
            </div>
          </div>

          {/* Active project and Model status indicator */}
          <div className="flex items-center gap-2 sm:gap-4">
            {activeProject ? (
              <div
                onClick={() => onSelectTab('runner')}
                className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
                title="当前聚焦项目"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-500">当前项目:</span>
                <span className="text-xs font-semibold text-slate-800 max-w-[120px] sm:max-w-[180px] truncate">
                  {activeProject.name}
                </span>
              </div>
            ) : null}

            <div
              onClick={() => onSelectTab('capabilities')}
              className="cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-xs font-medium hover:bg-emerald-100 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">安全受控基线</span>
              <span>{hasModelKey ? 'Gemini 3.8' : '规则引擎'}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Row */}
        <div className="flex space-x-1 overflow-x-auto py-1 scrollbar-none border-t border-slate-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
