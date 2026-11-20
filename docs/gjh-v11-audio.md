# GJH v11 sound and music

Open **Tools** for **Mute sound**, **Background music**, and the three bus sliders under **Volume settings**. The speaker button and **M** share the master mute. The **Music on** and **Music off** status is announced when playback changes. The Sony and Casio **Demo audio** controls share one shop mute. It applies to showroom action cues and shop motifs.

The first trusted mall gesture unlocks audio. During early entry the gesture can prime a silent mixer, then music starts after the loader is gone. The default bus levels are 26% music, 65% effects and 30% ambience. Background music starts enabled except on Low phones, with reduced motion, or when the browser exposes Data Saver as enabled. Selecting Background music explicitly overrides those defaults. Master mute and a hidden tab suspend the audio context and cancel current speech. Returning to the 3D scene restores eligible playback. Settings persist under `gjh-v11-audio-v1` in local storage and fall back to page memory if storage is blocked. [Web Audio context lifecycle](https://www.w3.org/TR/webaudio/) · [Chrome autoplay and Web Audio](https://developer.chrome.com/blog/autoplay#web_audio)

## Score and cues

- One audio-clock timeline plays eight bars at 72 BPM. The score uses major-seventh and ninth voicings, soft electric piano, plucked bass and a swung brush on the offbeats. The courtyard uses the warm C-major voicing, the upper deck shifts up to D and uses a mallet timbre, and shops can change the key and timbre at a bar boundary. Each shop has a short entry motif on that same timeline.
- The lookahead wakes every 75 ms and schedules up to 180 ms ahead. The loop wraps without restarting its clock or downloading audio. A visible tram caption or its narration lowers the music bus to 32% of its selected level. A played shop effect briefly ducks the same bus.
- Footsteps follow collision-corrected distance on foot and stop while seated or riding. Store and lift doors cue at motion boundaries. The lift has an activation ding and a two-note floor arrival signal. Successful pickup, bag additions and drop or return each have a tick.
- The shop effect table follows the runtime actions derived from the interior program. Tea, drinks and watering use a pour patch. Trays and samples use a clink or short tick. Other patches cover bells, paper, cases, drawers, controls, the Sony sample, Casio keys and Gigaset ring. Cancelling a showroom action releases its voice. The mute action uses its existing visual and text feedback.
- The tram plays a departure bell, a quiet hum while moving and a station chime. **Voice** is off on a fresh visit. The visible brand caption and optional speech share English, Simplified Chinese or Malay copy. Skip, End and Pause cancel current speech. Resume reads the current caption from the beginning. Voice uses a compatible system voice when present and otherwise leaves voice selection to the browser. Captions remain available with speech or sound disabled.

## Runtime and verification

`assets/audio.js` owns the context, mixer buses, oscillator pool and preferences. The entry, player and world bundles reference the same external module, as do the lazy shop and lift modules. Phone mode has four music slots and two shared effect/ambience slots. Foreground cues can reclaim a footstep or rail slot. Effects are preallocated during activation and music slots are created by the scheduler. Disabling music disconnects its bus and clears the timer. Playback updates are driven by scene events, travelled distance and the audio clock.

```sh
python3 scripts/build_gallery.py --check
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p test_gallery.py -v
```

The fake-context tests cover gesture gating, mute and preference persistence, bus ducking, Low-phone opt-in, timing across the loop seam, narration cancellation, all effect kinds in the authored interior program, pool reuse and teardown. Use a physical phone to measure the 30 FPS and 2% audio CPU targets and check iOS unlock, voice availability and audible loop continuity. Use the existing [early-entry probe](early_entry_probe.py) and [lap probe](gjh-v11-probes.md) for the zero-frames-at-or-above-50-ms entry gate and scene budgets. The sandbox rejected local Chrome startup, so those live measurements remain open.
