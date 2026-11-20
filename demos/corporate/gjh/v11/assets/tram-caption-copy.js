// Keep the synthesized narration and visible brand caption on the same copy.
const translations = {
  S11: ['开放式包装台、牛皮纸卷和叠放的板条箱，营造出罐头食品库房的工作氛围。','Meja pembungkusan terbuka, gulungan kertas kraf dan peti berbilah bertindan membentuk stor barangan bertin.'],
  S10: ['浅色灰泥墙前，深凹的扇贝壳托起海鲜礼品陈列。','Cangkerang kekapis yang dalam menempatkan pameran hadiah makanan laut di hadapan plaster berwarna pasir.'],
  S09: ['深蓝色机器台上，停下的装罐输送线和黄色回转轮引导视线斜向延伸。','Konveyor pengetinan yang berhenti dan roda pemulang kuning menarik pandangan merentasi kaunter biru tua.'],
  S08: ['条纹早餐亭前立着一座花生酱罐高架，旁边是与餐台齐高的吐司托盘。','Rak tinggi berisi balang mentega kacang terletak di hadapan gerai sarapan berjalur dengan dulang roti bakar.'],
  S07: ['红灯笼下，无标识的罐头在翠绿色圆台上层层叠起，宛如宴席中心的摆设。','Piramid tin polos di atas pelantar hijau jed, di bawah tanglung merah, menyerupai hiasan tengah jamuan.'],
  S06: ['安静的灰蓝墙前，独立木架上垂着长短不一的金色面条。','Jalur mi keemasan pelbagai panjang tergantung pada rangka kayu di hadapan dinding kelabu kebiruan.'],
  S01: ['奶油色扇形门楣与黄色新月引向四个蜜色橡木陈列区，过道旁还有品牌沿革和食用介绍。','Bingkai berlekuk warna krim dan bulan sabit kuning menghala ke empat ruang pameran kayu oak madu, dengan kisah warisan dan hidangan di tepi lorong.'],
  S02: ['低矮的漆面出餐台与宽大的铜色排烟罩围出备餐区，调味料就在手边。','Kaunter hidangan berkemasan lakuer dan hud tembaga lebar membingkai tempat penyediaan makanan, dengan perasa dalam jangkauan.'],
  S03: ['波浪边阳伞和小巧雪糕车，把街边冰品摊带进室内。','Payung bertepi berlekuk dan troli aiskrim kecil membawa suasana gerai pencuci mulut sejuk ke dalam bangunan.'],
  S04: ['鼠尾草绿样品台展开成巨大的折叠册，白色内页陈列素面贴片卡。','Kaunter sampel hijau sage terbuka seperti folio lipat besar, dengan kad tampalan polos pada helaian putih.'],
  S05: ['层叠的深木色抽屉环绕着一只浅色瓷碗，呈现安静的药铺。','Deretan laci kayu gelap bertingkat mengelilingi sebuah mangkuk porselin pucat di ruang apotek yang tenang.'],
  S12: ['错落的磨砂分隔片从低矮的白色陈列台升起，在台面投下蓝绿色阴影。','Panel indeks legap yang berselang-seli menjulang dari pameran putih rendah dan membentuk bayang biru kehijauan.'],
  S13: ['背光勾勒出耳机轮廓，深灰色毛毡试听台营造出适合近距离体验的音响展厅。','Siluet fon kepala bercahaya latar menghidupkan ruang pameran audio yang redup dengan kaunter dengar berfelt arang.'],
  S14: ['两面错落的屏幕围出象牙色软装客厅，像一间明亮的家庭影院。','Dua skrin berselang membingkai ruang tamu berkemasan gading seperti pawagam rumah yang cerah.'],
  S15: ['掀开的琴盖在胡桃木格栅前划出斜线，琴身下是打着暖白光的矮舞台。','Penutup piano yang terangkat membentuk garis pepenjuru di hadapan bilah kayu walnut, dengan pentas rendah bercahaya gading di bawahnya.'],
  S16: ['青绿色穿孔工具板上排着一组大号空心环孔，下方是小型追踪器演示台。','Papan alatan teal berlubang memuatkan deretan gegelang besar di atas meja demonstrasi penjejak kecil.'],
  S17: ['温暖的走廊尽头，山墙形毛毡壁龛内摆着一部实际尺寸的无线电话。','Relung telefon berfelt berbumbung segi tiga menempatkan gagang tanpa wayar bersaiz sebenar di hujung koridor yang hangat.']
};

export function tramCaptionCopy(shop, language) {
  const index = language === 'zh-Hans' ? 0 : language === 'ms' ? 1 : -1;
  const direction = ['在左侧','Di sebelah kiri'][index] ?? shop.direction;
  return {heading:`${shop.name} · ${direction}`, feature:translations[shop.id]?.[index] ?? shop.feature};
}
