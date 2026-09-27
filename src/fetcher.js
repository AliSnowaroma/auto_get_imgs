'use strict';

/**
 * 搜索抓取模块：负责 Playwright 浏览器生命周期与逐词搜索流程。
 * 只负责「怎么搜、怎么取到页面」，具体 gif 提取交给 extractor.js。
 */

const { chromium } = require('playwright');
const { extractGifFromPage } = require('./extractor');

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
  // 配置了系统浏览器路径则优先使用（免下载）；否则用 playwright 自带浏览器
  if (config.executablePath) {
    launchOptions.executablePath = config.executablePath;
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

    return await extractGifFromPage(page);
  } catch (err) {
    console.warn(`[${word}] 搜索失败: ${err.message}`);
    return null;
  } finally {
    await page.close();
  }
}

module.exports = { fetchGifs };
