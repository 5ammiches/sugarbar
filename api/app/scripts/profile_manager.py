import asyncio

from crawl4ai import BrowserProfiler


async def main():
    profiler = BrowserProfiler()
    await profiler.interactive_manager()

asyncio.run(main())
