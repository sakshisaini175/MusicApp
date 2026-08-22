// Categories mapped to Jamendo search tags
const categories = [
    {
        id: "sad",
        title: "Sad & Melancholic",
        description: "Emotive piano, strings, and acoustic melodies",
        icon: "cloud-rain",
        color: "from-blue-900/40 to-slate-900/60",
        tag: "sad"
    },
    {
        id: "lofi",
        title: "Lofi Chill Beats",
        description: "Relaxing study and lounge background beats",
        icon: "coffee",
        color: "from-purple-900/40 to-slate-900/60",
        tag: "lofi"
    },
    {
        id: "chill",
        title: "Chill Hits",
        description: "Smooth ambient and acoustic grooves",
        icon: "sun",
        color: "from-teal-900/40 to-slate-900/60",
        tag: "chillout"
    },
    {
        id: "bhajan",
        title: "Devotional & Spiritual",
        description: "Meditation, sitar, and peaceful ambient sounds",
        icon: "sparkles",
        color: "from-amber-900/40 to-slate-900/60",
        tag: "meditation"
    }
];

// Fallback track list in case of network issues
const fallbackSongs = {
    sad: [
        { id: "f1", title: "Melancholic Piano", artist: "Open Archive", streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
        { id: "cc1", title: "Sad Remix", artist: "ccMixter Artist", streamUrl: "https://ccmixter.org/content/artistname/sad-remix.mp3" }
    ],
    lofi: [
        { id: "f2", title: "Midnight Lofi", artist: "Chill Beats", streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
        { id: "yt1", title: "LoFi Study Beat", artist: "YouTube Audio Library", streamUrl: "https://www.youtube.com/audiolibrary_download?vid=abcd1234" }
    ],
    chill: [
        { id: "f3", title: "Acoustic Horizon", artist: "Lounge Studio", streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
        { id: "cc2", title: "Chill Groove", artist: "ccMixter Artist", streamUrl: "https://ccmixter.org/content/artistname/chill-groove.mp3" },
        { id: "yt2", title: "Summer Chill", artist: "YouTube Audio Library", streamUrl: "https://www.youtube.com/audiolibrary_download?vid=wxyz5678" },
        { id: "jam1", title: "Smooth Vibes", artist: "Jamendo Artist", streamUrl: "https://mp3.jamendo.com/download/track/123456/mp32" },
        { id: "fma1", title: "Evening Chill", artist: "FMA Artist", streamUrl: "https://freemusicarchive.org/track/evening-chill/download" }
    ],
    bhajan: [
        { id: "f4", title: "Spiritual Meditation Flute", artist: "Bhakti Audio", streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
        { id: "cc3", title: "Devotional Ambient", artist: "ccMixter Artist", streamUrl: "https://ccmixter.org/content/artistname/devotional-ambient.mp3" }
    ]
};

