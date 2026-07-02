import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const reportHtml = readFileSync(
  join(process.cwd(), 'public/reports/summer-outdoor-2026-exec-review.html'),
  'utf8'
);

describe('summer outdoor report variation nav', () => {
  it('keeps the variation nav in one themed row', () => {
    expect(reportHtml).toContain('.variation-nav { display:flex;');
    expect(reportHtml).toContain('.variation-nav__links { display:flex;');
    expect(reportHtml).toContain('background:rgba(255,255,255,.94)');
  });

  it('updates the active variation while scrolling between sections', () => {
    expect(reportHtml).toContain('function syncCurrentVariationNavFromScroll');
    expect(reportHtml).toContain("window.addEventListener('scroll'");
    expect(reportHtml).toContain('history.replaceState');
  });
});
