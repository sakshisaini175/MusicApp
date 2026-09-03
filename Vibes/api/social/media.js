const axios = require('axios');

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
  if (!process.env.RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY missing in Vercel environment variables');
  const response = await axios.get('https://youtube-mp36.p.rapidapi.com/dl', {
    params: { id: videoId },
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
    }
  });
  if (!response.data?.link) throw new Error(response.data?.msg || 'YouTube audio extraction failed');
  return response.data;
}

module.exports = async (req, res) => {
  try {
    const sourceUrl = String(req.query.url || '').trim();
    if (!/^https?:\/\//i.test(sourceUrl)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid http or https media URL' });
    }

    const videoId = getYouTubeVideoId(sourceUrl);
    const mediaUrl = videoId ? (await extractYouTubeAudio(videoId)).link : sourceUrl;
    const mediaResponse = await axios.get(mediaUrl, {
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Vibes-Media-Proxy/1.0' }
    });

    res.setHeader('Content-Type', mediaResponse.headers['content-type'] || 'audio/mpeg');
    if (mediaResponse.headers['content-length']) res.setHeader('Content-Length', mediaResponse.headers['content-length']);
    mediaResponse.data.on('error', (error) => res.destroy(error));
    mediaResponse.data.pipe(res);
  } catch (error) {
    console.error('[Social media function error]:', error.response?.data || error.message);
    if (!res.headersSent) res.status(502).json({
      success: false,
      error: error.message || 'Unable to load external media'
    });
  }
};
