const copy = (tagline, deck, eyebrow, description) => ({ tagline, deck, eyebrow, description });
const locale = (zh, ms) => ({ zh: copy(...zh), ms: copy(...ms) });

export const designCopy = {
  '01-growth-editorial': locale(
    ['一起成长，有更好的方式。', '把网店、WhatsApp 订单和日常运营连起来，配合你现有的工作方式。', 'Pomelo STEM · 商务互联', '独立杂志风格，大字号、低调橄榄绿和鲜明的双栏构图。'],
    ['Cara yang lebih baik untuk berkembang bersama.', 'Hubungkan kedai dalam talian, pesanan WhatsApp dan operasi harian mengikut cara anda bekerja.', 'Pomelo STEM · Perdagangan bersepadu', 'Gaya majalah bebas dengan tipografi besar, warna zaitun lembut dan susun atur dua bahagian.'],
  ),
  '02-olive-atelier': locale(
    ['让复杂的事变简单。', '和每天使用工具的人一起，规划网店、AI 工作流程或定制系统。', '用心设计的数字系统', '低调精致的工作室风格：居中排版、深绿底色和少量铜色点缀。'],
    ['Mudahkan perkara yang rumit.', 'Rancang kedai, aliran kerja AI atau sistem tersuai bersama orang yang akan menggunakannya setiap hari.', 'Sistem digital · Direka dengan teliti', 'Gaya studio yang bersahaja dan halus, dengan susunan berpusat, hijau gelap dan sentuhan tembaga.'],
  ),
  '03-systems-blueprint': locale(
    ['每笔订单背后，都有一套清晰流程。', '让客户订单、库存和交接串成团队容易跟进的流程。', '订单 · 库存 · 履约', '冷色建筑蓝图风格：侧栏注释、技术字体与严谨网格。'],
    ['Satu pelan untuk semua kerja di sebalik pesanan.', 'Hubungkan pesanan pelanggan, stok dan serahan tugas dalam aliran kerja yang mudah diikuti oleh pasukan anda.', 'Pesanan · Stok · Pemenuhan pesanan', 'Gaya pelan seni bina bernada sejuk, dengan anotasi di sisi, tipografi teknikal dan grid yang kemas.'],
  ),
  '04-human-first': locale(
    ['好工具，让人有更多空间。', '让客户轻松浏览或提问，也让团队能够审核订单并跟进。', '为每天使用工具的人而设计', '温暖、以人为本的设计：莓果色细节、柔和线条，以及叠在大幅插图上的文案。'],
    ['Alat yang baik memberi lebih ruang kepada manusia.', 'Mudahkan pelanggan melihat produk atau bertanya, kemudian beri ruang kepada pasukan anda untuk menyemak pesanan dan membuat susulan.', 'Direka untuk mereka yang menjalankan kerja', 'Reka bentuk mesra dengan aksen warna beri, bentuk lembut dan teks yang dilapis di atas ilustrasi lebar.'],
  ),
  '05-operations-ledger': locale(
    ['从询问到履约，每一步都更清楚。', '看看网店、WhatsApp 对话和内部订单系统如何配合。', '有条理的销售与运营', '紧凑的商务风格：分隔线、整齐排列和低调的工业黄。'],
    ['Lebih jelas dari pertanyaan hingga pesanan dipenuhi.', 'Lihat bagaimana kedai dalam talian, perbualan WhatsApp dan sistem pesanan dalaman boleh berfungsi bersama.', 'Perdagangan dan operasi · Lebih teratur', 'Gaya perniagaan yang padat, dengan garisan pembahagi, penjajaran kemas dan kuning industri yang lembut.'],
  ),
  '06-citrus-grid': locale(
    ['让每笔订单都知道该往哪走。', '把网店、WhatsApp 咨询与后台处理串起来，交给团队按流程跟进。', '商务互联', '明亮的柑橘色拼贴网格，把订单的不同阶段分成易辨认的色块。'],
    ['Setiap pesanan ada laluan yang jelas.', 'Satukan kedai dalam talian, pertanyaan WhatsApp dan kerja dalaman dalam satu aliran kerja untuk pasukan anda.', 'Perdagangan bersepadu', 'Grid bento berwarna sitrus yang ceria membezakan setiap langkah pesanan melalui blok warna.'],
  ),
  '07-operator-blue': locale(
    ['把运营看得更清楚。', '在同一个运营视图里，查看订单审核、库存和履约步骤。', '企业运营', '控制室面板风格，突出流程标签、任务交接与清晰分组。'],
    ['Lihat kerja operasi dengan lebih jelas.', 'Lihat semakan pesanan, inventori dan langkah pemenuhan dalam satu paparan operasi.', 'Operasi perniagaan', 'Panel seperti bilik kawalan yang mengutamakan label aliran kerja, serahan tugas dan kumpulan maklumat yang jelas.'],
  ),
  '08-market-signal': locale(
    ['从聊商品，到确认订单。', '让客户看见产品后，直接通过 WhatsApp 与团队沟通。', '从店面到对话', '醒目的市场海报风格，用大字与橙色指引提示顾客下一步。'],
    ['Daripada perbualan kepada pesanan.', 'Beri pelanggan laluan ringkas daripada melihat produk kepada berbual melalui WhatsApp dengan pasukan anda.', 'Dari kedai ke ruang sembang', 'Gaya poster pasar yang berani, dengan huruf besar dan petunjuk jingga yang menunjukkan langkah seterusnya.'],
  ),
  '09-stem-terminal': locale(
    ['连接你已经在用的工具。', '打通商品目录、消息、AI 工具和团队系统，不必一次换掉所有工具。', '系统集成', '克制的终端界面，把输入、核对和交接排成清晰的步骤。'],
    ['Hubungkan alat yang sudah anda gunakan.', 'Sambungkan katalog, mesej, alat AI dan sistem pasukan tanpa menggantikan semuanya sekali gus.', 'Penyepaduan sistem', 'Antara muka terminal yang ringkas, dengan urutan input, semakan dan serahan tugas yang mudah dibaca.'],
  ),
  '10-workbench': locale(
    ['先做好一项有用的改进。', '选一个想改善的客户环节或团队流程，再一起测试。', '打造实用的数字工具', '亲切的工作台风格，用圆角卡片和有质感的示意图呈现服务选项。'],
    ['Mulakan dengan satu penambahbaikan yang berguna.', 'Pilih satu langkah perjalanan pelanggan atau proses pasukan yang ingin anda baiki, kemudian uji bersama.', 'Pembina alat digital praktikal', 'Gaya meja kerja yang mesra, dengan kad bersudut lembut dan rajah bertekstur untuk meneroka pilihan perkhidmatan.'],
  ),
  '11-market-pop': locale(
    ['好逛的商店，从这里开始。', '让顾客从看见第一件商品，到通过对话确认订单，都有清晰的下一步。', '有个性的在线购物', '活动海报、芒果色点缀和利落墨线，让日常购物更亲切、直接。'],
    ['Pengalaman membeli-belah yang baik bermula di sini.', 'Beri pelanggan laluan yang jelas daripada produk pertama yang mereka lihat hingga perbualan untuk mengesahkan pesanan.', 'Perdagangan dengan gaya tersendiri', 'Poster kempen, aksen warna mangga dan garisan dakwat yang kemas menjadikan pembelian harian mesra dan terus terang.'],
  ),
  '12-straits-index': locale(
    ['每个小细节，都是系统的一部分。', '把网店、WhatsApp 对话和团队收到订单后的处理步骤串起来。', '实用商务索引', '墨蓝与本色纸构成编辑索引，像一本排版讲究的参考书。'],
    ['Butiran kecil membentuk sistem yang baik.', 'Hubungkan kedai, perbualan WhatsApp dan langkah yang diuruskan pasukan selepas setiap pesanan.', 'Indeks perniagaan yang praktikal', 'Indeks bergaya editorial dalam biru dakwat dan warna kertas asli, seperti buku rujukan yang disusun rapi.'],
  ),
  '13-kedai-side': locale(
    ['熟悉的购物方式，更清晰的工作流程。', '顾客可以在线选购，也可在 WhatsApp 咨询；两条路径最终交给同一个团队处理。', '围绕日常工作设计', '温暖的街坊店铺色调与醒目的侧栏，让技术像社区的一部分一样亲切可靠。'],
    ['Cara membeli yang biasa. Cara bekerja yang lebih jelas.', 'Beri pelanggan pilihan untuk membeli dalam talian atau bertanya melalui WhatsApp, kemudian satukan kedua-dua laluan itu untuk pasukan anda.', 'Direka untuk kerja harian', 'Warna kedai kejiranan yang hangat dan panel sisi yang jelas membuatkan teknologi terasa dekat dan boleh diharap.'],
  ),
  '14-field-lab': locale(
    ['用更好的工具，解决实际工作。', '把 AI、订单与业务数据放进同一流程，决策仍由团队掌握。', '应用系统工作室', '群青色实验室框架与高辨识度标签，把每条流程的运作方式清楚展示出来。'],
    ['Alat yang lebih baik untuk kerja sebenar.', 'Satukan AI, pesanan dan data perniagaan dalam satu aliran kerja, dengan keputusan kekal di tangan pasukan anda.', 'Studio sistem gunaan', 'Bingkai makmal biru ultramarin dan label yang mudah dilihat menerangkan cara setiap aliran kerja berfungsi.'],
  ),
  '15-orbital-grid': locale(
    ['环节再多，也能看得清楚。', '连接网店、对话和内部工具，让关键交接保持清晰。', '互联商务系统', '深夜色调、星轨示意图与柔和青色，把多项服务连成一套视觉系统。'],
    ['Pastikan setiap bahagian yang bergerak jelas kelihatan.', 'Hubungkan kedai, perbualan dan alat dalaman sambil memastikan serahan tugas penting kekal jelas.', 'Sistem perdagangan bersepadu', 'Warna gelap, rajah orbit dan sian lembut menyatukan pelbagai perkhidmatan dalam satu sistem visual.'],
  ),
  '16-market-almanac': locale(
    ['更好的日常流程，带来更顺畅的生意。', '把网店、WhatsApp 订单和团队用来跟进工作的系统连起来。', '把生意的日常做好', '市集手册风格：围裙蓝、交易凭条细节，以及亲切的编辑排版。'],
    ['Urus niaga yang lebih baik bermula dengan rutin yang lebih tersusun.', 'Sambungkan kedai dalam talian, pesanan WhatsApp dan sistem yang membantu pasukan anda membuat susulan.', 'Kerja harian di sebalik perdagangan', 'Brosur gaya hari pasar dengan biru apron, perincian slip jualan dan susun atur editorial yang mesra.'],
  ),
  '17-clear-room': locale(
    ['把复杂流程变清楚。', '让顾客更清楚如何下单，也让团队在同一个地方知道接下来该做什么。', '设计，就是为了让人看懂', '居中的企业设计：沉稳森林绿、柔和放射背景与边界清晰的模块卡片。'],
    ['Jadikan proses rumit lebih mudah difahami.', 'Beri pelanggan cara yang lebih jelas untuk memesan dan satu tempat untuk pasukan melihat apa yang perlu dibuat seterusnya.', 'Direka supaya mudah difahami', 'Konsep korporat berpusat dengan hijau hutan yang tenang, latar jejari lembut dan kad modular yang kemas.'],
  ),
  '18-signal-canvas': locale(
    ['把各个环节连起来。', '把线上销售、客户对话和日常运营，整合成适合团队的工作流程。', '为真实运营而设计', '钴蓝色数字创作画布，配有胶带细节、超大排字和醒目的接线板插图。'],
    ['Hubungkan bahagian yang saling berkait.', 'Satukan jualan dalam talian, perbualan dan operasi harian dalam aliran kerja yang sesuai dengan pasukan anda.', 'Reka bentuk untuk kerja operasi sebenar', 'Kanvas kraf digital biru kobalt, dengan butiran pita studio, teks besar dan ilustrasi panel sambungan yang terang.'],
  ),
  '19-field-guide': locale(
    ['从第一条消息到交付，路径更清楚。', '看看客户提问、商品选择和订单如何流转到适合跟进的人手里。', '跟着订单走', '野外手记式设计，用桉叶绿纸色、路线图和分步骤面板来讲故事。'],
    ['Laluan yang lebih jelas dari mesej pertama hingga pemenuhan pesanan.', 'Lihat bagaimana soalan pelanggan, pilihan produk dan pesanan boleh disalurkan kepada orang yang tepat.', 'Ikuti perjalanan pesanan', 'Gaya jurnal lapangan dengan rona kertas hijau eukaliptus, ilustrasi jejak dan panel langkah demi langkah.'],
  ),
  '20-copper-foundry': locale(
    ['一步一步，打造更稳的运营。', '把网店、下单对话和交付所需的工具在关键环节接起来。', '实用系统，细心打造', '高对比工业风格：暖铜细节、深钢色背景，双栏中插图先入眼。'],
    ['Bina operasi yang lebih kukuh, satu bahagian demi satu.', 'Bina hubungan yang tepat antara kedai, perbualan pesanan dan alat yang digunakan untuk memenuhi pesanan.', 'Sistem praktikal, dibina dengan teliti', 'Gaya industri berkontras tinggi dengan perincian tembaga hangat, latar keluli gelap dan ilustrasi sebagai tumpuan susun atur terbahagi.'],
  ),
};
