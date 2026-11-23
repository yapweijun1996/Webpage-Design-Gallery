# Mini Street - Blender Asset Reuse Audit

Inspected 2026-11-23 against Blender-3D-Gallery main commit `2e97b66bbf8eba6d14653f70d7021e6d9377cfce`. Asset metadata/README reports permission to reuse in the owner's projects; a general public redistribution license is not specified. Verify provenance and licensing before wider distribution. The Singapore and Malaysia facades are derived extracts and must retain upstream provenance. Model metadata describes local checks; actual phone and WebKit behavior has not been verified in this prototype.

| Candidate | Upstream path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Singapore shophouse facade | `models/singapore-shophouse-facade/exports/singapore-shophouse-facade.glb` | 166160 | `8045241714863f2b5880b94cab7a3b9fa40d6ab08b4e525e2281a2fa66955933` |
| Malaysia shoplot facade | `models/malaysia-shoplot-facade/exports/malaysia-shoplot-facade.glb` | 97320 | `4870f97d7ea364c29dd87a17293e1260b176f52e86db1f916b33662e943fd99f` |
| Five-foot way | `models/five-foot-way/exports/five-foot-way.glb` | 97836 | `b44a2a5b806a71acd3de07dc601f2ff477d793b0d6eab7572d427228cc64e3a8` |
| Heritage street lamp | `models/heritage-street-lamp/exports/heritage-street-lamp.glb` | 51252 | `08ffb4f9bd61e45c956df84a0fcabf3e1c58f9c88068bca3d5620b4b1e617bc1` |
| Rainwater puddle | `models/rainwater-puddle/exports/optimized.glb` | 42876 | `7abf8a322b3f3d7b1ec01721d7656e2566ac0b9f71283ef193e33f18f44bff41` |
| Mall entrance | `models/mall-entrance/exports/optimized.glb` | 152500 | `aa1c58f8c8e097b27a863a6c8b536799eb647ce4e6eced03d7f59e8227f1541d` |

Source base: https://github.com/yapweijun1996/Blender-3D-Gallery/tree/2e97b66bbf8eba6d14653f70d7021e6d9377cfce

The six local candidate files were checked against the recorded byte counts and SHA-256 values for this pass. Their simplified material palettes and prebuilt proportions were less suitable for the continuous storefront, arcade and recessed retail interior. The flat puddle would duplicate the street's camera-dependent reflection. Mini Street uses its own geometry for these features. The v11 lounge bench and areca planter were reviewed as existing in-repository alternatives. The street uses original props tailored to the narrow pavement.

## New Moon label atlas

The four existing v11 can LOD1 models contain one JPEG each, derived from official packshot panels. The corresponding `*.metadata.json` files identify the packshot sources and record owner-confirmed use in the owner's project. Packaging artwork belongs to GJH / New Moon and the records do not supply a separate public redistribution license. The atlas reuses those label pixels in the same project. It adds no copy, prices, marks or products. The original 768 px front packshots serve the accessible shop dialog.

| Atlas row, top to bottom | v11 source under `assets/` | Verified bytes | Verified SHA-256 |
| --- | --- | ---: | --- |
| New Zealand 425 g | `new-moon-can-nz-425g-lod1.glb` | 158528 | `fcb92b1c62e10338a3295cb56006365da747ad7f25d6b6bec0964d600b742cdb` |
| Australia 425 g | `new-moon-can-au-425g-lod1.glb` | 153464 | `d1ae9ff1b35a65c6bb4cafb4a70ff3dd746bf3f70c8ffdac3f93546478feacde` |
| South Africa 425 g | `new-moon-can-sa-425g-lod1.glb` | 156540 | `7728989f5e4c695c7b4765d219501349898ca1e72f0630bde13c66fc9811e0b5` |
| Mexico 454 g | `new-moon-can-mx-454g-lod1.glb` | 119196 | `52f8952ca698cc77c6aaf8f1ef5c607a31c401817e6bf6741426e17510164acb` |

Each embedded JPEG was resolved by `images[0].bufferView` in its GLB and resampled to 512 × 92 with Pillow Lanczos. Two copies of the nearest edge row pad the top and bottom of each strip. The stacked strips were encoded together at WebP quality 87 and method 6. Output `assets/new-moon-label-atlas.webp` is 512 × 384 and 70,654 bytes with SHA-256 `d0c5781dcacbfd84af914143453dd485c10405c25fcb90a1418582ea21eab5a3`.
