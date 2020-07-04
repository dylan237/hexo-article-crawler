// const request = require('request');
const helper = require('./helper.js');

(async () => {
  try {
    helper.hello()

    const {
      BLOGURL, // 部落格網址
      FOLDERNAME, // 放爬蟲資料的目錄名
      EXTENSION // 爬蟲資料副檔名
    } = await helper.askQuestions() // cli問答互動

    const {
      browser,
      page
    } = await helper.puppeteerInitial() // 初始化 puppeteer

    const pageCount = await helper.getPageCount(BLOGURL, page) // 取得部落格總頁數

    await helper.getArticleData(pageCount, BLOGURL, page, {
      EXTENSION,
      FOLDERNAME
    }) // 按照頁數長度, 批次爬取每頁文章

    await browser.close();

    helper.success(FOLDERNAME) // 成功提示

  } catch (e) {
    await browser.close();
    console.log(e);
  }
})()