const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const shell = require("shelljs");
const fs = require('fs');

function pollDOM(elName, callback) {
  const el = document.querySelector(elName);
  if (el.length) {
    callback()
  } else {
    setTimeout(pollDOM, 300); // try again in 300 milliseconds
  }
}

function convertUrl(url, currPage) {
  const isFirstPage = currPage == '1'
  return isFirstPage ? url : `${url}/page/${currPage}/`
}

function convertFilePath(currPage, pathObj) {
  const {
    EXTENSION,
    FOLDERNAME
  } = pathObj
  return `./${FOLDERNAME}/blog-articles-${currPage}.${EXTENSION}`
}

const hello = () => {
  console.log(
    chalk.green(
      figlet.textSync("HEXO NexT CRAWLER", {
        // font: "Ghost",
        horizontalLayout: "default",
        verticalLayout: "default"
      })
    )
  );
}

// 傳入檔名及副檔名，創建檔案
const createFile = (filename, extension) => {
  const filePath = `${process.cwd()}/${filename}.${extension}`
  shell.touch(filePath);
  return filePath;
};

// 互動式問答，取得使用者輸入資料
const askQuestions = () => {
  const questions = [{
      name: "BLOGURL",
      type: "input",
      message: "請輸入部落格網址 http(s) protocol / Please enter the URL.",
      default: 'https://dylan237.github.io',
      validate: (answers) => {
        const regexRule = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/
        if (regexRule.test(answers)) {
          return true
        }
        return '網址格式有誤 / fail'
      }
    },
    {
      name: "FOLDERNAME",
      type: "input",
      message: "請輸入資料儲存目錄名稱 / Enter the name of the folder where you want to save the data.",
      default: () => {
        return `article`
      },
      validate: (answers) => {
        try {
          shell.exec(`mkdir ${answers}`)
          return true
        } catch (e) {
          return '資料夾創建失敗 / fail!'
        }
      },
      filter: (val) => {
        try {
          const date = new Date().toLocaleDateString().replace('/', '-')
          return `${val}-${date}`
        } catch (e) {
          return val
        }
      }
    },
    {
      type: "list",
      name: "EXTENSION",
      message: "請選擇資料儲存格式 / Please choose the file extension.",
      choices: [".json", ".js"],
      filter: (val) => {
        return val.split(".")[1];
      }
    }
  ];
  return inquirer.prompt(questions);
};

const success = (filepath) => {
  console.log(
    chalk.white.bgGreen.bold(`資料已被創建於 ${filepath} / Done! File created at ${filepath}`)
  );
};

// 判斷作業系統, 回傳對應的 chrome 路徑
function judgeOS() {
  const osvar = process.platform;
  if (osvar == 'darwin') {
    console.log('You are on a Mac OS');
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else if (osvar == 'win32' || osvar == 'win64') {
    console.log('You are on a Windows OS')
    return 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  } else {
    throw new Error('Unknown OS')
  }
}

async function puppeteerInitial() {
  try {
    const browser = await puppeteer.launch({
      executablePath: judgeOS(),
      headless: false,
      devtools: true,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    await page.setDefaultNavigationTimeout(0); // 取消超時自動停止

    return {
      browser,
      page
    }
  } catch (e) {
    console.log('puppeteerInitial error---', e);
  }
}

async function getPageCount(url, page) {
  try {
    await page.goto(url);
    // await page.waitForSelector('.page-number');
    const pageData = await page.evaluate((sel) => {
      let elements = Array.from(document.querySelectorAll(sel));
      return elements.map(element => {
        return element.textContent
      })
    }, '.page-number');

    const pageCount = pageData[pageData.length - 1] || 1 // 取最後一頁的數字, 相當於獲得總頁數
    console.log('total page---', pageCount);
    return pageCount
  } catch (e) {
    console.log('getPageCount error---', e);
  }
}

async function getArticleData(pageCount, url, page, pathObj) {
  try {
    for (let i = 1; i <= pageCount; i++) {
      const currPage = i.toString()
      console.log('current page---', currPage);
      console.log('current url---', convertUrl(url, currPage));

      await page.goto(convertUrl(url, currPage), {
        // waitUntil: 'domcontentloaded'
      });
      const body = await page.content()
      const $ = await cheerio.load(body)

      // 爬取內文以外的文章資料
      const posts = []
      $('.post').each(async (i, el) => {
        const $2 = cheerio.load($(el).html())
        const post = {
          title: $2('.post-title-link').text().trim(),
          createDate: $2('[title="創建於"]').text().trim(),
          modifyDate: $2('[title="更新於"]').text().trim(),
          category: $2('[itemprop="name"]').text().trim(),
          commentCount: $2('[itemprop="commentCount"]').text().trim().split('')[0],
          url: `${url}${$2('.post-title-link').attr('href')}`,
        }
        posts.push(post)
      });

      // 爬取內文
      for (let i = 0; i < posts.length; i++) {
        const postUrl = posts[i].url
        await page.goto(`${postUrl}#more`)
        await page.waitForSelector('.post-body');
        const postBody = await page.$('.post-body')
        const content = await page.evaluate(postBody => {
          console.log(postBody);
          return postBody.textContent
        }, postBody)
        posts[i].content = content
      }

      // 依照頁碼將文章輸出成 json 檔案
      fs.writeFile(convertFilePath(currPage, pathObj), JSON.stringify(posts), (error) => {
        if (error) {
          throw new Error(error)
        }
        console.log('文件寫入成功');
      })

    }
  } catch (e) {
    console.log('getArticleData error---', e);
  }
}


module.exports = {
  hello,
  askQuestions,
  success,
  puppeteerInitial,
  getPageCount,
  getArticleData
}