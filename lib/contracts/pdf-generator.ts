const isVercel = process.env.VERCEL === "1";

const launchArgs = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--disable-extensions",
  "--no-zygote",
];

export async function generatePdf(html: string): Promise<Buffer> {
  if (isVercel) {
    return generatePdfVercel(html);
  }
  return generatePdfLocal(html);
}

async function generatePdfLocal(html: string): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: launchArgs,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdfBytes = await page.pdf(pdfOptions);
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

async function generatePdfVercel(html: string): Promise<Buffer> {
  const chromium = await import("@sparticuz/chromium-min");
  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.launch({
    args: chromium.default.args,
    defaultViewport: chromium.default.defaultViewport,
    executablePath: await chromium.default.executablePath(),
    headless: chromium.default.headless,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdfBytes = await page.pdf(pdfOptions);
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

const pdfOptions = {
  format: "A4" as const,
  printBackground: true,
  margin: {
    top: "25mm",
    right: "25mm",
    bottom: "25mm",
    left: "25mm",
  },
};
