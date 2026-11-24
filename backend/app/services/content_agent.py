import asyncio
from datetime import datetime, timezone
from typing import List, Optional, Set, Tuple
from beanie import PydanticObjectId
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.campaign import Campaign
from app.models.content import Content, ContentDetail
from app.models.enums import CampaignStatus, ContentStatus, ContentType, PlanItemStatus, PlanStatus, PromptStatus, PromptType
from app.models.plan import Plan
from app.models.plan_item import PlanItem
from app.models.prompt import Prompt
from app.services.content_tools import (
    create_audio_content,
    create_image_content,
    create_text_content,
    create_video_content,
)


async def get_prompt_chain(parent_prompt_id: PydanticObjectId) -> List[Prompt]:
    """Traverses backward along parent_prompt_id links to return the prompt chain in chronological order."""
    chain: List[Prompt] = []
    curr_id: Optional[PydanticObjectId] = parent_prompt_id
    visited: Set[PydanticObjectId] = set()

    while curr_id and curr_id not in visited:
        visited.add(curr_id)
        prompt_doc = await Prompt.get(curr_id)
        if not prompt_doc or prompt_doc.deleted_at is not None:
            break
        chain.append(prompt_doc)
        curr_id = prompt_doc.parent_prompt_id

    chain.reverse()
    return chain


