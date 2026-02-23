const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Cache directory that Render can write to
  cacheDirectory: join('/opt/render', '.cache', 'puppeteer'),
  
  // Download Chrome during installation
  chrome: {
    skipDownload: false,
  },
};