/**
 * 代码质量检查器 — 纯静态分析
 *
 * 不打分，只检测问题：
 *  1. 重复代码 — 重复 import、重复属性、重复代码块
 *  2. TypeScript 类型安全 — any/as any 使用
 *  3. 代码规范 — 未使用 import、硬编码、console.log 遗留
 *  4. React 最佳实践 — 内联样式、缺少 key、组件命名
 *  5. 可维护性 — 文件行数、嵌套深度
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CodeQualityAnalysis } from './types.js';

// ========== 1. 重复代码检测 ==========

function checkDuplicates(sources: Map<string, string>): string[] {
  const issues: string[] = [];

  for (const [filePath, content] of sources) {
    const fileName = fileNameFromPath(filePath);

    // 1a. 重复 import 声明
    const importMap = new Map<string, number>();
    const importRegex = /^import\s+.+?\s+from\s+['"](.+?)['"]/gm;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(content)) !== null) {
      const source = m[1];
      importMap.set(source, (importMap.get(source) ?? 0) + 1);
    }
    for (const [source, count] of importMap) {
      if (count > 1) {
        issues.push(`${fileName}: import '${source}' 重复 ${count} 次`);
      }
    }

    // 1b. 重复的对象属性
    const propRegex = /^\s*['"]([\w-]+)['"]\s*:/gm;
    const propMap = new Map<string, number>();
    while ((m = propRegex.exec(content)) !== null) {
      const key = m[1];
      propMap.set(key, (propMap.get(key) ?? 0) + 1);
    }
    for (const [key, count] of propMap) {
      if (count > 1) {
        issues.push(`${fileName}: 对象属性 '${key}' 重复 ${count} 次`);
      }
    }

    // 1c. 重复代码块（≥3 行连续重复）
    const lines = content.split('\n');
    const lineGroups: Map<string, number[]> = new Map();
    for (let i = 0; i < lines.length - 2; i++) {
      const block = lines.slice(i, i + 3).join('\n').trim();
      if (block.length < 20) continue;
      if (!lineGroups.has(block)) lineGroups.set(block, []);
      lineGroups.get(block)!.push(i + 1);
    }
    for (const [block, lineNums] of lineGroups) {
      if (lineNums.length > 1) {
        const preview = block.slice(0, 60).replace(/\n/g, ' ');
        issues.push(`${fileName}: 重复代码块 (${lineNums.length}处): ${preview}...`);
      }
    }
  }

  return issues;
}

// ========== 2. TypeScript 类型安全 ==========

function checkTypeSafety(sources: Map<string, string>): string[] {
  const issues: string[] = [];

  for (const [filePath, content] of sources) {
    const fileName = fileNameFromPath(filePath);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // as any
      const asAnyMatches = line.match(/as\s+any/g);
      if (asAnyMatches) {
        issues.push(`${fileName}:${i + 1}: as any (${asAnyMatches.length}处)`);
      }

      // 显式 any 类型声明
      const anyTypeMatches = line.match(/:\s*any(?!\s*as)/g);
      if (anyTypeMatches) {
        issues.push(`${fileName}:${i + 1}: 显式 any 类型`);
      }
    }
  }

  return issues;
}

// ========== 3. 代码规范 ==========

function checkCodeStyle(sources: Map<string, string>): string[] {
  const issues: string[] = [];

  for (const [filePath, content] of sources) {
    const fileName = fileNameFromPath(filePath);
    const lines = content.split('\n');

    // console.log 遗留
    for (let i = 0; i < lines.length; i++) {
      if (/\bconsole\.log\b/.test(lines[i])) {
        issues.push(`${fileName}:${i + 1}: 遗留 console.log`);
      }
    }

    // 硬编码魔法数字
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(import|export\s+type|export\s+interface|\/\/|\/\*|\*|\})/.test(line)) continue;
      if (/\b(0x[0-9a-fA-F]+|0b[01]+|\d+\.\d+\.\d+)\b/.test(line)) continue;
      const magicNumMatch = line.match(/[=:]\s*(\d{3,})\b/);
      if (magicNumMatch) {
        if (/DAY|TIMEOUT|PORT|WIDTH|HEIGHT|SIZE|MAX|MIN|PIXEL/i.test(line)) continue;
        issues.push(`${fileName}:${i + 1}: 魔法数字 ${magicNumMatch[1]}`);
      }
    }

    // 未使用的 import
    const importLineRegex = /^import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"](.+?)['"]/gm;
    let importMatch: RegExpExecArray | null;
    while ((importMatch = importLineRegex.exec(content)) !== null) {
      const namedImports = importMatch[1];
      const defaultImport = importMatch[2];
      if (namedImports) {
        const names = namedImports.split(',').map(s => s.trim()).filter(Boolean);
        for (const name of names) {
          const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'g');
          const occurrences = (content.match(regex) ?? []).length;
          if (occurrences <= 1) {
            issues.push(`${fileName}: 未使用的 import '${name}'`);
          }
        }
      } else if (defaultImport) {
        const regex = new RegExp(`\\b${escapeRegex(defaultImport)}\\b`, 'g');
        const occurrences = (content.match(regex) ?? []).length;
        if (occurrences <= 1) {
          issues.push(`${fileName}: 未使用的 import '${defaultImport}'`);
        }
      }
    }
  }

  return issues;
}

// ========== 4. React 最佳实践 ==========

function checkReactPractices(sources: Map<string, string>): string[] {
  const issues: string[] = [];

  for (const [filePath, content] of sources) {
    if (!filePath.endsWith('.tsx')) continue;
    const fileName = fileNameFromPath(filePath);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 内联样式
      const inlineStyleMatches = line.match(/style=\{\{/g);
      if (inlineStyleMatches) {
        issues.push(`${fileName}:${i + 1}: 内联 style={{}}`);
      }
    }

    // 列表渲染缺少 key
    if (/\.map\(/.test(content) && !/key=\{/.test(content) && !/key="/.test(content)) {
      issues.push(`${fileName}: .map() 渲染缺少 key`);
    }

    // setTimeout/setInterval 未清理
    if (/setTimeout|setInterval/.test(content)) {
      if (!/clearTimeout|clearInterval/.test(content)) {
        if (/useEffect/.test(content)) {
          issues.push(`${fileName}: useEffect 中 setTimeout/setInterval 未清理`);
        }
      }
    }
  }

  return issues;
}

// ========== 5. 可维护性 ==========

function checkMaintainability(sources: Map<string, string>): string[] {
  const issues: string[] = [];

  for (const [filePath, content] of sources) {
    const fileName = fileNameFromPath(filePath);
    const lines = content.split('\n');

    // 单文件行数 > 300
    if (lines.length > 300) {
      issues.push(`${fileName}: 文件过长 (${lines.length} 行，建议 ≤300)`);
    }

    // 嵌套深度 > 6
    let maxIndent = 0;
    for (const line of lines) {
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      const level = Math.floor(indent / 2);
      if (level > maxIndent) maxIndent = level;
    }
    if (maxIndent > 6) {
      issues.push(`${fileName}: 最大嵌套深度 ${maxIndent} 级（建议 ≤6）`);
    }
  }

  return issues;
}

// ========== 工具函数 ==========

function fileNameFromPath(filePath: string): string {
  const parts = filePath.split('/');
  const pagesIdx = parts.indexOf('pages');
  if (pagesIdx >= 0 && pagesIdx < parts.length - 1) {
    return parts.slice(pagesIdx + 1).join('/');
  }
  return parts[parts.length - 1];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 读取页面目录下所有 .ts/.tsx 文件（排除模板文件） */
