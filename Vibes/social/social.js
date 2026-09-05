(() => {
  const state = { buffer: null, sourceName: '', video: null, isVideo: false, urls: [] };
  const $ = (id) => document.getElementById(id);

  function setStatus(message) { $('social-status').textContent = message; }
  function isVideoSource(name, type = '') {
    return type.startsWith('video/') || /\.(mp4|3gp|mkv|webm)(?:$|\?)/i.test(name);
  }
  async function decodeMedia(arrayBuffer, sourceName, isVideo) {
    setStatus(`Decoding media from ${sourceName}...`);
    $('social-process').disabled = true;
    state.isVideo = isVideo;
    $('social-mp4-option').disabled = !isVideo;
    if (!isVideo && $('social-export-format').value === 'mp4') $('social-export-format').value = 'wav';
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      state.buffer = await audioContext.decodeAudioData(arrayBuffer);
      state.sourceName = sourceName;
      setStatus(`Ready to process ${sourceName}`);
      $('social-process').disabled = false;
    } catch (error) {
      state.buffer = null;
      setStatus('Unable to decode this media file.');
      console.error('[Social] Decode error:', error);
    }
  }

  function clearObjectUrls() {
    state.urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  }

  $('social-upload-box').addEventListener('click', () => $('social-file-input').click());
  $('social-file-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    $('social-upload-label').textContent = `Selected: ${file.name}`;
    state.video = isVideoSource(file.name, file.type) ? Object.assign(document.createElement('video'), {
      src: URL.createObjectURL(file), controls: true, playsInline: true
    }) : null;
    await decodeMedia(await file.arrayBuffer(), file.name, Boolean(state.video));
  });

  $('social-current-song').addEventListener('click', async () => {
    const audioElement = document.getElementById('audio-element');
    if (!audioElement?.src) {
      setStatus('Play a song first, then use the current player song.');
      return;
    }
    const title = document.getElementById('player-title')?.textContent || 'current-song';
    const button = $('social-current-song');
    button.disabled = true;
    try {
      setStatus('Loading the current player song...');
      const response = await fetch(audioElement.src);
      if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
      await decodeMedia(await response.arrayBuffer(), title, false);
      $('social-upload-label').textContent = `Current song: ${title}`;
    } catch (error) {
      setStatus('Unable to load the current song. Upload the file instead.');
      console.error('[Social] Current song error:', error);
    } finally {
      button.disabled = false;
    }
  });

  $('social-process').addEventListener('click', async () => {
    if (!state.buffer) return;
    setStatus('Compressing audio dynamics...');
    $('social-process').disabled = true;
    try {
      const context = new OfflineAudioContext(state.buffer.numberOfChannels, state.buffer.length, state.buffer.sampleRate);
      const source = context.createBufferSource();
      const rumbleFilter = context.createBiquadFilter();
      const bassBoost = context.createBiquadFilter();
      const bassPresence = context.createBiquadFilter();
      const compressor = context.createDynamicsCompressor();
      const gain = context.createGain();
      const limiter = context.createDynamicsCompressor();
      source.buffer = state.buffer;
      rumbleFilter.type = 'highpass';
      rumbleFilter.frequency.value = 28;
      bassBoost.type = 'lowshelf';
      bassBoost.frequency.value = 110;
      bassBoost.gain.value = 5;
      bassPresence.type = 'peaking';
      bassPresence.frequency.value = 75;
      bassPresence.Q.value = .8;
      bassPresence.gain.value = 2;
      compressor.threshold.value = -24;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = .005;
      compressor.release.value = .12;
      gain.gain.value = 1.35;
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = .001;
      limiter.release.value = .08;
      source.connect(rumbleFilter)
        .connect(bassBoost)
        .connect(bassPresence)
        .connect(compressor)
        .connect(gain)
        .connect(limiter)
        .connect(context.destination);
      source.start();
      const rendered = await context.startRendering();
      await renderResult(rendered);
      setStatus('Processing complete.');
    } catch (error) {
      setStatus('Processing failed for this media.');
      console.error('[Social] Processing error:', error);
    } finally {
      $('social-process').disabled = false;
    }
  });

  async function renderResult(buffer) {
    clearObjectUrls();
    const format = $('social-export-format').value;
    const wavBlob = audioBufferToWav(buffer);
    const exportBlob = format === 'wav' ? wavBlob : new Blob([wavBlob], { type: format === '3gp' ? 'audio/3gpp' : 'audio/mp3' });
    const exportName = `compressed_${state.sourceName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'audio'}.${format}`;
    const mediaContainer = $('social-media-container');
    const downloadGroup = $('social-download-group');
    mediaContainer.replaceChildren();
    downloadGroup.replaceChildren();
    if (format === 'mp4' && state.isVideo && state.video) {
      setStatus('Merging compressed audio with video...');
      const result = await createVideoWithAudio(buffer, state.video);
      const videoUrl = URL.createObjectURL(result.blob);
      state.urls.push(videoUrl);
      addDownload(result.blob, `compressed_video.${result.extension}`, `Download ${result.extension.toUpperCase()} video`);
      playInSharedPlayer(buffer, state.sourceName);
      $('social-preview').hidden = false;
      window.lucide?.createIcons();
      return;
    }
    const url = URL.createObjectURL(exportBlob);
    state.urls.push(url);
    playInSharedPlayer(url, state.sourceName);
    addDownload(exportBlob, exportName, `Download .${format.toUpperCase()}`);
    if (format !== 'wav') addDownload(wavBlob, 'compressed_audio.wav', 'Download .WAV');
    $('social-preview').hidden = false;
    window.lucide?.createIcons();
  }

  function playInSharedPlayer(source, sourceName) {
    const audioElement = document.getElementById('audio-element');
    if (!audioElement) return;
    const sourceUrl = typeof source === 'string' ? source : URL.createObjectURL(audioBufferToWav(source));
    if (typeof source !== 'string') state.urls.push(sourceUrl);
    audioElement.src = sourceUrl;
    audioElement.load();
    const title = document.getElementById('player-title');
    const artist = document.getElementById('player-artist');
    if (title) title.textContent = `Compressed: ${sourceName}`;
    if (artist) artist.textContent = 'Social Media Compressor';
    audioElement.play().catch(() => {});
  }

  async function createVideoWithAudio(buffer, originalVideo) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createBufferSource();
    const destination = audioContext.createMediaStreamDestination();
    source.buffer = buffer;
    source.connect(destination);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = originalVideo.videoWidth || 640;
    canvas.height = originalVideo.videoHeight || 360;
    const videoStream = canvas.captureStream(30);
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm;codecs=vp9,opus';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    await originalVideo.play();
    originalVideo.currentTime = 0;
    return new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(recorder.error || new Error('Video recording failed'));
      recorder.onstop = () => {
        originalVideo.pause();
        stream.getTracks().forEach((track) => track.stop());
        resolve({ blob: new Blob(chunks, { type: mimeType }), extension: mimeType === 'video/mp4' ? 'mp4' : 'webm' });
      };
      const drawFrame = () => {
        if (!originalVideo.paused && !originalVideo.ended) {
          context.drawImage(originalVideo, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawFrame);
        }
      };
      recorder.start();
      source.start();
      drawFrame();
      setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); source.stop(); }, (buffer.duration * 1000) + 200);
    });
  }

  function addDownload(blob, filename, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'social-download-button';
    button.textContent = label;
    button.addEventListener('click', () => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
    $('social-download-group').appendChild(button);
  }

  function audioBufferToWav(buffer) {
    const channels = buffer.numberOfChannels;
    const samples = channels === 2 ? interleave(buffer.getChannelData(0), buffer.getChannelData(1)) : buffer.getChannelData(0);
    const output = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(output);
    const write = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 0x8000 : 0x7fff), true));
    return new Blob([output], { type: 'audio/wav' });
  }

  function interleave(left, right) {
    const result = new Float32Array(left.length + right.length);
    for (let index = 0; index < left.length; index++) { result[index * 2] = left[index]; result[index * 2 + 1] = right[index]; }
    return result;
  }

  $('social-clear').addEventListener('click', () => {
    clearObjectUrls();
    $('social-preview').hidden = true;
    $('social-media-container').replaceChildren();
    $('social-download-group').replaceChildren();
    setStatus('');
  });
})();
