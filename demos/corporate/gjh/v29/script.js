// English lives in the HTML so the shelf works before JavaScript runs.
const mandarin = {
  skip: '跳到品牌目录',
  headlineStart: '今晚的食品柜里',
  headlineEnd: '都有什么？',
  open: '打开食品柜',
  credit: 'AI 概念插图',
  categoryCredit: '分类图片 · AI 概念插图',
  directory: '品牌目录',
  note: '品牌名单根据公开渠道的资料整理，各品牌与 Goh Joo Hin 的关系各有不同。',
  food: '食品与饮料',
  health: '健康与营养',
  electronics: '电子与生活用品',
  disclaimer: '本页为独立设计概念展示，与 Goh Joo Hin 无关。',
  official: 'Goh Joo Hin 官方网站',
};

const offlineMandarin = {
  summary: '安装与离线使用',
  preparing: '正在准备离线内容…',
  installButton: '安装此演示',
  checkButton: '检查更新',
  applyButton: '更新并重新加载',
  updateNotice: '有可用更新',
  checking: '正在检查离线文件…',
  availableOffline: '可离线使用 · {release}',
  readyToUpdate: '已准备好更新至 {release}，可随时重新加载。',
  applying: '正在加载已验证的更新…',
  updateSlow: '更新所需时间比预期长，请稍后重试。',
  installed: '已安装到此设备。',
  installInstructions: '在 iPhone 或 iPad 上，用 Safari 打开此页面，再选择「分享」→「添加到主屏幕」。其他支持安装的浏览器可从菜单选择「安装」或「添加到主屏幕」。',
  failOnline: '无法验证离线文件。请检查更新以重试。',
  failOffline: '目前处于离线状态。重新联网后即可检查更新。',
  backToTopLabel: '返回顶部',
};

const preference = 'gjh-v29-lang';
const languages = document.querySelector('.languages');
const buttons = [...languages.querySelectorAll('button')];
const copy = [...document.querySelectorAll('[data-i18n]')].map(element => ({
  element,
  english: element.textContent,
  chinese: mandarin[element.dataset.i18n],
}));
const counts = document.querySelectorAll('[data-brand-count]');
const description = document.querySelector('meta[name="description"]');
const heroImage = document.querySelector('.scene img');
const englishDescription = description.content;
const englishAlt = heroImage.alt;

function showLanguage(language) {
  const chinese = language === 'zh';
  document.documentElement.lang = chinese ? 'zh-Hans' : 'en-SG';
  document.title = chinese ? '食品柜' : 'The Pantry Shelf';
  description.content = chinese ? '打开食品柜，浏览三个类别的 17 个品牌。' : englishDescription;
  heroImage.alt = chinese ? '木质食品柜里摆放着玻璃罐、铁罐和藤篮' : englishAlt;
  languages.setAttribute('aria-label', chinese ? '语言' : 'Language');
  for (const item of copy) {
    item.element.textContent = chinese ? item.chinese : item.english;
  }
  for (const count of counts) {
    count.textContent = chinese ? `${count.dataset.brandCount} 个品牌` : `${count.dataset.brandCount} brands`;
  }
  document.dispatchEvent(new CustomEvent('demo-pwa-copy-change', {
    detail: chinese ? offlineMandarin : {},
  }));
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === language));
  }
}

for (const button of buttons) {
  button.addEventListener('click', () => {
    const language = button.dataset.lang;
    showLanguage(language);
    try { localStorage.setItem(preference, language); } catch { /* Storage may be disabled. */ }
  });
}

let saved;
try { saved = localStorage.getItem(preference); } catch { /* Storage may be disabled. */ }
const requested = new URLSearchParams(location.search).get('lang');
const supported = ['en', 'zh'];
const initial = [requested, saved].find(language => supported.includes(language));
showLanguage(initial ?? (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'));
languages.hidden = false;

const firstCategory = document.querySelector('.categories details');
const openShelf = document.querySelector('.open-shelf');
openShelf.addEventListener('click', event => {
  if (event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    firstCategory.open = true;
  }
});
