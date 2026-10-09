# 🎶 Vibes Music App

Vibes is a mobile-first music streaming web app built for mood-based listening, with categories like Sad, Lofi, Party, Bhajan, and Qawwali. The app uses a lightweight backend to fetch song metadata from YouTube and convert video IDs into MP3 streaming URLs through RapidAPI, while the frontend handles playback, infinite scrolling, favorites, and a social media audio compressor.

---

## Architecture Overview

This project is structured as a hybrid app:

- Frontend: a static HTML/CSS/JS app served from the `Vibes/` directory
- Backend: an Express API in `Vibes/api/server.js` for song search and media conversion
- Social tool: a browser-side media processor in `Vibes/social/` for bass boosting, dynamic compression, and export-ready audio/video files
- Deployment: Vercel-ready Express project with static assets served from the root app folder

The main flow is:

1. Browser loads the UI from `Vibes/index.html`
2. `Vibes/js/app.js` requests `/api/songs` for search and category browsing
3. `Vibes/api/server.js` calls the YouTube Data API for metadata
4. The client requests `/api/song/download?videoId=...` for the playable MP3 stream
5. User favorites and playback state are stored in `localStorage`
6. The `social` section processes uploads locally in-browser using the Web Audio API

---

## Project Structure

```text
MusicApp/
├── README.md
└── Vibes/
    ├── index.html                # Main app shell and music player UI
    ├── package.json              # Scripts and dependencies
    ├── vercel.json               # Vercel deployment config
    ├── api/
    │   └── server.js             # Express API and static asset serving
    ├── css/
    │   └── styles.css            # App theme, layout, and custom styling
    ├── js/
    │   ├── app.js                # Core music app logic: songs, playback, search, favorites, ads
    │   └── playlist.js           # Category metadata and fallback songs
    ├── social/
    │   ├── index.html            # Social media compressor UI
    │   ├── social.css            # Social compressor styling
    │   └── social.js             # File decoding, bass boost, compression, preview, export logic
    └── .env                      # Local secrets; do not commit
```

---

## Core Features

- Mood-based music categories and dynamic list rendering
- Search with debounced keyword input and infinite-scroll loading
- Home, Favorites, and Social navigation tabs with section switching
- Favorites saved in browser storage and managed from both the list and the player
- Play/pause, previous/next, repeat, shuffle, and seek controls
- Floating mini-player with track info, equalizer animation, and quick actions
- Download-track action and playback speed controls from the player menu
- Live listeners badge and dynamic status updates during playback
- Audio and banner ad placeholders for monetization
- Social media compressor for local audio/video processing
- Use current player song as input for the social tool
- Export options for WAV, MP3, 3GP, and video output where supported
- Responsive layout for desktop and mobile devices
- Right-click and shortcut blocking for a more app-like and protected browsing experience

---

## Tech Stack

- Frontend: HTML, CSS, JavaScript, Tailwind CSS, Lucide icons
- Backend: Node.js + Express
- API integrations:
  - YouTube Data API v3 for metadata and search results
  - RapidAPI `youtube-mp36` for YouTube-to-MP3 conversion
- Storage: browser `localStorage` for favorites
- Search cache: Upstash Redis REST API when configured; process-local cache as a fallback
- Hosting: Vercel-ready Node server

---

## Environment Variables

Create a `.env` file in the `Vibes/` directory before running the app:

```env
YOUTUBE_API_KEY=your_youtube_data_api_key
RAPIDAPI_KEY=your_rapidapi_key
NODE_ENV=development
PORT=3000

# Optional shared song-search cache (recommended for Vercel)
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
# Optional; defaults to 3600 seconds (1 hour)
SONGS_CACHE_TTL_SECONDS=3600
```

Notes:

- `YOUTUBE_API_KEY` is required for song search metadata
- `RAPIDAPI_KEY` is required for `/api/song/download`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` enable shared song-search caching across Vercel instances. Keep the token secret and never expose it in frontend code or commit it.
- Upstash is optional. If it is not configured or temporarily unavailable, the app continues by calling YouTube directly; caching then only exists in the current server process.
- Search results are fresh for one hour by default and retained for up to two additional hours as stale fallback. Redis expires entries after three hours total. `SONGS_CACHE_TTL_SECONDS` changes the fresh period; stale retention remains two hours.
- Search requests for the same query and page are coalesced while in flight. With Upstash configured, a short-lived shared lock also helps avoid duplicate refreshes across serverless instances. Concurrent audio conversions for the same video are coalesced within an instance; conversion results are not persistently cached.
- `NODE_ENV` should be set to `production` in deployed environments

---

## Song Search Cache

The `/api/songs` route caches YouTube search results by normalized query and page token. When Redis is configured, the cache is shared by Vercel instances, reducing repeated YouTube API calls for popular searches.

Cache behavior:

- A result is fresh for one hour by default and is returned without another YouTube search request.
- After the fresh period, the backend refreshes the result. If YouTube is unavailable or its quota is exhausted, a cached result can be served stale for up to two more hours.
- Redis expires each entry automatically after three hours total. Cache hits do not extend the expiry.
- Redis read, write, or lock failures do not prevent the app from falling back to its normal YouTube request path. If YouTube also fails and no stale result exists, the route returns an error and the frontend can show its bundled fallback tracks.
- A cache miss or refresh still calls YouTube and uses its quota. Caching does not remove RapidAPI quota limits for new audio conversions.

### Create and configure Upstash Redis

1. Create a Redis database in the [Upstash Console](https://console.upstash.com/). Choose a region close to the Vercel Function Region (the Vercel project may show `iad1` by default). Read regions are not needed for this app.
2. Select a plan appropriate for your usage. The Upstash Free plan has usage limits; see [current Redis pricing](https://upstash.com/pricing/redis).
3. Copy the database REST URL and REST token from its details page. Keep the token private.
4. For local development, add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `Vibes/.env`.
5. In Vercel project settings, add both variables under **Environment Variables** for Production (and Preview if needed). Add `YOUTUBE_API_KEY` and `RAPIDAPI_KEY` there too if they are not already configured.
6. Redeploy after adding or changing environment variables.

If the Upstash free allowance is exhausted or Redis is unavailable, the app continues without shared caching; uncached searches may then consume YouTube quota as usual.

---

## Local Development

From the project root:

```bash
cd Vibes
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

