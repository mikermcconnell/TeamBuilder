import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_HTML_PATH = 'output/summer-2026/pass-4-nice75/summer-outdoor-2026-exec-review.html';
const DEFAULT_PDF_PATH = 'output/pdf/summer-outdoor-2026-exec-review.pdf';
const DEFAULT_PUBLIC_PDF_PATH = 'public/reports/summer-outdoor-2026-exec-review.pdf';

function parseCliOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) continue;
    options[key] = next;
    index += 1;
  }
  return options;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  return candidates.find(candidate => {
    return existsSync(candidate);
  });
}

export async function printExecReviewHtmlToPdf(options = {}) {
  const htmlPath = path.resolve(options.html ?? DEFAULT_HTML_PATH);
  const pdfPath = path.resolve(options.pdf ?? DEFAULT_PDF_PATH);
  const publicPdfPath = path.resolve(options.publicPdf ?? DEFAULT_PUBLIC_PDF_PATH);
  const chromePath = options.chrome ?? findChrome();

  if (!chromePath) {
    throw new Error('Chrome or Edge was not found. Set CHROME_PATH to a browser executable.');
  }

  await fs.mkdir(path.dirname(pdfPath), { recursive: true });
  await fs.mkdir(path.dirname(publicPdfPath), { recursive: true });
  const userDataDir = path.join(os.tmpdir(), `teambuilder-report-${Date.now()}`);
  await fs.mkdir(userDataDir, { recursive: true });

  const result = spawnSync(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--allow-file-access-from-files',
    `--user-data-dir=${userDataDir}`,
    `--print-to-pdf=${pdfPath}`,
    '--print-to-pdf-no-header',
    '--no-pdf-header-footer',
    pathToFileURL(htmlPath).href,
  ], {
    encoding: 'utf8',
    windowsHide: true,
  });

  await fs.rm(userDataDir, { recursive: true, force: true });

  if (result.status !== 0) {
    throw new Error(`Chrome PDF generation failed: ${result.stderr || result.stdout}`);
  }

  await fs.copyFile(pdfPath, publicPdfPath);
  return { pdfPath, publicPdfPath, chromePath };
}

async function main() {
  const output = await printExecReviewHtmlToPdf(parseCliOptions(process.argv.slice(2)));
  console.log(`PDF written from HTML: ${output.pdfPath}`);
  console.log(`Website PDF copy: ${output.publicPdfPath}`);
  console.log(`Browser used: ${output.chromePath}`);
}

const invokedPath = pathToFileURL(process.argv[1] ?? '').href;
if (import.meta.url === invokedPath) {
  void main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
