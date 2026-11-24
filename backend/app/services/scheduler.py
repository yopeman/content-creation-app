import asyncio
from datetime import datetime, timezone
import logging
from typing import Optional
from app.models.content import Content
from app.models.enums import PostStatus, PostTargetStatus
from app.models.post import Post
from app.models.post_target import PostTarget
from app.models.user import User

logger = logging.getLogger("scheduler_worker")


class ScheduledPostWorker:
    """Asynchronous background worker that polls for due scheduled posts

    and publishes all content items to their destination social platforms.
    """

    def __init__(self, interval_seconds: int = 15):
        self.interval_seconds = interval_seconds
        self.running = False
        self._task: Optional[asyncio.Task] = None

    def start(self):
        """Starts the background worker loop as an asyncio Task."""
        if not self.running:
            self.running = True
            self._task = asyncio.create_task(self._run_loop())
            logger.info("Scheduled post background worker started (interval: %ss).", self.interval_seconds)

    async def stop(self):
        """Cancels and cleanly awaits completion of the background task."""
        if self.running:
            self.running = False
            if self._task and not self._task.done():
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
            logger.info("Scheduled post background worker stopped.")

    async def _run_loop(self):
        while self.running:
            try:
                await self.process_due_posts()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.exception("Error in scheduler worker cycle: %s", exc)

            try:
                await asyncio.sleep(self.interval_seconds)
            except asyncio.CancelledError:
                break

    async def process_due_posts(self) -> int:
        """Finds all posts marked as SCHEDULED with scheduled_at <= now, and dispatches them."""
        now = datetime.now(timezone.utc)
        due_posts = await Post.find(
            Post.status == PostStatus.SCHEDULED,
            Post.scheduled_at <= now,
            Post.deleted_at == None,  # noqa: E711
        ).to_list()

        if not due_posts:
            return 0

        logger.info("Processing %d due scheduled post(s)...", len(due_posts))
        from app.api.v1.posts import dispatch_post_target

        processed_count = 0
        for post in due_posts:
            try:
                user = await User.get(post.user_id)
                content = await Content.get(post.content_id)
                if not user or not content:
                    post.status = PostStatus.FAILED
                    post.updated_at = datetime.now(timezone.utc)
                    await post.save()
                    continue

                targets = await PostTarget.find(
                    PostTarget.post_id == post.id,
                    PostTarget.deleted_at == None,  # noqa: E711
                ).to_list()

                updated_targets = []
                for t in targets:
                    if t.status in [PostTargetStatus.PENDING, PostTargetStatus.FAILED]:
                        t_res = await dispatch_post_target(
                            target=t,
                            post=post,
                            content=content,
                            user=user,
                        )
                        updated_targets.append(t_res)
                    else:
                        updated_targets.append(t)

                statuses = [t.status for t in updated_targets]
                if all(s == PostTargetStatus.PUBLISHED for s in statuses):
                    post.status = PostStatus.PUBLISHED
                elif any(s == PostTargetStatus.PUBLISHED for s in statuses):
                    post.status = PostStatus.PARTIAL
                else:
                    post.status = PostStatus.FAILED

                post.updated_at = datetime.now(timezone.utc)
                await post.save()
                processed_count += 1
                logger.info("Processed scheduled post %s -> %s", post.id, post.status)
            except Exception as exc:
                logger.exception("Failed to dispatch scheduled post %s: %s", post.id, exc)
                post.status = PostStatus.FAILED
                post.updated_at = datetime.now(timezone.utc)
                await post.save()
                processed_count += 1

        return processed_count


scheduled_post_worker = ScheduledPostWorker(interval_seconds=15)