async def run_content_generation_agent(
    user_id: PydanticObjectId,
    prompt: str,
    title: Optional[str] = None,
    campaign_id: Optional[PydanticObjectId] = None,
    plan_id: Optional[PydanticObjectId] = None,
    plan_item_id: Optional[PydanticObjectId] = None,
    target_formats: Optional[List[ContentType]] = None,
    parent_prompt_id: Optional[PydanticObjectId] = None,
) -> Tuple[Content, Prompt]:
    """Orchestrates initial content creation across text, image, audio, and video using LangChain tools and Groq.

    Saves sub-prompts in ContentDetail.script, local paths in ContentDetail.path,
    and text content in ContentDetail.text.
    """
    target_plan_id = plan_item_id or plan_id
    prompt_type = PromptType.PLAN_ITEM if target_plan_id else PromptType.CONTENT
    prompt_record = Prompt(
        parent_prompt_id=parent_prompt_id,
        user_id=user_id,
        campaign_id=campaign_id or plan_id,
        plan_id=plan_id,
        plan_item_id=plan_item_id or plan_id,
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
    tokens_in = 0
    tokens_out = 0

    try:
        # Determine sub-prompts for each modality
        text_script = f"Comprehensive post on: {prompt}"
        image_script = f"Visual graphic banner representing: {prompt}"
        audio_script = f"Voiceover narration explaining: {prompt}"
        video_script = f"Video showcase summarizing: {prompt}"

        # If LangChain & Groq are configured with an API key, enhance generated text
        if settings.GROQ_API_KEY:
            try:
                from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
                from langchain_groq import ChatGroq

                llm = ChatGroq(
                    model=settings.GROQ_MODEL,
                    api_key=settings.GROQ_API_KEY,
                    temperature=0.7,
                )
                system_instruction = (
                    "You are an expert AI social media content creator. Given the user prompt, "
                    "return a concise, engaging, and high-converting social media post text with relevant formatting."
                )

                messages = [SystemMessage(content=system_instruction)]
                if parent_prompt_id:
                    history = await get_prompt_chain(parent_prompt_id)
                    for h in history:
                        messages.append(HumanMessage(content=h.prompt))
                        if h.response:
                            messages.append(AIMessage(content=h.response))
                messages.append(HumanMessage(content=f"Topic: {prompt}"))

                response = await llm.ainvoke(messages)
                generated_text = response.content.strip()
                if hasattr(response, "usage_metadata") and response.usage_metadata:
                    tokens_in = response.usage_metadata.get("input_tokens", 0)
                    tokens_out = response.usage_metadata.get("output_tokens", 0)
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
            img_meta = await asyncio.to_thread(create_image_content, prompt=image_script)
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
            audio_meta = await asyncio.to_thread(create_audio_content, text_to_speak=audio_text)
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
            vid_meta = await asyncio.to_thread(
                create_video_content,
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

        # Link content to Plan if requested
        if target_plan_id:
            plan_item = await Plan.get(target_plan_id)
            if plan_item and plan_item.user_id == user_id:
                plan_item.content_id = content.id
                plan_item.status = PlanStatus.READY
                plan_item.updated_at = datetime.now(timezone.utc)
                await plan_item.save()

        # 3. Update Prompt record status to DONE
        prompt_record.content_id = content.id
        prompt_record.status = PromptStatus.DONE
        prompt_record.response = generated_text
        prompt_record.tokens_in = tokens_in
        prompt_record.tokens_out = tokens_out
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()

        return content, prompt_record

    except Exception as exc:
        prompt_record.status = PromptStatus.FAILED
        prompt_record.error = str(exc)
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()
        raise exc


async def run_content_improvement_agent(
    user_id: PydanticObjectId,
    content_id: PydanticObjectId,
    instruction: str,
    target_formats: Optional[List[ContentType]] = None,
    parent_prompt_id: Optional[PydanticObjectId] = None,
) -> Tuple[Content, Prompt]:
    """Iteratively improves existing content by continuing the LangChain prompt chain.

    - Resolves prompt lineage using parent_prompt_id (or latest prompt linked to content_id).
    - Assembles multi-turn message history for ChatGroq (SystemMessage, HumanMessage, AIMessage).
    - Rewrites text and re-generates requested media assets (Pillow images, gTTS audio, MoviePy video).
    - Logs a child Prompt document maintaining prompt chain lineage and token counts.
    """
    content = await Content.get(content_id)
    if not content or content.deleted_at is not None or content.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found or unauthorized")

    # 1. Resolve parent prompt in the chain
    if parent_prompt_id:
        parent_prompt = await Prompt.find_one(
            Prompt.id == parent_prompt_id,
            Prompt.user_id == user_id,
            Prompt.deleted_at == None,
        )
        if not parent_prompt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent prompt not found")
    else:
        # Pick the most recent prompt for this content
        parent_prompt = await Prompt.find(
            Prompt.content_id == content_id,
            Prompt.user_id == user_id,
            Prompt.deleted_at == None,
        ).sort("-created_at").first_or_none()

    # 2. Reconstruct prompt history chain
    chain_history: List[Prompt] = []
    if parent_prompt:
        chain_history = await get_prompt_chain(parent_prompt.id)

    # 3. Insert new prompt document (STREAMING)
    prompt_record = Prompt(
        parent_prompt_id=parent_prompt.id if parent_prompt else None,
        user_id=user_id,
        content_id=content.id,
        type=parent_prompt.type if parent_prompt else PromptType.CONTENT,
        prompt=instruction,
        model=settings.GROQ_MODEL,
        status=PromptStatus.STREAMING,
    )
    await prompt_record.insert()

    try:
        tokens_in = 0
        tokens_out = 0
        prev_text = next((d.text for d in content.details if d.type == ContentType.TEXT and d.text), "")

        # 4. Invoke LangChain Groq with conversation history
        if settings.GROQ_API_KEY:
            try:
                from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
                from langchain_groq import ChatGroq

                llm = ChatGroq(
                    model=settings.GROQ_MODEL,
                    api_key=settings.GROQ_API_KEY,
                    temperature=0.7,
                )

                system_msg = SystemMessage(
                    content=(
                        "You are an expert AI content creator and copywriter. "
                        "The user wants to improve, refine, or revise an existing piece of social media content. "
                        "Carefully examine the previous conversation history and the existing draft, then apply all requested changes, "
                        "improvements, and tone adjustments. Output only the final revised, publish-ready content text."
                    )
                )

                messages = [system_msg]
                for p_hist in chain_history:
                    messages.append(HumanMessage(content=p_hist.prompt))
                    if p_hist.response:
                        messages.append(AIMessage(content=p_hist.response))

                # Add current improvement instruction
                messages.append(
                    HumanMessage(
                        content=f"Improvement Instruction: {instruction}\n\nCurrent Draft:\n{prev_text}"
                    )
                )

                response = await llm.ainvoke(messages)
                improved_text = response.content.strip()
                if hasattr(response, "usage_metadata") and response.usage_metadata:
                    tokens_in = response.usage_metadata.get("input_tokens", 0)
                    tokens_out = response.usage_metadata.get("output_tokens", 0)
            except Exception:
                improved_text = f"{content.title}\n\n[Improved Draft - {instruction}]\n\n{prev_text or 'Updated insights on ' + instruction}"
        else:
            improved_text = f"{content.title}\n\n[Improved Draft - {instruction}]\n\n{prev_text or 'Updated insights on ' + instruction}"

        # 5. Determine which formats to regenerate / update
        if target_formats:
            formats_to_update = set(target_formats)
        else:
            # Default to all formats present in the content, or at least TEXT
            formats_to_update = {d.type for d in content.details} or {ContentType.TEXT}

        existing_details_map = {d.type: d for d in content.details}

        # Modality 1: TEXT
        if ContentType.TEXT in formats_to_update:
            text_script = f"Improvement sub-prompt: {instruction}"
            if ContentType.TEXT in existing_details_map:
                existing_details_map[ContentType.TEXT].text = improved_text
                existing_details_map[ContentType.TEXT].script = text_script
            else:
                order_num = len(content.details) + 1
                content.details.append(
                    ContentDetail(
                        type=ContentType.TEXT,
                        script=text_script,
                        text=improved_text,
                        order=order_num,
                    )
                )

        # Modality 2: IMAGE
        if ContentType.IMAGE in formats_to_update:
            img_script = f"Refined graphic banner: {instruction}"
            img_meta = await asyncio.to_thread(create_image_content, prompt=img_script)
            if ContentType.IMAGE in existing_details_map:
                existing_details_map[ContentType.IMAGE].script = img_script
                existing_details_map[ContentType.IMAGE].path = img_meta["path"]
                existing_details_map[ContentType.IMAGE].mime_type = img_meta.get("mime_type")
                existing_details_map[ContentType.IMAGE].file_size_bytes = img_meta.get("file_size_bytes")
                existing_details_map[ContentType.IMAGE].dimensions = img_meta.get("dimensions")
            else:
                order_num = len(content.details) + 1
                content.details.append(
                    ContentDetail(
                        type=ContentType.IMAGE,
                        script=img_script,
                        path=img_meta["path"],
                        mime_type=img_meta.get("mime_type"),
                        file_size_bytes=img_meta.get("file_size_bytes"),
                        dimensions=img_meta.get("dimensions"),
                        order=order_num,
                    )
                )

        # Modality 3: AUDIO
        if ContentType.AUDIO in formats_to_update:
            audio_script = f"Refined voiceover: {instruction}"
            audio_meta = await asyncio.to_thread(
                create_audio_content,
                text_to_speak=improved_text[:400] if improved_text else f"Updated overview on {instruction}",
            )
            if ContentType.AUDIO in existing_details_map:
                existing_details_map[ContentType.AUDIO].script = audio_script
                existing_details_map[ContentType.AUDIO].path = audio_meta["path"]
                existing_details_map[ContentType.AUDIO].mime_type = audio_meta.get("mime_type")
                existing_details_map[ContentType.AUDIO].file_size_bytes = audio_meta.get("file_size_bytes")
            else:
                order_num = len(content.details) + 1
                content.details.append(
                    ContentDetail(
                        type=ContentType.AUDIO,
                        script=audio_script,
                        path=audio_meta["path"],
                        mime_type=audio_meta.get("mime_type"),
                        file_size_bytes=audio_meta.get("file_size_bytes"),
                        order=order_num,
                    )
                )

        # Modality 4: VIDEO
        if ContentType.VIDEO in formats_to_update:
            vid_script = f"Refined video reel: {instruction}"
            vid_meta = await asyncio.to_thread(
                create_video_content,
                prompt=vid_script,
                visual_text=content.title,
                voiceover_text=improved_text[:200] if improved_text else f"Quick update on {instruction}",
            )
            if ContentType.VIDEO in existing_details_map:
                existing_details_map[ContentType.VIDEO].script = vid_script
                existing_details_map[ContentType.VIDEO].path = vid_meta["path"]
                existing_details_map[ContentType.VIDEO].mime_type = vid_meta.get("mime_type")
                existing_details_map[ContentType.VIDEO].file_size_bytes = vid_meta.get("file_size_bytes")
            else:
                order_num = len(content.details) + 1
                content.details.append(
                    ContentDetail(
                        type=ContentType.VIDEO,
                        script=vid_script,
                        path=vid_meta["path"],
                        mime_type=vid_meta.get("mime_type"),
                        file_size_bytes=vid_meta.get("file_size_bytes"),
                        order=order_num,
                    )
                )

        content.updated_at = datetime.now(timezone.utc)
        await content.save()

        # Update Prompt record
        prompt_record.status = PromptStatus.DONE
        prompt_record.response = improved_text
        prompt_record.tokens_in = tokens_in
        prompt_record.tokens_out = tokens_out
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()

        return content, prompt_record

    except Exception as exc:
        prompt_record.status = PromptStatus.FAILED
        prompt_record.error = str(exc)
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()
        raise exc


async def run_campaign_generation_agent(
    user_id: PydanticObjectId,
    idea: str,
    title: Optional[str] = None,
    goal: Optional[str] = None,
    context: Optional[str] = None,
    number_of_content: int = 3,
    color_hash_code: Optional[str] = None,
    color_has_code: Optional[str] = None,
    permission: str = "review_required",
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Tuple[Campaign, List[Plan], Prompt]:
    """Generates an editorial campaign with plan breakdown, logging a Prompt with type=PromptType.CAMPAIGN."""
    resolved_color = color_hash_code or color_has_code
    prompt_record = Prompt(
        user_id=user_id,
        type=PromptType.CAMPAIGN,
        prompt=f"Campaign Idea: {idea}. Context: {context or 'None'}. Content Count: {number_of_content}",
        model=settings.GROQ_MODEL,
        status=PromptStatus.STREAMING,
    )
    await prompt_record.insert()

    try:
        campaign = Campaign(
            user_id=user_id,
            title=title or (idea[:60] if len(idea) > 60 else idea),
            idea=idea,
            goal=goal,
            context=context,
            number_of_content=number_of_content,
            color_hash_code=resolved_color,
            permission=permission,
            status=CampaignStatus.READY,
            start_date=start_date,
            end_date=end_date,
        )
        await campaign.insert()

        created_plans: List[Plan] = []
        for i in range(1, number_of_content + 1):
            item_idea = f"{idea} - Part {i}: Key Insights & Practical Application"
            plan = Plan(
                campaign_id=campaign.id,
                plan_id=campaign.id,
                user_id=user_id,
                order=i,
                idea=item_idea,
                formats=[ContentType.TEXT, ContentType.IMAGE, ContentType.AUDIO, ContentType.VIDEO],
                status=PlanStatus.PENDING,
            )
            await plan.insert()
            created_plans.append(plan)

        prompt_record.campaign_id = campaign.id
        prompt_record.plan_id = campaign.id
        prompt_record.status = PromptStatus.DONE
        prompt_record.response = f"Generated campaign '{idea}' with {len(created_plans)} plans."
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()

        return campaign, created_plans, prompt_record

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
    title: Optional[str] = None,
    goal: Optional[str] = None,
    color_hash_code: Optional[str] = None,
    color_has_code: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Tuple[Campaign, List[Plan], Prompt]:
    """Generates an editorial campaign plan with item breakdown, logging a Prompt with type=PromptType.PLAN."""
    resolved_color = color_hash_code or color_has_code
    prompt_record = Prompt(
        user_id=user_id,
        type=PromptType.PLAN,
        prompt=f"Plan Idea: {idea}. Context: {context or 'None'}. Content Count: {number_of_content}",
        model=settings.GROQ_MODEL,
        status=PromptStatus.STREAMING,
    )
    await prompt_record.insert()

    try:
        campaign = Campaign(
            user_id=user_id,
            title=title or (idea[:60] if len(idea) > 60 else idea),
            idea=idea,
            goal=goal,
            context=context,
            number_of_content=number_of_content,
            color_hash_code=resolved_color,
            permission=permission,
            status=CampaignStatus.READY,
            start_date=start_date,
            end_date=end_date,
        )
        await campaign.insert()

        created_items: List[Plan] = []
        for i in range(1, number_of_content + 1):
            item_idea = f"{idea} - Part {i}: Key Insights & Practical Application"
            item = Plan(
                campaign_id=campaign.id,
                plan_id=campaign.id,
                user_id=user_id,
                order=i,
                idea=item_idea,
                formats=[ContentType.TEXT, ContentType.IMAGE, ContentType.AUDIO, ContentType.VIDEO],
                status=PlanStatus.PENDING,
            )
            await item.insert()
            created_items.append(item)

        prompt_record.campaign_id = campaign.id
        prompt_record.plan_id = campaign.id
        prompt_record.status = PromptStatus.DONE
        prompt_record.response = f"Generated campaign plan '{idea}' with {len(created_items)} items."
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()

        return campaign, created_items, prompt_record

    except Exception as exc:
        prompt_record.status = PromptStatus.FAILED
        prompt_record.error = str(exc)
        prompt_record.updated_at = datetime.now(timezone.utc)
        await prompt_record.save()
        raise exc
