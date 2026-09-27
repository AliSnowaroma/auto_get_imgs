'use strict';

/**
 * 搜索抓取模块：负责 Playwright 浏览器生命周期与逐词搜索流程。
 * 只负责「怎么搜、怎么取到页面」，具体 gif 提取交给 extractor.js。
 */

const fs = require('fs');
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

/**
 * 依次搜索每个汉字，返回结果数组 [{ word, gifurl }]。
 *
 * @param {string[]} words 汉字关键词数组
 * @param {object} config 配置对象（来自 config.js）
 * @returns {Promise<Array<{word: string, gifurl: string|null}>>}
 */
async function fetchGifs(words, config) {
  const results = [];

  const launchOptions = { headless: config.headless };
  // 自动解析浏览器路径：显式指定 > 常见系统浏览器 > Playwright 自带
  const execPath = resolveExecutablePath(config);
  if (execPath) {
    launchOptions.executablePath = execPath;
    console.log(`使用浏览器: ${execPath}`);
  } else {
    console.log(
      '未检测到系统浏览器，将使用 Playwright 自带浏览器（若未安装，请先运行: npx playwright install chromium）'
    );
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    // 更接近真实浏览器的 UA，降低被风控拦截的概率
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  try {
    for (const word of words) {
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
    // await page.pause();

    return await extractGifFromPage(page);
  } catch (err) {
    console.warn(`[${word}] 搜索失败: ${err.message}`);
    return null;
  } finally {
    await page.close();
  }
}

module.exports = { fetchGifs };
