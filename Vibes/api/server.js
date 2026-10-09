const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static assets from project root when running locally
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '..')));
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const SONGS_CACHE_TTL_SECONDS = Math.min(
  Math.max(Number.parseInt(process.env.SONGS_CACHE_TTL_SECONDS, 10) || 3600, 60),
  86400
);
const SONGS_STALE_CACHE_TTL_SECONDS = 2 * 60 * 60;
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '');
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const songsCache = new Map();
const songSearchRequests = new Map();
const audioExtractionRequests = new Map();

function songsCacheKey(searchQuery, pageToken) {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify([searchQuery, pageToken || '']))
    .digest('hex');
  return `vibes:songs:v1:${hash}`;
}

function rememberSongs(key, value) {
  songsCache.delete(key);
  songsCache.set(key, value);
  if (songsCache.size > 100) songsCache.delete(songsCache.keys().next().value);
}

async function readSongsCache(key) {
  let entry = songsCache.get(key);
  if (entry && entry.staleUntil <= Date.now()) {
    songsCache.delete(key);
    entry = null;
  }
  if (entry) return { data: entry.data, isFresh: entry.freshUntil > Date.now() };

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null;

  try {
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) throw new Error(`Cache read failed with status ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    if (typeof result.result !== 'string') return null;
    entry = JSON.parse(result.result);
    if (!entry.data || !Number.isFinite(entry.freshUntil) || !Number.isFinite(entry.staleUntil)) return null;
    if (entry.staleUntil <= Date.now()) return null;
    rememberSongs(key, entry);
    return { data: entry.data, isFresh: entry.freshUntil > Date.now() };
  } catch (error) {
    console.warn('[Songs Cache] Read failed:', error.message);
    return null;
  }
}

async function writeSongsCache(key, value) {
  const now = Date.now();
  const entry = {
    data: value,
    freshUntil: now + SONGS_CACHE_TTL_SECONDS * 1000,
    staleUntil: now + (SONGS_CACHE_TTL_SECONDS + SONGS_STALE_CACHE_TTL_SECONDS) * 1000
  };
  rememberSongs(key, entry);
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;

  try {
    const response = await fetch(UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(1500),
      body: JSON.stringify([
        'SET',
        key,
        JSON.stringify(entry),
        'EX',
        SONGS_CACHE_TTL_SECONDS + SONGS_STALE_CACHE_TTL_SECONDS
      ])
    });
    if (!response.ok) throw new Error(`Cache write failed with status ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error);
  } catch (error) {
    console.warn('[Songs Cache] Write failed:', error.message);
  }
}

