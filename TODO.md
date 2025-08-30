TODO

- [x] process data from Spotify API - albums, artists, and tracks
- [x] copmlete setup for music source adapter in src/utils/music - Spotify
- [x] Read Crawl4AI Docs ( start at Deep Crawling 4. Filtering Content )
- [x] setup python service to use Crawl4AI to provide lyrics from sources (Musixmatch as a fallback) - Genius and Musixmatch
- [x] setup Musixmatch lyrics provider
- [x] start project documentation - Document how to set up project and simple structure of the project so far
- [ ] Make pipline for Albums -> Tracks -> get metadata + lyrics + audio ( After, find way to get genre tags + Think about how to process lyrics with NLP + How to get the audio snippets)
- [ ] code solution to get genres for albums and individual tracks - this will be apart of genre_tages in typings.ts
- [ ] get audio for each track
- [ ] get the synced lyrics from lyrics and audio files then save for each track in DB - will be used to display lyrics (read Whisper model and stable.ts https://github.com/jianfch/stable-ts)
- [ ] setup pipeline to insert albums, artists, and tracks to DB from Spotify
- [ ] set up NLP pipeline for lyrics analysis on tracks
- [ ] create a pipeline to Fetch Albums based scoring data, critical claim, popularity
- [ ] For each album, get songs, metadata, lyrics, etc
- [ ] Make a dataset of 100-200 Hiphop Albums

Critic, Review, Popularity, Ranking sources

- Last.fm - popularity, has API
- Acclaim Music - No API,critically acclaimed albums, cross referenced with multiple critics and journalists (albums in this list will be weighted highly for scores)
- Any Decent Music - no API
- MusicBrainz - has API

FUTURE:

- [ ] setup scoring for newly added albums
- [ ] Use agent workflow to help aggregate mentions, ratings, reviews from multiple sources to score albums

RESOURCES

- Crawl4AI - crawling and web scraping (https://docs.crawl4ai.com/)
- stable-ts - forced alignment with OpenAI Whipser (align lyrics with audio snippets) (https://github.com/jianfch/stable-ts)
