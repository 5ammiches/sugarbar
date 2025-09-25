from crawl4ai import BrowserProfiler


# for creating a musixmatch profile to perform crawl on Musixmatch source
async def create_profile():
    profiler = BrowserProfiler()
    profile_path = await profiler.create_profile(profile_name="musixmatch-login")
    print("Saved profile at:", profile_path)
