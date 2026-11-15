# GJH Virtual Mall — Interior 3D Asset Production Backlog v1.0

> **Scope:** 200 unique reusable Blender assets · 10 categories × 20 assets. All sizes are **proposed bounding boxes in metres (W×D×H)**, not measured site dimensions. Priority and budgets are design targets pending real-device benchmarking.

## 1. Asset contracts

- **Coordinate:** Blender metric; Z-up; 1 BU = 1 m; origin at ground-centre for props and at snap anchor for architectural modules. GLB uses glTF 2.0 coordinate conversion on export.
- **IDs:** `GJH-{CATEGORY}-{001..020}` stable and never reused. `asset_id` stored in root node `extras`.
- **Naming:** `GJH_ARC_001.blend` → `GJH_ARC_001.glb`; collections `VISUAL`, `COLLISION`, `SOCKETS`, `LOD0`, `LOD1`, `LOD2`. Export visual nodes and optional socket metadata; collision exported separately or flagged non-renderable.
- **LOD:** L0 near (0–10m), L1 medium (10–25m), L2 far (>25m), with screen-space error overriding distance. L0/L1/L2 triangle ceilings: architectural 4k/2k/500; lighting 2k/800/150; flooring 1k/300/100; storefront 8k/3k/700; displays 6k/2k/400; public props 6k/2k/400; facilities 5k/2k/400; vertical circulation 12k/5k/1k. These are per-asset targets, not scene budgets.
- **Materials:** PBR metallic-roughness; baseColor/normal/ORM; 1K shared atlases preferred; 2K only for hero assets; KTX2 where supported. M01 plaster, M02 stone, M03 glass, M04 metal, M05 wood, M06 emissive, M07 non-slip, M08 fabric, M09 foliage, M10 plastic.
- **Interactions:** `NONE` for passive geometry; `INSPECT`, `OPEN`, `PICKUP`, `SIT`, `USE`, `TRAVEL` are *capability labels*, not promises that animations are implemented. Trigger volumes, UI prompts and gameplay state live in app code.
- **Priority:** P0 navigable shell, essential lighting/storefronts/safety; P1 merchandising, furnishings, public services; P2 ornamental variants and advanced mechanisms.

## 2. Common GLB acceptance gates

Every row must pass **G01–G12** unless an explicitly approved exception is documented:

1. **G01 Identity:** unique ID; filename, root node, asset manifest and version match.
2. **G02 Transform:** scale applied (1,1,1), no unintended negative determinant, ground/snap anchor correct, dimensions within ±1% of target unless approved.
3. **G03 Geometry:** no unintended non-manifold/open edges, inverted normals, z-fighting, duplicate faces or floating geometry. Open surfaces such as planes/glass are allowed when intentional.
4. **G04 UV:** UV0 non-overlapping for baked unique textures (unless deliberate tiling); correct texel density; UV1 for lightmaps when required.
5. **G05 PBR:** glTF-compatible shaders; no missing textures; physically plausible roughness/metalness; no Blender-only procedural nodes left unresolved.
6. **G06 LOD:** required LOD0/1/2 supplied or documented as instance-only/simple-asset exemption; silhouette retained; no visual pop at transitions.
7. **G07 Performance:** triangle and texture budgets met; instancing and batching supported; no per-tile unique mesh explosion.
8. **G08 Collision:** simplified collision proxy and walkable/navmesh metadata for blocking surfaces; no collision for purely decorative lights unless necessary.
9. **G09 Interaction:** capability and anchors recorded; interactive assets have accessible prompt text, hit targets and deterministic state transitions.
10. **G10 Export:** GLB parses in two independent viewers; material/mesh hierarchy and orientation correct; no missing external resources.
11. **G11 Visual QA:** front, side, back, top, 3/4 and in-scene captures; mobile/desktop, day/night and light/dark UI overlay review where relevant.
12. **G12 Automated QA:** headless Blender export smoke test, glTF validator, dimensions/ID checks, load/unload test, visual regression and app E2E for interactive assets.

