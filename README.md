# 🎶 Vibes - Free Indian Music Player

Vibes is a simple web-based music player that streams **Hindi & Punjabi songs** from Archive.org and other free sources.  
It’s designed with an Indian audience in mind, featuring categories like **Sad Songs, Lofi Beats, Chill Songs, Bhajan, and Qawwali**.

---

## 🚀 Features
- **Category browsing**: Sad Songs, Lofi Beats, Chill Songs, Bhajan, Qawwali  
- **Search** with instant results and infinite scroll to load more tracks  
- **Favorites** saved locally in the browser (tap the heart)  
- **Playback controls**: Play, Pause, Previous, Next  
- **Shuffle and Repeat** controls for playlist behavior  
- **Animated equalizer** and footer glow while music plays  
- **Animated gradient background and card hover effects** for a lively UI  
- **Animated loading skeletons** while tracks load for a polished experience  
- **Responsive layout** with compact footer controls on small screens  
- **Fallback tracks** when network or API results are unavailable

---

## 📂 Project Structure

```text
├── index.html         # Main HTML layout and structural components
├── css/
│   └── styles.css     # Custom scrollbar styles and additional styling
└── js/
    ├── playlist.js    # Category metadata and local fallback songs
    └── app.js         # Core application logic (API fetching, playback, UI updates)
```


---

## 🛠️ Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/vibes-player.git
   cd vibes-player

2. Open index.html in your browser.
No build step is required — it’s pure HTML, CSS, and JS.

---

# 🎧 Sources
Archive.org – Free audio tracks

ccMixter – Creative Commons remixes

YouTube Audio Library (youtube.com in Bing) – Royalty-free tracks

Jamendo – Free music for projects

Free Music Archive – Open licensed tracks

---

# 🎨 Visuals and Customization
Neon gradient background and card hover glow are defined in styles.css. Adjust the color stops to change the mood.

Now Playing glow is toggled by the player when a track starts; the class playing is applied to the title and footer.

Equalizer is a small animated element next to the player; it is shown only while audio is playing.

Loading skeletons are used while the app fetches tracks. The function showSkeletons() in app.js controls count and appearance.

Shuffle and Repeat:

Toggle Shuffle to play random tracks from the current playlist.

Toggle Repeat to loop the current track.

Buttons are in the footer and visually indicate active state.

---

# 🤝 Contributing and Credits
Contributions welcome. Open an issue or submit a pull request for bug fixes, UI improvements, or new features.

Credits Built with ❤️ for Indian music lovers by Sakshi Saini. Uses Archive.org, Jamendo, ccMixter, and Free Music Archive for free audio sources.

---

# 📜 License
This project is open-source under the MIT License.
Feel free to use, modify, and share.

---

👉 This version now includes your screenshot under a **Screenshots section** so visitors immediately see how the app looks.  

<img width="1912" height="1046" alt="image" src="https://github.com/sakshisaini175/MusicApp/blob/main/Vibes/image.png" />

