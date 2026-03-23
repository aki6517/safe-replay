/**
 * Supabase Edge Functions 用に src を複製し、
 * 相対 import / export の拡張子を .ts へ正規化する。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(PROJECT_ROOT, 'src');
const EDGE_SOURCE_DIR = path.join(PROJECT_ROOT, 'supabase', 'functions', 'safereply', '_src');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isTsFile(filePath) {
  return filePath.endsWith('.ts');
}

function resolveRelativeSpecifier(specifier, sourceFilePath) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return specifier;
  }

  if (
    specifier.endsWith('.ts') ||
    specifier.endsWith('.js') ||
    specifier.endsWith('.mjs') ||
    specifier.endsWith('.cjs') ||
    specifier.endsWith('.json')
  ) {
    return specifier;
  }

  const sourceDir = path.dirname(sourceFilePath);
  const baseResolvedPath = path.resolve(sourceDir, specifier);
  const asTsFile = `${baseResolvedPath}.ts`;
  const asIndexTs = path.join(baseResolvedPath, 'index.ts');

  if (fs.existsSync(asTsFile)) {
    return `${specifier}.ts`;
  }

  if (fs.existsSync(asIndexTs)) {
    const normalized = specifier.endsWith('/') ? specifier.slice(0, -1) : specifier;
    return `${normalized}/index.ts`;
  }

  return `${specifier}.ts`;
}

function rewriteImports(content, sourceFilePath) {
  let output = content.replace(
    /(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (_match, p1, p2, p3) => `${p1}${resolveRelativeSpecifier(p2, sourceFilePath)}${p3}`
  );

  output = output.replace(
    /(export\s+[^'"]*from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (_match, p1, p2, p3) => `${p1}${resolveRelativeSpecifier(p2, sourceFilePath)}${p3}`
  );

  output = output.replace(
    /(import\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g,
    (_match, p1, p2, p3) => `${p1}${resolveRelativeSpecifier(p2, sourceFilePath)}${p3}`
  );

  return output;
}

function copyAndRewriteRecursive(srcDir, dstDir) {
  ensureDir(dstDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);

    if (entry.isDirectory()) {
      copyAndRewriteRecursive(srcPath, dstPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (isTsFile(srcPath)) {
      const original = fs.readFileSync(srcPath, 'utf8');
      const rewritten = rewriteImports(original, srcPath);
      fs.writeFileSync(dstPath, rewritten, 'utf8');
      continue;
    }

    fs.copyFileSync(srcPath, dstPath);
  }
}

function listTsFilesRecursive(dirPath, baseDir) {
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listTsFilesRecursive(entryPath, baseDir));
      continue;
    }

    if (entry.isFile() && isTsFile(entryPath)) {
      results.push(path.relative(baseDir, entryPath));
    }
  }

  return results;
}

function verifySyncedFiles(sourceDir, edgeSourceDir) {
  const sourceTsFiles = listTsFilesRecursive(sourceDir, sourceDir);
  const missingFiles = sourceTsFiles.filter((relativePath) => {
    const edgePath = path.join(edgeSourceDir, relativePath);
    return !fs.existsSync(edgePath);
  });

  if (missingFiles.length > 0) {
    const detail = missingFiles.map((file) => `- ${file}`).join('\n');
    throw new Error(`Edge source sync incomplete. Missing files:\n${detail}`);
  }
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Source directory not found: ${SOURCE_DIR}`);
  }

  fs.rmSync(EDGE_SOURCE_DIR, { recursive: true, force: true });
  copyAndRewriteRecursive(SOURCE_DIR, EDGE_SOURCE_DIR);
  verifySyncedFiles(SOURCE_DIR, EDGE_SOURCE_DIR);
  console.log(`Synced edge source: ${path.relative(PROJECT_ROOT, EDGE_SOURCE_DIR)}`);
}

main();
