"""
Script to delete test users from the database.

Usage:
    python delete_test_users.py [options]

Options:
    --pattern PATTERN    Delete users whose email matches pattern (default: "test")
    --email EMAIL        Delete specific user by email
    --list               List users matching pattern without deleting
    --dry-run            Show what would be deleted without actually deleting
    --confirm            Required flag to actually perform deletion

Examples:
    # List all test users
    python delete_test_users.py --pattern test --list

    # Dry run to see what would be deleted
    python delete_test_users.py --pattern test --dry-run

    # Delete all users with "test" in email (requires --confirm)
    python delete_test_users.py --pattern test --confirm

    # Delete specific user by email
    python delete_test_users.py --email test_user@example.com --confirm
"""

import asyncio
import os
import sys
from dotenv import load_dotenv
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")
if not mongo_uri:
    raise RuntimeError("Missing MongoDB connection string. Set MONGO_URI.")

client = AsyncIOMotorClient(mongo_uri)
db_name = os.environ.get("DB_NAME", "guide2026")
db = client[db_name]

async def list_users(pattern=None, email=None):
    """List users matching the criteria."""
    query = {}
    if email:
        query["email"] = email
    elif pattern:
        query["email"] = {"$regex": pattern, "$options": "i"}
    
    users = await db.users.find(query, {"_id": 0, "id": 1, "email": 1, "name": 1, "created_at": 1, "plan_id": 1}).to_list(1000)
    return users

async def delete_user_data(user_id: str):
    """Delete all data associated with a user."""
    # Delete subscriptions
    await db.subscriptions.delete_many({"user_id": user_id})
    
    # Get all user's workspaces
    workspaces = await db.workspaces.find({"owner_id": user_id}, {"_id": 0, "id": 1}).to_list(1000)
    workspace_ids = [w["id"] for w in workspaces]
    
    # Delete walkthroughs in user's workspaces
    if workspace_ids:
        await db.walkthroughs.delete_many({"workspace_id": {"$in": workspace_ids}})
    
    # Delete categories in user's workspaces
    if workspace_ids:
        await db.categories.delete_many({"workspace_id": {"$in": workspace_ids}})
    
    # Delete workspaces
    await db.workspaces.delete_many({"owner_id": user_id})
    
    # Delete files
    await db.files.delete_many({"user_id": user_id})
    
    # Delete events
    if workspace_ids:
        await db.events.delete_many({"workspace_id": {"$in": workspace_ids}})
    
    # Delete feedback
    if workspace_ids:
        await db.feedback.delete_many({"workspace_id": {"$in": workspace_ids}})
    
    # Finally delete the user
    result = await db.users.delete_one({"id": user_id})
    return result.deleted_count > 0

async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Delete test users from the database")
    parser.add_argument("--pattern", type=str, help="Email pattern to match (case-insensitive)")
    parser.add_argument("--email", type=str, help="Specific email to delete")
    parser.add_argument("--list", action="store_true", help="List matching users without deleting")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted")
    parser.add_argument("--confirm", action="store_true", help="Confirm deletion (required for actual deletion)")
    
    args = parser.parse_args()
    
    if not args.list and not args.dry_run:
        if not args.confirm:
            print("ERROR: Deletion requires --confirm flag for safety.")
            print("Use --list to see what would be deleted, or --dry-run to preview.")
            sys.exit(1)
    
    if not args.pattern and not args.email:
        # Default to "test" pattern if nothing specified
        args.pattern = "test"
    
    # List matching users
    users = await list_users(pattern=args.pattern, email=args.email)
    
    if not users:
        print("No users found matching criteria.")
        return
    
    print(f"\nFound {len(users)} user(s) matching criteria:")
    print("-" * 80)
    for user in users:
        created_at = user.get('created_at', 'N/A')
        plan_id = user.get('plan_id', 'None')
        print(f"ID: {user['id']}")
        print(f"  Email: {user['email']}")
        print(f"  Name: {user.get('name', 'N/A')}")
        print(f"  Created: {created_at}")
        print(f"  Plan: {plan_id}")
        print()
    
    if args.list:
        print("(List only - no deletion performed)")
        return
    
    if args.dry_run:
        print("\nDRY RUN - No users were actually deleted.")
        print("Use --confirm flag to perform actual deletion.")
        return
    
    # Confirm deletion
    print(f"\n⚠️  WARNING: This will delete {len(users)} user(s) and ALL associated data!")
    print("This includes:")
    print("  - User account")
    print("  - All workspaces owned by user")
    print("  - All walkthroughs, categories, and content")
    print("  - All files and uploads")
    print("  - All subscriptions")
    print()
    
    response = input(f"Type 'DELETE {len(users)} USERS' to confirm: ")
    if response != f"DELETE {len(users)} USERS":
        print("Deletion cancelled.")
        return
    
    # Perform deletion
    print(f"\nDeleting {len(users)} user(s)...")
    deleted_count = 0
    failed_count = 0
    
    for user in users:
        user_id = user['id']
        email = user['email']
        try:
            success = await delete_user_data(user_id)
            if success:
                print(f"✓ Deleted user: {email}")
                deleted_count += 1
            else:
                print(f"✗ Failed to delete user: {email}")
                failed_count += 1
        except Exception as e:
            print(f"✗ Error deleting user {email}: {e}")
            failed_count += 1
    
    print(f"\n{'='*80}")
    print(f"Deletion complete: {deleted_count} deleted, {failed_count} failed")
    print(f"{'='*80}")

if __name__ == "__main__":
    asyncio.run(main())
