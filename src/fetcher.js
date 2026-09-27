'use strict';

/**
 * 搜索抓取模块：负责 Playwright 浏览器生命周期与逐词搜索流程。
 * 只负责「怎么搜、怎么取到页面」，具体 gif 提取交给 extractor.js。
 *
 * 本模块内置了「降低百度安全验证触发概率」的措施：
 *   1. 隐藏自动化特征（覆盖 navigator.webdriver + 禁用 AutomationControlled 标志）
 *   2. 支持持久化用户目录，保留 cookie / 登录态，可手动过验证一次后长期复用
 *   3. 每次搜索间随机延迟，模拟人类操作节奏
 *   4. 页面加载后模拟滚动，增加真实性
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { extractGifFromPage } = require('./extractor');

/**
 * 常见系统浏览器可执行文件路径（跨平台探测用）。
 * Windows 用户若装了 Chrome，通常命中前两个；macOS 命中 Chrome/Chromium 应用路径。
 */
const COMMON_BROWSER_PATHS = [
  // Windows Chrome
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  // macOS Chrome / Chromium
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  // Linux
  '/usr/local/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
];

/**
 * 附加到浏览器的启动参数，用于弱化自动化特征。
 * --no-sandbox / --disable-dev-shm-usage 主要解决 Linux 容器环境问题，其他平台无害。
 */
const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-infobars',
  '--no-sandbox',
  '--disable-dev-shm-usage',
];

/** 更接近真实浏览器、且与所用 UA 匹配的默认用户代理 */
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 解析要使用的浏览器可执行文件路径，返回 null 表示使用 Playwright 自带浏览器。
 * 优先级：config.executablePath（显式指定）> 常见系统浏览器 > Playwright 自带。
 */
function resolveExecutablePath(config) {
  if (config.executablePath && fs.existsSync(config.executablePath)) {
    return config.executablePath;
  }
  for (const p of COMMON_BROWSER_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 简单延迟 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 在每个页面加载前注入脚本，隐藏自动化检测特征。
 */
async function hideAutomationFlags(context) {
  await context.addInitScript(() => {
    // 隐藏 webdriver 标记（最重要的检测点）
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // 补齐 chrome 对象，模拟真实浏览器
    window.chrome = window.chrome || { runtime: {}, loadTimes: () => {}, csi: () => {} };
    // 常见权限检测平滑
    const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
    if (originalQuery) {
      window.navigator.permissions.query = (parameters) =>
        parameters && parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    }
  });
}

/**
 * 启动浏览器。支持两种模式：
 *   - 普通模式：browser.newContext()（默认）
 *   - 持久化模式（config.persistentProfile=true）：launchPersistentContext，保留 cookie/登录态
 * 持久化模式下第一次可用有头模式手动过验证，之后即使无头也带 cookie，大幅降低触发概率。
 *
 * @returns {Promise<{browser, context}>}
 */
async function launchBrowser(config) {
  const launchOptions = { headless: config.headless, args: BROWSER_ARGS };
  const execPath = resolveExecutablePath(config);
  if (execPath) {
    launchOptions.executablePath = execPath;
    console.log(`使用浏览器: ${execPath}`);
  } else {
    console.log(
      '未检测到系统浏览器，将使用 Playwright 自带浏览器（若未安装，请先运行: npx playwright install chromium）'
    );
  }

  if (config.persistentProfile) {
    // 持久化上下文：直接返回其 context（自身即含 cookie/存储），browser 通过 context.browser() 获取
    const profileDir = path.resolve(process.cwd(), config.profileDir);
    console.log(`使用持久化用户目录: ${profileDir}`);
    const context = await chromium.launchPersistentContext(profileDir, {
      ...launchOptions,
      userAgent: config.userAgent || DEFAULT_UA,
      viewport: { width: 1280, height: 800 },
    });
    await hideAutomationFlags(context);
    return { browser: context.browser(), context };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    userAgent: config.userAgent || DEFAULT_UA,
    viewport: { width: 1280, height: 800 },
  });
  await hideAutomationFlags(context);
  return { browser, context };
}

/**
 * 依次搜索每个汉字，返回结果数组 [{ word, gifurl }]。
 *
 * @param {string[]} words 汉字关键词数组
 * @param {object} config 配置对象（来自 config.js）
 * @returns {Promise<Array<{word: string, gifurl: string|null}>>}
 */
async function fetchGifs(words, config) {
  const results = [];
  const { browser, context } = await launchBrowser(config);

  try {
    for (const word of words) {
      // 每次搜索间随机延迟，模拟人类节奏，降低触发风控概率
      if (config.randomDelay) {
        const [min, max] = config.randomDelay;
        const wait = min + Math.floor(Math.random() * (max - min));
        console.log(`等待 ${wait}ms 后搜索「${word}」...`);
        await sleep(wait);
      }
      const gifurl = await searchOne(context, word, config);
      results.push({ word, gifurl });
    }
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * 针对单个汉字：打开百度搜索结果页并提取 gif URL。
 */
async function searchOne(context, word, config) {
  const page = await context.newPage();
  try {
    const url = config.searchUrlTemplate.replace('{keyword}', encodeURIComponent(word));
    await page.goto(url, { timeout: config.navigationTimeout });

    // 等待网络基本稳定，确保搜索结果已渲染
    await page.waitForLoadState('networkidle', { timeout: config.waitTimeout }).catch(() => {});

    // 模拟人类滚动，增加真实性
    await humanLikeScroll(page);

    return await extractGifFromPage(page);
  } catch (err) {
    console.warn(`[${word}] 搜索失败: ${err.message}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * 在页面上做几次小幅随机滚动，模拟真实浏览行为。
 */
async function humanLikeScroll(page) {
  try {
    const h = await page.evaluate(() => document.body.scrollHeight).catch(() => 0);
    if (!h) return;
    const steps = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, 200 + Math.floor(Math.random() * 300));
      await sleep(200 + Math.floor(Math.random() * 300));
    }
  } catch {
    /* 滚动失败不影响主流程 */
  }
}

module.exports = { fetchGifs };
