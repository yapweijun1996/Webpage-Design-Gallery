"""Reject new SSOT debt while retaining explicitly recorded legacy demo artwork.

This is a CSS source ratchet, not a CSS parser or an accessibility certification.
Counts are keyed by path, property and exact value so changing a hard-coded color
cannot hide behind an unchanged total. Vendor and generated CSS are excluded.
"""

import argparse
import collections
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_design_system", ROOT / "scripts/build_design_system.py")
design_system = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(design_system)
NAMED_COLORS = """aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan
darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen
darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise
darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia
gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory
khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow
lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey
lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid
mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue
mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod
palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple
red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue
slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
whitesmoke yellow yellowgreen""".split()
COLOR = re.compile(r"#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|lab|lch|oklab|oklch|color)\s*\(|(?<![\w-])(?:"
                   + "|".join(NAMED_COLORS) + r")(?![\w-])", re.I)
DECLARATION = re.compile(r"(?<![\w-])([\w-]+)\s*:\s*([^;{}]+)(?=[;}])")
LITERAL_PROPERTIES = {"border-radius", "box-shadow", "text-shadow", "font-size", "font", "z-index"}
SHARED_COMPONENTS = {".container", ".header-inner", ".company-card", ".design-card", ".filter-bar", ".primary-link", ".device-control", ".compare-tray"}
# Geometry measured by JS or supplied by the platform is not a theme primitive.
RUNTIME_GEOMETRY = {"--app-chrome-height", "--gjh-header-size", "--gjh-safe-top", "--gjh-safe-right", "--gjh-safe-bottom", "--gjh-safe-left"}


def css_paths(root=ROOT):
    paths = list((root / "assets").glob("*.css"))
    paths += list((root / "demos").glob("**/*.css"))
    generated = {root / "assets/tokens.css", root / "assets/gjh-themes.css"}
    return sorted(path for path in paths if "vendor" not in path.parts and path not in generated)


def violations(name, source):
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    result = collections.Counter()
    for match in DECLARATION.finditer(source):
        prop, value = match.groups()
        value = " ".join(value.split())
        without_variables = re.sub(r"var\(--[a-zA-Z0-9-]+\)", "", value)
        # Strip reference names, not fallback expressions. A variable named
        # --gold is valid; var(--gold, rebeccapurple) is still new hardcoding.
        color_value = re.sub(r"--[a-zA-Z0-9-]+", "", value)
        raw_color = bool(COLOR.search(color_value))
        raw_dimension = prop in LITERAL_PROPERTIES and bool(re.search(r"\d", without_variables))
        raw_primitive = prop.startswith("--") and prop not in RUNTIME_GEOMETRY and bool(re.search(r"\d", without_variables))
        if raw_color or raw_dimension or raw_primitive:
            result[f"{name}|{prop}|{value}"] += 1
    return result


def inventory(root=ROOT):
    found = collections.Counter()
    owners = collections.defaultdict(set)
    for path in css_paths(root):
        name = path.relative_to(root).as_posix()
        source = path.read_text()
        found.update(violations(name, source))
        if name.startswith("assets/"):
            for selector in re.findall(r"(?:^|[{}])\s*([^{}]+)\{", source):
                selectors = {part.strip() for part in selector.split(",")}
                for component in SHARED_COMPONENTS:
                    if component in selectors:
                        owners[component].add(name)
    for selector, paths in owners.items():
        if len(paths) > 1:
            found[f"ownership|{selector}|{' + '.join(sorted(paths))}"] = 1
    return found


def check(root=ROOT):
    errors = []
    try:
        design_system.build(root, check=True)
    except (ValueError, KeyError) as error:
        errors.append(str(error))
    baseline = json.loads((root / "design-system/legacy-baseline.json").read_text())
    # Native media queries cannot consume custom properties. Validate their
    # concrete widths against the registry rather than inventing a build syntax.
    token_data = json.loads((root / "design-system/tokens.json").read_text())
    breakpoints = {value for name, value in token_data["primitives"].items() if name.startswith("breakpoint-")}
    for path in (root / "assets").glob("*.css"):
        if path.name in {"tokens.css", "gjh-themes.css"}:
            continue
        for width in re.findall(r"\((?:min|max)-width\s*:\s*([\d.]+px)\)", path.read_text()):
            if width not in breakpoints:
                errors.append(f"Unregistered Gallery breakpoint: {path.name}: {width}")
    found = inventory(root)
    for key, count in sorted(found.items()):
        allowed = baseline["declarations"].get(key, 0)
        if count > allowed:
            errors.append(f"New SSOT debt ({count} > {allowed}): {key}")
    return errors, sum(found.values()), baseline.get("originalCount", sum(baseline["declarations"].values()))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    errors, remaining, original = check()
    if errors:
        parser.exit(1, "\n".join(errors) + "\n")
    print(f"SSOT PASS: generated artifacts current; {remaining}/{original} legacy declarations remain (no new debt)")
