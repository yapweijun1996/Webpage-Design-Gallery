/* English is the HTML source. This file adds Mandarin (zh-Hans) and Malay (ms) by element id.
   Entries that contain links are arrays of link labels, applied in order to the existing anchors. */
(() => {
  const ui = {
    en: { title: 'The GJH Story Manga | Goh Joo Hin',
      desc: 'A six-chapter manga of the Goh Joo Hin story, from a Rochor Road provision store to a regional food and lifestyle distributor. Scroll to read, then check each chapter\'s facts.' },
    zh: { title: 'GJH 故事漫画 | Goh Joo Hin',
      desc: '六章漫画讲述 Goh Joo Hin 的故事,从罗敏申路的杂货店到区域食品与生活品牌经销商。向下滚动阅读，再核对每章的事实。' },
    ms: { title: 'Manga Kisah GJH | Goh Joo Hin',
      desc: 'Manga enam bab tentang kisah Goh Joo Hin, daripada kedai runcit di Rochor Road kepada pengedar makanan dan gaya hidup serantau. Tatal untuk membaca, kemudian semak fakta setiap bab.' }
  };

  const zh = {
    k001: '跳到第 1 章', k002: '独立设计概念 · 戏剧化的历史',
    k003: 'GJH 的故事<span> 食品柜漫画</span>',
    k004: '从罗敏申路的杂货店，到遍布区域的货架。六章故事，一路向下滚动。',
    k005: '开始阅读 <span aria-hidden="true">▶</span>',
    k006: '向下滚动，每章的对白会自动出现。点“核对事实”查看记录怎么说。',
    k007: '1940年代', k008: '罗敏申路', k009: '1959', k010: 'New Moon', k011: '1981', k012: 'MILI',
    k013: '1982', k014: '出口', k015: '2004起', k016: '新货架', k017: '今天', k018: '餐桌',
    k019: '第一章 · 1940年代', k020: '卷帘门升起', k021: '哗啦！',
    k022: '米、油、罐头。街坊需要什么，这里就有什么。', k023: '早开门，晚关门。顾客第一。',
    k024: '吴家兄弟在罗敏申路开了一家杂货店。', k025: '核对事实',
    k026: '<b>记录：</b>GJH 的溯源是 1940 年代吴家兄弟在罗敏申路经营的一家杂货店，并印有“Since 1940”。现有公司 Goh Joo Hin Pte Ltd 于 1993 年 9 月 23 日注册成立。',
    k027: '<b>说法不一：</b>2024 年《联合早报》访谈称，董事长的父亲接手了一家现有的店铺，并加上家族姓氏。这里没有调和这两种说法。',
    k028: '<b>戏剧化部分：</b>对白、人物面孔和店门。店铺门牌和开张日期没有公开记录。',
    k029: ['GJH 公司历史 ↗', '联合早报访谈 ↗'],
    k030: '第二章 · 1959', k031: '罐头上的新月', k032: '闪亮！',
    k033: '罐头里的盛宴。鲍鱼，为家庭餐桌准备好了。', k034: '给我两罐。一罐留给团圆饭！',
    k035: 'New Moon 以鲍鱼起步，这是它的第一款产品。', k036: '核对事实',
    k037: '<b>记录：</b>New Moon 将品牌和首款产品鲍鱼的创立时间定为 1959 年。新加坡商标注册簿显示，一个罐头鲍鱼商标于 1959 年 4 月 23 日递交，1960 年 3 月 8 日注册。',
    k038: '<b>说法不一：</b>GJH 的 SG60 专题把 New Moon 进入自家品牌组合的时间放在 1980 年代中期。1959 年是品牌本身的年份。',
    k039: '<b>戏剧化部分：</b>店内场景和团圆饭的对白。红色新月是设计上的点缀。',
    k040: ['New Moon 历史 ↗', 'GJH SG60 专题 ↗'],
    k041: '第三章 · 1981', k042: '第二个自家品牌', k043: '嘿哟！',
    k044: '水果、蔬菜、酱料。食品柜里又多了一个品牌。', k045: '每一箱都要清点。货车中午就开。',
    k046: 'MILI 成为公司的第二个自家品牌，与 New Moon 并肩。', k047: '核对事实',
    k048: '<b>记录：</b>GJH 的大事记将 MILI(罐头水果、蔬菜、肉类、海鲜和酱料系列)列为 1981 年的第二个自家品牌。其新加坡罐头食品商标于 1981 年 4 月 9 日递交。',
    k049: '<b>戏剧化部分：</b>货仓、经理和时间表都是示意。',
    k050: ['GJH 大事记 ↗'],
    k051: '第四章 · 1982', k052: '走出小岛', k053: '成交！',
    k054: '新加坡只是第一站。', k055: '我们的货架会摆上你们的品牌。',
    k056: '出口成为故事的一部分，经销商把品牌继续带往各地。', k057: '核对事实',
    k058: '<b>记录：</b>GJH 的大事记列出 1982 年的出口里程碑，并介绍区域经销网络。点名的市场包括马来西亚、印度尼西亚、中国、香港、泰国、文莱、越南、柬埔寨和菲律宾。另外，GJH 表示其品牌在 17 个市场受商标保护。',
    k059: '<b>戏剧化部分：</b>握手场景。GOGO 官方页面写 1986 年，Flying Wheel 写 2004 年，因此本章不为任何单一品牌定年份。首批出货的日期、路线和买家没有公开。',
    k060: ['GJH 业务简介 ↗'],
    k061: '第五章 · 2004年起', k062: '新货架，新需求', k063: '哈哈！',
    k064: '健康从家里开始。我来给您介绍。', k065: '那音乐呢?那是给孙子们的。',
    k066: '保健品和消费电子产品加入了食品货架。', k067: '核对事实',
    k068: '<b>记录：</b>GJH 称 Borsch Med 是第五个品牌，并把进军健康领域的时间定为 2004 年(品牌注册;公司 Borsch Med Pte. Ltd. 于 2000 年注册成立)。大事记接着记录电子产品:Gigaset(2006)、Sony 个人娱乐产品(2011)、GP Batteries(2016)、Casio 电子乐器和 LG 家庭娱乐(2018)，以及 SteelSeries(2025)。',
    k069: '<b>戏剧化部分：</b>店铺和人物。各合作方的角色不同:Gigaset、Sony、GP Batteries 和 Casio 是经销关系，而 LG 自己的活动页面把 GJH 列为参与零售商。',
    k070: ['GJH 大事记 ↗'],
    k071: '第六章 · 今天', k072: '围坐一桌', k073: '暖暖的！',
    k074: '还是那张桌子，换了新菜。', k075: '<span class="beat">阿公，</span><span class="beat">把鲍鱼递过来！</span>',
    k076: '品牌走进几代人的家庭餐桌。', k077: '核对事实',
    k078: '<b>记录：</b>GJH 的总部位于新加坡 8 Gul Avenue，在柔佛士乃另设办公室。2010 年 8 月 1 日，它与东北社区发展理事会合办 New Moon 万人行(约 5,000 人参加，白米价值 8.5 万新元)，双方另设立 20 万新元的乐龄医疗基金。',
    k079: '<b>戏剧化部分：</b>这个家庭。他们不是真实的顾客。',
    k080: ['GJH 联系方式 ↗', '社区发展理事会 2010 年报 ↗'],
    k081: '想看真实的吗?', k082: '访问 GJH 官方网站 <span aria-hidden="true">↗</span>', k083: '再读一遍',
    k084: '独立设计概念，与 Goh Joo Hin 无关联。插图为本概念以 AI 生成。对白、人物和场景均为戏剧化处理。事实来自每章链接的公开来源。',
    k086: '两兄弟穿着背心，在店屋街上拉开一间小杂货店的卷帘门，周围是罐头、米袋和三轮车。',
    k087: '店主举着一罐印有红色新月的鲍鱼罐头，兴奋的顾客围拢过来。',
    k088: '河边的货仓里，年轻经理拿着写字板，看工人堆叠纸箱、把货装上货车。',
    k089: '两位生意伙伴在集装箱货轮和吊机前握手，头顶是画有虚线航线的东南亚地图。',
    k090: '一位药剂师和一位开怀大笑的老奶奶站在保健品货架和音响、耳机、电子琴展示之间。',
    k091: '三代人围坐圆桌，桌上有鲍鱼、蔬菜和汤，窗外是新加坡的天际线。'
  };

  const ms = {
    k001: 'Langkau ke bab 1', k002: 'Konsep reka bentuk bebas · sejarah didramakan',
    k003: 'Kisah GJH<span> Manga Almari Dapur</span>',
    k004: 'Daripada kedai runcit di Rochor Road ke rak-rak di seluruh rantau. Enam bab, satu tatalan pada satu masa.',
    k005: 'Mula membaca <span aria-hidden="true">▶</span>',
    k006: 'Tatal ke bawah dan dialog setiap bab muncul sendiri. Guna “Semak fakta” untuk melihat apa kata rekod.',
    k007: '1940-an', k008: 'Rochor Road', k009: '1959', k010: 'New Moon', k011: '1981', k012: 'MILI',
    k013: '1982', k014: 'Eksport', k015: '2004+', k016: 'Rak baharu', k017: 'Hari ini', k018: 'Meja makan',
    k019: 'Bab 1 · 1940-an', k020: 'Pengatup dinaikkan', k021: 'KLAK!',
    k022: 'Beras, minyak, tin. Apa sahaja yang jiran perlukan.', k023: 'Buka awal. Tutup lewat. Pelanggan dahulu.',
    k024: 'Adik-beradik Goh membuka kedai runcit di Rochor Road.', k025: 'Semak fakta',
    k026: '<b>Rekod:</b> GJH menjejak perniagaannya kepada kedai runcit yang dijalankan adik-beradik Goh di Rochor Road pada 1940-an, dan mencetak “Since 1940”. Syarikat sekarang, Goh Joo Hin Pte Ltd, diperbadankan pada 23 September 1993.',
    k027: '<b>Catatan berbeza:</b> wawancara Lianhe Zaobao 2024 menyatakan bapa pengerusi mengambil alih sebuah kedai sedia ada dan menambah nama keluarga. Kedua-dua catatan tidak diselaraskan di sini.',
    k028: '<b>Didramakan:</b> dialog, wajah dan pintu kedai. Nombor kedai dan hari pembukaan tiada dalam rekod awam.',
    k029: ['Sejarah syarikat GJH ↗', 'Wawancara Zaobao ↗'],
    k030: 'Bab 2 · 1959', k031: 'Bulan sabit pada tin', k032: 'BERKILAU!',
    k033: 'Jamuan dalam tin. Abalone, sedia untuk meja keluarga.', k034: 'Beri saya dua. Satu untuk makan malam reunion!',
    k035: 'New Moon bermula dengan abalone, produk pertamanya.', k036: 'Semak fakta',
    k037: '<b>Rekod:</b> New Moon menetapkan jenama dan produk pertamanya, abalone, kepada 1959. Daftar tanda dagangan Singapura menunjukkan tanda dagangan abalone dalam tin difailkan pada 23 April 1959 dan didaftarkan pada 8 Mac 1960.',
    k038: '<b>Catatan berbeza:</b> rencana SG60 GJH meletakkan kemasukan New Moon ke dalam portfolio sendiri pada pertengahan 1980-an. 1959 ialah tarikh jenama itu.',
    k039: '<b>Didramakan:</b> babak kedai dan dialog makan malam reunion. Bulan sabit merah ialah hiasan reka bentuk.',
    k040: ['Sejarah New Moon ↗', 'Rencana SG60 GJH ↗'],
    k041: 'Bab 3 · 1981', k042: 'Jenama dalaman kedua', k043: 'ANGKAT!',
    k044: 'Buah, sayur, sos. Satu lagi jenama untuk almari dapur.', k045: 'Kira setiap karton. Lori bertolak tengah hari.',
    k046: 'MILI menyertai New Moon sebagai jenama dalaman kedua syarikat.', k047: 'Semak fakta',
    k048: '<b>Rekod:</b> garis masa GJH menyenaraikan MILI, siri buah, sayur, daging, makanan laut dan sos dalam tin, sebagai jenama dalaman kedua pada 1981. Tanda dagangan makanan dalam tin Singapuranya difailkan pada 9 April 1981.',
    k049: '<b>Didramakan:</b> gudang, pengurus dan jadual hanyalah ilustrasi.',
    k050: ['Garis masa GJH ↗'],
    k051: 'Bab 4 · 1982', k052: 'Melangkaui pulau', k053: 'SETUJU!',
    k054: 'Singapura hanyalah persinggahan pertama.', k055: 'Rak kami akan membawa jenama anda.',
    k056: 'Eksport menjadi sebahagian cerita. Pengedar membawa jenama ke tempat lain.', k057: 'Semak fakta',
    k058: '<b>Rekod:</b> garis masa GJH menyenaraikan pencapaian eksport 1982 dan menerangkan rangkaian pengedar serantau. Pasaran yang disebut termasuk Malaysia, Indonesia, China, Hong Kong, Thailand, Brunei, Vietnam, Kemboja dan Filipina. Secara berasingan, GJH menyatakan jenamanya dilindungi tanda dagangan di 17 pasaran.',
    k059: '<b>Didramakan:</b> jabat tangan. Halaman GOGO menyebut 1986 dan Flying Wheel 2004, jadi bab ini tidak menetapkan tahun untuk mana-mana jenama. Tarikh, laluan dan pembeli penghantaran pertama tidak diketahui umum.',
    k060: ['Profil perniagaan GJH ↗'],
    k061: 'Bab 5 · 2004 dan seterusnya', k062: 'Rak baharu, keperluan baharu', k063: 'HA HA!',
    k064: 'Kesihatan bermula di rumah. Biar saya tunjukkan.', k065: 'Dan muziknya? Itu untuk cucu-cucu saya.',
    k066: 'Suplemen kesihatan dan elektronik pengguna menyertai rak makanan.', k067: 'Semak fakta',
    k068: '<b>Rekod:</b> GJH menyebut Borsch Med sebagai jenama kelimanya dan menetapkan langkah ke bidang kesihatan pada 2004 (pendaftaran jenama; syarikat Borsch Med Pte. Ltd. diperbadankan pada 2000). Garis masa kemudian merekodkan elektronik: Gigaset (2006), hiburan peribadi Sony (2011), GP Batteries (2016), alat muzik elektronik Casio dan hiburan rumah LG (2018) serta SteelSeries (2025).',
    k069: '<b>Didramakan:</b> kedai dan watak. Peranan berbeza mengikut rakan: Gigaset, Sony, GP Batteries dan Casio ialah hubungan pengedaran, manakala halaman kempen LG sendiri menamakan GJH sebagai peruncit yang mengambil bahagian.',
    k070: ['Garis masa GJH ↗'],
    k071: 'Bab 6 · Hari ini', k072: 'Di sekeliling meja', k073: 'HANGAT!',
    k074: 'Meja yang sama. Hidangan baharu.', k075: '<span class="beat">Hulurkan abalone,</span> <span class="beat">Ah Gong!</span>',
    k076: 'Jenama sampai ke meja makan merentasi generasi.', k077: 'Semak fakta',
    k078: '<b>Rekod:</b> GJH beroperasi dari 8 Gul Avenue, Singapura, dengan pejabat kedua di Senai, Johor. Pada 1 Ogos 2010 ia menganjurkan New Moon Big Walk bersama CDC Timur Laut (kira-kira 5,000 peserta, beras bernilai S$85,000), dan kedua-duanya menubuhkan dana penjagaan kesihatan warga emas berasingan sebanyak S$200,000.',
    k079: '<b>Didramakan:</b> keluarga itu. Mereka bukan pelanggan sebenar.',
    k080: ['Hubungi GJH ↗', 'Laporan CDC 2010 ↗'],
    k081: 'Mahu yang sebenar?', k082: 'Layari laman web rasmi GJH <span aria-hidden="true">↗</span>', k083: 'Baca semula',
    k084: 'Konsep reka bentuk bebas, tiada kaitan dengan Goh Joo Hin. Ilustrasi dijana AI untuk konsep ini. Dialog, watak dan babak telah didramakan. Fakta datang daripada sumber awam yang dipautkan dalam setiap bab.',
    k086: 'Dua beradik berbaju dalam membuka pengatup sebuah kedai runcit kecil di jalan rumah kedai, dengan tin, guni beras dan beca di sekeliling.',
    k087: 'Seorang pekedai mengangkat tin abalone bertanda bulan sabit merah sementara pelanggan yang teruja mengerumuninya.',
    k088: 'Di gudang tepi sungai, seorang pengurus muda memegang papan klip memerhati pekerja menyusun karton dan memuatkan lori.',
    k089: 'Dua rakan perniagaan berjabat tangan di hadapan kapal kontena dan kren, dengan laluan bertitik pada peta Asia Tenggara di atas mereka.',
    k090: 'Seorang ahli farmasi dan seorang nenek yang ketawa berdiri di antara rak suplemen kesihatan dan paparan pembesar suara, fon kepala dan papan kekunci.',
    k091: 'Tiga generasi keluarga ketawa bersama di sekeliling meja bulat dengan abalone, sayur dan sup, dengan latar langit Singapura.'
  };

  const dictionaries = { zh, ms };
  const names = { en: 'en-SG', zh: 'zh-Hans', ms: 'ms' };
  const english = new Map();
  const nodes = [...document.querySelectorAll('[data-i18n]')];
  const alts = [...document.querySelectorAll('[data-i18n-alt]')];
  nodes.forEach((node) => english.set(node, node.innerHTML));
  alts.forEach((node) => english.set(node, node.getAttribute('alt')));

  function setLanguage(lang, remember) {
    if (!names[lang]) lang = 'en';
    const dict = dictionaries[lang];
    document.documentElement.lang = names[lang];
    document.documentElement.dataset.lang = lang;
    nodes.forEach((node) => {
      const key = node.dataset.i18n;
      const value = dict && dict[key];
      if (Array.isArray(value)) {
        node.innerHTML = english.get(node);
        node.querySelectorAll('a').forEach((link, index) => { if (value[index]) link.textContent = value[index]; });
      } else {
        node.innerHTML = value || english.get(node);
      }
    });
    alts.forEach((node) => node.setAttribute('alt', (dict && dict[node.dataset.i18nAlt]) || english.get(node)));
    document.title = ui[lang].title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = ui[lang].desc;
    document.querySelectorAll('.lang button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.lang === lang)));
    if (remember) { try { localStorage.setItem('gjh-v25-lang', lang); } catch (error) { /* storage can be blocked */ } }
  }

  document.querySelectorAll('.lang button').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang, true)));

  let initial = new URLSearchParams(location.search).get('lang');
  if (!names[initial || '']) {
    try { initial = localStorage.getItem('gjh-v25-lang'); } catch (error) { initial = null; }
  }
  if (!names[initial || '']) {
    const browser = (navigator.language || 'en').toLowerCase();
    initial = browser.startsWith('zh') ? 'zh' : browser.startsWith('ms') ? 'ms' : 'en';
  }
  setLanguage(initial, false);
})();
