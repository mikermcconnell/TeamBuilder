import { getEffectiveSkillRating, LeagueConfig, Player, PlayerGroup, Team, TeamGenerationStats } from '@/types';
import { getPlayerGroupLabel } from '@/utils/playerGrouping';
import { hexToRgba } from '@/utils/teamBranding';

interface WorkspacePdfOptions {
  title?: string;
  subtitle?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimestamp(date = new Date()): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildPlayerChip(player: Player, playerGroups: PlayerGroup[]): string {
  const skill = getEffectiveSkillRating(player).toFixed(1);
  const groupLabel = getPlayerGroupLabel(playerGroups, player.id);
  const newBadge = player.isNewPlayer
    ? '<span class="player-chip__flag player-chip__flag--new">NEW</span>'
    : '';
  const handlerBadge = player.isHandler
    ? '<span class="player-chip__flag player-chip__flag--handler">H</span>'
    : '';
  const groupBadge = groupLabel
    ? `<span class="player-chip__flag player-chip__flag--group">Group ${escapeHtml(groupLabel)}</span>`
    : '';

  return `
    <div class="player-chip">
      <div class="player-chip__main">
        <span class="player-chip__name">${escapeHtml(player.name)}</span>
        <div class="player-chip__flags">
          ${groupBadge}
          ${newBadge}
          ${handlerBadge}
        </div>
      </div>
      <div class="player-chip__meta">
        <span class="player-chip__gender">${escapeHtml(player.gender)}</span>
        <span class="player-chip__skill">${skill}</span>
      </div>
    </div>
  `;
}

function buildTeamCard(team: Team, playerGroups: PlayerGroup[]): string {
  const teamColor = team.color || '#94A3B8';
  const women = team.players.filter(player => player.gender === 'F');
  const men = team.players.filter(player => player.gender === 'M');
  const other = team.players.filter(player => player.gender === 'Other');

  const renderSection = (label: string, players: Player[], tone: 'women' | 'men' | 'other') => {
    if (players.length === 0) return '';

    return `
      <section class="team-card__section">
        <div class="team-card__section-heading team-card__section-heading--${tone}">
          <span>${label}</span>
          <span>${players.length}</span>
        </div>
        <div class="team-card__players">
          ${players.map(player => buildPlayerChip(player, playerGroups)).join('')}
        </div>
      </section>
    `;
  };

  return `
    <article class="team-card" style="--team-color: ${teamColor}; --team-color-soft: ${hexToRgba(teamColor, 0.08)}; --team-color-border: ${hexToRgba(teamColor, 0.28)};">
      <div class="team-card__accent"></div>
      <div class="team-card__header">
        <div>
          <div class="team-card__title-row">
            <span class="team-card__dot"></span>
            <h2 class="team-card__title">${escapeHtml(team.name)}</h2>
          </div>
          <div class="team-card__subtitle">
            ${team.players.length} players • Avg skill ${team.averageSkill.toFixed(2)}
          </div>
        </div>
        <div class="team-card__stats">
          <div class="team-card__stat"><span>F</span><strong>${team.genderBreakdown.F}</strong></div>
          <div class="team-card__stat"><span>M</span><strong>${team.genderBreakdown.M}</strong></div>
          <div class="team-card__stat"><span>H</span><strong>${team.handlerCount ?? team.players.filter(player => player.isHandler).length}</strong></div>
        </div>
      </div>
      <div class="team-card__body">
        ${renderSection('Women', women, 'women')}
        ${renderSection('Men', men, 'men')}
        ${renderSection('Other', other, 'other')}
      </div>
    </article>
  `;
}

function buildSummaryCards(
  teams: Team[],
  unassignedPlayers: Player[],
  config: LeagueConfig,
  stats?: TeamGenerationStats,
): string {
  const assignedPlayers = teams.reduce((sum, team) => sum + team.players.length, 0);
  const requestSummary = stats
    ? `${stats.mustHaveRequestsHonored}/${stats.mustHaveRequestsHonored + stats.mustHaveRequestsBroken}`
    : '—';

  const cards = [
    { label: 'Teams', value: String(teams.length) },
    { label: 'Assigned', value: String(assignedPlayers) },
    { label: 'Unassigned', value: String(unassignedPlayers.length) },
    { label: 'Max Team Size', value: String(config.maxTeamSize) },
    { label: 'Must-have Requests', value: requestSummary },
    { label: 'Avoid Violations', value: String(stats?.avoidRequestsViolated ?? 0) },
  ];

  return cards.map(card => `
    <div class="summary-card">
      <div class="summary-card__label">${card.label}</div>
      <div class="summary-card__value">${card.value}</div>
    </div>
  `).join('');
}

function buildUnassignedSection(unassignedPlayers: Player[], playerGroups: PlayerGroup[]): string {
  if (unassignedPlayers.length === 0) {
    return '';
  }

  return `
    <section class="unassigned-panel">
      <h2 class="unassigned-panel__title">Unassigned Players</h2>
      <div class="unassigned-panel__players">
        ${unassignedPlayers.map(player => buildPlayerChip(player, playerGroups)).join('')}
      </div>
    </section>
  `;
}

export function buildWorkspacePdfHtml(
  teams: Team[],
  unassignedPlayers: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[] = [],
  stats?: TeamGenerationStats,
  options: WorkspacePdfOptions = {},
): string {
  const title = options.title || 'TeamBuilder Workspace Export';
  const subtitle = options.subtitle || `Generated ${formatTimestamp()}`;

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root {
            color-scheme: light;
            --bg: #f8fafc;
            --panel: rgba(255, 255, 255, 0.98);
            --line: #e2e8f0;
            --text: #0f172a;
            --muted: #64748b;
            --women: #db2777;
            --women-soft: #fdf2f8;
            --men: #2563eb;
            --men-soft: #eff6ff;
            --other: #7c3aed;
            --other-soft: #f5f3ff;
            --new: #047857;
            --new-soft: #ecfdf5;
            --handler: #a16207;
            --handler-soft: #fef3c7;
            --group: #475569;
            --group-soft: #f1f5f9;
          }

          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body {
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
            color: var(--text);
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .page {
            padding: 32px;
          }

          .workspace-shell {
            background: rgba(255,255,255,0.55);
            border: 1px solid rgba(226,232,240,0.85);
            border-radius: 28px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
          }

          .workspace-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            padding: 28px 28px 20px;
            border-bottom: 1px solid rgba(226,232,240,0.85);
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(12px);
          }

          .workspace-title {
            margin: 0;
            font-size: 28px;
            line-height: 1.1;
            font-weight: 800;
            letter-spacing: -0.03em;
          }

          .workspace-subtitle {
            margin-top: 8px;
            color: var(--muted);
            font-size: 14px;
          }

          .workspace-badge {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border-radius: 999px;
            border: 1px solid var(--line);
            background: rgba(255,255,255,0.95);
            color: var(--muted);
            font-size: 13px;
            font-weight: 700;
            white-space: nowrap;
          }

          .workspace-body {
            padding: 24px 28px 32px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 24px;
          }

          .summary-card {
            border: 1px solid var(--line);
            background: var(--panel);
            border-radius: 18px;
            padding: 14px 16px;
            min-height: 84px;
          }

          .summary-card__label {
            color: var(--muted);
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .summary-card__value {
            margin-top: 10px;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.03em;
          }

          .team-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
            align-items: start;
          }

          .team-card {
            position: relative;
            border: 2px solid var(--team-color-border);
            border-bottom-width: 4px;
            border-radius: 24px;
            overflow: hidden;
            background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, var(--team-color-soft) 100%);
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
            break-inside: avoid;
          }