## 3. Detailed backlog

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|

### ARC — 建筑与墙体

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|
| GJH-ARC-001 | 直墙4m | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-002 | 直墙2m | 2×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-003 | 弧墙90° | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-004 | 弧墙45° | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-005 | 转角墙内角 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-006 | 转角墙外角 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-007 | 玻璃幕墙 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-008 | 立柱方形 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-009 | 立柱圆形 | 4×2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-010 | 包柱饰面 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-011 | 隔断半高 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-012 | 隔断玻璃 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-013 | 拱形门洞 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-014 | 标准门洞 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-ARC-015 | 双开门洞 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-ARC-016 | 防火门 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-ARC-017 | 检修门 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-ARC-018 | 踢脚线 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-ARC-019 | 墙面装饰板 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-ARC-020 | 消防分区卷帘 | 4×0.2×3.6 | M01石膏/M03玻璃/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |

### COR — 走廊与通道

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|
| GJH-COR-001 | 直走廊4m | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-002 | 直走廊8m | 8×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-003 | 宽走廊8m | 8×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-004 | L形转角 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-005 | T形交汇 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-006 | 十字交汇 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-007 | 弧形走廊 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-008 | 坡道直线 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-009 | 坡道转角 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-010 | 无障碍缓坡 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-011 | 走廊护墙 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-012 | 走廊扶手 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-013 | 玻璃栏杆直段 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-014 | 玻璃栏杆转角 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-COR-015 | 金属栏杆直段 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-COR-016 | 栏杆端头 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-COR-017 | 导向地面标记 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-COR-018 | 入口门槛 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-COR-019 | 过渡连接板 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-COR-020 | 排队隔离通道 | 4×4×0.2 | M02石材/M03玻璃/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |

### CEI — 天花与屋顶

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|
| GJH-CEI-001 | 平顶4m | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-002 | 平顶8m | 8×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-003 | 跌级吊顶 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-004 | 弧形吊顶 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-005 | 圆形灯槽 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-006 | 矩形灯槽 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-007 | 线性灯槽 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-008 | 木格栅直段 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-009 | 木格栅转角 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-010 | 金属格栅 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-011 | 吸音板阵列 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-012 | 检修口 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-013 | 空调出风口 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-014 | 回风格栅 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-CEI-015 | 消防喷淋头 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-CEI-016 | 烟雾探测器 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-CEI-017 | 天窗模块 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-CEI-018 | 玻璃穹顶扇区 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-CEI-019 | 中庭挑空边缘 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-CEI-020 | 吊挂结构节点 | 4×4×0.25 | M01石膏/M05木纹/M04金属 | L0/L1/L2 | NONE | P2 | G01–G12 |

### LGT — 照明灯具

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|
| GJH-LGT-001 | 嵌入筒灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-LGT-002 | 轨道射灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-LGT-003 | 线性LED灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-LGT-004 | 灯带直段 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-LGT-005 | 灯带转角 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-LGT-006 | 圆环吊灯 | 2×2×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P0 | G01–G12 |
| GJH-LGT-007 | 双环吊灯 | 2×2×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-LGT-008 | 球形吊灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-LGT-009 | 壁灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-LGT-010 | 洗墙灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-LGT-011 | 橱窗聚光灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-LGT-012 | 店面招牌背光 | 0.4×0.4×0.2 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-LGT-013 | 台阶引导灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-LGT-014 | 地埋灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-LGT-015 | 应急照明灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-LGT-016 | 出口指示灯 | 0.8×0.1×0.4 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P1 | G01–G12 |
| GJH-LGT-017 | 装饰灯柱 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-LGT-018 | 吊装灯轨 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-LGT-019 | 庭院树射灯 | 0.4×0.4×0.25 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P2 | G01–G12 |
| GJH-LGT-020 | 导览屏背光框 | 0.4×0.4×0.2 | M04金属/M06发光/M03玻璃 | L0/L1/L2 | NONE | P2 | G01–G12 |

