# GJH v11 sound and music

Open **Tools → Sound** for the **Music** toggle, the **Sound on/off** master switch, and the independent sliders under **Volume settings**. The desktop **M** hint matches the master-mute keyboard shortcut. Music is off on a fresh visit across all tiers. Turning Music on displays the generated piece title and saves the choice. The live status announces playback changes. The Sony and Casio **Demo audio** controls share the mute for showroom action cues.

Arrival gestures and Enter now can construct a suspended audio context during entry. After the loader hides, the first trusted scene gesture resumes it. Deep links can prepare it during stationary idle time. On Low phones, the scene prepares a suspended context behind the loader. With Music off, the first footsteps and effects stay silent until the visitor opens Tools after an effect is requested or explicitly enables sound. Music waits at least 1.5 seconds after audio resumes. The default bus levels are 26% music, 65% effects and 30% ambience. Master mute and tab visibility suspend the context and cancel speech. Returning to the 3D scene restores eligible playback. Settings persist under `gjh-v11-audio-v1` in local storage and fall back to page memory if storage is blocked.

## Score and cues

- A date and a random per-session visitor seed choose the key, mode, tempo and progression for the courtyard, New Moon, upper level, Christmas and tram. The score generates eight-bar phrases with broken chords, melody variations, rests and soft velocity changes. The scheduler generates the phrase a bar at a time as playback reaches each bar. The tram takes precedence over location, and Christmas provides the courtyard theme.
- The lookahead wakes every 75 ms and schedules up to 180 ms ahead on the audio clock. A visible tram caption or its narration lowers the music bus to 32% of its selected level. A played shop effect briefly ducks the same bus.
- Playback starts on electric-piano oscillators and then requests 12 MP3s (about 824 KiB on disk). Sample reads and decodes run in sequence, with at most one asynchronous `decodeAudioData` call per idle frame. Switching from electric-piano oscillators to the samples happens at a bar boundary after all samples decode. A failed fetch or decode keeps the oscillator piano active. The sampler repitches the nearest sample and uses a short gain release, with limits of 12 voices on phones and 24 on desktop.
- Piano: Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0. The local copies come from the [Tone.js mirror](https://github.com/Tonejs/audio/tree/master/salamander). See the [license](https://creativecommons.org/licenses/by/3.0/) and the [sample attribution](../demos/corporate/gjh/v11/assets/audio/piano/LICENSE.txt).
- Footsteps follow collision-corrected distance on foot and stop while seated or riding. Store and lift doors cue at motion boundaries. The lift has an activation ding and a two-note floor arrival signal. Successful pickup, bag additions and drop or return each have a tick.
- The shop effect table follows the runtime actions derived from the interior program. Tea, drinks and watering use a pour patch. Trays and samples use a clink or short tick. Other patches cover bells, paper, cases, drawers, controls, the Sony sample, Casio keys and Gigaset ring. Cancelling a showroom action releases its voice. The mute action uses its existing visual and text feedback.
- The tram plays a departure bell, a quiet hum while moving and a station chime. **Voice** is off on a fresh visit. The visible brand caption and optional speech share English, Simplified Chinese or Malay copy. Skip, End and Pause cancel current speech. Resume reads the current caption from the beginning. The Voice toggle checks for a compatible system voice. A saved Voice preference can narrate with the browser's default voice before the toggle is used in the current visit. Captions remain available with speech or sound disabled.

## Runtime and verification

`assets/audio.js` owns the context, mixer, preferences and audio-clock scheduler. `assets/piano-composer.js` generates the score, and `assets/piano-sampler.js` loads and plays the samples. The two piano modules are imported during idle time after the loader closes. The samples are published with the mall and use its cache-first, build-versioned runtime cache. They are excluded from the startup pack and the worker install precache.

The mixer warms one graph operation per qualifying idle frame. Music has four oscillator fallback slots. Effects and ambience share two slots on phones and four on desktop. Disabling music disconnects its bus, stops scheduled notes and cancels an in-progress sample load. `__mall.performanceReport()` exposes `audioCreateMs`, `audioCreateDuring`, `audioCreateFrame`, `audioInitMs` and `audioInitSliceMaxMs`.


```sh
python3 scripts/build_gallery.py --check
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p test_gallery.py -v
```

Node tests exercise default-off and Low-phone opt-in, lazy loading, per-frame decode dispatch, the sampler voice cap, oscillator fallback, bar-boundary switching, composer determinism and meter, bus ducking, and teardown. Real-device verification measures the startup and opt-in frame budgets, checks iOS audio unlock and confirms playing levels and transitions by listening. Use the existing [early-entry probe](early_entry_probe.py) and [lap probe](gjh-v11-probes.md) for the 50 ms frame threshold and scene budgets.
