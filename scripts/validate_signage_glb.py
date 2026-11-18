"""Validate the GJH v11 plain GLB signage profile and its preset catalog."""

import hashlib
import json
import math
import re
import struct
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "demos/corporate/gjh/v11/assets/signage/models"
SOURCE = MODELS.parent / "sources/kit.json"
CONTRACT = json.loads(SOURCE.read_text(encoding="utf-8"))
DIMENSIONS = ("width", "height", "depth")
TOLERANCE = 1e-6


def need(condition, message):
    if not condition:
        raise ValueError(message)


def linear_rgb(color):
    need(re.fullmatch(r"#[0-9a-fA-F]{6}", color), f"Invalid sRGB colour {color}")
    components = (int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in components)


def bounds_match(actual, expected):
    return len(actual) == len(expected) and all(math.isclose(a, b, rel_tol=0, abs_tol=TOLERANCE)
                                                 for a, b in zip(actual, expected))


def read_glb(raw):
    need(len(raw) >= 28, "Missing GLB header or chunks")
    magic, version, size = struct.unpack_from("<4sII", raw)
    need((magic, version, size) == (b"glTF", 2, len(raw)), "Invalid GLB header")
    json_size, json_tag = struct.unpack_from("<I4s", raw, 12)
    end = 20 + json_size
    need(json_tag == b"JSON" and json_size % 4 == 0 and end + 8 <= len(raw), "Invalid JSON chunk")
    bin_size, bin_tag = struct.unpack_from("<I4s", raw, end)
    need(bin_tag == b"BIN\x00" and bin_size % 4 == 0 and end + 8 + bin_size == len(raw),
         "Invalid BIN chunk")
    doc = json.loads(raw[20:end].decode("utf-8"))
    need(doc["asset"]["version"] == "2.0", "Expected glTF asset version 2.0")
    need(not any(doc.get(key) for key in ("extensionsUsed", "extensionsRequired", "extensions",
                                        "images", "textures", "samplers", "animations", "skins", "cameras")),
         "Expected static geometry, no extensions or textures")
    buffer, = doc["buffers"]
    binary = raw[end + 8:]
    n = buffer["byteLength"]
    need("uri" not in buffer and 0 <= len(binary) - n <= 3 and not any(binary[n:]), "Invalid embedded buffer")
    return doc, binary[:n]


def accessor_values(doc, blob, index, *, vector, target):
    accessor = doc["accessors"][index]
    code = {5123: "H", 5125: "I", 5126: "f"}.get(accessor["componentType"])
    need(accessor["type"] == ("VEC3" if vector else "SCALAR")
         and code in ("f" if vector else ("H", "I"))
         and not any(key in accessor for key in ("sparse", "extensions", "normalized")),
         "Unexpected accessor format")
    fmt = struct.Struct("<" + code * (3 if vector else 1))
    view = doc["bufferViews"][accessor["bufferView"]]
    offset = view.get("byteOffset", 0)
    start = accessor.get("byteOffset", 0)
    stride = view.get("byteStride", fmt.size)
    count = accessor["count"]
    component_size = fmt.size // (3 if vector else 1)
    need(view["buffer"] == 0 and view.get("target", target) == target and offset % 4 == 0
         and stride >= fmt.size and stride % component_size == 0 and start % component_size == 0
         and count > 0 and 0 <= offset <= offset + view["byteLength"] <= len(blob)
         and 0 <= start and start + (count - 1) * stride + fmt.size <= view["byteLength"],
         "Accessor is outside its bufferView or incorrectly aligned")
    values = [fmt.unpack_from(blob, offset + start + i * stride) for i in range(count)]
    need(all(math.isfinite(c) for v in values for c in v), "Non-finite accessor value")
    return values


def cross(a, b, c):
    ux, uy, uz = (y - x for x, y in zip(a, b))
    vx, vy, vz = (y - x for x, y in zip(a, c))
    return uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx


