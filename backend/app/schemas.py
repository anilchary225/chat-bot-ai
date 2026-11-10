from pydantic import BaseModel, Field
from typing import Literal

class CreateChatRequest(BaseModel):
    title: str = Field(default="New chat", max_length=100)

class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=12000)

class ChatOut(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str

class MessageOut(BaseModel):
    id: str
    chat_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str
