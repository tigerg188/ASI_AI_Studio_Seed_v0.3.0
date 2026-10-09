import React from 'react';
import { BookOpen, ShieldCheck, Cpu, Code2, Award } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">软件说明与契约规范</h1>
        <p className="text-sm text-slate-500 mt-1">
          ASI（Agent / Skill Intelligence）产品行为契约、核心架构与施工边界基线。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6 text-xs text-slate-700 leading-relaxed">
        {/* Section 1: Positioning */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            1. 产品定位与目标用户
          </h2>
          <p>
            ASI 是面向非程序员的通用智能项目识别、规则适配、受控执行与成果验证底座。它帮助用户导入、理解、配置、运行和验证不同作者提供的
            Agent、Skill、插件、MCP 与代码项目。
          </p>
          <p>
            用户无需具备编程基础或配置繁复命令行环境。界面默认中文、浅色、清爽、可解释，所有技术规则均提供“它是什么、为什么推荐、适用条件与前置依赖”的中文解释。
          </p>
        </div>

        <hr className="border-slate-100" />

        {/* Section 2: Core Principles */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            2. 严谨工程原则（第一原则）
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>
              <strong>绝不以模拟状态冒充真实执行：</strong> 彻底根除前端随机数、定时器伪造进度与虚假“执行成功”标记。拓扑状态严格由执行器真实事件驱动。
            </li>
            <li>
              <strong>严格区分 EXECUTED 与 VERIFIED：</strong> 执行完成仅代表动作发生；唯有通过独立验证器复核的产物方可授予 VERIFIED。
            </li>
            <li>
              <strong>外部项目视为不可信输入：</strong> ZIP 解压具备 Zip Slip 路径穿越防御与体积上限，禁止外部提示词注入覆盖系统安全边界。
            </li>
            <li>
              <strong>密钥物理隔离：</strong> API Key 仅保留在 Node.js 服务端，绝不下发至前端 bundle、localStorage 或普通日志。
            </li>
          </ul>
        </div>

        <hr className="border-slate-100" />

        {/* Section 3: Architecture Boundaries */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            3. AI Studio 平台能力与安全边界
          </h2>
          <p>
            当前云端 Node.js 环境提供标准文件 I/O、静态 AST 规则分析与基于 <code>@google/genai</code> 的服务端 Gemini 3.8 Flash 推理能力。
          </p>
          <p>
            由于当前容器非专用多租户硬件隔离沙箱，工作台严格限制外部不可信脚本直接原生运行，严禁虚构“Claude Code CLI 已启动”或“Python 脚本已在沙箱中成功运行”。所有限制如实透明列于“模型与环境”注册表中。
          </p>
        </div>

        <hr className="border-slate-100" />

        {/* Section 4: Data & Persistence */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-600" />
            4. 数据持久化与版本信息
          </h2>
          <p>
            当前工程采用服务端安全持久化存储 (<code>.data/asi_store.json</code>)，页面刷新与重新进入不会丢失登记项目、运行实例、拓扑状态及验证成果。
          </p>
          <div className="pt-2 flex items-center gap-4 text-[11px] text-slate-500">
            <span>基线规范: ASI Seed v0.3.0</span>
            <span>•</span>
            <span>前端引擎: React 19 + Tailwind CSS</span>
            <span>•</span>
            <span>服务端: Express 4 + TypeScript</span>
          </div>
        </div>
      </div>
    </div>
  );
};