def check_material(entry):
    name = entry["name"]
    spec = CONTRACT["materials"][name]
    pbr = entry["pbrMetallicRoughness"]
    need(set(entry) <= {"name", "pbrMetallicRoughness", "emissiveFactor", "doubleSided"}
         and set(pbr) <= {"baseColorFactor", "metallicFactor", "roughnessFactor"},
         f"Unexpected non-core material fields for {name}")
    expected = linear_rgb(spec["color"])
    need(bounds_match(pbr.get("baseColorFactor", [1] * 4), (*expected, 1)), f"Base colour mismatch in {name}")
    need(bounds_match((pbr.get("metallicFactor", 1), pbr.get("roughnessFactor", 1)),
                      (spec["metallic"], spec["roughness"])), f"Metallic or roughness mismatch in {name}")
    need(bounds_match(entry.get("emissiveFactor", [0] * 3), [c * spec.get("emission", 0) for c in expected]),
         f"Emissive colour mismatch in {name}")
    need(entry.get("doubleSided", False) == spec.get("doubleSided", False), f"Sidedness mismatch in {name}")


def inspect_model(path, spec):
    raw = path.read_bytes()
    doc, blob = read_glb(raw)
    node, = doc["nodes"]
    scene, = doc["scenes"]
    mesh, = doc["meshes"]
    need(doc.get("scene", 0) == 0 and scene["nodes"] == [0] and node["mesh"] == 0
         and node["name"] == mesh["name"] == path.stem and set(node) == {"mesh", "name"},
         "Expected one identity-transform scene node with the file's sign_ name")
    material_names = [entry["name"] for entry in doc["materials"]]
    need(sorted(material_names) == sorted(spec["materials"]), "Incorrect material classes")
    for entry in doc["materials"]:
        check_material(entry)
    tris, positions, used_accessors, used_materials = 0, [], set(), []
    front = back = False
    for primitive in mesh["primitives"]:
        need(primitive.get("mode", 4) == 4 and set(primitive["attributes"]) == {"POSITION", "NORMAL"}
             and set(primitive) <= {"mode", "attributes", "indices", "material"},
             "Expected indexed triangles with positions and normals")
        used_materials.append(primitive["material"])
        pos_index = primitive["attributes"]["POSITION"]
        normal_index = primitive["attributes"]["NORMAL"]
        used_accessors.update((pos_index, normal_index, primitive["indices"]))
        points = accessor_values(doc, blob, pos_index, vector=True, target=34962)
        normals = accessor_values(doc, blob, normal_index, vector=True, target=34962)
        indices = [i for (i,) in accessor_values(doc, blob, primitive["indices"], vector=False, target=34963)]
        need(len(indices) % 3 == 0 and max(indices) < len(points) == len(normals), "Invalid triangle indices")
        if path.stem.startswith("sign_frame_") and material_names[primitive["material"]] == "brass_trim":
            need(min(points[i][2] for i in indices) > CONTRACT["frame"]["backplateDepthMetres"],
                 "Frame keyline must sit in front of the backplate on +Z")
        need(all(math.isclose(sum(c * c for c in n), 1, abs_tol=2e-5) for n in normals), "Non-unit normal")
        p = doc["accessors"][pos_index]
        need(bounds_match(p["min"], tuple(map(min, zip(*points)))) and
             bounds_match(p["max"], tuple(map(max, zip(*points)))), "POSITION bounds differ from BIN")
        for i, j, k in zip(indices[::3], indices[1::3], indices[2::3]):
            face = cross(points[i], points[j], points[k])
            need(sum(c * c for c in face) > 1e-22, "Degenerate triangle")
            front |= face[2] > 0 and all(normals[v][2] > 0.5 for v in (i, j, k))
            back |= face[2] < 0 and all(normals[v][2] < -0.5 for v in (i, j, k))
        positions.extend(points[i] for i in indices)
        tris += len(indices) // 3
    need(sorted(used_materials) == list(range(len(material_names))), "Expected one primitive per material")
    need(used_accessors == set(range(len(doc["accessors"]))) and
         {doc["accessors"][i]["bufferView"] for i in used_accessors} == set(range(len(doc["bufferViews"]))),
         "Unused accessor or bufferView")
    need(front and back, "Missing outward-facing +Z and -Z triangles")
    low = list(map(min, zip(*positions)))
    high = list(map(max, zip(*positions)))
    need(bounds_match([low[0] + high[0], low[1], low[2]], [0, 0, 0]), "Expected bottom-centre-back origin")
    measures = [b - a for a, b in zip(low, high)]
    for axis, extent, nominal, actual in zip(DIMENSIONS, CONTRACT["nominalFasciaMetres"], spec["sizeMetres"], measures):
        need(0 < actual <= extent + TOLERANCE, f"Invalid authored {axis}")
        if nominal is not None:
            need(bounds_match([actual], [nominal]), f"Incorrect {axis}: {actual:.6f} m, expected {nominal:.6f} m")
    need(0 < tris <= spec["trianglesMax"], f"Triangle budget exceeded: {tris}")
    item = {
        "name": path.stem,
        "file": path.name,
        "bytes": len(raw),
        "tris": tris,
        "materials": material_names,
        "sizeMetres": [round(measure, 6) for measure in measures],
        "sourceScript": "scripts/build_signage_kit.py",
        "sha256": hashlib.sha256(raw).hexdigest(),
        "provenance": spec["provenance"],
    }
    if "sourceArtwork" in spec:
        item["sourceArtwork"] = spec["sourceArtwork"]
        item["sourceArtworkSha256"] = hashlib.sha256((ROOT / spec["sourceArtwork"]).read_bytes()).hexdigest()
    return item


