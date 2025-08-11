TODO
- [x] process data from Spotify API - albums, artists, and tracks
= [] copmlete setup for music source adapter in src/utils/music - Spotify
- [] code lyric fetching process for each track from multiple sources (use primary source then fallbacks) - find 2-3 APIs to get lyrics from
- [] setup pipeline to insert albums, artists, and tracks to DB from Spotify
- [] set up NLP pipeline for lyrics analysis on tracks
- [] create a pipeline to Fetch Albums based scoring data, critical claim, popularity
- [] For each album, get songs, metadata, lyrics, etc
- [] Make a dataset of 100-200 Hiphop Albums based on criteria scores across review sites

Critic, Review, Popularity, Ranking sources
- Last.fm - popularity, has API
- Acclaim Music - No API,critically acclaimed albums, cross referenced with multiple critics and journalists (albums in this list will be weighted highly for scores)
- Any Decent Music - no API
- MusicBrainz - has API

FUTURE:
- [] setup scoring for newly added albums
- [] Use agent workflow to help aggregate mentions, ratings, reviews from multiple sources to score albums
