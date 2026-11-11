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
    await database.documents.create_index([("chat_id", 1), ("created_at", 1)])
    await database.chats.create_index("access_key")
    await database.chats.create_index([("owner_id", 1), ("updated_at", -1)])
    await database.users.create_index("email", unique=True)
    await database.users.create_index("google_sub", unique=True, sparse=True)
    await database.sessions.create_index("expires_at", expireAfterSeconds=0)
    await database.email_codes.create_index("expires_at", expireAfterSeconds=0)
    await database.channel_links.create_index("chat_id")
    await database.link_codes.create_index("expires_at", expireAfterSeconds=0)
    await database.channel_events.create_index("created_at", expireAfterSeconds=7 * 24 * 3600)

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
