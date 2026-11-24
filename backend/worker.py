import asyncio
import logging
from app.db.session import close_db, init_db
from app.services.scheduler import scheduled_post_worker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("worker_main")


async def main():
    logger.info("Initializing database connection for background worker...")
    await init_db()
    scheduled_post_worker.start()
    logger.info("Scheduled post worker running. Polling every %ds... (Press Ctrl+C to stop)", scheduled_post_worker.interval_seconds)

    try:
        while True:
            await asyncio.sleep(1)
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Shutting down background worker...")
        await scheduled_post_worker.stop()
        await close_db()
        logger.info("Worker stopped cleanly.")


if __name__ == "__main__":
    asyncio.run(main())
