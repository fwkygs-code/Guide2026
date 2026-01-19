from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, File as FastAPIFile, UploadFile, Request, Header, Query, Form, Body, BackgroundTasks
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
import json
import hmac
import hashlib
import base64
import aiohttp
import secrets
import requests

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

# Cloudinary Configuration (MANDATORY for persistent file storage)
# Local filesystem storage is NOT supported - files will be lost on redeploy
CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET')

# PayPal Configuration
PAYPAL_CLIENT_ID = os.environ.get('PAYPAL_CLIENT_ID')
PAYPAL_CLIENT_SECRET = os.environ.get('PAYPAL_CLIENT_SECRET')
PAYPAL_WEBHOOK_ID = os.environ.get('PAYPAL_WEBHOOK_ID')  # Webhook ID from PayPal dashboard
PAYPAL_API_BASE = os.environ.get('PAYPAL_API_BASE', 'https://api-m.paypal.com')  # Use api-m.sandbox.paypal.com for sandbox

# Email Configuration (Resend HTTP API only)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
RESEND_FROM_EMAIL = os.environ.get('RESEND_FROM_EMAIL')
EMAIL_VERIFICATION_EXPIRY_HOURS = 24
RESEND_API_URL = "https://api.resend.com/emails"
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://guide2026-frontend.onrender.com')
# PART 5: SANDBOX VS PRODUCTION DOCUMENTATION
# IMPORTANT: Sandbox vs Production behavior differences:
# - Sandbox may NOT open PayPal UI on cancellation (PayPal sandbox limitation)
# - Sandbox may auto-cancel silently in some test scenarios
# - Production always executes the same API calls regardless of UI behavior
# - Backend logic is identical for sandbox and production (only API base URL differs)
# - Sandbox UI behavior does not affect backend truth - all state changes require PayPal API/webhook confirmation
# - All audit logging works identically in sandbox and production

USE_CLOUDINARY = all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET])

if not USE_CLOUDINARY:
    # Cloudinary is MANDATORY - fail startup if not configured
    error_msg = (
        "=" * 80 + "\n"
        "CRITICAL ERROR: Cloudinary is not configured!\n"
        "Cloudinary is MANDATORY for file storage. Local filesystem storage is NOT supported.\n"
        "Files stored on local disk will be LOST on every redeployment.\n\n"
        "Please set the following environment variables:\n"
        "  - CLOUDINARY_CLOUD_NAME\n"
        "  - CLOUDINARY_API_KEY\n"
        "  - CLOUDINARY_API_SECRET\n\n"
        "Get your credentials from: https://cloudinary.com/console\n"
        "=" * 80
    )
    logging.error(error_msg)
    raise RuntimeError("Cloudinary configuration is required. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.")

# Email provider validation - Resend HTTP API is REQUIRED, SMTP is DISABLED
if not RESEND_API_KEY or not RESEND_FROM_EMAIL:
    error_msg = (
        "=" * 80 + "\n"
        "CRITICAL ERROR: Resend email configuration is missing!\n"
        "Resend HTTP API is REQUIRED for email sending. SMTP is DISABLED.\n\n"
        "Please set the following environment variables:\n"
        "  - RESEND_API_KEY (get from https://resend.com/api-keys)\n"
        "  - RESEND_FROM_EMAIL (email address to send from)\n\n"
        "For testing: Use onboarding@resend.dev (works immediately, no verification)\n"
        "For production: Verify your domain in Resend and use yourdomain.com email\n"
        "  Example: noreply@yourdomain.com (must verify domain first)\n\n"
        "=" * 80
    )
    logging.error(error_msg)
    raise RuntimeError("Resend email configuration is required. Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.")

logging.info("[EMAIL] Resend email provider active")
logging.info(f"[EMAIL] RESEND_API_KEY configured: {bool(RESEND_API_KEY)}")
logging.info(f"[EMAIL] RESEND_FROM_EMAIL: {RESEND_FROM_EMAIL}")
logging.info("[EMAIL] SMTP disabled")

# Configure Cloudinary
cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True  # Use HTTPS
)
logging.info("Cloudinary configured for persistent file storage")

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
    PENDING = "pending"  # Subscription created but not yet activated

# Note: Subscription status values are stored as lowercase strings in MongoDB
# Use "active", "pending", "cancelled", "expired" in queries, not enum values

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
    trial_ends_at: Optional[datetime] = None  # App-level Pro trial end date (14 days from start)
    email_verified: bool = False  # Email verification status
    email_verification_token: Optional[str] = None  # Hashed verification token
    email_verification_expires_at: Optional[datetime] = None  # Token expiration
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
    notebooklm_url: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    icon_url: Optional[str] = None
    notebooklm_url: Optional[str] = None

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    icon_url: Optional[str] = None
    notebooklm_url: Optional[str] = None
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
    step_ids: List[str] = Field(..., min_length=1, description="List of step IDs in the desired order")

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
    provider: str = "manual"  # "manual", "paypal", "stripe", etc.
    provider_subscription_id: Optional[str] = None  # PayPal subscription ID, Stripe subscription ID, etc.
    extra_storage_bytes: int = 0  # Additional storage beyond plan storage
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cancelled_at: Optional[datetime] = None
    cancel_at_period_end: bool = False  # User requested cancellation, will cancel at period end
    paypal_verified_status: Optional[str] = None  # PayPal API verified status: "ACTIVE", "CANCELLED", "UNKNOWN"
    last_verified_at: Optional[datetime] = None  # Last time PayPal status was verified via API
    cancellation_requested_at: Optional[datetime] = None  # When user requested cancellation (for receipt)
    effective_end_date: Optional[datetime] = None  # When subscription access ends (for cancellation receipt)
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

def generate_verification_token() -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(32)

