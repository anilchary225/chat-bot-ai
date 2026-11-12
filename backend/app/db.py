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
    await database.agents.create_index("public_key", unique=True)
    await database.agents.create_index([("owner_id", 1), ("created_at", -1)])
    await database.agent_sources.create_index([("agent_id", 1), ("created_at", 1)])
    await database.agent_messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await database.agent_leads.create_index([("agent_id", 1), ("created_at", -1)])
    await database.agent_usage.create_index("day")
    await database.agent_rate.create_index("expires_at", expireAfterSeconds=0)
    await database.agent_cache.create_index("expires_at", expireAfterSeconds=0)
    await database.agent_cache.create_index("agent_id")
    await database.agent_emails.create_index([("agent_id", 1), ("created_at", -1)])
    await database.agent_unanswered.create_index([("agent_id", 1), ("status", 1), ("last_at", -1)])
    await database.agent_conversations.create_index([("agent_id", 1), ("created_at", -1)])
    await database.job_locks.create_index("created_at", expireAfterSeconds=24 * 3600)
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