For production mode:

```bash
npm start
```

### Development Notes

- Static frontend files are served by Express only when `NODE_ENV !== 'production'`
- The API expects both the YouTube Data API and RapidAPI credentials to be configured
- If the app is opened directly from the filesystem instead of a local server, API calls may fail
- The app disables right-click and common inspection shortcuts to keep the player experience closer to a native app

---

## Troubleshooting

### Search or music list is empty
- Check that `YOUTUBE_API_KEY` is set in your `.env` file
- Confirm that the YouTube API key has quota remaining
- Verify that you are running the app from the `Vibes/` folder or via `npm run dev`

### Playback fails or MP3 download does not load
- Ensure `RAPIDAPI_KEY` is valid and active for the `youtube-mp36` endpoint
- Check the RapidAPI account limits, quota, and IP restrictions
- Review the server console for backend errors from the `/api/song/download` route

### Social compressor does not work
- Use a supported audio/video file type such as MP3, WAV, MP4, or 3GP
- Browser permissions for file input must be enabled
- Some browsers may behave differently with video export, especially for format conversion

### Vercel deployment issues
- Make sure the project is deployed from the `Vibes` folder or the app root is configured correctly
- Confirm the environment variables are defined in the Vercel project settings
- Check that the rewrite in `vercel.json` points to the correct Express server script

---

## API Endpoints

### GET `/api/songs`
Returns a paginated list of songs for a category or search query.

Query parameters:

- `query` - optional search term
- `category` - optional category such as `sad`, `lofi`, `party`, `bhajan`, or `qawwali`
- `pageToken` - optional pagination token

Example response:

```json
{
  "success": true,
  "nextPageToken": "token_string",
  "totalResults": 100000,
  "count": 50,
  "songs": [
    {
      "id": "videoId",
      "title": "Song Title",
      "artist": "Channel Name",
      "thumbnail": "https://..."
    }
  ]
}
```

### GET `/api/song/download`
Returns a direct MP3 stream URL for a YouTube video ID.

Query parameters:

- `videoId` - required YouTube video ID
- `stream=1` - optional flag to stream the file directly from the backend

Example response:

```json
{
  "success": true,
  "videoId": "videoId",
  "streamUrl": "https://...",
  "downloadUrl": "https://...",
  "title": "Song Title"
}
```

### GET `/api/social/media`
Used by the social flow to convert a YouTube media URL to a downloadable or streamable MP3 object.

---

## Social Media Compressor

The Social tab provides a local browser-based processing workflow:

- upload audio or video files
- choose export format: WAV, MP3, 3GP, or MP4 video where supported
- use the current song from the player as input
- apply bass boost and dynamic compression via the Web Audio API
- preview processed audio/video and download the output

This is intentionally client-side, so media processing happens locally in the browser without sending the file to the server.

---

## Deployment

The app is built to be deployed on Vercel using the root `Vibes` application as the project working directory.

Typical deployment flow:

```bash
cd Vibes
vercel deploy
```

Important deployment notes:

- `vercel.json` rewrites `/api/*` requests to `/api/server.js`
- The backend exports the Express app for serverless compatibility
- Environment variables must be configured in Vercel Dashboard before deployment
- The app is designed as a lightweight MVP and depends on external services for music discovery and stream generation

---

## Customization Points

- Category definitions live in `Vibes/js/app.js` via `renderCategoryCards()` and category arrays
- Audio ad sources are configured in `audioAdPool` in `Vibes/js/app.js`
- Theme, layout, and styling are defined in `Vibes/css/styles.css`
- Social compressor behavior is handled in `Vibes/social/social.js`

---

## License

This project is distributed under the ISC license as declared in `Vibes/package.json`.

---

## Notes

This project currently combines a static frontend with a backend API and a browser-based media toolkit. It is designed for a lightweight MVP and is especially suitable for rapid local deployment and front-end experimentation without a heavy framework.

### Known Limitations

- The app uses external services for search and MP3 conversion, so performance depends on API availability and quota
- Audio ads and display ad slots are placeholders and intended for later monetization integration
- The social compressor is browser-based and may vary by browser support for media export and codec handling

---

Built with ❤️ for music lovers.
