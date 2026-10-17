// ==========================================
// NEO IPTV - WEB APPLICATION LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let channels = [];
    let filteredChannels = [];
    let currentCategory = 'All';
    let searchQuery = '';
    let activeChannelIndex = -1;
    let favorites = new Set(JSON.parse(localStorage.getItem('neo_iptv_favorites') || '[]'));
    let hls = null;
    let networkRetryCount = 0;
    let playTimeout = null;
    let diagnosticsLog = [];

    // --- DOM ELEMENTS ---
    const video = document.getElementById('video-element');
    const videoContainer = document.getElementById('video-container');
    const playlistNameElement = document.getElementById('playlist-name');
    const channelCountElement = document.getElementById('channel-count');
    const channelsContainer = document.getElementById('channels-container');
    const categoriesContainer = document.getElementById('categories-container');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const channelsLoader = document.getElementById('channels-loader');
    const noChannelsMsg = document.getElementById('no-channels-msg');
    
    // Player Details UI
    const activeChannelLogo = document.getElementById('active-channel-logo');
    const activeChannelName = document.getElementById('active-channel-name');
    const activeChannelCategory = document.getElementById('active-channel-category');
    const activeStreamUrl = document.getElementById('active-stream-url');
    const copyUrlBtn = document.getElementById('copy-url-btn');
    const favoriteToggleBtn = document.getElementById('favorite-toggle-btn');
    const favStarOutline = favoriteToggleBtn.querySelector('.star-outline');
    const favStarFilled = favoriteToggleBtn.querySelector('.star-filled');
    
    // Player Controls UI
    const playOverlay = document.getElementById('play-overlay');
    const videoSpinner = document.getElementById('video-spinner');
    const videoError = document.getElementById('video-error');
    const errorMessage = document.getElementById('error-message');
    const retryStreamBtn = document.getElementById('retry-stream-btn');
    const diagnoseBtn = document.getElementById('diagnose-btn');
    
    const controlPlay = document.getElementById('control-play');
    const playSvg = controlPlay.querySelector('.play-svg');
    const pauseSvg = controlPlay.querySelector('.pause-svg');
    const controlPrev = document.getElementById('control-prev');
    const controlNext = document.getElementById('control-next');
    const controlMute = document.getElementById('control-mute');
    const volumeUpSvg = controlMute.querySelector('.volume-up-svg');
    const volumeMuteSvg = controlMute.querySelector('.volume-mute-svg');
    const volumeSlider = document.getElementById('volume-slider');
    
    const progressContainer = document.getElementById('progress-container');
    const progressCurrent = document.getElementById('progress-current');
    const timeCurrent = document.getElementById('time-current');
    const timeDuration = document.getElementById('time-duration');
    
    const controlRefresh = document.getElementById('control-refresh');
    const controlTheater = document.getElementById('control-theater');
    const controlPip = document.getElementById('control-pip');
    const controlFullscreen = document.getElementById('control-fullscreen');
    const fullscreenSvg = controlFullscreen.querySelector('.fullscreen-svg');
    const exitFullscreenSvg = controlFullscreen.querySelector('.exit-fullscreen-svg');

    // Modals
    const importPlaylistBtn = document.getElementById('import-playlist-btn');
    const importModal = document.getElementById('import-modal');
    const modalClose = document.getElementById('modal-close');
    const modalOverlay = document.getElementById('modal-overlay');
    const dragDropZone = document.getElementById('drag-drop-zone');
    const fileInput = document.getElementById('file-input');
    const playlistUrlInput = document.getElementById('playlist-url');
    const loadUrlBtn = document.getElementById('load-url-btn');
    const loadDefaultBtn = document.getElementById('load-default-btn');
    
    const diagnosticsModal = document.getElementById('diagnostics-modal');
    const diagModalClose = document.getElementById('diag-modal-close');
    const diagModalOverlay = document.getElementById('diag-modal-overlay');
    const diagnosticsLogElement = document.getElementById('diagnostics-log');

    // Proxy & Country UI
    let isProxyEnabled = localStorage.getItem('neo_iptv_proxy') !== 'false';
    const countrySelect = document.getElementById('country-select');
    const proxyToggleBtn = document.getElementById('proxy-toggle-btn');
    const proxyStatusText = document.getElementById('proxy-status-text');
    const toggleProxyRetryBtn = document.getElementById('toggle-proxy-retry-btn');
    const countryQuickBtns = document.querySelectorAll('.country-quick-btn');

    // Popular Country Playlists powered by iptv-org
    const COUNTRY_PLAYLISTS = {
        'in': { name: 'India 🇮🇳', url: 'https://iptv-org.github.io/iptv/countries/in.m3u' },
        'us': { name: 'USA 🇺🇸', url: 'https://iptv-org.github.io/iptv/countries/us.m3u' },
        'uk': { name: 'UK 🇬🇧', url: 'https://iptv-org.github.io/iptv/countries/uk.m3u' },
        'ca': { name: 'Canada 🇨🇦', url: 'https://iptv-org.github.io/iptv/countries/ca.m3u' },
        'au': { name: 'Australia 🇦🇺', url: 'https://iptv-org.github.io/iptv/countries/au.m3u' },
        'pk': { name: 'Pakistan 🇵🇰', url: 'https://iptv-org.github.io/iptv/countries/pk.m3u' },
        'bd': { name: 'Bangladesh 🇧🇩', url: 'https://iptv-org.github.io/iptv/countries/bd.m3u' },
        'ae': { name: 'UAE 🇦🇪', url: 'https://iptv-org.github.io/iptv/countries/ae.m3u' },
        'sa': { name: 'Saudi Arabia 🇸🇦', url: 'https://iptv-org.github.io/iptv/countries/sa.m3u' },
        'de': { name: 'Germany 🇩🇪', url: 'https://iptv-org.github.io/iptv/countries/de.m3u' },
        'fr': { name: 'France 🇫🇷', url: 'https://iptv-org.github.io/iptv/countries/fr.m3u' },
        'it': { name: 'Italy 🇮🇹', url: 'https://iptv-org.github.io/iptv/countries/it.m3u' },
        'es': { name: 'Spain 🇪🇸', url: 'https://iptv-org.github.io/iptv/countries/es.m3u' },
        'br': { name: 'Brazil 🇧🇷', url: 'https://iptv-org.github.io/iptv/countries/br.m3u' },
        'jp': { name: 'Japan 🇯🇵', url: 'https://iptv-org.github.io/iptv/countries/jp.m3u' },
        'kr': { name: 'South Korea 🇰🇷', url: 'https://iptv-org.github.io/iptv/countries/kr.m3u' },
        'ru': { name: 'Russia 🇷🇺', url: 'https://iptv-org.github.io/iptv/countries/ru.m3u' },
        'tr': { name: 'Turkey 🇹🇷', url: 'https://iptv-org.github.io/iptv/countries/tr.m3u' },
        'all': { name: 'Global 🌍', url: 'https://iptv-org.github.io/iptv/index.m3u' }
    };

    // Curated 100% Guaranteed Working Channels
    const FEATURED_CHANNELS = [
        {
            name: "Aaj Tak HD",
            category: "⭐ Verified Live",
            logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_AAJ_TAK/images/LOGO_HD/image.png",
            url: "https://feeds.intoday.in/aajtak/api/aajtakhd/master.m3u8",
            country: "India"
        },
        {
            name: "India Today HD",
            category: "⭐ Verified Live",
            logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_INDIA_TODAY/images/LOGO_HD/image.png",
            url: "https://feeds.intoday.in/indiatoday/api/itlive/master.m3u8",
            country: "India"
        },
        {
            name: "9X Jalwa (Music)",
            category: "⭐ Verified Live",
            logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_9X_JALWA/images/LOGO_HD/image.png",
            url: "https://wiselp.wiseplayout.com/9X_Jalwa/master.m3u8",
            country: "India"
        },
        {
            name: "9XM Music",
            category: "⭐ Verified Live",
            logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_9XM/images/LOGO_HD/image.png",
            url: "https://9xjio.wiseplayout.com/9XM/master.m3u8",
            country: "India"
        },
        {
            name: "9X Jhakaas",
            category: "⭐ Verified Live",
            logo: "https://dtil.tmsimg.com/assets/s90012_ld_h15_aa.png?lock=720x540",
            url: "https://amg01281-9xmediapvtltd-9xjhakaas-samsungin-ci2cs.amagi.tv/playlist/amg01281-9xmediapvtltd-9xjhakaas-samsungin/playlist.m3u8",
            country: "India"
        },
        {
            name: "DW News (English)",
            category: "⭐ Verified Live",
            logo: "https://i.imgur.com/G566qN7.png",
            url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
            country: "Germany"
        },
        {
            name: "France 24 (English)",
            category: "⭐ Verified Live",
            logo: "https://i.imgur.com/qU3w8Rk.png",
            url: "https://static.france24.com/live/F24_EN_LO_HLS/live_tv.m3u8",
            country: "France"
        },
        {
            name: "Bloomberg TV Live",
            category: "⭐ Verified Live",
            logo: "https://i.imgur.com/2sR9WwZ.png",
            url: "https://bloomberg.com/media-manifest/streams/us.m3u8",
            country: "USA"
        },
        {
            name: "ABC News Live",
            category: "⭐ Verified Live",
            logo: "https://i.imgur.com/QkR4LqG.png",
            url: "https://content.uplynk.com/channel/3324f2467c414329b3b0cc5cd987b6be.m3u8",
            country: "USA"
        },
        {
            name: "Al Jazeera English",
            category: "⭐ Verified Live",
            logo: "https://i.imgur.com/138ZfFp.png",
            url: "https://live-hls-web-aje.getaj.net/AJE/01.m3u8",
            country: "Qatar"
        },
        {
            name: "Red Bull TV",
            category: "⭐ Verified Live",
            logo: "https://i.imgur.com/kP3B1R5.png",
            url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8",
            country: "Global"
        },
        {
            name: "NASA TV",
            category: "⭐ Verified Live",
            logo: "https://i.imgur.com/Psh5n1c.png",
            url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
            country: "USA"
        }
    ];

    // Helper to resolve stream URL with CORS Proxy
    function resolveStreamUrl(rawUrl, forceProxy = false) {
        if (!rawUrl) return '';
        if (rawUrl.startsWith('/proxy?url=')) {
            if (!isProxyEnabled && !forceProxy) {
                return decodeURIComponent(rawUrl.replace('/proxy?url=', ''));
            }
            return rawUrl;
        }
        if (rawUrl.startsWith('https://corsproxy.io/?url=')) {
            if (!isProxyEnabled && !forceProxy) {
                return decodeURIComponent(rawUrl.replace('https://corsproxy.io/?url=', ''));
            }
            return rawUrl;
        }

        if (isProxyEnabled || forceProxy) {
            if (window.location.protocol.startsWith('http')) {
                return `/proxy?url=${encodeURIComponent(rawUrl)}`;
            } else {
                return `https://corsproxy.io/?url=${encodeURIComponent(rawUrl)}`;
            }
        }
        return rawUrl;
    }

    // --- GLOBAL VIDEO ELEMENT LISTENERS ---
    video.addEventListener('playing', () => {
        videoSpinner.style.display = 'none';
        videoContainer.classList.remove('paused');
        clearTimeout(playTimeout);
    });

    video.addEventListener('waiting', () => {
        videoSpinner.style.display = 'flex';
    });

    video.addEventListener('error', () => {
        const err = video.error;
        if (err) {
            logDiagnostic(`HTML5 Video Error: Code ${err.code} | Message: ${err.message}`);
            if (activeChannelIndex !== -1) {
                showError(`Playback failed (Error Code ${err.code}): ${err.message || 'Source unsupported or offline'}`);
                clearTimeout(playTimeout);
            }
        }
    });

    // --- M3U PLAYLIST PARSER ---
    function parseM3U(content) {
        logDiagnostic("Starting parsing of M3U playlist file content.");
        const lines = content.split(/\r?\n/);
        const parsedChannels = [];
        let currentChannel = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith('#EXTM3U')) {
                // Main header, ignore or extract playlist title if present
                continue;
            }

            if (line.startsWith('#EXTINF:')) {
                currentChannel = {
                    name: 'Unknown Channel',
                    logo: '',
                    category: 'Undefined',
                    country: '',
                    url: ''
                };

                // Extract logo
                const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
                if (logoMatch) currentChannel.logo = logoMatch[1];

                // Extract group-title (category)
                const groupMatch = line.match(/group-title="([^"]+)"/i);
                if (groupMatch) {
                    // Split categories if separated by semicolons and take first
                    const groups = groupMatch[1].split(';');
                    currentChannel.category = groups[0] || 'Undefined';
                }

                // Extract country
                const countryMatch = line.match(/tvg-country="([^"]+)"/i);
                if (countryMatch) currentChannel.country = countryMatch[1];

                // Extract name (after the last comma)
                const commaIndex = line.lastIndexOf(',');
                if (commaIndex !== -1) {
                    currentChannel.name = line.substring(commaIndex + 1).trim();
                }
            } else if (!line.startsWith('#')) {
                // This is the URL line
                if (currentChannel) {
                    currentChannel.url = line;
                    parsedChannels.push(currentChannel);
                    currentChannel = null;
                }
            }
        }
        logDiagnostic(`Successfully parsed ${parsedChannels.length} channels.`);
        return parsedChannels;
    }

    // --- DIAGNOSTICS LOGGER ---
    function logDiagnostic(msg) {
        const timestamp = new Date().toLocaleTimeString();
        const entry = `[${timestamp}] ${msg}`;
        diagnosticsLog.push(entry);
        console.log(entry);
        if (diagnosticsLog.length > 50) diagnosticsLog.shift(); // limit size
        diagnosticsLogElement.textContent = diagnosticsLog.join('\n');
    }

    // --- PLAYLIST LOADING & SETUP ---
    async function loadPlaylistFromUrl(url) {
        logDiagnostic(`Attempting to fetch from URL: ${url}`);
        showLoader(true);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const text = await response.text();
            
            if (text.includes('#EXTINF:')) {
                const name = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || 'Remote Playlist';
                processPlaylistContent(text, name);
            } else {
                logDiagnostic("Loaded URL is not an M3U playlist (no #EXTINF tags found). Treating as direct stream URL.");
                loadDirectStream(url);
            }
        } catch (error) {
            logDiagnostic(`Fetch failed: ${error.message}`);
            // Fallback: If fetch failed (e.g. CORS block) but URL looks like a stream, attempt to play directly!
            if (url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('/play/')) {
                logDiagnostic("Fetch failed due to CORS/Network, but URL looks like a stream. Attempting to play directly...");
                loadDirectStream(url);
            } else {
                showLoader(false);
                closeModal();
                alert(`Could not load playlist URL. If it's a playlist, make sure the server allows CORS. Detailed error: ${error.message}`);
            }
        }
    }

    function loadDirectStream(url) {
        let streamName = 'Imported Stream';
        try {
            const parsedUrl = new URL(url);
            const pathParts = parsedUrl.pathname.split('/');
            for (let i = pathParts.length - 1; i >= 0; i--) {
                if (pathParts[i] && !pathParts[i].endsWith('.m3u8')) {
                    streamName = decodeURIComponent(pathParts[i]);
                    break;
                }
            }
            if (streamName === 'Imported Stream' && pathParts.length > 0) {
                const last = pathParts[pathParts.length - 1];
                if (last) streamName = decodeURIComponent(last);
            }
        } catch (e) {
            streamName = 'Custom Stream';
        }

        const singleChannel = {
            name: streamName,
            url: url,
            category: 'Direct Link',
            logo: '',
            country: ''
        };

        channels = [singleChannel];
        playlistNameElement.textContent = 'Direct Stream';
        channelCountElement.textContent = 1;
        
        currentCategory = 'All';
        searchQuery = '';
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        
        generateCategories();
        filterAndRenderChannels();
        showLoader(false);
        closeModal();

        selectChannel(0);
    }

    function processPlaylistContent(content, playlistName) {
        const parsed = parseM3U(content);
        
        // Merge verified working channels at top
        const existingUrls = new Set(parsed.map(c => c.url));
        const relevantFeatured = FEATURED_CHANNELS.filter(fc => !existingUrls.has(fc.url));

        channels = [...relevantFeatured, ...parsed];
        playlistNameElement.textContent = playlistName;
        channelCountElement.textContent = channels.length;
        
        // Populate Categories & Channels
        currentCategory = 'All';
        searchQuery = '';
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        
        generateCategories();
        filterAndRenderChannels();
        showLoader(false);
        closeModal();

        // Autoplay the first channel if available
        if (channels.length > 0) {
            selectChannel(0);
        }
    }

    // Load Country Playlist from iptv-org
    async function loadCountryPlaylist(code) {
        const countryInfo = COUNTRY_PLAYLISTS[code] || COUNTRY_PLAYLISTS['in'];
        logDiagnostic(`Loading country playlist: ${countryInfo.name} (${countryInfo.url})`);
        showLoader(true);
        if (countrySelect) countrySelect.value = code;
        localStorage.setItem('neo_iptv_country', code);

        try {
            let response;
            try {
                response = await fetch(countryInfo.url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
            } catch (fetchErr) {
                logDiagnostic(`Direct playlist fetch failed (${fetchErr.message}). Routing via proxy...`);
                const proxiedUrl = resolveStreamUrl(countryInfo.url, true);
                response = await fetch(proxiedUrl);
                if (!response.ok) throw new Error(`Proxy fetch failed: HTTP ${response.status}`);
            }

            const text = await response.text();
            processPlaylistContent(text, countryInfo.name);
        } catch (err) {
            logDiagnostic(`Failed to load country playlist: ${err.message}. Loading local fallback...`);
            loadDefaultPlaylist();
        }
    }

    function showLoader(show) {
        if (show) {
            channelsLoader.style.display = 'flex';
            channelsContainer.style.display = 'none';
            noChannelsMsg.style.display = 'none';
        } else {
            channelsLoader.style.display = 'none';
            channelsContainer.style.display = 'flex';
        }
    }

    // Load default playlist file from repository
    async function loadDefaultPlaylist() {
        logDiagnostic("Loading default local playlist India_1.iptvcat.org.m3u8...");
        showLoader(true);
        try {
            const response = await fetch('India_1.iptvcat.org.m3u8');
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            const text = await response.text();
            processPlaylistContent(text, 'India (Local Backup)');
        } catch (err) {
            logDiagnostic(`Fetch of local playlist failed: ${err.message}. Loading featured channels.`);
            channels = [...FEATURED_CHANNELS];
            playlistNameElement.textContent = 'Featured Live Channels';
            channelCountElement.textContent = channels.length;
            generateCategories();
            filterAndRenderChannels();
            showLoader(false);
            if (channels.length > 0) selectChannel(0);
        }
    }

    // --- CATEGORY RENDERING ---
    function generateCategories() {
        const uniqueCategories = new Set();
        channels.forEach(ch => {
            if (ch.category) uniqueCategories.add(ch.category);
        });

        // Sorted Categories
        const sortedCats = Array.from(uniqueCategories).sort();
        
        // Add All & Favorites at the beginning
        const finalCats = ['All', 'Favorites', ...sortedCats];
        
        categoriesContainer.innerHTML = '';
        finalCats.forEach(cat => {
            const pill = document.createElement('div');
            pill.className = `category-pill ${cat === currentCategory ? 'active' : ''}`;
            
            // Get count for badge
            let count = 0;
            if (cat === 'All') count = channels.length;
            else if (cat === 'Favorites') count = favorites.size;
            else count = channels.filter(c => c.category === cat).length;
            
            pill.textContent = `${cat} (${count})`;
            pill.addEventListener('click', () => {
                document.querySelectorAll('.category-pill').forEach(el => el.classList.remove('active'));
                pill.classList.add('active');
                currentCategory = cat;
                filterAndRenderChannels();
            });
            categoriesContainer.appendChild(pill);
        });
    }

    // --- CHANNEL LIST RENDERING ---
    function filterAndRenderChannels() {
        // Filter by category
        if (currentCategory === 'All') {
            filteredChannels = channels;
        } else if (currentCategory === 'Favorites') {
            filteredChannels = channels.filter(c => favorites.has(c.url));
        } else {
            filteredChannels = channels.filter(c => c.category === currentCategory);
        }

        // Filter by Search text
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filteredChannels = filteredChannels.filter(c => 
                c.name.toLowerCase().includes(q) || 
                (c.category && c.category.toLowerCase().includes(q))
            );
        }

        // Render List
        channelsContainer.innerHTML = '';
        if (filteredChannels.length === 0) {
            noChannelsMsg.style.display = 'block';
            return;
        }
        noChannelsMsg.style.display = 'none';

        filteredChannels.forEach((channel, idx) => {
            const item = document.createElement('div');
            // Find if this is the active channel by matching URL
            const isPlaying = activeChannelIndex !== -1 && channels[activeChannelIndex] && channels[activeChannelIndex].url === channel.url;
            item.className = `channel-item ${isPlaying ? 'active' : ''}`;
            
            // Fallback SVG Logo generator
            const logoSrc = channel.logo || `data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' width%3D'44' height%3D'44' viewBox%3D'0 0 44 44'%3E%3Crect width%3D'100%25' height%3D'100%25' fill%3D'%23120c24'%2F%3E%3Ctext x%3D'50%25' y%3D'60%25' font-size%3D'14' fill%3D'%238c52ff' font-weight%3D'bold' text-anchor%3D'middle'%3E${channel.name.slice(0, 2).toUpperCase()}%3C%2Ftext%3E%3C%2Fsvg%3E`;

            const isFav = favorites.has(channel.url);

            item.innerHTML = `
                <div class="channel-info-wrapper">
                    <div class="channel-logo-wrapper">
                        <img src="${logoSrc}" alt="${channel.name}" onerror="this.src='data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D\'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg\' width=\'44\' height=\'44\' viewBox=\'0 0 44 44\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23120c24\'/%3E%3Ctext x=\'50%25\' y=\'60%25\' font-size=\'14\' fill=\'%238c52ff\' font-weight=\'bold\' text-anchor=\'middle\'%3E${channel.name.slice(0, 2).toUpperCase()}%3C/text%3E%3C/svg%3E'">
                    </div>
                    <div class="channel-text">
                        <span class="channel-title">${channel.name}</span>
                        <span class="channel-category">${channel.category || 'General'}</span>
                    </div>
                </div>
                <button class="fav-toggle-small ${isFav ? 'active' : ''}" title="${isFav ? 'Remove Favorite' : 'Add Favorite'}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                </button>
            `;

            // Channel selection click listener (ignore clicks on favorite button)
            item.addEventListener('click', (e) => {
                if (e.target.closest('.fav-toggle-small')) return;
                
                // Find actual channel index in main channels array
                const mainIdx = channels.findIndex(c => c.url === channel.url);
                selectChannel(mainIdx);
            });

            // Small Favorite button listener
            const favBtn = item.querySelector('.fav-toggle-small');
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(channel.url);
                // Update categories count dynamically
                generateCategories();
            });

            channelsContainer.appendChild(item);
        });
    }

    // --- SELECT AND PLAY CHANNEL ---
    function selectChannel(idx) {
        if (idx < 0 || idx >= channels.length) return;
        activeChannelIndex = idx;
        const channel = channels[activeChannelIndex];

        logDiagnostic(`Selected Channel: ${channel.name} | Category: ${channel.category}`);

        // Update active highlight classes in Sidebar
        document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
        // Find matching item in rendered list and make it active
        const items = document.querySelectorAll('.channel-item');
        items.forEach(item => {
            const titleEl = item.querySelector('.channel-title');
            if (titleEl && titleEl.textContent === channel.name) {
                item.classList.add('active');
            }
        });

        // Update Channel Details UI
        activeChannelName.textContent = channel.name;
        activeChannelCategory.textContent = channel.category;
        activeStreamUrl.value = channel.url;
        
        const logoSrc = channel.logo || `data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' width%3D'64' height%3D'64' viewBox%3D'0 0 64 64'%3E%3Crect width%3D'100%25' height%3D'100%25' fill%3D'%23110c22'%2F%3E%3Ctext x%3D'50%25' y%3D'60%25' font-size%3D'20' fill%3D'%238c52ff' font-weight%3D'bold' text-anchor%3D'middle'%3E${channel.name.slice(0, 2).toUpperCase()}%3C%2Ftext%3E%3C%2Fsvg%3E`;
        activeChannelLogo.src = logoSrc;
        activeChannelLogo.onerror = function() {
            this.src = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' width%3D'64' height%3D'64' viewBox%3D'0 0 64 64'%3E%3Crect width%3D'100%25' height%3D'100%25' fill%3D'%23110c22'%2F%3E%3Ctext x%3D'50%25' y%3D'60%25' font-size%3D'20' fill%3D'%238c52ff' font-weight%3D'bold' text-anchor%3D'middle'%3E${channel.name.slice(0, 2).toUpperCase()}%3C%2Ftext%3E%3C%2Fsvg%3E`;
        };

        // Update Favorite Button Star state
        const isFav = favorites.has(channel.url);
        if (isFav) {
            favoriteToggleBtn.classList.add('active');
            favStarOutline.style.display = 'none';
            favStarFilled.style.display = 'block';
        } else {
            favoriteToggleBtn.classList.remove('active');
            favStarOutline.style.display = 'block';
            favStarFilled.style.display = 'none';
        }

        // Play the stream
        playStream(channel.url);
    }

    // --- VIDEO STREAM PLAYER (Hls.js) ---
    function playStream(url, forceProxy = false) {
        const resolvedUrl = resolveStreamUrl(url, forceProxy);
        logDiagnostic(`Loading stream URL: ${url} (Resolved: ${resolvedUrl})`);
        
        clearTimeout(playTimeout);
        // Start a 15-second loading timeout safeguard
        playTimeout = setTimeout(() => {
            if (videoSpinner.style.display === 'flex' || video.paused) {
                logDiagnostic("Playback load timed out (15s). Halting stream.");
                showError("The stream loading timed out. The server might be offline, slow, or blocked by CORS security headers.");
                if (hls) {
                    hls.destroy();
                    hls = null;
                }
                video.removeAttribute('src');
                video.load();
            }
        }, 15000);

        // UI states
        videoSpinner.style.display = 'flex';
        videoError.style.display = 'none';
        playOverlay.style.display = 'none';
        videoContainer.classList.remove('paused');
        
        // Reset Time displays
        timeCurrent.textContent = '0:00';
        timeDuration.textContent = 'LIVE';
        progressCurrent.style.width = '0%';

        // Reset retry count
        networkRetryCount = 0;

        // Destroy previous Hls instance
        if (hls) {
            logDiagnostic("Destroying previous Hls.js instance.");
            hls.destroy();
            hls = null;
        }

        // Clean native source
        video.src = '';

        if (Hls.isSupported()) {
            logDiagnostic("Hls.js is supported. Initializing Hls player...");
            hls = new Hls({
                enableWorker: true,
                maxMaxBufferLength: 30, // reduce buffer delay
                lowLatencyMode: true,
                backBufferLength: 60
            });
            
            hls.loadSource(resolvedUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MEDIA_ATTACHED, function () {
                logDiagnostic("Hls.js media attached successfully.");
            });
            
            hls.on(Hls.Events.MANIFEST_PARSED, function () {
                logDiagnostic("Manifest parsed. Playback starting...");
                videoSpinner.style.display = 'none';
                clearTimeout(playTimeout);
                video.play()
                    .then(() => {
                        logDiagnostic("Playback started successfully.");
                        updatePlayPauseUI(true);
                    })
                    .catch(err => {
                        logDiagnostic(`Autoplay blocked: ${err.message}. Displaying play overlay.`);
                        playOverlay.style.display = 'flex';
                        updatePlayPauseUI(false);
                    });
            });

            // Error listener
            hls.on(Hls.Events.ERROR, function (event, data) {
                logDiagnostic(`Hls.js Error Event: ${data.details} | Fatal: ${data.fatal}`);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            if (!isProxyEnabled && !forceProxy) {
                                logDiagnostic("Fatal NETWORK error without proxy. Auto-retrying with CORS Proxy...");
                                playStream(url, true);
                                return;
                            }
                            if (networkRetryCount < 2) {
                                networkRetryCount++;
                                logDiagnostic(`Fatal NETWORK error. Retrying loadSource (${networkRetryCount}/2)...`);
                                setTimeout(() => {
                                    if (hls) hls.startLoad();
                                }, 1500);
                            } else {
                                logDiagnostic("Fatal NETWORK error. Max retries reached. Halting playback.");
                                showError("This stream could not be loaded. It may be offline or requires CORS bypass.");
                                hls.destroy();
                                hls = null;
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            logDiagnostic("Fatal MEDIA error. Attempting media recovery...");
                            hls.recoverMediaError();
                            break;
                        default:
                            logDiagnostic("Unrecoverable error. Halting playback.");
                            showError("This stream could not be loaded. It may be offline or requires CORS bypass.");
                            hls.destroy();
                            hls = null;
                            break;
                    }
                }
            });
        } 
        // iOS/Safari Native HLS Support
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            logDiagnostic("Native HLS playback supported (Safari/iOS). Loading stream natively...");
            video.src = resolvedUrl;
            
            video.addEventListener('loadedmetadata', onNativeMetadataLoaded);
            video.addEventListener('error', onNativeError);
        } else {
            logDiagnostic("HLS playback is not supported on this browser.");
            showError("Your browser does not support HLS streaming. Please use Chrome, Edge, or Firefox.");
        }
    }

    function onNativeMetadataLoaded() {
        logDiagnostic("Native metadata loaded. Playback starting...");
        videoSpinner.style.display = 'none';
        video.play()
            .then(() => {
                updatePlayPauseUI(true);
            })
            .catch(() => {
                playOverlay.style.display = 'flex';
                updatePlayPauseUI(false);
            });
        
        // Remove listeners to prevent memory leaks
        video.removeEventListener('loadedmetadata', onNativeMetadataLoaded);
    }

    function onNativeError(e) {
        logDiagnostic(`Native Video Element error code: ${video.error ? video.error.code : 'unknown'}`);
        showError("Failed to play the stream natively. It may be offline or CORS protected.");
        video.removeEventListener('error', onNativeError);
    }

    function showError(msg) {
        videoSpinner.style.display = 'none';
        videoError.style.display = 'flex';
        errorMessage.textContent = msg;
        updatePlayPauseUI(false);
    }

    // --- FAVORITE MANAGEMENT ---
    function toggleFavorite(url) {
        if (favorites.has(url)) {
            favorites.delete(url);
            logDiagnostic(`Removed channel from favorites: ${url}`);
        } else {
            favorites.add(url);
            logDiagnostic(`Added channel to favorites: ${url}`);
        }
        localStorage.setItem('neo_iptv_favorites', JSON.stringify(Array.from(favorites)));
        
        // If current channel is favorited, update main UI star state
        if (activeChannelIndex !== -1 && channels[activeChannelIndex].url === url) {
            const isFav = favorites.has(url);
            if (isFav) {
                favoriteToggleBtn.classList.add('active');
                favStarOutline.style.display = 'none';
                favStarFilled.style.display = 'block';
            } else {
                favoriteToggleBtn.classList.remove('active');
                favStarOutline.style.display = 'block';
                favStarFilled.style.display = 'none';
            }
        }

        // Re-render channel items to update stars
        filterAndRenderChannels();
    }

    // --- SEARCH LOGIC ---
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (searchQuery) {
            clearSearchBtn.style.display = 'block';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        filterAndRenderChannels();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        filterAndRenderChannels();
        searchInput.focus();
    });

    // --- CUSTOM PLAYER CONTROLS IMPLEMENTATION ---
    
    // Play/Pause Action
    function togglePlay() {
        if (video.paused) {
            video.play()
                .then(() => updatePlayPauseUI(true))
                .catch(err => logDiagnostic(`Play error: ${err.message}`));
        } else {
            video.pause();
            updatePlayPauseUI(false);
        }
    }

    function updatePlayPauseUI(isPlaying) {
        if (isPlaying) {
            playSvg.style.display = 'none';
            pauseSvg.style.display = 'block';
            videoContainer.classList.remove('paused');
            playOverlay.style.display = 'none';
        } else {
            playSvg.style.display = 'block';
            pauseSvg.style.display = 'none';
            videoContainer.classList.add('paused');
        }
    }

    controlPlay.addEventListener('click', togglePlay);
    playOverlay.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);

    // Prev/Next buttons logic
    controlPrev.addEventListener('click', () => {
        if (filteredChannels.length <= 1 || activeChannelIndex === -1) return;
        const currentURL = channels[activeChannelIndex].url;
        const filteredIdx = filteredChannels.findIndex(c => c.url === currentURL);
        
        let newFilteredIdx = filteredIdx - 1;
        if (newFilteredIdx < 0) newFilteredIdx = filteredChannels.length - 1; // wrap around

        const mainIdx = channels.findIndex(c => c.url === filteredChannels[newFilteredIdx].url);
        selectChannel(mainIdx);
    });

    controlNext.addEventListener('click', () => {
        if (filteredChannels.length <= 1 || activeChannelIndex === -1) return;
        const currentURL = channels[activeChannelIndex].url;
        const filteredIdx = filteredChannels.findIndex(c => c.url === currentURL);
        
        let newFilteredIdx = filteredIdx + 1;
        if (newFilteredIdx >= filteredChannels.length) newFilteredIdx = 0; // wrap around

        const mainIdx = channels.findIndex(c => c.url === filteredChannels[newFilteredIdx].url);
        selectChannel(mainIdx);
    });

    // Volume & Mute logic
    function setVolume(val) {
        video.volume = val;
        volumeSlider.value = val;
        video.muted = (val === 0);
        
        if (video.muted) {
            volumeUpSvg.style.display = 'none';
            volumeMuteSvg.style.display = 'block';
        } else {
            volumeUpSvg.style.display = 'block';
            volumeMuteSvg.style.display = 'none';
        }
        localStorage.setItem('neo_iptv_volume', val);
    }

    volumeSlider.addEventListener('input', (e) => {
        setVolume(parseFloat(e.target.value));
    });

    controlMute.addEventListener('click', () => {
        if (video.muted) {
            const lastVol = parseFloat(localStorage.getItem('neo_iptv_volume') || '0.8');
            setVolume(lastVol === 0 ? 0.8 : lastVol);
        } else {
            video.muted = true;
            volumeUpSvg.style.display = 'none';
            volumeMuteSvg.style.display = 'block';
        }
    });

    // Restore saved volume
    const savedVol = localStorage.getItem('neo_iptv_volume');
    if (savedVol !== null) {
        setVolume(parseFloat(savedVol));
    } else {
        setVolume(0.8);
    }

    // Timeline updates (VOD/Live detection)
    video.addEventListener('timeupdate', () => {
        if (video.duration && isFinite(video.duration) && video.duration > 0) {
            // Seekable VOD Stream
            const pct = (video.currentTime / video.duration) * 100;
            progressCurrent.style.width = `${pct}%`;
            
            timeCurrent.textContent = formatTime(video.currentTime);
            timeDuration.textContent = formatTime(video.duration);
        } else {
            // Live Stream
            progressCurrent.style.width = '100%';
            timeCurrent.textContent = formatTime(video.currentTime);
            timeDuration.textContent = 'LIVE';
        }
    });

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Seek clicking
    progressContainer.addEventListener('click', (e) => {
        if (!video.duration || !isFinite(video.duration)) return; // disable for live
        const rect = progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    });

    // Playback events
    video.addEventListener('play', () => updatePlayPauseUI(true));
    video.addEventListener('pause', () => updatePlayPauseUI(false));
    
    // Refresh Stream button
    controlRefresh.addEventListener('click', () => {
        if (activeChannelIndex !== -1) {
            playStream(channels[activeChannelIndex].url);
        }
    });

    // Theater Mode
    controlTheater.addEventListener('click', () => {
        document.body.classList.toggle('theater-mode');
        logDiagnostic(`Toggled Theater Mode. Status: ${document.body.classList.contains('theater-mode')}`);
    });

    // Picture-In-Picture
    controlPip.addEventListener('click', async () => {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
            try {
                await video.requestPictureInPicture();
                logDiagnostic("Entered Picture in Picture.");
            } catch (err) {
                logDiagnostic(`Failed entering Pip: ${err.message}`);
            }
        } else {
            alert("Picture-in-Picture is not supported by your browser.");
        }
    });

    // Fullscreen Mode
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            videoContainer.requestFullscreen()
                .then(() => {
                    fullscreenSvg.style.display = 'none';
                    exitFullscreenSvg.style.display = 'block';
                })
                .catch(err => logDiagnostic(`Fullscreen error: ${err.message}`));
        } else {
            document.exitFullscreen();
        }
    }

    controlFullscreen.addEventListener('click', toggleFullscreen);

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            fullscreenSvg.style.display = 'block';
            exitFullscreenSvg.style.display = 'none';
        }
    });

    // Double click video for Fullscreen
    videoContainer.addEventListener('dblclick', (e) => {
        if (e.target !== volumeSlider && e.target.closest('.custom-controls') === null) {
            toggleFullscreen();
        }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Ignore if searching or inputting URL
        if (document.activeElement === searchInput || document.activeElement === playlistUrlInput) return;

        if (e.key === ' ' || e.key === 'k') {
            e.preventDefault();
            togglePlay();
        } else if (e.key === 'f') {
            e.preventDefault();
            toggleFullscreen();
        } else if (e.key === 'm') {
            e.preventDefault();
            controlMute.click();
        } else if (e.key === 'ArrowRight') {
            if (video.duration && isFinite(video.duration)) video.currentTime += 10;
        } else if (e.key === 'ArrowLeft') {
            if (video.duration && isFinite(video.duration)) video.currentTime -= 10;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setVolume(Math.min(1, video.volume + 0.05));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setVolume(Math.max(0, video.volume - 0.05));
        }
    });

    // --- OTHER UI INTERACTIONS ---
    
    // Copy URL
    copyUrlBtn.addEventListener('click', () => {
        if (!activeStreamUrl.value) return;
        navigator.clipboard.writeText(activeStreamUrl.value)
            .then(() => {
                const origSvg = copyUrlBtn.innerHTML;
                copyUrlBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                setTimeout(() => {
                    copyUrlBtn.innerHTML = origSvg;
                }, 1500);
            })
            .catch(err => console.error("Could not copy:", err));
    });

    // Favorite toggle button below player
    favoriteToggleBtn.addEventListener('click', () => {
        if (activeChannelIndex === -1) return;
        toggleFavorite(channels[activeChannelIndex].url);
        generateCategories();
    });

    // Retry error button
    retryStreamBtn.addEventListener('click', () => {
        if (activeChannelIndex !== -1) {
            playStream(channels[activeChannelIndex].url);
        }
    });

    // Diagnose error button
    diagnoseBtn.addEventListener('click', () => {
        openDiagnosticsModal();
    });

    // --- MODALS HANDLERS ---
    
    // Import Playlist Modal
    function openModal() {
        importModal.classList.add('active');
    }
    
    function closeModal() {
        importModal.classList.remove('active');
    }

    importPlaylistBtn.addEventListener('click', openModal);
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    // Diagnostics Modal
    function openDiagnosticsModal() {
        diagnosticsModal.classList.add('active');
    }
    
    function closeDiagnosticsModal() {
        diagnosticsModal.classList.remove('active');
    }

    diagnoseBtn.addEventListener('click', openDiagnosticsModal);
    diagModalClose.addEventListener('click', closeDiagnosticsModal);
    diagModalOverlay.addEventListener('click', closeDiagnosticsModal);

    // Tab Switching in Import Modal
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Drag and Drop Zone listeners
    dragDropZone.addEventListener('click', () => fileInput.click());
    
    dragDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragDropZone.classList.add('dragover');
    });
    
    dragDropZone.addEventListener('dragleave', () => {
        dragDropZone.classList.remove('dragover');
    });
    
    dragDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleUploadedFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUploadedFile(e.target.files[0]);
        }
    });

    function handleUploadedFile(file) {
        logDiagnostic(`File dropped/selected: ${file.name} | Size: ${file.size} bytes`);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            if (text.includes('#EXTINF:')) {
                processPlaylistContent(text, file.name);
            } else {
                // If it's not a playlist file, check if it contains a URL
                const lines = text.split(/\r?\n/);
                let foundUrl = '';
                for (let line of lines) {
                    line = line.trim();
                    if (line.startsWith('http://') || line.startsWith('https://')) {
                        foundUrl = line;
                        break;
                    }
                }
                if (foundUrl) {
                    loadDirectStream(foundUrl);
                } else {
                    alert("Invalid M3U playlist file: No channel tags found.");
                }
            }
        };
        reader.onerror = (err) => {
            logDiagnostic(`File read error: ${err}`);
            alert("Error reading file.");
        };
        reader.readAsText(file);
    }

    // Load from URL Button listener
    loadUrlBtn.addEventListener('click', () => {
        const url = playlistUrlInput.value.trim();
        if (url) {
            loadPlaylistFromUrl(url);
        } else {
            alert("Please enter a valid playlist URL.");
        }
    });

    playlistUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadUrlBtn.click();
    });

    // Load default button listener
    loadDefaultBtn.addEventListener('click', () => {
        loadDefaultPlaylist();
    });

    // Proxy Toggle Button
    function updateProxyUI() {
        if (!proxyToggleBtn || !proxyStatusText) return;
        if (isProxyEnabled) {
            proxyToggleBtn.classList.add('active');
            proxyStatusText.textContent = 'Proxy: ON';
        } else {
            proxyToggleBtn.classList.remove('active');
            proxyStatusText.textContent = 'Proxy: OFF';
        }
        localStorage.setItem('neo_iptv_proxy', isProxyEnabled);
    }
    updateProxyUI();

    if (proxyToggleBtn) {
        proxyToggleBtn.addEventListener('click', () => {
            isProxyEnabled = !isProxyEnabled;
            updateProxyUI();
            logDiagnostic(`Stream Proxy toggled to: ${isProxyEnabled}`);
            if (activeChannelIndex !== -1 && channels[activeChannelIndex]) {
                playStream(channels[activeChannelIndex].url);
            }
        });
    }

    if (toggleProxyRetryBtn) {
        toggleProxyRetryBtn.addEventListener('click', () => {
            isProxyEnabled = true;
            updateProxyUI();
            if (activeChannelIndex !== -1 && channels[activeChannelIndex]) {
                playStream(channels[activeChannelIndex].url, true);
            }
        });
    }

    // Country Dropdown Change Listener
    if (countrySelect) {
        countrySelect.addEventListener('change', (e) => {
            loadCountryPlaylist(e.target.value);
        });
    }

    // Country Quick Buttons in Modal
    countryQuickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.getAttribute('data-country');
            if (code) loadCountryPlaylist(code);
        });
    });

    // --- AUTO-LOAD AT STARTUP ---
    const savedCountry = localStorage.getItem('neo_iptv_country') || 'in';
    loadCountryPlaylist(savedCountry);
});
