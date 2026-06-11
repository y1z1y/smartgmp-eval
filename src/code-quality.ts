/**
 * 代码质量检查器 — 纯静态分析
 *
 * 5 个维度（总分50）：
 *  1. 重复代码检测    15分  — 重复 import、重复属性、重复代码块
 *  2. TypeScript 类型安全 10分  — any/as any 使用
 *  3. 代码规范        10分  — 未使用 import、硬编码、console.log 遗留
 *  4. React 最佳实践   10分  — 内联样式、缺少 key、组件命名
 *  5. 可维护性         5分  — 文件行数、嵌套深度
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { CodeQualityScore } from './types.js';

// ========== 1. 重复代码检测（15分） ==========

interface DuplicateResult {
  score: number;
  issues: string[];
}

function checkDuplicates(sources: Map<string, string>): DuplicateResult {
  const issues: string[] = [];
  let score = 15;

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
        score = Math.max(0, score - 5);
      }
    }

    // 1b. 重复的对象属性（如 page-component-props.ts 里重复 key）
    const objectContent = content;
    const propRegex = /^\s*['"]([\w-]+)['"]\s*:/gm;
    const propMap = new Map<string, number>();
    while ((m = propRegex.exec(objectContent)) !== null) {
      const key = m[1];
      propMap.set(key, (propMap.get(key) ?? 0) + 1);
    }
    for (const [key, count] of propMap) {
      if (count > 1) {
        issues.push(`${fileName}: 对象属性 '${key}' 重复 ${count} 次`);
        score = Math.max(0, score - 3);
      }
    }

    // 1c. 重复代码块（≥3 行连续重复）
    const lines = content.split('\n');
    const lineGroups: Map<string, number[]> = new Map();
    for (let i = 0; i < lines.length - 2; i++) {
      const block = lines.slice(i, i + 3).join('\n').trim();
      if (block.length < 20) continue; // 跳过太短的块
      if (!lineGroups.has(block)) lineGroups.set(block, []);
      lineGroups.get(block)!.push(i + 1);
    }
    for (const [block, lineNums] of lineGroups) {
      if (lineNums.length > 1) {
        const preview = block.slice(0, 60).replace(/\n/g, ' ');
        issues.push(`${fileName}: 重复代码块 (${lineNums.length}处): ${preview}...`);
        score = Math.max(0, score - 5);
      }
    }
  }

  return { score, issues };
}

// ========== 2. TypeScript 类型安全（10分） ==========

interface TypeSafetyResult {
  score: number;
  issues: string[];
}

function checkTypeSafety(sources: Map<string, string>): TypeSafetyResult {
  const issues: string[] = [];
  let score = 10;

  for (const [filePath, content] of sources) {
    const fileName = fileNameFromPath(filePath);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 2a. (window as any) 或 as any
      const asAnyMatches = line.match(/as\s+any/g);
      if (asAnyMatches) {
        issues.push(`${fileName}:${i + 1}: as any (${asAnyMatches.length}处)`);
        score = Math.max(0, score - asAnyMatches.length);
      }

      // 2b. 显式 any 类型声明（: any 或 <any>）
      const anyTypeMatches = line.match(/:\s*any(?!\s*as)/g);
      if (anyTypeMatches) {
        issues.push(`${fileName}:${i + 1}: 显式 any 类型`);
        score = Math.max(0, score - anyTypeMatches.length);
      }
    }
  }

  return { score, issues };
}

// ========== 3. 代码规范（10分） ==========

interface CodeStyleResult {
  score: number;
  issues: string[];
}

function checkCodeStyle(sources: Map<string, string>): CodeStyleResult {
  const issues: string[] = [];
  let score = 10;

  for (const [filePath, content] of sources) {
    const fileName = fileNameFromPath(filePath);
    const lines = content.split('\n');

    // 3a. console.log 遗留
    for (let i = 0; i < lines.length; i++) {
      if (/\bconsole\.log\b/.test(lines[i])) {
        issues.push(`${fileName}:${i + 1}: 遗留 console.log`);
        score = Math.max(0, score - 2);
      }
    }

    // 3b. 硬编码魔法数字（在 JSX 外的非导出、非类型声明行中的裸数字）
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 跳过 import、type、interface、注释
      if (/^\s*(import|export\s+type|export\s+interface|\/\/|\/\*|\*|\})/.test(line)) continue;
      // 跳过常见的合法数字（数组下标、版本号、进制等）
      if (/\b(0x[0-9a-fA-F]+|0b[01]+|\d+\.\d+\.\d+)\b/.test(line)) continue;
      // 检测 = 数字 或 : 数字（赋值/属性值中的裸数字，排除 0、1、-1）
      const magicNumMatch = line.match(/[=:]\s*(\d{3,})\b/);
      if (magicNumMatch) {
        // 排除时间戳相关（86400000 等 DAY 常量）、CSS 值
        if (/DAY|TIMEOUT|PORT|WIDTH|HEIGHT|SIZE|MAX|MIN|PIXEL/i.test(line)) continue;
        issues.push(`${fileName}:${i + 1}: 魔法数字 ${magicNumMatch[1]}`);
        score = Math.max(0, score - 1);
      }
    }

    // 3c. 未使用的 import（简单检测：import 了但在文件中只出现一次）
    const importLineRegex = /^import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"](.+?)['"]/gm;
    let importMatch: RegExpExecArray | null;
    while ((importMatch = importLineRegex.exec(content)) !== null) {
      const namedImports = importMatch[1]; // { A, B, C }
      const defaultImport = importMatch[2]; // X
      if (namedImports) {
        const names = namedImports.split(',').map(s => s.trim()).filter(Boolean);
        for (const name of names) {
          // import 的名称在文件中应出现 ≥2 次（import 语句本身 + 使用处）
          const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'g');
          const occurrences = (content.match(regex) ?? []).length;
          if (occurrences <= 1) {
            issues.push(`${fileName}: 未使用的 import '${name}'`);
            score = Math.max(0, score - 2);
          }
        }
      } else if (defaultImport) {
        const regex = new RegExp(`\\b${escapeRegex(defaultImport)}\\b`, 'g');
        const occurrences = (content.match(regex) ?? []).length;
        if (occurrences <= 1) {
          issues.push(`${fileName}: 未使用的 import '${defaultImport}'`);
          score = Math.max(0, score - 2);
        }
      }
    }
  }

  return { score, issues };
}

// ========== 4. React 最佳实践（10分） ==========

interface ReactPracticeResult {
  score: number;
  issues: string[];
}

function checkReactPractices(sources: Map<string, string>): ReactPracticeResult {
  const issues: string[] = [];
  let score = 10;

  for (const [filePath, content] of sources) {
    if (!filePath.endsWith('.tsx')) continue; // 只检查 TSX 文件
    const fileName = fileNameFromPath(filePath);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 4a. 内联样式 style={{...}}
      const inlineStyleMatches = line.match(/style=\{\{/g);
      if (inlineStyleMatches) {
        issues.push(`${fileName}:${i + 1}: 内联 style={{}}`);
        score = Math.max(0, score - 2);
      }
    }

    // 4b. 列表渲染缺少 key（.map( 后面没有 key=）
    const mapWithoutKeyRegex = /\.map\([^)]*\)\s*=>\s*[\s\S]*?(?!key=)/g;
    // 简化检测：有 .map( 但整个文件没有 key= 或 key={
    if (/\.map\(/.test(content) && !/key=\{/.test(content) && !/key="/.test(content)) {
      issues.push(`${fileName}: .map() 渲染缺少 key`);
      score = Math.max(0, score - 3);
    }

    // 4c. setTimeout/setInterval 没有 clearTimeout/clearInterval（在 useEffect 中的）
    if (/setTimeout|setInterval/.test(content)) {
      if (!/clearTimeout|clearInterval/.test(content)) {
        // 检查是否在 useEffect 里
        if (/useEffect/.test(content)) {
          issues.push(`${fileName}: useEffect 中 setTimeout/setInterval 未清理`);
          score = Math.max(0, score - 3);
        }
      }
    }
  }

  return { score, issues };
}

// ========== 5. 可维护性（5分） ==========

interface MaintainabilityResult {
  score: number;
  issues: string[];
}

function checkMaintainability(sources: Map<string, string>): MaintainabilityResult {
  const issues: string[] = [];
  let score = 5;

  for (const [filePath, content] of sources) {
    const fileName = fileNameFromPath(filePath);
    const lines = content.split('\n');

    // 5a. 单文件行数 > 300
    if (lines.length > 300) {
      issues.push(`${fileName}: 文件过长 (${lines.length} 行，建议 ≤300)`);
      score = Math.max(0, score - 2);
    }

    // 5b. 嵌套深度 > 4（简单计数缩进级别）
    let maxIndent = 0;
    for (const line of lines) {
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      // 每 2 个空格算一级缩进
      const level = Math.floor(indent / 2);
      if (level > maxIndent) maxIndent = level;
    }
    if (maxIndent > 6) {
      issues.push(`${fileName}: 最大嵌套深度 ${maxIndent} 级（建议 ≤6）`);
      score = Math.max(0, score - 2);
    }
  }

  return { score, issues };
}

// ========== 工具函数 ==========

function fileNameFromPath(filePath: string): string {
  const parts = filePath.split('/');
  // 取 pages/ 之后的相对路径
  const pagesIdx = parts.indexOf('pages');
  if (pagesIdx >= 0 && pagesIdx < parts.length - 1) {
    return parts.slice(pagesIdx + 1).join('/');
  }
  return parts[parts.length - 1];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 读取页面目录下所有 .ts/.tsx 文件（排除模板文件，只检查 agent 实际写的代码） */
