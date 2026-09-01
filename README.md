# 🎶 Vibes - Free Music Player

Vibes is a web-based music player that streams songs from YouTube using the YouTube API and converts them to MP3 via RapidAPI.  
It's designed with an Indian audience in mind, featuring categories like **Sad, Lofi, Party, Bhajan, and Qawwali**.

---

## 🚀 Features
- **Category browsing**: Sad, Lofi, Party, Bhajan, Qawwali  
- **Search** with instant results and infinite scroll to load more tracks  
- **Favorites** saved locally in the browser (tap the heart)  
- **Playback controls**: Play, Pause, Previous, Next  
- **Shuffle and Repeat** controls for playlist behavior  
- **Animated equalizer** and footer glow while music plays  
- **Animated gradient background and card hover effects** for a lively UI  
- **Animated loading skeletons** while tracks load for a polished experience  
- **Responsive layout** with compact footer controls on small screens  
- **Monetization**: Programmatic audio ads and display banner ads  
- **Vercel Analytics**: Integrated Vercel Web Analytics for tracking user engagement
- **Developer-friendly**: Right-click and inspect shortcuts disabled for security

---

## 📂 Project Structure

```text
Vibes/
├── index.html         # Main HTML layout with Tailwind CSS and Lucide icons
├── package.json       # Node.js dependencies and scripts
├── vercel.json        # Vercel deployment configuration
├── css/
│   └── styles.css     # Custom scrollbar styles and additional styling
├── js/
│   ├── app.js         # Core app logic (API fetching, playback, UI updates, ads)
│   └── playlist.js    # Category metadata and fallback songs
└── api/
    └── server.js      # Express backend (YouTube API search, MP3 conversion via RapidAPI)
```


---

## 🛠️ Setup

### Prerequisites
- Node.js (v14+)
- YouTube API Key
- RapidAPI Key (for youtube-mp36 endpoint)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/vibes-player.git
   cd vibes-player/Vibes

2. Install dependencies:
   ```bash
   npm install

3. Create a `.env` file in the `Vibes/` directory with your API keys:
   ```
   YOUTUBE_API_KEY=your_youtube_api_key
   RAPIDAPI_KEY=your_rapidapi_key
   NODE_ENV=development
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   Or for production:
   ```bash
   npm start
   ```

5. Open `http://localhost:3000` in your browser (or your configured port).

---

## 🎧 API Endpoints

### GET `/api/songs`
Fetch songs from YouTube by category or search query.
- **Query Parameters**:
  - `query` (optional): Search term for songs
  - `category` (optional): Category name (sad, lofi, party, bhajan, qawwali)
  - `pageToken` (optional): Pagination token for loading more results
- **Response**:
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
Convert YouTube video to MP3 stream URL.
- **Query Parameters**:
  - `videoId` (required): YouTube video ID
- **Response**:
  ```json
  {
    "success": true,
    "videoId": "videoId",
    "streamUrl": "https://...",
    "downloadUrl": "https://...",
    "title": "Song Title"
  }
  ```

---

## 📡 External Services
- **YouTube API** – Song search and metadata retrieval
- **RapidAPI** – youtube-mp36 endpoint for YouTube to MP3 conversion
- **Vercel Analytics** – User engagement and analytics tracking

---

## 🚀 Deployment

### Deploy to Vercel
```bash
vercel deploy
```

The app uses `vercel.json` for Vercel-specific configuration including environment variables and build settings.

---

## 🎨 Customization

### Styling
- Gradient background and card hover effects are defined in `css/styles.css`
- Uses **Tailwind CSS** for responsive utility classes
- Icons provided by **Lucide** icons library

### Audio Ads
Configure audio ad URLs in `js/app.js` under `audioAdPool`. Current ads play after every 5 songs (`AD_FREQUENCY`).

### Display Ads
Banner ads are refreshed every 60 seconds. Customize the refresh interval by modifying `BANNER_REFRESH_INTERVAL` in `js/app.js`.

### Categories
Add or modify categories by updating the category array in the `renderCategoryCards()` function in `js/app.js`.

---

## 📊 Analytics
Vercel Web Analytics is integrated via the `/_vercel/insights/script.js` endpoint. View analytics in your Vercel project dashboard.

---

## 🤝 Contributing
Contributions are welcome! Open an issue or submit a pull request for bug fixes, UI improvements, or new features.

---

## 📜 License
This project is open-source under the MIT License.  
Feel free to use, modify, and share.

---

Built with ❤️ for music lovers by Sakshi Saini.
