"""
Migration script to create unique index on workspace_locks.workspace_id

This prevents race conditions where multiple locks can be created for the same workspace.

Run this once to create the index:
    python backend/create_workspace_lock_index.py

Or run manually in MongoDB shell:
    db.workspace_locks.createIndex({"workspace_id": 1}, {unique: true})
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

async def create_unique_index():
    """Create unique index on workspace_id in workspace_locks collection."""
    mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")
    if not mongo_uri:
        raise RuntimeError("Missing MongoDB connection string. Set MONGO_URI.")
    
    client = AsyncIOMotorClient(mongo_uri)
    db_name = os.environ.get("DB_NAME", "guide2026")
    db = client[db_name]
    
    try:
        # Create unique index on workspace_id
        # This ensures only one lock can exist per workspace, preventing race conditions
        result = await db.workspace_locks.create_index(
            [("workspace_id", 1)],
            unique=True,
            name="workspace_id_unique"
        )
        print(f"✅ Created unique index on workspace_locks.workspace_id: {result}")
        
        # Verify index was created
        indexes = await db.workspace_locks.list_indexes().to_list(10)
        print("\nCurrent indexes on workspace_locks:")
        for idx in indexes:
            print(f"  - {idx.get('name', 'unnamed')}: {idx.get('key', {})}")
        
    except Exception as e:
        if "duplicate key" in str(e).lower() or "E11000" in str(e):
            print("⚠️  Index already exists or duplicate keys found.")
            print("   If duplicate keys exist, you may need to clean them up first:")
            print("   db.workspace_locks.aggregate([{$group: {_id: '$workspace_id', count: {$sum: 1}}}, {$match: {count: {$gt: 1}}}])")
        else:
            print(f"❌ Failed to create index: {e}")
            raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_unique_index())