### FLR — 地面与铺装

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|
| GJH-FLR-001 | 米白石纹地面4m | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-002 | 灰石纹地面4m | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-003 | 木纹地面4m | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-004 | 防滑砖地面4m | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-005 | 地毯地面4m | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-006 | 人字拼地板 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-007 | 地砖边框 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-008 | 黄铜嵌条直段 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-009 | 黄铜嵌条转角 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-010 | 圆形拼花 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-011 | 导向地贴 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-012 | 防滑警示条 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-013 | 地面排水沟 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-014 | 伸缩缝盖板 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P0 | G01–G12 |
| GJH-FLR-015 | 地面检修盖 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P1 | G01–G12 |
| GJH-FLR-016 | 入口地垫 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P1 | G01–G12 |
| GJH-FLR-017 | 地面高差收边 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P2 | G01–G12 |
| GJH-FLR-018 | 楼梯踏步 | 3×5×3.5 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P2 | G01–G12 |
| GJH-FLR-019 | 楼梯平台 | 3×5×3.5 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P2 | G01–G12 |
| GJH-FLR-020 | 触觉引导砖 | 4×4×0.05 | M02石材/M05木纹/M07防滑 | L0/instance | NONE | P2 | G01–G12 |

### STF — 店面与橱窗

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|
| GJH-STF-001 | 标准店面4m | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P0 | G01–G12 |
| GJH-STF-002 | 标准店面8m | 8×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P0 | G01–G12 |
| GJH-STF-003 | 转角店面 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P0 | G01–G12 |
| GJH-STF-004 | 全玻璃店面 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P0 | G01–G12 |
| GJH-STF-005 | 开放式店面 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P0 | G01–G12 |
| GJH-STF-006 | 双开玻璃门 | 1.2×0.15×2.4 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P0 | G01–G12 |
| GJH-STF-007 | 自动滑门 | 1.2×0.15×2.4 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P0 | G01–G12 |
| GJH-STF-008 | 店铺招牌横牌 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | INSPECT | P0 | G01–G12 |
| GJH-STF-009 | 店铺招牌竖牌 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-STF-010 | 发光LOGO底座 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-STF-011 | 橱窗展示台 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P1 | G01–G12 |
| GJH-STF-012 | 橱窗背板 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P1 | G01–G12 |
| GJH-STF-013 | 橱窗灯箱 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-STF-014 | 可更换广告框 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-STF-015 | 卷帘门 | 1.2×0.15×2.4 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P1 | G01–G12 |
| GJH-STF-016 | 收银台 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P1 | G01–G12 |
| GJH-STF-017 | 试衣间门 | 1.2×0.15×2.4 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P2 | G01–G12 |
| GJH-STF-018 | 店内展示墙 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P2 | G01–G12 |
| GJH-STF-019 | 店铺门口防盗门 | 1.2×0.15×2.4 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | OPEN/INSPECT | P2 | G01–G12 |
| GJH-STF-020 | 店面模块连接器 | 4×0.5×3.6 | M03玻璃/M04金属/M06发光 | L0/L1/L2 | INSPECT | P2 | G01–G12 |

### DSP — 商品展示与零售家具

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|
| GJH-DSP-001 | 单面货架 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-002 | 双面货架 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-003 | 端架 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-004 | 壁挂货架 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-005 | 玻璃展示柜 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-006 | 锁柜展示柜 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-007 | 岛式陈列台 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-008 | 圆形展示台 | 2×2×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-009 | 服装挂杆 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-010 | 服装双层挂杆 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-011 | 模特底座 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-012 | 鞋墙模块 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-013 | 化妆品陈列架 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-014 | 电子产品体验桌 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-015 | 超市冷藏柜 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-016 | 超市冷冻柜 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P1 | G01–G12 |
| GJH-DSP-017 | 购物篮架 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P2 | G01–G12 |
| GJH-DSP-018 | 购物车停放架 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P2 | G01–G12 |
| GJH-DSP-019 | 促销堆头 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P2 | G01–G12 |
| GJH-DSP-020 | 价签轨道 | 1.2×0.6×1.8 | M04金属/M05木纹/M03玻璃 | L0/L1/L2 | INSPECT/PICKUP | P2 | G01–G12 |

