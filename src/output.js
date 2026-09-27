'use strict';

/**
 * 结果输出模块：负责将结果打印到控制台，并写入 result.json。
 */

const fs = require('fs');
const path = require('path');

/**
 * 输出结果：控制台打印 + 保存 JSON 文件。
 *
 * @param {Array<{word: string, gifurl: string|null}>} results 搜索结果
 * @param {object} config 配置对象（来自 config.js）
 */
function outputResults(results, config) {
  // 1. 控制台打印
  console.log('\n===== 搜索结果 =====');
  console.log(JSON.stringify(results, null, 2));

  // 2. 写入 result.json（相对项目根目录）
  const filePath = path.join(process.cwd(), config.outputFile);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2) + '\n', 'utf-8');
  console.log(`\n结果已保存至: ${filePath}`);
}

module.exports = { outputResults };
