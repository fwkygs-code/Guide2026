from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, File as FastAPIFile, UploadFile, Request, Header, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
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

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"

class FileStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    FAILED = "failed"
    DELETING = "deleting"

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
    subscription_id: Optional[str] = None
    plan_id: Optional[str] = None  # Denormalized for performance
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkspaceCreate(BaseModel):
    name: str
    logo: Optional[str] = None
    brand_color: str = "#4f46e5"
    portal_background_url: Optional[str] = None
    portal_palette: Optional[Dict[str, str]] = None  # e.g., {"primary": "#3b82f6", "secondary": "#8b5cf6", "accent": "#10b981"}
    portal_links: Optional[List[Dict[str, str]]] = None  # e.g., [{"label": "Website", "url": "https://example.com"}, {"label": "Support", "url": "https://support.example.com"}]
    portal_phone: Optional[str] = None
    portal_working_hours: Optional[str] = None
    portal_whatsapp: Optional[str] = None

class Workspace(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    logo: Optional[str] = None
    brand_color: str = "#4f46e5"
    portal_background_url: Optional[str] = None
    portal_palette: Optional[Dict[str, str]] = None
    portal_links: Optional[List[Dict[str, str]]] = None
    portal_phone: Optional[str] = None
    portal_working_hours: Optional[str] = None
    portal_whatsapp: Optional[str] = None
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

# Subscription & Quota Models
class Plan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # "free", "pro", "enterprise"
    display_name: str  # "Free", "Pro", "Enterprise"
    max_workspaces: Optional[int] = None  # None = unlimited
    max_categories: Optional[int] = None
    max_walkthroughs: Optional[int] = None
    storage_bytes: int  # Total storage included in plan
    max_file_size_bytes: int  # Maximum size for individual files
    extra_storage_increment_bytes: Optional[int] = None  # 25GB increments, None if not available
    is_public: bool = True  # Enterprise plans are not publicly priced
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    plan_id: str
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    extra_storage_bytes: int = 0  # Additional storage beyond plan storage
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cancelled_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class File(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    workspace_id: str
    status: FileStatus = FileStatus.PENDING
    size_bytes: int  # Authoritative file size
    url: str  # Cloudinary URL or local path
    public_id: Optional[str] = None  # Cloudinary public_id for deletion
    resource_type: str  # "image", "video", "raw"
    idempotency_key: str  # Unique key for deduplication
    reference_type: Optional[str] = None  # "walkthrough_icon", "step_media", "block_image", "workspace_logo", etc.
    reference_id: Optional[str] = None  # walkthrough_id, step_id, block_id, etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = None

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

async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    """Optional authentication - returns user if token provided, None otherwise."""
    if not credentials:
        return None
    try:
        token = credentials.credentials
        payload = decode_token(token)
        user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
        return User(**user) if user else None
    except Exception:
        return None

async def get_workspace_member(workspace_id: str, user_id: str):
    member = await db.workspace_members.find_one(
        {"workspace_id": workspace_id, "user_id": user_id},
        {"_id": 0}
    )
    return WorkspaceMember(**member) if member else None

def create_slug(name: str) -> str:
    return name.lower().replace(' ', '-').replace('_', '-')[:50]

# Quota & Subscription Helper Functions
async def get_user_plan(user_id: str) -> Optional[Plan]:
    """Get user's current plan, defaulting to Free if none assigned."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return None
    
    plan_id = user.get('plan_id')
    if not plan_id:
        # Default to Free plan if no plan assigned
        free_plan = await db.plans.find_one({"name": "free"}, {"_id": 0})
        if free_plan:
            return Plan(**free_plan)
        return None
    
    plan = await db.plans.find_one({"id": plan_id}, {"_id": 0})
    return Plan(**plan) if plan else None

async def get_user_subscription(user_id: str) -> Optional[Subscription]:
    """Get user's active subscription."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return None
    
    subscription_id = user.get('subscription_id')
    if not subscription_id:
        return None
    
    subscription = await db.subscriptions.find_one(
        {"id": subscription_id, "status": SubscriptionStatus.ACTIVE},
        {"_id": 0}
    )
    return Subscription(**subscription) if subscription else None

async def get_user_storage_usage(user_id: str) -> int:
    """Calculate total storage used by user (only active files).
    Includes both File records and files from existing walkthroughs that don't have File records yet.
    """
    # Count storage from File records
    active_files = await db.files.find(
        {"user_id": user_id, "status": FileStatus.ACTIVE},
        {"size_bytes": 1, "url": 1}
    ).to_list(10000)
    
    file_storage = sum(file.get('size_bytes', 0) for file in active_files)
    tracked_urls = {file.get('url') for file in active_files if file.get('url')}
    
    # Also count storage from existing walkthroughs that don't have File records yet
    # Get all user's workspaces
    workspaces = await db.workspaces.find({"owner_id": user_id}, {"_id": 0, "id": 1}).to_list(1000)
    workspace_ids = [w["id"] for w in workspaces]
    
    if not workspace_ids:
        return file_storage
    
    # Get all walkthroughs in user's workspaces
    walkthroughs = await db.walkthroughs.find(
        {"workspace_id": {"$in": workspace_ids}},
        {"_id": 0, "icon_url": 1, "steps": 1}
    ).to_list(10000)
    
    # Extract all file URLs from walkthroughs
    untracked_urls = []
    for walkthrough in walkthroughs:
        # Walkthrough icon
        if walkthrough.get('icon_url') and walkthrough['icon_url'] not in tracked_urls:
            untracked_urls.append(walkthrough['icon_url'])
        
        # Step media and block images
        steps = walkthrough.get('steps', [])
        for step in steps:
            # Step media
            if step.get('media_url') and step['media_url'] not in tracked_urls:
                untracked_urls.append(step['media_url'])
            
            # Block images
            blocks = step.get('blocks', [])
            for block in blocks:
                if block.get('type') == 'image' and block.get('data', {}).get('url'):
                    url = block['data']['url']
                    if url not in tracked_urls:
                        untracked_urls.append(url)
    
    # Calculate storage for untracked files
    untracked_storage = 0
    if untracked_urls and USE_CLOUDINARY:
        # Try to get file sizes from Cloudinary
        for url in untracked_urls:
            # Only count files from our storage (Cloudinary or local), skip external URLs
            if 'res.cloudinary.com' in url:
                try:
                    # Extract public_id from URL
                    parts = url.split('/')
                    if 'upload' in parts:
                        upload_idx = parts.index('upload')
                        if upload_idx + 1 < len(parts):
                            public_id_part = parts[-1]
                            public_id = public_id_part.rsplit('.', 1)[0] if '.' in public_id_part else public_id_part
                            
                            # Try to get resource info from Cloudinary
                            try:
                                resource = cloudinary.api.resource(public_id)
                                file_size = resource.get('bytes', 0)
                                if file_size > 0:
                                    untracked_storage += file_size
                                else:
                                    # If size is 0 or missing, use small estimate
                                    if '.gif' in url.lower() or '/video/upload/' in url:
                                        untracked_storage += 1 * 1024 * 1024  # Estimate 1MB for GIFs/videos
                                    else:
                                        untracked_storage += 200 * 1024  # Estimate 200KB for images
                            except Exception as e:
                                # If can't get size from Cloudinary API, use small estimate
                                logging.warning(f"Could not get Cloudinary resource size for {public_id}: {str(e)}")
                                if '.gif' in url.lower() or '/video/upload/' in url:
                                    untracked_storage += 1 * 1024 * 1024  # Estimate 1MB for GIFs/videos
                                else:
                                    untracked_storage += 200 * 1024  # Estimate 200KB for images
                except Exception as e:
                    # If URL parsing fails, skip this URL (don't count it)
                    logging.warning(f"Could not parse Cloudinary URL {url}: {str(e)}")
            elif url.startswith('/api/media/'):
                # Local storage - use small estimate
                untracked_storage += 200 * 1024  # Estimate 200KB for local files
            # Skip external URLs (not from our storage) - they don't count toward quota
    
    return file_storage + untracked_storage

async def get_user_allowed_storage(user_id: str) -> int:
    """Get total storage allowed for user (plan storage + extra storage)."""
    subscription = await get_user_subscription(user_id)
    if not subscription:
        plan = await get_user_plan(user_id)
        if plan:
            return plan.storage_bytes
        # Default to Free plan storage if no plan
        return 500 * 1024 * 1024  # 500 MB
    
    plan = await db.plans.find_one({"id": subscription.plan_id}, {"_id": 0})
    if not plan:
        return 500 * 1024 * 1024  # Default to Free
    
    plan_storage = plan.get('storage_bytes', 0)
    extra_storage = subscription.extra_storage_bytes
    return plan_storage + extra_storage

async def get_workspace_count(user_id: str) -> int:
    """Count workspaces owned by user."""
    count = await db.workspaces.count_documents({"owner_id": user_id})
    return count

async def get_walkthrough_count(workspace_id: str) -> int:
    """Count non-archived walkthroughs in workspace."""
    count = await db.walkthroughs.count_documents({
        "workspace_id": workspace_id,
        "archived": {"$ne": True}
    })
    return count

async def get_category_count(workspace_id: str) -> int:
    """Count top-level categories in workspace (excludes sub-categories)."""
    # Only count categories without a parent_id (top-level categories)
    count = await db.categories.count_documents({
        "workspace_id": workspace_id,
        "$or": [
            {"parent_id": None},
            {"parent_id": ""},
            {"parent_id": {"$exists": False}}
        ]
    })
    return count

async def extract_file_urls_from_walkthrough(walkthrough: dict) -> List[str]:
    """Extract all file URLs from a walkthrough (for cascade deletion)."""
    urls = []
    
    # Walkthrough icon
    if walkthrough.get('icon_url'):
        urls.append(walkthrough['icon_url'])
    
    # Step media and block images
    steps = walkthrough.get('steps', [])
    for step in steps:
        # Step media
        if step.get('media_url'):
            urls.append(step['media_url'])
        
        # Block images
        blocks = step.get('blocks', [])
        for block in blocks:
            if block.get('type') == 'image' and block.get('data', {}).get('url'):
                urls.append(block['data']['url'])
    
    return urls

async def delete_files_by_urls(urls: List[str], user_id: str) -> int:
    """Delete files by their URLs (for cascade deletion). Returns count of deleted files."""
    if not urls:
        return 0
    
    deleted_count = 0
    for url in urls:
        # Find file record by URL
        file_record = await db.files.find_one(
            {"url": url, "user_id": user_id, "status": FileStatus.ACTIVE},
            {"_id": 0}
        )
        
        if file_record:
            # Delete file (idempotent)
            try:
                file_id = file_record['id']
                
                # Mark as deleting
                await db.files.update_one(
                    {"id": file_id},
                    {"$set": {
                        "status": FileStatus.DELETING,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Delete from object storage
                if USE_CLOUDINARY and file_record.get('public_id'):
                    try:
                        cloudinary.uploader.destroy(
                            file_record['public_id'],
                            resource_type=file_record.get('resource_type', 'auto')
                        )
                    except Exception as e:
                        logging.warning(f"Cloudinary deletion failed: {str(e)}")
                elif not USE_CLOUDINARY:
                    # Local storage deletion
                    try:
                        url_path = file_record.get('url', '')
                        if url_path.startswith('/api/media/'):
                            filename = url_path.replace('/api/media/', '')
                            file_path = UPLOAD_DIR / filename
                            if file_path.exists():
                                file_path.unlink()
                    except Exception as e:
                        logging.warning(f"Local file deletion failed: {str(e)}")
                
                # Mark as deleted
                await db.files.update_one(
                    {"id": file_id},
                    {"$set": {
                        "deleted_at": datetime.now(timezone.utc).isoformat(),
                        "status": "deleted",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                deleted_count += 1
            except Exception as e:
                logging.error(f"Failed to delete file {file_record.get('id')}: {str(e)}")
    
    return deleted_count

async def create_file_record_from_url(url: str, user_id: str, workspace_id: str, reference_type: str, reference_id: str) -> Optional[str]:
    """
    Lazy migration: Create file record from existing URL if it's an uploaded file.
    Returns file_id if record created, None if external URL.
    """
    if not url:
        return None
    
    # Check if URL is from our storage (Cloudinary or local)
    is_uploaded_file = False
    public_id = None
    
    if USE_CLOUDINARY:
        # Check if it's a Cloudinary URL
        if 'res.cloudinary.com' in url:
            is_uploaded_file = True
            # Extract public_id from URL
            try:
                # Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{transformations}/{public_id}.{format}
                parts = url.split('/')
                if 'upload' in parts:
                    upload_idx = parts.index('upload')
                    if upload_idx + 1 < len(parts):
                        # Get public_id (everything after upload, minus extension)
                        public_id_part = parts[-1]
                        public_id = public_id_part.rsplit('.', 1)[0] if '.' in public_id_part else public_id_part
            except Exception:
                pass
    else:
        # Check if it's a local storage URL
        if url.startswith('/api/media/'):
            is_uploaded_file = True
    
    if not is_uploaded_file:
        # External URL, don't create file record
        return None
    
    # Check if file record already exists
    existing = await db.files.find_one({"url": url, "user_id": user_id}, {"_id": 0})
    if existing:
        return existing['id']
    
    # Try to get file size from Cloudinary if possible
    size_bytes = 0
    if USE_CLOUDINARY and public_id:
        try:
            resource = cloudinary.api.resource(public_id)
            size_bytes = resource.get('bytes', 0)
        except Exception:
            # If can't get size, estimate or use 0 (will be recalculated)
            pass
    
    # Create file record (status=active since file already exists)
    file_id = str(uuid.uuid4())
    file_record = File(
        id=file_id,
        user_id=user_id,
        workspace_id=workspace_id,
        status=FileStatus.ACTIVE,
        size_bytes=size_bytes,
        url=url,
        public_id=public_id,
        resource_type="image",  # Default, could be improved
        idempotency_key=f"migrated_{url}_{user_id}",  # Unique key for migration
        reference_type=reference_type,
        reference_id=reference_id
    )
    
    file_dict = file_record.model_dump()
    file_dict['created_at'] = file_dict['created_at'].isoformat()
    file_dict['updated_at'] = file_dict['updated_at'].isoformat()
    
    await db.files.insert_one(file_dict)
    logging.info(f"Created file record for migrated URL: {url}")
    
    return file_id

async def initialize_default_plans():
    """Initialize default plans if they don't exist."""
    plans = [
        {
            "id": "plan_free",
            "name": "free",
            "display_name": "Free",
            "max_workspaces": 1,
            "max_categories": 3,
            "max_walkthroughs": 10,
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
            "storage_bytes": 25 * 1024 * 1024 * 1024,  # 25 GB
            "max_file_size_bytes": 150 * 1024 * 1024,  # 150 MB
            "extra_storage_increment_bytes": 25 * 1024 * 1024 * 1024,  # 25 GB increments
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
            "max_file_size_bytes": 500 * 1024 * 1024,  # 500 MB (customizable)
            "extra_storage_increment_bytes": None,  # Custom pricing
            "is_public": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for plan_data in plans:
        existing = await db.plans.find_one({"id": plan_data["id"]})
        if not existing:
            await db.plans.insert_one(plan_data)
            logging.info(f"Initialized plan: {plan_data['name']}")

async def assign_free_plan_to_user(user_id: str):
    """Assign Free plan to user if they don't have one."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or user.get('plan_id'):
        return  # User already has a plan
    
    free_plan = await db.plans.find_one({"name": "free"}, {"_id": 0})
    if not free_plan:
        await initialize_default_plans()
        free_plan = await db.plans.find_one({"name": "free"}, {"_id": 0})
        if not free_plan:
            logging.error("Failed to initialize Free plan")
            return
    
    # Create subscription
    subscription = Subscription(
        user_id=user_id,
        plan_id=free_plan['id'],
        status=SubscriptionStatus.ACTIVE
    )
    subscription_dict = subscription.model_dump()
    subscription_dict['started_at'] = subscription_dict['started_at'].isoformat()
    subscription_dict['created_at'] = subscription_dict['created_at'].isoformat()
    subscription_dict['updated_at'] = subscription_dict['updated_at'].isoformat()
    
    await db.subscriptions.insert_one(subscription_dict)
    
    # Update user
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "subscription_id": subscription.id,
            "plan_id": free_plan['id']
        }}
    )
    logging.info(f"Assigned Free plan to user: {user_id}")

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
    
    # Initialize plans (but don't auto-assign - user will choose)
    await initialize_default_plans()
    # Note: Plan will be assigned when user selects one via plan selection modal
    
    token = create_token(user.id)
    
    return {"user": user, "token": token, "plan_selection_required": True}

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
    # Ensure user has a plan assigned
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not user_doc.get('plan_id'):
        await assign_free_plan_to_user(current_user.id)
        # Refresh user data
        user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    return User(**user_doc)

# Workspace Routes
@api_router.post("/workspaces", response_model=Workspace)
async def create_workspace(workspace_data: WorkspaceCreate, current_user: User = Depends(get_current_user)):
    # Check workspace count limit
    plan = await get_user_plan(current_user.id)
    if not plan:
        raise HTTPException(status_code=400, detail="User has no plan assigned")
    
    workspace_count = await get_workspace_count(current_user.id)
    if plan.max_workspaces is not None and workspace_count >= plan.max_workspaces:
        raise HTTPException(
            status_code=402,
            detail=f"Workspace limit reached. Current: {workspace_count}, Limit: {plan.max_workspaces} for your plan"
        )
    
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
    
    # Lazy migration: Create file records for logo and background if uploaded files
    if workspace.logo:
        await create_file_record_from_url(
            workspace.logo,
            current_user.id,
            workspace.id,
            "workspace_logo",
            workspace.id
        )
    if workspace_data.portal_background_url:
        await create_file_record_from_url(
            workspace_data.portal_background_url,
            current_user.id,
            workspace.id,
            "workspace_background",
            workspace.id
        )
    
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
    
    # Check category count limit
    plan = await get_user_plan(current_user.id)
    if not plan:
        raise HTTPException(status_code=400, detail="User has no plan assigned")
    
    category_count = await get_category_count(workspace_id)
    if plan.max_categories is not None and category_count >= plan.max_categories:
        raise HTTPException(
            status_code=402,
            detail=f"Category limit reached. Current: {category_count}, Limit: {plan.max_categories} for your plan"
        )
    
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
    
    # Check walkthrough count limit
    plan = await get_user_plan(current_user.id)
    if not plan:
        raise HTTPException(status_code=400, detail="User has no plan assigned")
    
    walkthrough_count = await get_walkthrough_count(workspace_id)
    if plan.max_walkthroughs is not None and walkthrough_count >= plan.max_walkthroughs:
        raise HTTPException(
            status_code=402,
            detail=f"Walkthrough limit reached. Current: {walkthrough_count}, Limit: {plan.max_walkthroughs} for your plan"
        )
    
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
    
    # Lazy migration: Create file record for icon_url if it's an uploaded file
    if walkthrough.icon_url:
        await create_file_record_from_url(
            walkthrough.icon_url,
            current_user.id,
            workspace_id,
            "walkthrough_icon",
            walkthrough.id
        )
    
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
        
        # Auto-cleanup: Keep only the last 3 versions
        all_versions = await db.walkthrough_versions.find(
            {"workspace_id": workspace_id, "walkthrough_id": walkthrough_id},
            {"_id": 0, "version": 1, "created_at": 1}
        ).sort("created_at", -1).to_list(100)
        
        if len(all_versions) > 3:
            # Keep the 3 most recent versions
            versions_to_keep = [v["version"] for v in all_versions[:3]]
            # Delete older versions
            await db.walkthrough_versions.delete_many({
                "workspace_id": workspace_id,
                "walkthrough_id": walkthrough_id,
                "version": {"$nin": versions_to_keep}
            })
            logger.info(f"Auto-cleaned up versions for walkthrough {walkthrough_id}: kept {len(versions_to_keep)}, deleted {len(all_versions) - len(versions_to_keep)}")

    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.walkthroughs.update_one(
        {"id": walkthrough_id, "workspace_id": workspace_id, "archived": {"$ne": True}},
        {"$set": update_data}
    )
    
    # Lazy migration: Create file record for icon_url if it's an uploaded file and changed
    if "icon_url" in update_data and update_data.get("icon_url"):
        await create_file_record_from_url(
            update_data["icon_url"],
            current_user.id,
            workspace_id,
            "walkthrough_icon",
            walkthrough_id
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
    
    # Get walkthrough before deletion (for cascade file deletion)
    walkthrough = await db.walkthroughs.find_one(
        {"id": walkthrough_id, "workspace_id": workspace_id, "archived": True},
        {"_id": 0}
    )
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Archived walkthrough not found")
    
    # Cascade delete: Find and delete all associated files
    file_urls = await extract_file_urls_from_walkthrough(walkthrough)
    deleted_files_count = await delete_files_by_urls(file_urls, current_user.id)
    
    # Delete walkthrough
    result = await db.walkthroughs.delete_one({"id": walkthrough_id, "workspace_id": workspace_id, "archived": True})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Archived walkthrough not found")
    
    return {
        "message": "Walkthrough permanently deleted",
        "files_deleted": deleted_files_count
    }

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

@api_router.delete("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/versions/{version}")
async def delete_walkthrough_version(workspace_id: str, walkthrough_id: str, version: int, current_user: User = Depends(get_current_user)):
    """Delete a specific version"""
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if version exists
    version_doc = await db.walkthrough_versions.find_one(
        {"workspace_id": workspace_id, "walkthrough_id": walkthrough_id, "version": version},
        {"_id": 0}
    )
    if not version_doc:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Don't allow deleting if it's the only version
    version_count = await db.walkthrough_versions.count_documents(
        {"workspace_id": workspace_id, "walkthrough_id": walkthrough_id}
    )
    if version_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only remaining version")
    
    # Delete the version
    result = await db.walkthrough_versions.delete_one(
        {"workspace_id": workspace_id, "walkthrough_id": walkthrough_id, "version": version}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Version not found")
    
    return {"message": f"Version {version} deleted successfully"}

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
    """
    Archive walkthrough (soft delete).
    Files are NOT deleted on archive, only on permanent deletion.
    """
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
    
    # Lazy migration: Create file records for step media and block images
    if step_data.media_url:
        await create_file_record_from_url(
            step_data.media_url,
            current_user.id,
            workspace_id,
            "step_media",
            step_data.id if hasattr(step_data, 'id') else None
        )
    
    # Track block images
    if step_data.blocks:
        for block in step_data.blocks:
            if block.get('type') == 'image' and block.get('data', {}).get('url'):
                await create_file_record_from_url(
                    block['data']['url'],
                    current_user.id,
                    workspace_id,
                    "block_image",
                    block.get('id')
                )
    
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
    
    # Lazy migration: Create file records for step media and block images before update
    if step_data.media_url:
        await create_file_record_from_url(
            step_data.media_url,
            current_user.id,
            workspace_id,
            "step_media",
            step_id
        )
    
    # Track block images
    if step_data.blocks:
        for block in step_data.blocks:
            if block.get('type') == 'image' and block.get('data', {}).get('url'):
                await create_file_record_from_url(
                    block['data']['url'],
                    current_user.id,
                    workspace_id,
                    "block_image",
                    block.get('id')
                )
    
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
    
    # Ensure workspace has portal branding fields initialized
    if "logo" not in workspace:
        workspace["logo"] = None
    if "portal_background_url" not in workspace:
        workspace["portal_background_url"] = None
    if "portal_palette" not in workspace:
        workspace["portal_palette"] = None
    if "portal_links" not in workspace:
        workspace["portal_links"] = None
    if "portal_phone" not in workspace:
        workspace["portal_phone"] = None
    if "portal_working_hours" not in workspace:
        workspace["portal_working_hours"] = None
    if "portal_whatsapp" not in workspace:
        workspace["portal_whatsapp"] = None
    
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

# Media Upload Route - Two-Phase Commit with Quota Enforcement
@api_router.post("/upload")
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    workspace_id: Optional[str] = Header(None, alias="X-Workspace-Id"),
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    reference_type: Optional[str] = Header(None, alias="X-Reference-Type"),
    reference_id: Optional[str] = Header(None, alias="X-Reference-Id"),
    current_user: User = Depends(get_current_user)
):
    """
    Upload file with quota enforcement and two-phase commit.
    
    Two-phase commit:
    1. Create file record in DB with status=pending (reserves quota)
    2. Upload to object storage
    3. Update file record to status=active on success, or status=failed on failure
    
    Idempotent: If idempotency_key provided and file exists, returns existing file.
    """
    # Generate idempotency key if not provided
    if not idempotency_key:
        idempotency_key = str(uuid.uuid4())
    
    # Check for existing file with same idempotency key (idempotency check)
    existing_file = await db.files.find_one(
        {"idempotency_key": idempotency_key, "user_id": current_user.id},
        {"_id": 0}
    )
    if existing_file:
        if existing_file.get('status') == FileStatus.ACTIVE:
            # Return existing file
            return {
                "file_id": existing_file['id'],
                "url": existing_file['url'],
                "size_bytes": existing_file['size_bytes'],
                "status": "existing"
            }
        elif existing_file.get('status') == FileStatus.PENDING:
            # Upload in progress, return pending status
            raise HTTPException(
                status_code=409,
                detail="Upload already in progress with this idempotency key"
            )
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Get user's plan and check file size limit
    plan = await get_user_plan(current_user.id)
    if not plan:
        raise HTTPException(status_code=400, detail="User has no plan assigned")
    
    # Check file size limit
    if file_size > plan.max_file_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File size ({file_size} bytes) exceeds maximum allowed ({plan.max_file_size_bytes} bytes) for your plan"
        )
    
    # Get workspace_id from request or use first workspace if not provided
    if not workspace_id:
        # Get user's first workspace (for backward compatibility)
        workspace = await db.workspaces.find_one({"owner_id": current_user.id}, {"_id": 0})
        if not workspace:
            raise HTTPException(status_code=400, detail="No workspace found. Please specify workspace_id.")
        workspace_id = workspace['id']
    else:
        # Verify user has access to workspace
        member = await get_workspace_member(workspace_id, current_user.id)
        if not member:
            raise HTTPException(status_code=403, detail="Access denied to workspace")
    
    # Check quota: current storage + file size <= allowed storage
    storage_used = await get_user_storage_usage(current_user.id)
    storage_allowed = await get_user_allowed_storage(current_user.id)
    
    if storage_used + file_size > storage_allowed:
        raise HTTPException(
            status_code=402,
            detail=f"Storage quota exceeded. Used: {storage_used} bytes, Allowed: {storage_allowed} bytes, File size: {file_size} bytes"
        )
    
    # Determine resource type based on file extension
    file_extension = Path(file.filename).suffix.lower()
    resource_type = "auto"
    if file_extension == '.gif':
        resource_type = "video"  # Upload GIFs as video for mobile compatibility
    elif file_extension in ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.svg']:
        resource_type = "image"
    elif file_extension in ['.mp4', '.webm', '.mov', '.avi', '.mkv']:
        resource_type = "video"
    elif file_extension in ['.pdf', '.doc', '.docx', '.txt']:
        resource_type = "raw"
    
    # Phase 1: Create file record with status=pending (reserves quota)
    file_id = str(uuid.uuid4())
    file_record = File(
        id=file_id,
        user_id=current_user.id,
        workspace_id=workspace_id,
        status=FileStatus.PENDING,
        size_bytes=file_size,
        url="",  # Will be set after upload
        public_id=None,
        resource_type=resource_type,
        idempotency_key=idempotency_key,
        reference_type=reference_type,
        reference_id=reference_id
    )
    
    file_dict = file_record.model_dump()
    file_dict['created_at'] = file_dict['created_at'].isoformat()
    file_dict['updated_at'] = file_dict['updated_at'].isoformat()
    
    # Insert file record (this reserves the quota)
    await db.files.insert_one(file_dict)
    
    # Phase 2: Upload to object storage
    try:
        if USE_CLOUDINARY:
            # Upload to Cloudinary
            try:
                upload_params = {
                    "public_id": file_id,
                    "resource_type": resource_type,
                    "folder": "guide2026",
                    "overwrite": False,
                    "invalidate": True
                }
                
                # Add optimization parameters
                if resource_type == "image":
                    upload_params.update({
                        "format": "auto",
                        "quality": "auto:good",
                        "fetch_format": "auto"
                    })
                elif resource_type == "video":
                    upload_params.update({
                        "format": "auto",
                        "quality": "auto:good",
                        "fetch_format": "auto",
                        "video_codec": "auto",
                        "bit_rate": "1m",
                        "max_video_bitrate": 1000000,
                    })
                    if file_extension == '.gif':
                        upload_params.update({
                            "eager": "f_mp4",
                            "eager_async": False
                        })
                
                upload_result = cloudinary.uploader.upload(
                    file_content,
                    **upload_params
                )
                
                secure_url = upload_result.get('secure_url') or upload_result.get('url')
                public_id = upload_result.get('public_id')
                
                # Update file record to status=active
                await db.files.update_one(
                    {"id": file_id},
                    {"$set": {
                        "status": FileStatus.ACTIVE,
                        "url": secure_url,
                        "public_id": public_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                return {
                    "file_id": file_id,
                    "url": secure_url,
                    "public_id": public_id,
                    "size_bytes": file_size,
                    "format": upload_result.get('format'),
                    "width": upload_result.get('width'),
                    "height": upload_result.get('height'),
                    "bytes": upload_result.get('bytes'),
                    "status": "active"
                }
            except Exception as e:
                logging.error(f"Cloudinary upload failed: {str(e)}")
                # Mark file as failed
                await db.files.update_one(
                    {"id": file_id},
                    {"$set": {
                        "status": FileStatus.FAILED,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                # Fallback to local storage
                logging.warning("Falling back to local storage")
        
        # Fallback: Local storage
        file_path = UPLOAD_DIR / f"{file_id}{file_extension}"
        with file_path.open("wb") as buffer:
            buffer.write(file_content)
        
        local_url = f"/api/media/{file_id}{file_extension}"
        
        # Update file record to status=active
        await db.files.update_one(
            {"id": file_id},
            {"$set": {
                "status": FileStatus.ACTIVE,
                "url": local_url,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "file_id": file_id,
            "url": local_url,
            "size_bytes": file_size,
            "status": "active"
        }
        
    except Exception as e:
        # Mark file as failed if upload fails
        logging.error(f"File upload failed: {str(e)}")
        await db.files.update_one(
            {"id": file_id},
            {"$set": {
                "status": FileStatus.FAILED,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

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

# Subscription & Quota Routes
@api_router.put("/users/me/plan")
async def change_user_plan(plan_name: str = Query(..., description="Plan name to change to"), current_user: User = Depends(get_current_user)):
    """
    Change user's plan.
    Handles plan upgrades and downgrades gracefully.
    - Allows downgrades even if user is over new plan's quota (read-only mode for uploads)
    - Blocks downgrades if user exceeds new plan's workspace/walkthrough/category limits
    - Never auto-deletes user files
    """
    # Validate plan name
    plan = await db.plans.find_one({"name": plan_name}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_name}' not found")
    
    # Check if plan is public (unless user is admin)
    if not plan.get('is_public', False) and plan_name != 'free':
        # For now, allow any plan change (no payment system yet)
        # In future, check if user has permission to access this plan
        pass
    
    # Get current plan and usage
    current_plan = await get_user_plan(current_user.id)
    storage_used = await get_user_storage_usage(current_user.id)
    new_plan_storage = plan.get('storage_bytes', 0)
    
    # Get user's current usage counts
    workspace_count = await get_workspace_count(current_user.id)
    workspaces = await db.workspaces.find({"owner_id": current_user.id}, {"_id": 0, "id": 1}).to_list(100)
    workspace_ids = [w["id"] for w in workspaces]
    total_walkthroughs = await db.walkthroughs.count_documents({
        "workspace_id": {"$in": workspace_ids},
        "archived": {"$ne": True}
    })
    # Count only top-level categories (exclude sub-categories)
    total_categories = await db.categories.count_documents({
        "workspace_id": {"$in": workspace_ids},
        "$or": [
            {"parent_id": None},
            {"parent_id": ""},
            {"parent_id": {"$exists": False}}
        ]
    })
    
    # Check if downgrading
    is_downgrade = current_plan and current_plan.storage_bytes > new_plan_storage
    
    # Validate limits for new plan (block downgrade if over hard limits)
    new_max_workspaces = plan.get('max_workspaces')
    new_max_walkthroughs = plan.get('max_walkthroughs')
    new_max_categories = plan.get('max_categories')
    
    if new_max_workspaces is not None and workspace_count > new_max_workspaces:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot downgrade: You have {workspace_count} workspaces, but the {plan.get('display_name', plan_name)} plan allows only {new_max_workspaces}. Please delete workspaces first."
        )
    
    if new_max_walkthroughs is not None and total_walkthroughs > new_max_walkthroughs:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot downgrade: You have {total_walkthroughs} walkthroughs, but the {plan.get('display_name', plan_name)} plan allows only {new_max_walkthroughs}. Please archive or delete walkthroughs first."
        )
    
    if new_max_categories is not None and total_categories > new_max_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot downgrade: You have {total_categories} categories, but the {plan.get('display_name', plan_name)} plan allows only {new_max_categories}. Please delete categories first."
        )
    
    # Check if downgrading and user is over new plan's storage quota
    if is_downgrade and storage_used > new_plan_storage:
        # User is over quota for new plan
        # Allow the change but log warning - user will be in read-only mode for uploads
        # The over_quota flag will be automatically set by get_user_plan_endpoint
        logging.warning(
            f"User {current_user.id} downgraded to {plan_name} but is over storage quota "
            f"({storage_used} bytes used, {new_plan_storage} bytes allowed). "
            f"Uploads will be blocked until quota is reduced."
        )
    
    # Get or create subscription
    subscription = await get_user_subscription(current_user.id)
    
    if subscription:
        # Update existing subscription
        await db.subscriptions.update_one(
            {"id": subscription.id},
            {"$set": {
                "plan_id": plan['id'],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Create new subscription
        new_subscription = Subscription(
            user_id=current_user.id,
            plan_id=plan['id'],
            status=SubscriptionStatus.ACTIVE
        )
        subscription_dict = new_subscription.model_dump()
        subscription_dict['started_at'] = subscription_dict['started_at'].isoformat()
        subscription_dict['created_at'] = subscription_dict['created_at'].isoformat()
        subscription_dict['updated_at'] = subscription_dict['updated_at'].isoformat()
        await db.subscriptions.insert_one(subscription_dict)
    
    # Update user's plan_id
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"plan_id": plan['id']}}
    )
    
    logging.info(f"User {current_user.id} changed plan to {plan_name}")
    
    return {
        "message": f"Plan changed to {plan.get('display_name', plan_name)}",
        "plan": plan
    }

@api_router.get("/users/me/plan")
async def get_user_plan_endpoint(current_user: User = Depends(get_current_user)):
    """Get user's current plan and quota information."""
    plan = await get_user_plan(current_user.id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    subscription = await get_user_subscription(current_user.id)
    storage_used = await get_user_storage_usage(current_user.id)
    storage_allowed = await get_user_allowed_storage(current_user.id)
    workspace_count = await get_workspace_count(current_user.id)
    
    # Get all user's workspaces to calculate total walkthroughs and categories
    workspaces = await db.workspaces.find({"owner_id": current_user.id}, {"_id": 0, "id": 1}).to_list(100)
    workspace_ids = [w["id"] for w in workspaces]
    
    # Calculate total walkthroughs across all workspaces
    total_walkthroughs = await db.walkthroughs.count_documents({
        "workspace_id": {"$in": workspace_ids},
        "archived": {"$ne": True}
    })
    
    # Calculate total top-level categories across all workspaces (exclude sub-categories)
    total_categories = await db.categories.count_documents({
        "workspace_id": {"$in": workspace_ids},
        "$or": [
            {"parent_id": None},
            {"parent_id": ""},
            {"parent_id": {"$exists": False}}
        ]
    })
    
    return {
        "plan": plan.model_dump(),
        "subscription": subscription.model_dump() if subscription else None,
        "quota": {
            "storage_used_bytes": storage_used,
            "storage_allowed_bytes": storage_allowed,
            "storage_used_percent": round((storage_used / storage_allowed * 100) if storage_allowed > 0 else 0, 2),
            "workspace_count": workspace_count,
            "workspace_limit": plan.max_workspaces,
            "walkthroughs_used": total_walkthroughs,
            "walkthroughs_limit": plan.max_walkthroughs,
            "categories_used": total_categories,
            "categories_limit": plan.max_categories,
            "over_quota": storage_used > storage_allowed
        }
    }

@api_router.get("/plans")
async def get_plans(current_user: Optional[User] = Depends(get_current_user_optional)):
    """Get all available plans. Public endpoint for plan selection."""
    plans = await db.plans.find({"is_public": True}, {"_id": 0}).to_list(100)
    return {"plans": plans}

@api_router.get("/workspaces/{workspace_id}/quota")
async def get_workspace_quota(workspace_id: str, current_user: User = Depends(get_current_user)):
    """Get workspace quota usage."""
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get workspace owner's plan
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    owner_plan = await get_user_plan(workspace['owner_id'])
    if not owner_plan:
        raise HTTPException(status_code=404, detail="Workspace owner has no plan")
    
    walkthrough_count = await get_walkthrough_count(workspace_id)
    category_count = await get_category_count(workspace_id)
    
    # Calculate workspace storage (files in this workspace)
    workspace_files = await db.files.find(
        {"workspace_id": workspace_id, "status": FileStatus.ACTIVE},
        {"size_bytes": 1}
    ).to_list(10000)
    workspace_storage = sum(file.get('size_bytes', 0) for file in workspace_files)
    
    return {
        "workspace_id": workspace_id,
        "plan": owner_plan.model_dump(),
        "usage": {
            "walkthrough_count": walkthrough_count,
            "walkthrough_limit": owner_plan.max_walkthroughs,
            "category_count": category_count,
            "category_limit": owner_plan.max_categories,
            "storage_bytes": workspace_storage
        },
        "limits": {
            "max_walkthroughs": owner_plan.max_walkthroughs,
            "max_categories": owner_plan.max_categories,
            "max_file_size_bytes": owner_plan.max_file_size_bytes
        }
    }

@api_router.post("/admin/reconcile-quota")
async def reconcile_quota(
    user_id: Optional[str] = Query(None, description="Specific user ID to reconcile (optional, admin only)"),
    fix_discrepancies: bool = Query(False, description="Whether to fix discrepancies automatically"),
    current_user: User = Depends(get_current_user)
):
    """
    Reconcile quota usage by recalculating storage from file records.
    Compares calculated storage with expected values and reports discrepancies.
    Admin-only endpoint (can be called by any authenticated user for now, but should be restricted in production).
    """
    # TODO: Add admin role check in production
    # if current_user.role != "admin":
    #     raise HTTPException(status_code=403, detail="Admin access required")
    
    discrepancies = []
    fixed_count = 0
    
    # Get users to reconcile
    if user_id:
        users = [await db.users.find_one({"id": user_id}, {"_id": 0})]
        if not users[0]:
            raise HTTPException(status_code=404, detail="User not found")
    else:
        # Reconcile all users
        users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(10000)
    
    for user in users:
        user_id_to_check = user["id"]
        
        # Recalculate storage from file records
        active_files = await db.files.find(
            {"user_id": user_id_to_check, "status": FileStatus.ACTIVE},
            {"size_bytes": 1}
        ).to_list(10000)
        
        calculated_storage = sum(file.get('size_bytes', 0) for file in active_files)
        
        # Get expected storage (from get_user_storage_usage)
        expected_storage = await get_user_storage_usage(user_id_to_check)
        
        if calculated_storage != expected_storage:
            discrepancy = {
                "user_id": user_id_to_check,
                "calculated_storage": calculated_storage,
                "expected_storage": expected_storage,
                "difference": calculated_storage - expected_storage
            }
            discrepancies.append(discrepancy)
            
            if fix_discrepancies:
                # The get_user_storage_usage function already calculates from DB, so this shouldn't happen
                # But if it does, we log it
                logging.warning(
                    f"Storage discrepancy for user {user_id_to_check}: "
                    f"calculated={calculated_storage}, expected={expected_storage}"
                )
                fixed_count += 1
    
    return {
        "reconciled_users": len(users),
        "discrepancies_found": len(discrepancies),
        "discrepancies": discrepancies,
        "fixed_count": fixed_count if fix_discrepancies else 0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.post("/admin/cleanup-files")
async def cleanup_files(
    pending_hours: int = Query(24, description="Delete PENDING files older than this many hours"),
    failed_days: int = Query(7, description="Delete FAILED files older than this many days"),
    dry_run: bool = Query(True, description="If True, only report what would be deleted without actually deleting"),
    current_user: User = Depends(get_current_user)
):
    """
    Cleanup old PENDING and FAILED file records.
    - PENDING files older than pending_hours are likely abandoned uploads
    - FAILED files older than failed_days are failed uploads that won't be retried
    Admin-only endpoint (can be called by any authenticated user for now, but should be restricted in production).
    """
    # TODO: Add admin role check in production
    # if current_user.role != "admin":
    #     raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    pending_threshold = now - timedelta(hours=pending_hours)
    failed_threshold = now - timedelta(days=failed_days)
    
    # Find old PENDING files
    pending_files = await db.files.find(
        {
            "status": FileStatus.PENDING,
            "created_at": {"$lt": pending_threshold.isoformat()}
        },
        {"_id": 0, "id": 1, "url": 1, "public_id": 1, "resource_type": 1, "created_at": 1}
    ).to_list(10000)
    
    # Find old FAILED files
    failed_files = await db.files.find(
        {
            "status": FileStatus.FAILED,
            "created_at": {"$lt": failed_threshold.isoformat()}
        },
        {"_id": 0, "id": 1, "url": 1, "public_id": 1, "resource_type": 1, "created_at": 1}
    ).to_list(10000)
    
    deleted_count = 0
    errors = []
    
    if not dry_run:
        # Delete PENDING files
        for file_record in pending_files:
            try:
                file_id = file_record['id']
                
                # Try to delete from storage if it exists
                if USE_CLOUDINARY and file_record.get('public_id'):
                    try:
                        cloudinary.uploader.destroy(
                            file_record['public_id'],
                            resource_type=file_record.get('resource_type', 'auto')
                        )
                    except Exception as e:
                        logging.warning(f"Cloudinary deletion failed for {file_id}: {str(e)}")
                
                # Delete DB record
                await db.files.delete_one({"id": file_id})
                deleted_count += 1
            except Exception as e:
                errors.append({"file_id": file_record.get('id'), "error": str(e)})
        
        # Delete FAILED files
        for file_record in failed_files:
            try:
                file_id = file_record['id']
                
                # Try to delete from storage if it exists
                if USE_CLOUDINARY and file_record.get('public_id'):
                    try:
                        cloudinary.uploader.destroy(
                            file_record['public_id'],
                            resource_type=file_record.get('resource_type', 'auto')
                        )
                    except Exception as e:
                        logging.warning(f"Cloudinary deletion failed for {file_id}: {str(e)}")
                
                # Delete DB record
                await db.files.delete_one({"id": file_id})
                deleted_count += 1
            except Exception as e:
                errors.append({"file_id": file_record.get('id'), "error": str(e)})
    
    return {
        "dry_run": dry_run,
        "pending_files_found": len(pending_files),
        "failed_files_found": len(failed_files),
        "deleted_count": deleted_count if not dry_run else 0,
        "errors": errors,
        "pending_threshold": pending_threshold.isoformat(),
        "failed_threshold": failed_threshold.isoformat(),
        "timestamp": now.isoformat()
    }

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

# CORS - MUST be added BEFORE router to handle preflight requests
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

# Include router AFTER CORS middleware
app.include_router(api_router)

# Add middleware to handle OPTIONS requests and ensure CORS headers on all responses
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    """Ensure CORS headers are always present, even on errors"""
    # Handle preflight OPTIONS requests
    if request.method == "OPTIONS":
        origin = request.headers.get("origin")
        if allow_all_origins:
            allowed_origin = "*"
        elif origin and origin in cors_origins:
            allowed_origin = origin
        else:
            allowed_origin = cors_origins[0] if cors_origins else "*"
        
        return JSONResponse(
            content={},
            headers={
                "Access-Control-Allow-Origin": allowed_origin,
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true" if not allow_all_origins else "false",
                "Access-Control-Max-Age": "3600"
            }
        )
    
    # Process request
    try:
        response = await call_next(request)
        # Add CORS headers to successful responses (CORS middleware should handle this, but ensure it)
        origin = request.headers.get("origin")
        if allow_all_origins:
            allowed_origin = "*"
        elif origin and origin in cors_origins:
            allowed_origin = origin
        else:
            allowed_origin = cors_origins[0] if cors_origins else "*"
        
        # Only add if not already present (CORS middleware should have added them)
        if "Access-Control-Allow-Origin" not in response.headers:
            response.headers["Access-Control-Allow-Origin"] = allowed_origin
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            if not allow_all_origins:
                response.headers["Access-Control-Allow-Credentials"] = "true"
        
        return response
    except Exception as e:
        # Ensure CORS headers on error responses
        origin = request.headers.get("origin")
        if allow_all_origins:
            allowed_origin = "*"
        elif origin and origin in cors_origins:
            allowed_origin = origin
        else:
            allowed_origin = cors_origins[0] if cors_origins else "*"
        
        logger.error(f"Request error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
            headers={
                "Access-Control-Allow-Origin": allowed_origin,
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true" if not allow_all_origins else "false"
            }
        )

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Exception handler to ensure CORS headers are always sent, even on errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ensure CORS headers are sent even when exceptions occur"""
    import traceback
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    # Get CORS origins from environment
    raw_cors_origins = os.environ.get("CORS_ORIGINS", "*")
    cors_origins = [o.strip() for o in raw_cors_origins.split(",") if o.strip()]
    allow_all_origins = "*" in cors_origins
    origin = request.headers.get("origin")
    
    # Determine allowed origin
    if allow_all_origins:
        allowed_origin = "*"
    elif origin and origin in cors_origins:
        allowed_origin = origin
    else:
        allowed_origin = cors_origins[0] if cors_origins else "*"
    
    # Return error response with CORS headers
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={
            "Access-Control-Allow-Origin": allowed_origin,
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true" if not allow_all_origins else "false"
        }
    )

@app.on_event("startup")
async def startup_event():
    """Initialize default plans on startup."""
    await initialize_default_plans()
    logging.info("Default plans initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()