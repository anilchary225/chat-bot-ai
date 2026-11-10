from pymongo import AsyncMongoClient
from .config import settings

client: AsyncMongoClient | None = None
database = None

async def connect_db():
    global client, database
    client = AsyncMongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=8000,
    )
    await client.admin.command("ping")
    database = client[settings.mongodb_database]
    await database.chats.create_index("updated_at")
    await database.messages.create_index([("chat_id", 1), ("created_at", 1)])

async def close_db():
    global client, database
    if client:
        await client.close()
        client = None
        database = None

def get_db():
    if database is None:
        raise RuntimeError("Database is not connected")
    return database
