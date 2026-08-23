let currentCategoryId = "sad";
let currentOffset = 0;
let isSearchMode = false;
let currentSearchQuery = "";
let isLoading = false;
let hasMore = true;

const BATCH_LIMIT = 50; // Optimized to 50 for Archive.org API stability

let currentPlaylist = [];
let isShowingFavorites = false;
let currentSongIndex = 0;

// Playback flags
let isShuffle = false;
let isRepeat = false;

// --- Programmatic Audio Ads Implementation ---
let songPlayCounter = 0;
let isAdPlaying = false;
const AD_FREQUENCY = 5; // Plays an ad after every 5 songs

// Audio ad URL pool (Replace with real programmatic ad tags like Adswizz/Targetspot)
const audioAdPool = [
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3"
];

// --- Display Banner Ad Refresh Logic ---
const BANNER_REFRESH_INTERVAL = 60000; // Refresh display ads every 60 seconds

function refreshDisplayAds() {
  const topAd = document.getElementById('ad-banner-top');
  if (topAd) {
    console.log('[Monetization] Refreshing display ad banner slot...');
    // Replace this block with your ad network's script tag or iframe reload function
  }
}

const categoryQueries = {
  sad: '("hindi sad" OR "punjabi sad" OR "bollywood sad" OR Arijit) AND mediatype:audio',
  lofi: '("hindi lofi" OR "punjabi lofi" OR "bollywood lofi" OR "desi lofi") AND mediatype:audio',
  party: '("dj hindi" OR "dj punjabi" OR "party song" OR "marriage song" OR "shaadi song" OR "wedding song" OR "dance hits") AND mediatype:audio',
  bhajan: '("bhajan" OR "gurbani" OR "kirtan" OR "aarti") AND mediatype:audio',
  qawwali: '("qawwali" OR "qawali" OR "sufi hindi" OR "nusrat fateh ali khan" OR "rahat fateh ali khan" OR "sabri brothers") AND mediatype:audio'
};


function renderCategoryCards() {
  const container = document.getElementById('category-cards');
  if (!container) return;
  container.innerHTML = '';

  const cats = [
    { id: 'sad', title: 'Sad Songs', color: 'from-blue-900/40 to-slate-900/60' },
    { id: 'lofi', title: 'Lofi Beats', color: 'from-purple-900/40 to-slate-900/60' },
    { id: 'party', title: 'Chill Songs', color: 'from-teal-900/40 to-slate-900/60' },
    { id: 'bhajan', title: 'Bhajan', color: 'from-amber-900/40 to-slate-900/60' },
    { id: 'qawwali', title: 'Qawwali', color: 'from-emerald-900/40 to-slate-900/60' }
  ];


  cats.forEach(cat => {
    const isSelected = cat.id === currentCategoryId && !isSearchMode;
    const card = document.createElement('div');
    card.className = `p-3 rounded-xl border cursor-pointer bg-gradient-to-br ${cat.color || 'from-slate-800 to-slate-900'} ${
      isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/20' : 'border-white/10 hover:border-white/30'
    }`;
    card.innerHTML = `<h4 class="font-bold text-xs">${cat.title}</h4>`;
    card.addEventListener('click', () => {
      isSearchMode = false;
      currentCategoryId = cat.id;
      resetAndFetch();
    });
    container.appendChild(card);
  });
}

function showSkeletons(count = 6) {
  const container = document.getElementById('song-list');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = "skeleton h-12 w-full mb-2 rounded-xl";
    container.appendChild(skeleton);
  }
  const badge = document.getElementById('song-count-badge');
  if (badge) badge.innerText = `Loading...`;
}

async function resetAndFetch() {
  currentOffset = 0;
  hasMore = true;
  currentPlaylist = [];
  isShowingFavorites = false;
  renderCategoryCards();

  const songList = document.getElementById('song-list');
  const songListContainer = document.getElementById('song-list-container');

  if (songList) songList.innerHTML = '';
  if (songListContainer) songListContainer.scrollTop = 0;

  showSkeletons();
  await fetchNextBatch();
}

