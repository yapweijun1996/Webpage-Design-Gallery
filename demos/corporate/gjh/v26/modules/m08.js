document.addEventListener('gjh:ready', () => {
  const section = document.querySelector('#m08 .m08-studio');
  if (!section) return;

  const find = (selector) => section.querySelector(selector);
  const audio = find('#m08-audio');
  const player = find('.m08-player');
  const wave = find('.m08-wave');
  const play = find('#m08-play');
  const playLabel = find('#m08-play-label');
  const playIcon = find('#m08-play-icon');
  const seek = find('#m08-seek');
  const elapsed = find('#m08-elapsed');
  const length = find('#m08-length');
  const rate = find('#m08-rate');
  const follow = find('#m08-follow');
  const audioStatus = find('#m08-audio-status');
  const transcriptStatus = find('#m08-transcript-status');
  const list = find('#m08-lines');
  const languages = section.querySelectorAll('[data-m08-language]');
  const voices = { A: 'marin', B: 'cedar' };
  const evidenceCopy = { confirmed: '已证实', reported: '有报道', unverified: '未核实' };
  const editions = {
    zh: {
      audio: 'assets/gjh-podcast-zh.mp3',
      script: 'assets/script-zh.md',
      lang: 'zh-Hans',
      notes: { 1: [], 3: ['reported', 'unverified'], 11: ['unverified'], 12: [] },
    },
    en: {
      audio: 'assets/gjh-podcast.mp3',
      script: 'assets/script.md',
      lang: 'en',
      notes: { 1: [], 3: ['reported', 'unverified'], '10b': ['unverified'], 11: [] },
    },
  };
  const heights = [
    10, 19, 28, 16, 42, 60, 34, 54, 76, 45, 63, 90, 74, 49, 80,
    55, 35, 48, 26, 18, 32, 57, 80, 100, 69, 48, 83, 62, 94, 73,
    46, 66, 38, 57, 29, 16, 38, 54, 72, 44, 63, 34, 49, 23, 14,
  ];
  const bars = heights.map((height, index) => {
    const bar = document.createElement('span');
    bar.className = 'm08-bar';
    bar.style.setProperty('--m08-height', height + '%');
    bar.style.setProperty('--m08-delay', -(index % 9) * 95 + 'ms');
    wave.append(bar);
    return bar;
  });

  let language;
  let request;
  let lines = [];
  let activeLine;
  let duration = 0;

  function clock(seconds) {
    const wholeSeconds = Math.floor(seconds);
    return Math.floor(wholeSeconds / 60) + ':' + String(wholeSeconds % 60).padStart(2, '0');
  }

  function revealActiveLine() {
    if (!activeLine || !follow.checked || list.contains(document.activeElement)) return;

    const bounds = list.getBoundingClientRect();
    const row = activeLine.button.getBoundingClientRect();
    if (row.top < bounds.top + 4 || row.bottom > bounds.bottom - 4) {
      list.scrollTop += row.top - bounds.top - 4;
    }
  }

  function syncPosition() {
    const time = duration ? audio.currentTime : 0;
    const played = duration ? Math.round(time / duration * bars.length) : 0;
    for (const [index, bar] of bars.entries()) {
      bar.toggleAttribute('data-m08-passed', index < played);
    }

    seek.value = audio.ended ? seek.max : String(Math.floor(time));
    const position = clock(time);
    elapsed.textContent = position;
    seek.setAttribute('aria-valuetext', position + ' / ' + clock(duration));

    const nextLine = duration ? lines.findLast((line) => line.start <= time) : undefined;
    if (nextLine === activeLine) return;

    activeLine?.button.removeAttribute('aria-current');
    activeLine = nextLine;
    activeLine?.button.setAttribute('aria-current', 'true');
    revealActiveLine();
  }

  function syncTiming() {
    duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    seek.disabled = !duration;
    seek.max = String(Math.ceil(duration) || 1);
    length.textContent = clock(duration);

    const total = lines.reduce((sum, line) => sum + line.weight, 0);
    let precedingWeight = 0;
    for (const line of lines) {
      // Each transcript gets its own timeline based on the loaded media duration.
      line.start = precedingWeight / total * duration;
      line.time.textContent = duration ? clock(line.start) : '—';
      line.button.disabled = !duration;
      precedingWeight += line.weight;
    }

    syncPosition();
  }

  function seekTo(time) {
    if (!duration) return;
    audio.currentTime = Math.min(time, duration);
    syncPosition();
  }

  function renderTranscript(markdown, edition) {
    const rows = document.createDocumentFragment();
    const numberedLines = /^\s*(\d+[a-z]?)\.\s+([AB])[:：]\s*(\S.*?)\s*$/gmu;
    lines = Array.from(markdown.matchAll(numberedLines), ([, number, speaker, text]) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const meta = document.createElement('span');
      const time = document.createElement('span');
      const voice = document.createElement('span');
      const spoken = document.createElement('span');

      button.type = 'button';
      button.className = 'm08-line';
      meta.className = 'm08-line-meta';
      voice.textContent = '音色 ' + speaker + ' · ' + voices[speaker];
      spoken.lang = edition.lang;
      spoken.textContent = text;
      meta.append(time, voice);

      for (const status of edition.notes[number] ?? ['confirmed']) {
        const badge = document.createElement('span');
        badge.className = 'm08-evidence';
        badge.dataset.m08Evidence = status;
        badge.textContent = evidenceCopy[status];
        meta.append(badge);
      }

      const line = { button, time, weight: Array.from(text).length, start: 0 };
      button.addEventListener('click', () => seekTo(line.start));
      button.append(meta, spoken);
      item.append(button);
      rows.append(item);
      return line;
    });

    if (!lines.length) throw new Error('Transcript contains no numbered lines');
    list.replaceChildren(rows);
    syncTiming();
  }

  function syncPlayback() {
    const paused = audio.paused || audio.ended;
    playLabel.textContent = audio.ended ? '重新播放' : paused ? '播放' : '暂停';
    playIcon.setAttribute('d', paused ? 'M8 5v14l11-7z' : 'M7 5h4v14H7zM14 5h4v14h-4z');
    if (paused) player.removeAttribute('data-m08-playing');
  }

  function applyRate() {
    audio.defaultPlaybackRate = Number(rate.value);
    audio.playbackRate = Number(rate.value);
  }

  async function setLanguage(next) {
    if (next === language) return;

    request?.abort();
    request = new AbortController();
    const { signal } = request;
    const edition = editions[next];
    language = next;

    for (const button of languages) {
      button.setAttribute('aria-pressed', String(button.dataset.m08Language === next));
    }

    audio.pause();
    audioStatus.textContent = '';
    transcriptStatus.textContent = '正在加载文稿…';
    activeLine = undefined;
    lines = [];
    list.replaceChildren();
    list.scrollTop = 0;
    audio.src = edition.audio;
    audio.load();
    syncTiming();
    syncPlayback();

    try {
      const response = await fetch(edition.script, { signal });
      if (!response.ok) throw new Error('Transcript request failed');
      const markdown = await response.text();
      if (signal.aborted) return;
      renderTranscript(markdown, edition);
      transcriptStatus.textContent = '';
    } catch {
      if (!signal.aborted) transcriptStatus.textContent = '文稿加载失败，请刷新页面后重试。';
    }
  }

  play.addEventListener('click', async () => {
    if (!audio.paused && !audio.ended) {
      audio.pause();
      return;
    }

    const currentRequest = request;
    audioStatus.textContent = '';
    if (audio.error) audio.load();
    try {
      await audio.play();
    } catch (error) {
      if (request === currentRequest && error.name !== 'AbortError') {
        audioStatus.textContent = '音频播放失败，可再次选择播放。';
      }
    }
  });

  for (const button of languages) {
    button.addEventListener('click', () => setLanguage(button.dataset.m08Language));
  }
  rate.addEventListener('change', applyRate);
  seek.addEventListener('input', () => seekTo(Number(seek.value)));
  follow.addEventListener('change', revealActiveLine);

  audio.addEventListener('loadedmetadata', applyRate);
  for (const event of ['durationchange', 'loadedmetadata', 'emptied']) {
    audio.addEventListener(event, syncTiming);
  }
  for (const event of ['timeupdate', 'seeked', 'ended']) {
    audio.addEventListener(event, syncPosition);
  }
  for (const event of ['play', 'pause', 'ended', 'emptied']) {
    audio.addEventListener(event, syncPlayback);
  }
  audio.addEventListener('playing', () => {
    audioStatus.textContent = '';
    player.setAttribute('data-m08-playing', '');
  });
  audio.addEventListener('waiting', () => player.removeAttribute('data-m08-playing'));
  audio.addEventListener('error', () => {
    audioStatus.textContent = '音频加载失败，可选择播放重试。';
    syncTiming();
    syncPlayback();
    player.removeAttribute('data-m08-playing');
  });

  setLanguage('zh');
}, { once: true });
