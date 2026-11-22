from datetime import datetime, timezone
from typing import List, Optional, Tuple
from beanie import PydanticObjectId
from app.core.config import settings
from app.models.content import Content, ContentDetail
from app.models.enums import ContentStatus, ContentType, PlanItemStatus, PlanStatus, PromptStatus, PromptType
from app.models.plan import Plan
from app.models.plan_item import PlanItem
from app.models.prompt import Prompt
from app.services.content_tools import (
    create_audio_content,
    create_image_content,
    create_text_content,
    create_video_content,
)


async def run_content_generation_agent(
    user_id: PydanticObjectId,
    prompt: str,
    title: Optional[str] = None,
    plan_id: Optional[PydanticObjectId] = None,
    plan_item_id: Optional[PydanticObjectId] = None,
    target_formats: Optional[List[ContentType]] = None,
) -> Tuple[Content, Prompt]:
    """Orchestrates content creation across text, image, audio, and video using LangChain tools and Groq.

    Saves sub-prompts in ContentDetail.script, local paths in ContentDetail.path,
    and text content in ContentDetail.text.
    """
    # Track as PLAN_ITEM if linked to a plan item, otherwise general CONTENT
    prompt_type = PromptType.PLAN_ITEM if plan_item_id else PromptType.CONTENT
    prompt_record = Prompt(
        user_id=user_id,
        plan_id=plan_id,
        plan_item_id=plan_item_id,
        type=prompt_type,
        prompt=prompt,
        model=settings.GROQ_MODEL,
        status=PromptStatus.STREAMING,
    )
    await prompt_record.insert()

    content_title = title or prompt[:60].strip().title()
    formats_to_create = target_formats or [
        ContentType.TEXT,
        ContentType.IMAGE,
        ContentType.AUDIO,
        ContentType.VIDEO,
    ]

    details: List[ContentDetail] = []
    order_idx = 1

    try:
        # Determine sub-prompts for each modality
        text_script = f"Comprehensive post on: {prompt}"
        image_script = f"Visual graphic banner representing: {prompt}"
        audio_script = f"Voiceover narration explaining: {prompt}"
        video_script = f"Video showcase summarizing: {prompt}"

        # If LangChain & Groq are configured with an API key, enhance generated text
        if settings.GROQ_API_KEY:
            try:
                from langchain_core.messages import HumanMessage
                from langchain_groq import ChatGroq

                llm = ChatGroq(
                    model=settings.GROQ_MODEL,
                    api_key=settings.GROQ_API_KEY,
                    temperature=0.7,
                )
                system_instruction = (
                    "You are an AI content creator. Given the user prompt, return a concise, high-converting social media post text."
                )
                response = await llm.ainvoke([HumanMessage(content=f"{system_instruction}\nTopic: {prompt}")])
                generated_text = response.content.strip()
            except Exception:
                generated_text = f"{content_title}\n\nKey insights on {prompt}. Stay tuned for more updates!"
        else:
            generated_text = f"{content_title}\n\n{prompt}\n\nProduced automatically by the Content Creation Agent."

        # Modality 1: TEXT
        if ContentType.TEXT in formats_to_create:
            details.append(
                ContentDetail(
                    type=ContentType.TEXT,
                    script=text_script,
                    text=generated_text,
                    order=order_idx,
                )
            )
            order_idx += 1

        # Modality 2: IMAGE
        if ContentType.IMAGE in formats_to_create:
            img_meta = create_image_content(prompt=image_script)
            details.append(
                ContentDetail(
                    type=ContentType.IMAGE,
                    script=image_script,
                    path=img_meta["path"],
                    mime_type=img_meta.get("mime_type"),
                    file_size_bytes=img_meta.get("file_size_bytes"),
                    dimensions=img_meta.get("dimensions"),
                    order=order_idx,
                )
            )
            order_idx += 1

        # Modality 3: AUDIO
        if ContentType.AUDIO in formats_to_create:
            audio_text = f"Welcome. Today we discuss {prompt}. Thank you for listening."
            audio_meta = create_audio_content(text_to_speak=audio_text)
            details.append(
                ContentDetail(
                    type=ContentType.AUDIO,
                    script=audio_script,
                    path=audio_meta["path"],
                    mime_type=audio_meta.get("mime_type"),
                    file_size_bytes=audio_meta.get("file_size_bytes"),
                    order=order_idx,
                )
            )
            order_idx += 1

        # Modality 4: VIDEO (All-in-one combining image and TTS audio via moviepy/ffmpeg)
        if ContentType.VIDEO in formats_to_create:
            vid_meta = create_video_content(
                prompt=video_script,
                visual_text=content_title,
                voiceover_text=f"Quick summary on {prompt}. Learn more in our latest update.",
            )
            details.append(
                ContentDetail(
                    type=ContentType.VIDEO,
                    script=video_script,
                    path=vid_meta["path"],
                    mime_type=vid_meta.get("mime_type"),
                    file_size_bytes=vid_meta.get("file_size_bytes"),
                    order=order_idx,
                )
            )
            order_idx += 1

        # 2. Save assembled Content document
        content = Content(
            user_id=user_id,
            title=content_title,
            details=details,
            status=ContentStatus.READY,
        )
        await content.insert()

        # Link content to PlanItem if requested
        if plan_item_id:
            plan_item = await PlanItem.get(plan_item_id)
            if plan_item and plan_item.user_id == user_id:
                plan_item.content_id = content.id
                plan_item.status = PlanItemStatus.READY
                plan_item.updated_at = datetime.now(timezone.utc)
                await plan_item.save()

        # 3. Update Prompt record status to DONE
        prompt_record.content_id = content.id
        prompt_record.status = PromptStatus.DONE
        prompt_record.response = f"Successfully generated {len(details)} content items ({', '.join(d.type.value for d in details)})."
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()

        return content, prompt_record

    except Exception as exc:
        prompt_record.status = PromptStatus.FAILED
        prompt_record.error = str(exc)
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()
        raise exc