async function fetchNextBatch() {
  if (isLoading || !hasMore) return;
  isLoading = true;

// Updated search query builder in fetchNextBatch():
  let searchQuery = isSearchMode
    ? `(${currentSearchQuery}) AND mediatype:audio`
    : categoryQueries[currentCategoryId] || '("hindi songs") AND mediatype:audio';

  const page = Math.floor(currentOffset / BATCH_LIMIT) + 1;
  const apiUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchQuery)}+AND+mediatype%3Aaudio&fl[]=identifier,title,creator&sort[]=downloads+desc&rows=${BATCH_LIMIT}&page=${page}&output=json`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    const docs = data.response?.docs || [];

    if (docs.length > 0) {
      const existingIds = new Set(currentPlaylist.map(s => s.id));
      const filteredTracks = docs
        .filter(item => item.identifier && !existingIds.has(item.identifier))
        .map((item, idx) => ({
          id: item.identifier,
          title: item.title || `Song Track ${currentPlaylist.length + idx + 1}`,
          artist: item.creator || "Hindi / Punjabi Artist"
        }));

      if (filteredTracks.length > 0) {
        appendSongsToList(filteredTracks);
      }

      currentOffset += docs.length;

      if (docs.length < BATCH_LIMIT) {
        hasMore = false;
      }
    } else {
      hasMore = false;
      if (currentOffset === 0 && window.fallbackSongs) {
        appendSongsToList(window.fallbackSongs[currentCategoryId] || []);
      }
    }
  } catch (err) {
    console.warn("Fetch error:", err);
    if (currentOffset === 0 && window.fallbackSongs) {
      appendSongsToList(window.fallbackSongs[currentCategoryId] || []);
      hasMore = false;
    }
  } finally {
    isLoading = false;
  }
}

function appendSongsToList(songs) {
  const container = document.getElementById('song-list');
  const songCountBadge = document.getElementById('song-count-badge');
  if (!container) return;

  // If skeletons were present, remove them before appending
  const firstChildIsSkeleton = container.firstChild && container.firstChild.classList && container.firstChild.classList.contains('skeleton');
  if (firstChildIsSkeleton) container.innerHTML = '';

  songs.forEach((song) => {
    currentPlaylist.push(song);
    let favorites = JSON.parse(localStorage.getItem('vibes_favorites')) || [];
    let isFav = favorites.some(f => f.id === song.id);

    const item = document.createElement('div');
    item.className = "p-3 rounded-xl border border-slate-800 bg-slate-800/40 flex justify-between items-center hover:bg-slate-800 cursor-pointer transition";
    item.innerHTML = `
      <div class="flex items-center gap-3 overflow-hidden">
        <span class="text-xs font-bold text-cyan-400 w-8 shrink-0">${currentPlaylist.length}</span>
        <div class="overflow-hidden">
          <h5 class="font-bold text-sm truncate text-white">${song.title}</h5>
          <p class="text-xs text-slate-400 truncate">${song.artist}</p>
        </div>
      </div>
      <div class="flex gap-2 shrink-0">
        <button class="play-btn bg-cyan-500 hover:bg-cyan-400 px-3 py-1 rounded-lg text-xs font-bold text-slate-950">▶ Play</button>
        <button class="fav-btn px-3 py-1 rounded-lg text-xs font-bold">${isFav ? "❤️" : "🤍"}</button>
      </div>
    `;

    item.querySelector('.play-btn').addEventListener('click', e => {
      e.stopPropagation();
      playSong(song);
    });

    const favBtn = item.querySelector('.fav-btn');
    favBtn.addEventListener('click', e => {
      e.stopPropagation();
      let favs = JSON.parse(localStorage.getItem('vibes_favorites')) || [];
      const exists = favs.find(f => f.id === song.id);

      if (exists) {
        favs = favs.filter(f => f.id !== song.id);
        favBtn.innerText = "🤍";
        localStorage.setItem('vibes_favorites', JSON.stringify(favs));
        if (isShowingFavorites) {
          item.remove();
          if (songCountBadge) songCountBadge.innerText = `${container.children.length} Songs Loaded`;
        }
      } else {
        favs.push(song);
        favBtn.innerText = "❤️";
        localStorage.setItem('vibes_favorites', JSON.stringify(favs));
      }
    });

    container.appendChild(item);
  });

  if (songCountBadge) {
    songCountBadge.innerText = `${currentPlaylist.length} Songs Loaded`;
  }
}

// --- Audio Ad Interceptor & Handler ---
function checkAndPlayAd(nextSongToPlay) {
  songPlayCounter++;

  if (songPlayCounter >= AD_FREQUENCY) {
    songPlayCounter = 0;
    isAdPlaying = true;

    const audioElement = document.getElementById('audio-element');
    const titleEl = document.getElementById('player-title');
    const artistEl = document.getElementById('player-artist');

    const randomAdUrl = audioAdPool[Math.floor(Math.random() * audioAdPool.length)];

    if (titleEl) titleEl.innerText = "📢 Sponsored Audio Announcement";
    if (artistEl) artistEl.innerText = "Music will resume in a few seconds...";

    if (audioElement) {
      audioElement.src = randomAdUrl;
      audioElement.play().catch(err => console.error("Ad playback error, skipping to track:", err));

      const handleAdEnded = () => {
        audioElement.removeEventListener('ended', handleAdEnded);
        isAdPlaying = false;
        if (nextSongToPlay) {
          executePlaySong(nextSongToPlay);
        }
      };

      audioElement.addEventListener('ended', handleAdEnded);
    }
    return true; // Ad was played
  }

  return false; // Proceed to regular song
}

async function playSong(song) {
  if (isAdPlaying) return;

  const adTriggered = checkAndPlayAd(song);
  if (!adTriggered) {
    executePlaySong(song);
  }
}

async function executePlaySong(song) {
  currentSongIndex = currentPlaylist.findIndex(s => s.id === song.id);
  const titleEl = document.getElementById('player-title');
  const artistEl = document.getElementById('player-artist');

  if (titleEl) titleEl.innerText = "Loading stream...";
  if (artistEl) artistEl.innerText = song.title;

  try {
    const metaRes = await fetch(`https://archive.org/metadata/${song.id}`);
    const metaData = await metaRes.json();
    const mp3File = metaData.files ? metaData.files.find(f => f.name && f.name.endsWith('.mp3')) : null;

    if (mp3File) {
      const realStreamUrl = `https://archive.org/download/${song.id}/${encodeURIComponent(mp3File.name)}`;
      setPlayerAndPlay(realStreamUrl, song);
      return;
    }
  } catch (err) {
    console.warn("Metadata fetch error:", err);
  }

  if (song.streamUrl) {
    setPlayerAndPlay(song.streamUrl, song);
    return;
  }

  if (titleEl) titleEl.innerText = "📢 Audio Advertisement (Sponsor Stream)";
  if (artistEl) artistEl.innerText = "Vibes Free Music Sponsor";
}

