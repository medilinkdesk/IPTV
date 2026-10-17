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
        channels = parseM3U(content);
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
            // Relative fetch should work if serving index.html over HTTP
            const response = await fetch('India_1.iptvcat.org.m3u8');
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            const text = await response.text();
            processPlaylistContent(text, 'India_1.iptvcat.org.m3u8');
        } catch (err) {
            logDiagnostic(`Fetch of default playlist failed: ${err.message}`);
            showLoader(false);
            alert("Default playlist file (India_1.iptvcat.org.m3u8) could not be loaded automatically. Please drag and drop the file or upload it manually via 'Import M3U' button.");
            // Open modal to prompt user
            openModal();
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
    function playStream(url) {
        logDiagnostic(`Loading stream source URL: ${url}`);
        
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
            
            hls.loadSource(url);
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
                            if (networkRetryCount < 3) {
                                networkRetryCount++;
                                logDiagnostic(`Fatal NETWORK error. Retrying loadSource (${networkRetryCount}/3)...`);
                                setTimeout(() => {
                                    if (hls) hls.startLoad();
                                }, 2000);
                            } else {
                                logDiagnostic("Fatal NETWORK error. Max retries reached. Halting playback.");
                                showError("The stream could not be loaded. This might be due to CORS issues, invalid source, or being offline.");
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
                            showError("The stream could not be loaded. This might be due to CORS issues, invalid source, or being offline.");
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
            video.src = url;
            
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

    // --- AUTO-LOAD AT STARTUP ---
    loadDefaultPlaylist();
});
