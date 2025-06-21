// ==UserScript==
// @name         List Of Albums - Player Injection
// @version      1.5
// @description  try to take over the world!
// @author       You
// @match        https://en.wikipedia.org/wiki/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wikipedia.org
// @updateURL    https://raw.githubusercontent.com/Jbudone/greasemonkey/refs/heads/main/wikialbums.user.js
// @downloadURL  https://raw.githubusercontent.com/Jbudone/greasemonkey/refs/heads/main/wikialbums.user.js
// ==/UserScript==

// TODO:
//
//   - popular songs loaded into static div
//   - button to go to next artist ; maybe on the side of youtube video, and on hover extend the width. Other buttons for swapping to popular songs of current album, or next album's popular song, etc.
//   - cleanup [Play Album] and [Close Album] button
//   - get view count for each song in the album on open: show which are most popular
//



(function() {
    'use strict';

    console.log("TESTING GREASEMONKEY UPDATE: 8");

    let youtubeApiKey = '';

    let wikiPageYear = 0;
    let savedHistory = {};

    let YT = null;
    let YTPlayerEvents = null;
    let initialized = false;

    let activePlayer = {

    };

    // Function to fetch player embed code from YouTube API
    async function fetchFromYoutube(artist, album) {
        const query = encodeURIComponent(`${album} ${artist}`);

        // Video
        //const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&key=${youtubeApiKey}`;

        // Playlist
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=playlist&key=${youtubeApiKey}`;


        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.items.length > 0) {

                // Video
                //const videoId = data.items[0].id.videoId;
                //return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;

                // Playlist
                const playlistId = data.items[0].id.playlistId;
                return `<iframe id='yt-iframe' width="100%" height="115" src="https://www.youtube.com/embed/videoseries?list=${playlistId}&enablejsapi=1" frameborder="0" allowfullscreen></iframe>`;
            }
        } catch (error) {
            console.error('Error fetching from YouTube:', error);
        }
        return null;
    }

    // Function to fetch player embed code from Spotify API
    async function fetchFromSpotify(artist, album) {
        // Implement Spotify API interaction
        // Return embed code or URL
        // Note: Requires handling OAuth
        return null;
    }

    async function scrapeSingles(link) {
        //return new Promise((resolve, reject) => {
        let getResponse = await fetch(link.href);
        let response = await getResponse.text();
            //GM_xmlhttpRequest({
            //    method: "GET",
            //    url: link.href,
            //    onload: function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response, "text/html");
                        const infobox = doc.querySelector('.infobox');
                        if (infobox) {
                            const singlesRow = Array.from(infobox.querySelectorAll('tr'))
                                .find(row => row.textContent.includes(`Singles from `));
                            if (singlesRow) {
                                // Extract and process the list of singles
                                const singles = singlesRow.nextElementSibling.textContent; // Or other logic as needed
                                return singles;
                            } else {
                                return null;
                            }
                        } else {
                            return null;
                        }
                    } catch (error) {
                        return null;
                    }
            //    },
            //    onerror: function(error) {
            //        reject(error);
            //    }
            //});
        //});
    }

    // Main function to fetch player
    async function fetchPlayer(artist, album) {
        let playerCode = await fetchFromYoutube(artist, album);
        if (!playerCode) {
            playerCode = await fetchFromSpotify(artist, album);
        }
        return playerCode;
    }

    function getGlobalOffset(element) {
        let getOffset = (element) => {
            if (element == null) return 0;
            let elOffset = element.offsetTop;
            return elOffset + getOffset(element.offsetParent);
        }

        let globalOffset = getOffset(element, 0);
        return globalOffset;
    }

    function hasViewedAlbum(artist, album) {
        return savedHistory && savedHistory[artist] && savedHistory[artist][album];
    }

    function createButton(artistCell, albumCell, artist, album) {
        const button = document.createElement('button');
        button.textContent = 'Play Album';

        button.dataset.artist = artist;
        button.dataset.album = album;
        button.dataset.isPlayerActive = "false";
        button.style.display = 'none'; // Initially hidden

        const onClick = async function() {

            if (!initialized) {
                console.log("Not initialized yet -- ignoring button click");
                return;
            }

            if (activePlayer.button == button) {
                // This is the player. Closing
                activePlayer.close();
                return;
            } else if (activePlayer.button) {
                // There's already a player running. Close that one first
                activePlayer.close();
            }

            // Open new player
            activePlayer.button = button;
            activePlayer.close = async function() {

                activePlayer.button = null;
                activePlayer.close = null;

                // already playing, close
                console.log("Closing player");
                //const playerDiv = artistCell.querySelector('.player-container');
                const playerDiv = document.body.querySelector('.player-container');
                if (playerDiv) {
                    //artistCell.removeChild(playerDiv);
                    //document.body.removeChild(playerDiv);
                    playerDiv.remove();
                }

                const singlesDiv = albumCell.querySelector('.singles-container');
                if (singlesDiv) {
                    albumCell.removeChild(singlesDiv);
                }
                button.textContent = 'Play Album';
                button.dataset.isPlayerActive = 'false';

                // Save history
                const artist = button.dataset.artist, artistComponent = encodeURIComponent(artist);
                const album = button.dataset.album, albumComponent = encodeURIComponent(album);
                if (!savedHistory[artist]) savedHistory[artist] = {};
                savedHistory[artist][album] = true;
                const th = button.parentElement.parentElement;
                th.classList.add('viewed-album');
                th.classList.remove('viewing-album');

                const savedHistoryResponse  = await (await fetch(`https://nodewebsocket.glitchy.me/dbAction?proj=wikialbums&action=addHistory&year=${wikiPageYear}&artist=${artistComponent}&album=${albumComponent}`)).text();
                //let = await fetch(`https://nodewebsocket.glitchy.me/dbAction?proj=wikialbums&action=addHistory&year=${wikiPageYear}&artist=${artistComponent}&album=${albumComponent}`);
                //let response = await savedHistoryResponse.text();
                console.log(savedHistoryResponse);
            };




            // Extract artist and album from the row, then fetch and inject player
            activePlayer.button = button;
            console.log("Opening player");
            const artist = this.dataset.artist;
            const album = this.dataset.album;
            const playerCode = await fetchPlayer(artist, album);
            if (playerCode) {
                const playerDiv = document.createElement('div');
                const th = button.parentElement.parentElement;
                th.classList.add('viewing-album');
                playerDiv.innerHTML = playerCode;
                playerDiv.classList.add('player-container');
                //artistCell.appendChild(playerDiv);
                document.body.prepend(playerDiv);
                button.textContent = 'Close Player';
                button.dataset.isPlayerActive = 'true';

                let albumLink = albumCell.querySelector('a');
                if (albumLink) {
                    let singles = await scrapeSingles(albumLink);
                    const singlesDiv = document.createElement('div');
                    singlesDiv.innerHTML = singles;
                    singlesDiv.classList.add('singles-container');
                    albumCell.appendChild(singlesDiv);
                }

                // NOTE: YT belongs to a separate realm than userscript; so these events need to be specified in our injected script
                var player = new YT.Player('yt-iframe', YTPlayerEvents);
            }


            // NOTE: Injection/Dejection can cause window to scroll out of view
            //setTimeout(() => {
            //    const buttonParentEl = button.parentElement; // NOTE: button is sometimes hidden, so we can't read its offset nor offsetParent easily
            //    const buttonOffset = getGlobalOffset(buttonParentEl);
            //    window.scroll(0, buttonOffset);
            //}, 100);
        };

        button.addEventListener('click', onClick, true);
        //button.onclick = onClick;

        return button;
    }

    function addStyles() {
        var styleEl = document.createElement('style');
        var style = `
            .player-container {
                position: fixed;
                z-index: 100;
                width: 100%;
                height: 20%;
                top: 0px;
            }

            .player-container:hover {
                height: 80%;
            }

            #yt-iframe {
                height: 100%;
            }

            .viewed-album {
                color: green;
                font-weight: bold;
                background-color: bisque;
            }

            .viewing-album {
                font-weight: bold;
                background-color: green;
            }
        `;
        styleEl.innerText = style;
        document.head.appendChild(styleEl);
    }

    function addButtonsToTables() {
        const rows = document.querySelectorAll('.wikitable tbody tr');
        rows.forEach(row => {
            let validRow = false;
            let artist = "", album = "";
            let artistCell = null, albumCell = null;
            if (row.cells.length == 5) {
                validRow = true;
                artistCell = row.cells[0];
                albumCell = row.cells[1];
            } else if (row.cells.length == 6) {
                validRow = true;
                artistCell = row.cells[1];
                albumCell = row.cells[2];
            }

            if (validRow) {
                artist = artistCell.innerText;
                album = albumCell.innerText;
                const button = createButton(artistCell, albumCell, artist, album);
                artistCell.appendChild(button);

                // Show button on hover
                artistCell.onmouseenter = () => button.style.display = '';
                artistCell.onmouseleave = () => button.style.display = 'none';

                // Have we already viewed this?
                let viewedAlbum = hasViewedAlbum(artist, album);
                if (viewedAlbum) {
                    row.classList.add('viewed-album');
                }
            }
        });


        //var player;
        // function defined in here belongs to its own "realm"
        // have to define this function in a script that belongs in the same realm as the YT script
        const YTOnReadyScriptEl = document.createElement('script');
        YTOnReadyScriptEl.id = 'YT-on-ready-script';
        YTOnReadyScriptEl.textContent = `
            function onYouTubeIframeAPIReady() {
                console.log("ONYOUTUBELOAD");
                //player = new YT.Player('yt-iframe', {
                //    events: {
                //        'onReady': onPlayerReady,
                //        'onStateChange': onPlayerStateChange
                //    }
                //});
            }

            function onPlayerReady(event) {
            }

            function onPlayerStateChange(event) {
            }

            window['onPlayerReady'] = onPlayerReady;
            window['onPlayerStateChange'] = onPlayerStateChange;

            window['YTPlayerEvents'] = {
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            };
        `;
        document.head.appendChild(YTOnReadyScriptEl);
        //var firstScriptTag = document.getElementsByTagName('script')[0];
        //firstScriptTag.parentNode.insertBefore(YTOnReadyScriptEl, firstScriptTag);

        var tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
        //YTOnReadyScriptEl.parentNode.insertBefore(tag, YTOnReadyScriptEl);

        //function onPlayerReady(event) {
        //    debugger;
        //    window['player'] = player;
        //}
        //function onPlayerStateChange(event) {
        //}
        //

        let onDependenciesReady = () => {
            console.log('Dependencies ready');
            initialized = true;
            YT = unsafeWindow['YT'];
            YTPlayerEvents = unsafeWindow['YTPlayerEvents'];
        };

        let waitUntilDependenciesReady = () => {
            if (unsafeWindow['YT']) {
                onDependenciesReady();
                return;
            }

            setTimeout(waitUntilDependenciesReady, 100);
        };

        waitUntilDependenciesReady();
    }

    async function initialLoad() {
      
        // fetch api key
        const youtubeApiKeyResponse = await (await fetch(`https://nodewebsocket.glitchy.me/vaultSecret?key=youtube-apikey`)).text();
        youtubeApiKey = JSON.parse(youtubeApiKeyResponse).secret;
      	console.log(youtubeApiKey);

        const yearPart = window.location.pathname.match(/List_of_(\d+)_albums/);
        wikiPageYear = (yearPart && yearPart.length == 2) ? yearPart[1] : 0;

        // fetch saved history
        const savedHistoryResponse = await (await fetch(`https://nodewebsocket.glitchy.me/dbAction?proj=wikialbums&action=history&year=${wikiPageYear}`)).text();
        console.log(savedHistoryResponse);
        let savedHistoryRaw = JSON.parse(savedHistoryResponse);
        console.log(savedHistoryRaw);

        savedHistory = {}; // { artist[] {album} }
        for (let i = 0; i < savedHistoryRaw.length; ++i) {
            const artist = decodeURIComponent(savedHistoryRaw[i].artist);
            const album = decodeURIComponent(savedHistoryRaw[i].album);
            if (!savedHistory[artist]) { savedHistory[artist] = {}; }
            savedHistory[artist][album] = true;
        }

        addStyles();
        addButtonsToTables();
    };

    console.log("JOSH: LOADED SCRIPT");
    if (document.readyState !== 'loading') {
        initialLoad();
    } else {
        document.addEventListener('DOMContentLoaded', initialLoad);
    }

    unsafeWindow['fetchPlayer'] = fetchPlayer;
    unsafeWindow['addButtonsToTables'] = addButtonsToTables;
})();
