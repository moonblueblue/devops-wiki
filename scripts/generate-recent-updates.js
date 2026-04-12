#!/usr/bin/env node

/**
 * generate-recent-updates.js
 *
 * git log를 파싱하여 content/ 디렉토리 내 최근 변경된 .md 파일 10개를 추출하고,
 * 각 파일의 frontmatter title과 경로 기반 카테고리를 읽어
 * content/index.md의 "## 최근 업데이트" 섹션에 마크다운 테이블로 삽입한다.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const INDEX_PATH = path.join(CONTENT_DIR, "index.md");
const MAX_ENTRIES = 10;

// ---------------------------------------------------------------------------
// 1. git log에서 content/ 내 .md 파일의 최근 변경 목록 추출
//    - 같은 파일이 여러 커밋에 등장하면 가장 최근 것만 사용
//    - index.md 제외
// ---------------------------------------------------------------------------
function getRecentChanges() {
  // --diff-filter=d : 삭제된 파일 제외
  // --name-only     : 변경된 파일 경로만 출력
  // --pretty=format : 커밋 날짜를 ISO 형식으로 출력
  const raw = execSync(
    `git -C "${ROOT}" log --diff-filter=d --name-only --pretty=format:"__COMMIT__%H__%ai" -- "content/**/*.md"`,
    { encoding: "utf-8" }
  );

  const seen = new Set();
  const results = [];

  let currentDate = "";

  for (const line of raw.split("\n")) {
    if (line.startsWith("__COMMIT__")) {
      // __COMMIT__<hash>__<date>
      const parts = line.split("__");
      // parts: ["", "COMMIT", "<hash>", "<date>"]
      currentDate = parts[3].slice(0, 10); // YYYY-MM-DD
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith("content/")) continue;
    if (!trimmed.endsWith(".md")) continue;

    // index.md 파일 제외
    if (path.basename(trimmed) === "index.md") continue;

    if (seen.has(trimmed)) continue;
    seen.add(trimmed);

    results.push({ filePath: trimmed, date: currentDate });
    if (results.length >= MAX_ENTRIES) break;
  }

  return results;
}

// ---------------------------------------------------------------------------
// 2. frontmatter에서 title 추출
// ---------------------------------------------------------------------------
function extractTitle(absolutePath) {
  if (!fs.existsSync(absolutePath)) return null;

  const content = fs.readFileSync(absolutePath, "utf-8");
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  return titleMatch ? titleMatch[1] : null;
}

// ---------------------------------------------------------------------------
// 3. 파일 경로에서 카테고리 추출 (content/linux/xxx.md -> Linux)
// ---------------------------------------------------------------------------
function extractCategory(filePath) {
  // filePath: "content/linux/xxx.md"
  const parts = filePath.split("/");
  if (parts.length < 3) return "General";

  const category = parts[1]; // "linux", "kubernetes" 등
  // 첫 글자 대문자화
  return category.charAt(0).toUpperCase() + category.slice(1);
}

// ---------------------------------------------------------------------------
// 4. 마크다운 테이블 생성
// ---------------------------------------------------------------------------
function buildTable(entries) {
  const lines = [
    "| 날짜 | 카테고리 | 글 |",
    "|------|---------|---|",
  ];

  for (const entry of entries) {
    const absolutePath = path.join(ROOT, entry.filePath);
    const title = extractTitle(absolutePath) || path.basename(entry.filePath, ".md");
    const category = extractCategory(entry.filePath);

    // content/index.md 기준 상대 경로
    const relativePath = path.relative(CONTENT_DIR, absolutePath);

    lines.push(`| ${entry.date} | ${category} | [${title}](${relativePath}) |`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 5. index.md의 "## 최근 업데이트" 이후를 교체
// ---------------------------------------------------------------------------
function updateIndex(table) {
  const content = fs.readFileSync(INDEX_PATH, "utf-8");
  const marker = "## 최근 업데이트";
  const idx = content.indexOf(marker);

  if (idx === -1) {
    console.error(`"${marker}" 섹션을 index.md에서 찾을 수 없습니다.`);
    process.exit(1);
  }

  const before = content.slice(0, idx + marker.length);
  const newContent = before + "\n\n" + table + "\n";

  fs.writeFileSync(INDEX_PATH, newContent, "utf-8");
  console.log(`index.md 업데이트 완료 (${table.split("\n").length - 2}건)`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const entries = getRecentChanges();

  if (entries.length === 0) {
    console.log("최근 변경된 콘텐츠 파일이 없습니다.");
    return;
  }

  const table = buildTable(entries);
  updateIndex(table);
}

main();
