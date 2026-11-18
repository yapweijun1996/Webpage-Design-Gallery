# GJH modular sign assets

Author in Blender 5.x and export plain, self-contained glTF 2.0 binary files here. The system currently ships procedural hardware and artwork-derived letter relief. Register each delivered filename once in `modelFiles` in [models.js](../models.js). A file can carry several named modules. The loader fetches registered files on the first Balanced or Detailed view. Low makes zero model requests. Missing files or missing module IDs fall back independently.

## Coordinates and assembly

Work in metres. glTF +Y is up and the visible face points along +Z. The mounting wall is at z = 0. Put the file origin at the bottom centre of the back plane. A complete nominal panel is 1.0 m wide by 0.6 m high and at most 0.06 m deep. Individual fittings fit inside that envelope at their own physical dimensions. A library may lay fittings out on the nominal panel. Keep every vertex on or in front of the mounting plane. The test evaluates transformed vertices with a 1 mm tolerance. glTF supplies the default unit and axes. If present, asset extras `metersPerUnit`, `upAxis` and `frontAxis` must be 1, `+Y` and `+Z`.

Prefix every node with `sign_`. Give each replaceable module one unique node ID across the inventory. Its child meshes can carry multiple material primitives. Orient trim profiles in the panel plane. The runtime preserves module-local pieces, sizes them to their sockets and instances the assembled hardware across nearby stores.

| Module ID | Socket |
| --- | --- |
| `sign_backplate` | Full panel behind the shared artwork face |
| `sign_frame_corner` | Bottom-left 90° corner, rotated at the other three corners |
| `sign_frame_edge_h` | Horizontal rail between corner pieces |
| `sign_frame_edge_v` | Vertical rail between corner pieces |
| `sign_blade_bracket` | Wall-mounted arm reaching toward the concourse |
| `sign_downlight` | Small recessed fitting along the upper rail |
| `sign_logo3d_<brand>` | Opt-in Detailed anchor relief, fitted proportionally to the registered artwork region |

The installed bracket projects into the aisle. Its authored module still obeys the common asset depth limit. Author its long axis horizontally and the mounting end at local -X. The runtime turns this axis toward the aisle. Rails stretch lengthwise; corner radii, rail thickness and light sizes stay fixed. Keep unrelated replaceable module nodes as siblings.

## Materials and artwork

The PBR metallic-roughness factors in [tokens.js](../tokens.js) are authoritative, in linear glTF colour space. Use a single material for each named class per file. The classes are `brass_trim`, `lacquer_fascia`, `timber_slat`, `emissive_letter`, `glass_panel`, `brushed_black`, `gunmetal`, `gold_disc` and `silver_ring`. Hardware packs their colour, emission, roughness and metalness into one shared instanced draw. Sign and poster images are supplied by the shared runtime atlas. Use factor-only materials on the modular solid parts.

Use the local GLTFLoader and uncompressed triangle primitives. Vendor has no Draco, KTX2 or meshopt decoder. Retain provenance for every branded relief. The New Moon socket covers the crescent of the official SVG; the rest of its lockup stays registered to the same atlas projection. Add a model only with an identifiable source silhouette and matching dimensions.

## Acceptance

Run `node --test tests/gjh_signage_models.test.mjs tests/gjh_signage.test.mjs` at repository root. The validator enumerates every GLB in this directory, parses the actual binary geometry through the vendored loader, checks transformed bounds, winding, names and material factors, and rejects duplicate module IDs across files. The invalid-contract tests also run against in-memory geometry when the directory has no GLBs.

Verify the file at its published URL under `v11/assets/signage/models/`. The current gallery publisher enumerates selected asset subdirectories. Delivery of the first GLB requires including this directory in its publish list. Record bytes, triangles, draw calls and views before/after loading the asset in the full mall. [System and review procedure](../../../../../../../docs/gjh-v11-signage-system.md)
