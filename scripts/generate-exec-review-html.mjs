import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_JSON_PATH = 'output/summer-2026/pass-4-nice75/summer-outdoor-2026-exec-review.json';
const DEFAULT_HTML_PATH = 'output/summer-2026/pass-4-nice75/summer-outdoor-2026-exec-review.html';
const DEFAULT_PUBLIC_HTML_PATH = 'public/reports/summer-outdoor-2026-exec-review.html';

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function leaderCodes(player) {
  return (player.leaders ?? []).map(leader => {
    const isFemaleLeader = /\bfemale\b/i.test(leader);
    const isMaleLeader = /\bmale\b/i.test(leader);
    const isTierA = /\ba\b/i.test(leader);
    const isTierB = /\bb\b/i.test(leader);
    if (isFemaleLeader && isTierB) return { label: 'FL-B', cls: 'pink' };
    if (isFemaleLeader) return { label: 'FL-A', cls: 'pink' };
    if (isMaleLeader && isTierA) return { label: 'ML-A', cls: 'indigo' };
    if (isMaleLeader && isTierB) return { label: 'ML-B', cls: 'blue' };
    return { label: 'L', cls: 'slate' };
  });
}

function groupLabel(team, playerName) {
  const index = (team.mustPlayGroups ?? []).findIndex(group => group.some(name => name === playerName));
  return index >= 0 ? `Group ${index + 1}` : '';
}

function pill(label, cls = 'slate') {
  if (!label) return '';
  return `<span class="pill ${cls}">${escapeHtml(label)}</span>`;
}

function skillBadgeStyle(skill) {
  const normalized = Math.max(0, Math.min(1, Number(skill) / 10));
  const saturation = Math.round(42 + normalized * 42);
  const lightness = Math.round(90 - normalized * 52);
  const borderLightness = Math.max(24, lightness - 10);
  const textColor = normalized >= 0.55 ? '#ffffff' : '#064e3b';

  return `background:hsl(150 ${saturation}% ${lightness}%);border-color:hsl(150 ${saturation}% ${borderLightness}%);color:${textColor};`;
}

function bySkillDescThenName(a, b) {
  return Number(b.skill) - Number(a.skill) || String(a.name).localeCompare(String(b.name));
}

function playerRow(player, team) {
  const skill = Number(player.skill);
  const badges = [
    groupLabel(team, player.name) ? pill(groupLabel(team, player.name), 'slate') : '',
    player.handler ? pill('H', 'amber') : '',
    ...leaderCodes(player).map(badge => pill(badge.label, badge.cls)),
    player.newReturning === 'new' ? pill('New', 'green') : '',
  ].join('');

  return `
    <div class="player-row">
      <div class="player-main">
        <div class="player-name">${escapeHtml(player.name)}</div>
        <div class="badges">${badges}</div>
      </div>
      <div class="player-stats">
        <span class="gender-badge">${escapeHtml(player.gender)}</span>
        <span class="skill-badge" style="${skillBadgeStyle(skill)}">${skill.toFixed(1)}</span>
      </div>
    </div>
  `;
}

function genderSection(label, players, team, cls) {
  if (players.length === 0) return '';
  const sortedPlayers = [...players].sort(bySkillDescThenName);
  return `
    <section class="gender-section ${cls}">
      <div class="section-head"><span>${escapeHtml(label)}</span><span>${players.length}</span></div>
      <div class="player-list">${sortedPlayers.map(player => playerRow(player, team)).join('')}</div>
    </section>
  `;
}

function teamCard(team) {
  const women = team.roster.filter(player => player.gender === 'F');
  const men = team.roster.filter(player => player.gender === 'M');
  const other = team.roster.filter(player => player.gender !== 'F' && player.gender !== 'M');

  return `
    <article class="team-card">
      <div class="team-stripe"></div>
      <div class="team-inner">
        <header class="team-header">
          <div class="team-title-wrap">
            <h3>${escapeHtml(team.name)}</h3>
            <p>${team.size} players • Avg skill ${Number(team.averageSkill).toFixed(2)}</p>
          </div>
          <div class="team-metrics">
            <div><span>F</span><b>${team.female}</b></div>
            <div><span>M</span><b>${team.male}</b></div>
            <div><span>H</span><b>${team.handlers}</b></div>
          </div>
        </header>
        ${genderSection('Women', women, team, 'women')}
        ${genderSection('Men', men, team, 'men')}
        ${genderSection('Other', other, team, 'men')}
      </div>
    </article>
  `;
}