function setPlayerAndPlay(url, song) {
  const titleEl = document.getElementById('player-title');
  const artistEl = document.getElementById('player-artist');
  const audioElement = document.getElementById('audio-element');
  const footer = document.querySelector('footer');

  if (titleEl) titleEl.innerText = song.title;
  if (artistEl) artistEl.innerText = song.artist;

  if (audioElement) {
    audioElement.src = url;
    audioElement.play().catch(err => {
      console.error("Audio error:", err);
      if (titleEl) titleEl.innerText = "📢 Audio Advertisement (Sponsor Stream)";
    });
  }

  // highlight playing title
  if (titleEl) titleEl.classList.add('playing');
  if (footer) footer.classList.add('playing');

  // show equalizer
  const equalizer = document.querySelector('.equalizer');
  if (equalizer) equalizer.style.display = 'flex';
}

function showFavorites() {
  const raw = localStorage.getItem('vibes_favorites');
  const favorites = raw ? JSON.parse(raw) : [];
  const container = document.getElementById('song-list');
  const songCountBadge = document.getElementById('song-count-badge');

  if (!container) return;
  container.innerHTML = '';
  currentPlaylist = [];

  if (favorites.length === 0) {
    container.innerHTML = `<p class="text-sm text-slate-400 italic p-4">No favorites yet. Tap ❤ to add songs.</p>`;
    if (songCountBadge) songCountBadge.innerText = `0 Songs Loaded`;
    return;
  }

  appendSongsToList(favorites);
  hasMore = false;
}

