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

These are candidates, not a statement they were integrated. The puddle is a static asset, not a rain or water simulation. No vending-machine model was identified in the inspected top-level model directories. The existing v11 area already contains an areca planter and lounge bench. Before importing any asset, confirm model appearance, dimensions, browser performance, rights/provenance and changes to the intended composition.
