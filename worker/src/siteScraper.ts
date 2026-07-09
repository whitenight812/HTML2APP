import puppeteer from 'puppeteer';

export interface SiteInfo {
  title: string;
  faviconUrl: string;
  primaryColor: string;
  screenshot: Buffer;
}

export async function scrapeSiteInfo(url: string): Promise<SiteInfo> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Extract page title
    const title = await page.title();

    // Extract favicon
    let faviconUrl = '';
    try {
      faviconUrl = await page.$eval('link[rel="icon"], link[rel="shortcut icon"]', el => {
        const href = (el as any).href;
        return href || '';
      });
    } catch {
      faviconUrl = new URL('/favicon.ico', url).href;
    }

    // Extract theme color
    let primaryColor = '#2196F3';
    try {
      primaryColor = await page.$eval('meta[name="theme-color"]', el => {
        const content = (el as any).content;
        return content || '#2196F3';
      });
    } catch {
      // default color
    }

    // Take a screenshot for the splash screen
    const screenshot = Buffer.from(await page.screenshot({ type: 'png' }));

    return { title, faviconUrl, primaryColor, screenshot };
  } finally {
    await browser.close();
  }
}