          .team-card__accent {
            height: 6px;
            background: var(--team-color);
          }

          .team-card__header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 18px 18px 12px;
          }

          .team-card__title-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .team-card__dot {
            width: 12px;
            height: 12px;
            border-radius: 999px;
            background: var(--team-color);
            flex: none;
          }

          .team-card__title {
            margin: 0;
            font-size: 20px;
            line-height: 1.15;
            font-weight: 800;
            letter-spacing: -0.02em;
          }

          .team-card__subtitle {
            margin-top: 8px;
            color: var(--muted);
            font-size: 13px;
          }

          .team-card__stats {
            display: flex;
            gap: 10px;
            align-items: flex-start;
          }

          .team-card__stat {
            min-width: 48px;
            border-radius: 16px;
            border: 1px solid var(--line);
            background: rgba(255,255,255,0.88);
            text-align: center;
            padding: 8px 10px;
          }

          .team-card__stat span {
            display: block;
            color: var(--muted);
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .team-card__stat strong {
            display: block;
            margin-top: 6px;
            font-size: 18px;
            font-weight: 800;
          }

          .team-card__body {
            padding: 0 18px 18px;
          }

          .team-card__section + .team-card__section {
            margin-top: 14px;
          }

          .team-card__section-heading {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 7px;
            border-bottom: 1px solid var(--line);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            font-weight: 800;
          }

          .team-card__section-heading--women { color: var(--women); border-bottom-color: rgba(219,39,119,0.15); }
          .team-card__section-heading--men { color: var(--men); border-bottom-color: rgba(37,99,235,0.15); }
          .team-card__section-heading--other { color: var(--other); border-bottom-color: rgba(124,58,237,0.15); }

          .team-card__players {
            margin-top: 10px;
            display: grid;
            gap: 8px;
          }

          .player-chip {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            border: 1px solid rgba(226,232,240,0.9);
            background: rgba(255,255,255,0.92);
            border-radius: 16px;
            padding: 10px 12px;
          }

          .player-chip__main {
            min-width: 0;
            flex: 1;
          }

          .player-chip__name {
            display: block;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.2;
          }

          .player-chip__flags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 6px;
          }

          .player-chip__flag {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 3px 8px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .player-chip__flag--new { background: var(--new-soft); color: var(--new); }
          .player-chip__flag--handler { background: var(--handler-soft); color: var(--handler); }
          .player-chip__flag--group { background: var(--group-soft); color: var(--group); }

          .player-chip__meta {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: none;
          }

          .player-chip__gender,
          .player-chip__skill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
            border-radius: 999px;
            padding: 6px 8px;
            font-size: 11px;
            font-weight: 800;
          }

          .player-chip__gender {
            color: var(--muted);
            background: #f8fafc;
            border: 1px solid var(--line);
          }

          .player-chip__skill {
            color: #fff;
            background: linear-gradient(180deg, #16a34a 0%, #166534 100%);
          }

          .unassigned-panel {
            margin-top: 24px;
            border: 1px solid var(--line);
            background: var(--panel);
            border-radius: 22px;
            padding: 18px;
          }

          .unassigned-panel__title {
            margin: 0 0 14px;
            font-size: 18px;
            font-weight: 800;
            letter-spacing: -0.02em;
          }

          .unassigned-panel__players {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          @page {
            size: landscape;
            margin: 10mm;
          }

          @media print {
            body {
              background: white;
            }

            .page {
              padding: 0;
            }

            .workspace-shell {
              box-shadow: none;
              border-radius: 0;
              border: none;
            }

            .workspace-header {
              padding: 18px 20px 14px;
            }

            .workspace-body {
              padding: 18px 20px 20px;
            }

            .summary-grid {
              grid-template-columns: repeat(6, minmax(0, 1fr));
              gap: 10px;
              margin-bottom: 16px;
            }

            .team-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 12px;
            }

            .unassigned-panel__players {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .team-card__header {
              padding: 14px 14px 10px;
            }

            .team-card__body {
              padding: 0 14px 14px;
            }

            .player-chip {
              padding: 8px 10px;
            }
          }

          @media (max-width: 1100px) {
            .summary-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .team-grid,
            .unassigned-panel__players {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <div class="workspace-shell">
            <header class="workspace-header">
              <div>
                <h1 class="workspace-title">${escapeHtml(title)}</h1>
                <div class="workspace-subtitle">${escapeHtml(subtitle)}</div>
              </div>
              <div class="workspace-badge">Workspace PDF</div>
            </header>
            <section class="workspace-body">
              <div class="summary-grid">
                ${buildSummaryCards(teams, unassignedPlayers, config, stats)}
              </div>
              <section class="team-grid">
                ${teams.map(team => buildTeamCard(team, playerGroups)).join('')}
              </section>
              ${buildUnassignedSection(unassignedPlayers, playerGroups)}
            </section>
          </div>
        </main>
      </body>
    </html>
  `;
}

const WORKSPACE_PDF_PRINT_FRAME_ID = 'workspace-pdf-print-frame';

function cleanupPrintFrame(frame: HTMLIFrameElement): void {
  window.setTimeout(() => {
    if (frame.parentNode) {
      frame.parentNode.removeChild(frame);
    }
  }, 1000);
}

export function openWorkspacePdfPrintWindow(html: string): void {
  const existingFrame = document.getElementById(WORKSPACE_PDF_PRINT_FRAME_ID);
  if (existingFrame?.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  const printFrame = document.createElement('iframe');
  printFrame.id = WORKSPACE_PDF_PRINT_FRAME_ID;
  printFrame.setAttribute('aria-hidden', 'true');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  printFrame.style.opacity = '0';
  printFrame.style.pointerEvents = 'none';

  printFrame.onload = () => {
    const frameWindow = printFrame.contentWindow;

    if (!frameWindow) {
      cleanupPrintFrame(printFrame);
      console.error('Unable to access the Workspace PDF print frame.');
      return;
    }

    frameWindow.onafterprint = () => {
      cleanupPrintFrame(printFrame);
    };

    frameWindow.focus();
    window.setTimeout(() => {
      frameWindow.print();
      window.setTimeout(() => cleanupPrintFrame(printFrame), 4000);
    }, 200);
  };

  printFrame.srcdoc = html;
  document.body.appendChild(printFrame);
}