function simulateLiveListeners() {
  let currentListeners = 412;
  const userCountEl = document.getElementById('user-count');
  if (!userCountEl) return;

  setInterval(() => {
    const variation = Math.floor(Math.random() * 7) - 3;
    currentListeners = Math.max(100, currentListeners + variation);
    userCountEl.innerText = currentListeners;
  }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  const songListContainer = document.getElementById('song-list-container');
  const audioElement = document.getElementById('audio-element');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const searchBtn = document.getElementById('search-btn');
  const searchInput = document.getElementById('search-input');
  const favoritesBtn = document.getElementById('favorites-btn');
  const shuffleBtn = document.getElementById('shuffle-btn');
  const repeatBtn = document.getElementById('repeat-btn');
  const footer = document.querySelector('footer');
  const equalizer = document.querySelector('.equalizer');

  // Hide equalizer by default
  if (equalizer) equalizer.style.display = 'none';

  // Start display ad refresh interval
  setInterval(refreshDisplayAds, BANNER_REFRESH_INTERVAL);
  
  // Scroll listener for infinite load
  const handleScroll = () => {
    if (!songListContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = songListContainer;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      fetchNextBatch();
    }
  };
  if (songListContainer) songListContainer.addEventListener('scroll', handleScroll);

  // Window fallback
  window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
      fetchNextBatch();
    }
  });

  // Prev / Next behavior (respect shuffle)
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (isShuffle && currentPlaylist.length > 1) {
        let idx;
        do { idx = Math.floor(Math.random() * currentPlaylist.length); } while (idx === currentSongIndex);
        playSong(currentPlaylist[idx]);
      } else if (currentSongIndex > 0) {
        playSong(currentPlaylist[currentSongIndex - 1]);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (isShuffle && currentPlaylist.length > 1) {
        let idx;
        do { idx = Math.floor(Math.random() * currentPlaylist.length); } while (idx === currentSongIndex);
        playSong(currentPlaylist[idx]);
      } else if (currentSongIndex < currentPlaylist.length - 1) {
        playSong(currentPlaylist[currentSongIndex + 1]);
      }
    });
  }

  // Shuffle toggle
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      isShuffle = !isShuffle;
      shuffleBtn.classList.toggle('bg-cyan-600', isShuffle);
      shuffleBtn.classList.toggle('text-black', isShuffle);
    });
  }

  // Repeat toggle (repeat current track)
  if (repeatBtn) {
    repeatBtn.addEventListener('click', () => {
      isRepeat = !isRepeat;
      repeatBtn.classList.toggle('bg-cyan-600', isRepeat);
      repeatBtn.classList.toggle('text-black', isRepeat);
    });
  }

  // Audio ended behavior (shuffle/repeat)
  if (audioElement) {
    audioElement.addEventListener('ended', () => {
      if (isAdPlaying) return;

      const titleEl = document.getElementById('player-title');
      if (titleEl) titleEl.classList.remove('playing');

      if (isRepeat) {
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});
        return;
      }

      let nextTrack = null;

      if (isShuffle && currentPlaylist.length > 1) {
        let idx;
        do { idx = Math.floor(Math.random() * currentPlaylist.length); } while (idx === currentSongIndex);
        nextTrack = currentPlaylist[idx];
      } else if (currentSongIndex < currentPlaylist.length - 1) {
        nextTrack = currentPlaylist[currentSongIndex + 1];
      }

      if (nextTrack) {
        playSong(nextTrack);
      } else {
        // end of list
        if (footer) footer.classList.remove('playing');
        if (equalizer) equalizer.style.display = 'none';
      }
    });

    audioElement.addEventListener('play', () => {
      if (footer) footer.classList.add('playing');
      if (equalizer) equalizer.style.display = 'flex';
    });

    audioElement.addEventListener('pause', () => {
      if (footer) footer.classList.remove('playing');
      if (equalizer) equalizer.style.display = 'none';
    });
  }

  // Search
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (!query) {
        isSearchMode = false;
        currentSearchQuery = "";
        resetAndFetch();
        return;
      }
      isSearchMode = true;
      currentSearchQuery = query;
      resetAndFetch();
    });

    searchInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') searchBtn.click();
    });

    searchInput.addEventListener('input', () => {
      if (!searchInput.value.trim()) {
        isSearchMode = false;
        currentSearchQuery = "";
        resetAndFetch();
      }
    });
  }

  if (favoritesBtn) {
    favoritesBtn.addEventListener('click', () => {
      isShowingFavorites = true;
      showFavorites();
    });
  }

  renderCategoryCards();
  resetAndFetch();
  simulateLiveListeners();
});

window.Vibes = {
  playSong,
  showFavorites,
  getFavorites: () => JSON.parse(localStorage.getItem('vibes_favorites') || '[]')
};