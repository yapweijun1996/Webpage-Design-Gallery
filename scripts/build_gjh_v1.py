"""Validate scoped v1 locale catalogs and generate static EN, zh-Hans and ms routes."""

import argparse
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V1_DIR = ROOT / "demos/corporate/gjh/v1"
PLACEHOLDER = re.compile(r"\{\w+\}")

ICON_EXT = (
    '<svg class="icon icon-external" width="18" height="18" viewBox="0 0 24 24" '
    'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" '
    'stroke-linejoin="round" aria-hidden="true" focusable="false">'
    '<path d="M5 19 19 5M7 5h12v12"/></svg>'
)
ICON_DOWN = (
    '<svg class="icon icon-down" width="18" height="18" viewBox="0 0 24 24" '
    'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" '
    'stroke-linejoin="round" aria-hidden="true" focusable="false">'
    '<path d="M12 5v14M5 12l7 7 7-7"/></svg>'
)
ICON_MENU = (
    '<svg class="icon icon-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
    'aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def esc(value):
    return html.escape(str(value), quote=True)


def flatten_strings(data, prefix=""):
    items = {}
    for key, value in data.items():
        name = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            items.update(flatten_strings(value, name))
        elif isinstance(value, str):
            items[name] = value
        else:
            raise ValueError(f"Unsupported value type at {name}: {type(value).__name__}")
    return items


def load_v1_catalogs(root=ROOT):
    v1_dir = root / "demos/corporate/gjh/v1"
    locales_dir = v1_dir / "locales"
    shared = read_json(locales_dir / "shared.json")
    locale_meta = shared.get("locales", [])
    codes = [item["code"] for item in locale_meta]
    if "en" not in codes or len(codes) != len(set(codes)):
        raise ValueError("v1 shared.json must define unique locales including 'en'")

    catalogs = {}
    flattened = {}
    for item in locale_meta:
        code = item["code"]
        pack = read_json(locales_dir / f"{code}.json")
        if pack.get("locale") != code:
            raise ValueError(f"v1 locale file mismatch: expected {code}, got {pack.get('locale')}")
        if pack.get("reviewStatus") != item.get("reviewStatus"):
            raise ValueError(
                f"v1 reviewStatus mismatch for {code}: shared.json={item.get('reviewStatus')!r} "
                f"vs {code}.json={pack.get('reviewStatus')!r}"
            )
        if item["reviewStatus"] not in ("approved", "draft_pending_fluent_review"):
            raise ValueError(f"Unsupported reviewStatus for {code}: {item['reviewStatus']}")
        catalogs[code] = pack
        flattened[code] = flatten_strings(pack)

    en_flat = flattened["en"]
    for code, flat in flattened.items():
        missing = sorted(set(en_flat) - set(flat))
        extra = sorted(set(flat) - set(en_flat))
        if missing:
            raise ValueError(f"Missing v1 locale keys in {code}: {', '.join(missing)}")
        if extra:
            raise ValueError(f"Unused/extra v1 locale keys in {code}: {', '.join(extra)}")
        for key, value in flat.items():
            if key != "draft.banner" and not value.strip():
                raise ValueError(f"Empty v1 locale string in {code}: {key}")
            if sorted(PLACEHOLDER.findall(en_flat[key])) != sorted(PLACEHOLDER.findall(value)):
                raise ValueError(f"Placeholder mismatch in {code}/{key}")
            if any(marker in value for marker in ("\u00c2", "\u00e2", "\ufffd")):
                raise ValueError(f"Corrupted UTF-8 punctuation in {code}/{key}")

    # Verify every division, brand, capability, milestone, and market has matching copy keys.
    for code, pack in catalogs.items():
        for div in shared["divisions"]:
            if div["key"] not in pack["businesses"]:
                raise ValueError(f"Missing business division key {div['key']} in {code}")
        for brand in shared["assets"]["brands"]:
            if brand["id"] not in pack["brands"]:
                raise ValueError(f"Missing brand key {brand['id']} in {code}")
        for cap in shared["capabilities"]:
            if cap["key"] not in pack["partnership"]:
                raise ValueError(f"Missing capability key {cap['key']} in {code}")
        for ms in shared["milestones"]:
            if ms["key"] not in pack["story"]:
                raise ValueError(f"Missing milestone key {ms['key']} in {code}")
        for market in shared["markets"]:
            if market["key"] not in pack["reach"]["markets"]:
                raise ValueError(f"Missing market key {market['key']} in {code}")

    return shared, catalogs


def relative_locale_href(from_locale, to_locale):
    prefix = "../" * from_locale["depth"]
    return prefix + to_locale["path"]


def format_srcset(entries, asset_prefix):
    return ", ".join(f"{asset_prefix}{path} {width}w" for path, width in entries)


def render_locale_switcher(shared, copy, current_locale, activate_drafts=False):
    current_is_draft = (current_locale["reviewStatus"] != "approved") and not activate_drafts
    items = []
    for item in shared["locales"]:
        code = item["code"]
        label = item["nativeLabel"]
        is_current = code == current_locale["code"]
        is_approved = (item["reviewStatus"] == "approved") or activate_drafts
        if is_current:
            items.append(
                f'<span class="locale-item is-current" aria-current="page" lang="{esc(item["htmlLang"])}">'
                f"{esc(label)}</span>"
            )
        elif is_approved or current_is_draft:
            href = relative_locale_href(current_locale, item)
            draft_suffix = (
                f' <small class="locale-badge">({esc(copy["draft"]["pendingBadge"])})</small>'
                if not is_approved
                else ""
            )
            items.append(
                f'<a class="locale-item" href="{esc(href)}" hreflang="{esc(item["htmlLang"])}" '
                f'lang="{esc(item["htmlLang"])}" data-locale-link="{esc(code)}">'
                f"{esc(label)}{draft_suffix}</a>"
            )
        else:
            hint = copy["draft"]["pendingHint"].replace("{language}", label)
            items.append(
                f'<span class="locale-item is-pending" lang="{esc(item["htmlLang"])}" '
                f'aria-disabled="true" title="{esc(hint)}" data-locale-gated="{esc(code)}">'
                f'{esc(label)} <small class="locale-badge">({esc(copy["draft"]["pendingBadge"])})</small></span>'
            )
    return (
        f'<div class="locale-switcher" role="group" aria-label="{esc(copy["header"]["localeNavAriaLabel"])}">'
        + "".join(items)
        + "</div>"
    )


def render_page(shared, copy, locale_meta, activate_drafts=False):
    depth = locale_meta["depth"]
    v1_prefix = "../" * depth
    shared_prefix = "../" * (depth + 1) + "shared/"
    gallery_prefix = "../" * (depth + 4)

    is_draft = (locale_meta["reviewStatus"] != "approved") and not activate_drafts
    public_base = shared["publicPrefix"]
    canonical_url = public_base if depth == 0 else f"{public_base}{locale_meta['code']}/"

    alternate_links = []
    if not is_draft:
        approved_locales = [
            item for item in shared["locales"]
            if item["reviewStatus"] == "approved" or activate_drafts
        ]
        for item in approved_locales:
            href = public_base if item["depth"] == 0 else f"{public_base}{item['code']}/"
            alternate_links.append(
                f'  <link rel="alternate" hreflang="{esc(item["htmlLang"])}" href="{esc(href)}">'
            )
        alternate_links.append(f'  <link rel="alternate" hreflang="x-default" href="{esc(public_base)}">')

    robots_meta = '  <meta name="robots" content="noindex">\n' if is_draft else ""
    alternates_block = ("\n".join(alternate_links) + "\n") if alternate_links else ""

    draft_banner = ""
    if is_draft and copy["draft"]["banner"]:
        draft_banner = (
            f'  <div class="draft-notice" role="note" data-review-status="{esc(locale_meta["reviewStatus"])}">'
            f'<div class="wrap"><p>{esc(copy["draft"]["banner"])}</p></div></div>\n'
        )

    sr_ext = f'<span class="visually-hidden"> ({esc(copy["external"]["newTabSrOnly"])})</span>'

    hero_asset = shared["assets"]["hero"]
    logo_asset = shared["assets"]["logo"]

    division_index_html = "".join(
        f'<a href="#{esc(div["id"])}"><span class="division-index-copy">'
        f'<small>{esc(copy["hero"][div["key"] + "Tag"])}</small>'
        f'<span>{esc(copy["hero"][div["key"] + "Label"])}</span>'
        f'</span><span class="division-arrow" aria-hidden="true">↓</span></a>'
        for div in shared["divisions"]
    )

    division_cards_html = "".join(
        f'<article class="division" id="{esc(div["id"])}" tabindex="-1">'
        f'<span class="number">{esc(copy["businesses"][div["key"]]["number"])}</span>'
        f'<h3>{esc(copy["businesses"][div["key"]]["heading"])}</h3>'
        f'<p>{esc(copy["businesses"][div["key"]]["body"])}</p>'
        f'<a class="text-link" href="{esc(div["url"])}" target="_blank" rel="noopener noreferrer">'
        f'<span>{esc(copy["businesses"][div["key"]]["action"])}</span>{sr_ext}{ICON_EXT}</a>'
        f"</article>"
        for div in shared["divisions"]
    )

    brand_cards_html = "".join(
        f'<article class="brand-card">'
        f'<div class="brand-photo" data-media-frame data-fallback-label="{esc(copy["brands"]["brandFallback"].replace("{brand}", brand["name"]))}">'
        f'<img src="{esc(v1_prefix + brand["image"])}" width="{brand["width"]}" height="{brand["height"]}" '
        f'loading="lazy" decoding="async" alt="{esc(copy["brands"][brand["id"]]["imageAlt"])}">'
        f"</div>"
        f'<div class="brand-copy">'
        f'<p class="eyebrow">{esc(copy["brands"][brand["id"]]["category"])}</p>'
        f'<h3>{esc(brand["name"])}</h3>'
        f'<p>{esc(copy["brands"][brand["id"]]["body"])}</p>'
        f'<a class="text-link" href="{esc(brand["url"])}" target="_blank" rel="noopener noreferrer">'
        f'<span>{esc(copy["brands"][brand["id"]]["action"])}</span>{sr_ext}{ICON_EXT}</a>'
        f"</div></article>"
        for brand in shared["assets"]["brands"]
    )

    capabilities_html = "".join(
        f'<article><span>{esc(cap["index"])}</span><div>'
        f'<h3>{esc(copy["partnership"][cap["key"]]["heading"])}</h3>'
        f'<p>{esc(copy["partnership"][cap["key"]]["body"])}</p>'
        f"</div></article>"
        for cap in shared["capabilities"]
    )

    milestones_html = "".join(
        f'<article><span class="year">{esc(item["year"])}</span>'
        f'<h3>{esc(copy["story"][item["key"]]["heading"])}</h3>'
        f'<p>{esc(copy["story"][item["key"]]["body"])}</p></article>'
        for item in shared["milestones"]
    )

    markets_html = "".join(
        f'<li{" class=\"market-hq\"" if item["hq"] else ""}>'
        f'{esc(copy["reach"]["markets"][item["key"]])}</li>'
        for item in shared["markets"]
    )

    locale_switcher_html = render_locale_switcher(shared, copy, locale_meta, activate_drafts=activate_drafts)
    pwa_copy_json = json.dumps(copy["pwa"], ensure_ascii=False).replace("</", "<\\/")

    return f"""<!doctype html>
<html lang="{esc(locale_meta["htmlLang"])}" data-gjh-design="v1" data-v1-locale="{esc(locale_meta["code"])}" data-v1-review-status="{esc(locale_meta["reviewStatus"])}">
<head>
  <script src="{esc(shared_prefix)}navigation.js"></script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="{esc(copy["meta"]["description"])}">
  <meta name="theme-color" content="{esc(shared["themeColor"])}">
{robots_meta}  <title>{esc(copy["meta"]["title"])}</title>
  <link rel="canonical" href="{esc(canonical_url)}">
{alternates_block}  <link rel="icon" href="{esc(v1_prefix + logo_asset["file"])}">
  <link rel="stylesheet" href="{esc(gallery_prefix)}assets/tokens.css">
  <link rel="stylesheet" href="{esc(gallery_prefix)}assets/gjh-themes.css">
  <link rel="stylesheet" href="{esc(shared_prefix)}landing.css">
  <link rel="stylesheet" href="{esc(shared_prefix)}interaction.css">
  <link rel="stylesheet" href="{esc(v1_prefix)}style.css">
  <script type="module" src="{esc(v1_prefix)}script.js"></script>
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="manifest" href="{esc(v1_prefix)}manifest.webmanifest">
  <link rel="apple-touch-icon" href="{esc(gallery_prefix)}assets/icons/gallery-180.png">
  <script type="application/json" id="demo-pwa-copy">{pwa_copy_json}</script>
  <script defer src="{esc(gallery_prefix)}src/demo-pwa.js"></script>
  <link rel="related" type="text/html" title="{esc(copy["meta"]["designReferenceTitle"])}" href="{esc(gallery_prefix + shared["routes"]["styleAtlas"])}">
</head>
<body class="v1">
  <a class="skip" href="#main">{esc(copy["skip"]["label"])}</a>
  <div class="concept-notice">
    <div class="concept-notice-copy"><strong>{esc(copy["notice"]["heading"])}</strong> <span>{esc(copy["notice"]["affiliation"])}</span></div>
    <a class="gallery-exit" href="{esc(gallery_prefix + shared["routes"]["galleryCompany"])}"><span>{esc(copy["notice"]["galleryExit"])}</span>{ICON_EXT}</a>
  </div>
{draft_banner}  <header class="header" data-static-header>
    <div class="wrap nav-wrap">
      <a class="identity" href="#top" aria-label="{esc(copy["header"]["homeAriaLabel"])}">
        <span class="logo-mat"><img src="{esc(v1_prefix + logo_asset["file"])}" width="{logo_asset["width"]}" height="{logo_asset["height"]}" alt="{esc(copy["header"]["logoAlt"])}"></span>
        <span class="identity-name">{esc(shared["company"]["legalName"])}<small>{esc(copy["header"]["subtitle"])}</small></span>
      </a>
      <button class="menu-toggle" type="button" aria-controls="navigation" aria-expanded="false">{esc(copy["header"]["menuButton"])} {ICON_MENU}</button>
      <nav id="navigation" aria-label="{esc(copy["header"]["navAriaLabel"])}">
        <a href="#business">{esc(copy["header"]["navBusinesses"])}</a>
        <a href="#brands">{esc(copy["header"]["navBrands"])}</a>
        <a href="#about">{esc(copy["header"]["navStory"])}</a>
        <a href="#network">{esc(copy["header"]["navReach"])}</a>
        <a class="nav-cta" href="#contact"><span>{esc(copy["header"]["navPartner"])}</span>{ICON_DOWN}</a>
        {locale_switcher_html}
      </nav>
    </div>
  </header>
  <main id="main" tabindex="-1">
    <section class="entry hero entry-1" id="top" aria-labelledby="hero-title">
      <div class="entry-copy">
        <p class="entry-kicker">{esc(copy["hero"]["kicker"])}</p>
        <h1 id="hero-title">{esc(copy["hero"]["heading"])}</h1>
        <p class="entry-lead">{esc(copy["hero"]["lead"])}</p>
        <a class="entry-action button" href="#business"><span>{esc(copy["hero"]["cta"])}</span><span class="btn-arrow" aria-hidden="true">↓</span></a>
      </div>
      <nav class="entry-links division-index" aria-label="{esc(copy["hero"]["indexAriaLabel"])}">{division_index_html}</nav>
      <figure class="entry-art" data-media-frame data-fallback-label="{esc(copy["hero"]["imageFallback"])}">
        <picture class="entry-picture">
          <source type="image/webp" srcset="{esc(format_srcset(hero_asset["webpSrcset"], v1_prefix))}" sizes="{esc(hero_asset["sizes"])}">
          <source type="image/jpeg" srcset="{esc(format_srcset(hero_asset["jpegSrcset"], v1_prefix))}" sizes="{esc(hero_asset["sizes"])}">
          <img src="{esc(v1_prefix + hero_asset["fallback"])}" width="{hero_asset["width"]}" height="{hero_asset["height"]}" alt="{esc(copy["hero"]["imageAlt"])}" decoding="async" fetchpriority="high">
        </picture>
      </figure>
    </section>
    <section class="section" id="business" tabindex="-1" aria-labelledby="business-title">
      <div class="wrap">
        <div class="section-heading">
          <div>
            <p class="eyebrow">{esc(copy["businesses"]["eyebrow"])}</p>
            <h2 id="business-title">{esc(copy["businesses"]["heading"])}</h2>
          </div>
          <p>{esc(copy["businesses"]["lead"])}</p>
        </div>
        <div class="grid-three division-grid">{division_cards_html}</div>
      </div>
    </section>
    <section class="section wash" id="brands" tabindex="-1" aria-labelledby="brands-title">
      <div class="wrap">
        <div class="section-heading">
          <div>
            <p class="eyebrow">{esc(copy["brands"]["eyebrow"])}</p>
            <h2 id="brands-title">{esc(copy["brands"]["heading"])}</h2>
          </div>
          <p>{esc(copy["brands"]["lead"])}</p>
        </div>
        <div class="grid-three brand-grid">{brand_cards_html}</div>
        <p class="small muted asset-note">{esc(copy["brands"]["assetNote"])}</p>
      </div>
    </section>
    <section class="section" id="partnership" tabindex="-1" aria-labelledby="partnership-title">
      <div class="wrap two-col">
        <div class="prose">
          <p class="eyebrow">{esc(copy["partnership"]["eyebrow"])}</p>
          <h2 id="partnership-title">{esc(copy["partnership"]["heading"])}</h2>
          <p>{esc(copy["partnership"]["lead"])}</p>
          <a class="text-link" href="#contact"><span>{esc(copy["partnership"]["cta"])}</span>{ICON_DOWN}</a>
        </div>
        <div class="capabilities">{capabilities_html}</div>
      </div>
    </section>
    <section class="section wash" id="about" tabindex="-1" aria-labelledby="about-title">
      <div class="wrap">
        <div class="section-heading">
          <div>
            <p class="eyebrow">{esc(copy["story"]["eyebrow"])}</p>
            <h2 id="about-title">{esc(copy["story"]["heading"])}</h2>
          </div>
          <div class="section-heading-aside">
            <p>{esc(copy["story"]["lead"])}</p>
            <a class="text-link history-link" href="{esc(shared["routes"]["officialHistory"])}" target="_blank" rel="noopener noreferrer"><span>{esc(copy["story"]["action"])}</span>{sr_ext}{ICON_EXT}</a>
          </div>
        </div>
        <div class="timeline">{milestones_html}</div>
      </div>
    </section>
    <section class="section" id="network" tabindex="-1" aria-labelledby="network-title">
      <div class="wrap two-col">
        <div class="prose">
          <p class="eyebrow">{esc(copy["reach"]["eyebrow"])}</p>
          <h2 id="network-title">{esc(copy["reach"]["heading"])}</h2>
          <p>{esc(copy["reach"]["lead"])}</p>
        </div>
        <div class="market-panel">
          <p class="eyebrow">{esc(copy["reach"]["panelEyebrow"])}</p>
          <ul class="markets">{markets_html}</ul>
          <p class="small muted">{esc(copy["reach"]["disclaimer"])}</p>
        </div>
      </div>
    </section>
    <section class="contact" id="contact" tabindex="-1" aria-labelledby="contact-title">
      <div class="wrap">
        <div>
          <p class="eyebrow">{esc(copy["contact"]["eyebrow"])}</p>
          <h2 id="contact-title">{esc(copy["contact"]["heading"])}</h2>
          <p>{esc(copy["contact"]["body"])}</p>
        </div>
        <div class="contact-action-col">
          <a class="button yellow" href="{esc(shared["routes"]["officialContact"])}" target="_blank" rel="noopener noreferrer"><span>{esc(copy["contact"]["cta"])}</span>{sr_ext}{ICON_EXT}</a>
          <p class="small">{esc(copy["contact"]["externalNote"])}</p>
        </div>
      </div>
    </section>
  </main>
  <footer class="footer">
    <div class="wrap">
      <div class="footer-main">
        <div>
          <p class="footer-name">{esc(shared["company"]["legalName"])}</p>
          <p class="muted small">{esc(copy["footer"]["divisionsSummary"])}<br>{esc(copy["footer"]["location"])}</p>
        </div>
        <div class="footer-links">
          <div>
            <strong>{esc(copy["footer"]["exploreHeading"])}</strong>
            <a href="#business">{esc(copy["header"]["navBusinesses"])}</a>
            <a href="#brands">{esc(copy["header"]["navBrands"])}</a>
            <a href="#about">{esc(copy["header"]["navStory"])}</a>
            <a href="#network">{esc(copy["header"]["navReach"])}</a>
          </div>
          <div>
            <strong>{esc(copy["footer"]["connectHeading"])}</strong>
            <a href="{esc(shared["routes"]["officialWebsite"])}" target="_blank" rel="noopener noreferrer"><span>{esc(copy["footer"]["officialWebsite"])}</span>{sr_ext}{ICON_EXT}</a>
            <a href="{esc(shared["routes"]["officialEshop"])}" target="_blank" rel="noopener noreferrer"><span>{esc(copy["footer"]["officialEshop"])}</span>{sr_ext}{ICON_EXT}</a>
            <a href="{esc(gallery_prefix + shared["routes"]["galleryCompany"])}"><span>{esc(copy["footer"]["galleryExit"])}</span>{ICON_EXT}</a>
          </div>
          <div>
            <strong>{esc(copy["footer"]["utilityHeading"])}</strong>
            <a href="#offline-controls">{esc(copy["footer"]["offlineLink"])}</a>
            <a class="design-reference-inline" rel="related" href="{esc(gallery_prefix + shared["routes"]["styleAtlas"])}">{esc(copy["footer"]["designReference"])}</a>
          </div>
        </div>
      </div>
      <div id="offline-controls" class="footer-offline" tabindex="-1" data-demo-pwa-mount>
        <p class="small muted footer-offline-fallback">{esc(copy["footer"]["offlineNoJsNote"])}</p>
      </div>
      <div class="footer-bottom">
        <span>{esc(copy["footer"]["disclaimer"])}</span>
        <span>{esc(copy["footer"]["attribution"])}</span>
        <a class="design-reference" rel="related" href="{esc(gallery_prefix + shared["routes"]["styleAtlas"])}">{esc(copy["footer"]["designReference"])}</a>
      </div>
    </div>
  </footer>
</body>
</html>
"""


def outputs(root=ROOT, activate_drafts=False):
    shared, catalogs = load_v1_catalogs(root)
    result = {}
    for locale_meta in shared["locales"]:
        code = locale_meta["code"]
        rel = f"demos/corporate/gjh/v1/{locale_meta['path']}"
        result[rel] = render_page(shared, catalogs[code], locale_meta, activate_drafts=activate_drafts)
    return result


def build(root=ROOT, check=False, activate_drafts=False):
    generated = outputs(root, activate_drafts=activate_drafts)
    stale = []
    for rel, content in generated.items():
        path = root / rel
        if check:
            if not path.is_file() or path.read_text(encoding="utf-8") != content:
                stale.append(rel)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")
    if stale:
        raise ValueError("Regenerate GJH v1 localized pages: " + ", ".join(stale))
    return generated


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--activate-drafts", action="store_true", help="Emit active switcher links for draft locales (preview/test only)")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    build(args.root.resolve(), check=args.check, activate_drafts=args.activate_drafts)
    print(f"GJH v1 {'checked' if args.check else 'built'}: 3 locale routes (en, zh-Hans, ms)")
