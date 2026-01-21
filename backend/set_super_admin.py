#!/usr/bin/env python3
"""
Script to set a user as admin (with future super-admin support).
Usage: python set_super_admin.py email@example.com
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# MongoDB connection
MONGODB_URL = "mongodb+srv://dannyleybov:Aa123456@cluster0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "interguide"

async def set_admin(email: str):
    """Set user as admin by email."""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    try:
        # Find user
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if not user:
            print(f"[ERROR] User not found: {email}")
            return False
        
        # Check current role
        current_role = user.get('role', 'owner')
        print(f"[INFO] Current role: {current_role}")
        
        if current_role == 'admin':
            print(f"[SUCCESS] User {email} is already an admin!")
            return True
        
        # Update to admin role
        result = await db.users.update_one(
            {"email": email},
            {
                "$set": {
                    "role": "admin",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if result.modified_count > 0:
            print(f"[SUCCESS] Set {email} as admin!")
            print(f"   User ID: {user.get('id')}")
            print(f"   Name: {user.get('name')}")
            return True
        else:
            print(f"[WARN] No changes made")
            return False
            
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return False
    finally:
        client.close()

async def main():
    if len(sys.argv) < 2:
        print("Usage: python set_super_admin.py email@example.com")
        sys.exit(1)
    
    email = sys.argv[1]
    print(f"[START] Setting admin role for: {email}")
    print("-" * 50)
    
    success = await set_admin(email)
    
    if success:
        print("-" * 50)
        print("[SUCCESS] Done! User can now access /admin dashboard")
    else:
        print("-" * 50)
        print("[ERROR] Failed to set admin role")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