### PUB — 公共家具与绿化

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|
| GJH-PUB-001 | 单人座椅 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT | P1 | G01–G12 |
| GJH-PUB-002 | 双人长椅 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT | P1 | G01–G12 |
| GJH-PUB-003 | 弧形沙发 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT | P1 | G01–G12 |
| GJH-PUB-004 | 模块化沙发角 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT | P1 | G01–G12 |
| GJH-PUB-005 | 茶几 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT | P1 | G01–G12 |
| GJH-PUB-006 | 公共桌 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT | P1 | G01–G12 |
| GJH-PUB-007 | 花盆小型 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT/INSPECT | P1 | G01–G12 |
| GJH-PUB-008 | 花盆大型 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT/INSPECT | P1 | G01–G12 |
| GJH-PUB-009 | 绿植隔断 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT/INSPECT | P1 | G01–G12 |
| GJH-PUB-010 | 室内树木 | 2.5×2.5×4 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT/INSPECT | P1 | G01–G12 |
| GJH-PUB-011 | 树池围边 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT/INSPECT | P1 | G01–G12 |
| GJH-PUB-012 | 垃圾分类桶 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | USE | P1 | G01–G12 |
| GJH-PUB-013 | 饮水机 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT/INSPECT | P1 | G01–G12 |
| GJH-PUB-014 | 充电站 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT/INSPECT | P1 | G01–G12 |
| GJH-PUB-015 | 手机充电柜 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT/INSPECT | P1 | G01–G12 |
| GJH-PUB-016 | 导览立柱 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | USE | P1 | G01–G12 |
| GJH-PUB-017 | 数字导览屏 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | USE | P2 | G01–G12 |
| GJH-PUB-018 | 信息咨询台 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | USE | P2 | G01–G12 |
| GJH-PUB-019 | 排队护栏 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT/INSPECT | P2 | G01–G12 |
| GJH-PUB-020 | 失物招领柜 | 1.5×0.7×0.9 | M08织物/M05木纹/M09绿植 | L0/L1/L2 | SIT/INSPECT | P2 | G01–G12 |

### FAC — 公共服务与安全

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|
| GJH-FAC-001 | 卫生间入口 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-002 | 洗手盆台 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-003 | 厕位隔断 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-004 | 无障碍厕位门 | 1.2×0.15×2.4 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-005 | 婴儿护理台 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-006 | 母婴室标识 | 0.8×0.1×0.4 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-007 | 储物柜 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-008 | 消防栓箱 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P0 | G01–G12 |
| GJH-FAC-009 | 灭火器箱 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P0 | G01–G12 |
| GJH-FAC-010 | AED急救柜 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P0 | G01–G12 |
| GJH-FAC-011 | 监控摄像头 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-012 | 安全出口标识 | 0.8×0.1×0.4 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P0 | G01–G12 |
| GJH-FAC-013 | 紧急呼叫按钮 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-014 | 防撞护角 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-015 | 保洁工具柜 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-016 | 服务机器人停靠站 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P1 | G01–G12 |
| GJH-FAC-017 | 自助服务终端 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P2 | G01–G12 |
| GJH-FAC-018 | 自动售货机 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P2 | G01–G12 |
| GJH-FAC-019 | 访客反馈终端 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P2 | G01–G12 |
| GJH-FAC-020 | 无障碍服务呼叫柱 | 0.8×0.5×1.8 | M04金属/M07防滑/M10塑料 | L0/L1/L2 | USE/INSPECT | P2 | G01–G12 |

