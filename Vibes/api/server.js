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
      error: 'Failed to extract stream', 
      details: data 
    });

  } catch (error) {
    console.error('[RapidAPI Error Detail]:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to extract MP3 stream', 
      details: error.response?.data || error.message 
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