def hash_verification_token(token: str) -> str:
    """Hash verification token for storage (similar to password hashing)."""
    return bcrypt.hashpw(token.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_verification_token(token: str, hashed: str) -> bool:
    """Verify a verification token against its hash."""
    try:
        return bcrypt.checkpw(token.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def send_verification_email(email: str, verify_url: str, name: Optional[str] = None) -> bool:
    """
    Send verification email via Resend HTTP API.
    Never raises exceptions - returns True on success, False on failure.
    This function is called from background tasks, so exceptions would be lost.
    
    Args:
        email: Recipient email address
        verify_url: Full verification URL with token
        name: Optional recipient name (defaults to email username if not provided)
    """
    if not RESEND_API_KEY or not RESEND_FROM_EMAIL:
        logging.warning(f"[EMAIL][FAILED] email={email} error=Resend not configured")
        return False
    
    try:
        expiry_hours = EMAIL_VERIFICATION_EXPIRY_HOURS
        
        # Use provided name or extract from email for personalization
        if not name:
            name = email.split('@')[0].replace('.', ' ').title()
        
        # Plain text version
        text_content = f"""Hi {name},

Please verify your email address by clicking the link below:

{verify_url}

This link will expire in {expiry_hours} hours.

If you didn't create an account, you can safely ignore this email.

Best regards,
Guide2026
"""
        
        # HTML version
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
        .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Hi {name},</h2>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="{verify_url}" class="button">Verify Email</a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">{verify_url}</p>
        <p style="color: #666; font-size: 14px;">This link will expire in {expiry_hours} hours.</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
        <div class="footer">
            <p>Best regards,<br>Guide2026</p>
        </div>
    </div>
</body>
</html>
"""
        
        # Send email via Resend HTTP API
        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "from": RESEND_FROM_EMAIL,
            "to": [email],
            "subject": "Verify your email address",
            "text": text_content,
            "html": html_content
        }
        
        logging.info(f"[EMAIL][REQUEST] Resend API call for email={email} from={RESEND_FROM_EMAIL}")
        response = requests.post(RESEND_API_URL, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            response_data = response.json()
            resend_id = response_data.get('id', 'unknown')
            logging.info(f"[EMAIL][SUCCESS] email={email} resend_id={resend_id}")
            return True
        else:
            # Try to parse error response
            try:
                error_data = response.json()
                error_detail = error_data.get('message', str(error_data))
            except:
                error_detail = response.text or f"HTTP {response.status_code}"
            
            logging.error(f"[EMAIL][FAILED] email={email} status={response.status_code} error={error_detail} from={RESEND_FROM_EMAIL}")
            return False
            
    except requests.exceptions.Timeout:
        logging.error(f"[EMAIL][FAILED] email={email} error=Resend API timeout (10s)")
        return False
    except requests.exceptions.RequestException as e:
        logging.error(f"[EMAIL][FAILED] email={email} error=Resend API request error: {str(e)}")
        return False
    except Exception as e:
        logging.error(f"[EMAIL][FAILED] email={email} error={str(e)}", exc_info=True)
        return False

async def send_verification_email_background(user_id: str, email: str, name: str, token: str):
    """
    Background task to send verification email via Resend HTTP API.
    Non-blocking - runs after HTTP response is sent.
    """
    try:
        logging.info(f"[EMAIL][START] user_id={user_id} email={email} name={name}")
        
        # Verify configuration before attempting send
        if not RESEND_API_KEY:
            logging.error(f"[EMAIL][FAILED] user_id={user_id} email={email} error=RESEND_API_KEY not configured")
            return
        
        if not RESEND_FROM_EMAIL:
            logging.error(f"[EMAIL][FAILED] user_id={user_id} email={email} error=RESEND_FROM_EMAIL not configured")
            return
        
        verification_url = f"{FRONTEND_URL}/verify-email?token={token}"
        logging.info(f"[EMAIL][URL] user_id={user_id} verification_url={verification_url}")
        
        # Call the Resend email function (sync, but in background task)
        success = send_verification_email(email, verification_url, name=name)
        
        if success:
            logging.info(f"[EMAIL][SUCCESS] user_id={user_id} email={email}")
        else:
            logging.error(f"[EMAIL][FAILED] user_id={user_id} email={email} error=Email send failed (check logs above)")
    except Exception as e:
        logging.error(f"[EMAIL][FAILED] user_id={user_id} email={email} error=Background task exception: {str(e)}", exc_info=True)

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

async def require_email_verified(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to require email verification for protected endpoints.
    Users with active PayPal subscriptions are grandfathered as verified.
    """
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check explicit email verification
    if user_doc.get('email_verified', False):
        return current_user
    
    # Grandfather existing paid users - check if they have active/pending PayPal subscription
    subscription_id = user_doc.get('subscription_id')
    if subscription_id:
        subscription = await db.subscriptions.find_one(
            {
                "id": subscription_id,
                "status": {"$in": ["active", "pending"]},
                "provider": "paypal"
            },
            {"_id": 0}
        )
        if subscription:
            # User has active/pending PayPal subscription - allow access
            logging.info(f"User {current_user.id} has active PayPal subscription - allowing access without email verification")
            return current_user
    
    # User not verified and no active subscription
    raise HTTPException(
        status_code=403,
        detail="Email verification required. Please verify your email address to access Pro features."
    )

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
    """Get user's subscription (ACTIVE, PENDING, or CANCELLED status).
    CANCELLED subscriptions are included because user keeps access until EXPIRED.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return None
    
    subscription_id = user.get('subscription_id')
    if not subscription_id:
        return None
    
    # Get subscription with ACTIVE, PENDING, or CANCELLED status
    # CANCELLED is included because user keeps Pro access until EXPIRED webhook
    subscription = await db.subscriptions.find_one(
        {"id": subscription_id, "status": {"$in": [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING, SubscriptionStatus.CANCELLED]}},
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
                
                # Delete from Cloudinary (all files are stored in Cloudinary)
                if file_record.get('public_id'):
                    try:
                        cloudinary.uploader.destroy(
                            file_record['public_id'],
                            resource_type=file_record.get('resource_type', 'auto')
                        )
                        logging.info(f"Deleted file {file_id} from Cloudinary: {file_record['public_id']}")
                    except Exception as e:
                        logging.warning(f"Cloudinary deletion failed for {file_id}: {str(e)}")
                else:
                    logging.warning(f"File {file_id} has no public_id, cannot delete from Cloudinary")
                
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
async def signup(user_data: UserCreate, background_tasks: BackgroundTasks):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate verification token
    verification_token = generate_verification_token()
    token_hash = hash_verification_token(verification_token)
    token_expires_at = datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        email_verified=False,
        email_verification_token=token_hash,
        email_verification_expires_at=token_expires_at
    )
    user_dict = user.model_dump()
    user_dict['password'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    if user_dict.get('email_verification_expires_at'):
        user_dict['email_verification_expires_at'] = user_dict['email_verification_expires_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Initialize plans
    await initialize_default_plans()
    
    # Automatically assign Free plan to new users
    await assign_free_plan_to_user(user.id)
    
    # Schedule verification email sending as background task (non-blocking)
    # Email will be sent after HTTP response is returned - never blocks signup
    logging.info(f"[SIGNUP] Scheduling email background task for user_id={user.id} email={user_data.email}")
    try:
        background_tasks.add_task(
            send_verification_email_background,
            user.id,
            user_data.email,
            user_data.name,
            verification_token
        )
        logging.info(f"[SIGNUP] Background task scheduled successfully for user_id={user.id}")
    except Exception as e:
        logging.error(f"[SIGNUP] Failed to schedule background task for user_id={user.id}: {str(e)}", exc_info=True)
    
    # Refresh user data to include plan_id
    user_doc = await db.users.find_one({"id": user.id}, {"_id": 0})
    if user_doc:
        # Convert datetime ISO strings to datetime objects for Pydantic
        user_dict = {k: v for k, v in user_doc.items() if k != 'password'}
        # Handle datetime fields that might be stored as ISO strings
        for date_field in ['created_at', 'trial_ends_at', 'email_verification_expires_at']:
            if date_field in user_dict and user_dict[date_field] and isinstance(user_dict[date_field], str):
                try:
                    user_dict[date_field] = datetime.fromisoformat(user_dict[date_field].replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    pass  # If conversion fails, leave as is (Pydantic will handle it)
        user = User(**user_dict)
    
    token = create_token(user.id)
    
    # Use model_dump to ensure proper JSON serialization
    # Note: email_verification_sent is always True here since email is sent in background
    # Actual email send status is logged but doesn't affect response
    return {"user": user.model_dump(mode='json'), "token": token, "email_verification_sent": True}

@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc or not verify_password(login_data.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**{k: v for k, v in user_doc.items() if k != 'password'})
    token = create_token(user.id)
    
    return {"user": user, "token": token}

@api_router.get("/auth/verify-email")
async def verify_email(token: str = Query(..., description="Email verification token")):
    """
    Verify user email address using verification token.
    Token is single-use and must not be expired.
    """
    if not token:
        raise HTTPException(status_code=400, detail="Verification token is required")
    
    # Find user with this verification token
    # We need to check all users and verify the token against the hash
    users_cursor = db.users.find(
        {
            "email_verified": False,
            "email_verification_token": {"$ne": None},
            "email_verification_expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
        },
        {"_id": 0}
    )
    
    verified_user = None
    async for user_doc in users_cursor:
        stored_hash = user_doc.get('email_verification_token')
        if stored_hash and verify_verification_token(token, stored_hash):
            verified_user = user_doc
            break
    
    if not verified_user:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification token. Please request a new verification email."
        )
    
    # Mark email as verified and clear verification token fields
    await db.users.update_one(
        {"id": verified_user['id']},
        {
            "$set": {
                "email_verified": True,
                "email_verification_token": None,
                "email_verification_expires_at": None
            }
        }
    )
    
    logging.info(f"Email verified for user {verified_user['id']} ({verified_user['email']})")
    
    return {
        "success": True,
        "message": "Email verified successfully. You can now access Pro features.",
        "email": verified_user['email']
    }

@api_router.post("/auth/resend-verification")
async def resend_verification_email(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Resend verification email.
    Rate-limited to prevent abuse (one email per 5 minutes per user).
    """
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already verified
    if user_doc.get('email_verified', False):
        raise HTTPException(status_code=400, detail="Email is already verified")
    
    # Rate limiting: Check last verification email sent time (stored in token expiry)
    # If token was generated less than 5 minutes ago, reject
    last_token_time = user_doc.get('email_verification_expires_at')
    if last_token_time:
        try:
            expires_at = datetime.fromisoformat(last_token_time.replace('Z', '+00:00'))
            token_age = expires_at - timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
            min_interval = datetime.now(timezone.utc) - timedelta(minutes=5)
            if token_age > min_interval:
                raise HTTPException(
                    status_code=429,
                    detail="Please wait before requesting another verification email. Try again in a few minutes."
                )
        except Exception:
            pass  # If parsing fails, allow resend
    
    # Generate new verification token
    verification_token = generate_verification_token()
    token_hash = hash_verification_token(verification_token)
    token_expires_at = datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
    
    # Update user with new token
    await db.users.update_one(
        {"id": current_user.id},
        {
            "$set": {
                "email_verification_token": token_hash,
                "email_verification_expires_at": token_expires_at.isoformat()
            }
        }
    )
    
    # Schedule verification email sending as background task (non-blocking)
    # Email will be sent after HTTP response is returned - never blocks the request
    background_tasks.add_task(
        send_verification_email_background,
        current_user.id,
        current_user.email,
        current_user.name,
        verification_token
    )
    
    # Return immediately - email sending happens in background
    return {
        "success": True,
        "message": "Verification email will be sent shortly. Please check your inbox."
    }

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
    # Support both UUID and slug - try slug first, then UUID
    workspace = await db.workspaces.find_one({"slug": workspace_id}, {"_id": 0})
    if not workspace:
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Use the actual workspace ID for member check
    actual_workspace_id = workspace['id']
    member = await get_workspace_member(actual_workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
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

@api_router.delete("/workspaces/{workspace_id}")
async def delete_workspace(workspace_id: str, current_user: User = Depends(get_current_user)):
    """
    Delete workspace and all associated data (cascade delete).
    This will permanently delete:
    - All walkthroughs (and their files)
    - All categories
    - All workspace files (logo, background)
    - All workspace members
    """
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only workspace owner can delete workspace")
    
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Get all walkthroughs in workspace for cascade file deletion
    walkthroughs = await db.walkthroughs.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(10000)
    
    # Delete all files associated with walkthroughs
    total_deleted_files = 0
    for walkthrough in walkthroughs:
        file_urls = await extract_file_urls_from_walkthrough(walkthrough)
        deleted_count = await delete_files_by_urls(file_urls, current_user.id)
        total_deleted_files += deleted_count
    
    # Delete workspace logo and background files
    workspace_file_urls = []
    if workspace.get('logo'):
        workspace_file_urls.append(workspace['logo'])
    if workspace.get('portal_background_url'):
        workspace_file_urls.append(workspace['portal_background_url'])
    
    if workspace_file_urls:
        deleted_count = await delete_files_by_urls(workspace_file_urls, current_user.id)
        total_deleted_files += deleted_count
    
    # Delete all walkthroughs (including archived)
    await db.walkthroughs.delete_many({"workspace_id": workspace_id})
    
    # Delete all walkthrough versions
    await db.walkthrough_versions.delete_many({"workspace_id": workspace_id})
    
    # Delete all categories (cascade deletes sub-categories)
    # First get all categories to handle parent-child relationships
    all_categories = await db.categories.find({"workspace_id": workspace_id}, {"_id": 0, "id": 1}).to_list(1000)
    category_ids = [c["id"] for c in all_categories]
    
    # Delete category icon files
    for cat in all_categories:
        cat_full = await db.categories.find_one({"id": cat["id"]}, {"_id": 0})
        if cat_full and cat_full.get('icon_url'):
            await delete_files_by_urls([cat_full['icon_url']], current_user.id)
    
    # Delete all categories (including sub-categories)
    await db.categories.delete_many({"workspace_id": workspace_id})
    
    # Delete all workspace members
    await db.workspace_members.delete_many({"workspace_id": workspace_id})
    
    # Finally delete the workspace
    await db.workspaces.delete_one({"id": workspace_id})
    
    logging.info(f"Deleted workspace {workspace_id} and {total_deleted_files} associated files")
    
    return {
        "message": "Workspace deleted successfully",
        "deleted_files": total_deleted_files,
        "deleted_walkthroughs": len(walkthroughs),
        "deleted_categories": len(category_ids)
    }

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
        icon_url=category_data.icon_url,
        notebooklm_url=category_data.notebooklm_url
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
    if category_data.notebooklm_url is not None:
        update_dict["notebooklm_url"] = category_data.notebooklm_url
    
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
    # Log incoming request for debugging
    logging.info(f"[reorder_steps] Received reorder request for walkthrough {walkthrough_id}")
    logging.info(f"[reorder_steps] Request payload: step_ids={body.step_ids}, count={len(body.step_ids) if body.step_ids else 0}")
    
    # Validate step_ids is not empty (Pydantic Field validation should catch this, but provide detailed error)
    if not body.step_ids or len(body.step_ids) == 0:
        logging.error(f"[reorder_steps] Validation failed: step_ids is empty")
        raise HTTPException(
            status_code=422, 
            detail="step_ids cannot be empty. Must contain at least one step ID."
        )
    
    # Validate all step_ids are non-empty strings
    invalid_ids = [sid for sid in body.step_ids if not sid or not isinstance(sid, str) or len(sid.strip()) == 0]
    if invalid_ids:
        logging.error(f"[reorder_steps] Validation failed: invalid step_ids found: {invalid_ids}")
        raise HTTPException(
            status_code=422,
            detail=f"Invalid step_ids found: {invalid_ids}. All step IDs must be non-empty strings."
        )
    
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member or member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Access denied")

    walkthrough = await db.walkthroughs.find_one({"id": walkthrough_id, "workspace_id": workspace_id, "archived": {"$ne": True}}, {"_id": 0})
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")

    steps = walkthrough.get("steps", [])
    logging.info(f"[reorder_steps] Walkthrough has {len(steps)} steps in DB")
    
    step_map = {s["id"]: s for s in steps if "id" in s}
    logging.info(f"[reorder_steps] Step map contains {len(step_map)} steps with IDs")
    
    # Only allow reordering of existing step ids
    ordered = [step_map[sid] for sid in body.step_ids if sid in step_map]
    logging.info(f"[reorder_steps] Matched {len(ordered)} steps from request")
    
    # Check for missing step IDs
    missing_ids = [sid for sid in body.step_ids if sid not in step_map]
    if missing_ids:
        logging.warning(f"[reorder_steps] Some step IDs not found in DB: {missing_ids}")
    
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

    # Validate we have the same number of steps
    if len(ordered) != len(steps):
        logging.warning(f"[reorder_steps] Step count mismatch: ordered={len(ordered)}, DB={len(steps)}")
    
    # Update order fields
    for idx, s in enumerate(ordered):
        s["order"] = idx

    await db.walkthroughs.update_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"$set": {"steps": ordered, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logging.info(f"[reorder_steps] Successfully reordered {len(ordered)} steps")
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
    workspace_id: Optional[str] = Form(None),
    idempotency_key: Optional[str] = Form(None),
    reference_type: Optional[str] = Form(None),
    reference_id: Optional[str] = Form(None),
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
        resource_type = "image"  # Upload GIFs as images (not video - conversion caused issues)
        logging.info(f"[upload_file] GIF detected, using resource_type=image for file {file.filename}")
    elif file_extension in ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.svg']:
        resource_type = "image"
    elif file_extension in ['.mp4', '.webm', '.mov', '.avi', '.mkv']:
        resource_type = "video"
    elif file_extension in ['.pdf', '.doc', '.docx', '.txt']:
        resource_type = "raw"
    
    logging.info(f"[upload_file] File type determined: extension={file_extension}, resource_type={resource_type}, size={file_size} bytes")
    
    # Build Cloudinary folder structure: guide2026/user_id/workspace_id/category_id/walkthrough_id
    # Determine category_id and walkthrough_id from reference_type and reference_id
    category_id = None
    walkthrough_id = None
    
    if reference_type and reference_id:
        if reference_type == "walkthrough_icon":
            # reference_id is walkthrough_id
            walkthrough_id = reference_id
            # Get walkthrough to find category_id
            walkthrough = await db.walkthroughs.find_one(
                {"id": walkthrough_id, "workspace_id": workspace_id},
                {"_id": 0, "category_ids": 1}
            )
            if walkthrough and walkthrough.get("category_ids"):
                # Use first category if multiple
                category_id = walkthrough["category_ids"][0] if isinstance(walkthrough["category_ids"], list) else walkthrough["category_ids"]
        elif reference_type == "category_icon":
            # reference_id is category_id
            category_id = reference_id
        elif reference_type == "step_media":
            # reference_id is step_id - need to find walkthrough
            # Search for walkthrough containing this step
            walkthrough = await db.walkthroughs.find_one(
                {"workspace_id": workspace_id, "steps.id": reference_id},
                {"_id": 0, "id": 1, "category_ids": 1}
            )
            if walkthrough:
                walkthrough_id = walkthrough["id"]
                if walkthrough.get("category_ids"):
                    category_id = walkthrough["category_ids"][0] if isinstance(walkthrough["category_ids"], list) else walkthrough["category_ids"]
        elif reference_type == "block_image":
            # reference_id is block_id - need to find step, then walkthrough
            # Search for walkthrough containing this block
            walkthrough = await db.walkthroughs.find_one(
                {"workspace_id": workspace_id, "steps.blocks.id": reference_id},
                {"_id": 0, "id": 1, "category_ids": 1}
            )
            if walkthrough:
                walkthrough_id = walkthrough["id"]
                if walkthrough.get("category_ids"):
                    category_id = walkthrough["category_ids"][0] if isinstance(walkthrough["category_ids"], list) else walkthrough["category_ids"]
        # workspace_logo, workspace_background don't have category/walkthrough
    
    # Build folder path: guide2026/user_id/workspace_id/category_id/walkthrough_id
    folder_parts = ["guide2026", current_user.id, workspace_id]
    if category_id:
        folder_parts.append(category_id)
    if walkthrough_id:
        folder_parts.append(walkthrough_id)
    
    cloudinary_folder = "/".join(folder_parts)
    logging.info(f"[upload_file] Cloudinary folder: {cloudinary_folder} (user={current_user.id}, workspace={workspace_id}, category={category_id}, walkthrough={walkthrough_id})")
    
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
    
    # Phase 2: Upload to Cloudinary (MANDATORY - no local storage fallback)
    try:
        upload_params = {
            "public_id": file_id,
            "resource_type": resource_type,
            "folder": cloudinary_folder,  # Organized: guide2026/user_id/workspace_id/category_id/walkthrough_id
            "overwrite": False,
            "invalidate": True
        }
        
        # Add optimization parameters for upload
        # Note: format="auto" and fetch_format are NOT valid upload parameters
        # Format optimization is done at delivery time via URL transformations, not upload
        if resource_type == "image":
            upload_params.update({
                "quality": "auto:good"
            })
            logging.info(f"[upload_file] Image upload params: {upload_params}")
        elif resource_type == "video":
            upload_params.update({
                "quality": "auto:good",
                "video_codec": "auto",
                "bit_rate": "1m",
                "max_video_bitrate": 1000000,
            })
            logging.info(f"[upload_file] Video upload params: {upload_params}")
        
        # CRITICAL: Upload to Cloudinary - this is the only storage mechanism
        logging.info(f"[upload_file] Uploading file {file_id} to Cloudinary with resource_type={resource_type}")
        upload_result = cloudinary.uploader.upload(
            file_content,
            **upload_params
        )
        
        secure_url = upload_result.get('secure_url') or upload_result.get('url')
        public_id = upload_result.get('public_id')
        returned_resource_type = upload_result.get('resource_type')
        
        # CRITICAL: Verify upload succeeded and returned required data
        if not secure_url:
            raise ValueError("Cloudinary upload succeeded but no URL returned")
        if not public_id:
            raise ValueError("Cloudinary upload succeeded but no public_id returned")
        
        logging.info(f"[upload_file] Cloudinary upload successful: file_id={file_id}, public_id={public_id}, resource_type={returned_resource_type}, url={secure_url}")
        
        # CRITICAL: Update file record with Cloudinary data - this is what /api/media/:id uses
        update_result = await db.files.update_one(
            {"id": file_id},
            {"$set": {
                "status": FileStatus.ACTIVE,
                "url": secure_url,  # CRITICAL: Store Cloudinary URL
                "public_id": public_id,  # CRITICAL: Store public_id for lookups
                "resource_type": resource_type,  # CRITICAL: Store resource_type for lookups
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if update_result.modified_count == 0:
            logging.error(f"[upload_file] WARNING: File record update failed for {file_id}")
        else:
            logging.info(f"[upload_file] File record updated successfully: file_id={file_id}, status=ACTIVE, url={secure_url}, public_id={public_id}")
        
        # Verify the record was saved correctly
        verification = await db.files.find_one({"id": file_id}, {"_id": 0, "url": 1, "public_id": 1, "resource_type": 1, "status": 1})
        if verification:
            logging.info(f"[upload_file] Verification: DB record for {file_id} = {verification}")
            if verification.get('url') != secure_url:
                logging.error(f"[upload_file] CRITICAL: URL mismatch! Expected: {secure_url}, Got: {verification.get('url')}")
            if verification.get('public_id') != public_id:
                logging.error(f"[upload_file] CRITICAL: public_id mismatch! Expected: {public_id}, Got: {verification.get('public_id')}")
        else:
            logging.error(f"[upload_file] CRITICAL: File record not found after update for {file_id}")
        
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
        # Mark file as failed if upload fails
        logging.error(f"Cloudinary upload failed for file {file_id}: {str(e)}")
        await db.files.update_one(
            {"id": file_id},
            {"$set": {
                "status": FileStatus.FAILED,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(
            status_code=500,
            detail=f"File upload to Cloudinary failed: {str(e)}. Please try again or contact support."
        )

# Media serving route (fallback for local storage)
# Note: If using Cloudinary, files are served directly from Cloudinary CDN
# This route is only used for local storage fallback
@api_router.get("/media/{filename}")
async def get_media(filename: str):
    """
    Serve media files from Cloudinary. Only serves ACTIVE files (not PENDING or FAILED).
    
    CRITICAL: All files are stored in Cloudinary. Local filesystem storage is NOT supported.
    This endpoint redirects to Cloudinary URLs for persistent file serving.
    """
    # Extract file_id from filename (remove extension)
    file_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
    
    # Check if file record exists and is ACTIVE
    file_record = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_record:
        logging.warning(f"[get_media] File record not found for file_id: {file_id}")
        raise HTTPException(status_code=404, detail="File not found")
    
    # Only serve ACTIVE files - block PENDING, FAILED, DELETING
    if file_record.get('status') != FileStatus.ACTIVE:
        logging.warning(f"[get_media] File {file_id} not available (status: {file_record.get('status')})")
        raise HTTPException(
            status_code=404, 
            detail=f"File not available (status: {file_record.get('status')})"
        )
    
    stored_url = file_record.get('url', '')
    public_id = file_record.get('public_id')
    resource_type = file_record.get('resource_type', 'auto')
    
    logging.info(f"[get_media] File record for {file_id}: url={stored_url}, public_id={public_id}, resource_type={resource_type}")
    
    # CRITICAL: If stored URL is a Cloudinary URL, redirect directly
    # This is the primary path for all files uploaded after Cloudinary migration
    if stored_url and 'res.cloudinary.com' in stored_url:
        logging.info(f"[get_media] File {file_id} has Cloudinary URL, redirecting: {stored_url}")
        return RedirectResponse(url=stored_url)
    
    # CRITICAL: If URL is not Cloudinary but we have public_id, look up in Cloudinary
    # This handles files that were uploaded but URL wasn't saved correctly
    if public_id:
        try:
            logging.info(f"[get_media] Looking up file {file_id} in Cloudinary by public_id: {public_id}, resource_type: {resource_type}")
            resource = cloudinary.api.resource(public_id, resource_type=resource_type)
            cloudinary_url = resource.get('secure_url') or resource.get('url')
            if cloudinary_url:
                logging.info(f"[get_media] Found file {file_id} in Cloudinary, redirecting: {cloudinary_url}")
                # CRITICAL: Update file record with Cloudinary URL for future requests
                await db.files.update_one(
                    {"id": file_id},
                    {"$set": {"url": cloudinary_url, "public_id": public_id, "resource_type": resource_type}}
                )
                return RedirectResponse(url=cloudinary_url)
            else:
                logging.error(f"[get_media] Cloudinary resource found but no URL: {resource}")
        except Exception as e:
            logging.warning(f"[get_media] Cloudinary resource lookup failed for {file_id} (public_id: {public_id}, resource_type: {resource_type}): {str(e)}")
    
    # CRITICAL: If we have file_id but no public_id, try to look up by file_id
    # This handles edge cases where public_id wasn't saved
    try:
        logging.info(f"[get_media] Attempting Cloudinary lookup for file {file_id} by file_id, resource_type: {resource_type}")
        resource = cloudinary.api.resource(file_id, resource_type=resource_type)
        cloudinary_url = resource.get('secure_url') or resource.get('url')
        returned_public_id = resource.get('public_id')
        if cloudinary_url:
            logging.info(f"[get_media] Found file {file_id} in Cloudinary by file_id, redirecting: {cloudinary_url}")
            # CRITICAL: Update file record with Cloudinary URL and public_id
            await db.files.update_one(
                {"id": file_id},
                {"$set": {
                    "url": cloudinary_url,
                    "public_id": returned_public_id or file_id,
                    "resource_type": resource_type
                }}
            )
            return RedirectResponse(url=cloudinary_url)
        else:
            logging.error(f"[get_media] Cloudinary resource found by file_id but no URL: {resource}")
    except Exception as e:
        logging.warning(f"[get_media] Cloudinary resource lookup by file_id failed for {file_id} (resource_type: {resource_type}): {str(e)}")
    
    # File not found in Cloudinary
    logging.error(f"[get_media] File {file_id} not found in Cloudinary. Stored URL: {stored_url}, Public ID: {public_id}, Resource Type: {resource_type}")
    raise HTTPException(
        status_code=404, 
        detail="File not found in Cloudinary. The file may have been deleted or never uploaded successfully."
    )

# Subscription & Quota Routes
@api_router.put("/users/me/plan")
async def change_user_plan(plan_name: str = Query(..., description="Plan name to change to"), current_user: User = Depends(get_current_user)):
    """
    Change user's plan.
    Handles plan upgrades and downgrades gracefully.
    - Allows downgrades even if user is over new plan's quota (read-only mode for uploads)
    - Blocks downgrades if user exceeds new plan's workspace/walkthrough/category limits
    - Never auto-deletes user files
    
    CRITICAL: For Pro plan, users must subscribe via PayPal. This endpoint only allows:
    - Free plan selection (downgrade from any plan)
    - Enterprise plan (contact-based, handled separately)
    """
    # Validate plan name
    plan = await db.plans.find_one({"name": plan_name}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_name}' not found")
    
    # CRITICAL: Pro plan requires PayPal subscription - no trial without payment approval
    if plan_name == 'pro':
        raise HTTPException(
            status_code=400,
            detail="Pro plan requires PayPal subscription. Please use the 'Upgrade to Pro' button to subscribe via PayPal. The 14-day trial starts after PayPal approves your payment."
        )
    
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
    """Get user's current plan and quota information.
    Plan access priority (in order):
    1. ACTIVE subscription → Pro plan access (PayPal subscription)
    2. Active trial (trial_ends_at > now) → Pro plan access (14-day app trial)
    3. PENDING subscription → Free plan (awaiting payment confirmation)
    4. CANCELLED/EXPIRED or no subscription → Free plan
    """
    # Check for active trial first (app-level trial, no PayPal required)
    user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    trial_ends_at = user.get('trial_ends_at') if user else None
    has_active_trial = False
    
    if trial_ends_at:
        try:
            if isinstance(trial_ends_at, str):
                trial_end_dt = datetime.fromisoformat(trial_ends_at.replace('Z', '+00:00'))
            else:
                trial_end_dt = trial_ends_at
            now = datetime.now(timezone.utc)
            has_active_trial = trial_end_dt > now
        except Exception as e:
            logging.warning(f"Error parsing trial_ends_at for user {current_user.id}: {e}")
            has_active_trial = False
    
    subscription = await get_user_subscription(current_user.id)
    
    # RECONCILIATION: Check PENDING subscriptions with PayPal API
    # This handles missed or delayed webhooks safely
    # NOTE: Reconciliation audit logging is handled inside reconcile_pending_subscription()
    if subscription and subscription.status == SubscriptionStatus.PENDING:
        reconciled_subscription = await reconcile_pending_subscription(subscription)
        if reconciled_subscription:
            # Subscription was reconciled to ACTIVE - use updated subscription
            subscription = reconciled_subscription
            # Re-fetch user to get updated trial_ends_at
            user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
            if user and user.get('trial_ends_at'):
                trial_ends_at = user.get('trial_ends_at')
                # Recalculate has_active_trial if trial_ends_at was updated
                if isinstance(trial_ends_at, str):
                    trial_end_dt = datetime.fromisoformat(trial_ends_at.replace('Z', '+00:00'))
                else:
                    trial_end_dt = trial_ends_at
                now = datetime.now(timezone.utc)
                has_active_trial = trial_end_dt > now
    
    # CRITICAL: Single source of truth for Pro access
    # User has Pro access if:
    # 1. ACTIVE subscription (PayPal confirmed payment)
    # 2. PENDING subscription (awaiting PayPal confirmation) - grants access during trial period
    # 3. Active trial (trial_ends_at > now)
    # 4. CANCELLED subscription BUT still within billing period (until EXPIRED)
    
    has_pro_access = False
    
    # CRITICAL: Check subscription's plan_id, not just status
    # Free plan users also have ACTIVE subscriptions, so we must check the plan
    if subscription:
        # Get the plan for this subscription
        subscription_plan = await db.plans.find_one({"id": subscription.plan_id}, {"_id": 0})
        is_pro_subscription = subscription_plan and subscription_plan.get('name') == 'pro'
        
        if subscription.status == SubscriptionStatus.ACTIVE:
            # ACTIVE subscription grants Pro access ONLY if it's a Pro plan subscription
            if is_pro_subscription:
                has_pro_access = True
        elif subscription.status == SubscriptionStatus.PENDING:
            # PENDING subscription grants Pro access ONLY if it's a Pro plan subscription
            # Note: Trial period check is not required for PENDING - user gets access immediately
            # Trial period is for billing purposes, not access control
            if is_pro_subscription:
                has_pro_access = True
        elif subscription.status == SubscriptionStatus.CANCELLED:
            # CANCELLED subscription: User keeps Pro access until EXPIRED webhook
            # Check if user still has Pro plan_id (not yet downgraded)
            # This means they're still within billing period
            if is_pro_subscription:
                user_plan_id = user.get('plan_id') if user else None
                if user_plan_id:
                    pro_plan = await db.plans.find_one({"name": "pro"}, {"_id": 0})
                    if pro_plan and user_plan_id == pro_plan['id']:
                        # User still has Pro plan_id - access continues until EXPIRED
                        has_pro_access = True
                # Also check if trial is still active (for cancelled subscriptions during trial)
                if has_active_trial:
                    has_pro_access = True
    
    # Also check standalone trial (no subscription)
    if not has_pro_access and has_active_trial:
        has_pro_access = True
    
    if has_pro_access:
        # User has Pro access - get Pro plan
        pro_plan = await db.plans.find_one({"name": "pro"}, {"_id": 0})
        if pro_plan:
            plan = Plan(**pro_plan)
        else:
            plan = await get_user_plan(current_user.id)
    else:
        # No Pro access - use Free plan
        plan = await get_user_plan(current_user.id)
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # RUNTIME INVARIANT VALIDATION (log-only, never crash)
    # These checks ensure system state consistency and help detect bugs
    # PART 4: State validation assertions for production safety
    if subscription and subscription.provider == 'paypal':
        user_plan_id = user.get('plan_id') if user else None
        pro_plan = await db.plans.find_one({"name": "pro"}, {"_id": 0})
        free_plan = await db.plans.find_one({"name": "free"}, {"_id": 0})
        
        # INVARIANT 1: User cannot be FREE while PayPal status is ACTIVE
        if subscription.paypal_verified_status == 'ACTIVE' and user_plan_id and free_plan and user_plan_id == free_plan['id']:
            logging.critical(
                f"[STATE VALIDATION] INVARIANT VIOLATION: User {current_user.id} has FREE plan but PayPal subscription status is ACTIVE. "
                f"subscription_id={subscription.id}, paypal_subscription_id={subscription.provider_subscription_id}, "
                f"paypal_verified_status={subscription.paypal_verified_status}, user_plan_id={user_plan_id}"
            )
        
        # INVARIANT 2: User cannot be PRO if PayPal status is EXPIRED (unless EXPIRED webhook hasn't processed yet)
        if subscription.paypal_verified_status == 'CANCELLED' and subscription.status == SubscriptionStatus.EXPIRED and user_plan_id and pro_plan and user_plan_id == pro_plan['id']:
            # This is actually OK - user keeps access until EXPIRED webhook processes
            # But log if EXPIRED webhook hasn't processed yet
            logging.warning(
                f"[STATE VALIDATION] User {current_user.id} has PRO plan but subscription is EXPIRED. "
                f"This may be expected if EXPIRED webhook is processing. subscription_id={subscription.id}"
            )
        
        # INVARIANT 3: Cancellation cannot be marked CONFIRMED unless PayPal confirms
        if subscription.status == SubscriptionStatus.CANCELLED and subscription.paypal_verified_status not in ['CANCELLED', 'UNKNOWN']:
            logging.critical(
                f"[STATE VALIDATION] INVARIANT VIOLATION: Subscription {subscription.id} marked CANCELLED but paypal_verified_status={subscription.paypal_verified_status}. "
                f"user_id={current_user.id}, paypal_subscription_id={subscription.provider_subscription_id}, "
                f"subscription_status={subscription.status}"
            )
        
        # INVARIANT 4: Downgrade may occur ONLY on BILLING.SUBSCRIPTION.EXPIRED webhook
        # This is verified by code review - only EXPIRED webhook downgrades
        # Log if user is FREE but subscription is not EXPIRED
        if user_plan_id and free_plan and user_plan_id == free_plan['id']:
            if subscription.status not in [SubscriptionStatus.EXPIRED]:
                logging.warning(
                    f"[STATE VALIDATION] User {current_user.id} has FREE plan but subscription status is {subscription.status}. "
                    f"This may be expected if subscription was never created or was manually downgraded. subscription_id={subscription.id}"
                )
        
        # INVARIANT 5: User cannot be PRO if PayPal status != ACTIVE/CANCELLED (unless PENDING)
        if user_plan_id and pro_plan and user_plan_id == pro_plan['id']:
            if subscription.paypal_verified_status not in ['ACTIVE', 'CANCELLED', None] and subscription.status != SubscriptionStatus.PENDING:
                logging.critical(
                    f"[STATE VALIDATION] INVARIANT VIOLATION: User {current_user.id} has PRO plan but PayPal verified status is {subscription.paypal_verified_status}. "
                    f"subscription_id={subscription.id}, subscription_status={subscription.status}, "
                    f"paypal_subscription_id={subscription.provider_subscription_id}"
                )
        
        # INVARIANT 6: trial_ends_at exists without PayPal billing_info source
        if user.get('trial_ends_at') and subscription.status == SubscriptionStatus.ACTIVE:
            # Check if trial_ends_at was set from PayPal (should have paypal_verified_status)
            if not subscription.paypal_verified_status:
                logging.warning(
                    f"[STATE VALIDATION] User {current_user.id} has trial_ends_at but subscription has no paypal_verified_status. "
                    f"This may indicate trial was set without PayPal confirmation. subscription_id={subscription.id}"
                )
    
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
    
    # Calculate trial period end and next billing date
    trial_period_end = None
    next_billing_date = None
    
    # Priority 1: Use app-level trial_ends_at if active (from User model)
    # This comes from PayPal's billing_info.next_billing_time (set by webhook)
    if has_active_trial and trial_ends_at:
        if isinstance(trial_ends_at, str):
            trial_period_end = trial_ends_at
        else:
            trial_period_end = trial_ends_at.isoformat()
    
    if subscription:
        subscription_dict = subscription.model_dump()
        started_at = subscription.started_at
        
        # For Pro plan with subscription, use trial_ends_at from User model (set by PayPal webhook)
        # Do NOT calculate trial period - it must come from PayPal billing schedule
        if plan.name == 'pro' and subscription.status in [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING, SubscriptionStatus.CANCELLED]:
            # Trial period end comes from PayPal billing_info.next_billing_time (already set above)
            # For CANCELLED subscriptions, user keeps access until EXPIRED webhook
            # No need to calculate - trial_period_end is already set from User.trial_ends_at if active
            
            # Calculate next billing date from trial end (if trial exists)
            if trial_period_end:
                try:
                    now = datetime.now(timezone.utc)
                    trial_end_dt_str = trial_period_end if isinstance(trial_period_end, str) else trial_period_end.isoformat()
                    trial_end_dt = datetime.fromisoformat(trial_end_dt_str.replace('Z', '+00:00'))
                    
                    if now >= trial_end_dt:
                        # Trial ended, calculate next billing (monthly from trial end)
                        # This is an estimate - actual billing comes from PayPal
                        next_billing_date = (trial_end_dt + timedelta(days=30)).isoformat()
                    else:
                        # Still in trial, billing starts after trial ends
                        next_billing_date = trial_period_end
                except Exception as e:
                    logging.warning(f"Error calculating next billing date: {e}")
                    next_billing_date = None
        
        # For Enterprise plan (if on monthly/yearly billing), calculate next billing date
        elif plan.name == 'enterprise' and subscription.status == SubscriptionStatus.ACTIVE:
            # Assume monthly billing for enterprise (30 days from started_at, then monthly)
            if isinstance(started_at, str):
                started_at_dt = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
            else:
                started_at_dt = started_at
            # First billing after 30 days from start
            first_billing = started_at_dt + timedelta(days=30)
            now = datetime.now(timezone.utc)
            
            # Calculate next billing date (monthly from first billing)
            next_billing = first_billing
            while next_billing <= now:
                next_billing += timedelta(days=30)
            next_billing_date = next_billing.isoformat()
    else:
        subscription_dict = None
    
    # Calculate current billing period end
    # This is when the current access period ends (trial end or next billing date)
    current_period_end = None
    if subscription:
        if trial_period_end:
            # If in trial, current period ends when trial ends
            current_period_end = trial_period_end
        elif next_billing_date:
            # If past trial, current period ends at next billing date
            current_period_end = next_billing_date
        elif subscription.status == SubscriptionStatus.ACTIVE:
            # Fallback: If no trial/billing date, estimate from started_at + 30 days
            try:
                started_at = subscription.started_at
                if isinstance(started_at, str):
                    started_at_dt = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                else:
                    started_at_dt = started_at
                # Estimate first billing period (30 days from start)
                current_period_end = (started_at_dt + timedelta(days=30)).isoformat()
            except Exception as e:
                logging.warning(f"Error calculating current_period_end: {e}")
    
    # Get cancel_at_period_end from subscription
    cancel_at_period_end = False
    if subscription and subscription_dict:
        cancel_at_period_end = subscription_dict.get('cancel_at_period_end', False)
    
    # Get PayPal verified status and last verification timestamp
    paypal_verified_status = None
    last_verified_at = None
    cancellation_receipt = None
    if subscription and subscription_dict:
        paypal_verified_status = subscription_dict.get('paypal_verified_status')
        last_verified_at_str = subscription_dict.get('last_verified_at')
        if last_verified_at_str:
            try:
                if isinstance(last_verified_at_str, str):
                    last_verified_at = last_verified_at_str
                else:
                    last_verified_at = last_verified_at_str.isoformat() if hasattr(last_verified_at_str, 'isoformat') else str(last_verified_at_str)
            except Exception:
                last_verified_at = None
        
        # Get cancellation receipt if cancellation was requested
        if subscription_dict.get('cancellation_requested_at'):
            cancellation_receipt = {
                "cancellation_requested_at": subscription_dict.get('cancellation_requested_at'),
                "provider_subscription_id": subscription_dict.get('provider_subscription_id'),
                "provider": subscription_dict.get('provider', 'paypal'),
                "effective_end_date": subscription_dict.get('effective_end_date')
            }
    
    # Build response with all required fields for UI
    # API Contract: Returns everything needed for subscription management UI
    response_data = {
        "plan": plan.model_dump(),
        "subscription": subscription_dict,
        "trial_period_end": trial_period_end,
        "next_billing_date": next_billing_date,
        "current_period_end": current_period_end,
        "cancel_at_period_end": cancel_at_period_end,
        # Additional fields for convenience (derived from subscription)
        "subscription_status": subscription_dict.get('status') if subscription_dict else None,
        "provider": subscription_dict.get('provider') if subscription_dict else None,
        "paypal_verified_status": paypal_verified_status,  # PayPal API verified status: "ACTIVE", "CANCELLED", "UNKNOWN"
        "last_verified_at": last_verified_at,  # ISO timestamp of last PayPal API verification
        "cancellation_receipt": cancellation_receipt,  # Cancellation receipt if cancellation was requested
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
    
    return response_data

# Trial & Subscription Models
# NOTE: start-trial endpoint removed - trials now only start after PayPal subscription activation
# The 14-day trial is automatically set when BILLING.SUBSCRIPTION.ACTIVATED webhook is received

# PayPal Subscription Models
class PayPalSubscribeRequest(BaseModel):
    subscriptionID: str

@api_router.post("/billing/paypal/cancel")
async def cancel_paypal_subscription(current_user: User = Depends(get_current_user)):
    """
    Cancel user's PayPal subscription.
    
    CRITICAL RULES:
    - Works for PayPal account subscriptions AND card-only (guest) subscriptions
    - PENDING subscriptions: Cannot cancel via API, set cancel_at_period_end=True
    - ACTIVE subscriptions: Attempt API cancellation, fallback to cancel_at_period_end
    - CANCELLED subscriptions: Idempotent (already cancelled, return success)
    - User keeps Pro access until EXPIRED webhook is received
    - Never downgrade user here - only EXPIRED webhook can downgrade
    - Never throw errors to user - always return success with appropriate message
    
    IMPORTANT: Card-only (guest checkout) subscriptions:
    - Are real subscriptions that auto-renew via PayPal
    - Can be cancelled from website (this endpoint)
    - PayPal API cancellation may fail for guest subscriptions
    - Fallback to cancel_at_period_end ensures cancellation works for all users
    """
    # Get user's subscription (ACTIVE, PENDING, or CANCELLED)
    subscription = await get_user_subscription(current_user.id)
    
    if not subscription:
        # No subscription found - return success (idempotent)
        return JSONResponse({
            "success": True,
            "message": "No active subscription found.",
            "status": "no_subscription"
        })
    
    if subscription.provider != "paypal":
        # Not a PayPal subscription - return success (idempotent)
        return JSONResponse({
            "success": True,
            "message": "This subscription is not managed through PayPal.",
            "status": "not_paypal"
        })
    
    # CRITICAL: PENDING subscriptions cannot be cancelled via PayPal API
    # (PENDING means payment not yet confirmed, API may not accept cancellation)
    # Set cancel intent flag - subscription will be cancelled when it becomes ACTIVE
    if subscription.status == SubscriptionStatus.PENDING:
        # Check if already marked for cancellation (idempotent)
        if subscription.cancel_at_period_end:
            return JSONResponse({
                "success": True,
                "message": "Cancellation already scheduled. Your subscription will be cancelled when it becomes active.",
                "status": "already_cancelled"
            })
        
        # Mark subscription for cancellation at period end
        # Store cancellation receipt
        now = datetime.now(timezone.utc)
        effective_end_dt = None
        # For PENDING, effective_end_date is when subscription becomes active + billing period
        # Estimate from now + 30 days (will be updated when subscription activates)
        try:
            effective_end_dt = now + timedelta(days=30)
        except Exception:
            pass
        
        await db.subscriptions.update_one(
            {"id": subscription.id},
            {
                "$set": {
                    "cancel_at_period_end": True,
                    "cancellation_requested_at": now.isoformat(),  # Receipt: when cancellation was requested
                    "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else None,  # Receipt: when access ends (estimate)
                    "updated_at": now.isoformat()
                }
            }
        )
        logging.info(f"PENDING subscription marked for cancellation at period end: user={current_user.id}, subscription={subscription.id}")
        
        return JSONResponse({
            "success": True,
            "message": "Your subscription will be cancelled when it becomes active. You will continue to have Pro access until the end of your billing period. Final billing status is determined by PayPal.",
            "status": "pending_cancellation",
            "cancellation_receipt": {
                "cancellation_requested_at": now.isoformat(),
                "provider_subscription_id": subscription.provider_subscription_id,
                "provider": "paypal",
                "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else None
            }
        })
    
    # CRITICAL: CANCELLED subscriptions - idempotent (already cancelled)
    if subscription.status == SubscriptionStatus.CANCELLED:
        # Check if already marked for cancellation
        if subscription.cancel_at_period_end:
            return JSONResponse({
                "success": True,
                "message": "Your subscription is already scheduled for cancellation. You will continue to have Pro access until the end of your billing period.",
                "status": "already_cancelled"
            })
        
        # Subscription is CANCELLED but cancel_at_period_end not set - set it for consistency
        await db.subscriptions.update_one(
            {"id": subscription.id},
            {
                "$set": {
                    "cancel_at_period_end": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return JSONResponse({
            "success": True,
            "message": "Your subscription is already cancelled. You will continue to have Pro access until the end of your billing period.",
            "status": "already_cancelled"
        })
    
    # For ACTIVE subscriptions, attempt PayPal API cancellation
    # Note: This may fail for card-only (guest) subscriptions, but we have a fallback
    # SANDBOX NOTE: In sandbox, PayPal may not open cancellation UI, but API calls still execute
    # Backend truth is determined by PayPal API response, not UI behavior
    if subscription.status != SubscriptionStatus.ACTIVE:
        # EXPIRED subscriptions - return success (idempotent)
        return JSONResponse({
            "success": True,
            "message": "This subscription has already expired.",
            "status": "expired"
        })
    
    paypal_subscription_id = subscription.provider_subscription_id
    if not paypal_subscription_id:
        raise HTTPException(
            status_code=400,
            detail="PayPal subscription ID not found"
        )
    
    # Calculate current_period_end for user messaging
    # Get user data to find trial_ends_at
    user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    trial_ends_at = user.get('trial_ends_at') if user else None
    current_period_end = None
    
    if trial_ends_at:
        # If in trial, period ends when trial ends
        try:
            if isinstance(trial_ends_at, str):
                current_period_end = trial_ends_at
            else:
                current_period_end = trial_ends_at.isoformat()
        except Exception:
            pass
    else:
        # If not in trial, estimate from started_at + 30 days
        try:
            started_at = subscription.started_at
            if isinstance(started_at, str):
                started_at_dt = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
            else:
                started_at_dt = started_at
            # Estimate billing period (30 days from start)
            current_period_end = (started_at_dt + timedelta(days=30)).isoformat()
        except Exception:
            pass
    
    # Attempt to cancel via PayPal API
    try:
        access_token = await get_paypal_access_token()
        if not access_token:
            raise Exception("Failed to authenticate with PayPal")
        
        async with aiohttp.ClientSession() as session:
            # Cancel subscription via PayPal API
            cancel_endpoint = f"/v1/billing/subscriptions/{paypal_subscription_id}/cancel"
            cancel_url = f"{PAYPAL_API_BASE}{cancel_endpoint}"
            cancel_payload = {
                "reason": "User requested cancellation"
            }
            cancel_headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            # AUDIT LOG: BEFORE cancellation request
            await log_paypal_action(
                action="cancel_request",
                paypal_endpoint=cancel_endpoint,
                http_method="POST",
                source="api_call",
                user_id=current_user.id,
                subscription_id=subscription.id,
                paypal_status=None,
                verified=False,
                raw_paypal_response={"request_payload": cancel_payload}
            )
            
            async with session.post(cancel_url, json=cancel_payload, headers=cancel_headers) as cancel_response:
                cancel_status_code = cancel_response.status
                cancel_response_text = await cancel_response.text() if cancel_status_code != 204 else None
                logging.info(f"PayPal cancel API response: status={cancel_status_code}, user={current_user.id}, subscription={subscription.id}")
                
                # AUDIT LOG: AFTER cancellation request
                await log_paypal_action(
                    action="cancel_request_response",
                    paypal_endpoint=cancel_endpoint,
                    http_method="POST",
                    source="api_call",
                    user_id=current_user.id,
                    subscription_id=subscription.id,
                    http_status_code=cancel_status_code,
                    paypal_status=None,
                    verified=False,
                    raw_paypal_response={"response_status": cancel_status_code, "response_text": cancel_response_text}
                )
                
                if cancel_status_code == 204:
                    # Cancellation request accepted by PayPal - now verify status immediately
                    # MANDATORY: PayPal is source of truth - verify before updating local status
                    verify_endpoint = f"/v1/billing/subscriptions/{paypal_subscription_id}"
                    verify_url = f"{PAYPAL_API_BASE}{verify_endpoint}"
                    verify_headers = {
                        'Authorization': f'Bearer {access_token}',
                        'Content-Type': 'application/json'
                    }
                    
                    # AUDIT LOG: BEFORE cancellation verification
                    await log_paypal_action(
                        action="cancel_verify_before",
                        paypal_endpoint=verify_endpoint,
                        http_method="GET",
                        source="api_call",
                        user_id=current_user.id,
                        subscription_id=subscription.id,
                        paypal_status=None,
                        verified=False
                    )
                    
                    async with session.get(verify_url, headers=verify_headers) as verify_response:
                        paypal_verified_status = "UNKNOWN"
                        now = datetime.now(timezone.utc)
                        verify_status_code = verify_response.status
                        
                        if verify_status_code == 200:
                            paypal_details = await verify_response.json()
                            paypal_status = paypal_details.get('status', '').upper()
                            paypal_verified_status = paypal_status if paypal_status in ['ACTIVE', 'CANCELLED'] else "UNKNOWN"
                            
                            # AUDIT LOG: AFTER cancellation verification
                            await log_paypal_action(
                                action="cancel_verify_after",
                                paypal_endpoint=verify_endpoint,
                                http_method="GET",
                                source="api_call",
                                user_id=current_user.id,
                                subscription_id=subscription.id,
                                http_status_code=verify_status_code,
                                paypal_status=paypal_verified_status,
                                verified=(paypal_verified_status == 'CANCELLED'),
                                raw_paypal_response=paypal_details
                            )
                            
                            logging.info(f"PayPal verification after cancel: paypal_status={paypal_status}, subscription={subscription.id}")
                            
                            # CRITICAL: Only update local status if PayPal confirms CANCELLED
                            if paypal_verified_status == 'CANCELLED':
                                # PayPal confirmed cancellation - update local subscription
                                # Store cancellation receipt: cancellation_requested_at, effective_end_date
                                effective_end_dt = None
                                if current_period_end:
                                    try:
                                        if isinstance(current_period_end, str):
                                            effective_end_dt = datetime.fromisoformat(current_period_end.replace('Z', '+00:00'))
                                        else:
                                            effective_end_dt = current_period_end
                                    except Exception:
                                        pass
                                
                                await db.subscriptions.update_one(
                                    {"id": subscription.id},
                                    {
                                        "$set": {
                                            "status": SubscriptionStatus.CANCELLED,
                                            "cancel_at_period_end": True,
                                            "paypal_verified_status": "CANCELLED",
                                            "last_verified_at": now.isoformat(),
                                            "cancelled_at": now.isoformat(),
                                            "cancellation_requested_at": now.isoformat(),  # Receipt: when cancellation was requested
                                            "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else None,  # Receipt: when access ends
                                            "updated_at": now.isoformat()
                                        }
                                    }
                                )
                                logging.info(f"PayPal confirmed cancellation - subscription updated to CANCELLED: user={current_user.id}, subscription={subscription.id}")
                                
                                # Format date for user message
                                period_end_str = current_period_end if current_period_end else 'the end of your billing period'
                                if effective_end_dt:
                                    try:
                                        period_end_str = effective_end_dt.strftime('%B %d, %Y')
                                    except Exception:
                                        period_end_str = current_period_end if current_period_end else 'the end of your billing period'
                                
                                return JSONResponse({
                                    "success": True,
                                    "message": f"Subscription cancelled. PayPal has confirmed the cancellation. No further charges will occur after {period_end_str}. Final billing status is determined by PayPal.",
                                    "status": "cancelled_confirmed",
                                    "paypal_verified": True,
                                    "cancellation_receipt": {
                                        "cancellation_requested_at": now.isoformat(),
                                        "provider_subscription_id": paypal_subscription_id,
                                        "provider": "paypal",
                                        "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else current_period_end
                                    }
                                })
                            else:
                                # PayPal accepted cancellation but status not yet CANCELLED
                                # This can happen for card-only subscriptions or pending cancellation
                                # Store cancellation receipt even if not yet confirmed
                                effective_end_dt = None
                                if current_period_end:
                                    try:
                                        if isinstance(current_period_end, str):
                                            effective_end_dt = datetime.fromisoformat(current_period_end.replace('Z', '+00:00'))
                                        else:
                                            effective_end_dt = current_period_end
                                    except Exception:
                                        pass
                                
                                await db.subscriptions.update_one(
                                    {"id": subscription.id},
                                    {
                                        "$set": {
                                            "cancel_at_period_end": True,
                                            "paypal_verified_status": paypal_verified_status,
                                            "last_verified_at": now.isoformat(),
                                            "cancellation_requested_at": now.isoformat(),  # Receipt: when cancellation was requested
                                            "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else None,  # Receipt: when access ends
                                            "updated_at": now.isoformat()
                                        }
                                    }
                                )
                                
                                # Format date for user message
                                period_end_str = current_period_end if current_period_end else 'the end of your billing period'
                                if effective_end_dt:
                                    try:
                                        period_end_str = effective_end_dt.strftime('%B %d, %Y')
                                    except Exception:
                                        period_end_str = current_period_end if current_period_end else 'the end of your billing period'
                                
                                return JSONResponse({
                                    "success": True,
                                    "message": f"Cancellation request sent. PayPal confirmation pending. Your access remains active until {period_end_str}. No further charges will occur after this date unless you re-subscribe. Final billing status is determined by PayPal.",
                                    "status": "cancellation_pending",
                                    "paypal_verified": False,
                                    "cancellation_receipt": {
                                        "cancellation_requested_at": now.isoformat(),
                                        "provider_subscription_id": paypal_subscription_id,
                                        "provider": "paypal",
                                        "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else current_period_end
                                    }
                                })
                        else:
                            # Could not verify PayPal status - don't assume cancellation succeeded
                            # AUDIT LOG: Verification failed
                            await log_paypal_action(
                                action="cancel_verify_failed",
                                paypal_endpoint=verify_endpoint,
                                http_method="GET",
                                source="api_call",
                                user_id=current_user.id,
                                subscription_id=subscription.id,
                                http_status_code=verify_status_code,
                                paypal_status="UNKNOWN",
                                verified=False,
                                raw_paypal_response={"error": f"HTTP {verify_status_code}"}
                            )
                            logging.warning(f"Could not verify PayPal status after cancellation: status={verify_status_code}, subscription={subscription.id}")
                            effective_end_dt = None
                            if current_period_end:
                                try:
                                    if isinstance(current_period_end, str):
                                        effective_end_dt = datetime.fromisoformat(current_period_end.replace('Z', '+00:00'))
                                    else:
                                        effective_end_dt = current_period_end
                                except Exception:
                                    pass
                            
                            await db.subscriptions.update_one(
                                {"id": subscription.id},
                                {
                                    "$set": {
                                        "cancel_at_period_end": True,
                                        "paypal_verified_status": "UNKNOWN",
                                        "last_verified_at": now.isoformat(),
                                        "cancellation_requested_at": now.isoformat(),  # Receipt: when cancellation was requested
                                        "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else None,  # Receipt: when access ends
                                        "updated_at": now.isoformat()
                                    }
                                }
                            )
                            
                            return JSONResponse({
                                "success": True,
                                "message": f"Cancellation request sent. PayPal confirmation pending. Your access remains active until {current_period_end or 'the end of your billing period'}. No further charges will occur after this date unless you re-subscribe. Final billing status is determined by PayPal.",
                                "status": "cancellation_pending",
                                "paypal_verified": False,
                                "cancellation_receipt": {
                                    "cancellation_requested_at": now.isoformat(),
                                    "provider_subscription_id": paypal_subscription_id,
                                    "provider": "paypal",
                                    "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else current_period_end
                                }
                            })
                else:
                    # PayPal API returned non-204 status - cancellation request not accepted
                    cancel_error = await cancel_response.text()
                    logging.warning(f"PayPal cancellation API failed: status={cancel_status_code}, error={cancel_error}, subscription={subscription.id}")
                    
                    # Fallback: Set cancel intent but don't mark as CANCELLED (PayPal didn't confirm)
                    now = datetime.now(timezone.utc)
                    effective_end_dt = None
                    if current_period_end:
                        try:
                            if isinstance(current_period_end, str):
                                effective_end_dt = datetime.fromisoformat(current_period_end.replace('Z', '+00:00'))
                            else:
                                effective_end_dt = current_period_end
                        except Exception:
                            pass
                    
                    await db.subscriptions.update_one(
                        {"id": subscription.id},
                        {
                            "$set": {
                                "cancel_at_period_end": True,
                                "paypal_verified_status": "UNKNOWN",
                                "last_verified_at": now.isoformat(),
                                "cancellation_requested_at": now.isoformat(),  # Receipt: when cancellation was requested
                                "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else None,  # Receipt: when access ends
                                "updated_at": now.isoformat()
                            }
                        }
                    )
                    
                    return JSONResponse({
                        "success": True,
                        "message": f"Cancellation request sent. PayPal confirmation pending. Your access remains active until {current_period_end or 'the end of your billing period'}. No further charges will occur after this date unless you re-subscribe. Final billing status is determined by PayPal.",
                        "status": "cancellation_pending",
                        "paypal_verified": False,
                        "cancellation_receipt": {
                            "cancellation_requested_at": now.isoformat(),
                            "provider_subscription_id": paypal_subscription_id,
                            "provider": "paypal",
                            "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else current_period_end
                        }
                    })
    
    except Exception as e:
        error_message = str(e)
        logging.error(f"Error cancelling PayPal subscription for user {current_user.id}: {error_message}")
        
        # API call failed - set cancel intent but mark verification as UNKNOWN
        # Never assume cancellation succeeded without PayPal confirmation
        now = datetime.now(timezone.utc)
        effective_end_dt = None
        if current_period_end:
            try:
                if isinstance(current_period_end, str):
                    effective_end_dt = datetime.fromisoformat(current_period_end.replace('Z', '+00:00'))
                else:
                    effective_end_dt = current_period_end
            except Exception:
                pass
        
        await db.subscriptions.update_one(
            {"id": subscription.id},
            {
                "$set": {
                    "cancel_at_period_end": True,
                    "paypal_verified_status": "UNKNOWN",
                    "last_verified_at": now.isoformat(),
                    "cancellation_requested_at": now.isoformat(),  # Receipt: when cancellation was requested
                    "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else None,  # Receipt: when access ends
                    "updated_at": now.isoformat()
                }
            }
        )
        
        return JSONResponse({
            "success": True,
            "message": f"Cancellation request sent. PayPal confirmation pending. Your access remains active until {current_period_end or 'the end of your billing period'}. No further charges will occur after this date unless you re-subscribe. Final billing status is determined by PayPal.",
            "status": "cancellation_pending",
            "paypal_verified": False,
            "cancellation_receipt": {
                "cancellation_requested_at": now.isoformat(),
                "provider_subscription_id": paypal_subscription_id,
                "provider": "paypal",
                "effective_end_date": effective_end_dt.isoformat() if effective_end_dt else current_period_end
            }
        })

# PayPal Webhook Event
class PayPalWebhookEvent(BaseModel):
    event_type: str
    resource: Dict[str, Any]
    id: str
    create_time: str

# Processed Webhook Event (for idempotency)
class ProcessedWebhookEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paypal_event_id: str  # PayPal's event ID
    event_type: str
    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    subscription_id: Optional[str] = None  # Our subscription ID if applicable
    # TTL: Events older than 90 days are eligible for cleanup (managed by MongoDB TTL index or periodic cleanup)

# PayPal Audit Log (for forensic-grade logging of all PayPal interactions)
class PayPalAuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    subscription_id: Optional[str] = None
    action: str  # create_subscription, activate, verify_activation, trial_start, renewal_check, cancel_request, cancel_verify, suspend, expire, reconcile
    paypal_endpoint: str  # e.g., "/v1/billing/subscriptions/{id}"
    http_method: str  # GET, POST, etc.
    http_status_code: Optional[int] = None
    paypal_status: Optional[str] = None  # ACTIVE, PENDING, CANCELLED, EXPIRED, SUSPENDED, UNKNOWN
    raw_paypal_response: Optional[Dict[str, Any]] = None  # Full PayPal API response (JSON)
    verified: bool = False  # Whether PayPal confirmed the action
    source: str  # api_call, webhook, reconciliation
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.post("/billing/paypal/subscribe")
async def subscribe_paypal(
    request: PayPalSubscribeRequest,
    current_user: User = Depends(require_email_verified)
):
    """
    Create a PayPal subscription record.
    Status is set to PENDING until webhook confirms activation.
    """
    subscription_id = request.subscriptionID
    
    # CRITICAL: Idempotency check - prevent duplicate subscriptions
    # Check if user already has an active or pending subscription with this PayPal subscription ID
    existing_by_paypal_id = await db.subscriptions.find_one(
        {
            "provider_subscription_id": subscription_id,
            "provider": "paypal"
        },
        {"_id": 0}
    )
    
    if existing_by_paypal_id:
        # Subscription already exists - return success (idempotent)
        logging.info(f"PayPal subscription {subscription_id} already exists: subscription={existing_by_paypal_id['id']}, user={current_user.id}")
        return JSONResponse({
            "success": True,
            "subscription_id": existing_by_paypal_id['id'],
            "message": "Subscription already exists. Access will be activated when PayPal confirms payment."
        })
    
    # Also check if user has any active/pending subscription (different PayPal ID)
    existing_subscription = await db.subscriptions.find_one(
        {
            "user_id": current_user.id,
            "status": {"$in": [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING]},
            "provider": "paypal"
        },
        {"_id": 0}
    )
    
    if existing_subscription:
        raise HTTPException(
            status_code=400,
            detail="You already have an active or pending subscription. Please cancel it first."
        )
    
    # Get Pro plan
    pro_plan = await db.plans.find_one({"name": "pro"}, {"_id": 0})
    if not pro_plan:
        raise HTTPException(status_code=500, detail="Pro plan not found")
    
    # Create subscription record with PENDING status
    # CRITICAL: Do NOT upgrade user to Pro here - only webhook can do that
    subscription = Subscription(
        user_id=current_user.id,
        plan_id=pro_plan['id'],
        status=SubscriptionStatus.PENDING,
        provider="paypal",
        provider_subscription_id=subscription_id
    )
    
    subscription_dict = subscription.model_dump()
    subscription_dict['created_at'] = subscription_dict['created_at'].isoformat()
    subscription_dict['updated_at'] = subscription_dict['updated_at'].isoformat()
    subscription_dict['started_at'] = subscription_dict['started_at'].isoformat()
    
    await db.subscriptions.insert_one(subscription_dict)
    
    # Store subscription_id reference only - do NOT upgrade plan
    await db.users.update_one(
        {"id": current_user.id},
        {
            "$set": {
                "subscription_id": subscription.id
                # NOTE: plan_id is NOT updated here - only webhook can upgrade
            }
        }
    )
    
    # AUDIT LOG: Subscription creation (no PayPal API call, but logs creation)
    await log_paypal_action(
        action="create_subscription",
        paypal_endpoint=f"/v1/billing/subscriptions/{subscription_id}",
        http_method="N/A",
        source="api_call",
        user_id=current_user.id,
        subscription_id=subscription.id,
        paypal_status="PENDING",
        verified=False,
        raw_paypal_response={"subscription_id": subscription_id, "status": "PENDING"}
    )
    
    logging.info(f"PayPal subscription created: user={current_user.id}, subscription_id={subscription.id}, paypal_subscription_id={subscription_id}")
    
    return JSONResponse({
        "success": True,
        "subscription_id": subscription.id,
        "message": "Subscription created. Access will be activated when PayPal confirms payment."
    })

async def get_paypal_access_token() -> Optional[str]:
    """
    Get PayPal OAuth access token for API calls.
    Returns access token or None if authentication fails.
    """
    if not all([PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET]):
        logging.error("PayPal credentials not configured")
        return None
    
    try:
        async with aiohttp.ClientSession() as session:
            auth_url = f"{PAYPAL_API_BASE}/v1/oauth2/token"
            auth_data = aiohttp.FormData()
            auth_data.add_field('grant_type', 'client_credentials')
            
            auth_string = base64.b64encode(f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode()).decode()
            auth_headers = {
                'Authorization': f'Basic {auth_string}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            async with session.post(auth_url, data=auth_data, headers=auth_headers) as auth_response:
                if auth_response.status != 200:
                    logging.error(f"Failed to get PayPal access token: {auth_response.status}")
                    return None
                
                auth_data = await auth_response.json()
                access_token = auth_data.get('access_token')
                return access_token
    except Exception as e:
        logging.error(f"Error getting PayPal access token: {str(e)}")
        return None

async def log_paypal_action(
    action: str,
    paypal_endpoint: str,
    http_method: str,
    source: str,
    user_id: Optional[str] = None,
    subscription_id: Optional[str] = None,
    http_status_code: Optional[int] = None,
    paypal_status: Optional[str] = None,
    raw_paypal_response: Optional[Dict[str, Any]] = None,
    verified: bool = False
) -> str:
    """
    Forensic-grade audit logging for all PayPal interactions.
    Logs MUST be immutable (append-only).
    
    This is the single source of truth for PayPal payment actions.
    All PayPal API calls, webhooks, and reconciliations must call this function.
    """
    audit_log = PayPalAuditLog(
        user_id=user_id,
        subscription_id=subscription_id,
        action=action,
        paypal_endpoint=paypal_endpoint,
        http_method=http_method,
        http_status_code=http_status_code,
        paypal_status=paypal_status,
        raw_paypal_response=raw_paypal_response,
        verified=verified,
        source=source
    )
    
    audit_log_dict = audit_log.model_dump()
    audit_log_dict['created_at'] = audit_log_dict['created_at'].isoformat()
    
    # Store raw_paypal_response as JSON string for efficient storage
    # MongoDB can handle dict directly, but we'll keep it as dict for queryability
    if audit_log_dict.get('raw_paypal_response'):
        # Ensure it's JSON-serializable (already a dict)
        pass
    
    await db.paypal_audit_logs.insert_one(audit_log_dict)
    
    logging.info(f"[PayPal Audit] {action} | {source} | {http_method} {paypal_endpoint} | Status: {http_status_code} | PayPal Status: {paypal_status} | Verified: {verified} | User: {user_id} | Subscription: {subscription_id}")
    
    return audit_log.id

async def get_paypal_subscription_details(paypal_subscription_id: str, user_id: Optional[str] = None, subscription_id: Optional[str] = None, action: str = "verify_activation", source: str = "api_call") -> Optional[Dict[str, Any]]:
    """
    Fetch subscription details from PayPal API.
    Returns subscription details dict or None if fetch fails.
    
    AUDIT LOGGING: All calls to this function are logged before and after.
    """
    endpoint = f"/v1/billing/subscriptions/{paypal_subscription_id}"
    
    # AUDIT LOG: BEFORE PayPal API call
    await log_paypal_action(
        action=f"{action}_before",
        paypal_endpoint=endpoint,
        http_method="GET",
        source=source,
        user_id=user_id,
        subscription_id=subscription_id,
        paypal_status=None,
        verified=False
    )
    
    access_token = await get_paypal_access_token()
    if not access_token:
        # AUDIT LOG: Failed to get access token
        await log_paypal_action(
            action=f"{action}_failed",
            paypal_endpoint=endpoint,
            http_method="GET",
            source=source,
            user_id=user_id,
            subscription_id=subscription_id,
            http_status_code=None,
            paypal_status="UNKNOWN",
            verified=False,
            raw_paypal_response={"error": "Failed to get PayPal access token"}
        )
        return None
    
    try:
        async with aiohttp.ClientSession() as session:
            subscription_url = f"{PAYPAL_API_BASE}{endpoint}"
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            async with session.get(subscription_url, headers=headers) as response:
                response_status = response.status
                paypal_status = None
                raw_response = None
                
                if response_status == 200:
                    subscription_details = await response.json()
                    raw_response = subscription_details
                    paypal_status = subscription_details.get('status', '').upper() if subscription_details else None
                    
                    # AUDIT LOG: AFTER successful PayPal API call
                    await log_paypal_action(
                        action=f"{action}_after",
                        paypal_endpoint=endpoint,
                        http_method="GET",
                        source=source,
                        user_id=user_id,
                        subscription_id=subscription_id,
                        http_status_code=response_status,
                        paypal_status=paypal_status,
                        verified=(paypal_status in ['ACTIVE', 'CANCELLED', 'EXPIRED', 'SUSPENDED']),
                        raw_paypal_response=raw_response
                    )
                    
                    return subscription_details
                else:
                    error_text = await response.text()
                    raw_response = {"error": error_text, "status_code": response_status}
                    
                    # AUDIT LOG: AFTER failed PayPal API call
                    await log_paypal_action(
                        action=f"{action}_failed",
                        paypal_endpoint=endpoint,
                        http_method="GET",
                        source=source,
                        user_id=user_id,
                        subscription_id=subscription_id,
                        http_status_code=response_status,
                        paypal_status="UNKNOWN",
                        verified=False,
                        raw_paypal_response=raw_response
                    )
                    
                    logging.error(f"Failed to fetch PayPal subscription details: status={response_status}")
                    return None
    except Exception as e:
        error_msg = str(e)
        # AUDIT LOG: Exception during PayPal API call
        await log_paypal_action(
            action=f"{action}_exception",
            paypal_endpoint=endpoint,
            http_method="GET",
            source=source,
            user_id=user_id,
            subscription_id=subscription_id,
            http_status_code=None,
            paypal_status="UNKNOWN",
            verified=False,
            raw_paypal_response={"error": error_msg, "exception": True}
        )
        logging.error(f"Error fetching PayPal subscription details: {error_msg}")
        return None

async def reconcile_pending_subscription(subscription: Subscription) -> Optional[Subscription]:
    """
    Reconcile PENDING subscription with PayPal API.
    If PayPal status is ACTIVE, update local subscription to ACTIVE.
    
    Rules:
    - Only reconciles PENDING subscriptions
    - Idempotent (safe to call multiple times)
    - Fails silently if PayPal API unavailable
    - Never downgrades
    - Returns updated subscription if reconciled, None otherwise
    """
    # Only reconcile PENDING subscriptions
    if subscription.status != SubscriptionStatus.PENDING:
        return None
    
    # Only reconcile PayPal subscriptions
    if subscription.provider != 'paypal':
        return None
    
    # Must have PayPal subscription ID
    if not subscription.provider_subscription_id:
        logging.warning(f"Cannot reconcile subscription {subscription.id}: missing provider_subscription_id")
        return None
    
    try:
        # Fetch subscription details from PayPal
        paypal_details = await get_paypal_subscription_details(
            subscription.provider_subscription_id,
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            action="reconcile",
            source="reconciliation"
        )
        if not paypal_details:
            # PayPal API unavailable or subscription not found - fail silently
            logging.warning(f"PayPal reconciliation: Could not fetch details for subscription {subscription.id} (PayPal ID: {subscription.provider_subscription_id})")
            return None
        
        # Check PayPal subscription status
        paypal_status = paypal_details.get('status', '').upper()
        
        # If PayPal says ACTIVE, update local subscription
        if paypal_status == 'ACTIVE':
            logging.info(f"PayPal reconciliation: Subscription {subscription.id} is ACTIVE in PayPal, updating local status")
            
            # Get trial end date from PayPal billing schedule
            trial_ends_at = None
            billing_info = paypal_details.get('billing_info')
            if billing_info and billing_info.get('next_billing_time'):
                trial_ends_at = billing_info['next_billing_time']
            
            # Get Pro plan
            pro_plan = await db.plans.find_one({"name": "pro"}, {"_id": 0})
            if not pro_plan:
                logging.error(f"PayPal reconciliation: Pro plan not found, cannot upgrade subscription {subscription.id}")
                return None
            
            # Update subscription status to ACTIVE
            update_data = {
                "status": SubscriptionStatus.ACTIVE,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Ensure subscription plan_id is Pro (safety check)
            if subscription.plan_id != pro_plan['id']:
                update_data["plan_id"] = pro_plan['id']
                logging.warning(f"PayPal reconciliation: Subscription {subscription.id} plan_id mismatch, correcting to Pro")
            
            await db.subscriptions.update_one(
                {"id": subscription.id},
                {"$set": update_data}
            )
            
            # Upgrade user to Pro plan
            user_update_data = {
                "plan_id": pro_plan['id']
            }
            if trial_ends_at:
                user_update_data["trial_ends_at"] = trial_ends_at
            
            await db.users.update_one(
                {"id": subscription.user_id},
                {"$set": user_update_data}
            )
            
            # AUDIT LOG: Reconciliation successful - subscription activated
            await log_paypal_action(
                action="reconcile_success",
                paypal_endpoint=f"/v1/billing/subscriptions/{subscription.provider_subscription_id}",
                http_method="GET",
                source="reconciliation",
                user_id=subscription.user_id,
                subscription_id=subscription.id,
                http_status_code=200,
                paypal_status="ACTIVE",
                verified=True,
                raw_paypal_response=paypal_details
            )
            
            logging.info(f"PayPal reconciliation: Subscription {subscription.id} reconciled to ACTIVE, user {subscription.user_id} upgraded to Pro")
            
            # Return updated subscription object
            updated_sub = await db.subscriptions.find_one({"id": subscription.id}, {"_id": 0})
            if updated_sub:
                return Subscription(**updated_sub)
        else:
            # PayPal status is not ACTIVE - leave as PENDING
            # AUDIT LOG: Reconciliation checked but status not ACTIVE
            await log_paypal_action(
                action="reconcile_no_action",
                paypal_endpoint=f"/v1/billing/subscriptions/{subscription.provider_subscription_id}",
                http_method="GET",
                source="reconciliation",
                user_id=subscription.user_id,
                subscription_id=subscription.id,
                http_status_code=200,
                paypal_status=paypal_status,
                verified=(paypal_status in ['CANCELLED', 'EXPIRED', 'SUSPENDED']),
                raw_paypal_response=paypal_details
            )
            logging.debug(f"PayPal reconciliation: Subscription {subscription.id} status in PayPal is {paypal_status}, leaving as PENDING")
            return None
            
    except Exception as e:
        # Fail silently on errors (PayPal API might be temporarily unavailable)
        logging.error(f"PayPal reconciliation error for subscription {subscription.id}: {str(e)}")
        return None
    
    return None

async def verify_paypal_webhook_signature(
    webhook_id: str,
    transmission_id: str,
    cert_url: str,
    auth_algo: str,
    transmission_sig: str,
    transmission_time: str,
    webhook_body: bytes
) -> bool:
    """
    Verify PayPal webhook signature using PayPal's verify-webhook-signature API.
    Returns True if verification succeeds, False otherwise.
    """
    if not all([PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, webhook_id]):
        logging.error("PayPal credentials not configured - cannot verify webhook signature")
        return False
    
    try:
        # Get PayPal access token using helper function
        access_token = await get_paypal_access_token()
        if not access_token:
            return False
        
        async with aiohttp.ClientSession() as session:
            
            # Verify webhook signature
            verify_url = f"{PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature"
            verify_payload = {
                "auth_algo": auth_algo,
                "cert_url": cert_url,
                "transmission_id": transmission_id,
                "transmission_sig": transmission_sig,
                "transmission_time": transmission_time,
                "webhook_id": webhook_id,
                "webhook_event": json.loads(webhook_body.decode('utf-8'))
            }
            
            verify_headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            async with session.post(verify_url, json=verify_payload, headers=verify_headers) as verify_response:
                if verify_response.status != 200:
                    logging.error(f"PayPal webhook verification failed: {verify_response.status}")
                    return False
                
                verify_result = await verify_response.json()
                verification_status = verify_result.get('verification_status')
                
                if verification_status == 'SUCCESS':
                    logging.info("PayPal webhook signature verified successfully")
                    return True
                else:
                    logging.error(f"PayPal webhook signature verification failed: {verification_status}")
                    return False
    
    except Exception as e:
        logging.error(f"Error verifying PayPal webhook signature: {str(e)}", exc_info=True)
        return False

@api_router.post("/billing/paypal/webhook")
async def paypal_webhook(
    request: Request,
    paypal_transmission_id: str = Header(None, alias="PAYPAL-TRANSMISSION-ID"),
    paypal_cert_url: str = Header(None, alias="PAYPAL-CERT-URL"),
    paypal_auth_algo: str = Header(None, alias="PAYPAL-AUTH-ALGO"),
    paypal_transmission_sig: str = Header(None, alias="PAYPAL-TRANSMISSION-SIG"),
    paypal_transmission_time: str = Header(None, alias="PAYPAL-TRANSMISSION-TIME")
):
    """
    Handle PayPal webhook events.
    Verifies webhook signature and processes subscription events.
    """
    try:
        body = await request.body()
        webhook_data = json.loads(body)
        
        event_type = webhook_data.get('event_type')
        event_id = webhook_data.get('id')
        resource = webhook_data.get('resource', {})
        
        if not event_id:
            logging.error("PayPal webhook missing event ID")
            return JSONResponse({"status": "error", "message": "Missing event ID"}, status_code=400)
        
        # Idempotency check - ignore duplicate events
        existing_event = await db.processed_webhook_events.find_one(
            {"paypal_event_id": event_id},
            {"_id": 0}
        )
        if existing_event:
            logging.info(f"PayPal webhook event already processed: {event_id}")
            return JSONResponse({"status": "success", "message": "Event already processed"})
        
        logging.info(f"PayPal webhook received: event_type={event_type}, event_id={event_id}, resource_id={resource.get('id')}")
        
        # Verify webhook signature (CRITICAL for security)
        if not all([paypal_transmission_id, paypal_cert_url, paypal_auth_algo, paypal_transmission_sig, paypal_transmission_time]):
            logging.error("PayPal webhook missing required headers for signature verification")
            return JSONResponse({"status": "error", "message": "Missing webhook headers"}, status_code=400)
        
        if not PAYPAL_WEBHOOK_ID:
            logging.error("PAYPAL_WEBHOOK_ID not configured - cannot verify webhook")
            return JSONResponse({"status": "error", "message": "Webhook not configured"}, status_code=500)
        
        signature_valid = await verify_paypal_webhook_signature(
            webhook_id=PAYPAL_WEBHOOK_ID,
            transmission_id=paypal_transmission_id,
            cert_url=paypal_cert_url,
            auth_algo=paypal_auth_algo,
            transmission_sig=paypal_transmission_sig,
            transmission_time=paypal_transmission_time,
            webhook_body=body
        )
        
        if not signature_valid:
            logging.error(f"PayPal webhook signature verification failed for event {event_id}")
            return JSONResponse({"status": "error", "message": "Invalid webhook signature"}, status_code=401)
        
        # AUDIT LOG: Webhook received (before processing)
        await log_paypal_action(
            action="webhook_received",
            paypal_endpoint="/v1/notifications/webhooks",
            http_method="POST",
            source="webhook",
            http_status_code=None,
            paypal_status=None,
            verified=False,
            raw_paypal_response=webhook_data
        )
        
        # Process webhook events
        subscription_id = None
        
        if event_type == "BILLING.SUBSCRIPTION.ACTIVATED":
            # Subscription activated - upgrade user to Pro
            # CRITICAL: This is the ONLY place where user gets upgraded to Pro
            paypal_subscription_id = resource.get('id')
            if not paypal_subscription_id:
                logging.error("PayPal webhook: BILLING.SUBSCRIPTION.ACTIVATED missing subscription ID")
                return JSONResponse({"status": "error", "message": "Missing subscription ID"})
            
            # Find subscription by PayPal subscription ID
            subscription = await db.subscriptions.find_one(
                {"provider_subscription_id": paypal_subscription_id, "provider": "paypal"},
                {"_id": 0}
            )
            
            if subscription:
                logging.info(f"PayPal webhook: Found subscription for PayPal ID {paypal_subscription_id}: subscription_id={subscription['id']}, user_id={subscription['user_id']}, plan_id={subscription['plan_id']}")
                
                # Verify subscription plan_id is Pro plan
                pro_plan = await db.plans.find_one({"name": "pro"}, {"_id": 0})
                if not pro_plan:
                    logging.error(f"Pro plan not found in database - cannot upgrade user")
                    return JSONResponse({"status": "error", "message": "Pro plan not found"})
                
                # Ensure subscription plan_id is Pro (fix if incorrect)
                if subscription['plan_id'] != pro_plan['id']:
                    logging.warning(f"Subscription plan_id {subscription['plan_id']} does not match Pro plan {pro_plan['id']} - updating to Pro plan")
                    await db.subscriptions.update_one(
                        {"id": subscription['id']},
                        {"$set": {"plan_id": pro_plan['id']}}
                    )
                    subscription['plan_id'] = pro_plan['id']  # Update local variable
                
                # Fetch subscription details from PayPal to get actual billing schedule
                paypal_subscription_details = await get_paypal_subscription_details(
                    paypal_subscription_id,
                    user_id=subscription['user_id'],
                    subscription_id=subscription['id'],
                    action="activate",
                    source="webhook"
                )
                
                # Extract trial end date from PayPal's billing_info.next_billing_time
                # CRITICAL: Trial length must come from PayPal plan, not hardcoded
                trial_ends_at = None
                if paypal_subscription_details:
                    billing_info = paypal_subscription_details.get('billing_info')
                    if billing_info and billing_info.get('next_billing_time'):
                        # next_billing_time indicates when the first billing will occur (end of trial)
                        trial_ends_at = billing_info['next_billing_time']
                        logging.info(f"Trial end date from PayPal billing_info.next_billing_time: {trial_ends_at}")
                    else:
                        # Fallback: If billing_info is not yet available (may take a few minutes),
                        # check cycle_executions for trial information
                        cycle_executions = billing_info.get('cycle_executions', []) if billing_info else []
                        for cycle in cycle_executions:
                            if cycle.get('tenure_type') == 'TRIAL' and cycle.get('cycles_remaining', 0) > 0:
                                # Trial is active - next_billing_time should be set when available
                                logging.warning(f"Trial cycle found but next_billing_time not available yet for subscription {paypal_subscription_id}")
                                break
                
                if not trial_ends_at:
                    # Fallback: If we can't get next_billing_time from PayPal (shouldn't happen),
                    # log warning but don't set trial - let it be handled by subscription status
                    logging.warning(f"Could not determine trial end date from PayPal for subscription {paypal_subscription_id}. Subscription activated but trial_ends_at not set.")
                    # Don't set trial_ends_at - user will have Pro access via subscription status
                    trial_ends_at = None
                
                # Update subscription status to ACTIVE
                # Webhook confirms PayPal status - mark as verified
                now = datetime.now(timezone.utc)
                await db.subscriptions.update_one(
                    {"id": subscription['id']},
                    {
                        "$set": {
                            "status": SubscriptionStatus.ACTIVE,
                            "paypal_verified_status": "ACTIVE",  # Webhook confirms PayPal status
                            "last_verified_at": now.isoformat(),
                            "started_at": now.isoformat(),
                            "updated_at": now.isoformat()
                        }
                    }
                )
                
                # Upgrade user to Pro plan (ONLY place this happens)
                # CRITICAL: Use pro_plan['id'] directly to ensure it's correct
                update_data = {
                    "plan_id": pro_plan['id']
                }
                if trial_ends_at:
                    update_data["trial_ends_at"] = trial_ends_at
                
                result = await db.users.update_one(
                    {"id": subscription['user_id']},
                    {"$set": update_data}
                )
                
                # AUDIT LOG: Activation complete
                await log_paypal_action(
                    action="activate",
                    paypal_endpoint=f"/v1/billing/subscriptions/{paypal_subscription_id}",
                    http_method="POST",
                    source="webhook",
                    user_id=subscription['user_id'],
                    subscription_id=subscription['id'],
                    http_status_code=None,
                    paypal_status="ACTIVE",
                    verified=True,
                    raw_paypal_response={"event_type": event_type, "event_id": event_id, "trial_ends_at": trial_ends_at}
                )
                
                logging.info(f"User {subscription['user_id']} upgraded to Pro plan: plan_id={pro_plan['id']}, trial_ends_at={trial_ends_at}, update_result={result.modified_count}")
                
                if trial_ends_at:
                    logging.info(f"Pro subscription activated with trial ending at {trial_ends_at} (from PayPal billing_info.next_billing_time): user={subscription['user_id']}")
                else:
                    logging.info(f"Pro subscription activated (trial end date not available from PayPal yet): user={subscription['user_id']}")
                subscription_id = subscription['id']
                logging.info(f"PayPal subscription activated: user={subscription['user_id']}, subscription={subscription['id']}")
            else:
                # Log all PayPal subscriptions to help debug
                all_paypal_subs = await db.subscriptions.find(
                    {"provider": "paypal"},
                    {"provider_subscription_id": 1, "user_id": 1, "status": 1, "_id": 0}
                ).to_list(20)
                logging.error(f"PayPal webhook: Subscription not found for PayPal ID: {paypal_subscription_id}. Available PayPal subscriptions: {all_paypal_subs}")
        
        elif event_type == "BILLING.SUBSCRIPTION.CANCELLED":
            # Subscription cancelled - mark as CANCELLED but do NOT downgrade immediately
            # User keeps Pro access until EXPIRED (end of billing period)
            #
            # IMPORTANT: This applies to ALL subscription types:
            # - PayPal account subscriptions
            # - Card-only (guest checkout) subscriptions
            # Both types can be cancelled, and both keep access until billing period ends
            #
            # GUARD: Never downgrade here - downgrade only on EXPIRED webhook
            paypal_subscription_id = resource.get('id')
            if not paypal_subscription_id:
                logging.error("PayPal webhook: BILLING.SUBSCRIPTION.CANCELLED missing subscription ID")
                return JSONResponse({"status": "error", "message": "Missing subscription ID"})
            
            subscription = await db.subscriptions.find_one(
                {"provider_subscription_id": paypal_subscription_id, "provider": "paypal"},
                {"_id": 0}
            )
            
            if subscription:
                # Update subscription status to CANCELLED
                # CRITICAL: Do NOT downgrade user to Free - user keeps access until EXPIRED
                # Webhook confirms PayPal status - mark as verified
                now = datetime.now(timezone.utc)
                await db.subscriptions.update_one(
                    {"id": subscription['id']},
                    {
                        "$set": {
                            "status": SubscriptionStatus.CANCELLED,
                            "cancel_at_period_end": True,  # Ensure flag is set
                            "paypal_verified_status": "CANCELLED",  # Webhook confirms PayPal status
                            "last_verified_at": now.isoformat(),
                            "cancelled_at": now.isoformat(),
                            "updated_at": now.isoformat()
                        }
                    }
                )
                subscription_id = subscription['id']
                
                # AUDIT LOG: Cancellation webhook
                await log_paypal_action(
                    action="cancel_webhook",
                    paypal_endpoint=f"/v1/billing/subscriptions/{paypal_subscription_id}",
                    http_method="POST",
                    source="webhook",
                    user_id=subscription['user_id'],
                    subscription_id=subscription['id'],
                    http_status_code=None,
                    paypal_status="CANCELLED",
                    verified=True,
                    raw_paypal_response={"event_type": event_type, "event_id": event_id}
                )
                
                logging.info(f"PayPal subscription cancelled (webhook verified): user={subscription['user_id']}, subscription={subscription['id']} - access continues until billing period ends")
        
        elif event_type == "BILLING.SUBSCRIPTION.SUSPENDED":
            # Subscription suspended - mark as CANCELLED but do NOT downgrade immediately
            # User keeps Pro access until EXPIRED (same as CANCELLED)
            paypal_subscription_id = resource.get('id')
            if not paypal_subscription_id:
                logging.error("PayPal webhook: BILLING.SUBSCRIPTION.SUSPENDED missing subscription ID")
                return JSONResponse({"status": "error", "message": "Missing subscription ID"})
            
            subscription = await db.subscriptions.find_one(
                {"provider_subscription_id": paypal_subscription_id, "provider": "paypal"},
                {"_id": 0}
            )
            
            if subscription:
                # Update subscription status to CANCELLED (treat suspended as cancelled)
                # CRITICAL: Do NOT downgrade user - downgrade only on EXPIRED
                await db.subscriptions.update_one(
                    {"id": subscription['id']},
                    {
                        "$set": {
                            "status": SubscriptionStatus.CANCELLED,
                            "cancelled_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                subscription_id = subscription['id']
                
                # AUDIT LOG: Suspension webhook
                await log_paypal_action(
                    action="suspend",
                    paypal_endpoint=f"/v1/billing/subscriptions/{paypal_subscription_id}",
                    http_method="POST",
                    source="webhook",
                    user_id=subscription['user_id'],
                    subscription_id=subscription['id'],
                    http_status_code=None,
                    paypal_status="SUSPENDED",
                    verified=True,
                    raw_paypal_response={"event_type": event_type, "event_id": event_id}
                )
                
                logging.info(f"PayPal subscription suspended (marked as CANCELLED): user={subscription['user_id']}, subscription={subscription['id']} - access continues until EXPIRED")
        
        elif event_type == "BILLING.SUBSCRIPTION.EXPIRED":
            # Subscription expired - downgrade user to Free
            paypal_subscription_id = resource.get('id')
            if not paypal_subscription_id:
                logging.error("PayPal webhook: BILLING.SUBSCRIPTION.EXPIRED missing subscription ID")
                return JSONResponse({"status": "error", "message": "Missing subscription ID"})
            
            subscription = await db.subscriptions.find_one(
                {"provider_subscription_id": paypal_subscription_id, "provider": "paypal"},
                {"_id": 0}
            )
            
            if subscription:
                # Update subscription status to EXPIRED
                # Webhook confirms PayPal status - mark as verified
                now = datetime.now(timezone.utc)
                await db.subscriptions.update_one(
                    {"id": subscription['id']},
                    {
                        "$set": {
                            "status": SubscriptionStatus.EXPIRED,
                            "paypal_verified_status": "CANCELLED",  # EXPIRED means subscription ended
                            "last_verified_at": now.isoformat(),
                            "cancelled_at": now.isoformat(),
                            "updated_at": now.isoformat()
                        }
                    }
                )
                
                # CRITICAL: EXPIRED is the ONLY webhook that downgrades user to Free
                # This happens after billing period ends (trial or regular billing)
                # 
                # IMPORTANT: This applies to ALL subscription types:
                # - PayPal account subscriptions
                # - Card-only (guest checkout) subscriptions
                # Both types auto-renew via PayPal until cancelled, and both downgrade on EXPIRED
                #
                # GUARD: Only downgrade here - never downgrade on CANCELLED, SUSPENDED, or PAYMENT FAILED
                free_plan = await db.plans.find_one({"name": "free"}, {"_id": 0})
                if free_plan:
                    await db.users.update_one(
                        {"id": subscription['user_id']},
                        {
                            "$set": {"plan_id": free_plan['id']},
                            "$unset": {"trial_ends_at": ""}  # Clear trial_ends_at when downgrading
                        }
                    )
                subscription_id = subscription['id']
                
                # AUDIT LOG: Expiration webhook
                await log_paypal_action(
                    action="expire",
                    paypal_endpoint=f"/v1/billing/subscriptions/{paypal_subscription_id}",
                    http_method="POST",
                    source="webhook",
                    user_id=subscription['user_id'],
                    subscription_id=subscription['id'],
                    http_status_code=None,
                    paypal_status="EXPIRED",
                    verified=True,
                    raw_paypal_response={"event_type": event_type, "event_id": event_id}
                )
                
                logging.info(f"PayPal subscription expired - user downgraded to Free: user={subscription['user_id']}, subscription={subscription['id']}")
        
        elif event_type in ["PAYMENT.SALE.DENIED", "PAYMENT.SALE.FAILED"]:
            # Payment failed/denied - log warning but do NOT downgrade
            # PayPal will send EXPIRED webhook when subscription actually expires
            # GUARD: Never downgrade on payment failure - downgrade only on EXPIRED
            # Payment failed - log warning
            # CRITICAL: Do NOT downgrade user here - PayPal will send EXPIRED webhook when subscription actually expires
            # User keeps Pro access until EXPIRED webhook is received
            paypal_subscription_id = resource.get('billing_agreement_id') or resource.get('id')
            if not paypal_subscription_id:
                logging.error(f"PayPal webhook: {event_type} missing subscription ID")
                return JSONResponse({"status": "error", "message": "Missing subscription ID"})
            
            subscription = await db.subscriptions.find_one(
                {"provider_subscription_id": paypal_subscription_id, "provider": "paypal"},
                {"_id": 0}
            )
            
            if subscription:
                logging.warning(f"PayPal payment failed: user={subscription['user_id']}, subscription={subscription['id']}, event={event_type}. User keeps access until EXPIRED webhook.")
                # Do NOT change subscription status or downgrade user
                # PayPal will send EXPIRED webhook when subscription actually expires
                subscription_id = subscription['id']
        
        # AUDIT LOG: Webhook processing complete
        await log_paypal_action(
            action="webhook_processed",
            paypal_endpoint="/v1/notifications/webhooks",
            http_method="POST",
            source="webhook",
            subscription_id=subscription_id,
            http_status_code=200,
            paypal_status=None,
            verified=True,
            raw_paypal_response={"event_type": event_type, "event_id": event_id, "processed": True}
        )
        
        # Record processed event for idempotency
        processed_event = ProcessedWebhookEvent(
            paypal_event_id=event_id,
            event_type=event_type,
            subscription_id=subscription_id
        )
        processed_event_dict = processed_event.model_dump()
        processed_event_dict['processed_at'] = processed_event_dict['processed_at'].isoformat()
        await db.processed_webhook_events.insert_one(processed_event_dict)
        
        return JSONResponse({"status": "success"})
    
    except Exception as e:
        logging.error(f"PayPal webhook error: {str(e)}", exc_info=True)
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

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

# Open Graph preview route for workspace sharing
@app.get("/share/workspace/{slug}", response_class=HTMLResponse)
async def share_workspace(slug: str, request: Request):
    """
    Generate Open Graph HTML preview for workspace sharing.
    This route is used by social media crawlers (WhatsApp, Facebook, etc.) to display
    rich previews when workspace links are shared.
    
    CRITICAL: Uses workspace.logo exactly as stored in database - no transformations.
    """
    import html as html_module
    
    # Look up workspace by slug (public route, no auth required)
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    
    if not workspace:
        # Return 404 HTML if workspace not found
        return HTMLResponse(
            content="<html><head><title>Workspace Not Found</title></head><body><h1>Workspace Not Found</h1></body></html>",
            status_code=404
        )
    
    workspace_name = workspace.get("name", "Untitled Workspace")
    # CRITICAL: Get logo exactly as stored - no modifications
    workspace_logo = workspace.get("logo")
    
    # Log the exact logo value for debugging
    logging.info(f"[share_workspace] Workspace '{slug}': logo value from DB = {repr(workspace_logo)}")
    
    # Build URLs
    workspace_url = f"{FRONTEND_URL}/workspace/{slug}/walkthroughs"
    share_url = f"{request.url.scheme}://{request.url.netloc}/share/workspace/{slug}"
    
    # CRITICAL: Use logo exactly as stored, or fallback to site OG image
    # Do NOT transform, modify, or rebuild the URL
    if workspace_logo:
        # Use the exact stored URL - Cloudinary URLs are already HTTPS secure_url
        og_image_url = workspace_logo.strip() if isinstance(workspace_logo, str) else workspace_logo
        logging.info(f"[share_workspace] Using workspace logo: {og_image_url}")
    else:
        # Fallback to site OG image
        og_image_url = f"{FRONTEND_URL}/og-image.png"
        logging.info(f"[share_workspace] No workspace logo, using fallback: {og_image_url}")
    
    # Build Open Graph HTML with proper escaping
    og_title = f"InterGuide – {workspace_name}"
    og_description = f"InterGuide – {workspace_name}"
    
    # Escape HTML entities for safety
    og_title_escaped = html_module.escape(og_title)
    og_description_escaped = html_module.escape(og_description)
    og_image_url_escaped = html_module.escape(og_image_url)
    share_url_escaped = html_module.escape(share_url)
    workspace_url_escaped = html_module.escape(workspace_url)
    workspace_name_escaped = html_module.escape(workspace_name)
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="{og_title_escaped}">
    <meta property="og:description" content="{og_description_escaped}">
    <meta property="og:image" content="{og_image_url_escaped}">
    <meta property="og:image:secure_url" content="{og_image_url_escaped}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:type" content="website">
    <meta property="og:url" content="{share_url_escaped}">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{og_title_escaped}">
    <meta name="twitter:description" content="{og_description_escaped}">
    <meta name="twitter:image" content="{og_image_url_escaped}">
    
    <!-- Standard Meta Tags -->
    <title>{og_title_escaped}</title>
    <meta name="description" content="{og_description_escaped}">
    
    <!-- Redirect real users to the SPA workspace URL -->
    <!-- Crawlers will read meta tags before redirect executes -->
    <meta http-equiv="refresh" content="0;url={workspace_url_escaped}">
    <script>
        // Immediate redirect for browsers (crawlers will read meta tags first)
        window.location.replace("{workspace_url_escaped}");
    </script>
</head>
<body>
    <p>Redirecting to <a href="{workspace_url_escaped}">{workspace_name_escaped}</a>...</p>
</body>
</html>"""
    
    logging.info(f"[share_workspace] Generated OG HTML for '{slug}' with image: {og_image_url}")
    return HTMLResponse(content=html_content)

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

# Exception handler for HTTPException to ensure CORS headers are always sent
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Ensure CORS headers are sent on HTTPException responses (400, 401, 403, 404, etc.)"""
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
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": allowed_origin,
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true" if not allow_all_origins else "false"
        }
    )

# Exception handler for RequestValidationError to ensure CORS headers on validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Ensure CORS headers are sent on validation error responses (422)"""
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
    
    # Return validation error response with CORS headers
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
        headers={
            "Access-Control-Allow-Origin": allowed_origin,
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true" if not allow_all_origins else "false"
        }
    )

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

# Admin-only email diagnostic endpoint
@api_router.get("/admin/email/config")
async def get_email_config(current_user: User = Depends(get_current_user)):
    """
    Get email configuration status (for debugging).
    Shows what's configured without exposing sensitive data.
    """
    return {
        "resend_configured": bool(RESEND_API_KEY and RESEND_FROM_EMAIL),
        "resend_api_key_set": bool(RESEND_API_KEY),
        "resend_from_email": RESEND_FROM_EMAIL,
        "resend_api_url": RESEND_API_URL,
        "frontend_url": FRONTEND_URL,
        "smtp_disabled": True
    }

# Admin-only email test endpoint
@api_router.post("/admin/email/test")
async def test_email(
    email: str = Body(..., description="Email address to send test email to"),
    current_user: User = Depends(get_current_user)
):
    """
    Send a test email via Resend HTTP API.
    Admin-only endpoint for testing email configuration without creating users.
    Returns detailed Resend API response for debugging.
    """
    # TODO: Add admin role check when admin system is implemented
    # For now, any authenticated user can test email
    
    logging.info(f"[EMAIL][TEST] Admin test email requested by user_id={current_user.id} to={email}")
    
    # Check configuration
    if not RESEND_API_KEY:
        return {
            "success": False,
            "error": "RESEND_API_KEY not configured",
            "email": email,
            "config_check": {
                "RESEND_API_KEY": "missing",
                "RESEND_FROM_EMAIL": RESEND_FROM_EMAIL or "missing"
            }
        }
    
    if not RESEND_FROM_EMAIL:
        return {
            "success": False,
            "error": "RESEND_FROM_EMAIL not configured",
            "email": email,
            "config_check": {
                "RESEND_API_KEY": "configured",
                "RESEND_FROM_EMAIL": "missing"
            }
        }
    
    # Create a test verification URL (won't work, but shows the format)
    test_url = f"{FRONTEND_URL}/verify-email?token=TEST_TOKEN"
    
    # Send test email and capture detailed response
    try:
        expiry_hours = EMAIL_VERIFICATION_EXPIRY_HOURS
        name = email.split('@')[0].replace('.', ' ').title()
        
        text_content = f"""Hi {name},

This is a test email from Guide2026.

Verification URL: {test_url}

This link will expire in {expiry_hours} hours.

Best regards,
Guide2026
"""
        
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Hi {name},</h2>
        <p>This is a test email from Guide2026.</p>
        <a href="{test_url}" class="button">Test Verification Link</a>
        <p style="word-break: break-all;">{test_url}</p>
    </div>
</body>
</html>
"""
        
        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "from": RESEND_FROM_EMAIL,
            "to": [email],
            "subject": "Test Email - Guide2026",
            "text": text_content,
            "html": html_content
        }
        
        logging.info(f"[EMAIL][TEST][REQUEST] Resend API call for email={email} from={RESEND_FROM_EMAIL}")
        response = requests.post(RESEND_API_URL, json=payload, headers=headers, timeout=10)
        
        response_data = {}
        try:
            response_data = response.json()
        except:
            response_data = {"raw_response": response.text}
        
        if response.status_code == 200:
            resend_id = response_data.get('id', 'unknown')
            logging.info(f"[EMAIL][TEST][SUCCESS] email={email} resend_id={resend_id}")
            return {
                "success": True,
                "message": "Test email sent successfully",
                "email": email,
                "resend_id": resend_id,
                "resend_response": response_data
            }
        else:
            error_detail = response_data.get('message', response.text) or f"HTTP {response.status_code}"
            logging.error(f"[EMAIL][TEST][FAILED] email={email} status={response.status_code} error={error_detail}")
            return {
                "success": False,
                "error": f"Resend API error: {error_detail}",
                "email": email,
                "status_code": response.status_code,
                "resend_response": response_data,
                "from_email": RESEND_FROM_EMAIL
            }
            
    except requests.exceptions.Timeout:
        logging.error(f"[EMAIL][TEST][FAILED] email={email} error=Resend API timeout (10s)")
        return {
            "success": False,
            "error": "Resend API timeout (10s)",
            "email": email
        }
    except Exception as e:
        logging.error(f"[EMAIL][TEST][FAILED] email={email} error={str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "email": email
        }

# Admin-only PayPal verification endpoints (read-only, for disputes and audits)
@api_router.get("/admin/paypal/audit/{subscription_id}")
async def get_paypal_audit_logs(
    subscription_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get full PayPal audit log for a subscription.
    Admin-only endpoint for dispute resolution and audits.
    
    Returns chronological audit trail of all PayPal interactions for this subscription.
    """
    # TODO: Add admin role check when admin system is implemented
    # For now, any authenticated user can access (should be restricted in production)
    
    # Get subscription to verify it exists
    subscription = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Get all audit logs for this subscription
    audit_logs = await db.paypal_audit_logs.find(
        {"subscription_id": subscription_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)  # Sort chronologically, limit 1000
    
    return {
        "subscription_id": subscription_id,
        "provider_subscription_id": subscription.get('provider_subscription_id'),
        "user_id": subscription.get('user_id'),
        "audit_logs": audit_logs,
        "total_logs": len(audit_logs)
    }

@api_router.get("/admin/paypal/state/{subscription_id}")
async def get_paypal_state(
    subscription_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get last verified PayPal status for a subscription.
    Admin-only endpoint for dispute resolution.
    
    Returns:
    - Last verified PayPal status
    - Source of confirmation (API / webhook / reconciliation)
    - Timestamp of last verification
    - Full audit trail summary
    """
    # TODO: Add admin role check when admin system is implemented
    
    # Get subscription
    subscription = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Get last verified audit log entry
    last_verified = await db.paypal_audit_logs.find_one(
        {
            "subscription_id": subscription_id,
            "verified": True
        },
        {"_id": 0}
    )
    
    # Get most recent audit log (even if not verified)
    most_recent = await db.paypal_audit_logs.find_one(
        {"subscription_id": subscription_id},
        {"_id": 0}
    )
    
    # Get summary counts
    total_logs = await db.paypal_audit_logs.count_documents({"subscription_id": subscription_id})
    verified_logs = await db.paypal_audit_logs.count_documents({
        "subscription_id": subscription_id,
        "verified": True
    })
    
    return {
        "subscription_id": subscription_id,
        "provider_subscription_id": subscription.get('provider_subscription_id'),
        "user_id": subscription.get('user_id'),
        "local_status": subscription.get('status'),
        "paypal_verified_status": subscription.get('paypal_verified_status'),
        "last_verified_at": subscription.get('last_verified_at'),
        "last_verified_log": last_verified,
        "most_recent_log": most_recent,
        "audit_summary": {
            "total_logs": total_logs,
            "verified_logs": verified_logs,
            "source_of_truth": last_verified.get('source') if last_verified else None,
            "last_verification_timestamp": last_verified.get('created_at') if last_verified else None
        }
    }

@app.on_event("startup")
async def startup_event():
    """Initialize default plans on startup."""
    await initialize_default_plans()
    logging.info("Default plans initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()