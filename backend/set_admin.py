"""
Script to set a user as admin.
Usage: python set_admin.py <email>
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")
if not mongo_uri:
    print("ERROR: Missing MongoDB connection string. Set MONGO_URI.")
    sys.exit(1)

client = AsyncIOMotorClient(mongo_uri)
db_name = os.environ.get("DB_NAME", "guide2026")
db = client[db_name]

async def set_admin(email: str):
    """Set a user as admin by email."""
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        print(f"ERROR: User with email '{email}' not found.")
        return False
    
    user_id = user.get("id")
    current_role = user.get("role", "owner")
    
    if current_role == "admin":
        print(f"User {email} ({user_id}) is already an admin.")
        return True
    
    # Update user role to admin
    from datetime import datetime, timezone
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "role": "admin",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    print(f"✓ Successfully set user {email} ({user_id}) as admin.")
    print(f"  Previous role: {current_role}")
    print(f"  New role: admin")
    return True

async def main():
    if len(sys.argv) < 2:
        print("Usage: python set_admin.py <email>")
        print("Example: python set_admin.py k.ygs@icloud.com")
        sys.exit(1)
    
    email = sys.argv[1]
    await set_admin(email)
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
