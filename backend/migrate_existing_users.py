"""
Migration script to assign Free plan to existing users who don't have a plan.

Run this script once to migrate existing users:
    python migrate_existing_users.py

Safe to run multiple times (idempotent).
"""

import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")
if not mongo_uri:
    raise RuntimeError("Missing MongoDB connection string. Set MONGO_URI.")

client = AsyncIOMotorClient(mongo_uri)
db_name = os.environ.get("DB_NAME", "guide2026")
db = client[db_name]

async def initialize_default_plans():
    """Initialize default plans if they don't exist."""
    plans = [
        {
            "id": "plan_free",
            "name": "free",
            "display_name": "Free",
            "max_workspaces": 1,
            "max_categories": 3,
            "max_walkthroughs": 5,
            "storage_bytes": 500 * 1024 * 1024,  # 500 MB
            "max_file_size_bytes": 10 * 1024 * 1024,  # 10 MB
            "extra_storage_increment_bytes": None,
            "is_public": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "plan_pro",
            "name": "pro",
            "display_name": "Pro",
            "max_workspaces": 3,
            "max_categories": None,  # unlimited
            "max_walkthroughs": None,  # unlimited
            "storage_bytes": 3 * 1024 * 1024 * 1024,  # 3 GB
            "max_file_size_bytes": 150 * 1024 * 1024,  # 150 MB
            "extra_storage_increment_bytes": 3 * 1024 * 1024 * 1024,  # 3 GB increments
            "is_public": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "plan_enterprise",
            "name": "enterprise",
            "display_name": "Enterprise",
            "max_workspaces": None,  # unlimited
            "max_categories": None,  # unlimited
            "max_walkthroughs": None,  # unlimited
            "storage_bytes": 200 * 1024 * 1024 * 1024,  # 200 GB
            "max_file_size_bytes": 500 * 1024 * 1024,  # 500 MB
            "extra_storage_increment_bytes": None,
            "is_public": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for plan_data in plans:
        existing = await db.plans.find_one({"id": plan_data["id"]})
        if not existing:
            await db.plans.insert_one(plan_data)
            print(f"✓ Initialized plan: {plan_data['name']}")
        else:
            print(f"  Plan already exists: {plan_data['name']}")

async def migrate_users():
    """Assign Free plan to all users who don't have a plan."""
    # Initialize plans first
    await initialize_default_plans()
    
    free_plan = await db.plans.find_one({"name": "free"}, {"_id": 0})
    if not free_plan:
        print("ERROR: Free plan not found after initialization")
        return
    
    # Find all users without a plan
    users_without_plan = await db.users.find({
        "$or": [
            {"plan_id": {"$exists": False}},
            {"plan_id": None}
        ]
    }).to_list(10000)
    
    print(f"\nFound {len(users_without_plan)} users without a plan")
    
    migrated = 0
    for user in users_without_plan:
        user_id = user['id']
        
        # Check if subscription already exists
        existing_sub = await db.subscriptions.find_one({
            "user_id": user_id,
            "status": "active"
        })
        
        if existing_sub:
            # Update user with existing subscription
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "subscription_id": existing_sub['id'],
                    "plan_id": existing_sub['plan_id']
                }}
            )
            print(f"  Updated user {user_id} with existing subscription")
            migrated += 1
        else:
            # Create new subscription
            subscription = {
                "id": f"sub_{user_id}",
                "user_id": user_id,
                "plan_id": free_plan['id'],
                "status": "active",
                "extra_storage_bytes": 0,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "cancelled_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.subscriptions.insert_one(subscription)
            
            # Update user
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "subscription_id": subscription['id'],
                    "plan_id": free_plan['id']
                }}
            )
            print(f"  ✓ Assigned Free plan to user: {user['email']} ({user_id})")
            migrated += 1
    
    print(f"\n✓ Migration complete: {migrated} users migrated")

async def main():
    print("Starting user migration...")
    print("=" * 50)
    await migrate_users()
    print("=" * 50)
    print("Migration finished!")

if __name__ == "__main__":
    asyncio.run(main())
