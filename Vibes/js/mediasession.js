// ---------------------------------------------------------------------------
// Media Session integration for Vibes
//
// WHY: On Android Chrome, a web app only gets a *reliable* background playback
// session (one that survives screen-off) when the page registers itself with
// the OS media session via the Media Session API. Without it, Chrome treats
// playback as an anonymous page audio and the session can be dropped when the
// screen turns off (Doze / battery optimization), which was causing Vibes to
// stop in the background on Android while iOS Safari kept playing.
//
// This file registers metadata + hardware/notification/lockscreen controls and
// adds stream-stall auto-recovery. It must load AFTER js/app.js because it
// reads the global `currentlyPlayingSong` for artwork.
// ---------------------------------------------------------------------------
(function () {
  const audio = document.getElementById('audio-element');
  if (!audio) return;
  if (!('mediaSession' in navigator)) {
    console.warn('[MediaSession] Not supported in this browser.');
    return;
  }

  function getArtwork() {
    const song = window.currentlyPlayingSong;
    if (song && song.thumbnail) {
      return [{ src: song.thumbnail, sizes: '512x512', type: 'image/jpeg' }];
    }
    return [];
  }

  function updateMetadata() {
    const titleEl = document.getElementById('player-title');
    const artistEl = document.getElementById('player-artist');
    const title = (titleEl && titleEl.textContent.trim()) || 'Vibes';
    const artist = (artistEl && artistEl.textContent.trim()) || 'Vibes Music Player';

    // Skip transient UI states like "Loading stream..."
    if (/loading/i.test(title)) return;

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: title,
      artist: artist,
      album: 'Vibes',
      artwork: getArtwork()
    });
  }

  function safeSetAction(action, handler) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (err) {
      // Action not supported by this browser — safe to ignore.
    }
  }

  // Lock screen / notification / headset / Bluetooth controls
  safeSetAction('play', () => audio.play().catch(() => {}));
  safeSetAction('pause', () => audio.pause());
  safeSetAction('stop', () => {
    audio.pause();
    try { audio.currentTime = 0; } catch (err) { /* ignore */ }
  });
  safeSetAction('seekbackward', (details) => {
    const off = (details && details.seekOffset) || 10;
    audio.currentTime = Math.max(0, audio.currentTime - off);
  });
  safeSetAction('seekforward', (details) => {
    const off = (details && details.seekOffset) || 10;
    const max = Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + off;
    audio.currentTime = Math.min(max, audio.currentTime + off);
  });
  safeSetAction('seekto', (details) => {
    if (details && details.seekTime != null) audio.currentTime = details.seekTime;
  });
  // Reuse the in-app prev/next logic so shuffle/repeat rules still apply.
  safeSetAction('previoustrack', () => {
    const btn = document.getElementById('prev-btn');
    if (btn) btn.click();
  });
  safeSetAction('nexttrack', () => {
    const btn = document.getElementById('next-btn');
    if (btn) btn.click();
  });

  // Keep the OS media session in sync with real playback state.
  audio.addEventListener('play', () => {
    updateMetadata();
    navigator.mediaSession.playbackState = 'playing';
  });
  audio.addEventListener('pause', () => {
    navigator.mediaSession.playbackState = 'paused';
  });
  audio.addEventListener('ended', () => {
    navigator.mediaSession.playbackState = 'paused';
  });

  // --- Stream stall / failure auto-recovery ---------------------------------
  // Cross-origin converted streams can stall when the device suspends the
  // network after screen-off. Recover once by reloading from the last position.
  let recovering = false;
  let recoverAttempts = 0;

  audio.addEventListener('stalled', () => {
    if (recovering || audio.paused) return;
    recovering = true;
    console.warn('[MediaSession] Stream stalled, attempting recovery in 3s...');
    setTimeout(() => {
      const pos = audio.currentTime;
      const wasPlaying = !audio.paused;
      audio.load();
      const onReady = () => {
        try { audio.currentTime = pos; } catch (err) { /* ignore */ }
        if (wasPlaying) audio.play().catch(() => {});
        recoverAttempts++;
        recovering = false;
      };
      audio.addEventListener('loadedmetadata', onReady, { once: true });
    }, 3000);
  });

  audio.addEventListener('error', () => {
    console.error('[MediaSession] Audio element error for src:', audio.src);
  });

  console.log('[MediaSession] Registered. Background playback controls active.');
})();