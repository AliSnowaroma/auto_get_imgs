'use strict';

/**
 * 程序入口
 *
 * 流程：
 *   1. 读取 words.json 中的汉字数组（可动态修改该文件，支持一次多个汉字）
 *   2. 用 Playwright 依次打开百度搜索页，为每个汉字提取一张 gif 图片
 *   3. 输出结果为 JSON：[{ word: '中', gifurl: 'https://...' }]
 */

const fs = require('fs');
const path = require('path');

const config = require('./config');
const { fetchGifs } = require('./fetcher');
const { outputResults } = require('./output');

async function main() {
  // 1. 读取关键词数组（words.json）
  const wordsFile = path.join(process.cwd(), config.wordsFile);
  let words;
  try {
    words = JSON.parse(fs.readFileSync(wordsFile, 'utf-8'));
  } catch (err) {
    console.error(`读取 ${config.wordsFile} 失败: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(words) || words.length === 0) {
    console.error(`${config.wordsFile} 需为至少包含一个汉字的数组`);
    process.exit(1);
  }

  console.log(`开始搜索 ${words.length} 个汉字: ${words.join('、')}\n`);

  // 2. 逐个搜索并提取 gif
  const results = await fetchGifs(words, config);

  // 3. 输出结果
  outputResults(results, config);
}

main().catch((err) => {
  console.error('程序运行出错:', err);
  process.exit(1);
});
