/* The authored HTML is the English source for text, alt and other attributes. */
(() => {
  const root = document.documentElement;
  if (!root) return;

  const zh = {
    k001: '在这个独立设计概念中，了解新加坡 Goh Joo Hin 的品牌、经销能力与公司历史。',
    k002: 'Goh Joo Hin 新加坡 | 经销服务台',
    k003: '跳至主要内容', k004: 'Goh Joo Hin 新加坡', k005: '菜单',
    k006: '主导航', k007: '业务类别', k008: '品牌', k009: '贸易伙伴',
    k010: '发展历程', k011: '联系', k012: '语言',
    k013: 'EN', k014: '中文', k015: 'BM',
    k016: '新加坡经销服务台',
    k017: '好物相伴。每一天。紧密相连。',
    k018: '了解 Goh Joo Hin 的食品、电子产品与健康品牌，找到适合您的咨询渠道。',
    k019: '商务咨询', k020: '商务咨询（在新标签页打开官方网站）',
    k021: '官方网店', k022: '官方网店（在新标签页打开官方网站）',
    k023: '四个人坐在窗边的沙发上，一起笑着',
    k024: 'GJH 官方生活照，照片中的人物身份未获确认为 GJH 员工。',
    k025: '浏览业务类别', k026: '食品', k027: '电子产品', k028: '健康与营养',
    k029: '快捷入口',
    k030: '商务咨询（在新标签页打开官方网站）', k031: '商务咨询',
    k032: '网上购物（在新标签页打开官方网站）', k033: '网上购物',
    k034: '招聘（在新标签页打开官方网站）', k035: '招聘',
    k036: '我们的品牌', k037: '筛选品牌列表',
    k038: '全部', k039: '食品', k040: '电子产品', k041: '健康与营养',
    k042: '火锅周围摆放着鲍鱼和其他食材',
    k043: 'New Moon', k044: '这个品牌以鲍鱼产品起步。', k045: '官方品牌图片',
    k046: '一碗配有蘑菇、青菜和鸡蛋的面条',
    k047: 'MILI', k048: '蔬菜、水果、肉类和海鲜罐头。', k049: '官方品牌图片',
    k050: '人们在户外举起盛有橙色饮料的玻璃杯',
    k051: 'GOGO', k052: '品牌从罐装饮料起步，后来推出 potong 冰淇淋。', k053: '官方品牌图片',
    k054: 'Borsch Med', k055: '中医药保健补充品。', k056: '官方品牌标志',
    k057: 'Sony 个人娱乐产品', k058: 'GJH 是部分产品的指定经销商。', k059: 'GJH 经销业务简介',
    k060: '贸易伙伴', k061: '服务能力',
    k062: '据 GJH 介绍，其仓储与经销业务为亚太地区的服务提供支持。',
    k063: '仓储', k064: '经销', k065: '亚太地区服务', k066: '市场',
    k067: '新加坡', k068: '马来西亚', k069: '印度尼西亚', k070: '中国', k071: '香港',
    k072: '泰国', k073: '文莱', k074: '越南', k075: '柬埔寨', k076: '菲律宾',
    k077: '这里只列举部分市场，供参考。',
    k078: '咨询草稿', k079: '公司', k080: '市场', k081: '选择市场',
    k082: '新加坡', k083: '马来西亚', k084: '印度尼西亚', k085: '中国', k086: '香港',
    k087: '泰国', k088: '文莱', k089: '越南', k090: '柬埔寨', k091: '菲律宾', k092: '其他市场',
    k093: '产品类别', k094: '选择类别', k095: '食品', k096: '电子产品', k097: '健康与营养',
    k098: '生成咨询草稿', k099: '复制草稿', k100: '此页面不会保存或发送您填写的内容。',
    k101: '打开官方联系页面', k102: '打开官方联系页面（在新标签页打开官方网站）',
    k103: '从 Rochor Road 起步', k104: '1940 年代',
    k105: 'GJH 起步于新加坡 Rochor Road 的一家日用品杂货店。',
    k106: '1959', k107: 'New Moon 的品牌起源和首款鲍鱼产品可追溯至这一年。',
    k108: '1981', k109: 'GJH 推出第二个自有品牌 MILI。',
    k110: '2004', k111: 'GJH 通过 Borsch Med 进入保健补充品领域。',
    k112: '叠有「1940」字样的杂货店图像', k113: '官方网站的历史合成图',
    k114: '阅读 GJH 公司历史', k115: '阅读 GJH 公司历史（在新标签页打开官方网站）',
    k116: '下一次商务交流，从这里开始。',
    k117: '如有产品、经销或贸易合作相关咨询，请直接联系 Goh Joo Hin。',
    k118: '打开官方联系页面', k119: '打开官方联系页面（在新标签页打开官方网站）',
    k120: '本页面为独立设计概念，与 Goh Joo Hin Pte Ltd 无隶属关系，也未获其认可。',
    k121: '返回顶部',
    draftTranslation: '翻译草稿，待熟练使用简体中文的审校人员审核。',
    brandCount: '显示 {count} 个品牌',
    briefRequired: '请输入公司名称，并选择市场与产品类别。',
    briefCopied: '已复制咨询草稿。',
    briefSelected: '请使用设备的复制功能复制已选中的草稿。',
  };

  const ms = {
    k001: 'Terokai jenama, keupayaan pengedaran dan sejarah Goh Joo Hin dalam konsep reka bentuk bebas dari Singapura ini.',
    k002: 'Goh Joo Hin Singapura | Meja Pengedaran',
    k003: 'Langkau ke kandungan utama', k004: 'Goh Joo Hin Singapura', k005: 'Menu',
    k006: 'Navigasi utama', k007: 'Kategori perniagaan', k008: 'Jenama', k009: 'Rakan niaga',
    k010: 'Perjalanan kami', k011: 'Hubungi', k012: 'Bahasa',
    k013: 'EN', k014: '中文', k015: 'BM',
    k016: 'Meja pengedaran Singapura',
    k017: 'Yang baik, setiap hari. Saling terhubung.',
    k018: 'Terokai rangkaian makanan, elektronik dan produk kesihatan Goh Joo Hin serta saluran yang sesuai untuk pertanyaan anda.',
    k019: 'Pertanyaan perniagaan', k020: 'Pertanyaan perniagaan (buka laman rasmi dalam tab baharu)',
    k021: 'Kedai dalam talian rasmi', k022: 'Kedai dalam talian rasmi (buka laman rasmi dalam tab baharu)',
    k023: 'Empat orang ketawa bersama di atas sofa berhampiran tingkap',
    k024: 'Foto gaya hidup rasmi GJH. Individu dalam foto ini tidak dikenal pasti sebagai kakitangan GJH.',
    k025: 'Terokai kategori perniagaan', k026: 'Makanan', k027: 'Elektronik', k028: 'Kesihatan & Pemakanan',
    k029: 'Pautan pantas',
    k030: 'Pertanyaan perniagaan (buka laman rasmi dalam tab baharu)', k031: 'Pertanyaan perniagaan',
    k032: 'Beli dalam talian (buka laman rasmi dalam tab baharu)', k033: 'Beli dalam talian',
    k034: 'Kerjaya (buka laman rasmi dalam tab baharu)', k035: 'Kerjaya',
    k036: 'Jenama kami', k037: 'Tapis senarai jenama',
    k038: 'Semua', k039: 'Makanan', k040: 'Elektronik', k041: 'Kesihatan & Pemakanan',
    k042: 'Abalon dan bahan lain di sekeliling periuk panas',
    k043: 'New Moon', k044: 'Jenama ini bermula dengan produk abalon.', k045: 'Imej rasmi jenama',
    k046: 'Semangkuk mi dengan cendawan, sayur hijau dan telur',
    k047: 'MILI', k048: 'Sayur, buah, daging dan makanan laut dalam tin.', k049: 'Imej rasmi jenama',
    k050: 'Beberapa tangan mengangkat gelas minuman berwarna jingga di luar bangunan',
    k051: 'GOGO', k052: 'Bermula dengan minuman dalam tin, diikuti aiskrim potong.', k053: 'Imej rasmi jenama',
    k054: 'Borsch Med', k055: 'Suplemen perubatan tradisional Cina.', k056: 'Lambang rasmi jenama',
    k057: 'Produk hiburan peribadi Sony', k058: 'GJH ialah pengedar yang dilantik untuk produk terpilih.',
    k059: 'Profil pengedaran GJH', k060: 'Rakan niaga', k061: 'Keupayaan',
    k062: 'Menurut GJH, operasi pergudangan dan pengedarannya menyokong perkhidmatan di rantau Asia Pasifik.',
    k063: 'Pergudangan', k064: 'Pengedaran', k065: 'Perkhidmatan Asia Pasifik', k066: 'Pasaran',
    k067: 'Singapura', k068: 'Malaysia', k069: 'Indonesia', k070: 'China', k071: 'Hong Kong',
    k072: 'Thailand', k073: 'Brunei', k074: 'Vietnam', k075: 'Kemboja', k076: 'Filipina',
    k077: 'Senarai ini menyenaraikan beberapa contoh pasaran.',
    k078: 'Draf pertanyaan', k079: 'Syarikat', k080: 'Pasaran', k081: 'Pilih pasaran',
    k082: 'Singapura', k083: 'Malaysia', k084: 'Indonesia', k085: 'China', k086: 'Hong Kong',
    k087: 'Thailand', k088: 'Brunei', k089: 'Vietnam', k090: 'Kemboja', k091: 'Filipina', k092: 'Pasaran lain',
    k093: 'Kategori produk', k094: 'Pilih kategori', k095: 'Makanan', k096: 'Elektronik', k097: 'Kesihatan & Pemakanan',
    k098: 'Sediakan draf pertanyaan', k099: 'Salin draf', k100: 'Halaman ini tidak menyimpan atau menghantar maklumat yang anda isi.',
    k101: 'Buka halaman hubungan rasmi', k102: 'Buka halaman hubungan (buka laman rasmi dalam tab baharu)',
    k103: 'Bermula di Rochor Road', k104: '1940-an',
    k105: 'GJH bermula dengan sebuah kedai barangan runcit di Rochor Road, Singapura.',
    k106: '1959', k107: 'New Moon menjejaki asal-usul jenama dan produk abalon pertamanya ke tahun ini.',
    k108: '1981', k109: 'GJH memperkenalkan MILI sebagai jenama milik syarikat yang kedua.',
    k110: '2004', k111: 'Borsch Med menandakan langkah GJH ke dalam bidang suplemen kesihatan.',
    k112: 'Imej kedai barangan runcit dengan angka 1940 di atasnya', k113: 'Imej komposit sejarah daripada laman rasmi',
    k114: 'Baca sejarah syarikat GJH', k115: 'Baca sejarah syarikat GJH (buka laman rasmi dalam tab baharu)',
    k116: 'Perbincangan perniagaan anda yang seterusnya bermula di sini.',
    k117: 'Hubungi Goh Joo Hin secara langsung tentang produk, pengedaran atau kerjasama perniagaan.',
    k118: 'Buka halaman hubungan rasmi', k119: 'Buka halaman hubungan (buka laman rasmi dalam tab baharu)',
    k120: 'Konsep bebas, tanpa kaitan atau pengesahan daripada Goh Joo Hin Pte Ltd.',
    k121: 'Kembali ke atas',
    draftTranslation: 'Draf terjemahan menunggu semakan penutur fasih.',
    brandCount: '{count} jenama dipaparkan',
    briefRequired: 'Masukkan nama syarikat dan pilih pasaran serta kategori produk.',
    briefCopied: 'Draf pertanyaan telah disalin.',
    briefSelected: 'Gunakan arahan salin pada peranti anda untuk menyalin draf yang dipilih.',
  };

  const dictionaries = { 'zh-Hans': zh, ms };
  const names = { en: 'en-SG', 'zh-Hans': 'zh-Hans', ms: 'ms' };
  const storageKey = 'gjh-v28-lang';
  const buttons = document.querySelectorAll('.lang button[data-lang]');
  const bindings = [];

  function bind(node, key, attribute = null) {
    const english = attribute ? node.getAttribute(attribute) : node.textContent;
    if (key && english !== null) bindings.push({ node, key, attribute, english });
  }

  document.querySelectorAll('[data-i18n]').forEach((node) => bind(node, node.dataset.i18n));
  document.querySelectorAll('[data-i18n-alt]').forEach((node) => bind(node, node.dataset.i18nAlt, 'alt'));
  document.querySelectorAll('[data-i18n-attr]').forEach((node) => {
    node.dataset.i18nAttr.split(';').forEach((rule) => {
      const [attribute, key] = rule.trim().split(':');
      if (attribute) bind(node, key, attribute);
    });
  });

  const draftNote = document.createElement('p');
  draftNote.className = 'caption locale-note';
  draftNote.hidden = true;
  const draftTranslation = 'Draft translation pending fluent review';
  document.querySelector('.hero-copy')?.prepend(draftNote);

  function setLanguage(lang, remember) {
    if (!Object.hasOwn(names, lang)) lang = 'en';
    const dictionary = dictionaries[lang];
    root.lang = names[lang];
    root.dataset.lang = lang;
    bindings.forEach(({ node, key, attribute, english }) => {
      const value = dictionary?.[key] ?? english;
      if (attribute) node.setAttribute(attribute, value);
      else node.textContent = value;
    });
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.lang === lang)));
    draftNote.textContent = dictionary?.draftTranslation ?? draftTranslation;
    draftNote.hidden = lang === 'en';
    document.dispatchEvent(new CustomEvent('gjh:languagechange', { detail: dictionary ?? {} }));
    if (remember) {
      try { localStorage.setItem(storageKey, lang); } catch { /* Storage can be blocked. */ }
    }
  }

  buttons.forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang, true)));

  let initial = new URLSearchParams(location.search).get('lang');
  if (initial === 'zh') initial = 'zh-Hans';
  if (!Object.hasOwn(names, initial)) {
    try { initial = localStorage.getItem(storageKey); } catch { initial = null; }
  }
  if (!Object.hasOwn(names, initial)) {
    const browserLanguage = (navigator.language || 'en').toLowerCase();
    initial = browserLanguage.startsWith('zh') ? 'zh-Hans' : browserLanguage.startsWith('ms') ? 'ms' : 'en';
  }
  setLanguage(initial, false);
})();
