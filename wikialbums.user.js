// ==UserScript==
// @name         List Of Albums - Player Injection
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  try to take over the world!
// @author       You
// @match        https://en.wikipedia.org/wiki/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wikipedia.org
// @updateURL    https://raw.githubusercontent.com/Jbudone/greasemonkey/refs/heads/main/wikialbums.user.js
// @downloadURL  https://raw.githubusercontent.com/Jbudone/greasemonkey/refs/heads/main/wikialbums.user.js
// ==/UserScript==

// TODO:
//
//   - Wiki/Music move iframe to static div (top of screen)
//   - save progress (text in static div)
//   - popular songs loaded into static div
//   - button to go to next artist
//



(function() {
    'use strict';

    console.log("TESTING GREASEMONKEY UPDATE: 7");

    let youtubeApiKey = '';

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
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: link.href,
                onload: function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, "text/html");
                        const infobox = doc.querySelector('.infobox');
                        if (infobox) {
                            const singlesRow = Array.from(infobox.querySelectorAll('tr'))
                                .find(row => row.textContent.includes(`Singles from `));
                            if (singlesRow) {
                                // Extract and process the list of singles
                                const singles = singlesRow.nextElementSibling.textContent; // Or other logic as needed
                                resolve(singles);
                            } else {
                                resolve(null);
                            }
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
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

    function createButton(artistCell, albumCell, artist, album) {
        const button = document.createElement('button');
        button.textContent = 'Play Album';

        button.dataset.artist = artist;
        button.dataset.album = album;
        button.dataset.isPlayerActive = "false";
        button.style.display = 'none'; // Initially hidden

        const onClick = async function() {
            // Extract artist and album from the row, then fetch and inject player
            console.log('Button.onclick');
            if (button.dataset.isPlayerActive == "true") {
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
                this.textContent = 'Play Album';
                this.dataset.isPlayerActive = 'false';
            } else {
                console.log("Opening player");
                const artist = this.dataset.artist;
                const album = this.dataset.album;
                const playerCode = await fetchPlayer(artist, album);
                if (playerCode) {
                    const playerDiv = document.createElement('div');
                    playerDiv.innerHTML = playerCode;
                    playerDiv.classList.add('player-container');
                    //artistCell.appendChild(playerDiv);
                    document.body.prepend(playerDiv);
                    this.textContent = 'Close Player';
                    this.dataset.isPlayerActive = 'true';

                    let albumLink = albumCell.querySelector('a');
                    if (albumLink) {
                        let singles = await scrapeSingles(albumLink);
                        const singlesDiv = document.createElement('div');
                        singlesDiv.innerHTML = singles;
                        singlesDiv.classList.add('singles-container');
                        albumCell.appendChild(singlesDiv);
                    }

                    var player = new YT.Player('yt-iframe', {
                        events: {
                            'onReady': onPlayerReady,
                            'onStateChange': onPlayerStateChange
                        }
                    });

                    function onPlayerReady(event) {
                        unsafeWindow['player'] = player;
                    }
                    function onPlayerStateChange(event) {
                    }
                }
            }

            // NOTE: Injection/Dejection can cause window to scroll out of view
            setTimeout(() => {
                const buttonParentEl = button.parentElement; // NOTE: button is sometimes hidden, so we can't read its offset nor offsetParent easily
                const buttonOffset = getGlobalOffset(buttonParentEl);
                window.scroll(0, buttonOffset);
            }, 100);
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
                bottom: 0px;
                z-index: 100;
                width: 100%;
                height: 100px;
            }
        `;
        styleEl.innerText = style;
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
            }
        });


        var tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        //var player;
        function onYouTubeIframeAPIReady() {
            //player = new YT.Player('yt-iframe', {
            //    events: {
            //        'onReady': onPlayerReady,
            //        'onStateChange': onPlayerStateChange
            //    }
            //});
        }

        //function onPlayerReady(event) {
        //    debugger;
        //    window['player'] = player;
        //}
        //function onPlayerStateChange(event) {
        //}
    }

    async function initialLoad() {
      
        const youtubeApiKeyResponse = await (await fetch(`https://nodewebsocket.glitchy.me/vaultSecret?key=youtube-apikey`)).text();
        youtubeApiKey = JSON.parse(youtubeApiKeyResponse).secret;
      	console.log(youtubeApiKey);

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
