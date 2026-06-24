const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const view of [
    { name: 'desktop', width: 1440, height: 1200 },
    { name: 'mobile', width: 390, height: 1200 },
  ]) {
    const page = await browser.newPage({ viewport: { width: view.width, height: view.height } });
    await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `output/playwright/sub-squad-${view.name}.png`, fullPage: true });
    const headings = await page.locator('h1,h2').evaluateAll(nodes => nodes.map(n => n.textContent?.trim()));
    const bodyText = await page.locator('main').innerText();
    console.log(JSON.stringify({ view: view.name, headings, bodyText: bodyText.slice(0, 1400) }, null, 2));
    await page.close();
  }
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
