# TODO
- [ ] - Collect 200-500 hiphop albums - get songs, metadata, and lyrics
- [ ] - NLP prcessing for lyric extraction
- [ ] - NLP processing to segment the structure of the lyrics (verse, chorus, bridge, etc)


# 🎤 DailyBar - Hip-Hop Bar Generator MVP

A simple web application that generates random hip-hop bars from legendary tracks with streaming platform integration.

## 🚀 Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up Convex:**

   ```bash
   npx convex dev
   ```

   Follow the prompts to create a new Convex project.

3. **Environment variables:**
   Copy `.env.example` to `.env.local` and fill in your Convex URL:

   ```bash
   cp .env.example .env.local
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## 🏗️ MVP Features

- ✅ Random hip-hop bar generation
- ✅ Clean, mobile-friendly interface
- ✅ Streaming platform links (Spotify, YouTube, Apple Music)
- ✅ Share functionality
- ✅ Context scoring display
- ✅ Real-time data with Convex

## 🛠️ Tech Stack

- **Frontend**: TanStack Start (React SSR)
- **Backend**: Convex (Real-time database & serverless functions)
- **Styling**: Tailwind CSS v4
- **Authentication**: Clerk (ready for future features)

## 📁 Project Structure

```
src/
  components/
    BarGenerator.tsx    # Main bar generation component
    ConvexProvider.tsx  # Convex React Query integration
  routes/
    index.tsx          # Home page
    __root.tsx         # App root with providers
convex/
  bars.ts             # Bar generation functions
  schema.ts           # Database schema
```

## 🎯 Next Steps

This MVP includes sample data. To expand:

1. **Add real APIs**: Integrate Genius API for lyrics
2. **Audio integration**: Add Spotify Web Playback SDK
3. **NLP processing**: Implement lyric analysis
4. **User features**: Save favorites, user accounts
5. **Content expansion**: Larger database of hip-hop tracks

## 🚀 Deployment

The app is ready for deployment on Vercel or similar platforms. Make sure to:

1. Deploy your Convex backend first
2. Update environment variables with production URLs
3. Configure domain settings

---

**Made with ❤️ by [Sammi Ghazzawi](https://github.com/sammig6i)**
# dailybar