def collect_manifest():
    need({p.stem for p in MODELS.glob("*.glb")} == CONTRACT["models"].keys(), "Unexpected or missing GLB files")
    assets = []
    for name, spec in CONTRACT["models"].items():
        try:
            assets.append(inspect_model(MODELS / f"{name}.glb", spec))
        except (ValueError, KeyError, IndexError, TypeError, struct.error) as error:
            raise ValueError(f"{name}: {error}") from error
    total_tris, total_bytes = (sum(record[key] for record in assets) for key in ("tris", "bytes"))
    budgets = CONTRACT["budgets"]
    need(total_tris <= budgets["triangles"] and total_bytes <= budgets["bytes"], "Whole-kit budget exceeded")
    return {"version": 1, "coordinates": CONTRACT["coordinates"],
            "nominalFasciaMetres": CONTRACT["nominalFasciaMetres"], "frame": CONTRACT["frame"],
            "materialLibrary": CONTRACT["materials"], "budgets": budgets,
            "totals": {"assets": len(assets), "tris": total_tris, "bytes": total_bytes, "textures": 0},
            "assets": assets}


def validate_size(preset, size_metres):
    need(len(size_metres) == len(DIMENSIONS), "Expected width, height and depth")
    for axis, size in zip(DIMENSIONS, size_metres):
        lo, hi = preset[axis]
        need(type(size) in (int, float) and lo <= size <= hi, f"{axis} outside preset range {lo}–{hi} m")


def contrast(foreground, background):
    def luminance(color):
        return sum(c * w for c, w in zip(linear_rgb(color), (.2126, .7152, .0722)))

    dark, light = sorted((luminance(foreground), luminance(background)))
    return (light + .05) / (dark + .05)


