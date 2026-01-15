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

# Mount uploads directory under /api/uploads
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

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

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
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
        parent_id=category_data.parent_id
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

    walkthrough = Walkthrough(
        workspace_id=workspace_id,
        title=walkthrough_data.title,
        description=walkthrough_data.description,
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

    # Versioning: when transitioning to published, snapshot the previous version and increment.
    becoming_published = update_data.get("status") == WalkthroughStatus.PUBLISHED and existing.get("status") != "published"
    if becoming_published:
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
                "category_ids": existing.get("category_ids", []),
                "navigation_type": existing.get("navigation_type"),
                "navigation_placement": existing.get("navigation_placement"),
                "steps": existing.get("steps", []),
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

    snapshot = v["snapshot"]
    # Never restore password hash from snapshots (password-protected walkthroughs must be reset explicitly)
    snapshot.pop("password_hash", None)
    snapshot.pop("password", None)
    snapshot["updated_at"] = datetime.now(timezone.utc).isoformat()

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

    step = Step(
        title=step_data.title,
        content=step_data.content,
        media_url=step_data.media_url,
        media_type=step_data.media_type,
        navigation_type=step_data.navigation_type,
        common_problems=step_data.common_problems,
        blocks=step_data.blocks,
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
    
    steps[step_index].update({
        'title': step_data.title,
        'content': step_data.content,
        'media_url': step_data.media_url,
        'media_type': step_data.media_type,
        'navigation_type': step_data.navigation_type,
        'common_problems': [p.model_dump() for p in step_data.common_problems],
        'blocks': step_data.blocks
    })
    
    await db.walkthroughs.update_one(
        {"id": walkthrough_id},
        {"$set": {"steps": steps, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
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
    if len(ordered) != len(steps):
        # If mismatch, keep any missing steps at the end (stable)
        missing = [s for s in steps if s.get("id") not in set(body.step_ids)]
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
    
    return {
        "workspace": workspace,
        "categories": categories,
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
    file_path = UPLOAD_DIR / f"{file_id}{file_extension}"
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Return relative URL
    return {"url": f"/api/media/{file_id}{file_extension}"}

# Media serving route
@api_router.get("/media/{filename}")
async def get_media(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

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
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()