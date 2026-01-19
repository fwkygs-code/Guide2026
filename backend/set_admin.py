"""
Script to set a user as admin.
Usage: 
  python set_admin.py <email>
  python set_admin.py <email> --mongo-uri <connection_string>
  MONGO_URI=<connection_string> python set_admin.py <email>
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection - check multiple sources
mongo_uri = None

# 1. Check command-line argument
if '--mongo-uri' in sys.argv:
    idx = sys.argv.index('--mongo-uri')
    if idx + 1 < len(sys.argv):
        mongo_uri = sys.argv[idx + 1]
        # Remove from sys.argv so it doesn't interfere with email parsing
        sys.argv.pop(idx)
        sys.argv.pop(idx)

# 2. Check environment variable
if not mongo_uri:
    mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")

# 3. Check .env file (already loaded by load_dotenv)
if not mongo_uri:
    mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")

if not mongo_uri:
    print("ERROR: Missing MongoDB connection string.")
    print("\nPlease provide MONGO_URI in one of these ways:")
    print("  1. Set environment variable: set MONGO_URI=<your_connection_string>")
    print("  2. Create backend/.env file with: MONGO_URI=<your_connection_string>")
    print("  3. Pass as argument: python set_admin.py <email> --mongo-uri <connection_string>")
    print("\nExample:")
    print('  python set_admin.py k.ygs@icloud.com --mongo-uri "mongodb+srv://user:pass@cluster.mongodb.net/dbname"')
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