def validate_presets():
    data = json.loads((MODELS / "presets.json").read_text(encoding="utf-8"))
    presets = data["presets"]
    materials = CONTRACT["materials"]
    names = "classic fashion cafe tech book beauty home kids".split()
    need(set(presets) == {f"t{i}-{name}" for i, name in enumerate(names, 1)}, "Expected the eight named presets")
    need(data["unit"] == CONTRACT["coordinates"]["unit"], "Incorrect preset units")
    slots = json.loads((ROOT / data["storeSource"]).read_text(encoding="utf-8"))
    lettering = data["lettering"]
    need(lettering["minContrast"] >= 4.5 and lettering["targetXHeightMetres"] > 0,
         "Insufficient lettering specification")
    artwork_path = ROOT / data["artworkSource"]
    artwork = json.loads(artwork_path.read_text(encoding="utf-8"))
    for slot, store in slots.items():
        receipt = artwork[slot]
        need(receipt["brand"] == store["brand"] and receipt["status"] == "found"
             and (artwork_path.parent / receipt["file"]).is_file(), f"Missing existing artwork for {slot}")
    sprite = ElementTree.parse(MODELS / data["unbrandedIconSprite"])
    motif_ids = [symbol.attrib["id"] for symbol in sprite.iter("{http://www.w3.org/2000/svg}symbol")]
    need(sorted(motif_ids) == sorted(preset["iconMotif"] for name, preset in presets.items() if name != "t1-classic"),
         "Unbranded SVG symbols must match the preset motifs")
    assigned = []
    for name, preset in presets.items():
        for axis in DIMENSIONS:
            lo, hi = preset[axis]
            need(all(type(x) in (int, float) and math.isfinite(x) for x in (lo, hi)) and 0 < lo <= hi,
                 f"Invalid {axis} range: {name}")
            if axis in ("width", "height"):
                need(lo > 2 * CONTRACT["frame"]["cornerMetres"], f"No room for {axis} rails: {name}")
        need(preset["depth"][1] <= CONTRACT["nominalFasciaMetres"][2], f"Excess fascia depth: {name}")
        need(preset["height"][0] - 2 * CONTRACT["frame"]["railWidthMetres"] >= lettering["targetXHeightMetres"],
             f"Insufficient face height: {name}")
        need(all(preset[key] in materials for key in ("fascia", "trim", "housing")), f"Unknown finish: {name}")
        need(all(module in CONTRACT["models"] for module in preset["accentModules"]), f"Unknown module: {name}")
        need(type(preset["downlights"]) is bool and preset["typography"] and preset["iconMotif"],
             f"Missing style fields: {name}")
        backgrounds = [materials[preset["fascia"]]["color"], *preset.get("fasciaGradient", [])]
        minimum = min(contrast(letter, background) for letter in preset["letterColors"] for background in backgrounds)
        need(minimum >= lettering["minContrast"], f"{name} contrast {minimum:.2f}:1 is too low")
        assigned.extend(preset["storeSlots"])
        if name != "t1-classic":
            need(not preset.get("reliefBySlot"), f"Unexpected 3D branding: {name}")
        print(f"{name}: {minimum:.2f}:1 minimum design contrast, {len(preset['storeSlots'])} store slots")
    need(sorted(assigned) == sorted(slots), "Existing brand slots must be assigned exactly once")
    classic = presets["t1-classic"]
    need("S01" in classic["storeSlots"] and slots["S01"]["brand"] == "New Moon"
         and classic["reliefBySlot"] == {"S01": "sign_logo3d_new_moon"}
         and classic["iconMotif"] == "official-crescent", "New Moon must use the classic relief")
    validate_size(classic, (6.0, .9, .055))


def main():
    manifest = collect_manifest()
    recorded = json.loads((MODELS / "manifest.json").read_text(encoding="utf-8"))
    need(manifest == recorded, "Manifest differs from GLB bytes or source contract. Rebuild the signage kit.")
    validate_presets()
    for item in manifest["assets"]:
        print(f"{item['name']:25} {item['tris']:4} tris  {item['bytes']:6} bytes")
    total = manifest["totals"]
    print(f"PASS: {total['assets']} GLBs, {total['tris']} triangles, {total['bytes']} bytes, zero textures")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, IndexError) as error:
        raise SystemExit(f"FAIL: {error}") from error
