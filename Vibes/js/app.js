let currentCategoryId = "sad";
let currentOffset = 0;
let isSearchMode = false;
let currentSearchQuery = "";
let isLoading = false;
let hasMore = true;

const BATCH_LIMIT = 50; // Optimized to 50 for Archive.org API stability

let currentPlaylist = [];
let isShowingFavorites = false;
let currentSongIndex = -1;

// Global reference for currently playing song object
let currentlyPlayingSong = null; 

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
  const bottomAd = document.getElementById('ad-banner-bottom');
  if (bottomAd) {
    console.log('[Monetization] Refreshing display ad banner slot...');
        // Replace this block with your ad network's script tag or iframe reload function
  }
}

const categoryQueries = {
  sad: '("hindi sad" OR "punjabi sad" OR "bollywood sad" OR Arijit) AND mediatype:audio',
  lofi: '("hindi lofi" OR "punjabi lofi" OR "bollywood lofi" OR "desi lofi") AND mediatype:audio',
  party: '("dj hindi" OR "dj punjabi" OR "party song" OR "marriage song" OR "shaadi song") AND mediatype:audio',
  bhajan: '("bhajan" OR "gurbani" OR "kirtan" OR "aarti") AND mediatype:audio',
  qawwali: '("qawwali" OR "qawali" OR "sufi hindi" OR "nusrat fateh ali khan") AND mediatype:audio'
};


