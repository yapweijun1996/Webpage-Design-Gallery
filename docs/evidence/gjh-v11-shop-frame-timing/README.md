# New Moon and MILI frame timing

Headed Chrome on Apple M4 Metal recorded the Everyday showroom in Low at 390 × 844 and Detailed at 1440 × 900. The host reported a 60 Hz display. For each viewport the runner loaded the earlier revision, the changed revision twice, then the earlier revision again. Each fresh browser context held three positions for two 4.5-second samples apiece. NPCs used the ordinary runtime setting. The Map destination placement, inside entrance and cabinet aisle or cookline were sampled after loading.

The FPS column is the median of the twelve window averages per revision and viewport. The frame-time column gives the range of the twelve within-window 95th percentiles. The last column totals individual frame gaps longer than 50 ms.

| Shop | Viewport | Revision | Frames | Median FPS | Window p95, ms | Gaps over 50 ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| New Moon | 390 | `3c5c572eb` | 1,609 | 30.00 | 34.9–35.3 | 0 |
| New Moon | 390 | `b5d93f0c1` | 1,611 | 30.00 | 34.3–35.3 | 0 |
| New Moon | 1440 | `3c5c572eb` | 3,287 | 60.00 | 18.1–18.6 | 0 |
| New Moon | 1440 | `b5d93f0c1` | 3,240 | 60.00 | 18.1–18.6 | 0 |
| MILI | 390 | `22d7c7885` | 1,609 | 30.00 | 34.8–35.3 | 0 |
| MILI | 390 | `607615f4f` | 1,610 | 30.00 | 34.4–35.1 | 0 |
| MILI | 1440 | `22d7c7885` | 3,238 | 60.00 | 18.1–18.7 | 0 |
| MILI | 1440 | `607615f4f` | 3,247 | 60.00 | 18.3–18.6 | 0 |

Across 96 windows the host’s one-minute load average at browser-context start or end ranged from 10.2 to 170.4. Different NPC positions and host load can change individual draws and frame gaps. These runs cover settled displays on one Mac. Physical phone, tablet and Windows frame timing, cold startup and movement through the doorway require separate measurements.

[New Moon per-window measurements](newmoon.csv) · [MILI per-window measurements](mili.csv) · [Measurement implementation](../../mall_lap_probe.py)
