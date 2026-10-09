import { CapabilityItem } from '../src/types/asi.js';

export function getSystemCapabilities(): CapabilityItem[] {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);

  return [
    {
      capabilityId: 'read_imported_files',
      name: '受控文件导入与静态扫描',
      available: true,
      reason: '服务端运行在 Node.js 环境，已配置 ZIP 安全解包（防 Zip Slip）与静态结构解析。',
      category: 'core',
    },
    {
      capabilityId: 'static_rule_detection',
      name: '多生态规则可解释识别引擎',
      available: true,
      reason: '内置 Agent Skills、Node.js、Python、MCP、Plugin 等生态规约的特征匹配与证据提取能力。',
      category: 'core',
    },
    {
      capabilityId: 'gemini_model_invocation',
      name: 'Gemini 3.8 Flash 服务端推理',
      available: hasGeminiKey,
      reason: hasGeminiKey
        ? '平台服务端环境变量已自动注入 GEMINI_API_KEY，支持安全调用 @google/genai。'
        : '未检测到 GEMINI_API_KEY，系统将自动降级为确定性规则与本地安全分析引擎。',
      category: 'model',
    },
    {
      capabilityId: 'safe_script_sandbox',
      name: '不可信任意代码强隔离沙箱',
      available: false,
      reason: '当前容器环境属于共享 Node.js 运行时，未配置多租户特权隔离沙箱。为防止主机越权，禁用外部任意脚本的原生执行。',
      category: 'sandbox',
    },
    {
      capabilityId: 'claude_code_cli',
      name: 'Claude Code 命令行工具链',
      available: false,
      reason: '当前云端运行环境未预装 claude-code CLI 二进制与对应授权。',
      category: 'runtime',
    },
    {
      capabilityId: 'codex_cli',
      name: 'Codex 命令行工具链',
      available: false,
      reason: '当前云端运行环境未预装 codex CLI 二进制。',
      category: 'runtime',
    },
    {
      capabilityId: 'mcp_server_stdio',
      name: 'MCP Stdio 本地进程直连',
      available: false,
      reason: '无宿主机本地守护进程管道，暂不支持未受信 MCP 进程直连。',
      category: 'runtime',
    },
    {
      capabilityId: 'host_local_directory',
      name: '宿主机私有绝对目录直读',
      available: false,
      reason: '浏览器跨源安全沙箱限制，无法静默读取用户电脑物理路径，仅支持文件选择器与 ZIP 上传。',
      category: 'core',
    },
    {
      capabilityId: 'independent_verification',
      name: '独立成果验证与结构审查',
      available: true,
      reason: '内置模式校验器与哈希比对工具，可对生成的配置、报告及代码产物进行契约级复核。',
      category: 'core',
    },
  ];
}