function variationId(index) {
  return `variation-${index + 1}`;
}

function variationNav(report) {
  return `
    <nav class="variation-nav" aria-label="Jump to a team option">
      <div class="variation-nav__label">Jump to variation</div>
      <div class="variation-nav__links">
        ${report.variations.map((variation, index) => `
          <a href="#${variationId(index)}">
            <span>Variation ${index + 1}</span>
            <strong>${escapeHtml(variation.name)}</strong>
          </a>
        `).join('')}
      </div>
    </nav>
  `;
}

function variationSection(variation, index, total) {
  return `
    <section class="variation-section" id="${variationId(index)}">
      <div class="variation-heading">
        <div>
          <div class="variation-kicker">Variation ${index + 1} of ${total}</div>
          <h2>${escapeHtml(variation.name)}</h2>
          <p>You are viewing <strong>${escapeHtml(variation.name)}</strong>. All 8 teams, all players, formatted for quick exec scanning.</p>
        </div>
        <div class="variation-pills">
          ${pill(`${variation.summary.niceHonored}/${variation.summary.niceTotal} nice honoured`, 'green')}
          ${pill(`${variation.summary.femaleLeaderTeams}/8 teams have female leaders`, 'pink')}
          ${pill(`${variation.summary.maleLeaderCoveredTeams}/8 teams have male leaders`, 'blue')}
        </div>
      </div>
      <div class="snapshot-grid">${variation.teams.map(teamCard).join('')}</div>
    </section>
  `;
}

