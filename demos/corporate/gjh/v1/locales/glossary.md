# Goh Joo Hin v1 Localization Glossary & Review Gate

This glossary governs scoped translations for `demos/corporate/gjh/v1/` (`en`, `zh-Hans`, `ms`).

## Review Status & Activation Gate

| Locale | Route | Review Status | Public Switcher Activation |
| --- | --- | --- | --- |
| `en` | `demos/corporate/gjh/v1/index.html` | `approved` | Active default |
| `zh-Hans` | `demos/corporate/gjh/v1/zh-Hans/index.html` | `draft_pending_fluent_review` | **Gated** (rendered as non-link pending badge on EN; draft preview route directly reachable with `noindex` and review banner) |
| `ms` | `demos/corporate/gjh/v1/ms/index.html` | `draft_pending_fluent_review` | **Gated** (rendered as non-link pending badge on EN; draft preview route directly reachable with `noindex` and review banner) |

To activate a translated route publicly after fluent review:
1. Have a fluent reviewer verify terminology, factual parity, punctuation, and natural wrapping across 320px–1440px.
2. Update `reviewStatus` from `"draft_pending_fluent_review"` to `"approved"` and record `reviewer` in `demos/corporate/gjh/v1/locales/shared.json` and the corresponding `<locale>.json`.
3. Regenerate with `python scripts/build_gallery.py` and verify with `python -m unittest discover -s tests -p 'test_*.py' -v` and `python tests/browser_gjh_v1_improvement.py`.

## Core Terminology Glossary

| English Source | zh-Hans (Draft) | ms (Draft) | Notes |
| --- | --- | --- | --- |
| Goh Joo Hin Pte Ltd / GJH | Goh Joo Hin Pte Ltd / GJH | Goh Joo Hin Pte Ltd / GJH | Retain official English corporate name and acronym; do not invent alternate corporate romanizations. |
| New Moon / MILI / GOGO / Sony / Borsch Med | New Moon / MILI / GOGO / Sony / Borsch Med | New Moon / MILI / GOGO / Sony / Borsch Med | Retain official brand marks intact. |
| Independent design concept | 独立设计概念 | Konsep reka bentuk bebas | Must clearly communicate unofficial, non-affiliated status. |
| Distribution | 分销 | Pengedaran | Business-to-business channel term (not retail delivery). |
| Partner / Partnership | 商务合作 / 商业伙伴 | Rakan niaga / Kerjasama | Trade and brand distribution partnership context. |
| Warehousing & distribution | 仓储与分销 | Pergudangan & pengedaran | Match GJH official company profile wording without overclaiming owned facilities. |
| Health & Nutrition | 健康与营养 | Kesihatan & Pemakanan | Division title; avoid unverified medical or therapeutic claims. |
| Traditional Chinese Medicine supplements | 传统中医药保健品 | Suplemen Perubatan Tradisional Cina | Factual category description for Borsch Med; do not imply clinical efficacy. |
| Selected markets mentioned by GJH | GJH 官方简介提及的部分市场 | Pasaran terpilih yang disebut oleh GJH | Preserve qualification that availability varies by market. |
| Singapore · HQ | 新加坡 · 总部 | Singapura · Ibu Pejabat | Headquarters designation matching ACRA/official profile. |
| Cambodia / Philippines | 柬埔寨 / 菲律宾 | Kemboja / Filipina | Standard localized market names in zh-Hans and ms. |
| External official link notice | 将在新标签页打开 GJH 官方网站（页面内容以英文为主） | Membuka laman web rasmi GJH dalam tab baharu (kandungan rasmi dalam Bahasa Inggeris) | Explicitly disclose new tab and English-language destination on non-English pages. |