function readPageSources(pageDir: string): Map<string, string> {
  // 模板文件由 new_generate_page 自动生成，不是 agent 写的，排除
  const TEMPLATE_FILES = new Set([
    'sdk-setup.ts',       // SDK mock 注入，全是 as any 是设计如此
    'app-bootstrap.tsx',  // 登录/KOP 初始化，模板代码
    'page-stage.css',     // CSS 不是 TS
    'main.tsx',           // 入口，模板代码
    'index.html',         // HTML 模板
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
 * 检查代码质量
 * @param codeRoot 项目代码根目录（如 .../code）
 * @param pageDir 页面目录绝对路径（如 .../code/src/pages/xxx）
 */
export function checkCodeQuality(codeRoot: string, pageDir: string | null): CodeQualityScore {
  if (!pageDir) {
    return {
      duplicateScore: 0, duplicateIssues: ['未找到页面目录，无法检查'],
      typeSafetyScore: 0, typeSafetyIssues: ['未找到页面目录'],
      codeStyleScore: 0, codeStyleIssues: ['未找到页面目录'],
      reactPracticeScore: 0, reactPracticeIssues: ['未找到页面目录'],
      maintainabilityScore: 0, maintainabilityIssues: ['未找到页面目录'],
      score: 0,
    };
  }

  const sources = readPageSources(pageDir);
  if (sources.size === 0) {
    return {
      duplicateScore: 0, duplicateIssues: ['页面目录下无 .ts/.tsx 文件'],
      typeSafetyScore: 0, typeSafetyIssues: ['无代码可分析'],
      codeStyleScore: 0, codeStyleIssues: ['无代码可分析'],
      reactPracticeScore: 0, reactPracticeIssues: ['无代码可分析'],
      maintainabilityScore: 0, maintainabilityIssues: ['无代码可分析'],
      score: 0,
    };
  }

  console.log(`  [code-quality] 分析 ${sources.size} 个文件`);

  const dup = checkDuplicates(sources);
  const type = checkTypeSafety(sources);
  const style = checkCodeStyle(sources);
  const react = checkReactPractices(sources);
  const maint = checkMaintainability(sources);

  // 打印结果
  console.log(`  [code-quality] 重复代码: ${dup.score}/15 ${dup.issues.length ? '— ' + dup.issues.join('; ') : '✅'}`);
  console.log(`  [code-quality] 类型安全: ${type.score}/10 ${type.issues.length ? '— ' + type.issues.slice(0, 3).join('; ') + (type.issues.length > 3 ? ` +${type.issues.length - 3}更多` : '') : '✅'}`);
  console.log(`  [code-quality] 代码规范: ${style.score}/10 ${style.issues.length ? '— ' + style.issues.join('; ') : '✅'}`);
  console.log(`  [code-quality] React实践: ${react.score}/10 ${react.issues.length ? '— ' + react.issues.join('; ') : '✅'}`);
  console.log(`  [code-quality] 可维护性: ${maint.score}/5 ${maint.issues.length ? '— ' + maint.issues.join('; ') : '✅'}`);

  const total = dup.score + type.score + style.score + react.score + maint.score;
  console.log(`  [code-quality] 总分: ${total}/50`);

  return {
    duplicateScore: dup.score,
    duplicateIssues: dup.issues,
    typeSafetyScore: type.score,
    typeSafetyIssues: type.issues,
    codeStyleScore: style.score,
    codeStyleIssues: style.issues,
    reactPracticeScore: react.score,
    reactPracticeIssues: react.issues,
    maintainabilityScore: maint.score,
    maintainabilityIssues: maint.issues,
    score: total,
  };
}
