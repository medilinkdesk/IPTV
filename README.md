# SURAJ IPTV Player 📺

A modern, glassmorphic IPTV & HLS Web Stream Player supporting free-to-air channels from all countries worldwide, complete with an integrated CORS proxy.

## 🌟 Features

- **🌍 Browse by Country**: Integrated free live TV channels for 18+ countries (India 🇮🇳, USA 🇺🇸, UK 🇬🇧, Canada 🇨🇦, Australia 🇦🇺, Pakistan 🇵🇰, Bangladesh 🇧🇩, UAE 🇦🇪, Germany 🇩🇪, France 🇫🇷, etc.) plus Global playlists powered by `iptv-org`.
- **🛡️ Integrated CORS Stream Proxy**: Built-in Python proxy server (`server.py`) that transparently bypasses browser CORS restrictions and mixed-content issues for live M3U8 streams.
- **⭐ Guaranteed Verified Live Channels**: Curated top Indian and International live news, music, and sports streams (Aaj Tak HD, India Today HD, 9XM, 9X Jalwa, DW News, France 24, Bloomberg TV, ABC News, Red Bull TV, NASA TV).
- **🎨 Glassmorphic Dark UI**: Futuristic neon aesthetic with custom video player controls, theater mode, picture-in-picture, volume sliders, and full keyboard shortcuts.
- **📁 Custom M3U Import & Direct Link**: Drag-and-drop any `.m3u` / `.m3u8` playlist file or paste direct stream URLs.
- **⭐ Favorites Management**: Pin channels to your favorites list (saved locally in your browser).

## 🚀 How to Run

### Method 1: 1-Click Launch (Recommended)
Simply double-click **`run.bat`** in this folder. It will start the server and automatically open the player in your default web browser at:
```url
http://127.0.0.1:8080/
```

### Method 2: Manual Terminal
```bash
python server.py
```
Then navigate to `http://127.0.0.1:8080/` in Chrome, Edge, or Firefox.
