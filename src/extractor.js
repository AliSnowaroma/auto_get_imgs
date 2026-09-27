'use strict';

/**
 * gif 图片提取逻辑（核心模块）
 *
 * 职责：给定一个已加载的百度搜索结果页 page 对象，提取该关键词对应的
 * 「那一张 gif 图片」的 URL，返回字符串或 null。
 *
 * ⚠️ 说明：当前为「占位实现」。
 * 用户已明确「这一张 gif 如何从搜索结果中取得」的方法会在后续给出，
 * 待方法确认后，只需改写本文件内的 extractGifFromPage 实现即可，
 * 其他模块（index / fetcher / output / config）无需改动。
 *
 * 当前占位逻辑（仅保证程序骨架可跑通）：
 *   1. 遍历页面中所有 img / a 节点，找到 URL 中含 .gif 的第一个节点；
 *   2. 返回其 src / data-src / href；找不到则返回 null。
 */

/**
 * 从已加载的搜索结果页提取该关键词对应的那一张 gif 图片 URL。
 *
 * @param {import('playwright').Page} page 已加载完成的百度搜索结果页
 * @returns {Promise<string|null>} gif 图片 URL；未找到返回 null
 */
async function extractGifFromPage(page) {
  // —— 占位实现：等你提供具体提取方法后改写 ——
  return page.evaluate(() => {
    const gifNode = Array.from(document.querySelectorAll('img, a[href]')).find((el) => {
      const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
      const href = el.getAttribute('href') || '';
      return (src + href).toLowerCase().includes('.gif');
    });

    if (!gifNode) return null;
    return (
      gifNode.getAttribute('src') ||
      gifNode.getAttribute('data-src') ||
      gifNode.getAttribute('href') ||
      null
    );
  });
}

module.exports = { extractGifFromPage };
