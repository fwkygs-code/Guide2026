from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum
import shutil
import cloudinary
import cloudinary.uploader
import cloudinary.api

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")
if not mongo_uri:
    raise RuntimeError("Missing MongoDB connection string. Set MONGO_URI.")
client = AsyncIOMotorClient(mongo_uri)

db_name = os.environ.get("DB_NAME", "guide2026")
db = client[db_name]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 720

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Cloudinary Configuration (for persistent file storage)
# Falls back to local storage if Cloudinary is not configured
CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET')

USE_CLOUDINARY = all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET])

if USE_CLOUDINARY:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True  # Use HTTPS
    )
    logging.info("Cloudinary configured for persistent file storage")
else:
    logging.warning("Cloudinary not configured - using local storage (files will be lost on redeployment)")

# Mount uploads directory under /api/uploads (fallback for local storage)
UPLOAD_DIR = Path(os.environ.get('UPLOAD_DIR', str(ROOT_DIR / "uploads")))
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

# Enums
class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"

class Privacy(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    PASSWORD = "password"

class WalkthroughStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"

class NavigationType(str, Enum):
    NEXT_PREV = "next_prev"
    CHECKOFF = "checkoff"
    AUTO = "auto"

class NavigationPlacement(str, Enum):
    TOP = "top"
    BOTTOM = "bottom"
    FLOATING = "floating"

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkspaceCreate(BaseModel):
    name: str
    logo: Optional[str] = None
    brand_color: str = "#4f46e5"

class Workspace(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    logo: Optional[str] = None
    brand_color: str = "#4f46e5"
    owner_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkspaceMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    user_id: str
    role: UserRole
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    icon_url: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    icon_url: Optional[str] = None

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    icon_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommonProblem(BaseModel):
    title: str
    explanation: str
    media_url: Optional[str] = None
    link_type: Optional[str] = None
    link_value: Optional[str] = None

class Step(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    navigation_type: NavigationType = NavigationType.NEXT_PREV
    common_problems: List[CommonProblem] = []
    blocks: List[Dict[str, Any]] = []
    order: int

class WalkthroughCreate(BaseModel):
    title: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    category_ids: List[str] = []
    privacy: Privacy = Privacy.PUBLIC
    password: Optional[str] = None
    status: Optional[WalkthroughStatus] = None
    navigation_type: NavigationType = NavigationType.NEXT_PREV
    navigation_placement: NavigationPlacement = NavigationPlacement.BOTTOM

class Walkthrough(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    title: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    category_ids: List[str] = []
    privacy: Privacy = Privacy.PUBLIC
    password: Optional[str] = None
    status: WalkthroughStatus = WalkthroughStatus.DRAFT
    archived: bool = False
    archived_at: Optional[datetime] = None
    navigation_type: NavigationType = NavigationType.NEXT_PREV
    navigation_placement: NavigationPlacement = NavigationPlacement.BOTTOM
    steps: List[Step] = []
    version: int = 1
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StepCreate(BaseModel):
    title: str
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    navigation_type: NavigationType = NavigationType.NEXT_PREV
    order: Optional[int] = None
    common_problems: List[CommonProblem] = []
    blocks: List[Dict[str, Any]] = []

class AnalyticsEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    walkthrough_id: str
    event_type: str
    step_id: Optional[str] = None
    problem_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Feedback(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    walkthrough_id: str
    rating: str
    comment: Optional[str] = None
    hesitation_step: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StepsReorder(BaseModel):
    step_ids: List[str]

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def sanitize_public_walkthrough(w: dict) -> dict:
    """Remove sensitive/private fields from walkthrough docs returned to the public portal."""
    if not w:
        return w
    w = {k: v for k, v in w.items() if k != "_id"}
    # Never leak password material
    w.pop("password", None)
    w.pop("password_hash", None)
    # Never expose archived walkthroughs in public
    w.pop("archived", None)
    w.pop("archived_at", None)
    # CRITICAL: Ensure icon_url and blocks in steps are preserved (they're safe for public)
    # icon_url is already in the dict if it exists, no need to remove it
    # Ensure all steps have blocks array initialized
    if "steps" in w and isinstance(w["steps"], list):
        for step in w["steps"]:
            if "blocks" not in step:
                step["blocks"] = []
            elif step["blocks"] is None:
                step["blocks"] = []
    return w

def create_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

async def get_workspace_member(workspace_id: str, user_id: str):
    member = await db.workspace_members.find_one(
        {"workspace_id": workspace_id, "user_id": user_id},
        {"_id": 0}
    )
    return WorkspaceMember(**member) if member else None

def create_slug(name: str) -> str:
    return name.lower().replace(' ', '-').replace('_', '-')[:50]

# Auth Routes
@api_router.post("/auth/signup")
async def signup(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        name=user_data.name
    )
    user_dict = user.model_dump()
    user_dict['password'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    token = create_token(user.id)
    
    return {"user": user, "token": token}

@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc or not verify_password(login_data.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**{k: v for k, v in user_doc.items() if k != 'password'})
    token = create_token(user.id)
    
    return {"user": user, "token": token}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Workspace Routes
@api_router.post("/workspaces", response_model=Workspace)
async def create_workspace(workspace_data: WorkspaceCreate, current_user: User = Depends(get_current_user)):
    workspace = Workspace(
        name=workspace_data.name,
        slug=create_slug(workspace_data.name),
        logo=workspace_data.logo,
        brand_color=workspace_data.brand_color,
        owner_id=current_user.id
    )
    
    workspace_dict = workspace.model_dump()
    workspace_dict['created_at'] = workspace_dict['created_at'].isoformat()
    await db.workspaces.insert_one(workspace_dict)
    
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
        role=UserRole.OWNER
    )
    member_dict = member.model_dump()
    member_dict['joined_at'] = member_dict['joined_at'].isoformat()
    await db.workspace_members.insert_one(member_dict)
    
    return workspace

@api_router.get("/workspaces", response_model=List[Workspace])
async def get_workspaces(current_user: User = Depends(get_current_user)):
    members = await db.workspace_members.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)
    workspace_ids = [m['workspace_id'] for m in members]
    
    workspaces = await db.workspaces.find({"id": {"$in": workspace_ids}}, {"_id": 0}).to_list(100)
    return [Workspace(**w) for w in workspaces]

@api_router.get("/workspaces/{workspace_id}", response_model=Workspace)
async def get_workspace(workspace_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return Workspace(**workspace)

@api_router.put("/workspaces/{workspace_id}", response_model=Workspace)
async def update_workspace(workspace_id: str, workspace_data: WorkspaceCreate, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = workspace_data.model_dump()
    update_data['slug'] = create_slug(workspace_data.name)
    
    await db.workspaces.update_one(
        {"id": workspace_id},
        {"$set": update_data}
    )
    
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    return Workspace(**workspace)

# Category Routes
@api_router.post("/workspaces/{workspace_id}/categories", response_model=Category)
async def create_category(workspace_id: str, category_data: CategoryCreate, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    category = Category(
        workspace_id=workspace_id,
        name=category_data.name,
        description=category_data.description,
        parent_id=category_data.parent_id,
        icon_url=category_data.icon_url
    )
    
    category_dict = category.model_dump()
    category_dict['created_at'] = category_dict['created_at'].isoformat()
    await db.categories.insert_one(category_dict)
    
    return category

@api_router.get("/workspaces/{workspace_id}/categories", response_model=List[Category])
async def get_categories(workspace_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    categories = await db.categories.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(1000)
    return [Category(**c) for c in categories]

@api_router.put("/workspaces/{workspace_id}/categories/{category_id}", response_model=Category)
async def update_category(workspace_id: str, category_id: str, category_data: CategoryUpdate, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    category = await db.categories.find_one({"id": category_id, "workspace_id": workspace_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Build update dict with only provided fields
    update_dict = {}
    if category_data.name is not None:
        update_dict["name"] = category_data.name
    if category_data.description is not None:
        update_dict["description"] = category_data.description
    if category_data.parent_id is not None:
        update_dict["parent_id"] = category_data.parent_id
    if category_data.icon_url is not None:
        update_dict["icon_url"] = category_data.icon_url
    
    if update_dict:
        await db.categories.update_one(
            {"id": category_id, "workspace_id": workspace_id},
            {"$set": update_dict}
        )
        category.update(update_dict)
    
    return Category(**category)

@api_router.delete("/workspaces/{workspace_id}/categories/{category_id}")
async def delete_category(workspace_id: str, category_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    category = await db.categories.find_one({"id": category_id, "workspace_id": workspace_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Get all child categories
    child_categories = await db.categories.find({"parent_id": category_id, "workspace_id": workspace_id}, {"_id": 0}).to_list(1000)
    child_category_ids = [c["id"] for c in child_categories]
    all_category_ids = [category_id] + child_category_ids
    
    # Remove category_ids from walkthroughs (make them uncategorized)
    await db.walkthroughs.update_many(
        {"workspace_id": workspace_id, "category_ids": {"$in": all_category_ids}},
        {"$pull": {"category_ids": {"$in": all_category_ids}}}
    )
    
    # Delete child categories first
    if child_category_ids:
        await db.categories.delete_many({"id": {"$in": child_category_ids}, "workspace_id": workspace_id})
    
    # Delete the category itself
    await db.categories.delete_one({"id": category_id, "workspace_id": workspace_id})
    
    return {"message": "Category deleted. Walkthroughs are now uncategorized."}

# Walkthrough Routes
@api_router.post("/workspaces/{workspace_id}/walkthroughs", response_model=Walkthrough)
async def create_walkthrough(workspace_id: str, walkthrough_data: WalkthroughCreate, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Store password safely (hash only) if password-protected
    password_hash = None
    if walkthrough_data.privacy == Privacy.PASSWORD:
        if not walkthrough_data.password:
            raise HTTPException(status_code=400, detail="Password is required for password-protected walkthroughs")
        password_hash = hash_password(walkthrough_data.password)

    # CRITICAL: Preserve icon_url even if None
    icon_url = walkthrough_data.icon_url if walkthrough_data.icon_url is not None else None
    
    walkthrough = Walkthrough(
        workspace_id=workspace_id,
        title=walkthrough_data.title,
        description=walkthrough_data.description,
        icon_url=icon_url,  # Explicitly set, even if None
        category_ids=walkthrough_data.category_ids,
        privacy=walkthrough_data.privacy,
        password=None,
        status=walkthrough_data.status or WalkthroughStatus.DRAFT,
        navigation_type=walkthrough_data.navigation_type,
        navigation_placement=walkthrough_data.navigation_placement,
        created_by=current_user.id
    )
    
    walkthrough_dict = walkthrough.model_dump()
    if password_hash:
        walkthrough_dict["password_hash"] = password_hash
    walkthrough_dict['created_at'] = walkthrough_dict['created_at'].isoformat()
    walkthrough_dict['updated_at'] = walkthrough_dict['updated_at'].isoformat()
    await db.walkthroughs.insert_one(walkthrough_dict)
    
    return walkthrough

@api_router.get("/workspaces/{workspace_id}/walkthroughs", response_model=List[Walkthrough])
async def get_walkthroughs(workspace_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    walkthroughs = await db.walkthroughs.find(
        {"workspace_id": workspace_id, "archived": {"$ne": True}},
        {"_id": 0}
    ).to_list(1000)
    
    # CRITICAL: Ensure all walkthroughs have proper data structure
    for w in walkthroughs:
        # Ensure icon_url exists
        if "icon_url" not in w:
            w["icon_url"] = None
        # Ensure all steps have blocks array with proper structure
        if "steps" in w and isinstance(w["steps"], list):
            for step in w["steps"]:
                if "blocks" not in step or step["blocks"] is None:
                    step["blocks"] = []
                if not isinstance(step.get("blocks"), list):
                    step["blocks"] = []
                # CRITICAL: Ensure each block has proper structure (data, settings, type, id)
                for block in step["blocks"]:
                    if isinstance(block, dict):
                        if "data" not in block:
                            block["data"] = {}
                        if "settings" not in block:
                            block["settings"] = {}
                        if "type" not in block:
                            block["type"] = "text"
                        if "id" not in block:
                            block["id"] = str(uuid.uuid4())
    
    return [Walkthrough(**w) for w in walkthroughs]

@api_router.get("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}", response_model=Walkthrough)
async def get_walkthrough(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    walkthrough = await db.walkthroughs.find_one(
        {"id": walkthrough_id, "workspace_id": workspace_id, "archived": {"$ne": True}},
        {"_id": 0}
    )
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    
    # CRITICAL: Ensure icon_url exists
    if "icon_url" not in walkthrough:
        walkthrough["icon_url"] = None
    
    # CRITICAL: Ensure all steps have blocks array initialized with proper structure
    if "steps" in walkthrough and isinstance(walkthrough["steps"], list):
        for step in walkthrough["steps"]:
            if "blocks" not in step or step["blocks"] is None:
                step["blocks"] = []
            if not isinstance(step.get("blocks"), list):
                step["blocks"] = []
            # CRITICAL: Ensure each block has proper structure (data, settings, type, id)
            for block in step["blocks"]:
                if isinstance(block, dict):
                    if "data" not in block:
                        block["data"] = {}
                    if "settings" not in block:
                        block["settings"] = {}
                    if "type" not in block:
                        block["type"] = "text"
                    if "id" not in block:
                        block["id"] = str(uuid.uuid4())
    
    return Walkthrough(**walkthrough)

@api_router.put("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}", response_model=Walkthrough)
async def update_walkthrough(workspace_id: str, walkthrough_id: str, walkthrough_data: WalkthroughCreate, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    existing = await db.walkthroughs.find_one({"id": walkthrough_id, "workspace_id": workspace_id, "archived": {"$ne": True}}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Walkthrough not found")

    update_data = walkthrough_data.model_dump(exclude_none=True)
    
    # CRITICAL: Preserve icon_url if it's not being updated (don't overwrite with None)
    if "icon_url" not in update_data or update_data.get("icon_url") is None:
        # Only preserve existing icon_url if it's not being explicitly set
        if existing.get("icon_url"):
            update_data["icon_url"] = existing.get("icon_url")
        elif "icon_url" in update_data and update_data["icon_url"] is None:
            # Explicitly set to None only if it was None before
            pass  # Allow None if that's what was sent

    # Password handling: store hash only, never store plaintext.
    if update_data.get("privacy") == Privacy.PASSWORD or walkthrough_data.privacy == Privacy.PASSWORD:
        if walkthrough_data.password:
            update_data["password_hash"] = hash_password(walkthrough_data.password)
        # never store plaintext
        update_data.pop("password", None)
    else:
        # If changing away from password-protected, remove any password hash.
        update_data.pop("password", None)
        if update_data.get("privacy") and update_data.get("privacy") != Privacy.PASSWORD:
            update_data["password_hash"] = None

    # Versioning: create a snapshot on every publish action.
    # Any update that sets status=published creates a new version entry.
    is_publish_request = update_data.get("status") == WalkthroughStatus.PUBLISHED
    if is_publish_request:
        next_version = int(existing.get("version", 1)) + 1
        version_doc = {
            "id": str(uuid.uuid4()),
            "workspace_id": workspace_id,
            "walkthrough_id": walkthrough_id,
            "version": next_version,
            "created_by": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "snapshot": sanitize_public_walkthrough(existing) | {
                # snapshot should include private fields needed for rollback, but never password hash
                "privacy": existing.get("privacy"),
                "status": existing.get("status"),
                "icon_url": existing.get("icon_url"),  # CRITICAL: Preserve icon_url in snapshot
                "category_ids": existing.get("category_ids", []),
                "navigation_type": existing.get("navigation_type"),
                "navigation_placement": existing.get("navigation_placement"),
                "steps": existing.get("steps", []),  # Steps include blocks, so blocks are preserved
                "version": existing.get("version", 1),
            }
        }
        # Ensure we do not store password hash in version snapshot
        version_doc["snapshot"].pop("password_hash", None)
        version_doc["snapshot"].pop("password", None)
        await db.walkthrough_versions.insert_one(version_doc)
        update_data["version"] = next_version

    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.walkthroughs.update_one(
        {"id": walkthrough_id, "workspace_id": workspace_id, "archived": {"$ne": True}},
        {"$set": update_data}
    )
    
    walkthrough = await db.walkthroughs.find_one({"id": walkthrough_id}, {"_id": 0})
    return Walkthrough(**walkthrough)

@api_router.get("/workspaces/{workspace_id}/walkthroughs-archived", response_model=List[Walkthrough])
async def get_archived_walkthroughs(workspace_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    walkthroughs = await db.walkthroughs.find(
        {"workspace_id": workspace_id, "archived": True},
        {"_id": 0}
    ).to_list(1000)
    return [Walkthrough(**w) for w in walkthroughs]

@api_router.post("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/archive")
async def archive_walkthrough(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    res = await db.walkthroughs.update_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"$set": {"archived": True, "archived_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    return {"message": "Walkthrough archived"}

@api_router.post("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/restore")
async def restore_walkthrough(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    res = await db.walkthroughs.update_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"$set": {"archived": False, "archived_at": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    return {"message": "Walkthrough restored"}

@api_router.delete("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/permanent")
async def permanently_delete_walkthrough(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.walkthroughs.delete_one({"id": walkthrough_id, "workspace_id": workspace_id, "archived": True})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Archived walkthrough not found")
    return {"message": "Walkthrough permanently deleted"}

# Version History / Rollback
@api_router.get("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/versions")
async def list_walkthrough_versions(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    versions = await db.walkthrough_versions.find(
        {"workspace_id": workspace_id, "walkthrough_id": walkthrough_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return versions

@api_router.get("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/diagnose-blocks")
async def diagnose_blocks(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    """Diagnostic endpoint to check block data integrity"""
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    walkthrough = await db.walkthroughs.find_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"_id": 0}
    )
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    
    issues = []
    block_stats = {
        "total_blocks": 0,
        "image_blocks": 0,
        "image_blocks_with_url": 0,
        "image_blocks_without_url": 0,
        "blocks_by_step": []
    }
    
    for step in walkthrough.get("steps", []):
        step_id = step.get("id")
        blocks = step.get("blocks", []) or []
        step_stats = {
            "step_id": step_id,
            "step_title": step.get("title", "Untitled"),
            "total_blocks": len(blocks),
            "image_blocks": 0,
            "image_blocks_with_url": 0,
            "image_blocks_without_url": 0,
            "blocks_detail": []
        }
        
        for block in blocks:
            block_stats["total_blocks"] += 1
            block_id = block.get("id", "unknown")
            block_type = block.get("type", "unknown")
            
            if block_type == "image":
                block_stats["image_blocks"] += 1
                step_stats["image_blocks"] += 1
                
                block_data = block.get("data", {})
                block_url = block_data.get("url") if block_data else None
                
                block_detail = {
                    "block_id": block_id,
                    "has_data": bool(block_data),
                    "has_url": bool(block_url),
                    "url": block_url if block_url else None,
                    "url_length": len(block_url) if block_url else 0
                }
                
                if block_url:
                    block_stats["image_blocks_with_url"] += 1
                    step_stats["image_blocks_with_url"] += 1
                else:
                    block_stats["image_blocks_without_url"] += 1
                    step_stats["image_blocks_without_url"] += 1
                    issues.append({
                        "type": "missing_url",
                        "step_id": step_id,
                        "step_title": step.get("title", "Untitled"),
                        "block_id": block_id,
                        "block_data": block_data
                    })
                
                step_stats["blocks_detail"].append(block_detail)
        
        if step_stats["total_blocks"] > 0:
            block_stats["blocks_by_step"].append(step_stats)
    
    return {
        "walkthrough_id": walkthrough_id,
        "walkthrough_title": walkthrough.get("title", "Untitled"),
        "summary": block_stats,
        "issues": issues,
        "has_issues": len(issues) > 0
    }

@api_router.get("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/diagnose")
async def diagnose_walkthrough(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    """Diagnostic endpoint to check if blocks data exists in database or versions"""
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get current walkthrough from database (raw, no processing)
    walkthrough = await db.walkthroughs.find_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"_id": 0}
    )
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    
    # Check for blocks in current walkthrough
    current_blocks_found = []
    if "steps" in walkthrough and isinstance(walkthrough["steps"], list):
        for idx, step in enumerate(walkthrough["steps"]):
            blocks = step.get("blocks", [])
            if blocks and isinstance(blocks, list) and len(blocks) > 0:
                image_blocks = [b for b in blocks if b.get("type") == "image" and b.get("data", {}).get("url")]
                if image_blocks:
                    current_blocks_found.append({
                        "step_index": idx,
                        "step_id": step.get("id"),
                        "step_title": step.get("title"),
                        "image_count": len(image_blocks),
                        "image_urls": [b.get("data", {}).get("url") for b in image_blocks]
                    })
    
    # Check version snapshots for blocks
    versions = await db.walkthrough_versions.find(
        {"workspace_id": workspace_id, "walkthrough_id": walkthrough_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    version_blocks_found = []
    for version in versions:
        snapshot = version.get("snapshot", {})
        if "steps" in snapshot and isinstance(snapshot["steps"], list):
            version_images = []
            for idx, step in enumerate(snapshot["steps"]):
                blocks = step.get("blocks", [])
                if blocks and isinstance(blocks, list) and len(blocks) > 0:
                    image_blocks = [b for b in blocks if b.get("type") == "image" and b.get("data", {}).get("url")]
                    if image_blocks:
                        version_images.append({
                            "step_index": idx,
                            "step_id": step.get("id"),
                            "step_title": step.get("title"),
                            "image_count": len(image_blocks),
                            "image_urls": [b.get("data", {}).get("url") for b in image_blocks]
                        })
            if version_images:
                version_blocks_found.append({
                    "version": version.get("version"),
                    "created_at": version.get("created_at"),
                    "images": version_images,
                    "total_blocks_with_urls": sum(img.get("blocks_with_urls", 0) for img in version_images),
                    "total_empty_blocks": sum(len(img.get("empty_blocks", [])) for img in version_images)
                })
    
    return {
        "walkthrough_id": walkthrough_id,
        "current_version": walkthrough.get("version", 1),
        "current_blocks_status": {
            "has_blocks": len(current_blocks_found) > 0,
            "steps_with_images": current_blocks_found,
            "total_image_blocks": sum(s["image_count"] for s in current_blocks_found)
        },
        "version_snapshots_status": {
            "total_versions": len(versions),
            "versions_with_images": len(version_blocks_found),
            "version_details": version_blocks_found
        },
        "can_recover": len(version_blocks_found) > 0
    }

class RecoverBlocksRequest(BaseModel):
    version_number: Optional[int] = None

@api_router.post("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/recover-blocks")
async def recover_blocks_from_version(workspace_id: str, walkthrough_id: str, body: RecoverBlocksRequest = RecoverBlocksRequest(), current_user: User = Depends(get_current_user)):
    """Recover image blocks from a version snapshot and merge them into current walkthrough"""
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get current walkthrough
    walkthrough = await db.walkthroughs.find_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"_id": 0}
    )
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    
    # Extract version number from request body
    version_number = body.version_number if body else None
    
    # Find version to recover from
    if version_number:
        version = await db.walkthrough_versions.find_one(
            {"workspace_id": workspace_id, "walkthrough_id": walkthrough_id, "version": version_number},
            {"_id": 0}
        )
    else:
        # Use most recent version with images
        versions = await db.walkthrough_versions.find(
            {"workspace_id": workspace_id, "walkthrough_id": walkthrough_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Find first version with image blocks that have URLs
        version = None
        for v in versions:
            snapshot = v.get("snapshot", {})
            if "steps" in snapshot:
                # Check if any step has image blocks with URLs
                for step in snapshot.get("steps", []):
                    blocks = step.get("blocks", []) or []
                    for block in blocks:
                        if block.get("type") == "image":
                            block_url = block.get("data", {}).get("url")
                            # Check if URL exists and is not empty
                            if block_url and block_url.strip():
                                version = v
                                break
                    if version:
                        break
            if version:
                break
        
        if not version:
            raise HTTPException(status_code=404, detail="No version found with image blocks containing URLs. The snapshots may have been saved with empty image URLs. You may need to re-upload the images.")
    
    snapshot = version.get("snapshot", {})
    if not snapshot or "steps" not in snapshot:
        raise HTTPException(status_code=404, detail="Version snapshot has no steps")
    
    # Create step map for matching
    current_steps = {step.get("id"): step for step in walkthrough.get("steps", [])}
    snapshot_steps = {step.get("id"): step for step in snapshot.get("steps", [])}
    
    # Merge blocks from snapshot into current steps
    recovered_count = 0
    updated_steps = []
    import copy
    
    for step in walkthrough.get("steps", []):
        step_id = step.get("id")
        current_blocks = step.get("blocks", []) or []
        snapshot_step = snapshot_steps.get(step_id)
        
        if snapshot_step:
            snapshot_blocks = snapshot_step.get("blocks", []) or []
            # If current step has no blocks but snapshot has blocks, use snapshot blocks
            if (not current_blocks or len(current_blocks) == 0) and snapshot_blocks:
                step["blocks"] = copy.deepcopy(snapshot_blocks)
                recovered_count += len([b for b in snapshot_blocks if b.get("type") == "image" and b.get("data", {}).get("url")])
            # If current step has some blocks, merge/restore image blocks from snapshot
            elif current_blocks and snapshot_blocks:
                # Create a map of current blocks by ID
                current_block_map = {b.get("id"): b for b in current_blocks if b.get("id")}
                # For each snapshot block, restore data if current block is missing URL
                for snapshot_block in snapshot_blocks:
                    if snapshot_block.get("type") == "image":
                        block_id = snapshot_block.get("id")
                        snapshot_url = snapshot_block.get("data", {}).get("url")
                        
                        if block_id in current_block_map:
                            # Block exists - restore URL if missing
                            current_block = current_block_map[block_id]
                            current_url = current_block.get("data", {}).get("url")
                            
                            # If snapshot has URL and current doesn't, restore it
                            if snapshot_url and not current_url:
                                current_block["data"] = copy.deepcopy(snapshot_block.get("data", {}))
                                recovered_count += 1
                            # If both have URLs but current is empty string, restore from snapshot
                            elif snapshot_url and current_url == "":
                                current_block["data"] = copy.deepcopy(snapshot_block.get("data", {}))
                                recovered_count += 1
                        else:
                            # New block from snapshot - add it if it has a URL
                            if snapshot_url:
                                current_blocks.append(copy.deepcopy(snapshot_block))
                                recovered_count += 1
                step["blocks"] = current_blocks
        
        updated_steps.append(step)
    
    # Update walkthrough in database
    await db.walkthroughs.update_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"$set": {
            "steps": updated_steps,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": f"Recovered {recovered_count} image blocks from version {version.get('version')}",
        "recovered_count": recovered_count,
        "version_used": version.get("version"),
        "steps_updated": len([s for s in updated_steps if s.get("blocks")])
    }

@api_router.post("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/rollback/{version}")
async def rollback_walkthrough(workspace_id: str, walkthrough_id: str, version: int, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")

    v = await db.walkthrough_versions.find_one(
        {"workspace_id": workspace_id, "walkthrough_id": walkthrough_id, "version": version},
        {"_id": 0}
    )
    if not v or not v.get("snapshot"):
        raise HTTPException(status_code=404, detail="Version not found")

    snapshot = v["snapshot"].copy()  # Make a copy to avoid modifying the original
    # Never restore password hash from snapshots (password-protected walkthroughs must be reset explicitly)
    snapshot.pop("password_hash", None)
    snapshot.pop("password", None)
    snapshot["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # CRITICAL: Ensure icon_url is preserved from snapshot or existing walkthrough
    existing = await db.walkthroughs.find_one({"id": walkthrough_id}, {"_id": 0})
    if existing and "icon_url" in existing and snapshot.get("icon_url") is None:
        snapshot["icon_url"] = existing.get("icon_url")
    
    # CRITICAL: Ensure all steps have blocks array initialized in snapshot
    if "steps" in snapshot and isinstance(snapshot["steps"], list):
        for step in snapshot["steps"]:
            if "blocks" not in step or step["blocks"] is None:
                step["blocks"] = []
            if not isinstance(step.get("blocks"), list):
                step["blocks"] = []
    
    # CRITICAL: Ensure all steps have blocks array initialized during rollback
    if "steps" in snapshot and isinstance(snapshot["steps"], list):
        for step in snapshot["steps"]:
            if "blocks" not in step or step["blocks"] is None:
                step["blocks"] = []
            # Ensure blocks in steps are properly structured
            if not isinstance(step.get("blocks"), list):
                step["blocks"] = []
    
    # CRITICAL: Preserve icon_url if it exists in snapshot
    if "icon_url" not in snapshot:
        # Try to get from existing walkthrough if not in snapshot
        existing = await db.walkthroughs.find_one({"id": walkthrough_id, "workspace_id": workspace_id}, {"_id": 0})
        if existing and existing.get("icon_url"):
            snapshot["icon_url"] = existing.get("icon_url")

    await db.walkthroughs.update_one(
        {"id": walkthrough_id, "workspace_id": workspace_id, "archived": {"$ne": True}},
        {"$set": snapshot}
    )

    updated = await db.walkthroughs.find_one({"id": walkthrough_id, "workspace_id": workspace_id}, {"_id": 0})
    return Walkthrough(**updated)

# Backwards-compatible delete: archive instead of hard delete
@api_router.delete("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}")
async def delete_walkthrough(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    res = await db.walkthroughs.update_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"$set": {"archived": True, "archived_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    return {"message": "Walkthrough archived"}

# Step Routes
@api_router.post("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/steps")
async def add_step(workspace_id: str, walkthrough_id: str, step_data: StepCreate, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    walkthrough = await db.walkthroughs.find_one({"id": walkthrough_id, "workspace_id": workspace_id}, {"_id": 0})
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    
    steps = walkthrough.get('steps', [])
    insert_at = step_data.order if step_data.order is not None else len(steps)
    try:
        insert_at = int(insert_at)
    except Exception:
        insert_at = len(steps)
    insert_at = max(0, min(insert_at, len(steps)))

    # CRITICAL: Ensure blocks is always a list, never None
    blocks = step_data.blocks if step_data.blocks is not None else []
    if not isinstance(blocks, list):
        blocks = []
    
    # CRITICAL: Ensure each block has proper structure with data and settings
    import copy
    validated_blocks = copy.deepcopy(blocks)
    for block in validated_blocks:
        if isinstance(block, dict):
            # Ensure block has 'data' field
            if 'data' not in block:
                block['data'] = {}
            # Ensure block has 'settings' field
            if 'settings' not in block:
                block['settings'] = {}
            # Ensure block has 'type' field
            if 'type' not in block:
                block['type'] = 'text'
            # Ensure block has 'id' field
            if 'id' not in block:
                block['id'] = f"block-{uuid.uuid4()}"
    
    step = Step(
        title=step_data.title,
        content=step_data.content,
        media_url=step_data.media_url,
        media_type=step_data.media_type,
        navigation_type=step_data.navigation_type,
        common_problems=step_data.common_problems,
        blocks=validated_blocks,  # Always a list with proper structure
        order=insert_at
    )

    steps.insert(insert_at, step.model_dump())
    # Re-number orders
    for idx, s in enumerate(steps):
        s["order"] = idx

    await db.walkthroughs.update_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"$set": {"steps": steps, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return step

@api_router.put("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/steps/{step_id}")
async def update_step(workspace_id: str, walkthrough_id: str, step_id: str, step_data: StepCreate, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    walkthrough = await db.walkthroughs.find_one({"id": walkthrough_id, "workspace_id": workspace_id}, {"_id": 0})
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    
    steps = walkthrough.get('steps', [])
    step_index = next((i for i, s in enumerate(steps) if s['id'] == step_id), None)
    
    if step_index is None:
        raise HTTPException(status_code=404, detail="Step not found")
    
    # CRITICAL: Preserve blocks - ensure blocks array is always present
    # If blocks is explicitly provided (even if empty array), use it
    # If blocks is None, preserve existing blocks
    existing_blocks = steps[step_index].get('blocks', []) or []
    import copy
    import logging
    
    logger = logging.getLogger(__name__)
    logger.info(f"[update_step] Step {step_id}: Existing blocks count: {len(existing_blocks)}")
    
    if step_data.blocks is not None:
        # Blocks were explicitly provided - use them (even if empty array)
        # CRITICAL: Deep copy blocks to preserve all nested data (data.url, settings, etc.)
        new_blocks = copy.deepcopy(step_data.blocks) if isinstance(step_data.blocks, list) else []
        logger.info(f"[update_step] Step {step_id}: New blocks provided, count: {len(new_blocks)}")
        
        # Ensure each block has proper structure
        for block in new_blocks:
            if isinstance(block, dict):
                block_id = block.get('id', 'unknown')
                block_type = block.get('type', 'unknown')
                
                # Ensure block has 'data' field - CRITICAL: preserve existing data if block exists
                if 'data' not in block:
                    block['data'] = {}
                
                # If block exists in existing blocks, merge data to preserve URLs
                existing_block = next((b for b in existing_blocks if isinstance(b, dict) and b.get('id') == block.get('id')), None)
                
                if existing_block and isinstance(existing_block, dict):
                    existing_data = existing_block.get('data', {})
                    existing_url = existing_data.get('url') if existing_data else None
                    new_url = block.get('data', {}).get('url')
                    
                    # CRITICAL: If new block has URL, use it. Otherwise, preserve existing URL
                    if new_url:
                        logger.info(f"[update_step] Block {block_id} ({block_type}): New URL provided: {new_url}")
                        block['data'] = {**existing_data, **block.get('data', {})}
                    elif existing_url:
                        logger.info(f"[update_step] Block {block_id} ({block_type}): Preserving existing URL: {existing_url}")
                        block['data'] = {**existing_data, **block.get('data', {})}
                        block['data']['url'] = existing_url  # Explicitly preserve URL
                    else:
                        block['data'] = {**existing_data, **block.get('data', {})}
                    
                    # Ensure block has 'settings' field
                    if 'settings' not in block:
                        block['settings'] = existing_block.get('settings', {})
                    # Ensure block has 'type' field
                    if 'type' not in block:
                        block['type'] = existing_block.get('type', 'text')
                else:
                    # New block - ensure it has all required fields
                    if 'settings' not in block:
                        block['settings'] = {}
                    if 'type' not in block:
                        block['type'] = 'text'
                    
                    # Log new image blocks
                    if block.get('type') == 'image' and block.get('data', {}).get('url'):
                        logger.info(f"[update_step] New image block {block_id} with URL: {block['data']['url']}")
                    elif block.get('type') == 'image':
                        logger.warning(f"[update_step] New image block {block_id} has NO URL!")
                
                # Ensure block has 'id' field
                if 'id' not in block:
                    block['id'] = f"block-{uuid.uuid4()}"
    else:
        # Blocks were not provided - preserve existing blocks (deep copy to avoid reference issues)
        new_blocks = copy.deepcopy(existing_blocks)
        logger.info(f"[update_step] Step {step_id}: No blocks provided, preserving {len(new_blocks)} existing blocks")
    
    # Log final block state before saving
    image_blocks_with_urls = [b for b in new_blocks if isinstance(b, dict) and b.get('type') == 'image' and b.get('data', {}).get('url')]
    image_blocks_without_urls = [b for b in new_blocks if isinstance(b, dict) and b.get('type') == 'image' and not b.get('data', {}).get('url')]
    logger.info(f"[update_step] Step {step_id}: Final state - {len(image_blocks_with_urls)} image blocks with URLs, {len(image_blocks_without_urls)} without URLs")
    
    if image_blocks_without_urls:
        logger.warning(f"[update_step] Step {step_id}: WARNING - {len(image_blocks_without_urls)} image blocks missing URLs!")
        for block in image_blocks_without_urls:
            logger.warning(f"[update_step] Block {block.get('id')} missing URL: {block}")
    
    updated_step = {
        'title': step_data.title,
        'content': step_data.content,
        'media_url': step_data.media_url,
        'media_type': step_data.media_type,
        'navigation_type': step_data.navigation_type,
        'common_problems': [p.model_dump() for p in step_data.common_problems],
        'blocks': new_blocks  # Always ensure it's a list with proper structure
    }
    # Ensure blocks is always a list, never None
    if not isinstance(updated_step['blocks'], list):
        updated_step['blocks'] = []
    
    steps[step_index].update(updated_step)
    
    await db.walkthroughs.update_one(
        {"id": walkthrough_id},
        {"$set": {"steps": steps, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"[update_step] Step {step_id}: Successfully saved to database")
    return steps[step_index]

@api_router.delete("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/steps/{step_id}")
async def delete_step(workspace_id: str, walkthrough_id: str, step_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    walkthrough = await db.walkthroughs.find_one({"id": walkthrough_id, "workspace_id": workspace_id}, {"_id": 0})
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    
    steps = [s for s in walkthrough.get('steps', []) if s['id'] != step_id]
    
    await db.walkthroughs.update_one(
        {"id": walkthrough_id},
        {"$set": {"steps": steps, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Step deleted"}

@api_router.put("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/steps/reorder")
async def reorder_steps(workspace_id: str, walkthrough_id: str, body: StepsReorder, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")

    walkthrough = await db.walkthroughs.find_one({"id": walkthrough_id, "workspace_id": workspace_id, "archived": {"$ne": True}}, {"_id": 0})
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")

    steps = walkthrough.get("steps", [])
    step_map = {s["id"]: s for s in steps if "id" in s}
    # Only allow reordering of existing step ids
    ordered = [step_map[sid] for sid in body.step_ids if sid in step_map]
    
    # CRITICAL: Ensure all steps have blocks array before reordering with proper structure
    for step in ordered:
        if "blocks" not in step or step["blocks"] is None:
            step["blocks"] = []
        if not isinstance(step.get("blocks"), list):
            step["blocks"] = []
        # Ensure each block has proper structure
        for block in step["blocks"]:
            if isinstance(block, dict):
                if "data" not in block:
                    block["data"] = {}
                if "settings" not in block:
                    block["settings"] = {}
                if "type" not in block:
                    block["type"] = "text"
                if "id" not in block:
                    block["id"] = str(uuid.uuid4())
    
    if len(ordered) != len(steps):
        # If mismatch, keep any missing steps at the end (stable)
        missing = [s for s in steps if s.get("id") not in set(body.step_ids)]
        # CRITICAL: Ensure missing steps also have blocks array with proper structure
        for step in missing:
            if "blocks" not in step or step["blocks"] is None:
                step["blocks"] = []
            # Ensure each block has proper structure
            for block in step["blocks"]:
                if isinstance(block, dict):
                    if "data" not in block:
                        block["data"] = {}
                    if "settings" not in block:
                        block["settings"] = {}
                    if "type" not in block:
                        block["type"] = "text"
                    if "id" not in block:
                        block["id"] = str(uuid.uuid4())
        ordered.extend(missing)
        ordered.extend(missing)

    # Update order fields
    for idx, s in enumerate(ordered):
        s["order"] = idx

    await db.walkthroughs.update_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"$set": {"steps": ordered, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Steps reordered"}

# Public Portal Routes
@api_router.get("/portal/{slug}")
async def get_portal(slug: str):
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Portal not found")
    
    categories = await db.categories.find({"workspace_id": workspace['id']}, {"_id": 0}).to_list(1000)
    walkthroughs = await db.walkthroughs.find(
        {"workspace_id": workspace['id'], "status": "published", "privacy": {"$in": ["public", "password"]}, "archived": {"$ne": True}},
        {"_id": 0}
    ).to_list(1000)
    
    # CRITICAL: Ensure all walkthroughs have proper structure for embedding
    for w in walkthroughs:
        if "steps" in w and isinstance(w["steps"], list):
            for step in w["steps"]:
                if "blocks" not in step or step["blocks"] is None:
                    step["blocks"] = []
                if not isinstance(step.get("blocks"), list):
                    step["blocks"] = []
    
    return {
        "workspace": workspace,
        "categories": [Category(**c) for c in categories],
        "walkthroughs": [sanitize_public_walkthrough(w) for w in walkthroughs]
    }

@api_router.get("/portal/{slug}/walkthroughs/{walkthrough_id}")
async def get_public_walkthrough(slug: str, walkthrough_id: str):
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Portal not found")
    
    walkthrough = await db.walkthroughs.find_one(
        {"id": walkthrough_id, "workspace_id": workspace['id'], "status": "published", "archived": {"$ne": True}},
        {"_id": 0}
    )
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")

    # Public walkthrough access rules:
    # - public: allowed
    # - password: require password via access endpoint
    # - private: not allowed
    if walkthrough.get("privacy") == "private":
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    if walkthrough.get("privacy") == "password":
        raise HTTPException(status_code=401, detail="Password required")

    # CRITICAL: Ensure all steps have blocks array for embedding
    if "steps" in walkthrough and isinstance(walkthrough["steps"], list):
        for step in walkthrough["steps"]:
            if "blocks" not in step or step["blocks"] is None:
                step["blocks"] = []
            if not isinstance(step.get("blocks"), list):
                step["blocks"] = []

    return sanitize_public_walkthrough(walkthrough)

class WalkthroughPasswordAccess(BaseModel):
    password: str

@api_router.post("/portal/{slug}/walkthroughs/{walkthrough_id}/access")
async def access_password_walkthrough(slug: str, walkthrough_id: str, body: WalkthroughPasswordAccess):
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Portal not found")

    walkthrough = await db.walkthroughs.find_one(
        {"id": walkthrough_id, "workspace_id": workspace["id"], "status": "published", "archived": {"$ne": True}},
        {"_id": 0}
    )
    if not walkthrough or walkthrough.get("privacy") != "password":
        raise HTTPException(status_code=404, detail="Walkthrough not found")

    password_hash = walkthrough.get("password_hash")
    if not password_hash or not verify_password(body.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    return sanitize_public_walkthrough(walkthrough)

# Analytics Routes
@api_router.post("/analytics/event")
async def track_event(event: AnalyticsEvent):
    event_dict = event.model_dump()
    event_dict['timestamp'] = event_dict['timestamp'].isoformat()
    await db.analytics_events.insert_one(event_dict)
    return {"message": "Event tracked"}

@api_router.get("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/analytics")
async def get_analytics(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    events = await db.analytics_events.find({"walkthrough_id": walkthrough_id}, {"_id": 0}).to_list(10000)
    
    views = len([e for e in events if e['event_type'] == 'view'])
    starts = len([e for e in events if e['event_type'] == 'start'])
    completions = len([e for e in events if e['event_type'] == 'complete'])
    
    step_stats = {}
    for event in events:
        if event.get('step_id'):
            step_id = event['step_id']
            if step_id not in step_stats:
                step_stats[step_id] = {'views': 0, 'completions': 0}
            if event['event_type'] == 'step_view':
                step_stats[step_id]['views'] += 1
            elif event['event_type'] == 'step_complete':
                step_stats[step_id]['completions'] += 1
    
    return {
        "views": views,
        "starts": starts,
        "completions": completions,
        "completion_rate": (completions / starts * 100) if starts > 0 else 0,
        "step_stats": step_stats
    }

# Feedback Routes
@api_router.post("/feedback")
async def submit_feedback(feedback: Feedback):
    feedback_dict = feedback.model_dump()
    feedback_dict['timestamp'] = feedback_dict['timestamp'].isoformat()
    await db.feedback.insert_one(feedback_dict)
    return {"message": "Feedback submitted"}

@api_router.get("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/feedback")
async def get_feedback(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    feedback_list = await db.feedback.find({"walkthrough_id": walkthrough_id}, {"_id": 0}).to_list(1000)
    return feedback_list

# Media Upload Route
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    file_extension = Path(file.filename).suffix.lower()
    file_id = str(uuid.uuid4())
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Determine resource type based on file extension
    resource_type = "auto"  # Cloudinary auto-detects
    if file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']:
        resource_type = "image"
    elif file_extension in ['.mp4', '.webm', '.mov', '.avi', '.mkv']:
        resource_type = "video"
    elif file_extension in ['.pdf', '.doc', '.docx', '.txt']:
        resource_type = "raw"
    
    if USE_CLOUDINARY:
        # Upload to Cloudinary (persistent storage)
        try:
            # Upload file to Cloudinary
            upload_result = cloudinary.uploader.upload(
                file_content,
                public_id=file_id,
                resource_type=resource_type,
                folder="guide2026",  # Organize files in a folder
                overwrite=False,
                invalidate=True  # Invalidate CDN cache
            )
            
            # Return Cloudinary URL
            secure_url = upload_result.get('secure_url') or upload_result.get('url')
            return {
                "url": secure_url,
                "public_id": upload_result.get('public_id'),
                "format": upload_result.get('format'),
                "width": upload_result.get('width'),
                "height": upload_result.get('height'),
                "bytes": upload_result.get('bytes')
            }
        except Exception as e:
            logging.error(f"Cloudinary upload failed: {str(e)}")
            # Fallback to local storage if Cloudinary fails
            logging.warning("Falling back to local storage")
    
    # Fallback: Local storage (for development or if Cloudinary fails)
    file_path = UPLOAD_DIR / f"{file_id}{file_extension}"
    with file_path.open("wb") as buffer:
        buffer.write(file_content)
    
    # Return relative URL for local storage
    return {"url": f"/api/media/{file_id}{file_extension}"}

# Media serving route (fallback for local storage)
# Note: If using Cloudinary, files are served directly from Cloudinary CDN
# This route is only used for local storage fallback
@api_router.get("/media/{filename}")
async def get_media(filename: str):
    if USE_CLOUDINARY:
        # If Cloudinary is configured, try to serve from Cloudinary
        # This is a fallback - normally Cloudinary URLs are used directly
        try:
            public_id = filename.rsplit('.', 1)[0]  # Remove extension
            resource = cloudinary.api.resource(public_id)
            # Redirect to Cloudinary URL
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=resource.get('secure_url') or resource.get('url'))
        except Exception:
            # If not found in Cloudinary, try local storage
            pass
    
    # Local storage fallback
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

# Health check endpoint (no auth required)
# Available at both /health and /api/health for flexibility
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring and load balancers"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cloudinary_configured": USE_CLOUDINARY
    }

@api_router.get("/health")
async def health_check_api():
    """Health check endpoint under /api prefix"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cloudinary_configured": USE_CLOUDINARY
    }

# Include router
app.include_router(api_router)

# CORS
# IMPORTANT: If allow_credentials=True, you cannot use allow_origins=["*"].
# Render deployments often start with CORS_ORIGINS="*"; in that case we disable credentials.
raw_cors_origins = os.environ.get("CORS_ORIGINS", "*")
cors_origins = [o.strip() for o in raw_cors_origins.split(",") if o.strip()]
allow_all_origins = "*" in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_credentials=not allow_all_origins,
    allow_origins=["*"] if allow_all_origins else cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()