function summaryTable(report) {
  return `
    <section class="summary-card">
      <h2>Summary table</h2>
      <table>
        <thead><tr><th>Option</th><th>Nice requests honoured</th><th>Gender balance</th><th>Skill spread</th><th>Handler spread</th><th>Female leaders</th><th>Male leaders</th></tr></thead>
        <tbody>
          ${report.variations.map(variation => `
            <tr>
              <td><strong>${escapeHtml(variation.name)}</strong></td>
              <td>${variation.summary.niceHonored}/${variation.summary.niceTotal} (${Math.round(variation.summary.niceRate * 100)}%)</td>
              <td>${variation.summary.maleSpread}M / ${variation.summary.femaleSpread}F spread</td>
              <td>${Number(variation.summary.skillSpread).toFixed(2)}</td>
              <td>${variation.summary.handlerSpread}</td>
              <td>${variation.summary.femaleLeaderTeams}/8 teams have female leaders</td>
              <td>${variation.summary.maleLeaderCoveredTeams}/8 teams have male leaders</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function buildHtml(report) {
  const leaderTotal = Number(report.roster.femaleLeaders ?? 0)
    + Number(report.roster.femaleLeaderB ?? 0)
    + Number(report.roster.maleLeaderA ?? 0)
    + Number(report.roster.maleLeaderB ?? 0);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(report.seasonName)} Team Options</title>
  <style>
    :root { --ink:#071226; --muted:#58708d; --line:#d9e6f2; --green:#059669; --blue:#2563eb; --pink:#db2777; --amber:#f59e0b; --bg:#f6fbff; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:linear-gradient(135deg,#f8fffb,#f4f9ff); }
    .page { max-width: 1720px; margin: 0 auto; padding: 32px; }
    .hero { border:1px solid var(--line); border-radius:32px; overflow:hidden; background:rgba(255,255,255,.9); box-shadow:0 18px 50px rgba(15,23,42,.07); margin-bottom:24px; }
    .hero-stripe { height:8px; background:linear-gradient(90deg,#059669,#38bdf8,#fbbf24); }
    .hero-inner { padding:28px; }
    h1 { margin:0; font-size:44px; line-height:1; letter-spacing:-.04em; font-weight:800; }
    .sub { color:var(--muted); margin-top:10px; font-size:16px; }
    .metrics { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-top:24px; }
    .metric { border:1px solid var(--line); border-radius:24px; padding:18px; background:white; box-shadow:0 8px 24px rgba(15,23,42,.04); }
    .metric span { display:block; color:var(--muted); font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
    .metric b { display:block; margin-top:8px; font-size:32px; line-height:1; }
    .metric small { display:block; margin-top:6px; color:var(--muted); }
    .summary-card { background:white; border:1px solid var(--line); border-radius:28px; padding:24px; box-shadow:0 12px 34px rgba(15,23,42,.05); margin-bottom:28px; }
    h2 { margin:0 0 14px; font-size:30px; letter-spacing:-.03em; font-weight:800; }
    table { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border:1px solid var(--line); border-radius:18px; font-size:14px; background:white; }
    th { background:#eef5fc; text-align:left; padding:12px; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
    td { padding:11px 12px; border-top:1px solid var(--line); color:#24364f; }
    .variation-nav { background:#071226; color:white; border-radius:28px; padding:20px; margin:0 0 28px; box-shadow:0 14px 36px rgba(7,18,38,.14); }
    .variation-nav__label { font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; color:#bfdbfe; margin-bottom:12px; }
    .variation-nav__links { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .variation-nav a { display:block; text-decoration:none; color:white; border:1px solid rgba(255,255,255,.18); border-radius:18px; padding:12px; background:rgba(255,255,255,.08); }
    .variation-nav a span { display:block; color:#93c5fd; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
    .variation-nav a strong { display:block; margin-top:5px; font-size:14px; line-height:1.2; }
    .variation-section { margin:34px 0 44px; break-before: page; }
    .variation-section:first-of-type { break-before:auto; }
    .variation-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:16px; border:2px solid #bfdbfe; border-radius:28px; padding:18px 20px; background:linear-gradient(135deg,#eff6ff,#fff); box-shadow:0 12px 28px rgba(37,99,235,.08); }
    .variation-kicker { display:inline-flex; align-items:center; border-radius:999px; padding:6px 10px; margin-bottom:10px; background:#2563eb; color:white; font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
    .variation-heading h2 { margin-bottom:4px; }
    .variation-heading p { margin:0; color:var(--muted); }
    .variation-pills { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; }
    .snapshot-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; align-items:start; }
    .team-card { border:1px solid #a7f3d0; border-radius:28px; background:linear-gradient(180deg,#ecfdf5 0%, #fff 18%, #fff 100%); overflow:hidden; box-shadow:0 12px 28px rgba(15,23,42,.06); break-inside:avoid; }
    .team-stripe { height:5px; background:var(--green); }
    .team-inner { padding:16px; }
    .team-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:18px; }
    .team-title-wrap { min-width:0; }
    .team-header h3 { margin:0; font-size:19px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .team-header p { margin:5px 0 0; color:var(--muted); font-size:12px; }
    .team-metrics { display:grid; grid-template-columns:repeat(3,44px); gap:6px; }
    .team-metrics div { border:1px solid var(--line); background:white; border-radius:16px; text-align:center; padding:7px 0; }
    .team-metrics span { display:block; font-size:10px; font-weight:900; color:#64748b; }
    .team-metrics b { display:block; font-size:16px; margin-top:2px; }
    .gender-section { margin-top:15px; }
    .section-head { display:flex; justify-content:space-between; border-bottom:1px solid; padding-bottom:7px; margin-bottom:9px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.18em; }
    .women .section-head { color:var(--pink); border-color:#fbcfe8; }
    .men .section-head { color:var(--blue); border-color:#bfdbfe; }
    .player-list { display:flex; flex-direction:column; gap:8px; }
    .player-row { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:58px; border:1px solid var(--line); background:white; border-radius:18px; padding:10px 12px; box-shadow:0 2px 8px rgba(15,23,42,.03); }
    .player-main { min-width:0; }
    .player-name { font-size:13px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .badges { display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; }
    .pill { display:inline-flex; align-items:center; border-radius:999px; padding:3px 8px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; border:1px solid transparent; }
    .pill.slate { background:#f1f5f9; color:#334155; border-color:#e2e8f0; }
    .pill.amber { background:#fef3c7; color:#92400e; border-color:#fde68a; }
    .pill.pink { background:#fce7f3; color:#be185d; border-color:#fbcfe8; }
    .pill.blue { background:#dbeafe; color:#1d4ed8; border-color:#bfdbfe; }
    .pill.indigo { background:#e0e7ff; color:#4338ca; border-color:#c7d2fe; }
    .pill.green { background:#d1fae5; color:#047857; border-color:#a7f3d0; }
    .player-stats { display:flex; flex-shrink:0; align-items:center; gap:7px; }
    .gender-badge { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:999px; border:1px solid var(--line); background:#f8fafc; color:#475569; font-size:12px; font-weight:800; }
    .skill-badge { border:1px solid #047857; border-radius:999px; padding:7px 9px; font-size:12px; font-weight:800; }
    @media (max-width: 1200px) { .snapshot-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .metrics, .variation-nav__links { grid-template-columns:repeat(2,1fr); } }
    @media (max-width: 720px) { .page { padding:16px; } h1 { font-size:34px; } .snapshot-grid, .variation-nav__links { grid-template-columns:1fr; } .variation-heading { display:block; } .variation-pills { justify-content:flex-start; margin-top:12px; } }
    @media print { @page { size: 17in 11in; margin: .35in; } body { background:white; } .page { max-width:none; padding:0; } .hero, .summary-card, .team-card, .variation-heading { box-shadow:none; } .hero-inner { padding:20px; } .metrics { grid-template-columns:repeat(5,1fr) !important; } .variation-nav { display:none; } .variation-heading { padding:10px 12px; margin-bottom:10px; } .variation-kicker { font-size:8px; padding:4px 7px; margin-bottom:5px; } .snapshot-grid { grid-template-columns:repeat(4,1fr); gap:10px; } .team-inner { padding:10px; } .player-row { min-height:auto; padding:5px 7px; gap:6px; border-radius:10px; } .player-name { font-size:8px; } .team-header h3 { font-size:13px; } .team-header p, .section-head, .pill, .gender-badge, .skill-badge { font-size:7px; } .gender-badge { width:20px; height:20px; } .skill-badge { padding:4px 6px; } .badges { gap:3px; margin-top:3px; } .pill { padding:2px 5px; } .team-metrics { grid-template-columns:repeat(3,30px); } .team-metrics div { padding:4px 0; border-radius:10px; } .team-metrics b { font-size:11px; } .variation-section { break-before:page; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="hero-stripe"></div>
      <div class="hero-inner">
        <h1>${escapeHtml(report.seasonName)} Team Options</h1>
        <div class="sub">Polished HTML review page for exec scanning. PDF is generated from this same page.</div>
        <div class="metrics">
          <div class="metric"><span>Players</span><b>${report.roster.totalPlayers}</b><small>${report.roster.male}M / ${report.roster.female}F / ${report.roster.other}O</small></div>
          <div class="metric"><span>Teams</span><b>${report.source.teamCount}</b><small>per variation</small></div>
          <div class="metric"><span>Nice requests</span><b>${report.roster.mutualNicePairs}</b><small>mutual requests counted</small></div>
          <div class="metric"><span>Handlers</span><b>${report.roster.handlers}</b><small>spread by team</small></div>
          <div class="metric"><span>Leaders</span><b>${leaderTotal}</b><small>female A/B + male leaders</small></div>
        </div>
      </div>
    </section>
    ${summaryTable(report)}
    ${variationNav(report)}
    ${report.variations.map((variation, index) => variationSection(variation, index, report.variations.length)).join('')}
  </main>
</body>
</html>`;
}

export async function buildAndWriteExecReviewHtml(options = {}) {
  const jsonPath = options.json ?? DEFAULT_JSON_PATH;
  const htmlPath = options.html ?? DEFAULT_HTML_PATH;
  const publicHtmlPath = options.publicHtml ?? DEFAULT_PUBLIC_HTML_PATH;
  const report = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  const html = buildHtml(report);
  await fs.mkdir(path.dirname(htmlPath), { recursive: true });
  await fs.mkdir(path.dirname(publicHtmlPath), { recursive: true });
  await fs.writeFile(htmlPath, html, 'utf8');
  await fs.writeFile(publicHtmlPath, html, 'utf8');
  return { htmlPath, publicHtmlPath };
}

async function main() {
  const output = await buildAndWriteExecReviewHtml(parseCliOptions(process.argv.slice(2)));
  console.log(`Exec review HTML: ${output.htmlPath}`);
  console.log(`Website HTML copy: ${output.publicHtmlPath}`);
}

const invokedPath = pathToFileURL(process.argv[1] ?? '').href;
if (import.meta.url === invokedPath) {
  void main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

