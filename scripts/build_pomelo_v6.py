"""Generate Pomelo STEM V6 static pages from a single multilingual content source."""
from pathlib import Path
from html import escape
import importlib.util
import posixpath
import argparse
import json
import hashlib
import base64

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'demos/corporate/pomelo-stem/v6'
spec=importlib.util.spec_from_file_location('pomelo_v5_copy',ROOT/'scripts/build_pomelo_showcase.py')
prior=importlib.util.module_from_spec(spec)
spec.loader.exec_module(prior)
PAGES=('index','solutions','online-shopping','whatsapp-orders','ai-integration','custom-systems','showcase','how-it-works','about','contact')
SERVICE_PAGES=('online-shopping','whatsapp-orders','ai-integration','custom-systems')
RELEASE=json.loads((OUT/'release.json').read_text(encoding='utf-8'))
VERSION=RELEASE['version']
if not __import__('re').fullmatch(r'\d+\.\d+\.\d+', VERSION):
 raise ValueError('Invalid Pomelo V6 version')
def integrity(name):
 data=(OUT/'assets'/name).read_bytes()
 return 'sha256-'+base64.b64encode(hashlib.sha256(data).digest()).decode()
ICONS={
 'language':'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18"/></svg>',
 'theme':'<svg class="sun" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1m0-15.6-2.1 2.1M6.3 17.7l-2.1 2.1"/></svg><svg class="moon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg>',
 'update':'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 12-2L20 12M4 12l2.4 5a7 7 0 0 0 12-2"/></svg>',
 'menu':'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
}
UPDATE_COPY={
'en':('Check update','Checking for updates…','Up to date.','Update available','Update now','Unable to check. Check your connection and retry.','Retry','Current version','Latest version','Updating reloads this page and resets the demo. Continue?','Update applied.','Update could not be verified. Retry.','Checking is unavailable without JavaScript.'),
'zh':('检查更新','正在检查更新…','已是最新版本。','发现新版本','立即更新','无法检查更新，请检查网络后重试。','重试','当前版本','最新版本','更新会重新加载页面并重置演示，继续吗？','更新成功。','无法验证更新，请重试。','检查更新需要 JavaScript。'),
'ms':('Semak kemas kini','Menyemak kemas kini…','Versi terkini.','Kemas kini tersedia','Kemas kini sekarang','Tidak dapat menyemak. Periksa sambungan dan cuba lagi.','Cuba lagi','Versi semasa','Versi terkini','Kemas kini akan memuat semula halaman dan menetapkan semula demo. Teruskan?','Kemas kini berjaya.','Kemas kini tidak dapat disahkan. Cuba lagi.','Semakan memerlukan JavaScript.')
}
COPY={
'en':{
'nav':['Home','Solutions','Showcase','How It Works','About','Contact'],'home_tag':'PRACTICAL TECHNOLOGY FOR GROWING BUSINESSES',
'home_title':'See your business come together.','home_desc':'Connect your store, customers, orders, and team with practical technology built around the way your business works.',
'explore_solutions':'Explore Solutions','view_showcase':'View Showcase','solutions_title':'Solutions for every next step.','solutions_desc':'Start with the challenge that matters most to your business.',
'showcase_title':'See the possibilities.','showcase_desc':'Explore illustrative interfaces and examples for your store, orders, and team.','demo_note':'Demo only. No real order, message or AI request is sent.',
'store':'Store Preview','conversation':'Order Conversation','ai':'Assisted Draft','systems':'Team Handoff',
'try_it':'Try this example','reset':'Reset Demo','add':'Add to Demo Basket','basket_empty':'Demo basket: empty','basket_added':'Demo basket: 1 example product','demo_product':'Sample connector','product_desc':'An illustrative product for this demonstration.',
'choose':'Choose a receiving method','select_placeholder':'Select an option','pickup':'Customer pickup','delivery':'Delivery','review':'Review Order','confirm':'Confirm Example','waiting':'Waiting for review','missing':'Choose a receiving method first.','reviewed':'Details ready for merchant review.','confirmed':'Confirmed by merchant — example only.',
'draft':'Prepare Example Draft','draft_initial':'No draft prepared.','draft_ready':'Example draft: 2 connectors. Receiving method still needs confirmation.','check':'Review Complete','draft_reviewed':'Reviewed by a person — example only.',
'team_initial':'Confirmed order · Awaiting team handoff','mark':'Mark Ready to Prepare','team_ready':'Ready to prepare — example only.',
'details':'What it shows','howtry':'How to try it','related':'View Related Solution','service_detail':'Explore this solution','learn':'Learn More',
'order_tag':'ONE ORDER. A CLEARER JOURNEY.','order_title':'From the first question to the next step.','order_desc':'Follow an illustrative order as a customer enquiry is reviewed, confirmed, and prepared for the next step.','follow':'Follow the Journey',
'promise_tag':'OUR APPROACH','promise_title':'Understand your business. Build what helps.','promise_desc':'We start by listening to how your team works. Together, we can explore practical solutions that support your needs and grow with your business.','about_link':'About Pomelo STEM',
'cta_title':'Let’s make your next step clearer.','cta_desc':'Tell us which part of your business you would like to improve.','talk':'Talk to Us',
'about_tag':'ABOUT POMELO STEM','about_title':'Growing smarter solutions, together.','about_desc':'Pomelo STEM explores practical technology and commerce solutions for small and growing businesses.','purpose':'Our purpose','purpose_text':'Help growing teams use technology with confidence, starting from their real needs.','mission':'Our mission','mission_text':'Help businesses work better and grow with practical technology built around their needs.','vision':'Our vision','vision_text':'A future where every growing business can use technology with confidence.','proposed':'Mission and vision wording is proposed for this concept.',
'values_title':'How we work','values':['Useful','Clear','Reliable','Human-centred'],'value_text':['Solve a real problem.','Make the next step understandable.','Pay attention to testing and handoffs.','Design around the people using the solution.'],
'how_title':'From the first question to the next step.','how_desc':'Follow an illustrative order, then see how we can work together.','working':'Working together','working_names':['Discover','Discuss','Build & Test','Improve'],'working_desc':['Understand your goals and workflow.','Agree the problem, scope and next steps.','Build and check the agreed solution.','Learn from use and improve together.'],
'service_tag':'SOLUTIONS','service_titles':['Give your products a place to be discovered.','Turn conversations into clearer orders.','Practical AI, guided by your team.','Built around the way your business works.'],
'service_steps':[['Discover products','Explore the details','Choose the next step'],['Customer inquiry','Review details','Confirm and hand off'],['Organise information','Prepare a draft','Review and decide'],['Understand your workflow','Connect the information','Improve together']],
'service_cta':['View Store Preview','View Order Example','See the AI Example','Explore Workflow'],
'help_title':'Start with the challenge you want to solve.','help_desc':'Choose a starting point. Each solution can be discussed around your actual workflow.','needs':['I want customers to discover products.','I need to organise customer enquiries.','My team has repetitive work.','Our existing workflow needs support.'],
'product_preview':'Product Showcase','showcase_kicker':'EXPLORE THE POSSIBILITIES','preview_tag':'Interactive concept previews','intro_demo':'Choose an example and follow the steps.','preview_hint':'All names and data are fictional. State resets when you refresh.',
'noscript':'Interactive controls require JavaScript. The explanations and navigation remain available.','nav_label':'Main navigation','menu':'Menu','close':'Close','theme_dark':'Dark mode','theme_light':'Light mode','language':'Language','loading':'Preparing your experience',
'contact_title':'Tell us what you want to improve.','contact_desc':'A useful starting point is one process that takes too much time or needs too much follow-up.','contact_heading':'Prepare for a conversation','contact_steps':['Choose the business task you want to improve.','Describe the people involved and where work gets delayed.','Use a fictional or redacted example without personal or payment information.'],'contact_example':'An example to adapt','contact_sample':'We receive product enquiries through messages. We want our team to confirm details and pass approved orders to the people preparing them.','contact_note':'This Gallery concept does not send or collect messages. Call the number or visit the official site to contact Pomelo STEM.','contact_button':'Visit the official site',
'footer':'Independent concept. Illustrative interfaces and examples.','tagline':'Growing Smarter Solutions','skip':'Skip to content',
'live_store':'Online Shopping','live_wa':'WhatsApp Orders','live_ai':'AI Integration','live_sys':'Custom Systems'
},
'zh':{
'nav':['首页','解决方案','产品展示','运作方式','关于我们','联系我们'],'home_tag':'为成长中的企业打造实用科技',
'home_title':'让你的业务，连接起来。','home_desc':'用贴近实际工作方式的科技，连接你的商店、顾客、订单与团队。',
'explore_solutions':'探索解决方案','view_showcase':'查看产品展示','solutions_title':'每一步，都有合适的解决方案。','solutions_desc':'从企业最需要解决的问题开始。',
'showcase_title':'看看更多可能。','showcase_desc':'探索商店、订单和团队工作空间的示意界面与使用示例。','demo_note':'仅供演示，不会发送真实订单、消息或 AI 请求。',
'store':'商店预览','conversation':'订单对话','ai':'辅助草稿','systems':'团队交接',
'try_it':'体验示例','reset':'重置演示','add':'加入示例购物篮','basket_empty':'示例购物篮：空','basket_added':'示例购物篮：1 件示例商品','demo_product':'示例连接器','product_desc':'供此演示使用的示例商品。',
'choose':'选择领取方式','select_placeholder':'请选择','pickup':'顾客自取','delivery':'送货','review':'审核订单','confirm':'确认示例','waiting':'等待审核','missing':'请先选择领取方式。','reviewed':'资料已准备好，等待商家审核。','confirmed':'商家已确认——仅为示例。',
'draft':'准备示例草稿','draft_initial':'尚未准备草稿。','draft_ready':'示例草稿：2 只连接器。领取方式仍待确认。','check':'完成审核','draft_reviewed':'已由人员审核——仅为示例。',
'team_initial':'已确认订单 · 等待团队交接','mark':'标记为准备处理','team_ready':'已准备处理——仅为示例。',
'details':'展示什么','howtry':'如何体验','related':'查看相关解决方案','service_detail':'探索此方案','learn':'了解更多',
'order_tag':'一张订单，更清楚的旅程','order_title':'从第一条询问，到清楚的下一步。','order_desc':'跟随一个示例订单，看看顾客询问如何经过审核和确认，并准备进入下一步。','follow':'探索订单旅程',
'promise_tag':'我们的工作方式','promise_title':'理解你的业务，打造有用的方案。','promise_desc':'我们从了解团队的实际工作方式开始，一起探索贴近需求、能够随着业务逐步成长的实用方案。','about_link':'了解 Pomelo STEM',
'cta_title':'让下一步，更清楚。','cta_desc':'告诉我们，你希望改善哪一个业务环节。','talk':'联系我们',
'about_tag':'关于 POMELO STEM','about_title':'一起让更聪明的方案成长。','about_desc':'Pomelo STEM 为中小企业和成长中的团队探索实用的科技与商业方案。','purpose':'我们的目标','purpose_text':'从真实需求出发，帮助成长中的团队更有信心地使用科技。','mission':'我们的使命','mission_text':'用贴近需求的实用科技，帮助企业改善工作方式并成长。','vision':'我们的愿景','vision_text':'让每一家成长中的企业，都能有信心地使用科技。','proposed':'此概念中的使命与愿景文字为建议稿。',
'values_title':'我们的工作方式','values':['有用','清楚','可靠','以人为本'],'value_text':['解决真实问题。','让下一步更容易理解。','重视测试和交接。','围绕使用者设计方案。'],
'how_title':'从第一条询问，到清楚的下一步。','how_desc':'先看一张示例订单，再了解我们怎样一起合作。','working':'一起合作','working_names':['了解','讨论','开发与测试','改善'],'working_desc':['了解目标与工作流程。','确定问题、范围和下一步。','开发并检查约定的方案。','根据使用反馈持续改善。'],
'service_tag':'解决方案','service_titles':['让顾客更容易发现你的商品。','让顾客对话转化成更清楚的订单。','实用 AI，由你的团队掌握决定权。','根据你的业务工作方式打造。'],
'service_steps':[['发现商品','了解详情','选择下一步'],['顾客询问','核对资料','确认并交接'],['整理资料','准备草稿','审核与决定'],['理解工作流程','连接所需资料','一起改善']],
'service_cta':['查看商店预览','查看订单示例','查看 AI 示例','探索工作流程'],
'help_title':'从你想解决的问题开始。','help_desc':'选择一个起点。每项方案都可以围绕你的实际工作流程讨论。','needs':['我想让顾客发现商品。','我需要整理顾客询问。','团队有重复工作。','我们的工作流程需要改善。'],
'product_preview':'产品展示','showcase_kicker':'探索更多可能','preview_tag':'互动概念展示','intro_demo':'选择一个示例并跟随步骤。','preview_hint':'名称和资料均为虚构，刷新页面会重置状态。',
'noscript':'互动操作需要 JavaScript；说明和导航仍可阅读。','nav_label':'主导航','menu':'菜单','close':'关闭','theme_dark':'深色模式','theme_light':'浅色模式','language':'语言','loading':'正在准备页面',
'contact_title':'告诉我们你想改善什么。','contact_desc':'可以从一个耗时或需要反复跟进的流程开始。','contact_heading':'联系前可以准备','contact_steps':['选择想要改善的业务工作。','说明涉及哪些人，以及工作在哪个环节延迟。','使用虚构或已去除敏感资料的例子，不要包含个人或付款资料。'],'contact_example':'可以参考的例子','contact_sample':'我们通过消息接收商品询问，希望团队能确认细节，并把已批准订单交给负责准备的同事。','contact_note':'此 Gallery 概念不会发送或收集消息。可拨打电话或前往官方网站联系 Pomelo STEM。','contact_button':'前往官方网站',
'footer':'独立概念展示。界面与故事均为示例。','tagline':'Growing Smarter Solutions','skip':'跳至内容',
'live_store':'线上购物','live_wa':'WhatsApp 订单','live_ai':'AI 整合','live_sys':'定制系统'
},
'ms':{
'nav':['Utama','Penyelesaian','Pameran','Cara Ia Berfungsi','Tentang Kami','Hubungi Kami'],'home_tag':'TEKNOLOGI PRAKTIKAL UNTUK PERNIAGAAN YANG BERKEMBANG',
'home_title':'Satukan urusan perniagaan anda.','home_desc':'Hubungkan kedai, pelanggan, pesanan dan pasukan anda dengan teknologi praktikal yang sesuai dengan cara perniagaan anda bekerja.',
'explore_solutions':'Terokai Penyelesaian','view_showcase':'Lihat Pameran','solutions_title':'Penyelesaian untuk setiap langkah.','solutions_desc':'Mulakan dengan cabaran yang paling penting untuk perniagaan anda.',
'showcase_title':'Lihat pelbagai kemungkinan.','showcase_desc':'Terokai contoh antara muka untuk kedai, pesanan dan pasukan anda.','demo_note':'Demo sahaja. Tiada pesanan, mesej atau permintaan AI sebenar dihantar.',
'store':'Pratonton Kedai','conversation':'Perbualan Pesanan','ai':'Draf Bantuan','systems':'Serahan Pasukan',
'try_it':'Cuba contoh ini','reset':'Tetapkan Semula Demo','add':'Tambah ke Bakul Demo','basket_empty':'Bakul demo: kosong','basket_added':'Bakul demo: 1 produk contoh','demo_product':'Penyambung contoh','product_desc':'Produk contoh untuk demonstrasi ini.',
'choose':'Pilih kaedah penerimaan','select_placeholder':'Sila pilih','pickup':'Pengambilan pelanggan','delivery':'Penghantaran','review':'Semak Pesanan','confirm':'Sahkan Contoh','waiting':'Menunggu semakan','missing':'Pilih kaedah penerimaan dahulu.','reviewed':'Butiran sedia untuk semakan peniaga.','confirmed':'Disahkan oleh peniaga — contoh sahaja.',
'draft':'Sediakan Draf Contoh','draft_initial':'Draf belum disediakan.','draft_ready':'Draf contoh: 2 penyambung. Kaedah penerimaan masih perlu disahkan.','check':'Selesai Semakan','draft_reviewed':'Disemak oleh manusia — contoh sahaja.',
'team_initial':'Pesanan disahkan · Menunggu serahan pasukan','mark':'Tanda Sedia Disediakan','team_ready':'Sedia disediakan — contoh sahaja.',
'details':'Apa yang ditunjukkan','howtry':'Cara mencuba','related':'Lihat Penyelesaian Berkaitan','service_detail':'Terokai penyelesaian','learn':'Ketahui Lebih Lanjut',
'order_tag':'SATU PESANAN. PERJALANAN YANG LEBIH JELAS.','order_title':'Daripada pertanyaan pertama ke langkah seterusnya.','order_desc':'Ikuti contoh pesanan apabila pertanyaan pelanggan disemak, disahkan dan disediakan untuk langkah seterusnya.','follow':'Ikuti Perjalanan',
'promise_tag':'CARA KAMI BEKERJA','promise_title':'Fahami perniagaan anda. Bina penyelesaian yang membantu.','promise_desc':'Kami bermula dengan memahami cara pasukan anda bekerja. Bersama-sama, kita boleh meneroka penyelesaian praktikal yang menyokong keperluan dan pertumbuhan perniagaan anda.','about_link':'Tentang Pomelo STEM',
'cta_title':'Mari jelaskan langkah anda yang seterusnya.','cta_desc':'Beritahu kami bahagian perniagaan yang ingin anda perbaiki.','talk':'Hubungi Kami',
'about_tag':'TENTANG POMELO STEM','about_title':'Membangunkan penyelesaian lebih bijak, bersama-sama.','about_desc':'Pomelo STEM meneroka penyelesaian teknologi dan perdagangan praktikal untuk perniagaan kecil dan pasukan yang berkembang.','purpose':'Tujuan kami','purpose_text':'Bantu pasukan yang berkembang menggunakan teknologi dengan yakin berdasarkan keperluan sebenar.','mission':'Misi kami','mission_text':'Membantu perniagaan bekerja lebih baik dan berkembang dengan teknologi praktikal berdasarkan keperluan mereka.','vision':'Visi kami','vision_text':'Masa depan di mana setiap perniagaan yang berkembang boleh menggunakan teknologi dengan yakin.','proposed':'Ayat misi dan visi ini dicadangkan untuk konsep ini.',
'values_title':'Cara kami bekerja','values':['Berguna','Jelas','Boleh dipercayai','Mengutamakan manusia'],'value_text':['Selesaikan masalah sebenar.','Jelaskan langkah seterusnya.','Utamakan ujian dan serahan.','Reka untuk orang yang menggunakannya.'],
'how_title':'Daripada pertanyaan pertama ke langkah seterusnya.','how_desc':'Ikuti contoh pesanan, kemudian lihat cara kita boleh bekerjasama.','working':'Bekerjasama','working_names':['Fahami','Bincang','Bina & Uji','Perbaiki'],'working_desc':['Fahami matlamat dan aliran kerja.','Setujui masalah, skop dan langkah seterusnya.','Bina dan semak penyelesaian yang dipersetujui.','Belajar daripada penggunaan dan terus perbaiki.'],
'service_tag':'PENYELESAIAN','service_titles':['Bantu pelanggan menemui produk anda.','Jadikan perbualan sebagai pesanan yang lebih jelas.','AI praktikal, dipandu oleh pasukan anda.','Dibina mengikut cara perniagaan anda bekerja.'],
'service_steps':[['Temui produk','Lihat butiran','Pilih langkah seterusnya'],['Pertanyaan pelanggan','Semak butiran','Sahkan dan serahkan'],['Susun maklumat','Sediakan draf','Semak dan putuskan'],['Fahami aliran kerja','Hubungkan maklumat','Perbaiki bersama']],
'service_cta':['Lihat Pratonton Kedai','Lihat Contoh Pesanan','Lihat Contoh AI','Terokai Aliran Kerja'],
'help_title':'Mulakan dengan cabaran yang ingin anda selesaikan.','help_desc':'Pilih satu permulaan. Setiap penyelesaian boleh dibincangkan berdasarkan aliran kerja sebenar anda.','needs':['Saya mahu pelanggan menemui produk.','Saya perlu menyusun pertanyaan pelanggan.','Pasukan saya mempunyai tugas berulang.','Aliran kerja kami perlu diperbaiki.'],
'product_preview':'Pameran Produk','showcase_kicker':'TEROKAI PELBAGAI KEMUNGKINAN','preview_tag':'Pratonton konsep interaktif','intro_demo':'Pilih contoh dan ikuti langkahnya.','preview_hint':'Semua nama dan data adalah rekaan. Keadaan demo ditetapkan semula apabila halaman dimuat semula.',
'noscript':'Kawalan interaktif memerlukan JavaScript; penerangan dan navigasi masih boleh dibaca.','nav_label':'Navigasi utama','menu':'Menu','close':'Tutup','theme_dark':'Mod gelap','theme_light':'Mod cerah','language':'Bahasa','loading':'Menyediakan halaman',
'contact_title':'Beritahu kami apa yang ingin anda perbaiki.','contact_desc':'Mulakan dengan satu proses yang mengambil masa atau memerlukan banyak susulan.','contact_heading':'Bersedia untuk berbincang','contact_steps':['Pilih tugas perniagaan yang ingin diperbaiki.','Terangkan siapa yang terlibat dan di mana kerja tertangguh.','Gunakan contoh rekaan tanpa maklumat peribadi atau pembayaran.'],'contact_example':'Contoh untuk disesuaikan','contact_sample':'Kami menerima pertanyaan produk melalui mesej. Kami mahu pasukan mengesahkan butiran dan menyerahkan pesanan yang diluluskan kepada pasukan penyediaan.','contact_note':'Konsep Gallery ini tidak menghantar atau mengumpul mesej. Telefon atau lawati laman rasmi untuk menghubungi Pomelo STEM.','contact_button':'Lawati laman rasmi',
'footer':'Konsep bebas. Antara muka dan kisah ialah contoh.','tagline':'Growing Smarter Solutions','skip':'Langkau ke kandungan',
'live_store':'Beli-belah Dalam Talian','live_wa':'Pesanan WhatsApp','live_ai':'Integrasi AI','live_sys':'Sistem Tersuai'
}}
def esc(v):return escape(str(v),quote=True)
def render(language,page):
 t=COPY[language]; q=prior.T[language]; u=UPDATE_COPY[language]
 loc='' if language=='en' else language+'/'
 asset='../v3/assets/' if language=='en' else '../../v3/assets/'
 product='../v2/assets/spl2.jpg' if language=='en' else '../../v2/assets/spl2.jpg'
 own='./assets/' if language=='en' else '../assets/'
 def link(p):return './'+p+'.html'
 lang_links=''
 for lng,label in [('en','English'),('zh','简体中文'),('ms','Bahasa Melayu')]:
  href=posixpath.relpath(('' if lng=='en' else lng+'/')+page+'.html',loc or '.')
  lang_links+=f'<a lang="{prior.T[lng]["lang"]}" href="{href}"'+(' aria-current="true"' if lng==language else '')+f'>{label}</a>'
 def nav():
  service_links=''.join(f'<a href="{link(p)}">{esc(q["service_names"][i])}</a>' for i,p in enumerate(SERVICE_PAGES))
  basic=[('index',0),('showcase',2),('how-it-works',3),('about',4),('contact',5)]
  first=f'<a href="{link("index")}"'+(' aria-current="page"' if page=='index' else '')+f'>{esc(t["nav"][0])}</a>'
  sol=f'<details class="nav-solutions"><summary'+(' aria-current="page"' if page in ('solutions',*SERVICE_PAGES) else '')+f'>{esc(t["nav"][1])} ▾</summary><div class="solution-menu"><a href="{link("solutions")}">{esc(t["explore_solutions"])}</a>{service_links}</div></details>'
  rest=''.join(f'<a href="{link(p)}"'+(' aria-current="page"' if page==p else '')+f'>{esc(t["nav"][i])}</a>' for p,i in basic[1:])
  return first+sol+rest
 doc_titles={'index':t['nav'][0],'solutions':t['nav'][1],'showcase':t['nav'][2],'how-it-works':t['nav'][3],'about':t['nav'][4],'contact':t['nav'][5],**{p:q['service_names'][i] for i,p in enumerate(SERVICE_PAGES)}}
 header=f"""<!doctype html><html lang="{q['lang']}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light dark"><title>{esc(doc_titles[page])} | Pomelo STEM</title><meta name="pomelo-version" content="{VERSION}"><script src="{own}boot.js?v={VERSION}" integrity="{integrity("boot.js")}"></script><link rel="stylesheet" href="{own}tokens.css?v={VERSION}" integrity="{integrity("tokens.css")}"><link rel="stylesheet" href="{own}site.css?v={VERSION}" integrity="{integrity("site.css")}"><script defer src="{own}app.js?v={VERSION}" integrity="{integrity("app.js")}"></script><script defer src="{own}update.js?v={VERSION}" integrity="{integrity("update.js")}"></script></head><body><div class="loader" aria-hidden="true"><div><img src="{asset}logo.png" alt="" width="70" height="70"><p>Pomelo STEM</p><span>{esc(t['loading'])}</span></div></div><a class="skip" href="#main">{esc(t['skip'])}</a><header class="site-header"><div class="wrap head-inner"><a class="brand" href="{link('index')}" aria-label="Pomelo STEM"><img src="{asset}logo.png" alt="" width="38" height="38"><span class="brand-copy">Pomelo STEM<small>{esc(t['tagline'])}</small></span></a><nav class="nav desktop-nav" aria-label="{esc(t['nav_label'])}">{nav()}</nav><div class="header-tools"><button class="theme-toggle" data-theme-toggle data-dark-label="{esc(t['theme_dark'])}" data-light-label="{esc(t['theme_light'])}" type="button" aria-pressed="false"><span class="theme-icons">{ICONS["theme"]}</span><span class="sr-only" data-theme-label>{esc(t['theme_dark'])}</span></button><details class="languages"><summary aria-label="{esc(t["language"])}" title="{esc(t["language"])}">{ICONS["language"]}<span>{esc({"en":"EN","zh":"中文","ms":"BM"}[language])}</span></summary><div class="languages-menu">{lang_links}</div></details><details class="update-control" data-current="{VERSION}" data-checking="{esc(u[1])}" data-current-message="{esc(u[2])}" data-available="{esc(u[3])}" data-error="{esc(u[5])}" data-confirm="{esc(u[9])}" data-success="{esc(u[10])}" data-unverified="{esc(u[11])}" data-latest="{esc(u[8])}" data-manifest="{("../" if language != "en" else "./")}release.json"><summary title="{esc(u[0])}" aria-label="{esc(u[0])} · v{VERSION}">{ICONS["update"]}<span>v{VERSION}</span></summary><div class="update-menu"><strong>{esc(u[0])}</strong><p>{esc(u[7])}: <b>v{VERSION}</b></p><p role="status" aria-live="polite" data-update-status>{esc(u[12])}</p><button type="button" data-update-retry hidden>{esc(u[6])}</button><button type="button" data-update-apply hidden>{esc(u[4])}</button></div></details><details class="menu"><summary aria-label="{esc(t['menu'])}">{ICONS["menu"]}</summary><nav class="mobile-menu" aria-label="{esc(t['nav_label'])}">{nav()}</nav></details><a class="header-cta" href="{link('contact')}">{esc(t['talk'])}</a></div></div></header>"""
 def intro(tag,title,desc):return f'<section class="page-intro"><div class="wrap"><p class="eyebrow">{esc(tag)}</p><h1>{esc(title)}</h1><p>{esc(desc)}</p></div></section>'
 faq_copy={'en':('Frequently asked questions','What is this solution intended to help with?','Does the preview make real changes?'),'zh':('常见问题','这个方案希望帮助解决什么？','预览会产生真实操作吗？'),'ms':('Soalan lazim','Apakah tujuan penyelesaian ini?','Adakah pratonton membuat perubahan sebenar?')}
 def cta():return f'<section class="v6-cta"><div class="wrap v6-cta-inner"><div><h2>{esc(t["cta_title"])}</h2><p>{esc(t["cta_desc"])}</p></div><a class="button" href="{link("contact")}">{esc(t["talk"])} ↗</a></div></section>'
 cards=''.join(f'<a class="service-card" href="{link(p)}"><span class="service-num">0{i+1}</span><h3>{esc(q["service_names"][i])}</h3><p>{esc(q["service_desc"][i])}</p><span class="card-link">{esc(t["learn"])} ↗</span></a>' for i,p in enumerate(SERVICE_PAGES))
 mock=f"""<div class="mock v6-dashboard"><div class="mock-head"><span>{esc(q['mock_label'])}</span><span class="badge">{esc(q['concept'])}</span></div><div class="v6-dashboard-top"><span>{esc(q['mock_title'])}</span><small>{esc(q['mock_note'])}</small></div><div class="mock-body"><div class="mock-card"><strong>{esc(q['mock_products'])}</strong><img src="{product}" alt=""><h3>{esc(t['demo_product'])}</h3><p>{esc(t['product_desc'])}</p></div><div class="mock-card"><strong>{esc(q['mock_orders'])}</strong><div class="mock-order"><strong>PS-0124</strong>{esc(q['status1'])}</div><div class="mock-order"><strong>PS-0125</strong>{esc(q['status2'])}</div></div></div><div class="mock-footer">{esc(t['demo_note'])}</div></div>"""
 if page=='index':
  main=f"""<main id="main"><section class="hero"><div class="wrap hero-grid"><div><p class="eyebrow">{esc(t['home_tag'])}</p><h1>{esc(t['home_title'])}</h1><p>{esc(t['home_desc'])}</p><div class="buttons"><a class="button" href="{link('solutions')}">{esc(t['explore_solutions'])} ↗</a><a class="button secondary" href="{link('showcase')}">{esc(t['view_showcase'])}</a></div></div>{mock}</div></section><section class="section section-tint"><div class="wrap"><div class="section-head"><div><p class="eyebrow">{esc(q['services_kicker'])}</p><h2>{esc(q['services_title'])}</h2></div><p>{esc(q['services_desc'])}</p></div><div class="services-grid">{cards}</div></div></section><section class="section"><div class="wrap v6-spotlight"><div><p class="eyebrow">{esc(t['showcase_kicker'])}</p><h2>{esc(t['showcase_title'])}</h2><p>{esc(t['showcase_desc'])}</p><a class="button" href="{link('showcase')}">{esc(t['view_showcase'])} ↗</a></div><div class="v6-spotlight-art"><span class="badge">{esc(q['concept'])}</span><div class="v6-spotlight-grid"><span>01<br>{esc(t['live_store'])}</span><span>02<br>{esc(t['live_wa'])}</span><span>03<br>{esc(t['live_ai'])}</span><span>04<br>{esc(t['live_sys'])}</span></div></div></div></section><section class="section section-tint"><div class="wrap story-teaser"><img src="{asset}hero.webp" alt="" loading="lazy"><div><p class="eyebrow">{esc(t['order_tag'])}</p><h2>{esc(t['order_title'])}</h2><p>{esc(t['order_desc'])}</p><ol class="v6-home-steps">{''.join(f'<li>{esc(n)}</li>' for n in q['chapter_names'])}</ol><a class="button" href="{link('how-it-works')}">{esc(t['follow'])} ↗</a></div></div></section><section class="section"><div class="wrap"><p class="eyebrow">{esc(t['promise_tag'])}</p><h2>{esc(t['promise_title'])}</h2><p class="v6-longcopy">{esc(t['promise_desc'])}</p><a href="{link('about')}">{esc(t['about_link'])} ↗</a></div></section>{cta()}</main>"""
 elif page=='solutions':
  needs=''.join(f'<a class="v6-need" href="{link(p)}"><span>0{i+1}</span>{esc(t["needs"][i])} ↗</a>' for i,p in enumerate(SERVICE_PAGES))
  main=f'<main id="main">{intro(t["service_tag"],t["solutions_title"],t["solutions_desc"])}<section class="section"><div class="wrap"><h2>{esc(t["help_title"])}</h2><p>{esc(t["help_desc"])}</p><div class="v6-needs">{needs}</div></div></section><section class="section section-tint"><div class="wrap"><div class="services-grid">{cards}</div></div></section>{cta()}</main>'
 elif page in SERVICE_PAGES:
  i=SERVICE_PAGES.index(page)
  example_tiles=''.join(f'<div class="v6-flow-tile"><span class="service-num">0{j+1}</span><strong>{esc(name)}</strong><p>{esc(q["panel_points"][i][min(j,1)])}</p></div>' for j,name in enumerate(t['service_steps'][i]))
  service_visual=f'<div class="mock v6-service-preview"><div class="mock-head"><strong>{esc(q["service_names"][i])}</strong><span class="badge">{esc(q["concept"])}</span></div><div class="v6-service-flow">{example_tiles}</div><div class="mock-footer">{esc(t["demo_note"])}</div></div>'
  if i==0: service_visual=mock
  points=''.join(f'<article class="v6-feature"><span class="service-num">0{j+1}</span><h2>{esc(item)}</h2><p>{esc(q["panel_points"][i][j if j<2 else 1])}</p></article>' for j,item in enumerate(t['service_steps'][i]))
  f=faq_copy[language]
  faq=f'<section class="section"><div class="wrap v6-faq"><h2>{esc(f[0])}</h2><details><summary>{esc(f[1])}</summary><p>{esc(q["service_desc"][i])}</p></details><details><summary>{esc(f[2])}</summary><p>{esc(t["demo_note"])}</p></details></div></section>'
  main=f'<main id="main"><section class="hero"><div class="wrap hero-grid"><div><p class="eyebrow">{esc(t["service_tag"])} · {esc(q["service_names"][i])}</p><h1>{esc(t["service_titles"][i])}</h1><p>{esc(q["service_more"][i])}</p><div class="buttons"><a class="button" href="{link("showcase")}#demo-{i+1}">{esc(t["service_cta"][i])} ↗</a><a class="button secondary" href="{link("contact")}">{esc(t["talk"])}</a></div></div>{service_visual}</div></section><section class="section section-tint"><div class="wrap v6-features">{points}</div></section>{faq}{cta()}</main>'
 elif page=='showcase':
  labels=[t['store'],t['conversation'],t['ai'],t['systems']]
  buttons=''.join(f'<button type="button" data-panel="p{i+1}" aria-pressed="false" aria-controls="demo-{i+1}">{esc(q["service_names"][i])}</button>' for i in range(4))
  product_panel=f'<div class="demo-frame"><div class="demo-product"><img src="{product}" alt=""><div><h3>{esc(t["demo_product"])}</h3><p>{esc(t["product_desc"])}</p><button type="button" data-action="basket">{esc(t["add"])}</button></div></div><p role="status" data-status data-initial="{esc(t["basket_empty"])}" data-next="{esc(t["basket_added"])}">{esc(t["basket_empty"])}</p></div>'
  order_panel=f'<div class="demo-frame"><p><strong>{esc(t["demo_product"])} × 2</strong></p><label for="method">{esc(t["choose"])}</label><select id="method" data-method><option value="">{esc(t["select_placeholder"])}</option><option value="pickup">{esc(t["pickup"])}</option><option value="delivery">{esc(t["delivery"])}</option></select><div class="buttons"><button type="button" data-action="review" data-missing="{esc(t["missing"])}" data-next="{esc(t["reviewed"])}">{esc(t["review"])}</button><button type="button" data-action="confirm" data-next="{esc(t["confirmed"])}" disabled>{esc(t["confirm"])}</button></div><p role="status" data-status data-initial="{esc(t["waiting"])}">{esc(t["waiting"])}</p></div>'
  ai_panel=f'<div class="demo-frame"><p><strong>{esc(t["demo_product"])} × 2</strong></p><div class="buttons"><button type="button" data-action="draft" data-next="{esc(t["draft_ready"])}">{esc(t["draft"])}</button><button type="button" data-action="check" data-next="{esc(t["draft_reviewed"])}" disabled>{esc(t["check"])}</button></div><p role="status" data-status data-initial="{esc(t["draft_initial"])}">{esc(t["draft_initial"])}</p></div>'
  sys_panel=f'<div class="demo-frame"><p><strong>{esc(t["demo_product"])} × 2</strong></p><button type="button" data-action="team" data-next="{esc(t["team_ready"])}">{esc(t["mark"])}</button><p role="status" data-status data-initial="{esc(t["team_initial"])}">{esc(t["team_initial"])}</p></div>'
  demos=[product_panel,order_panel,ai_panel,sys_panel]
  panels=''.join(f'<section class="preview-panel" id="demo-{i+1}" data-preview-panel="p{i+1}"><div class="v6-demo-grid"><div><p class="eyebrow">{esc(q["concept"])}</p><h2>{esc(labels[i])}</h2><p>{esc(q["panel_desc"][i])}</p>{demos[i]}<div class="buttons"><button type="button" data-action="reset">{esc(t["reset"])}</button><a href="{link(SERVICE_PAGES[i])}">{esc(t["related"])} ↗</a></div></div><aside><h3>{esc(t["details"])}</h3><p>{esc(q["panel_desc"][i])}</p><h3>{esc(t["howtry"])}</h3><ol>'+''.join(f'<li>{esc(x)}</li>' for x in q['panel_points'][i])+f'</ol><p class="note">{esc(t["demo_note"])}</p></aside></div></section>' for i in range(4))
  showcase_intro=intro(t["showcase_kicker"],t["showcase_title"],t["showcase_desc"]).replace('class="page-intro"','class="page-intro v6-intro-compact"')
  main=f'<main id="main">{showcase_intro}<section class="section v6-demo-section"><div class="wrap" data-preview><p class="badge">{esc(t["preview_tag"])}</p><p>{esc(t["intro_demo"])}</p><div class="preview-toolbar">{buttons}</div><noscript><p>{esc(t["noscript"])}</p></noscript>{panels}<p class="note">{esc(t["preview_hint"])}</p></div></section>{cta()}</main>'
 elif page=='how-it-works':
  navs=''.join(f'<a href="#chapter-{i+1}">0{i+1} · {esc(name)}</a>' for i,name in enumerate(q['chapter_names']))
  imgs=['story-message.webp','story-review.webp','story-pack.webp','pack.webp']
  chapters=''.join(f'<article class="chapter" id="chapter-{i+1}"><img src="{asset}{imgs[i]}" alt="" loading="lazy"><div class="chapter-copy"><p class="eyebrow">0{i+1} · {esc(q["story_tag"])}</p><h2>{esc(name)}</h2><p>{esc(q["chapter_desc"][i])}</p><p class="badge">{esc(q["chapter_notes"][i])}</p></div></article>' for i,name in enumerate(q['chapter_names']))
  working=''.join(f'<article class="v6-feature"><span class="service-num">0{i+1}</span><h3>{esc(n)}</h3><p>{esc(t["working_desc"][i])}</p></article>' for i,n in enumerate(t['working_names']))
  main=f'<main id="main">{intro(t["order_tag"],t["how_title"],t["how_desc"])}<section class="section"><div class="wrap"><nav class="chapter-nav" aria-label="{esc(t["order_tag"])}">{navs}</nav>{chapters}</div></section><section class="section section-tint"><div class="wrap"><h2>{esc(t["working"])}</h2><div class="v6-work">{working}</div></div></section>{cta()}</main>'
 elif page=='about':
  vals=''.join(f'<article class="v6-feature"><h3>{esc(v)}</h3><p>{esc(t["value_text"][i])}</p></article>' for i,v in enumerate(t['values']))
  main=f'<main id="main">{intro(t["about_tag"],t["about_title"],t["about_desc"])}<section class="section"><div class="wrap"><div class="v6-about-grid"><article><h2>{esc(t["purpose"])}</h2><p>{esc(t["purpose_text"])}</p></article><article><h2>{esc(t["mission"])}</h2><p>{esc(t["mission_text"])}</p></article><article><h2>{esc(t["vision"])}</h2><p>{esc(t["vision_text"])}</p></article></div><p class="note">{esc(t["proposed"])}</p></div></section><section class="section section-tint"><div class="wrap"><h2>{esc(t["values_title"])}</h2><div class="v6-work">{vals}</div></div></section>{cta()}</main>'
 else:
  steps=''.join(f'<li>{esc(x)}</li>' for x in t['contact_steps'])
  main=f'<main id="main">{intro(t["nav"][5],t["contact_title"],t["contact_desc"])}<section class="section"><div class="wrap contact-box"><div><h2>{esc(t["contact_heading"])}</h2><ol>{steps}</ol><p><a class="button" href="tel:+601139023123">+60 11-3902 3123</a></p><a class="button secondary" href="https://pomelostem.com/">{esc(t["contact_button"])} ↗</a></div><aside><h2>{esc(t["contact_example"])}</h2><p>{esc(t["contact_sample"])}</p><p class="note">{esc(t["contact_note"])}</p></aside></div></section></main>'
 footer=f'<footer class="site-footer"><div class="wrap foot-inner"><div><strong>Pomelo STEM</strong><p>{esc(t["tagline"])}</p><p>{esc(t["footer"])}</p></div><nav class="v6-footer-nav" aria-label="{esc(t["nav_label"])}">{nav()}</nav></div></footer></body></html>'
 return header+main+footer+'\n'
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');a=p.parse_args()
 for language in COPY:
  directory=OUT if language=='en' else OUT/language
  directory.mkdir(exist_ok=True)
  for page in PAGES:
   target=directory/(page+'.html');content=render(language,page)
   if a.check:
    if not target.is_file() or target.read_text(encoding='utf-8')!=content:raise SystemExit('Stale: '+str(target))
   else:target.write_text(content,encoding='utf-8')
 print('Pomelo V6 pages '+('checked' if a.check else 'built'))