function readPageSources(pageDir: string): Map<string, string> {
  const TEMPLATE_FILES = new Set([
    'sdk-setup.ts',
    'app-bootstrap.tsx',
    'page-stage.css',
    'main.tsx',
    'index.html',
  ]);

  const sources = new Map<string, string>();
  try {
    const entries = readdirSync(pageDir);
    for (const entry of entries) {
      if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
      if (TEMPLATE_FILES.has(entry)) continue;
      const fullPath = join(pageDir, entry);
      try {
        const content = readFileSync(fullPath, 'utf-8');
        sources.set(fullPath, content);
      } catch {
        // 跳过无法读取的文件
      }
    }
  } catch {
    // 页面目录不存在
  }
  return sources;
}

// ========== 主入口 ==========

/**
 * 检查代码质量（不打分，只检测问题）
 * @param codeRoot 项目代码根目录
 * @param pageDir 页面目录绝对路径
 */
export function checkCodeQuality(codeRoot: string, pageDir: string | null): CodeQualityAnalysis {
  if (!pageDir) {
    return {
      duplicateIssues: ['未找到页面目录，无法检查'],
      typeSafetyIssues: ['未找到页面目录'],
      codeStyleIssues: ['未找到页面目录'],
      reactPracticeIssues: ['未找到页面目录'],
      maintainabilityIssues: ['未找到页面目录'],
    };
  }

  const sources = readPageSources(pageDir);
  if (sources.size === 0) {
    return {
      duplicateIssues: ['页面目录下无 .ts/.tsx 文件'],
      typeSafetyIssues: ['无代码可分析'],
      codeStyleIssues: ['无代码可分析'],
      reactPracticeIssues: ['无代码可分析'],
      maintainabilityIssues: ['无代码可分析'],
    };
  }

  const dup = checkDuplicates(sources);
  const type = checkTypeSafety(sources);
  const style = checkCodeStyle(sources);
  const react = checkReactPractices(sources);
  const maint = checkMaintainability(sources);

  return {
    duplicateIssues: dup,
    typeSafetyIssues: type,
    codeStyleIssues: style,
    reactPracticeIssues: react,
    maintainabilityIssues: maint,
  };
}
