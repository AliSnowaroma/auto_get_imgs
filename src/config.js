'use strict';

/**
 * 集中配置项：搜索引擎地址、浏览器参数、超时、输出路径等。
 * 如需调整搜索方式或提取行为，优先改这里，避免散落在各模块。
 */
module.exports = {
  // 百度普通搜索页 URL 模板，{keyword} 会被替换为汉字关键词（自动 URL 编码）
  searchUrlTemplate: 'https://www.baidu.com/s?wd={keyword}',

  // 是否以无头模式运行（不弹出浏览器窗口）；调试时设为 false 可观察页面
  headless: true,

  // 浏览器定位器：playwright 会自动在项目中下载的浏览器
  browser: 'chromium',

  // 指定系统已安装的 Chromium 可执行文件路径。
  // 设置后优先用它（免下载浏览器）；置空则使用 playwright 自带浏览器（需先 npx playwright install）。
  executablePath: '/usr/local/bin/chromium',

  // 页面加载与等待超时（毫秒）
  navigationTimeout: 30000,
  // 搜索关键词输入/结果等待的基础超时（毫秒）
  waitTimeout: 15000,

  // 结果输出文件路径（相对项目根目录）
  outputFile: 'result.json',

  // 关键词数组文件路径（相对项目根目录）
  wordsFile: 'words.json',
};
