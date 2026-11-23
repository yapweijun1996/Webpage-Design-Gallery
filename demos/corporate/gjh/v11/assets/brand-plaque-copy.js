// English comes from the installed brand kit. Keep its display names and model codes in every title.
const copy = {
  S01: {
    'zh-Hans': ['海鲜罐头', 'New Moon 的产品目录列有 425 克新西兰野生捕捞特级鲍鱼罐头，配料包括鲍鱼、水、盐和糖。这款海味来自新西兰。'],
    ms: ['Sajian makanan laut', 'New Moon menyenaraikan Premium Wild Caught New Zealand Abalone dalam tin 425 g. Antara ramuannya ialah abalon, air, garam dan gula. Makanan laut ini berasal dari New Zealand.'],
  },
  S02: {
    'zh-Hans': ['厨房里的一瓶蚝油', 'MILI 的素食蚝油为 510 克瓶装，配料包括蘑菇提取物。这款调味酱适合放在厨房，为家常菜增添鲜味。'],
    ms: ['Sebotol sos untuk dapur', 'Sos Tiram Vegetarian MILI didatangkan dalam botol 510 g dan mengandungi ekstrak cendawan. Sos ini sesuai disimpan di dapur untuk menambah rasa umami pada masakan harian.'],
  },
  S03: {
    'zh-Hans': ['饮料与冰品', 'GOGO 的饮料和冰淇淋系列包括罐装饮料和 potong 冰淇淋。清凉的饮料和熟悉的冰品，为日常生活增添乐趣。'],
    ms: ['Minuman dan sajian sejuk beku', 'Rangkaian minuman dan ais krim GOGO merangkumi minuman dalam tin dan ais krim potong. Minuman sejuk dan ais krim yang biasa dinikmati menceriakan hidangan harian.'],
  },
  S04: {
    'zh-Hans': ['驱蚊贴展示', 'Borsch Med 驱蚊贴每盒 18 片，所列成分包括香茅油。包装说明写明，可将贴片贴在衣物或附近的物体表面。'],
    ms: ['Pameran pelekat penghalau nyamuk', 'Pelekat penghalau nyamuk Borsch Med didatangkan dalam pek 18 keping. Minyak sitronela ialah antara ramuan yang disenaraikan. Arahan pada pek menyatakan bahawa pelekat boleh ditampal pada pakaian atau permukaan berdekatan.'],
  },
  S05: {
    'zh-Hans': ['传统药品陈列', '片仔癀公司的官网列有片仔癀这一药品，并说明每盒一锭。展柜以药品名称和单锭包装呈现这一传统药品类别。'],
    ms: ['Pameran ubat tradisional', 'Laman rasmi syarikat menyenaraikan ubat Pien Tze Huang dan menerangkan bahawa setiap kotak mengandungi satu ketul ubat. Nama dan format seunit sekotak memperkenalkan kategori ubat tradisional ini.'],
  },
  S06: {
    'zh-Hans': ['风干板面', 'Flying Wheel 的新加坡板面采用风干工艺，目录所列规格为 70 克，配料包括小麦粉、水和海盐。这款面条可作为家中常备的主食。'],
    ms: ['Mi yang dikeringkan dengan udara', 'Ban mee Singapura Flying Wheel dikeringkan dengan udara dan disenaraikan pada berat 70 g. Antara ramuannya ialah tepung gandum, air dan garam laut. Mi ini sesuai sebagai makanan ruji di dapur.'],
  },
  S07: {
    'zh-Hans': ['猪脚与蘑菇', 'Gu Long 的蘑菇猪脚罐头标示为 397 克，所列配料包括猪脚、蘑菇和板栗。品牌还有炖猪肉、午餐肉、海鲜、水果和蔬菜等罐头。'],
    ms: ['Kaki babi dan cendawan', 'Katalog Gu Long menyenaraikan Pork Leg Mushroom pada berat 397 g, dengan kaki babi, cendawan dan buah berangan Cina antara ramuannya. Rangkaian ini turut merangkumi daging babi rebus, daging luncheon, makanan laut, buah-buahan dan sayur-sayuran.'],
  },
  S08: {
    'zh-Hans': ['细滑花生酱', 'SKIPPY 细滑花生酱的目录规格为 500 克，所列配料包括烤花生、糖、花生油、植物油和盐。这种熟悉的瓶装花生酱适合作为日常餐食的搭配。'],
    ms: ['Mentega kacang bertekstur halus', 'SKIPPY Creamy Peanut Butter disenaraikan pada berat 500 g. Antara ramuannya ialah kacang tanah panggang, gula, minyak kacang tanah, minyak sayuran dan garam. Mentega kacang dalam balang ini sesuai untuk hidangan harian.'],
  },
  S09: {
    'zh-Hans': ['厨房里的午餐肉罐头', 'SPAM Classic 午餐肉的目录规格为 340 克，配料包括猪肉和火腿。Classic 是 SPAM 系列中的一个品种，可搭配简单的家常餐食。'],
    ms: ['Setin daging luncheon', 'SPAM Classic Luncheon Meat disenaraikan pada berat 340 g, dengan daging babi dan ham antara ramuannya. Classic ialah salah satu variasi dalam rangkaian SPAM untuk hidangan harian yang ringkas.'],
  },
  S10: {
    'zh-Hans': ['鲍鱼罐头陈列', 'GJH 的鲍鱼目录列有 454 克的 Red California Mexico Abalone。California Mexico Products 也列在 GJH 经销的品牌之中。这款海味为日常餐桌添一道选择。'],
    ms: ['Pameran abalon', 'Kategori abalon GJH menyenaraikan Red California Mexico Abalone pada berat 454 g. California Mexico Products tersenarai antara jenama yang diedarkan oleh GJH. Makanan laut ini menambah pilihan untuk hidangan harian.'],
  },
  S11: {
    'zh-Hans': ['罐头食品陈列', '厨房的罐头架上可以备着多种食材，方便准备简单的日常餐食。这里展示的是罐头食品这一类别，未指定某一种食品。'],
    ms: ['Pameran makanan dalam tin', 'Rak makanan dalam tin menyediakan pilihan untuk pelbagai hidangan ringkas di dapur. Pameran ini memperkenalkan kategori makanan dalam tin secara umum, tanpa merujuk kepada satu makanan tertentu.'],
  },
  S12: {
    'zh-Hans': ['片剂陈列', 'GJH 的关节健康目录列有 150 片装 Zeria Chondro Support，Zeria 的官方目录也列有 Chondro Support。展柜以产品名称和片剂形式呈现这项资料。'],
    ms: ['Pameran tablet', 'GJH menyenaraikan Zeria Chondro Support dalam pek 150 tablet di bawah kategori kesihatan sendi. Katalog rasmi Zeria turut menyenaraikan Chondro Support. Paparan ini memperkenalkan nama produk dan bentuk tabletnya.'],
  },
  S13: {
    'zh-Hans': ['小巧的入耳式耳机', 'GJH 的品牌目录列有索尼。索尼将 MDR-E9LP 介绍为有白色款的有线入耳式耳机。'],
    ms: ['Audio dalam bentuk kompak', 'Direktori jenama GJH menyenaraikan Sony. Menurut Sony, MDR-E9LP ialah fon telinga dalam telinga berwayar yang tersedia dalam warna putih.'],
  },
  S14: {
    'zh-Hans': ['适合一同观看的屏幕', 'LG UR75 是一款 43 英寸的 4K Smart UHD 电视。GJH 的品牌目录列有 LG。43 英寸的屏幕适合家中一同观看。'],
    ms: ['Skrin untuk tontonan bersama', 'LG UR75 ialah televisyen Smart UHD 4K berukuran 43 inci. LG tersenarai dalam direktori jenama GJH. Skrin 43 inci menawarkan ruang tontonan yang luas di rumah.'],
  },
  S15: {
    'zh-Hans': ['琴键与琴声', 'Casio GP-510BP 是 CELVIANO Grand Hybrid 系列的数码钢琴。GJH 的品牌目录列有 Casio。宽阔的键盘和琴身营造出安静琴房的氛围。'],
    ms: ['Kekunci dan bunyi', 'GP-510BP ialah piano digital dalam rangkaian CELVIANO Grand Hybrid Casio. Casio tersenarai dalam direktori GJH. Papan kekunci yang lebar dan bentuk piano mewujudkan suasana bilik muzik yang tenang.'],
  },
  S16: {
    'zh-Hans': ['白色小巧追踪器', '白色 GP eTag 的产品资料列有挂绳孔和内置蜂鸣器。GP 将 eTag 介绍为智能追踪器。圆形机身小巧，预留了挂绳孔。'],
    ms: ['Penjejak kecil berwarna putih', 'GP eTag berwarna putih disenaraikan dengan lubang tali dan pembaz terbina dalam. GP memperkenalkan eTag sebagai penjejak pintar. Badannya kecil dan bulat dengan bukaan untuk tali.'],
  },
  S17: {
    'zh-Hans': ['无绳电话与底座', 'Gigaset A270 是一款有白色可选的无绳电话。其产品资料分别介绍了带答录机和不带答录机的版本。听筒和底座是家用电话常见的组合。'],
    ms: ['Gagang telefon dan tapak', 'Gigaset A270 ialah telefon tanpa wayar yang turut ditawarkan dalam warna putih. Keterangan produk merangkumi versi dengan atau tanpa mesin penjawab. Gagang telefon dan tapak merupakan bentuk yang biasa ditemui di rumah.'],
  },
};

// Build rows from the installed kit before publishing its interaction targets.
export function* brandPlaqueMessages(entries) {
  for (const {slot, brand, tagline, story} of entries) {
    const localized = copy[slot];
    if (!localized) continue;
    const [zhTitle, zhStory] = localized['zh-Hans'];
    const [msTitle, msStory] = localized.ms;
    yield [tagline, zhTitle, msTitle];
    yield [brand + ' · ' + tagline, brand + ' · ' + zhTitle, brand + ' · ' + msTitle];
    yield [story, zhStory, msStory];
    yield [brand + ' logo', brand + ' 标志', 'Logo ' + brand];
  }
}
