import crypto from 'node:crypto';
import { Artifact } from '../src/types/asi.js';

export interface VerificationCheck {
  checkName: string;
  passed: boolean;
  detail: string;
}

export interface VerificationResult {
  passed: boolean;
  checks: VerificationCheck[];
  verifiedAt: string;
}

export function verifyArtifact(artifact: Artifact): VerificationResult {
  const checks: VerificationCheck[] = [];

  // Check 1: Content non-empty
  const hasContent = Boolean(artifact.content && artifact.content.trim().length > 0);
  checks.push({
    checkName: '产物内容非空性校验',
    passed: hasContent,
    detail: hasContent ? `产物包含有效内容，长度 ${artifact.content.length} 字符。` : '产物内容为空。',
  });

  // Check 2: SHA256 integrity
  const calculatedSha = crypto.createHash('sha256').update(artifact.content, 'utf-8').digest('hex');
  const shaMatch = calculatedSha === artifact.sha256;
  checks.push({
    checkName: 'SHA-256 数据完整性校验',
    passed: shaMatch,
    detail: shaMatch
      ? `实际哈希值 ${calculatedSha.slice(0, 16)}... 与声明哈希严格一致。`
      : `哈希不匹配！计算值: ${calculatedSha.slice(0, 12)}..., 记录值: ${artifact.sha256.slice(0, 12)}...`,
  });

  // Check 3: Structured format check
  if (artifact.type === 'json' || artifact.type === 'schema') {
    let jsonValid = false;
    try {
      JSON.parse(artifact.content);
      jsonValid = true;
    } catch (e: any) {
      jsonValid = false;
    }
    checks.push({
      checkName: 'JSON 数据结构解析校验',
      passed: jsonValid,
      detail: jsonValid ? 'JSON 语法合法，可正确反序列化。' : 'JSON 格式损坏或包含语法错误。',
    });
  } else if (artifact.type === 'markdown' || artifact.type === 'report') {
    const hasHeaders = /^#+\s+/m.test(artifact.content);
    checks.push({
      checkName: 'Markdown 规范结构标头校验',
      passed: hasHeaders,
      detail: hasHeaders ? '检测到有效的 Markdown 标题层级。' : '未检测到标准的 Markdown 标题标头。',
    });
  }

  // Check 4: Metadata verification
  const validMetadata = Boolean(artifact.artifactId && artifact.nodeId && artifact.runId);
  checks.push({
    checkName: '溯源元数据完整性',
    passed: validMetadata,
    detail: validMetadata ? `来源节点: ${artifact.nodeId}, 关联运行: ${artifact.runId}` : '缺少来源节点或运行追踪 ID。',
  });

  const passed = checks.every((c) => c.passed);

  return {
    passed,
    checks,
    verifiedAt: new Date().toISOString(),
  };
}
