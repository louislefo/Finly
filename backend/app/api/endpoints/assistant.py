"""
Finly Local AI Assistant Endpoints
Routes for checking Ollama status, pulling lightweight models, streaming conversational responses, and vector index refreshing.
"""

import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.services.ollama_service import OllamaService
from app.services.llm_provider_service import LLMProviderService
from app.services.financial_vector_store import FinancialVectorStore
from app.services.assistant_prompts import build_system_prompt, get_default_quick_prompts

router = APIRouter()


class PullModelRequest(BaseModel):
    model_name: Optional[str] = "qwen2.5:1.5b"
    base_url: Optional[str] = None


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: 'system', 'user', or 'assistant'")
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[ChatMessage]] = []
    provider: Optional[str] = "ollama"
    model: Optional[str] = None
    stream: bool = True
    base_url: Optional[str] = None
    api_key: Optional[str] = None


class TestProviderRequest(BaseModel):
    provider: str = "ollama"
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


@router.get("/status")
def get_assistant_status(
    base_url: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the real-time status of the local Ollama instance, available models, and OS install guide.
    """
    if not settings.ENABLE_LOCAL_AI:
        return {
            "status": "disabled",
            "enabled": False,
            "message": "Local AI assistant is disabled in server configuration",
            "ollama": {
                "connected": False,
                "is_model_available": False,
                "models": [],
                "base_url": settings.OLLAMA_BASE_URL,
                "default_model": settings.OLLAMA_DEFAULT_MODEL,
                "fallback_model": settings.OLLAMA_FALLBACK_MODEL,
                "os": "unknown",
            },
            "install_guide": None,
        }

    status = OllamaService.check_status(base_url=base_url)
    install_guide = OllamaService.get_install_guide(os_name=status.get("os"))

    return {
        "status": "success",
        "enabled": True,
        "ollama": status,
        "install_guide": install_guide,
    }


@router.post("/start")
def start_assistant_daemon(
    current_user: User = Depends(get_current_user),
):
    """
    Attempts to start the local AI engine daemon process in the background.
    """
    if not settings.ENABLE_LOCAL_AI:
        raise HTTPException(status_code=403, detail="Local AI assistant is disabled in server configuration")
    return OllamaService.start_daemon()


@router.post("/setup")
def setup_pull_model(
    request: PullModelRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Streams progress updates while downloading / pulling the requested lightweight model.
    """
    if not settings.ENABLE_LOCAL_AI:
        raise HTTPException(status_code=403, detail="Local AI assistant is disabled in server configuration")
    model = request.model_name or "qwen2.5:1.5b"

    def progress_event_generator():
        for update in OllamaService.pull_model_stream(model_name=model, base_url=request.base_url):
            yield f"data: {json.dumps(update)}\n\n"

    return StreamingResponse(progress_event_generator(), media_type="text/event-stream")


@router.post("/chat")
def chat_with_assistant(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Executes a grounded financial conversation with the local AI assistant.
    """
    if not settings.ENABLE_LOCAL_AI:
        raise HTTPException(status_code=403, detail="Local AI assistant is disabled in server configuration")
    user_id = current_user.id if current_user else None

    # 1. Retrieve relevant financial facts using hybrid semantic vector search
    retrieved_context = FinancialVectorStore.retrieve_relevant_context(
        query=request.message,
        db=db,
        user_id=user_id,
        top_k=4,
    )

    # 2. Build structured system prompt
    system_prompt_content = build_system_prompt(retrieved_context)

    # 3. Assemble full message list
    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt_content}]

    # Append recent conversation history
    if request.conversation_history:
        for msg in request.conversation_history[-8:]:
            if msg.role in ["user", "assistant"]:
                messages.append({"role": msg.role, "content": msg.content})

    # Append current user prompt
    messages.append({"role": "user", "content": request.message})

    # 4. Stream response or return full JSON
    if request.stream:
        def chat_stream_generator():
            for chunk in LLMProviderService.stream_chat(
                messages=messages,
                provider=request.provider or "ollama",
                model=request.model,
                api_key=request.api_key,
                base_url=request.base_url,
            ):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

        return StreamingResponse(chat_stream_generator(), media_type="text/event-stream")
    else:
        # Non-streaming fallback
        full_text = "".join(list(LLMProviderService.stream_chat(
            messages=messages,
            provider=request.provider or "ollama",
            model=request.model,
            api_key=request.api_key,
            base_url=request.base_url,
        )))
        return {
            "status": "success",
            "response": full_text,
            "provider": request.provider or "ollama",
            "model": request.model or LLMProviderService.resolve_model(request.provider or "ollama", None),
        }


@router.post("/test-provider")
def test_provider_endpoint(
    request: TestProviderRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Tests cloud or local AI provider connection and API key validity.
    """
    return LLMProviderService.test_provider_credentials(
        provider=request.provider,
        api_key=request.api_key,
        model=request.model,
        base_url=request.base_url,
    )


@router.post("/engine/install")
def install_engine_endpoint(
    current_user: User = Depends(get_current_user),
):
    """
    Triggers or guides local AI engine installation on the host system.
    """
    return LLMProviderService.install_ollama_engine()


@router.get("/quick-prompts")
def get_quick_prompts(
    lang: Optional[str] = "fr",
    current_user: User = Depends(get_current_user),
):
    """
    Returns localized quick prompt chips for instant queries.
    """
    prompts = get_default_quick_prompts(language=lang or "fr")
    return {"status": "success", "prompts": prompts}


@router.post("/index/refresh")
def refresh_vector_index(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Rebuilds the local user financial context documents and returns document summary.
    """
    user_id = current_user.id if current_user else None
    docs = FinancialVectorStore.build_financial_context_documents(db, user_id=user_id)
    return {
        "status": "success",
        "documents_indexed": len(docs),
        "categories": [d["category"] for d in docs],
    }
