const express = require('express');
const axios = require('axios');
const cors = require('cors');
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
}

// 1. GET SONGS IN BATCHES
app.get('/api/songs', async (req, res) => {
  try {
    const { query, category, pageToken } = req.query;
    let searchQuery = query || `${category || 'bollywood'} songs`;

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

    res.json({
      success: true,
      nextPageToken: response.data.nextPageToken || null,
      totalResults: response.data.pageInfo.totalResults,
      count: songs.length,
      songs: songs
    });

  } catch (error) {
    console.error('YouTube API Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch songs' });
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

    const response = await axios.get('https://youtube-mp36.p.rapidapi.com/dl', {
      params: { id: videoId },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
      }
    });

    const data = response.data;
    
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
    res.status(502).json({ 
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