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

// GET MP3 STREAM & DOWNLOAD URL using RapidAPI Downloader
app.get('/api/song/download', async (req, res) => {
  try {
    const { videoId } = req.query;
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'videoId is required' });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[Download Request] Processing videoId: ${videoId}`);

    // Step 1: Initiate download request
    const initResponse = await axios.get('https://youtube-mp3-downloader4.p.rapidapi.com/download.php', {
      params: {
        format: 'mp3',
        url: videoUrl
      },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'youtube-mp3-downloader4.p.rapidapi.com'
      }
    });

    const initData = initResponse.data;
    console.log('[API Init Response]:', initData.title || initData.id);

    // If direct URL is ready immediately
    if (initData.url || initData.download_url) {
      const directUrl = initData.url || initData.download_url;
      return res.json({
        success: true,
        videoId: videoId,
        streamUrl: directUrl,
        downloadUrl: directUrl,
        title: initData.title || ''
      });
    }

    // Step 2: Poll progress_url if provided
    if (initData.progress_url) {
      let attempts = 0;
      const maxAttempts = 25;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // wait 1 sec

        const progressResponse = await axios.get(initData.progress_url);
        const progressData = progressResponse.data;

        // 1. Check plain fields first
        let finalUrl = progressData.download_url || progressData.url || progressData.link;

        // 2. If url is not in top-level JSON, extract from base64 HTML content
        if (!finalUrl && progressData.content) {
          try {
            const decodedHtml = Buffer.from(progressData.content, 'base64').toString('utf-8');
            const hrefMatch = decodedHtml.match(/href=["'](https?:[^"']+)["']/i);
            if (hrefMatch && hrefMatch[1]) {
              finalUrl = hrefMatch[1];
            }
          } catch (e) {
            console.error('Error decoding content:', e);
          }
        }

        if (finalUrl) {
          console.log(`[Success] Extracted URL on attempt ${attempts + 1}:`, finalUrl);
          return res.json({
            success: true,
            videoId: videoId,
            streamUrl: finalUrl,
            downloadUrl: finalUrl,
            title: initData.title || (progressData.info && progressData.info.title) || ''
          });
        }

        attempts++;
      }

      return res.status(504).json({ success: false, error: 'Conversion timed out. Please try again.' });
    }

    return res.status(500).json({ success: false, error: 'No stream available' });

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