async function refreshSongsWithSharedLock(key, refresh) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return refresh();

  const lockKey = `${key}:lock`;
  const token = crypto.randomUUID();
  let ownsLock = false;

  try {
    const response = await fetch(UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(1500),
      body: JSON.stringify(['SET', lockKey, token, 'NX', 'EX', 15])
    });
    if (!response.ok) throw new Error(`Cache lock failed with status ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    ownsLock = result.result === 'OK';
  } catch (error) {
    console.warn('[Songs Cache] Lock unavailable:', error.message);
    return refresh();
  }

  if (!ownsLock) {
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const cached = await readSongsCache(key);
      if (cached?.isFresh) return cached.data;
    }
    return refresh();
  }

  try {
    const cached = await readSongsCache(key);
    if (cached?.isFresh) return cached.data;
    return await refresh();
  } finally {
    try {
      const response = await fetch(UPSTASH_REDIS_REST_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(1500),
        body: JSON.stringify([
          'EVAL',
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          lockKey,
          token
        ])
      });
      if (!response.ok) throw new Error(`Cache lock release failed with status ${response.status}`);
    } catch (error) {
      console.warn('[Songs Cache] Lock release failed:', error.message);
    }
  }
}

function coalesceRequest(requests, key, request) {
  if (requests.has(key)) return requests.get(key);
  const pending = request().finally(() => requests.delete(key));
  requests.set(key, pending);
  return pending;
}

function getYouTubeVideoId(value) {
  try {
    const url = new URL(value);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null;
    if (/(^|\.)youtube\.com$/.test(url.hostname)) {
      return url.searchParams.get('v') || url.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] || null;
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function extractYouTubeAudio(videoId) {
  if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY missing');
  return coalesceRequest(audioExtractionRequests, videoId, async () => {
    const response = await axios.get('https://youtube-mp36.p.rapidapi.com/dl', {
      params: { id: videoId },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
      }
    });
    if (!response.data?.link) {
      throw new Error(response.data?.msg || 'YouTube audio extraction failed');
    }
    return response.data;
  });
}

// 1. GET SONGS IN BATCHES
app.get('/api/songs', async (req, res) => {
  const { query, category, pageToken } = req.query;
  const searchQuery = query || `${category || 'bollywood'} songs`;
  const normalizedQuery = String(searchQuery).trim().replace(/\s+/g, ' ').toLowerCase();
  const key = songsCacheKey(normalizedQuery, pageToken);
  let staleCache;

  try {
    const cached = await readSongsCache(key);
    if (cached?.isFresh) return res.json(cached.data);
    staleCache = cached?.data;

    const result = await coalesceRequest(songSearchRequests, key, () =>
      refreshSongsWithSharedLock(key, async () => {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            maxResults: 50,
            q: searchQuery,
            type: 'video',
            videoCategoryId: '10',
            pageToken: pageToken || '',
            key: YOUTUBE_API_KEY
          }
        });

        const songs = response.data.items.map(item => ({
          id: item.id.videoId,
          title: item.snippet.title,
          artist: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url
        }));

        const data = {
          success: true,
          nextPageToken: response.data.nextPageToken || null,
          totalResults: response.data.pageInfo.totalResults,
          count: songs.length,
          songs
        };
        await writeSongsCache(key, data);
        return data;
      })
    );

    res.json(result);

  } catch (error) {
    console.error('YouTube API Error:', error.response?.data || error.message);
    const quotaExceeded = error.response?.data?.error?.errors?.some(
      item => item.reason === 'quotaExceeded' || item.reason === 'dailyLimitExceeded'
    );
    if (staleCache) {
      console.warn('[Songs Cache] Serving stale results after upstream search failure.');
      return res.json(staleCache);
    }
    res.status(quotaExceeded ? 429 : 500).json({
      success: false,
      error: quotaExceeded ? 'YouTube search quota exceeded. Please try again later.' : 'Failed to fetch songs'
    });
  }
});

// GET MP3 STREAM & DOWNLOAD URL using youtube-mp36 endpoint
app.get('/api/song/download', async (req, res) => {
  try {
    const { videoId } = req.query;
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'videoId is required' });
    }

    if (!RAPIDAPI_KEY) {
      return res.status(500).json({ success: false, error: 'RAPIDAPI_KEY missing' });
    }

    console.log(`[Download Request] Processing videoId: ${videoId}`);

    const data = await extractYouTubeAudio(videoId);
    
    if (data && (data.status === 'ok' || data.link)) {
      const audioUrl = data.link;
      if (req.query.stream === '1') {
        const audioResponse = await axios.get(audioUrl, {
          responseType: 'stream',
          timeout: 30000,
          maxRedirects: 5
        });
        res.set('Content-Type', audioResponse.headers['content-type'] || 'audio/mpeg');
        if (audioResponse.headers['content-length']) res.set('Content-Length', audioResponse.headers['content-length']);
        audioResponse.data.on('error', (streamError) => res.destroy(streamError));
        return audioResponse.data.pipe(res);
      }
      return res.json({
        success: true,
        videoId: videoId,
        streamUrl: audioUrl,
        downloadUrl: audioUrl,
        title: data.title || ''
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: data?.msg || data?.message || 'Failed to extract stream',
      details: data
    });

  } catch (error) {
    console.error('[RapidAPI Error Detail]:', error.response?.data || error.message);
    res.status(error.response?.status === 429 ? 429 : 502).json({
      success: false, 
      error: error.response?.data?.msg || error.response?.data?.message || error.message || 'Failed to extract MP3 stream',
      details: error.response?.data || error.message
    });
  }
});

// Convert YouTube URLs to MP3 and return the audio from this app's origin.
app.get('/api/social/media', async (req, res) => {
  try {
    const sourceUrl = String(req.query.url || '').trim();
    const videoId = getYouTubeVideoId(sourceUrl);
    let mediaUrl = sourceUrl;
    if (!/^https?:\/\//i.test(sourceUrl)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid media URL' });
    }
    if (videoId) mediaUrl = (await extractYouTubeAudio(videoId)).link;

    const audioResponse = await axios.get(mediaUrl, {
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5
    });

    res.set('Content-Type', audioResponse.headers['content-type'] || 'audio/mpeg');
    if (audioResponse.headers['content-length']) res.set('Content-Length', audioResponse.headers['content-length']);
    audioResponse.data.on('error', (error) => res.destroy(error));
    audioResponse.data.pipe(res);
  } catch (error) {
    console.error('[Social YouTube Error]:', error.response?.data || error.message);
    if (!res.headersSent) res.status(502).json({
      success: false,
      error: error.message || 'Unable to convert this YouTube URL to MP3',
      providerError: error.response?.data?.msg || error.response?.data?.message || undefined
    });
  }
});

// Run server locally
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

// CRITICAL FOR VERCEL: Export express app module
module.exports = app;