function renderCategoryCards() {
  const container = document.getElementById('category-cards');
  if (!container) return;
  container.innerHTML = '';

  const cats = [
    { id: 'sad', title: 'Sad', icon: 'droplet', color: 'from-blue-600/30 to-slate-900/60' },
    { id: 'lofi', title: 'Lofi', icon: 'moon', color: 'from-indigo-600/30 to-slate-900/60' },
    { id: 'party', title: 'Party', icon: 'disc', color: 'from-pink-600/30 to-slate-900/60' },
    { id: 'bhajan', title: 'Bhajan', icon: 'sun', color: 'from-amber-600/30 to-slate-900/60' },
    { id: 'qawwali', title: 'Qawwali', icon: 'music-2', color: 'from-emerald-600/30 to-slate-900/60' }
  ];
  

  cats.forEach(cat => {
    const isSelected = cat.id === currentCategoryId && !isSearchMode && !isShowingFavorites;
    const card = document.createElement('div');
    card.className = `p-3 sm:p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 bg-gradient-to-b ${cat.color} ${
      isSelected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10 scale-105' : 'border-white/5 hover:border-white/20 hover:scale-102'
    }`;
    card.innerHTML = `
      <div class="p-2.5 rounded-xl ${isSelected ? 'bg-cyan-400 text-black' : 'bg-white/10 text-white'} transition">
        <i data-lucide="${cat.icon}" class="w-5 h-5"></i>
      </div>
      <span class="font-semibold text-xs text-white tracking-wide">${cat.title}</span>
    `;
    card.addEventListener('click', () => {
      isSearchMode = false;
      isShowingFavorites = false;
      currentCategoryId = cat.id;
      const sectionTitle = document.getElementById('section-title');
      if (sectionTitle) sectionTitle.innerText = `${cat.title} Songs`;
      resetAndFetch();
    });
    container.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

function showSkeletons(count = 6) {
  const container = document.getElementById('song-list');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = "h-14 w-full rounded-xl bg-white/5 animate-pulse border border-white/5";
    container.appendChild(skeleton);
  }
  const badge = document.getElementById('song-count-badge');
  if (badge) badge.innerText = `Loading...`;
}

async function resetAndFetch() {
  currentOffset = 0;
  hasMore = true;
  currentPlaylist = [];
  renderCategoryCards();

  const songList = document.getElementById('song-list');
  const songListContainer = document.getElementById('song-list-container');

  if (songList) songList.innerHTML = '';
  if (songListContainer) songListContainer.scrollTop = 0;

  showSkeletons();
  await fetchNextBatch();
}

async function fetchNextBatch() {
  if (isLoading || !hasMore || isShowingFavorites) return;
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
          title: item.title || `Track ${currentPlaylist.length + idx + 1}`,
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

function updatePlayerFavIcon(songId) {
  const playerFavBtn = document.getElementById('player-fav-btn');
  if (!playerFavBtn) return;
  const favs = JSON.parse(localStorage.getItem('vibes_favorites')) || [];
  const isFav = favs.some(f => f.id === songId);
  playerFavBtn.innerHTML = `<i data-lucide="heart" class="w-4 h-4 ${isFav ? 'text-pink-500 fill-current' : ''}"></i>`;
  if (window.lucide) lucide.createIcons();
}

function toggleFavoriteSong(song, buttonElement = null) {
  let favs = JSON.parse(localStorage.getItem('vibes_favorites')) || [];
  const exists = favs.find(f => f.id === song.id);
  const songCountBadge = document.getElementById('song-count-badge');
  const container = document.getElementById('song-list');

  if (exists) {
    favs = favs.filter(f => f.id !== song.id);
    localStorage.setItem('vibes_favorites', JSON.stringify(favs));
    
    if (isShowingFavorites) {
      currentPlaylist = currentPlaylist.filter(f => f.id !== song.id);
      if (buttonElement) {
        const parentRow = buttonElement.closest('.group');
        if (parentRow) parentRow.remove();
      }
      if (currentPlaylist.length === 0 && container) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic p-4 text-center">No favorites added yet. Tap ❤ on any song to save it here.</p>`;
      }
      if (songCountBadge) songCountBadge.innerText = `${currentPlaylist.length} Songs Loaded`;
    } else if (buttonElement) {
      buttonElement.innerHTML = '<i data-lucide="heart" class="w-4 h-4"></i>';
    }
  } else {
    favs.push(song);
    localStorage.setItem('vibes_favorites', JSON.stringify(favs));
    if (buttonElement) {
      buttonElement.innerHTML = '<i data-lucide="heart" class="w-4 h-4 text-pink-500 fill-current"></i>';
    }
  }

  if (currentlyPlayingSong?.id === song.id) {
    updatePlayerFavIcon(song.id);
  }
  if (window.lucide) lucide.createIcons();
}

function appendSongsToList(songs) {
  const container = document.getElementById('song-list');
  const songCountBadge = document.getElementById('song-count-badge');
  if (!container) return;

  const firstChild = container.firstChild;
  if (firstChild && firstChild.classList && firstChild.classList.contains('animate-pulse')) {
    container.innerHTML = '';
  }

  songs.forEach((song) => {
    currentPlaylist.push(song);
    let favorites = JSON.parse(localStorage.getItem('vibes_favorites')) || [];
    let isFav = favorites.some(f => f.id === song.id);

    // FIX: Verify by ID instead of array index
    const isCurrentPlaying = currentlyPlayingSong && currentlyPlayingSong.id === song.id;

    const item = document.createElement('div');
    item.setAttribute('data-id', song.id);
    item.className = `p-3 rounded-xl border flex justify-between items-center transition cursor-pointer group ${
      isCurrentPlaying 
        ? 'border-cyan-500/40 bg-cyan-500/10' 
        : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/10'
    }`;

    item.innerHTML = `
      <div class="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
        <div class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-cyan-400 group-hover:text-black transition">
          <i data-lucide="music" class="w-4 h-4"></i>
        </div>
        <div class="overflow-hidden flex-1">
          <h5 class="font-semibold text-xs sm:text-sm truncate text-white group-hover:text-cyan-300 transition">${song.title}</h5>
          <p class="text-[11px] text-slate-400 truncate">${song.artist}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 shrink-0 ml-2">
        ${isCurrentPlaying ? '<span class="now-playing-badge text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">NOW PLAYING</span>' : ''}
        <button class="fav-btn p-1.5 text-slate-400 hover:text-pink-400 transition">
          <i data-lucide="heart" class="w-4 h-4 ${isFav ? 'text-pink-500 fill-current' : ''}"></i>
        </button>
      </div>
    `;

    item.addEventListener('click', () => {
      playSong(song);
    });

    const favBtn = item.querySelector('.fav-btn');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavoriteSong(song, favBtn);
    });

    container.appendChild(item);
  });

  if (songCountBadge) {
    songCountBadge.innerText = `${currentPlaylist.length} Songs Loaded`;
  }
  if (window.lucide) lucide.createIcons();
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

function updateActiveSongUI() {
  const container = document.getElementById('song-list');
  if (!container) return;

  const items = container.querySelectorAll('#song-list > div');
  items.forEach((item) => {
    const songId = item.getAttribute('data-id');
    // FIX: Match by unique song ID
    const isCurrent = currentlyPlayingSong && songId === currentlyPlayingSong.id;

    item.className = `p-3 rounded-xl border flex justify-between items-center transition cursor-pointer group ${
      isCurrent 
        ? 'border-cyan-500/40 bg-cyan-500/10' 
        : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/10'
    }`;

    const badgeContainer = item.querySelector('.shrink-0.ml-2');
    if (badgeContainer) {
      const existingBadge = badgeContainer.querySelector('.now-playing-badge');
      if (existingBadge) existingBadge.remove();

      if (isCurrent) {
        const badge = document.createElement('span');
        badge.className = 'now-playing-badge text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30';
        badge.innerText = 'NOW PLAYING';
        badgeContainer.insertBefore(badge, badgeContainer.firstChild);
      }
    }
  });
}

async function executePlaySong(song) {
  currentlyPlayingSong = song; // FIX: Update global playing track reference
  currentSongIndex = currentPlaylist.findIndex(s => s.id === song.id);

  const titleEl = document.getElementById('player-title');
  const artistEl = document.getElementById('player-artist');

  updatePlayerFavIcon(song.id);
  updateActiveSongUI(); 

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
  const equalizer = document.getElementById('player-equalizer');

  if (titleEl) titleEl.innerText = song.title;
  if (artistEl) artistEl.innerText = song.artist;

  if (audioElement) {
    audioElement.src = url;
    audioElement.play().catch(err => console.error("Audio error:", err));
  }

  if (equalizer) equalizer.style.display = 'flex';
}

function showFavorites() {
  isShowingFavorites = true;
  isSearchMode = false;
  renderCategoryCards();

  const raw = localStorage.getItem('vibes_favorites');
  const favorites = raw ? JSON.parse(raw) : [];
  const container = document.getElementById('song-list');
  const songCountBadge = document.getElementById('song-count-badge');
  const sectionTitle = document.getElementById('section-title');

  if (sectionTitle) sectionTitle.innerText = "Your Favorites";
  if (!container) return;
  container.innerHTML = '';
  currentPlaylist = [];

  if (favorites.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic p-4 text-center">No favorites added yet. Tap ❤ on any song to save it here.</p>`;
    if (songCountBadge) songCountBadge.innerText = `0 Songs Loaded`;
    return;
  }

  appendSongsToList(favorites);
  hasMore = false;
}

function simulateLiveListeners() {
  let currentListeners = 412;
  const userCountEl = document.getElementById('live-listeners-count');
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
  const searchInput = document.getElementById('search-input');
  const favoritesBtn = document.getElementById('favorites-btn');
  const navFavorites = document.getElementById('nav-favorites');
  const navHome = document.getElementById('nav-home');
  const shuffleBtn = document.getElementById('shuffle-btn');
  const repeatBtn = document.getElementById('repeat-btn');
  const equalizer = document.getElementById('player-equalizer');
  const playerFavBtn = document.getElementById('player-fav-btn');

  if (equalizer) equalizer.style.display = 'none';

  setInterval(refreshDisplayAds, BANNER_REFRESH_INTERVAL);

  if (playerFavBtn) {
    playerFavBtn.addEventListener('click', () => {
      if (!currentlyPlayingSong) return;

      const listButtons = document.querySelectorAll('#song-list .fav-btn');
      let matchingListBtn = null;
      if (listButtons) {
        matchingListBtn = Array.from(listButtons).find(btn => {
          const row = btn.closest('.group');
          return row && row.getAttribute('data-id') === currentlyPlayingSong.id;
        });
      }

      toggleFavoriteSong(currentlyPlayingSong, matchingListBtn);
    });
  }

  // Infinite Scroll Listener
  if (songListContainer) {
    songListContainer.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = songListContainer;
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        fetchNextBatch();
      }
    });
  }

  // Transport Controls
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

  // Shuffle & Repeat Controls
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      isShuffle = !isShuffle;
      shuffleBtn.classList.toggle('text-cyan-400', isShuffle);
      shuffleBtn.classList.toggle('text-slate-400', !isShuffle);
    });
  }

  if (repeatBtn) {
    repeatBtn.addEventListener('click', () => {
      isRepeat = !isRepeat;
      repeatBtn.classList.toggle('text-cyan-400', isRepeat);
      repeatBtn.classList.toggle('text-slate-400', !isRepeat);
    });
  }

  // Track End Action
  if (audioElement) {
    audioElement.addEventListener('ended', () => {
      if (isAdPlaying) return;

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

      if (nextTrack) playSong(nextTrack);
      else if (equalizer) equalizer.style.display = 'none';
    });

    audioElement.addEventListener('play', () => {
      if (equalizer) equalizer.style.display = 'flex';
    });

    audioElement.addEventListener('pause', () => {
      if (equalizer) equalizer.style.display = 'none';
    });
  }

  // Search Input Trigger + Auto-Reset on clearing input
  if (searchInput) {
    const triggerSearchReset = () => {
      const query = searchInput.value.trim();
      const sectionTitle = document.getElementById('section-title');

      if (!query) {
        if (isSearchMode) {
          isSearchMode = false;
          currentSearchQuery = "";
          if (sectionTitle) sectionTitle.innerText = `${currentCategoryId.charAt(0).toUpperCase() + currentCategoryId.slice(1)} Songs`;
          resetAndFetch();
        }
        return;
      }

      isSearchMode = true;
      isShowingFavorites = false;
      currentSearchQuery = query;
      if (sectionTitle) sectionTitle.innerText = `Search Results for "${query}"`;
      resetAndFetch();
    };

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        triggerSearchReset();
      }
    });

    searchInput.addEventListener('input', () => {
      if (searchInput.value.trim() === '' && isSearchMode) {
        isSearchMode = false;
        currentSearchQuery = "";
        const sectionTitle = document.getElementById('section-title');
        if (sectionTitle) sectionTitle.innerText = `${currentCategoryId.charAt(0).toUpperCase() + currentCategoryId.slice(1)} Songs`;
        resetAndFetch();
      }
    });
  }

  // Navigation Click Handlers
  if (favoritesBtn) favoritesBtn.addEventListener('click', showFavorites);
  if (navFavorites) navFavorites.addEventListener('click', showFavorites);
  if (navHome) {
    navHome.addEventListener('click', () => {
      isSearchMode = false;
      isShowingFavorites = false;
      if (searchInput) searchInput.value = '';
      const sectionTitle = document.getElementById('section-title');
      if (sectionTitle) sectionTitle.innerText = `${currentCategoryId.charAt(0).toUpperCase() + currentCategoryId.slice(1)} Songs`;
      resetAndFetch();
    });
  }

  renderCategoryCards();
  resetAndFetch();
  simulateLiveListeners();
});