### VER — 垂直交通与中庭

| Asset ID | Model / 模型 | W×D×H (m) | Materials | LOD | Interaction | Priority | GLB gate |
|---|---|---:|---|---|---|---|---|
| GJH-VER-001 | 扶手电梯上行段 | 1.5×8×4 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | TRAVEL/INSPECT | P1 | G01–G12 |
| GJH-VER-002 | 扶手电梯下行段 | 1.5×8×4 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | TRAVEL/INSPECT | P1 | G01–G12 |
| GJH-VER-003 | 扶梯入口梳齿板 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-VER-004 | 扶梯玻璃侧板 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-VER-005 | 扶梯扶手带 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-VER-006 | 电梯门组 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | TRAVEL/INSPECT | P0 | G01–G12 |
| GJH-VER-007 | 电梯轿厢 | 2×2×2.6 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | TRAVEL/INSPECT | P1 | G01–G12 |
| GJH-VER-008 | 电梯按钮面板 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-VER-009 | 电梯楼层指示 | 0.8×0.1×0.4 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P0 | G01–G12 |
| GJH-VER-010 | 楼梯直跑 | 3×5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | TRAVEL/INSPECT | P0 | G01–G12 |
| GJH-VER-011 | 楼梯转角平台 | 3×5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | TRAVEL/INSPECT | P1 | G01–G12 |
| GJH-VER-012 | 楼梯扶手 | 3×5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P0 | G01–G12 |
| GJH-VER-013 | 中庭栏杆弧段 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-VER-014 | 中庭栏杆直段 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P0 | G01–G12 |
| GJH-VER-015 | 中庭花坛 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-VER-016 | 中庭景观座椅 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P1 | G01–G12 |
| GJH-VER-017 | 中庭装饰雕塑基座 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P2 | G01–G12 |
| GJH-VER-018 | 中庭吊挂装饰 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P2 | G01–G12 |
| GJH-VER-019 | 楼层指示牌 | 0.8×0.1×0.4 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P2 | G01–G12 |
| GJH-VER-020 | 玻璃观光电梯井 | 3×1.5×3.5 | M04金属/M03玻璃/M02石材 | L0/L1/L2 | INSPECT | P2 | G01–G12 |

## 4. Integration & release milestones

- **Count verification:** 200 assets = P0 79, P1 81, P2 40.
- **Milestone M0:** shared scale, material atlas, Blender exporter, validators and scene fixture.
- **Milestone M1:** all P0 assets; one traversable corridor, four storefronts, entrance, collision and accessible wayfinding.
- **Milestone M2:** P1 assets; usable retail fixtures, seating, toilets, signage and vertical circulation prototypes.
- **Milestone M3:** P2 polish, night lighting, scene streaming, performance profiling and mobile visual QA.
- **Dependency:** functional escalator/elevator requires gameplay logic, animation and navigation links beyond the static GLB. Fire/safety systems are visual simulation only and not a substitute for building-code design.

## 5. Asset manifest example

```json
{
  "asset_id": "GJH-STF-001",
  "version": "1.0.0",
  "dimensions_m": [4, 0.5, 3.6],
  "priority": "P0",
  "lods": ["LOD0", "LOD1", "LOD2"],
  "capabilities": ["OPEN", "INSPECT"],
  "collision": "GJH-STF-001_collision.glb",
  "snap_sockets": ["left", "right", "floor"],
  "qa_gates": ["G01", "G02", "G03", "G04", "G05", "G06", "G07", "G08", "G09", "G10", "G11", "G12"]
}
```

## 6. Definition of Done

An asset is **Done** only when `.blend`, `.glb`, manifest, collision proxy (if applicable), visual QA captures and automated gate results exist; GLB loads in the real GJH runtime and all required gates pass. Failed gates return the asset to In Progress. No row in this backlog implies the asset has already been built or tested.