async def run_plan_generation_agent(
    user_id: PydanticObjectId,
    idea: str,
    context: Optional[str] = None,
    number_of_content: int = 3,
    permission: str = "review_required",
) -> Tuple[Plan, List[PlanItem], Prompt]:
    """Generates an editorial campaign plan with item breakdown, logging a Prompt with type=PromptType.PLAN."""
    prompt_record = Prompt(
        user_id=user_id,
        type=PromptType.PLAN,
        prompt=f"Plan Idea: {idea}. Context: {context or 'None'}. Content Count: {number_of_content}",
        model=settings.GROQ_MODEL,
        status=PromptStatus.STREAMING,
    )
    await prompt_record.insert()

    try:
        plan = Plan(
            user_id=user_id,
            idea=idea,
            context=context,
            number_of_content=number_of_content,
            permission=permission,
            status=PlanStatus.READY,
        )
        await plan.insert()

        created_items: List[PlanItem] = []
        for i in range(1, number_of_content + 1):
            item_idea = f"{idea} - Part {i}: Key Insights & Practical Application"
            item = PlanItem(
                plan_id=plan.id,
                user_id=user_id,
                order=i,
                idea=item_idea,
                formats=[ContentType.TEXT, ContentType.IMAGE, ContentType.AUDIO, ContentType.VIDEO],
                status=PlanItemStatus.PENDING,
            )
            await item.insert()
            created_items.append(item)

        prompt_record.plan_id = plan.id
        prompt_record.status = PromptStatus.DONE
        prompt_record.response = f"Generated campaign plan '{idea}' with {len(created_items)} items."
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()

        return plan, created_items, prompt_record

    except Exception as exc:
        prompt_record.status = PromptStatus.FAILED
        prompt_record.error = str(exc)
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()
        raise exc
