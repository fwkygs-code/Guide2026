# Force Render rebuild - 2026-01-21 23:45 - CRITICAL CACHE PURGE v4
# Deploy marker: restore original Render services
# Local file compiles perfectly - Render cache is corrupted
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, File as FastAPIFile, UploadFile, Request, Response, Header, Query, Form, Body, BackgroundTasks
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
from typing import List, Optional, Dict, Any, Tuple
from collections import defaultdict
import uuid
from datetime import datetime, timezone, timedelta
import time
import asyncio
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
import re
import sys
import inspect
import html as html_module

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
JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', '24'))

if not JWT_SECRET or JWT_SECRET.strip() == '':
    raise RuntimeError("JWT_SECRET must be set in environment variables")
if len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET must be at least 32 characters long")
if JWT_SECRET == 'your-secret-key-change-in-production':
    raise RuntimeError("JWT_SECRET must not use default placeholder value")

APP_ENV = os.environ.get('APP_ENV', 'production').lower()
AUTH_COOKIE_NAME = os.environ.get('AUTH_COOKIE_NAME', 'ig_access_token')
# Cross-site auth cookies require SameSite=None and Secure=true in production.
if APP_ENV == 'development':
    COOKIE_SECURE = False
    COOKIE_SAMESITE = "Lax"
else:
    COOKIE_SECURE = True
    COOKIE_SAMESITE = "None"

CSRF_COOKIE_NAME = "ig_csrf_token"
CSRF_HEADER_NAME = "x-csrf-token"
CSRF_PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_SECRET = os.environ.get('CSRF_SECRET', JWT_SECRET)
if not CSRF_SECRET:
    raise RuntimeError("CSRF_SECRET must be set or JWT_SECRET must be available for CSRF hashing")
_CSRF_SECRET_BYTES = CSRF_SECRET.encode('utf-8')


def generate_csrf_token() -> str:
    raw = os.urandom(32)
    token = base64.urlsafe_b64encode(raw).decode('utf-8').rstrip('=')
    return token


def hash_csrf_token(csrf_token: str) -> str:
    return hmac.new(_CSRF_SECRET_BYTES, csrf_token.encode('utf-8'), hashlib.sha256).hexdigest()


def verify_csrf_token(provided_token: str, expected_hash: Optional[str]) -> bool:
    if not provided_token or not expected_hash:
        return False
    provided_hash = hash_csrf_token(provided_token)
    return hmac.compare_digest(provided_hash, expected_hash)

# Create the main app
app = FastAPI()

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://www.interguide.app')
cors_origins = sorted(
    {FRONTEND_URL.rstrip('/'), "https://www.interguide.app", "https://interguide.app"}
)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=[
        "Accept",
        "Authorization",
        "Content-Type",
        "Origin",
        "X-CSRF-Token",
        "X-Requested-With",
    ],
    expose_headers=["*"],
)


@app.on_event("startup")
async def log_cors_config():
    logging.info(f"[CORS] cors_origins={cors_origins}")
    logging.info("[CORS] allow_credentials=True allow_methods=* allow_headers="
                 "Accept,Authorization,Content-Type,Origin,X-CSRF-Token,X-Requested-With")

class LowercaseRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(ch.isupper() for ch in path):
            lower_path = path.lower()
            query = request.url.query
            target = f"{lower_path}?{query}" if query else lower_path
            return RedirectResponse(url=target, status_code=301)
        return await call_next(request)

class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method.upper() not in CSRF_PROTECTED_METHODS:
            return await call_next(request)
        auth_token = request.cookies.get(AUTH_COOKIE_NAME)
        if not auth_token:
            # No authenticated session present; allow request to proceed (route will enforce auth if required)
            return await call_next(request)
        try:
            payload = decode_token(auth_token)
        except HTTPException as exc:
            raise exc
        csrf_header = request.headers.get(CSRF_HEADER_NAME)
        csrf_hash = payload.get('csrf_hash')
        if not csrf_header:
            logging.warning(f"[CSRF] Missing header for user {payload.get('user_id')} path={request.url.path}")
            raise HTTPException(status_code=403, detail="Missing CSRF token")
        if not verify_csrf_token(csrf_header, csrf_hash):
            logging.warning(f"[CSRF] Token mismatch for user {payload.get('user_id')} path={request.url.path}")
            raise HTTPException(status_code=403, detail="Invalid CSRF token")
        request.state.csrf_payload = payload
        return await call_next(request)

app.add_middleware(LowercaseRedirectMiddleware)
app.add_middleware(CSRFMiddleware)
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# PRODUCTION METRICS: In-memory metrics for observability
# In production, export these to Prometheus/Grafana/CloudWatch
class ProductionMetrics:
    """Thread-safe metrics collector for production monitoring"""
    def __init__(self):
        self._metrics = defaultdict(int)
        self._lock = asyncio.Lock()
    
    async def increment(self, metric_name: str, value: int = 1):
        """Increment a counter metric"""
        async with self._lock:
            self._metrics[metric_name] += value
    
    async def get_all(self) -> Dict[str, int]:
        """Get all metrics (for /metrics endpoint)"""
        async with self._lock:
            return dict(self._metrics)
    
    async def reset(self):
        """Reset all metrics (for testing)"""
        async with self._lock:
            self._metrics.clear()

metrics = ProductionMetrics()

# PRODUCTION ALERTS: Alert conditions (log when triggered)
async def check_alert_conditions():
    """Check alert conditions and log violations"""
    all_metrics = await metrics.get_all()
    
    # Alert: Access granted without timestamps (MUST NEVER HAPPEN)
    if all_metrics.get('access_granted_no_timestamps', 0) > 0:
        logging.critical(
            f"Γëí╞Æ├£┬┐ ALERT: Access granted without timestamps detected! "
            f"Count: {all_metrics['access_granted_no_timestamps']}"
        )
    
    # Alert: Polling beyond terminal state (MUST NEVER HAPPEN)
    if all_metrics.get('poll_after_terminal', 0) > 0:
        logging.error(
            f"Γëí╞Æ├£┬┐ ALERT: Polling after terminal state! "
            f"Count: {all_metrics['poll_after_terminal']}"
        )
    
    # Alert: Reconciliation failures above 10%
    total_reconciles = all_metrics.get('reconcile_total', 0)
    failed_reconciles = all_metrics.get('reconcile_failed', 0)
    if total_reconciles > 0:
        failure_rate = failed_reconciles / total_reconciles
        if failure_rate > 0.10:
            logging.warning(
                f"╬ô├£├íΓê⌐Γòò├à ALERT: Reconciliation failure rate high: {failure_rate:.1%} "
                f"({failed_reconciles}/{total_reconciles})"
            )

# PRODUCTION KILL SWITCH: Disable features in emergency
class KillSwitch:
    """Emergency kill switches for production incidents"""
    def __init__(self):
        self.frontend_polling_enabled = True
        self.webhook_processing_enabled = True
        self.scheduled_reconciliation_enabled = True
        self.user_reconciliation_enabled = True
    
    def disable_all_except_scheduled(self):
        """Emergency: Disable all except scheduled reconciliation"""
        self.frontend_polling_enabled = False
        self.webhook_processing_enabled = False
        self.user_reconciliation_enabled = False
        logging.critical("Γëí╞Æ├£┬┐ KILL SWITCH: Disabled frontend polling, webhooks, user reconciliation")
    
    def enable_all(self):
        """Re-enable all features after incident resolved"""
        self.frontend_polling_enabled = True
        self.webhook_processing_enabled = True
        self.scheduled_reconciliation_enabled = True
        self.user_reconciliation_enabled = True
        logging.info("╬ô┬ú├á KILL SWITCH: Re-enabled all features")

kill_switch = KillSwitch()

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
# TEMPORARY: Fallback to Resend test domain if primary fails
if not RESEND_FROM_EMAIL or '@' not in RESEND_FROM_EMAIL:
    RESEND_FROM_EMAIL = "onboarding@resend.dev"
    logging.warning("Using Resend test domain (onboarding@resend.dev) as fallback")
EMAIL_VERIFICATION_EXPIRY_HOURS = 24
RESEND_API_URL = "https://api.resend.com/emails"
# Frontend origin (production)
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://www.interguide.app')
# Main domain for email verification links (should always be the production domain)
MAIN_DOMAIN = 'https://www.interguide.app'
STATIC_OG_IMAGE_URL = 'https://res.cloudinary.com/ds1dgifj8/image/upload/w_1200,h_630,c_fill,g_center,q_auto,f_auto/interguide-static/og-image'
FB_APP_ID = os.environ.get('FB_APP_ID')
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
        "For production: Verify your domain in Resend and use yourdomain.com email\n"
        "  Example: auth@interguide.app (must verify domain first)\n\n"
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

class KnowledgeSystemType(str, Enum):
    POLICY = "policy"
    PROCEDURE = "procedure"
    DOCUMENTATION = "documentation"
    FAQ = "faq"
    DECISION_TREE = "decision_tree"

class KnowledgeSystemStatus(str, Enum):
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

class InvitationStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"

class NotificationType(str, Enum):
    INVITE = "invite"
    INVITE_ACCEPTED = "invite_accepted"
    INVITE_DECLINED = "invite_declined"
    WORKSPACE_CHANGE = "workspace_change"
    FORCED_DISCONNECT = "forced_disconnect"
    MEMBER_REMOVED = "member_removed"
    WORKSPACE_DELETED = "workspace_deleted"

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: UserRole = UserRole.OWNER  # Default to OWNER, can be ADMIN, EDITOR, VIEWER
    subscription_id: Optional[str] = None
    plan_id: Optional[str] = None  # Denormalized for performance
    trial_ends_at: Optional[datetime] = None  # App-level Pro trial end date (14 days from start)
    email_verified: bool = False  # Email verification status
    email_verification_token: Optional[str] = None  # Hashed verification token
    email_verification_expires_at: Optional[datetime] = None  # Token expiration
    password_reset_token: Optional[str] = None  # Hashed password reset token
    password_reset_expires_at: Optional[datetime] = None  # Password reset token expiration
    disabled: bool = False  # Admin can disable user login
    deleted_at: Optional[datetime] = None  # Soft delete timestamp
    grace_period_ends_at: Optional[datetime] = None  # Grace period end date for expired subscriptions
    custom_storage_bytes: Optional[int] = None  # Admin-set custom storage quota override (None = use plan)
    custom_max_workspaces: Optional[int] = None  # Admin-set custom workspace limit override (None = use plan)
    custom_max_walkthroughs: Optional[int] = None  # Admin-set custom walkthrough limit override (None = use plan)
    has_completed_onboarding: bool = False  # Track if user completed onboarding
    has_dismissed_onboarding: bool = False  # Track if user dismissed onboarding
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None  # Track modifications

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
    status: InvitationStatus = InvitationStatus.ACCEPTED  # For invitations: pending, accepted, declined
    invited_by_user_id: Optional[str] = None  # User who sent the invitation
    invited_at: Optional[datetime] = None  # When invitation was sent
    responded_at: Optional[datetime] = None  # When invitation was accepted/declined
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
    step_id: Optional[str] = None
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
    slug: Optional[str] = None  # Custom URL slug for walkthrough
    enable_stuck_button: Optional[bool] = None

class Walkthrough(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    title: str
    slug: Optional[str] = None  # Custom URL slug for walkthrough (optional, falls back to ID)
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
    step_id_version: Optional[int] = None
    enable_stuck_button: bool = False
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
    workspace_id: Optional[str] = None
    event_type: str
    step_id: Optional[str] = None
    step_position: Optional[int] = None
    problem_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Feedback(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    walkthrough_id: str
    workspace_id: Optional[str] = None
    rating: str
    comment: Optional[str] = None
    hesitation_step: Optional[str] = None

class KnowledgeSystemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    system_type: KnowledgeSystemType
    content: Dict[str, Any] = {}
    status: Optional[KnowledgeSystemStatus] = KnowledgeSystemStatus.DRAFT

class KnowledgeSystemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    status: Optional[KnowledgeSystemStatus] = None

class KnowledgeSystem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    title: str
    description: Optional[str] = None
    system_type: KnowledgeSystemType
    content: Dict[str, Any] = {}
    status: KnowledgeSystemStatus = KnowledgeSystemStatus.DRAFT
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
    grace_started_at: Optional[datetime] = None  # When grace period started (for expired subscriptions)
    grace_ends_at: Optional[datetime] = None  # When grace period ends (for expired subscriptions)
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
    resource_type: str
    idempotency_key: str  # Unique key for deduplication
    reference_type: Optional[str] = None  # "walkthrough_icon", "step_media", "block_image", "workspace_logo", etc.
    reference_id: Optional[str] = None  # walkthrough_id, step_id, block_id, etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Recipient user ID
    type: NotificationType
    title: str
    message: str
    metadata: Optional[Dict[str, Any]] = None  # JSON metadata (workspace_id, walkthrough_id, etc.)
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkspaceLock(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    locked_by_user_id: str
    locked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime  # TTL safety - auto-expires if user disconnects/crashes

class WorkspaceAuditAction(str, Enum):
    """Audit action types for workspace collaboration."""
    INVITE_SENT = "invite_sent"
    INVITE_ACCEPTED = "invite_accepted"
    INVITE_DECLINED = "invite_declined"
    MEMBER_REMOVED = "member_removed"
    LOCK_ACQUIRED = "lock_acquired"
    LOCK_FORCE_RELEASED = "lock_force_released"
    WORKSPACE_DELETED = "workspace_deleted"

class WorkspaceAuditLog(BaseModel):
    """Lightweight audit log for workspace collaboration actions (append-only)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action_type: WorkspaceAuditAction
    workspace_id: str
    actor_user_id: str  # User who performed the action
    target_user_id: Optional[str] = None  # User affected by the action (if applicable)
    metadata: Optional[Dict[str, Any]] = None  # Additional context (JSON)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))  # "image", "video", "raw"
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
        .button {{ display: inline-block; padding: 12px 24px; background-color: #4f46e5 !important; color: #ffffff !important; text-decoration: none !important; border-radius: 5px; margin: 20px 0; font-weight: bold; text-align: center; }}
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

def send_password_reset_email(email: str, reset_url: str, name: Optional[str] = None) -> bool:
    """
    Send password reset email via Resend HTTP API.
    Returns True on success, False on failure.
    Never raises exceptions - called from background tasks.
    """
    if not RESEND_API_KEY or not RESEND_FROM_EMAIL:
        logging.warning(f"[EMAIL][FAILED] email={email} error=Resend not configured")
        return False

    try:
        # Use provided name or extract from email for personalization
        if not name:
            name = email.split('@')[0].replace('.', ' ').title()

        subject = "Reset your InterGuide password"

        # Plain text version
        text_content = f"""Hi {name},

You requested a password reset for your InterGuide account.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
InterGuide Team
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
        .warning {{ background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 5px; padding: 15px; margin: 20px 0; }}
        .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Reset your InterGuide password</h2>

        <p>Hi {name},</p>

        <p>You requested a password reset for your InterGuide account.</p>

        <p><a href="{reset_url}" class="button">Reset Password</a></p>

        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p><a href="{reset_url}">{reset_url}</a></p>

        <div class="warning">
            <strong>Security Notice:</strong> This link will expire in 1 hour for your security.
        </div>

        <p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>

        <div class="footer">
            <p>Best regards,<br>InterGuide Team</p>
        </div>
    </div>
</body>
</html>"""

        payload = {
            "from": RESEND_FROM_EMAIL,
            "to": [email],
            "subject": subject,
            "text": text_content,
            "html": html_content
        }

        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        }

        logging.info(f"[EMAIL][REQUEST] Password reset email to {email}")
        response = requests.post(RESEND_API_URL, json=payload, headers=headers, timeout=10)

        if response.status_code == 200:
            response_data = response.json()
            resend_id = response_data.get('id', 'unknown')
            logging.info(f"[EMAIL][SUCCESS] Password reset email sent to {email}, resend_id={resend_id}")
            return True
        else:
            try:
                error_data = response.json()
                error_detail = error_data.get('message', str(error_data))
            except:
                error_detail = response.text or f"HTTP {response.status_code}"

            logging.error(f"[EMAIL][FAILED] Password reset email to {email}, status={response.status_code}, error={error_detail}")
            return False

    except requests.exceptions.Timeout:
        logging.error(f"[EMAIL][FAILED] Password reset email to {email}, error=Resend API timeout (10s)")
        return False
    except requests.exceptions.RequestException as e:
        logging.error(f"[EMAIL][FAILED] Password reset email to {email}, error=Resend API request error: {str(e)}")
        return False
    except Exception as e:
        logging.error(f"[EMAIL][FAILED] Password reset email to {email}, error={str(e)}", exc_info=True)
        return False

def send_invitation_email(email: str, workspace_name: str, inviter_name: str) -> bool:
    """
    Send workspace invitation email via Resend HTTP API.
    Returns True on success, False on failure.
    Email contains notification only - no magic auth links.
    """
    if not RESEND_API_KEY or not RESEND_FROM_EMAIL:
        logging.warning(f"[EMAIL][FAILED] email={email} error=Resend not configured")
        return False
    
    try:
        # Plain text version
        text_content = f"""Hi,

{inviter_name} has invited you to collaborate on the workspace "{workspace_name}" in InterGuide.

Please log in to your InterGuide account to accept or decline the invitation.

If you don't have an account, you can sign up at {MAIN_DOMAIN}/signup.

Best regards,
InterGuide
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
        <h2>Workspace Invitation</h2>
        <p>Hi,</p>
        <p><strong>{inviter_name}</strong> has invited you to collaborate on the workspace <strong>"{workspace_name}"</strong> in InterGuide.</p>
        <p>Please log in to your InterGuide account to accept or decline the invitation.</p>
        <a href="{MAIN_DOMAIN}/login" class="button">Log In to InterGuide</a>
        <p>If you don't have an account, you can <a href="{MAIN_DOMAIN}/signup">sign up here</a>.</p>
        <div class="footer">
            <p>Best regards,<br>InterGuide</p>
        </div>
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
            "subject": f"Invitation to collaborate on {workspace_name}",
            "text": text_content,
            "html": html_content
        }
        
        logging.info(f"[EMAIL][REQUEST] Invitation email to {email} for workspace {workspace_name}")
        response = requests.post(RESEND_API_URL, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            response_data = response.json()
            resend_id = response_data.get('id', 'unknown')
            logging.info(f"[EMAIL][SUCCESS] Invitation email sent to {email} resend_id={resend_id}")
            return True
        else:
            try:
                error_data = response.json()
                error_detail = error_data.get('message', str(error_data))
            except:
                error_detail = response.text or f"HTTP {response.status_code}"
            logging.error(f"[EMAIL][FAILED] Invitation email to {email} status={response.status_code} error={error_detail}")
            return False
            
    except Exception as e:
        logging.error(f"[EMAIL][FAILED] Invitation email to {email} error={str(e)}", exc_info=True)
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
        
        verification_url = f"{MAIN_DOMAIN}/verify-email?token={token}"
        logging.info(f"[EMAIL][URL] user_id={user_id} verification_url={verification_url}")
        
        # Call the Resend email function (sync, but in background task)
        success = send_verification_email(email, verification_url, name=name)
        
        if success:
            logging.info(f"[EMAIL][SUCCESS] user_id={user_id} email={email}")
        else:
            logging.error(f"[EMAIL][FAILED] user_id={user_id} email={email} error=Email send failed (check logs above)")
    except Exception as e:
        logging.error(f"[EMAIL][FAILED] user_id={user_id} email={email} error=Background task exception: {str(e)}", exc_info=True)

def _log_text_block_diff(raw: dict, sanitized: dict) -> None:
    if not raw or not sanitized:
        return
    diffs = []
    raw_steps = raw.get("steps") if isinstance(raw.get("steps"), list) else []
    sanitized_steps = sanitized.get("steps") if isinstance(sanitized.get("steps"), list) else []
    for step_index, raw_step in enumerate(raw_steps):
        if step_index >= len(sanitized_steps):
            continue
        raw_blocks = raw_step.get("blocks") if isinstance(raw_step.get("blocks"), list) else []
        sanitized_blocks = sanitized_steps[step_index].get("blocks") if isinstance(sanitized_steps[step_index].get("blocks"), list) else []
        for block_index, raw_block in enumerate(raw_blocks):
            if block_index >= len(sanitized_blocks):
                continue
            if not isinstance(raw_block, dict) or raw_block.get("type") not in {"text", "heading"}:
                continue
            sanitized_block = sanitized_blocks[block_index]
            if not isinstance(sanitized_block, dict):
                continue
            raw_data = raw_block.get("data")
            sanitized_data = sanitized_block.get("data")
            if isinstance(raw_data, dict) and isinstance(sanitized_data, dict):
                if raw_data and not sanitized_data:
                    diffs.append({
                        "step_index": step_index,
                        "block_index": block_index,
                        "block_id": raw_block.get("id"),
                        "raw_data_keys": list(raw_data.keys()),
                        "sanitized_data_keys": list(sanitized_data.keys()),
                        "raw_block": raw_block,
                        "sanitized_block": sanitized_block
                    })
    if diffs:
        logging.warning(
            "[portal][sanitize] Text/heading block data dropped during serialization | %s",
            json.dumps(
                {
                    "diffs": diffs,
                    "raw_walkthrough": raw,
                    "sanitized_walkthrough": sanitized
                },
                default=str
            )
        )


def _summarize_text_blocks(w: dict) -> list:
    if not w or not isinstance(w.get("steps"), list):
        return []
    summary = []
    for step_index, step in enumerate(w.get("steps", [])):
        blocks = step.get("blocks") if isinstance(step.get("blocks"), list) else []
        for block_index, block in enumerate(blocks):
            if not isinstance(block, dict):
                continue
            block_type = block.get("type")
            if block_type not in {"text", "heading"}:
                continue
            data = block.get("data")
            content = data.get("content") if isinstance(data, dict) else None
            content_type = type(content).__name__ if content is not None else None
            content_len = None
            if isinstance(content, str):
                content_len = len(content)
            elif isinstance(content, dict):
                content_len = len(content.keys())
            summary.append({
                "step_index": step_index,
                "block_index": block_index,
                "block_id": block.get("id"),
                "block_type": block_type,
                "data_keys": list(data.keys()) if isinstance(data, dict) else [],
                "content_type": content_type,
                "content_len": content_len
            })
    return summary


def _preserve_text_block_data(raw: dict, sanitized: dict) -> None:
    if not raw or not sanitized:
        return
    raw_steps = raw.get("steps") if isinstance(raw.get("steps"), list) else []
    sanitized_steps = sanitized.get("steps") if isinstance(sanitized.get("steps"), list) else []
    for step_index, raw_step in enumerate(raw_steps):
        if step_index >= len(sanitized_steps):
            continue
        raw_blocks = raw_step.get("blocks") if isinstance(raw_step.get("blocks"), list) else []
        sanitized_blocks = sanitized_steps[step_index].get("blocks") if isinstance(sanitized_steps[step_index].get("blocks"), list) else []
        for block_index, raw_block in enumerate(raw_blocks):
            if block_index >= len(sanitized_blocks):
                continue
            if not isinstance(raw_block, dict) or raw_block.get("type") not in {"text", "heading"}:
                continue
            sanitized_block = sanitized_blocks[block_index]
            if not isinstance(sanitized_block, dict):
                continue
            raw_data = raw_block.get("data")
            sanitized_data = sanitized_block.get("data")
            if isinstance(raw_data, dict):
                if not isinstance(sanitized_data, dict):
                    sanitized_block["data"] = dict(raw_data)
                else:
                    sanitized_block["data"] = {**raw_data, **sanitized_data}


def sanitize_public_walkthrough(w: dict) -> dict:
    """Remove sensitive/private fields from walkthrough docs returned to the public portal."""
    if not w:
        return w
    import copy
    raw_walkthrough = copy.deepcopy(w)
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
    _preserve_text_block_data(raw_walkthrough, w)
    _log_text_block_diff(raw_walkthrough, w)
    return w

STEP_ID_SCHEMA_VERSION = 1
STEP_ID_LENGTH = 6

def _generate_step_id(existing_ids: set) -> str:
    alphabet = "abcdefghijklmnopqrstuvwxyz"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(STEP_ID_LENGTH))
        if candidate not in existing_ids:
            return candidate

async def ensure_walkthrough_step_ids(walkthrough: dict) -> dict:
    if not walkthrough or not isinstance(walkthrough.get("steps"), list):
        return walkthrough
    if walkthrough.get("step_id_version") == STEP_ID_SCHEMA_VERSION:
        return walkthrough

    steps = walkthrough.get("steps", [])
    existing_ids = {step.get("step_id") for step in steps if step.get("step_id")}
    changed = False

    for step in steps:
        if not step.get("step_id"):
            step["step_id"] = _generate_step_id(existing_ids)
            existing_ids.add(step["step_id"])
            changed = True

    if changed or walkthrough.get("step_id_version") != STEP_ID_SCHEMA_VERSION:
        walkthrough["step_id_version"] = STEP_ID_SCHEMA_VERSION
        result = await db.walkthroughs.update_one(
            {"id": walkthrough.get("id"), "step_id_version": {"$ne": STEP_ID_SCHEMA_VERSION}},
            {"$set": {
                "steps": steps,
                "step_id_version": STEP_ID_SCHEMA_VERSION,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        if result.modified_count == 0:
            refreshed = await db.walkthroughs.find_one({"id": walkthrough.get("id")}, {"_id": 0})
            return refreshed or walkthrough

    return walkthrough

def create_token(user_id: str) -> Tuple[str, str]:
    csrf_token = generate_csrf_token()
    csrf_hash = hash_csrf_token(csrf_token)
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        'csrf_hash': csrf_hash
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, csrf_token

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

_COOKIE_MISSING_LOGGED = False
_COOKIE_INVALID_LOGGED = False
_COOKIE_HEADER_FALLBACK_LOGGED = False

def set_auth_cookie(response: Response, token: str, csrf_token: str) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=JWT_EXPIRATION_HOURS * 60 * 60,
        path="/",
        domain=".interguide.app"
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
        domain=".interguide.app"
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
        domain=".interguide.app"
    )
    response.delete_cookie(
        key=CSRF_COOKIE_NAME,
        httponly=False,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
        domain=".interguide.app"
    )

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
):
    global _COOKIE_MISSING_LOGGED, _COOKIE_INVALID_LOGGED, _COOKIE_HEADER_FALLBACK_LOGGED
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token and credentials and APP_ENV == "development":
        if not _COOKIE_HEADER_FALLBACK_LOGGED:
            logging.debug("[AUTH] Cookie missing; using Authorization header fallback.")
            _COOKIE_HEADER_FALLBACK_LOGGED = True
        token = credentials.credentials
    if not token:
        if not _COOKIE_MISSING_LOGGED:
            logging.debug("[AUTH] Missing auth cookie.")
            _COOKIE_MISSING_LOGGED = True
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except HTTPException:
        if not _COOKIE_INVALID_LOGGED:
            logging.debug("[AUTH] Invalid auth cookie.")
            _COOKIE_INVALID_LOGGED = True
        raise
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Check if user is disabled
    if user.get('disabled', False):
        raise HTTPException(status_code=403, detail="Account is disabled. Please contact support.")
    
    # Check if user is soft deleted
    if user.get('deleted_at'):
        raise HTTPException(status_code=403, detail="Account has been deleted.")
    
    # Check grace period expiration - force downgrade if expired
    grace_ends_at = user.get('grace_period_ends_at')
    if grace_ends_at:
        try:
            if isinstance(grace_ends_at, str):
                grace_end = datetime.fromisoformat(grace_ends_at.replace('Z', '+00:00'))
            else:
                grace_end = grace_ends_at
            now = datetime.now(timezone.utc)
            if grace_end <= now:
                # SECURITY INVARIANT: Grace period MUST expire deterministically
                # REGRESSION GUARD: This check MUST happen on every authenticated request
                # Grace period expired - check if user should be downgraded
                plan_id = user.get('plan_id')
                if plan_id:
                    plan = await db.plans.find_one({"id": plan_id}, {"_id": 0, "name": 1})
                    if plan and plan.get('name') == 'pro':
                        # Check subscription status
                        subscription = await get_user_subscription(user.get('id'))
                        if subscription and subscription.status != SubscriptionStatus.EXPIRED:
                            # Subscription not expired but grace period ended - check if payment failed
                            # If subscription is ACTIVE/PENDING/CANCELLED but grace period expired,
                            # this means payment failed and grace period ended - downgrade to Free
                            free_plan = await db.plans.find_one({"name": "free"}, {"_id": 0})
                            if free_plan:
                                await db.users.update_one(
                                    {"id": user.get('id')},
                                    {"$set": {
                                        "plan_id": free_plan['id'],
                                        "grace_period_ends_at": None,  # Clear grace period
                                        "updated_at": now.isoformat()
                                    }}
                                )
                                logging.info(
                                    f"Grace period expired for user {user.get('id')} - downgraded to Free plan"
                                )
                                # Update user dict for return
                                user['plan_id'] = free_plan['id']
                                user['grace_period_ends_at'] = None
        except Exception as e:
            logging.error(f"Error checking grace period expiration for user {user.get('id')}: {e}", exc_info=True)
            # Continue on error - don't block user access if grace period check fails
    
    return User(**user)

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to require admin role for admin-only endpoints.
    """
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    user_role = user_doc.get("role", UserRole.OWNER.value)
    if current_user.role != user_role:
        logging.warning(
            f"[SECURITY] Role mismatch for user {current_user.id}: token={current_user.role} db={user_role}"
        )
    if user_role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return current_user

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

async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
):
    """Optional authentication - returns user if token provided, None otherwise."""
    token = credentials.credentials if credentials else None
    if not token:
        token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        return None
    try:
        payload = decode_token(token)
        user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
        return User(**user) if user else None
    except Exception:
        return None

async def get_workspace_member(workspace_id: str, user_id: str):
    """Get workspace member record if user is a member."""
    member = await db.workspace_members.find_one(
        {"workspace_id": workspace_id, "user_id": user_id},
        {"_id": 0}
    )
    return WorkspaceMember(**member) if member else None

async def is_workspace_owner(workspace_id: str, user_id: str) -> bool:
    """Check if user is the owner of the workspace."""
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "owner_id": 1})
    if not workspace:
        return False
    return workspace.get("owner_id") == user_id

async def check_workspace_access(workspace_id: str, user_id: str, require_owner: bool = False) -> WorkspaceMember:
    """
    Check if user has access to workspace.
    Returns WorkspaceMember if access granted, raises HTTPException otherwise.
    
    For owners: They may not have a WorkspaceMember record (legacy), so check owner_id first.
    For members: Must have ACCEPTED status in WorkspaceMember.
    
    BLOCKING ENFORCEMENT: Free users and expired subscriptions cannot access shared workspaces.
    """
    # Check if user is owner (owners may not have WorkspaceMember record)
    is_owner = await is_workspace_owner(workspace_id, user_id)
    
    # For non-owners: Enforce plan-based access restriction
    if not is_owner:
        # Get user plan and subscription status
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "plan_id": 1, "grace_period_ends_at": 1})
        if not user:
            raise HTTPException(status_code=403, detail="Access denied: User not found")
        
        # Check grace period expiration
        grace_ends_at = user.get('grace_period_ends_at')
        if grace_ends_at:
            try:
                if isinstance(grace_ends_at, str):
                    grace_end = datetime.fromisoformat(grace_ends_at.replace('Z', '+00:00'))
                else:
                    grace_end = grace_ends_at
                if grace_end <= datetime.now(timezone.utc):
                    # Grace period expired - block access
                    raise HTTPException(
                        status_code=403,
                        detail="Access denied: Your subscription grace period has expired. Please upgrade to Pro to access shared workspaces."
                    )
            except Exception:
                # Invalid grace period date - treat as expired
                pass
        
        # Check user plan
        plan_id = user.get('plan_id')
        if plan_id:
            plan = await db.plans.find_one({"id": plan_id}, {"_id": 0, "name": 1})
            if plan and plan.get('name') == 'free':
                # SECURITY INVARIANT: Free plan users CANNOT access shared workspaces
                # REGRESSION GUARD: This check MUST happen before membership status check
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: Free plan users cannot access shared workspaces. Please upgrade to Pro."
                )
            
            # Check subscription status for Pro plan users
            if plan and plan.get('name') == 'pro':
                subscription = await get_user_subscription(user_id)
                if subscription and subscription.status == SubscriptionStatus.EXPIRED:
                    # Expired subscription - block access
                    raise HTTPException(
                        status_code=403,
                        detail="Access denied: Your subscription has expired. Please renew to access shared workspaces."
                    )
    
    # Owner check (owners always have access regardless of plan)
    if is_owner:
        if require_owner:
            # Return a virtual WorkspaceMember for owner
            return WorkspaceMember(
                id="owner",
                workspace_id=workspace_id,
                user_id=user_id,
                role=UserRole.OWNER,
                status=InvitationStatus.ACCEPTED
            )
        else:
            # Owner has access, return virtual member
            return WorkspaceMember(
                id="owner",
                workspace_id=workspace_id,
                user_id=user_id,
                role=UserRole.OWNER,
                status=InvitationStatus.ACCEPTED
            )
    
    # Check if user is an accepted member
    member = await get_workspace_member(workspace_id, user_id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied: You are not a member of this workspace")
    
    # SECURITY INVARIANT: Only ACCEPTED members have access
    # REGRESSION GUARD: Frozen memberships (PENDING with frozen_reason) are blocked here
    # This ensures frozen memberships cannot grant access even if status is somehow ACCEPTED
    if member.status != InvitationStatus.ACCEPTED:
        raise HTTPException(status_code=403, detail="Access denied: Your invitation is pending or declined")
    
    # REGRESSION GUARD: Verify membership is not frozen (should not happen if status is ACCEPTED)
    # This is a defensive check - frozen memberships should have status=PENDING
    member_doc = await db.workspace_members.find_one(
        {"workspace_id": workspace_id, "user_id": user_id, "status": InvitationStatus.ACCEPTED},
        {"_id": 0, "frozen_reason": 1}
    )
    if member_doc and member_doc.get('frozen_reason') == "subscription_expired":
        # This should never happen - frozen memberships have status=PENDING
        # But if it does, block access as a safety measure
        logging.error(
            f"SECURITY WARNING: User {user_id} has ACCEPTED membership with frozen_reason in workspace {workspace_id}. "
            "This violates security invariant - blocking access."
        )
        raise HTTPException(
            status_code=403,
            detail="Access denied: Your workspace membership has been suspended due to subscription expiration."
        )
    
    if require_owner:
        raise HTTPException(status_code=403, detail="Access denied: Only workspace owner can perform this action")
    
    return member

async def get_workspace_members(workspace_id: str) -> List[WorkspaceMember]:
    """Get all accepted members of a workspace."""
    members = await db.workspace_members.find(
        {"workspace_id": workspace_id, "status": InvitationStatus.ACCEPTED},
        {"_id": 0}
    ).to_list(1000)
    return [WorkspaceMember(**m) for m in members]

async def create_notification(
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Notification:
    """Create and persist a notification."""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        metadata=metadata
    )
    notification_dict = notification.model_dump()
    notification_dict['created_at'] = notification_dict['created_at'].isoformat()
    await db.notifications.insert_one(notification_dict)
    return notification

async def get_workspace_lock(workspace_id: str) -> Optional[WorkspaceLock]:
    """
    Get current workspace lock if exists and not expired.
    
    CRITICAL: This function is authoritative - it enforces expiration server-side.
    Expired locks are automatically deleted and treated as if they don't exist.
    This ensures stale locks from crashed/closed sessions don't block users.
    """
    lock = await db.workspace_locks.find_one({"workspace_id": workspace_id}, {"_id": 0})
    if not lock:
        return None
    
    # MANDATORY: Check expiration on every read - backend is authoritative
    expires_at = datetime.fromisoformat(lock['expires_at'].replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    if now > expires_at:
        # Lock expired - delete it and treat as unlocked
        # This is self-healing: stale locks from crashes/closes are automatically cleaned up
        await db.workspace_locks.delete_one({"workspace_id": workspace_id})
        logging.info(f"[get_workspace_lock] Expired lock deleted for workspace {workspace_id} (expired at {expires_at.isoformat()})")
        return None
    
    return WorkspaceLock(**lock)

async def acquire_workspace_lock(workspace_id: str, user_id: str, force: bool = False) -> WorkspaceLock:
    """
    Acquire workspace lock. Returns lock if successful, raises HTTPException if locked by another user.
    If force=True, releases existing lock and acquires new one.
    
    CRITICAL: This function is authoritative and self-healing:
    - Expired locks are automatically deleted (via get_workspace_lock)
    - Only valid, non-expired locks block other users
    - Backend enforces expiration - no reliance on frontend cleanup
    """
    # MANDATORY: get_workspace_lock enforces expiration and deletes expired locks
    # This ensures stale locks from crashes/closes don't block users
    existing_lock = await get_workspace_lock(workspace_id)
    
    if existing_lock:
        # Lock exists and is valid (not expired)
        if existing_lock.locked_by_user_id == user_id:
            # Same user, extend lock (idempotent - safe for refresh/heartbeat)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)  # 10 minute TTL
            await db.workspace_locks.update_one(
                {"workspace_id": workspace_id},
                {"$set": {"expires_at": expires_at.isoformat()}}
            )
            existing_lock.expires_at = expires_at
            return existing_lock
        elif force:
            # Force release existing lock and notify previous user
            previous_user_id = existing_lock.locked_by_user_id
            await db.workspace_locks.delete_one({"workspace_id": workspace_id})
            
            # Notify previous user they were disconnected (non-blocking)
            try:
                await create_notification(
                    user_id=previous_user_id,
                    notification_type=NotificationType.FORCED_DISCONNECT,
                    title="Workspace Access Interrupted",
                    message=f"Another user has entered the workspace. You were disconnected to prevent conflicts.",
                    metadata={"workspace_id": workspace_id}
                )
            except Exception as notif_error:
                # Log but don't fail lock acquisition if notification fails
                logging.error(f"Failed to create forced disconnect notification: {notif_error}", exc_info=True)
        else:
            # Locked by another user (lock is valid and not expired)
            workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
            workspace_name = workspace.get("name", "Unknown") if workspace else "Unknown"
            locked_by_user = await db.users.find_one({"id": existing_lock.locked_by_user_id}, {"_id": 0, "name": 1})
            locked_by_name = locked_by_user.get("name", "Another user") if locked_by_user else "Another user"
            
            raise HTTPException(
                status_code=409,
                detail=f"Another user ({locked_by_name}) is currently connected to this workspace. Entering now will force them out and may cause data loss."
            )
    
    # No valid lock exists (either no lock or expired lock was deleted)
    # CRITICAL: Use atomic find_one_and_update with upsert to prevent race conditions
    # This ensures only one lock can be created even under concurrent load
    # MongoDB's upsert is atomic - if two requests try simultaneously, only one document is created
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)  # 10 minute TTL
    locked_at = datetime.now(timezone.utc)
    lock_id = str(uuid.uuid4())
    
    # Atomic operation: create lock only if it doesn't exist (upsert)
    # $setOnInsert only sets fields when document is inserted, not when updated
    # This prevents overwriting existing locks
    try:
        result = await db.workspace_locks.find_one_and_update(
            {"workspace_id": workspace_id},
            {
                "$setOnInsert": {
                    "id": lock_id,
                    "workspace_id": workspace_id,
                    "locked_by_user_id": user_id,
                    "locked_at": locked_at.isoformat(),
                    "expires_at": expires_at.isoformat()
                }
            },
            upsert=True,
            return_document=True
        )
        
        # Check if lock was created by us or already existed
        if result and result.get("locked_by_user_id") == user_id:
            # Lock is ours (either just created or we already had it)
            lock = WorkspaceLock(
                id=result.get("id", lock_id),
                workspace_id=workspace_id,
                locked_by_user_id=user_id,
                locked_at=datetime.fromisoformat(result.get("locked_at", locked_at.isoformat()).replace('Z', '+00:00')),
                expires_at=datetime.fromisoformat(result.get("expires_at", expires_at.isoformat()).replace('Z', '+00:00'))
            )
            return lock
        
        # Another request created the lock concurrently - re-check with expiration enforcement
        # This handles the race where two requests both saw no lock and both tried to create one
        # MongoDB ensures only one succeeds, so we need to check which one won
        existing_lock = await get_workspace_lock(workspace_id)
        if existing_lock:
            if existing_lock.locked_by_user_id == user_id:
                # Same user (shouldn't happen but handle gracefully)
                return existing_lock
            else:
                # Locked by another user - raise conflict
                workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
                workspace_name = workspace.get("name", "Unknown") if workspace else "Unknown"
                locked_by_user = await db.users.find_one({"id": existing_lock.locked_by_user_id}, {"_id": 0, "name": 1})
                locked_by_name = locked_by_user.get("name", "Another user") if locked_by_user else "Another user"
                
                raise HTTPException(
                    status_code=409,
                    detail=f"Another user ({locked_by_name}) is currently connected to this workspace. Entering now will force them out and may cause data loss."
                )
        
        # Lock was created but expired immediately (extremely rare edge case) - retry
        # This can happen if lock creation took longer than TTL (shouldn't happen but handle it)
        return await acquire_workspace_lock(workspace_id, user_id, force=force)
        
    except Exception as e:
        # If upsert fails for any reason, fall back to checking existing lock
        # This ensures we don't lose the race condition protection
        logging.error(f"[acquire_workspace_lock] Upsert failed, checking existing lock: {e}", exc_info=True)
        existing_lock = await get_workspace_lock(workspace_id)
        if existing_lock:
            if existing_lock.locked_by_user_id == user_id:
                return existing_lock
            else:
                workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
                locked_by_user = await db.users.find_one({"id": existing_lock.locked_by_user_id}, {"_id": 0, "name": 1})
                locked_by_name = locked_by_user.get("name", "Another user") if locked_by_user else "Another user"
                raise HTTPException(
                    status_code=409,
                    detail=f"Another user ({locked_by_name}) is currently connected to this workspace. Entering now will force them out and may cause data loss."
                )
        
        # No lock exists - create it (fallback to non-atomic insert if upsert fails)
        # This should be extremely rare
        # CRITICAL: Handle duplicate key error if unique index exists and another request created lock
        try:
            lock = WorkspaceLock(
                workspace_id=workspace_id,
                locked_by_user_id=user_id,
                expires_at=expires_at
            )
            lock_dict = lock.model_dump()
            lock_dict['locked_at'] = lock_dict['locked_at'].isoformat()
            lock_dict['expires_at'] = lock_dict['expires_at'].isoformat()
            await db.workspace_locks.insert_one(lock_dict)
            return lock
        except Exception as insert_error:
            # If unique index exists and duplicate key error occurs, another request created the lock
            error_msg = str(insert_error).lower()
            if "duplicate key" in error_msg or "E11000" in error_msg:
                # Unique index prevented duplicate - re-check existing lock
                existing_lock = await get_workspace_lock(workspace_id)
                if existing_lock:
                    if existing_lock.locked_by_user_id == user_id:
                        return existing_lock
                    else:
                        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
                        locked_by_user = await db.users.find_one({"id": existing_lock.locked_by_user_id}, {"_id": 0, "name": 1})
                        locked_by_name = locked_by_user.get("name", "Another user") if locked_by_user else "Another user"
                        raise HTTPException(
                            status_code=409,
                            detail=f"Another user ({locked_by_name}) is currently connected to this workspace. Entering now will force them out and may cause data loss."
                        )
            # Re-raise if it's not a duplicate key error
            raise
    
    # HARDENING LAYER C: Audit log (non-blocking)
    try:
        await log_workspace_audit(
            action_type=WorkspaceAuditAction.LOCK_ACQUIRED,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            metadata={"expires_at": expires_at.isoformat(), "force": force}
        )
    except Exception as audit_error:
        # Log but don't fail lock acquisition if audit log fails
        logging.error(f"Failed to log workspace audit for lock acquisition: {audit_error}", exc_info=True)
    
    return lock

async def release_workspace_lock(workspace_id: str, user_id: str, force: bool = False, reason: Optional[str] = None):
    """
    Release workspace lock if held by user.
    
    Args:
        workspace_id: Workspace ID
        user_id: User ID releasing the lock
        force: If True, release even if user_id doesn't match (for admin/removal scenarios)
        reason: Optional reason for logging/audit
    """
    lock = await get_workspace_lock(workspace_id)
    if lock and (lock.locked_by_user_id == user_id or force):
        await db.workspace_locks.delete_one({"workspace_id": workspace_id})
        
        # Log audit entry if force-released
        if force and lock.locked_by_user_id != user_id:
            await log_workspace_audit(
                action_type=WorkspaceAuditAction.LOCK_FORCE_RELEASED,
                workspace_id=workspace_id,
                actor_user_id=user_id,
                target_user_id=lock.locked_by_user_id,
                metadata={"reason": reason or "Member removed or access revoked"}
            )
        return True
    return False

async def log_workspace_audit(
    action_type: WorkspaceAuditAction,
    workspace_id: str,
    actor_user_id: str,
    target_user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Append-only audit log entry for workspace collaboration actions.
    This is for dispute resolution and debugging only - no UI required.
    """
    audit_entry = WorkspaceAuditLog(
        action_type=action_type,
        workspace_id=workspace_id,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        metadata=metadata
    )
    audit_dict = audit_entry.model_dump()
    audit_dict['created_at'] = audit_dict['created_at'].isoformat()
    await db.workspace_audit_logs.insert_one(audit_dict)

async def check_membership_lock_invariant(workspace_id: str):
    """
    HARDENING LAYER A: Membership-Lock Invariant Check
    
    Log-only invariant check: If a user is not a member of a workspace but still holds a lock,
    log a warning. This helps detect orphaned locks without crashing the server.
    
    This is called periodically or after membership changes to ensure consistency.
    """
    lock = await get_workspace_lock(workspace_id)
    if not lock:
        return
    
    # Check if lock holder is still a member (owner or accepted member)
    is_owner = await is_workspace_owner(workspace_id, lock.locked_by_user_id)
    if is_owner:
        return  # Owner always has access
    
    member = await get_workspace_member(workspace_id, lock.locked_by_user_id)
    if not member or member.status != InvitationStatus.ACCEPTED:
        # Orphaned lock detected - user is not a member but holds a lock
        logging.warning(
            f"[STATE VALIDATION] orphaned workspace lock detected: "
            f"workspace_id={workspace_id}, locked_by_user_id={lock.locked_by_user_id}, "
            f"member_status={member.status if member else 'not_found'}"
        )
        # Auto-cleanup: Release orphaned lock
        await db.workspace_locks.delete_one({"workspace_id": workspace_id})
        logging.info(f"[STATE VALIDATION] Auto-released orphaned lock for workspace {workspace_id}")

async def batch_notification_key(user_id: str, notification_type: NotificationType, workspace_id: str, changed_by_id: str) -> str:
    """
    Generate a batching key for notifications.
    Returns a key that groups similar notifications together for batching.
    """
    if notification_type == NotificationType.WORKSPACE_CHANGE:
        # Batch workspace changes by recipient, workspace, and actor within time window
        return f"{user_id}:{notification_type}:{workspace_id}:{changed_by_id}"
    # Don't batch other notification types
    return None

async def create_batched_notification(
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    metadata: Optional[Dict[str, Any]] = None,
    batch_window_seconds: int = 60
) -> Notification:
    """
    HARDENING LAYER B: Notification Deduplication/Batching
    
    Create a notification, batching similar workspace_change notifications within a time window.
    Only batches workspace_change notifications - other types are created immediately.
    
    Batching logic:
    - Groups notifications by: user_id, notification_type, workspace_id, changed_by_id
    - If a similar notification exists within batch_window_seconds, update the existing one
    - Otherwise, create a new notification
    
    Returns the created/updated notification.
    """
    # Only batch workspace_change notifications
    if notification_type != NotificationType.WORKSPACE_CHANGE:
        # Create immediately for non-batchable types
        return await create_notification(user_id, notification_type, title, message, metadata)
    
    # Check for existing notification within batch window
    batch_key = await batch_notification_key(
        user_id,
        notification_type,
        metadata.get("workspace_id") if metadata else None,
        metadata.get("changed_by_id") if metadata else None
    )
    
    if not batch_key:
        # Can't batch - create immediately
        return await create_notification(user_id, notification_type, title, message, metadata)
    
    # Look for recent similar notification
    cutoff_time = datetime.now(timezone.utc) - timedelta(seconds=batch_window_seconds)
    existing = await db.notifications.find_one(
        {
            "user_id": user_id,
            "type": notification_type,
            "is_read": False,
            "created_at": {"$gte": cutoff_time.isoformat()},
            "metadata.workspace_id": metadata.get("workspace_id") if metadata else None,
            "metadata.changed_by_id": metadata.get("changed_by_id") if metadata else None
        },
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if existing:
        # Update existing notification with batched count
        existing_count = existing.get("metadata", {}).get("batch_count", 1)
        new_count = existing_count + 1
        
        # Update message to reflect batching
        changed_by_name = metadata.get("changed_by_name", "Someone") if metadata else "Someone"
        workspace_name = metadata.get("workspace_name", "Unknown") if metadata else "Unknown"
        batched_title = f"{new_count} changes made by {changed_by_name}"
        batched_message = f"{changed_by_name} made {new_count} changes in \"{workspace_name}\""
        
        updated_metadata = existing.get("metadata", {})
        updated_metadata["batch_count"] = new_count
        updated_metadata["last_change"] = metadata  # Store latest change metadata
        
        await db.notifications.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "title": batched_title,
                    "message": batched_message,
                    "metadata": updated_metadata,
                    "created_at": datetime.now(timezone.utc).isoformat()  # Update timestamp
                }
            }
        )
        
        # Return updated notification
        updated = await db.notifications.find_one({"id": existing["id"]}, {"_id": 0})
        return Notification(**updated) if updated else await create_notification(user_id, notification_type, title, message, metadata)
    
    # No existing notification - create new one with batch_count=1
    batched_metadata = metadata.copy() if metadata else {}
    batched_metadata["batch_count"] = 1
    
    return await create_notification(user_id, notification_type, title, message, batched_metadata)

def create_slug(name: str) -> str:
    """Create URL-friendly slug from name."""
    return name.lower().replace(' ', '-').replace('_', '-')[:50]

def validate_walkthrough_slug(slug: str) -> str:
    """Validate and normalize walkthrough slug. Returns normalized slug or raises HTTPException."""
    if not slug:
        return None
    
    # Normalize: lowercase, replace spaces/underscores with hyphens, remove special chars
    normalized = slug.lower().strip()
    normalized = normalized.replace(' ', '-').replace('_', '-')
    # Remove any characters that aren't alphanumeric or hyphens
    normalized = ''.join(c if c.isalnum() or c == '-' else '' for c in normalized)
    # Remove multiple consecutive hyphens
    normalized = '-'.join(filter(None, normalized.split('-')))
    # Limit length
    normalized = normalized[:50]
    
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid slug: must contain at least one alphanumeric character")
    
    return normalized

async def ensure_unique_walkthrough_slug(workspace_id: str, slug: str, exclude_walkthrough_id: Optional[str] = None) -> str:
    """Ensure walkthrough slug is unique within workspace. Returns unique slug (may append number if needed)."""
    if not slug:
        return None
    
    base_slug = slug
    counter = 1
    unique_slug = base_slug
    
    while True:
        query = {"workspace_id": workspace_id, "slug": unique_slug, "archived": {"$ne": True}}
        if exclude_walkthrough_id:
            query["id"] = {"$ne": exclude_walkthrough_id}
        
        existing = await db.walkthroughs.find_one(query, {"_id": 0, "id": 1})
        if not existing:
            return unique_slug
        
        # Slug exists, try with counter
        unique_slug = f"{base_slug}-{counter}"
        counter += 1
        
        # Safety limit
        if counter > 1000:
            raise HTTPException(status_code=400, detail="Unable to generate unique slug. Please try a different name.")

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

async def can_access_paid_features(user_id: str) -> bool:
    """
    Single source of truth for subscription access control.
    
    Three states:
    1. Free tier user ╬ô├Ñ├å always allowed
    2. Paid user with active subscription ╬ô├Ñ├å allowed
    3. Paid user with inactive subscription ╬ô├Ñ├å blocked (after grace)
    
    Rules:
    - Free tier bypasses all blocking
    - Grace applies only to paid users
    - No frontend logic, no cached flags, no heuristics
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return False
    
    # Get user's plan
    plan_id = user.get('plan_id')
    if not plan_id:
        # No plan assigned - default to free tier (allowed)
        return True
    
    plan = await db.plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        # Plan not found - default to allowed to avoid false blocks
        return True
    
    # Free tier users always have access
    if plan.get('name') == 'free':
        return True
    
    # Paid plan user - check subscription status
    subscription = await get_user_subscription(user_id)
    
    # Active subscription ╬ô├Ñ├å allowed
    if subscription and subscription.status == SubscriptionStatus.ACTIVE:
        return True
    
    # Check grace period for past_due/cancelled/expired subscriptions
    grace_ends_at = user.get('grace_period_ends_at')
    if grace_ends_at:
        try:
            if isinstance(grace_ends_at, str):
                grace_end = datetime.fromisoformat(grace_ends_at.replace('Z', '+00:00'))
            else:
                grace_end = grace_ends_at
            
            now = datetime.now(timezone.utc)
            
            # Within grace period ╬ô├Ñ├å allowed
            if now < grace_end:
                return True
        except Exception as e:
            logging.error(f"Error checking grace period for user {user_id}: {e}", exc_info=True)
    
    # Paid user with no active subscription and no grace ╬ô├Ñ├å blocked
    return False

async def require_subscription_access(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to enforce subscription access for workspace, portal, and API routes.
    
    Blocks paid users with inactive subscriptions (after grace period).
    Free tier users are never blocked.
    
    Raises HTTPException with 402 status code if access is denied.
    """
    has_access = await can_access_paid_features(current_user.id)
    
    if not has_access:
        # User is blocked - paid plan with inactive subscription
        raise HTTPException(
            status_code=402,
            detail="Subscription inactive. Please reactivate your subscription to continue."
        )
    
    return current_user

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
    """Get total storage allowed for user (plan storage + extra storage).
    Respects admin-set custom_storage_bytes override if present.
    """
    # Check for custom storage override (admin-set)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "custom_storage_bytes": 1})
    if user and user.get('custom_storage_bytes') is not None:
        return user['custom_storage_bytes']
    
    # Use plan-based storage
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

async def delete_files_by_urls(urls: List[str], workspace_id: str) -> int:
    """
    Delete files by their URLs (for cascade deletion). Returns count of deleted files.
    
    CRITICAL: Uses workspace_id instead of user_id because file records store
    user_id = workspace['owner_id'] for quota tracking. This ensures files uploaded
    by collaborators can be deleted correctly.
    """
    if not urls:
        return 0
    
    deleted_count = 0
    for url in urls:
        # Find file record by URL and workspace_id
        # Note: We use workspace_id because file.user_id = workspace.owner_id for quota tracking
        file_record = await db.files.find_one(
            {"url": url, "workspace_id": workspace_id, "status": FileStatus.ACTIVE},
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
    # Defensive serialization: Handle missing timestamps for backward compatibility
    if file_dict.get('created_at'):
        file_dict['created_at'] = file_dict['created_at'].isoformat()
    else:
        file_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    if file_dict.get('updated_at'):
        file_dict['updated_at'] = file_dict['updated_at'].isoformat()
    else:
        file_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.files.insert_one(file_dict)
    logging.info(f"Created file record for migrated URL: {url}")
    
    return file_id

async def initialize_default_plans():
    """Initialize or update default plans to match current code configuration."""
    plans = [
        {
            "id": "plan_free",
            "name": "free",
            "display_name": "Free",
            "max_workspaces": 1,
            "max_categories": 3,
            "max_walkthroughs": 5,  # Up to 5 guides
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
            # NOTE: PayPal plan must be created manually with:
            # - NO TRIAL (removed as of Jan 2026)
            # - $5/month for first 12 months (introductory pricing)
            # - $10/month after 12 months (regular pricing)
            # Update 'paypal_plan_id' field after creating the plan in PayPal
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
            # Create new plan
            await db.plans.insert_one(plan_data)
            logging.info(f"Created plan: {plan_data['name']}")
        else:
            # Update existing plan with current configuration
            # Preserve created_at from existing plan
            plan_data["created_at"] = existing.get("created_at", plan_data["created_at"])
            plan_data["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            await db.plans.update_one(
                {"id": plan_data["id"]},
                {"$set": plan_data}
            )
            logging.info(f"Updated plan: {plan_data['name']} with current configuration")
    
    # Delete deprecated plans (pro-testing)
    deprecated_plans = ["pro-testing"]
    for deprecated_name in deprecated_plans:
        result = await db.plans.delete_one({"name": deprecated_name})
        if result.deleted_count > 0:
            logging.info(f"Deleted deprecated plan: {deprecated_name}")

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
async def signup(user_data: UserCreate, background_tasks: BackgroundTasks, response: Response, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    enforce_auth_rate_limit(f"signup:{client_ip}:{user_data.email}")
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
    
    token, csrf_token = create_token(user.id)
    set_auth_cookie(response, token, csrf_token)
    
    # Use model_dump to ensure proper JSON serialization
    # Note: email_verification_sent is always True here since email is sent in background
    # Actual email send status is logged but doesn't affect response
    return {"user": user.model_dump(mode='json'), "token": token, "email_verification_sent": True}

@api_router.post("/auth/login")
async def login(login_data: UserLogin, response: Response, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    enforce_auth_rate_limit(f"login:{client_ip}:{login_data.email}")
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc or not verify_password(login_data.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**{k: v for k, v in user_doc.items() if k != 'password'})
    token, csrf_token = create_token(user.id)
    set_auth_cookie(response, token, csrf_token)
    
    return {"user": user, "token": token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"success": True}

@api_router.get("/auth/verify-email")
async def verify_email(token: str = Query(..., description="Email verification token")):
    """
    Verify user email address using verification token.
    Token is single-use and must not be expired.
    """
    if not token:
        raise HTTPException(status_code=400, detail="Verification token is required")
    
    # First, check if user with this token is already verified
    # This handles the case where verification succeeds but frontend makes duplicate request
    all_users_cursor = db.users.find(
        {
            "email_verification_token": {"$ne": None}
        },
        {"_id": 0}
    )
    
    already_verified_user = None
    async for user_doc in all_users_cursor:
        stored_hash = user_doc.get('email_verification_token')
        # Check if this user has/had this token AND is already verified
        if stored_hash and verify_verification_token(token, stored_hash):
            if user_doc.get('email_verified'):
                already_verified_user = user_doc
                break
    
    if already_verified_user:
        # Token is valid but user is already verified - return success
        logging.info(f"Email verification attempted for already verified user {already_verified_user['id']} ({already_verified_user['email']})")
        return {
            "success": True,
            "message": "Email already verified. You can access the dashboard.",
            "email": already_verified_user['email'],
            "already_verified": True
        }
    
    # Find user with this verification token who is NOT yet verified
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
    
    # Mark email as verified but DON'T clear verification token yet
    # Keep the token so duplicate requests can detect "already verified" state
    # The token will naturally become unusable as email_verified is now True
    await db.users.update_one(
        {"id": verified_user['id']},
        {
            "$set": {
                "email_verified": True
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

@api_router.get("/onboarding/status")
async def get_onboarding_status(current_user: User = Depends(get_current_user)):
    return {
        "has_completed_onboarding": current_user.has_completed_onboarding,
        "has_dismissed_onboarding": current_user.has_dismissed_onboarding
    }

@api_router.post("/onboarding/complete")
async def complete_onboarding(current_user: User = Depends(get_current_user)):
    try:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"has_completed_onboarding": True, "has_dismissed_onboarding": False, "updated_at": datetime.now(timezone.utc)}}
        )
        return {"success": True, "message": "Onboarding marked as completed"}
    except Exception as error:
        logging.error(f"Failed to mark onboarding as completed: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update onboarding status")

@api_router.post("/onboarding/dismiss")
async def dismiss_onboarding(current_user: User = Depends(get_current_user)):
    try:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"has_dismissed_onboarding": True, "updated_at": datetime.now(timezone.utc)}}
        )
        return {"success": True, "message": "Onboarding dismissed"}
    except Exception as error:
        logging.error(f"Failed to dismiss onboarding: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update onboarding status")

@api_router.post("/auth/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    http_request: Request
):
    """
    Request password reset for user.
    Always returns success message regardless of whether email exists (security).
    Generates secure reset token and sends reset email.
    """
    try:
        client_ip = http_request.client.host if http_request.client else "unknown"
        enforce_auth_rate_limit(f"forgot:{client_ip}:{request.email}")
        # Check if user exists (but don't reveal this information)
        user_doc = await db.users.find_one({"email": request.email}, {"_id": 0})

        if user_doc:
            # Generate password reset token
            reset_token = generate_verification_token()
            token_hash = hash_verification_token(reset_token)
            token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)  # 1 hour expiry

            # Update user with reset token
            await db.users.update_one(
                {"email": request.email},
                {
                    "$set": {
                        "password_reset_token": token_hash,
                        "password_reset_expires_at": token_expires_at.isoformat(),
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )

            # Send reset email in background
            reset_url = f"{MAIN_DOMAIN}/reset-password?token={reset_token}"
            background_tasks.add_task(
                send_password_reset_email,
                request.email,
                reset_url,
                user_doc.get('name')
            )

        # Always return success to prevent user enumeration
        return {
            "success": True,
            "message": "If the email is registered, you'll receive a reset link shortly. Check your spam folder if needed."
        }

    except Exception as error:
        logging.error(f"Failed to process password reset request: {error}", exc_info=True)
        # Still return success for security
        return {
            "success": True,
            "message": "If the email is registered, you'll receive a reset link shortly. Check your spam folder if needed."
        }

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Reset user password using valid reset token.
    Validates token, updates password, and invalidates all reset tokens.
    """
    if not request.token:
        raise HTTPException(status_code=400, detail="Reset token is required")

    if request.new_password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    # Validate password strength
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

    try:
        token_hash = hash_verification_token(request.token)
        # Find user with matching reset token
        user_doc = await db.users.find_one({
            "password_reset_token": token_hash,
            "password_reset_expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
        }, {"_id": 0})

        if not user_doc:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

        # Verify token
        stored_hash = user_doc.get('password_reset_token')
        expires_at_str = user_doc.get('password_reset_expires_at')

        if not stored_hash or not expires_at_str:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

        # Check if token is expired
        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > expires_at:
                raise HTTPException(status_code=400, detail="Reset token has expired")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid reset token format")

        # Verify token hash
        if not verify_verification_token(request.token, stored_hash):
            raise HTTPException(status_code=400, detail="Invalid reset token")

        # Hash new password
        hashed_password = hash_password(request.new_password)

        # Update password and clear reset tokens
        await db.users.update_one(
            {"id": user_doc['id']},
            {
                "$set": {
                    "password": hashed_password,
                    "password_reset_token": None,
                    "password_reset_expires_at": None,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )

        return {
            "success": True,
            "message": "Password reset successfully. You can now log in with your new password."
        }

    except HTTPException:
        raise
    except Exception as error:
        logging.error(f"Failed to reset password: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to reset password")

# Notification Routes
@api_router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    """Get all notifications for current user, ordered by created_at descending."""
    notifications = await db.notifications.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Filter out INVITE notifications for invitations that have already been accepted/declined
    filtered_notifications = []
    for n in notifications:
        if n.get("type") == NotificationType.INVITE and n.get("metadata", {}).get("invitation_id"):
            # Check if invitation has been handled
            invitation_id = n["metadata"]["invitation_id"]
            workspace_id = n.get("metadata", {}).get("workspace_id")
            if workspace_id:
                member = await get_workspace_member(workspace_id, current_user.id)
                if member and member.status != InvitationStatus.PENDING:
                    # Invitation has been accepted/declined, skip this notification
                    continue
        filtered_notifications.append(n)
    
    safe_notifications = []
    for n in filtered_notifications:
        try:
            safe_notifications.append(Notification(**n))
        except Exception as error:
            logging.error(f"[NOTIFICATIONS] Invalid notification payload skipped: {error}", exc_info=True)
    return safe_notifications

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    """Mark a notification as read."""
    notification = await db.notifications.find_one(
        {"id": notification_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"is_read": True}}
    )
    return {"success": True, "message": "Notification marked as read"}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, current_user: User = Depends(get_current_user)):
    """Delete a notification."""
    notification = await db.notifications.find_one(
        {"id": notification_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.notifications.delete_one({"id": notification_id})
    return {"success": True, "message": "Notification deleted"}

# Workspace Invitation Routes
class InviteRequest(BaseModel):
    email: EmailStr

async def can_user_share_workspaces(user_id: str) -> bool:
    """Check if user can share workspaces (must have Pro plan or active subscription, or be in grace period)."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "plan_id": 1, "grace_period_ends_at": 1})
    if not user:
        return False
    
    # Check grace period
    grace_ends_at = user.get('grace_period_ends_at')
    if grace_ends_at:
        try:
            if isinstance(grace_ends_at, str):
                grace_end = datetime.fromisoformat(grace_ends_at.replace('Z', '+00:00'))
            else:
                grace_end = grace_ends_at
            if grace_end > datetime.now(timezone.utc):
                return True  # Still in grace period
        except Exception:
            pass
    
    # Check plan
    plan_id = user.get('plan_id')
    if plan_id:
        plan = await db.plans.find_one({"id": plan_id}, {"_id": 0, "name": 1})
        if plan and plan.get('name') == 'pro':
            # Check subscription status
            subscription = await get_user_subscription(user_id)
            if subscription and subscription.status in [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING]:
                return True
    
    return False

@api_router.post("/workspaces/{workspace_id}/invite")
async def invite_user_to_workspace(
    workspace_id: str,
    invite_data: InviteRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Invite a user to a workspace by email.
    Only workspace owner can invite users.
    Free/expired users cannot share workspaces.
    """
    # Check if user is owner
    if not await is_workspace_owner(workspace_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only workspace owner can invite users")
    
    # SECURITY INVARIANT: Free/expired users cannot invite to workspaces
    # REGRESSION GUARD: This check MUST happen before creating invitation
    if not await can_user_share_workspaces(current_user.id):
        raise HTTPException(
            status_code=403,
            detail="Workspace sharing requires a Pro subscription. Please upgrade to share workspaces."
        )
    
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Find user by email
    invitee = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
    if not invitee:
        raise HTTPException(status_code=404, detail="User with this email not found. User must have an account to be invited.")
    
    invitee_user_id = invitee['id']
    
    # Prevent inviting yourself
    if invitee_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")
    
    # Check for existing pending or accepted invitation
    existing_member = await db.workspace_members.find_one(
        {
            "workspace_id": workspace_id,
            "user_id": invitee_user_id,
            "status": {"$in": [InvitationStatus.PENDING, InvitationStatus.ACCEPTED]}
        },
        {"_id": 0}
    )
    if existing_member:
        if existing_member['status'] == InvitationStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="User is already a member of this workspace")
        else:
            raise HTTPException(status_code=400, detail="User already has a pending invitation")
    
    # Create invitation (WorkspaceMember with PENDING status)
    try:
        invited_at = datetime.now(timezone.utc)
        member = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=invitee_user_id,
            role=UserRole.EDITOR,  # Shared users are members with EDITOR role
            status=InvitationStatus.PENDING,
            invited_by_user_id=current_user.id,
            invited_at=invited_at
        )
        member_dict = member.model_dump()
        # Ensure datetime fields are properly serialized
        if 'invited_at' in member_dict and member_dict['invited_at']:
            if isinstance(member_dict['invited_at'], datetime):
                member_dict['invited_at'] = member_dict['invited_at'].isoformat()
        if 'joined_at' in member_dict and member_dict['joined_at']:
            if isinstance(member_dict['joined_at'], datetime):
                member_dict['joined_at'] = member_dict['joined_at'].isoformat()
        if 'responded_at' in member_dict and member_dict['responded_at']:
            if isinstance(member_dict['responded_at'], datetime):
                member_dict['responded_at'] = member_dict['responded_at'].isoformat()
        await db.workspace_members.insert_one(member_dict)
        
        # HARDENING LAYER C: Audit log
        try:
            await log_workspace_audit(
                action_type=WorkspaceAuditAction.INVITE_SENT,
                workspace_id=workspace_id,
                actor_user_id=current_user.id,
                target_user_id=invitee_user_id,
                metadata={"invitee_email": invite_data.email, "inviter_name": current_user.name}
            )
        except Exception as audit_error:
            logging.error(f"Failed to log audit entry for invitation: {audit_error}")
            # Don't fail the invitation if audit logging fails
        
        # Create notification for invitee (not batched - invitations are never batched)
        try:
            await create_notification(
                user_id=invitee_user_id,
                notification_type=NotificationType.INVITE,
                title="Workspace Invitation",
                message=f"{current_user.name} has invited you to collaborate on the workspace \"{workspace['name']}\"",
                metadata={"workspace_id": workspace_id, "invitation_id": member.id, "inviter_id": current_user.id, "inviter_name": current_user.name}
            )
        except Exception as notif_error:
            logging.error(f"Failed to create notification for invitation: {notif_error}", exc_info=True)
            # Don't fail the invitation if notification creation fails, but log the error
            # The invitation was created successfully, so we continue
    except Exception as e:
        logging.error(f"Failed to create invitation: {e}", exc_info=True)
        # Provide more specific error message
        error_detail = str(e)
        if "duplicate key" in error_detail.lower() or "E11000" in error_detail:
            raise HTTPException(status_code=400, detail="User already has a pending or accepted invitation")
        raise HTTPException(status_code=500, detail=f"Failed to create invitation: {error_detail}")
    
    # Send invitation email (background task)
    background_tasks.add_task(
        send_invitation_email,
        invite_data.email,
        workspace['name'],
        current_user.name
    )
    
    return {
        "success": True,
        "message": f"Invitation sent to {invite_data.email}",
        "invitation_id": member.id
    }

@api_router.post("/workspaces/{workspace_id}/invitations/{invitation_id}/accept")
async def accept_invitation(
    workspace_id: str,
    invitation_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Accept a workspace invitation.
    Free/expired users cannot accept workspace invitations (sharing is Pro-only).
    """
    # SECURITY INVARIANT: Free/expired users cannot accept invitations
    # REGRESSION GUARD: This check MUST happen before accepting invitation
    if not await can_user_share_workspaces(current_user.id):
        raise HTTPException(
            status_code=403,
            detail="Workspace sharing requires a Pro subscription. Please upgrade to access shared workspaces."
        )
    """Accept a workspace invitation."""
    # First check if invitation exists at all (even if not pending)
    existing_member = await db.workspace_members.find_one(
        {
            "id": invitation_id,
            "workspace_id": workspace_id,
            "user_id": current_user.id
        },
        {"_id": 0, "status": 1}
    )
    
    if not existing_member:
        raise HTTPException(status_code=404, detail="Invitation not found. It may have been cancelled.")
    
    # Check if invitation is still pending
    if existing_member.get("status") != InvitationStatus.PENDING:
        status = existing_member.get("status", "unknown")
        if status == InvitationStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="Invitation has already been accepted")
        elif status == InvitationStatus.DECLINED:
            raise HTTPException(status_code=400, detail="Invitation has already been declined")
        else:
            raise HTTPException(status_code=400, detail=f"Invitation is no longer pending (status: {status})")
    
    # Find invitation with pending status (for full member data)
    member = await db.workspace_members.find_one(
        {
            "id": invitation_id,
            "workspace_id": workspace_id,
            "user_id": current_user.id,
            "status": InvitationStatus.PENDING
        },
        {"_id": 0}
    )
    
    # Double-check (should not happen, but safety check)
    if not member:
        raise HTTPException(status_code=404, detail="Invitation not found or no longer pending")
    
    # Update invitation status
    responded_at = datetime.now(timezone.utc)
    await db.workspace_members.update_one(
        {"id": invitation_id},
        {
            "$set": {
                "status": InvitationStatus.ACCEPTED,
                "responded_at": responded_at.isoformat(),
                "joined_at": responded_at.isoformat()
            }
        }
    )
    
    # Mark the invitation notification as read for the invitee
    try:
        await db.notifications.update_many(
            {
                "user_id": current_user.id,
                "type": NotificationType.INVITE,
                "metadata.invitation_id": invitation_id
            },
            {"$set": {"is_read": True}}
        )
    except Exception as notif_read_error:
        logging.error(f"Failed to mark invitation notification as read: {notif_read_error}", exc_info=True)
        # Don't fail the acceptance if notification update fails
    
    # HARDENING LAYER C: Audit log
    try:
        await log_workspace_audit(
            action_type=WorkspaceAuditAction.INVITE_ACCEPTED,
            workspace_id=workspace_id,
            actor_user_id=current_user.id,
            target_user_id=member.get('invited_by_user_id'),
            metadata={"accepted_by_name": current_user.name}
        )
    except Exception as audit_error:
        logging.error(f"Failed to log audit entry for invitation acceptance: {audit_error}", exc_info=True)
        # Don't fail the acceptance if audit logging fails
    
    # Get workspace and inviter info
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
    inviter_id = member.get('invited_by_user_id')
    inviter = await db.users.find_one({"id": inviter_id}, {"_id": 0, "name": 1}) if inviter_id else None
    inviter_name = inviter.get("name", "Someone") if inviter else "Someone"
    
    # Notify inviter (not batched - invitation events are never batched)
    if inviter_id:
        try:
            await create_notification(
                user_id=inviter_id,
                notification_type=NotificationType.INVITE_ACCEPTED,
                title="Invitation Accepted",
                message=f"{current_user.name} has accepted your invitation to collaborate on \"{workspace.get('name', 'Unknown')}\"",
                metadata={"workspace_id": workspace_id, "accepted_by_id": current_user.id, "accepted_by_name": current_user.name}
            )
        except Exception as notif_error:
            logging.error(f"Failed to create notification for invitation acceptance: {notif_error}", exc_info=True)
            # Don't fail the acceptance if notification creation fails
    
    # Notify invitee that they accepted the invitation
    try:
        await create_notification(
            user_id=current_user.id,
            notification_type=NotificationType.WORKSPACE_CHANGE,
            title="Invitation Accepted",
            message=f"You have accepted the invitation to collaborate on \"{workspace.get('name', 'Unknown')}\"",
            metadata={"workspace_id": workspace_id, "action": "invitation_accepted"}
        )
    except Exception as notif_error:
        logging.error(f"Failed to create acceptance confirmation notification: {notif_error}", exc_info=True)
        # Don't fail the acceptance if notification creation fails
    
    return {
        "success": True,
        "message": "Invitation accepted successfully",
        "workspace_id": workspace_id
    }

@api_router.post("/workspaces/{workspace_id}/invitations/{invitation_id}/decline")
async def decline_invitation(
    workspace_id: str,
    invitation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Decline a workspace invitation."""
    # First check if invitation exists at all (even if not pending)
    existing_member = await db.workspace_members.find_one(
        {
            "id": invitation_id,
            "workspace_id": workspace_id,
            "user_id": current_user.id
        },
        {"_id": 0, "status": 1}
    )
    
    if not existing_member:
        raise HTTPException(status_code=404, detail="Invitation not found. It may have been cancelled.")
    
    # Check if invitation is still pending
    if existing_member.get("status") != InvitationStatus.PENDING:
        status = existing_member.get("status", "unknown")
        if status == InvitationStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="Invitation has already been accepted")
        elif status == InvitationStatus.DECLINED:
            raise HTTPException(status_code=400, detail="Invitation has already been declined")
        else:
            raise HTTPException(status_code=400, detail=f"Invitation is no longer pending (status: {status})")
    
    # Find invitation with pending status (for full member data)
    member = await db.workspace_members.find_one(
        {
            "id": invitation_id,
            "workspace_id": workspace_id,
            "user_id": current_user.id,
            "status": InvitationStatus.PENDING
        },
        {"_id": 0}
    )
    
    # Double-check (should not happen, but safety check)
    if not member:
        raise HTTPException(status_code=404, detail="Invitation not found or no longer pending")
    
    # Update invitation status
    responded_at = datetime.now(timezone.utc)
    await db.workspace_members.update_one(
        {"id": invitation_id},
        {
            "$set": {
                "status": InvitationStatus.DECLINED,
                "responded_at": responded_at.isoformat()
            }
        }
    )
    
    # Mark the invitation notification as read for the invitee
    try:
        await db.notifications.update_many(
            {
                "user_id": current_user.id,
                "type": NotificationType.INVITE,
                "metadata.invitation_id": invitation_id
            },
            {"$set": {"is_read": True}}
        )
    except Exception as notif_read_error:
        logging.error(f"Failed to mark invitation notification as read: {notif_read_error}", exc_info=True)
        # Don't fail the decline if notification update fails
    
    # HARDENING LAYER C: Audit log
    try:
        await log_workspace_audit(
            action_type=WorkspaceAuditAction.INVITE_DECLINED,
            workspace_id=workspace_id,
            actor_user_id=current_user.id,
            target_user_id=member.get('invited_by_user_id'),
            metadata={"declined_by_name": current_user.name}
        )
    except Exception as audit_error:
        logging.error(f"Failed to log audit entry for invitation decline: {audit_error}", exc_info=True)
        # Don't fail the decline if audit logging fails
    
    # HARDENING LAYER A: Check and release lock if user had one (declined invite means no access)
    try:
        await release_workspace_lock(workspace_id, current_user.id, force=True, reason="Invitation declined - access revoked")
    except Exception as lock_error:
        logging.error(f"Failed to release lock on invitation decline: {lock_error}", exc_info=True)
        # Don't fail the decline if lock release fails
    
    # HARDENING LAYER A: Invariant check
    try:
        await check_membership_lock_invariant(workspace_id)
    except Exception as invariant_error:
        logging.error(f"Failed to check membership lock invariant on decline: {invariant_error}", exc_info=True)
        # Don't fail the decline if invariant check fails
    
    # Get workspace and inviter info
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
    inviter_id = member.get('invited_by_user_id')
    inviter = await db.users.find_one({"id": inviter_id}, {"_id": 0, "name": 1}) if inviter_id else None
    inviter_name = inviter.get("name", "Someone") if inviter else "Someone"
    
    # Notify inviter (not batched - invitation events are never batched)
    if inviter_id:
        try:
            await create_notification(
                user_id=inviter_id,
                notification_type=NotificationType.INVITE_DECLINED,
                title="Invitation Declined",
                message=f"{current_user.name} has declined your invitation to collaborate on \"{workspace.get('name', 'Unknown')}\"",
                metadata={"workspace_id": workspace_id, "declined_by_id": current_user.id, "declined_by_name": current_user.name}
            )
        except Exception as notif_error:
            logging.error(f"Failed to create notification for invitation decline: {notif_error}", exc_info=True)
            # Don't fail the decline if notification creation fails
    
    # Notify invitee that they declined the invitation
    try:
        await create_notification(
            user_id=current_user.id,
            notification_type=NotificationType.WORKSPACE_CHANGE,
            title="Invitation Declined",
            message=f"You have declined the invitation to collaborate on \"{workspace.get('name', 'Unknown')}\"",
            metadata={"workspace_id": workspace_id, "action": "invitation_declined"}
        )
    except Exception as notif_error:
        logging.error(f"Failed to create decline confirmation notification: {notif_error}", exc_info=True)
        # Don't fail the decline if notification creation fails
    
    return {
        "success": True,
        "message": "Invitation declined"
    }

# Workspace Lock Routes
@api_router.post("/workspaces/{workspace_id}/lock")
async def lock_workspace(
    workspace_id: str,
    force: bool = Query(False, description="Force release existing lock if another user has it"),
    current_user: User = Depends(get_current_user)
):
    """
    Acquire workspace lock. Returns lock info or error if locked by another user.
    
    CRITICAL: Expired locks are automatically deleted - backend is authoritative.
    This endpoint is self-healing: stale locks from crashes/closes don't block users.
    """
    # Check workspace access first
    await check_workspace_access(workspace_id, current_user.id)
    
    # acquire_workspace_lock automatically handles expired locks via get_workspace_lock
    lock = await acquire_workspace_lock(workspace_id, current_user.id, force=force)
    return {
        "success": True,
        "locked_by_user_id": lock.locked_by_user_id,
        "locked_at": lock.locked_at.isoformat(),
        "expires_at": lock.expires_at.isoformat()
    }

@api_router.post("/workspaces/{workspace_id}/lock/heartbeat")
async def refresh_workspace_lock(
    workspace_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Refresh workspace lock TTL (heartbeat).
    
    CRITICAL: This endpoint extends the lock expiration for active sessions.
    Frontend should call this every 30-60 seconds while user is actively in workspace.
    If lock doesn't exist or is held by another user, returns error.
    Backend is authoritative - expired locks are automatically deleted.
    """
    # Check workspace access first
    await check_workspace_access(workspace_id, current_user.id)
    
    # Get current lock (enforces expiration - deletes expired locks)
    existing_lock = await get_workspace_lock(workspace_id)
    
    if not existing_lock:
        raise HTTPException(
            status_code=404,
            detail="Workspace lock not found. Lock may have expired or been released."
        )
    
    if existing_lock.locked_by_user_id != current_user.id:
        # Lock is held by another user
        locked_by_user = await db.users.find_one({"id": existing_lock.locked_by_user_id}, {"_id": 0, "name": 1})
        locked_by_name = locked_by_user.get("name", "Another user") if locked_by_user else "Another user"
        raise HTTPException(
            status_code=403,
            detail=f"Workspace lock is held by another user ({locked_by_name})"
        )
    
    # Extend lock TTL (refresh heartbeat)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)  # 10 minute TTL
    await db.workspace_locks.update_one(
        {"workspace_id": workspace_id},
        {"$set": {"expires_at": expires_at.isoformat()}}
    )
    
    return {
        "success": True,
        "expires_at": expires_at.isoformat()
    }

@api_router.delete("/workspaces/{workspace_id}/lock")
async def unlock_workspace(
    workspace_id: str,
    current_user: User = Depends(get_current_user)
):
    """Release workspace lock."""
    await release_workspace_lock(workspace_id, current_user.id)
    return {"success": True, "message": "Workspace lock released"}

# Workspace Member Management
@api_router.get("/workspaces/{workspace_id}/members")
async def get_workspace_members_endpoint(
    workspace_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get all members of a workspace (including pending invitations).
    Only workspace owner can view all members.
    Members can view accepted members only.
    """
    # Check workspace access
    member = await check_workspace_access(workspace_id, current_user.id)
    
    # Get workspace to check ownership
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "owner_id": 1})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    is_owner = workspace.get("owner_id") == current_user.id
    
    # Owners can see all members (including pending), members can only see accepted
    query = {"workspace_id": workspace_id}
    if not is_owner:
        query["status"] = InvitationStatus.ACCEPTED
    
    # Fetch members with user email lookup
    members_cursor = db.workspace_members.find(query, {"_id": 0}).to_list(1000)
    members_list = await members_cursor
    
    # Enrich with user email
    result = []
    for m in members_list:
        user_doc = await db.users.find_one({"id": m["user_id"]}, {"_id": 0, "email": 1, "name": 1})
        member_dict = dict(m)
        if user_doc:
            member_dict["user_email"] = user_doc.get("email", "")
            member_dict["user_name"] = user_doc.get("name", "")
        result.append(member_dict)
    
    # Add owner if not already in list
    owner_id = workspace.get("owner_id")
    owner_in_list = any(m["user_id"] == owner_id for m in result)
    if not owner_in_list and owner_id:
        owner_doc = await db.users.find_one({"id": owner_id}, {"_id": 0, "email": 1, "name": 1})
        if owner_doc:
            result.append({
                "id": "owner",
                "workspace_id": workspace_id,
                "user_id": owner_id,
                "role": UserRole.OWNER,
                "status": InvitationStatus.ACCEPTED,
                "user_email": owner_doc.get("email", ""),
                "user_name": owner_doc.get("name", "")
            })
    
    return result

@api_router.delete("/workspaces/{workspace_id}/members/{user_id}")
async def remove_workspace_member(
    workspace_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Remove a member from workspace.
    Only workspace owner can remove members.
    Removed member is notified and loses access immediately.
    """
    # Only owner can remove members
    await check_workspace_access(workspace_id, current_user.id, require_owner=True)
    
    # Cannot remove yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from workspace")
    
    # Find member to remove
    member = await db.workspace_members.find_one(
        {"workspace_id": workspace_id, "user_id": user_id},
        {"_id": 0}
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Get workspace info
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
    workspace_name = workspace.get("name", "Unknown") if workspace else "Unknown"
    
    # HARDENING LAYER A: Force-release lock BEFORE removing member (invariant enforcement)
    lock_released = False
    try:
        lock_released = await release_workspace_lock(workspace_id, user_id, force=True, reason="Member removed from workspace")
    except Exception as lock_error:
        logging.error(f"Failed to release lock when removing member: {lock_error}", exc_info=True)
        # Continue with removal even if lock release fails
    
    # Remove member
    await db.workspace_members.delete_one({"workspace_id": workspace_id, "user_id": user_id})
    
    # HARDENING LAYER A: Invariant check after removal
    try:
        await check_membership_lock_invariant(workspace_id)
    except Exception as invariant_error:
        logging.error(f"Failed to check membership lock invariant after removal: {invariant_error}", exc_info=True)
        # Don't fail the removal if invariant check fails
    
    # HARDENING LAYER C: Audit log
    try:
        await log_workspace_audit(
            action_type=WorkspaceAuditAction.MEMBER_REMOVED,
            workspace_id=workspace_id,
            actor_user_id=current_user.id,
            target_user_id=user_id,
            metadata={"removed_by_name": current_user.name, "workspace_name": workspace_name, "lock_released": lock_released}
        )
    except Exception as audit_error:
        logging.error(f"Failed to log audit entry for member removal: {audit_error}", exc_info=True)
        # Don't fail the removal if audit logging fails
    
    # Notify removed member (not batched - member removal events are never batched)
    # Only notify if member was accepted (not pending invitations)
    member_status = member.get('status', 'accepted')
    if member_status == InvitationStatus.ACCEPTED:
        try:
            await create_notification(
                user_id=user_id,
                notification_type=NotificationType.MEMBER_REMOVED,
                title="Removed from Workspace",
                message=f"You have been removed from the workspace \"{workspace_name}\" by {current_user.name}",
                metadata={"workspace_id": workspace_id, "removed_by_id": current_user.id, "removed_by_name": current_user.name}
            )
        except Exception as notif_error:
            logging.error(f"Failed to create removal notification: {notif_error}", exc_info=True)
    
    return {"success": True, "message": "Member removed successfully"}

# Workspace Routes
@api_router.post("/workspaces", response_model=Workspace)
async def create_workspace(workspace_data: WorkspaceCreate, current_user: User = Depends(require_subscription_access)):
    # Check workspace count limit (respects custom quota override)
    plan = await get_user_plan(current_user.id)
    if not plan:
        raise HTTPException(status_code=400, detail="User has no plan assigned")
    
    # Check for custom workspace limit override
    user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "custom_max_workspaces": 1})
    max_workspaces = plan.max_workspaces
    if user and user.get('custom_max_workspaces') is not None:
        max_workspaces = user['custom_max_workspaces']
    
    workspace_count = await get_workspace_count(current_user.id)
    if max_workspaces is not None and workspace_count >= max_workspaces:
        raise HTTPException(
            status_code=402,
            detail=f"Workspace limit reached. Current: {workspace_count}, Limit: {max_workspaces}"
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
async def get_workspaces(current_user: User = Depends(require_subscription_access)):
    """
    Get all workspaces user has access to:
    - Workspaces owned by user (owner_id = user_id)
    - Workspaces where user is an accepted member (status = ACCEPTED)
    Pending/declined invitations are excluded.
    """
    # Get owned workspaces
    owned_workspaces = await db.workspaces.find({"owner_id": current_user.id}, {"_id": 0}).to_list(100)
    owned_ids = [w['id'] for w in owned_workspaces]
    
    # Get accepted shared workspaces
    accepted_members = await db.workspace_members.find(
        {"user_id": current_user.id, "status": InvitationStatus.ACCEPTED},
        {"_id": 0, "workspace_id": 1}
    ).to_list(100)
    shared_workspace_ids = [m['workspace_id'] for m in accepted_members]
    
    # Combine and fetch all workspaces
    all_workspace_ids = list(set(owned_ids + shared_workspace_ids))
    if not all_workspace_ids:
        return []
    
    workspaces = await db.workspaces.find({"id": {"$in": all_workspace_ids}}, {"_id": 0}).to_list(100)
    return [Workspace(**w) for w in workspaces]

@api_router.get("/workspaces/{workspace_id}", response_model=Workspace)
async def get_workspace(workspace_id: str, current_user: User = Depends(require_subscription_access)):
    # Support both UUID and slug - try slug first, then UUID
    workspace = await db.workspaces.find_one({"slug": workspace_id}, {"_id": 0})
    if not workspace:
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Use the actual workspace ID for access check
    actual_workspace_id = workspace['id']
    await check_workspace_access(actual_workspace_id, current_user.id)
    
    return Workspace(**workspace)

@api_router.put("/workspaces/{workspace_id}", response_model=Workspace)
async def update_workspace(workspace_id: str, workspace_data: WorkspaceCreate, current_user: User = Depends(require_subscription_access)):
    # Only owner can update workspace settings
    await check_workspace_access(workspace_id, current_user.id, require_owner=True)
    
    update_data = workspace_data.model_dump()
    update_data['slug'] = create_slug(workspace_data.name)
    
    await db.workspaces.update_one(
        {"id": workspace_id},
        {"$set": update_data}
    )
    
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    
    # Notify all members of workspace change (HARDENING LAYER B: Uses batched notifications)
    members = await get_workspace_members(workspace_id)
    for member in members:
        if member.user_id != current_user.id:  # Don't notify self
            await create_batched_notification(
                user_id=member.user_id,
                notification_type=NotificationType.WORKSPACE_CHANGE,
                title="Workspace Updated",
                message=f"{current_user.name} has updated workspace settings for \"{workspace['name']}\"",
                metadata={"workspace_id": workspace_id, "workspace_name": workspace['name'], "changed_by_id": current_user.id, "changed_by_name": current_user.name}
            )
    
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
    Only workspace owner can delete workspace.
    All members are notified when workspace is deleted.
    """
    try:
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "owner_id": 1, "name": 1})
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        if current_user.role != UserRole.ADMIN and workspace.get("owner_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Only workspace owner or admin can delete workspace")

        # Get workspace name for notifications
        try:
            workspace_name = workspace.get("name", "Unknown")
        except Exception as db_error:
            logging.error(f"Failed to get workspace name: {db_error}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database error while accessing workspace")

        # Get all members to notify
        try:
            members = await get_workspace_members(workspace_id)
        except Exception as member_error:
            logging.error(f"Failed to get workspace members: {member_error}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database error while getting workspace members")

        try:
            workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
        except Exception as workspace_error:
            logging.error(f"Failed to get workspace details: {workspace_error}", exc_info=True)
            raise

        # HARDENING LAYER A: Force-release all locks before deletion
        try:
            all_locks = await db.workspace_locks.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(100)
            for lock_doc in all_locks:
                await release_workspace_lock(workspace_id, lock_doc['locked_by_user_id'], force=True, reason="Workspace deleted")
        except Exception as lock_error:
            logging.error(f"Failed to release workspace locks: {lock_error}", exc_info=True)
            # Continue with deletion even if lock release fails

        # HARDENING LAYER C: Audit log
        try:
            await log_workspace_audit(
                action_type=WorkspaceAuditAction.WORKSPACE_DELETED,
                workspace_id=workspace_id,
                actor_user_id=current_user.id,
                metadata={"workspace_name": workspace_name, "deleted_by_name": current_user.name, "member_count": len(members)}
            )
        except Exception as audit_error:
            logging.error(f"Failed to log workspace deletion audit: {audit_error}", exc_info=True)
            # Continue with deletion even if audit logging fails

        # Notify all members that workspace is being deleted (not batched - workspace deletion is never batched)
        for member in members:
            try:
                await create_notification(
                    user_id=member.user_id,
                    notification_type=NotificationType.WORKSPACE_DELETED,
                    title="Workspace Deleted",
                    message=f"The workspace \"{workspace_name}\" has been deleted by {current_user.name}. You no longer have access to this workspace.",
                    metadata={"workspace_id": workspace_id, "deleted_by_id": current_user.id, "deleted_by_name": current_user.name}
                )
            except Exception as notification_error:
                logging.error(f"Failed to notify member {member.user_id}: {notification_error}", exc_info=True)
                # Continue with deletion even if notification fails

        # Get all walkthroughs in workspace for cascade file deletion
        try:
            walkthroughs = await db.walkthroughs.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(10000)
        except Exception as walkthrough_error:
            logging.error(f"Failed to get walkthroughs for deletion: {walkthrough_error}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database error while accessing walkthroughs")

        # Delete all files associated with walkthroughs
        total_deleted_files = 0
        for walkthrough in walkthroughs:
            try:
                file_urls = await extract_file_urls_from_walkthrough(walkthrough)
                deleted_count = await delete_files_by_urls(file_urls, workspace_id)
                total_deleted_files += deleted_count
            except Exception as file_error:
                logging.error(f"Failed to delete files for walkthrough {walkthrough.get('id')}: {file_error}", exc_info=True)
                # Continue with other walkthroughs

        # Delete workspace logo and background files
        workspace_file_urls = []
        if workspace.get('logo'):
            workspace_file_urls.append(workspace['logo'])
        if workspace.get('portal_background_url'):
            workspace_file_urls.append(workspace['portal_background_url'])

        if workspace_file_urls:
            try:
                deleted_count = await delete_files_by_urls(workspace_file_urls, workspace_id)
                total_deleted_files += deleted_count
            except Exception as workspace_file_error:
                logging.error(f"Failed to delete workspace files: {workspace_file_error}", exc_info=True)
                # Continue with deletion

        # Delete all walkthroughs (including archived)
        try:
            await db.walkthroughs.delete_many({"workspace_id": workspace_id})
        except Exception as delete_error:
            logging.error(f"Failed to delete walkthroughs: {delete_error}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database error while deleting walkthroughs")

        # Delete all walkthrough versions
        try:
            await db.walkthrough_versions.delete_many({"workspace_id": workspace_id})
        except Exception as version_error:
            logging.error(f"Failed to delete walkthrough versions: {version_error}", exc_info=True)
            # Continue with deletion

        # Delete all categories (cascade deletes sub-categories)
        # First get all categories to handle parent-child relationships
        try:
            all_categories = await db.categories.find({"workspace_id": workspace_id}, {"_id": 0, "id": 1}).to_list(1000)
            category_ids = [c["id"] for c in all_categories]

            # Delete category icon files
            for cat in all_categories:
                try:
                    cat_full = await db.categories.find_one({"id": cat["id"]}, {"_id": 0})
                    if cat_full and cat_full.get('icon_url'):
                        await delete_files_by_urls([cat_full['icon_url']], workspace_id)
                except Exception as cat_file_error:
                    logging.error(f"Failed to delete category icon files: {cat_file_error}", exc_info=True)

            # Delete all categories (including sub-categories)
            await db.categories.delete_many({"workspace_id": workspace_id})
        except Exception as category_error:
            logging.error(f"Failed to delete categories: {category_error}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database error while deleting categories")

        # Delete all workspace members
        try:
            await db.workspace_members.delete_many({"workspace_id": workspace_id})
        except Exception as member_delete_error:
            logging.error(f"Failed to delete workspace members: {member_delete_error}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database error while deleting workspace members")

        # Finally delete the workspace
        try:
            await db.workspaces.delete_one({"id": workspace_id})
        except Exception as workspace_delete_error:
            logging.error(f"Failed to delete workspace: {workspace_delete_error}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database error while deleting workspace")

        logging.info(f"Deleted workspace {workspace_id} and {total_deleted_files} associated files")

        return {
            "message": "Workspace deleted successfully",
            "deleted_files": total_deleted_files,
            "deleted_walkthroughs": len(walkthroughs),
            "deleted_categories": len(category_ids)
        }
    except Exception as unexpected_error:
        logging.error(f"Unexpected error during workspace deletion: {unexpected_error}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while deleting the workspace. Please try again or contact support.")

# Category Routes
@api_router.post("/workspaces/{workspace_id}/categories", response_model=Category)
async def create_category(workspace_id: str, category_data: CategoryCreate, current_user: User = Depends(require_subscription_access)):
    # Check workspace access (members can create categories, viewers cannot)
    member = await check_workspace_access(workspace_id, current_user.id)
    if member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot create categories")
    
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
    
    # Notify all members of category creation (HARDENING LAYER B: Uses batched notifications)
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
    members = await get_workspace_members(workspace_id)
    for m in members:
        if m.user_id != current_user.id:
            await create_batched_notification(
                user_id=m.user_id,
                notification_type=NotificationType.WORKSPACE_CHANGE,
                title="Category Created",
                message=f"{current_user.name} created a new category \"{category_data.name}\" in \"{workspace.get('name', 'Unknown')}\"",
                metadata={"workspace_id": workspace_id, "workspace_name": workspace.get('name', 'Unknown'), "category_id": category.id, "changed_by_id": current_user.id, "changed_by_name": current_user.name}
            )
    
    return category

@api_router.get("/workspaces/{workspace_id}/categories", response_model=List[Category])
async def get_categories(workspace_id: str, current_user: User = Depends(require_subscription_access)):
    # Check workspace access
    await check_workspace_access(workspace_id, current_user.id)
    
    categories = await db.categories.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(1000)
    return [Category(**c) for c in categories]

@api_router.put("/workspaces/{workspace_id}/categories/{category_id}", response_model=Category)
async def update_category(workspace_id: str, category_id: str, category_data: CategoryUpdate, current_user: User = Depends(require_subscription_access)):
    # Check workspace access (members can update, viewers cannot)
    member = await check_workspace_access(workspace_id, current_user.id)
    if member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot update categories")
    
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
    
    # Notify all members of category update
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
    members = await get_workspace_members(workspace_id)
    category_name = category.get("name", "Unknown")
    for m in members:
        if m.user_id != current_user.id:
            await create_notification(
                user_id=m.user_id,
                notification_type=NotificationType.WORKSPACE_CHANGE,
                title="Category Updated",
                message=f"{current_user.name} updated category \"{category_name}\" in \"{workspace.get('name', 'Unknown')}\"",
                metadata={"workspace_id": workspace_id, "category_id": category_id, "changed_by_id": current_user.id, "changed_by_name": current_user.name}
            )
    
    return Category(**category)

@api_router.delete("/workspaces/{workspace_id}/categories/{category_id}")
async def delete_category(workspace_id: str, category_id: str, current_user: User = Depends(get_current_user)):
    # Check workspace access (members can delete, viewers cannot)
    member = await check_workspace_access(workspace_id, current_user.id)
    if member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot delete categories")
    
    category = await db.categories.find_one({"id": category_id, "workspace_id": workspace_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category_name = category.get("name", "Unknown")
    
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
    
    # Notify all members of category deletion
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
    members = await get_workspace_members(workspace_id)
    for m in members:
        if m.user_id != current_user.id:
            await create_notification(
                user_id=m.user_id,
                notification_type=NotificationType.WORKSPACE_CHANGE,
                title="Category Deleted",
                message=f"{current_user.name} deleted category \"{category_name}\" in \"{workspace.get('name', 'Unknown')}\"",
                metadata={"workspace_id": workspace_id, "category_id": category_id, "changed_by_id": current_user.id, "changed_by_name": current_user.name}
            )
    
    return {"message": "Category deleted. Walkthroughs are now uncategorized."}

# Walkthrough Routes
@api_router.post("/workspaces/{workspace_id}/walkthroughs", response_model=Walkthrough)
async def create_walkthrough(workspace_id: str, walkthrough_data: WalkthroughCreate, current_user: User = Depends(require_subscription_access)):
    # Check workspace access (members can create, viewers cannot)
    member = await check_workspace_access(workspace_id, current_user.id)
    if member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot create walkthroughs")
    
    # Enforce walkthrough quota limits (plan and custom overrides)
    plan = await get_user_plan(current_user.id)
    if not plan:
        raise HTTPException(status_code=400, detail="User has no plan assigned")
    
    # Check for custom walkthrough limit override
    user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "custom_max_walkthroughs": 1})
    max_walkthroughs = plan.max_walkthroughs
    if user and user.get('custom_max_walkthroughs') is not None:
        max_walkthroughs = user['custom_max_walkthroughs']
    
    # Count existing walkthroughs in all user's workspaces (not just this one)
    # Walkthrough quota is per user, not per workspace
    workspace_ids = []
    owned_workspaces = await db.workspaces.find({"owner_id": current_user.id}, {"_id": 0, "id": 1}).to_list(100)
    workspace_ids.extend([w['id'] for w in owned_workspaces])
    
    # Also count walkthroughs in shared workspaces where user is ACCEPTED member
    shared_memberships = await db.workspace_members.find(
        {"user_id": current_user.id, "status": InvitationStatus.ACCEPTED},
        {"_id": 0, "workspace_id": 1}
    ).to_list(100)
    workspace_ids.extend([m['workspace_id'] for m in shared_memberships])
    
    total_walkthroughs = 0
    if workspace_ids:
        total_walkthroughs = await db.walkthroughs.count_documents(
            {"workspace_id": {"$in": workspace_ids}, "archived": {"$ne": True}}
        )
    
    # SECURITY INVARIANT: Walkthrough quota MUST be enforced
    # REGRESSION GUARD: This check MUST happen before creating walkthrough
    if max_walkthroughs is not None and total_walkthroughs >= max_walkthroughs:
        raise HTTPException(
            status_code=402,
            detail=f"Walkthrough limit reached. Current: {total_walkthroughs}, Limit: {max_walkthroughs} for your plan"
        )
    
    # Note: User-level quota check above replaces workspace-level check
    # Walkthrough quota is enforced per user across all workspaces
    
    # Store password safely (hash only) if password-protected
    password_hash = None
    if walkthrough_data.privacy == Privacy.PASSWORD:
        if not walkthrough_data.password:
            raise HTTPException(status_code=400, detail="Password is required for password-protected walkthroughs")
        password_hash = hash_password(walkthrough_data.password)

    # CRITICAL: Preserve icon_url even if None
    icon_url = walkthrough_data.icon_url if walkthrough_data.icon_url is not None else None
    
    # Handle slug: validate and ensure uniqueness
    slug = None
    if walkthrough_data.slug:
        slug = validate_walkthrough_slug(walkthrough_data.slug)
        slug = await ensure_unique_walkthrough_slug(workspace_id, slug)
    elif walkthrough_data.title:
        # Auto-generate slug from title if not provided
        auto_slug = create_slug(walkthrough_data.title)
        slug = await ensure_unique_walkthrough_slug(workspace_id, auto_slug)
    
    walkthrough = Walkthrough(
        workspace_id=workspace_id,
        title=walkthrough_data.title,
        slug=slug,
        description=walkthrough_data.description,
        icon_url=icon_url,  # Explicitly set, even if None
        category_ids=walkthrough_data.category_ids,
        privacy=walkthrough_data.privacy,
        password=None,
        status=walkthrough_data.status or WalkthroughStatus.DRAFT,
        navigation_type=walkthrough_data.navigation_type,
        navigation_placement=walkthrough_data.navigation_placement,
        enable_stuck_button=bool(walkthrough_data.enable_stuck_button) if walkthrough_data.enable_stuck_button is not None else False,
        created_by=current_user.id
    )
    
    walkthrough_dict = walkthrough.model_dump()
    walkthrough_dict["step_id_version"] = STEP_ID_SCHEMA_VERSION
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
    
    # Notify all members of walkthrough creation (only if published)
    if walkthrough.status == WalkthroughStatus.PUBLISHED:
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
        members = await get_workspace_members(workspace_id)
        for m in members:
            if m.user_id != current_user.id:
                await create_notification(
                    user_id=m.user_id,
                    notification_type=NotificationType.WORKSPACE_CHANGE,
                    title="Walkthrough Published",
                    message=f"{current_user.name} published a new walkthrough \"{walkthrough_data.title}\" in \"{workspace.get('name', 'Unknown')}\"",
                    metadata={"workspace_id": workspace_id, "walkthrough_id": walkthrough.id, "changed_by_id": current_user.id, "changed_by_name": current_user.name}
                )
    
    # Fetch from database to ensure all fields (including slug) are included
    created_walkthrough = await db.walkthroughs.find_one({"id": walkthrough.id}, {"_id": 0})
    if created_walkthrough:
        # Ensure icon_url exists
        if "icon_url" not in created_walkthrough:
            created_walkthrough["icon_url"] = None
        return Walkthrough(**created_walkthrough)
    
    return walkthrough

@api_router.get("/workspaces/{workspace_id}/walkthroughs", response_model=List[Walkthrough])
async def get_walkthroughs(workspace_id: str, current_user: User = Depends(require_subscription_access)):
    # Check workspace access
    await check_workspace_access(workspace_id, current_user.id)
    
    walkthroughs = await db.walkthroughs.find(
        {"workspace_id": workspace_id, "archived": {"$ne": True}},
        {"_id": 0}
    ).to_list(1000)
    
    # CRITICAL: Ensure all walkthroughs have proper data structure
    for idx, w in enumerate(walkthroughs):
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
        walkthroughs[idx] = await ensure_walkthrough_step_ids(w) or w
    
    return [Walkthrough(**w) for w in walkthroughs]

@api_router.get("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}", response_model=Walkthrough)
async def get_walkthrough(workspace_id: str, walkthrough_id: str, current_user: User = Depends(require_subscription_access)):
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
    walkthrough = await ensure_walkthrough_step_ids(walkthrough)
    
    return Walkthrough(**walkthrough)

@api_router.put("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}", response_model=Walkthrough)
async def update_walkthrough(workspace_id: str, walkthrough_id: str, walkthrough_data: WalkthroughCreate, current_user: User = Depends(require_subscription_access)):
    # Check workspace access (members can update, viewers cannot)
    member = await check_workspace_access(workspace_id, current_user.id)
    if member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot update walkthroughs")
    
    existing = await db.walkthroughs.find_one({"id": walkthrough_id, "workspace_id": workspace_id, "archived": {"$ne": True}}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    existing = await ensure_walkthrough_step_ids(existing)

    update_data = walkthrough_data.model_dump(exclude_none=True)
    
    # Handle slug update: validate and ensure uniqueness
    if "slug" in update_data:
        if update_data["slug"]:
            update_data["slug"] = validate_walkthrough_slug(update_data["slug"])
            update_data["slug"] = await ensure_unique_walkthrough_slug(workspace_id, update_data["slug"], exclude_walkthrough_id=walkthrough_id)
        else:
            # Empty slug means remove it (fall back to ID)
            update_data["slug"] = None
    
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

    # CRITICAL: Ensure status is always set - default to DRAFT unless explicitly PUBLISHED
    # This prevents save/autosave from accidentally keeping published status
    if "status" not in update_data:
        # If status not provided, set to DRAFT (save operation, not publish)
        update_data["status"] = WalkthroughStatus.DRAFT
    elif update_data.get("status") != WalkthroughStatus.PUBLISHED:
        # If status is provided but not PUBLISHED, ensure it's DRAFT
        update_data["status"] = WalkthroughStatus.DRAFT
    
    # Versioning: create a snapshot on every publish action.
    # Any update that sets status=published creates a new version entry.
    is_publish_request = update_data.get("status") == WalkthroughStatus.PUBLISHED
    if is_publish_request:
        next_version = int(existing.get("version", 1)) + 1
        # Get user display name for attribution
        user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0, "name": 1})
        changed_by_name = user_doc.get("name", "Unknown") if user_doc else "Unknown"
        
        version_doc = {
            "id": str(uuid.uuid4()),
            "workspace_id": workspace_id,
            "walkthrough_id": walkthrough_id,
            "version": next_version,
            "created_by": current_user.id,
            "changed_by_user_id": current_user.id,  # For attribution
            "changed_by_name": changed_by_name,  # User display name
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
            logging.info(f"Auto-cleaned up versions for walkthrough {walkthrough_id}: kept {len(versions_to_keep)}, deleted {len(all_versions) - len(versions_to_keep)}")

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
    
    # Notify all members of walkthrough update (only if published or just published)
    was_published = existing.get("status") == WalkthroughStatus.PUBLISHED
    is_now_published = walkthrough.get("status") == WalkthroughStatus.PUBLISHED
    if is_now_published:
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
        members = await get_workspace_members(workspace_id)
        walkthrough_title = walkthrough.get("title", "Unknown")
        for m in members:
            if m.user_id != current_user.id:
                if was_published:
                    message = f"{current_user.name} updated walkthrough \"{walkthrough_title}\" in \"{workspace.get('name', 'Unknown')}\""
                else:
                    message = f"{current_user.name} published walkthrough \"{walkthrough_title}\" in \"{workspace.get('name', 'Unknown')}\""
                await create_notification(
                    user_id=m.user_id,
                    notification_type=NotificationType.WORKSPACE_CHANGE,
                    title="Walkthrough Updated" if was_published else "Walkthrough Published",
                    message=message,
                    metadata={"workspace_id": workspace_id, "walkthrough_id": walkthrough_id, "changed_by_id": current_user.id, "changed_by_name": current_user.name}
                )
    
    return Walkthrough(**walkthrough)

@api_router.get("/workspaces/{workspace_id}/walkthroughs-archived", response_model=List[Walkthrough])
async def get_archived_walkthroughs(workspace_id: str, current_user: User = Depends(get_current_user)):
    # Check workspace access
    await check_workspace_access(workspace_id, current_user.id)
    
    walkthroughs = await db.walkthroughs.find(
        {"workspace_id": workspace_id, "archived": True},
        {"_id": 0}
    ).to_list(1000)
    for idx, w in enumerate(walkthroughs):
        walkthroughs[idx] = await ensure_walkthrough_step_ids(w) or w
    return [Walkthrough(**w) for w in walkthroughs]

@api_router.post("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/archive")
async def archive_walkthrough(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    # Check workspace access (members can archive, viewers cannot)
    member = await check_workspace_access(workspace_id, current_user.id)
    if member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot archive walkthroughs")
    
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
    deleted_files_count = await delete_files_by_urls(file_urls, workspace_id)
    
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

# ==========================================
# Knowledge Systems Routes
# ==========================================

@api_router.post("/workspaces/{workspace_id}/knowledge-systems", response_model=KnowledgeSystem)
async def create_knowledge_system(
    workspace_id: str,
    system_data: KnowledgeSystemCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new knowledge system (draft or published)"""
    # Check workspace access (members can create, viewers cannot)
    member = await check_workspace_access(workspace_id, current_user.id)
    if member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot create knowledge systems")
    
    knowledge_system = KnowledgeSystem(
        workspace_id=workspace_id,
        title=system_data.title,
        description=system_data.description,
        system_type=system_data.system_type,
        content=system_data.content,
        status=system_data.status or KnowledgeSystemStatus.DRAFT,
        created_by=current_user.id
    )
    
    await db.knowledge_systems.insert_one(knowledge_system.model_dump(by_alias=True))
    return knowledge_system

@api_router.get("/workspaces/{workspace_id}/knowledge-systems")
async def list_knowledge_systems(
    workspace_id: str,
    system_type: Optional[KnowledgeSystemType] = None,
    status: Optional[KnowledgeSystemStatus] = None,
    current_user: User = Depends(get_current_user)
):
    """List all knowledge systems for a workspace (auth required)"""
    await check_workspace_access(workspace_id, current_user.id)
    
    query = {"workspace_id": workspace_id}
    if system_type:
        query["system_type"] = system_type
    if status:
        query["status"] = status
    
    systems = await db.knowledge_systems.find(query, {"_id": 0}).to_list(1000)
    return systems

@api_router.get("/workspaces/{workspace_id}/knowledge-systems/{system_id}")
async def get_knowledge_system(
    workspace_id: str,
    system_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific knowledge system (auth required)"""
    await check_workspace_access(workspace_id, current_user.id)
    
    system = await db.knowledge_systems.find_one(
        {"id": system_id, "workspace_id": workspace_id},
        {"_id": 0}
    )
    if not system:
        raise HTTPException(status_code=404, detail="Knowledge system not found")
    
    return system

@api_router.put("/workspaces/{workspace_id}/knowledge-systems/{system_id}")
async def update_knowledge_system(
    workspace_id: str,
    system_id: str,
    update_data: KnowledgeSystemUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a knowledge system"""
    member = await check_workspace_access(workspace_id, current_user.id)
    if member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot edit knowledge systems")
    
    # Build update dict
    update_dict = {"updated_at": datetime.now(timezone.utc)}
    if update_data.title is not None:
        update_dict["title"] = update_data.title
    if update_data.description is not None:
        update_dict["description"] = update_data.description
    if update_data.content is not None:
        update_dict["content"] = update_data.content
    if update_data.status is not None:
        update_dict["status"] = update_data.status
    
    result = await db.knowledge_systems.update_one(
        {"id": system_id, "workspace_id": workspace_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Knowledge system not found")
    
    # Return updated system
    system = await db.knowledge_systems.find_one(
        {"id": system_id, "workspace_id": workspace_id},
        {"_id": 0}
    )
    return system

@api_router.delete("/workspaces/{workspace_id}/knowledge-systems/{system_id}")
async def delete_knowledge_system(
    workspace_id: str,
    system_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a knowledge system"""
    member = await check_workspace_access(workspace_id, current_user.id)
    if member.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot delete knowledge systems")
    
    result = await db.knowledge_systems.delete_one(
        {"id": system_id, "workspace_id": workspace_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Knowledge system not found")
    
    return {"message": "Knowledge system deleted"}

# ==========================================
# Public Portal Knowledge Systems Routes
# ==========================================

@api_router.get("/portal/{slug}/knowledge-systems")
async def get_portal_knowledge_systems(slug: str, system_type: Optional[KnowledgeSystemType] = None):
    """Get published knowledge systems for a portal (public, no auth)"""
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0, "id": 1, "owner_id": 1})
    if not workspace:
        raise HTTPException(status_code=404, detail="Portal not found")
    
    # SUBSCRIPTION ENFORCEMENT: Check workspace owner's subscription status
    owner_id = workspace.get('owner_id')
    if owner_id:
        has_access = await can_access_paid_features(owner_id)
        if not has_access:
            raise HTTPException(
                status_code=402,
                detail="This content is currently unavailable."
            )
    
    query = {
        "workspace_id": workspace["id"],
        "status": KnowledgeSystemStatus.PUBLISHED
    }
    if system_type:
        query["system_type"] = system_type
    
    print(f"[DEBUG] Portal query for slug={slug}, workspace_id={workspace['id']}, system_type={system_type}")
    print(f"[DEBUG] Query: {query}")
    
    systems_cursor = db.knowledge_systems.find(query, {"_id": 0})
    systems = await systems_cursor.to_list(1000)
    
    print(f"[DEBUG] Found {len(systems)} systems")
    if systems:
        print(f"[DEBUG] First system keys: {list(systems[0].keys())}")
        print(f"[DEBUG] First system status: {systems[0].get('status')}")
    
    # Convert MongoDB documents to dicts and serialize datetime objects
    result = []
    for system in systems:
        # Ensure it's a dict (not a MongoDB document)
        system_dict = dict(system) if not isinstance(system, dict) else system
        
        # Convert datetime objects to ISO strings for JSON serialization
        if 'created_at' in system_dict and isinstance(system_dict['created_at'], datetime):
            system_dict['created_at'] = system_dict['created_at'].isoformat()
        if 'updated_at' in system_dict and isinstance(system_dict['updated_at'], datetime):
            system_dict['updated_at'] = system_dict['updated_at'].isoformat()
        if 'timestamp' in system_dict and isinstance(system_dict['timestamp'], datetime):
            system_dict['timestamp'] = system_dict['timestamp'].isoformat()
        
        result.append(system_dict)
    
    print(f"[DEBUG] Returning {len(result)} serialized systems")
    return result

@api_router.get("/portal/{slug}/knowledge-systems/{system_id}")
async def get_portal_knowledge_system(slug: str, system_id: str):
    """Get a specific published knowledge system for portal (public, no auth)"""
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0, "id": 1, "owner_id": 1})
    if not workspace:
        raise HTTPException(status_code=404, detail="Portal not found")
    
    # SUBSCRIPTION ENFORCEMENT: Check workspace owner's subscription status
    owner_id = workspace.get('owner_id')
    if owner_id:
        has_access = await can_access_paid_features(owner_id)
        if not has_access:
            raise HTTPException(
                status_code=402,
                detail="This content is currently unavailable."
            )
    
    system = await db.knowledge_systems.find_one(
        {
            "id": system_id,
            "workspace_id": workspace["id"],
            "status": KnowledgeSystemStatus.PUBLISHED
        },
        {"_id": 0}
    )
    
    if not system:
        raise HTTPException(status_code=404, detail="Knowledge system not found or not published")
    
    return system

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
    existing_step_ids = {s.get("step_id") for s in steps if s.get("step_id")}
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
        order=insert_at,
        step_id=_generate_step_id(existing_step_ids)
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
    logging.info(f"[update_step] Step {step_id}: Existing blocks count: {len(existing_blocks)}")
    
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
    
    # SUBSCRIPTION ENFORCEMENT: Check workspace owner's subscription status
    owner_id = workspace.get('owner_id')
    if owner_id:
        has_access = await can_access_paid_features(owner_id)
        if not has_access:
            # Workspace owner has inactive subscription - block portal access
            raise HTTPException(
                status_code=402,
                detail="This content is currently unavailable."
            )
    
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
    for idx, w in enumerate(walkthroughs):
        if "steps" in w and isinstance(w["steps"], list):
            for step in w["steps"]:
                if "blocks" not in step or step["blocks"] is None:
                    step["blocks"] = []
                if not isinstance(step.get("blocks"), list):
                    step["blocks"] = []
        walkthroughs[idx] = await ensure_walkthrough_step_ids(w) or w
    
    return {
        "workspace": workspace,
        "categories": [Category(**c) for c in categories],
        "walkthroughs": [sanitize_public_walkthrough(w) for w in walkthroughs]
    }

@api_router.get("/portal/{slug}/walkthroughs/{walkthrough_id}")
async def get_public_walkthrough(slug: str, walkthrough_id: str):
    """
    Get public walkthrough by workspace slug and walkthrough ID or slug.
    Supports both UUID and custom slug for walkthrough_id parameter.
    """
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Portal not found")
    
    # SUBSCRIPTION ENFORCEMENT: Check workspace owner's subscription status
    owner_id = workspace.get('owner_id')
    if owner_id:
        has_access = await can_access_paid_features(owner_id)
        if not has_access:
            # Workspace owner has inactive subscription - block portal access
            raise HTTPException(
                status_code=402,
                detail="This content is currently unavailable."
            )
    
    # Try slug first, then UUID
    walkthrough = await db.walkthroughs.find_one(
        {"slug": walkthrough_id, "workspace_id": workspace['id'], "status": "published", "archived": {"$ne": True}},
        {"_id": 0}
    )
    if not walkthrough:
        # Fall back to UUID lookup
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
    
    # Include workspace contact info for "Get Support" button blocks
    walkthrough_with_workspace = sanitize_public_walkthrough(walkthrough)
    if os.environ.get("PORTAL_TEXT_DEBUG") == "1":
        raw_summary = _summarize_text_blocks(walkthrough)
        sanitized_summary = _summarize_text_blocks(walkthrough_with_workspace)
        logging.warning(
            "[portal][debug] Text/heading block summary | %s",
            json.dumps(
                {
                    "walkthrough_id": walkthrough_id,
                    "workspace_slug": slug,
                    "raw_summary": raw_summary,
                    "sanitized_summary": sanitized_summary,
                    "raw_walkthrough": walkthrough,
                    "sanitized_walkthrough": walkthrough_with_workspace
                },
                default=str
            )
        )
    walkthrough_with_workspace["workspace"] = {
        "contact_whatsapp": workspace.get("contact_whatsapp"),
        "contact_phone": workspace.get("contact_phone"),
        "contact_hours": workspace.get("contact_hours"),
        "portal_whatsapp": workspace.get("portal_whatsapp")
    }

    return walkthrough_with_workspace

class WalkthroughPasswordAccess(BaseModel):
    password: str

@api_router.post("/portal/{slug}/walkthroughs/{walkthrough_id}/access")
async def access_password_walkthrough(slug: str, walkthrough_id: str, body: WalkthroughPasswordAccess):
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Portal not found")

    # SUBSCRIPTION ENFORCEMENT: Check workspace owner's subscription status
    owner_id = workspace.get('owner_id')
    if owner_id:
        has_access = await can_access_paid_features(owner_id)
        if not has_access:
            # Workspace owner has inactive subscription - block portal access
            raise HTTPException(
                status_code=402,
                detail="This content is currently unavailable."
            )

    # Try slug first, then UUID
    walkthrough = await db.walkthroughs.find_one(
        {"slug": walkthrough_id, "workspace_id": workspace["id"], "status": "published", "archived": {"$ne": True}},
        {"_id": 0}
    )
    if not walkthrough:
        # Fall back to UUID lookup
        walkthrough = await db.walkthroughs.find_one(
            {"id": walkthrough_id, "workspace_id": workspace["id"], "status": "published", "archived": {"$ne": True}},
            {"_id": 0}
        )
    if not walkthrough or walkthrough.get("privacy") != "password":
        raise HTTPException(status_code=404, detail="Walkthrough not found")

    password_hash = walkthrough.get("password_hash")
    if not password_hash or not verify_password(body.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    walkthrough = await ensure_walkthrough_step_ids(walkthrough)
    
    # Include workspace contact info for "Get Support" button blocks
    walkthrough_with_workspace = sanitize_public_walkthrough(walkthrough)
    if os.environ.get("PORTAL_TEXT_DEBUG") == "1":
        raw_summary = _summarize_text_blocks(walkthrough)
        sanitized_summary = _summarize_text_blocks(walkthrough_with_workspace)
        logging.warning(
            "[portal][debug] Text/heading block summary (password) | %s",
            json.dumps(
                {
                    "walkthrough_id": walkthrough_id,
                    "workspace_slug": slug,
                    "raw_summary": raw_summary,
                    "sanitized_summary": sanitized_summary,
                    "raw_walkthrough": walkthrough,
                    "sanitized_walkthrough": walkthrough_with_workspace
                },
                default=str
            )
        )
    walkthrough_with_workspace["workspace"] = {
        "contact_whatsapp": workspace.get("contact_whatsapp"),
        "contact_phone": workspace.get("contact_phone"),
        "contact_hours": workspace.get("contact_hours"),
        "portal_whatsapp": workspace.get("portal_whatsapp")
    }

    return walkthrough_with_workspace

# Analytics Routes
@api_router.post("/analytics/event")
async def track_event(event: AnalyticsEvent):
    event_dict = event.model_dump()
    try:
        walkthrough = await db.walkthroughs.find_one(
            {"id": event.walkthrough_id},
            {"_id": 0, "workspace_id": 1}
        )
        if walkthrough:
            event_dict["workspace_id"] = walkthrough.get("workspace_id")
    except Exception:
        pass
    event_dict['timestamp'] = event_dict['timestamp'].isoformat()
    await db.analytics_events.insert_one(event_dict)
    return {"message": "Event tracked"}

@api_router.get("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/analytics")
async def get_analytics(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    walkthrough = await db.walkthroughs.find_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"_id": 0}
    )
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    
    events = await db.analytics_events.find(
        {"walkthrough_id": walkthrough_id, "workspace_id": workspace_id},
        {"_id": 0}
    ).to_list(10000)
    
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

@api_router.delete("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/analytics")
async def reset_analytics(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    """
    Reset all analytics data for a specific walkthrough.
    Deletes all analytics events for the walkthrough.
    """
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    # Verify walkthrough exists and belongs to workspace
    walkthrough = await db.walkthroughs.find_one({"id": walkthrough_id, "workspace_id": workspace_id}, {"_id": 0})
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")

    # Delete all analytics events for this walkthrough
    result = await db.analytics_events.delete_many(
        {"walkthrough_id": walkthrough_id, "workspace_id": workspace_id}
    )

    logging.info(f"Reset analytics for walkthrough {walkthrough_id}: deleted {result.deleted_count} events")

    return {
        "success": True,
        "message": f"Analytics reset successfully. Deleted {result.deleted_count} events.",
        "deleted_count": result.deleted_count
    }

# Feedback Routes
@api_router.post("/feedback")
async def submit_feedback(feedback: Feedback):
    feedback_dict = feedback.model_dump()
    try:
        walkthrough = await db.walkthroughs.find_one(
            {"id": feedback.walkthrough_id},
            {"_id": 0, "workspace_id": 1}
        )
        if walkthrough:
            feedback_dict["workspace_id"] = walkthrough.get("workspace_id")
    except Exception:
        pass
    feedback_dict['timestamp'] = datetime.now(timezone.utc).isoformat()
    await db.feedback.insert_one(feedback_dict)
    return {"message": "Feedback submitted"}

@api_router.get("/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}/feedback")
async def get_feedback(workspace_id: str, walkthrough_id: str, current_user: User = Depends(get_current_user)):
    member = await get_workspace_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    walkthrough = await db.walkthroughs.find_one(
        {"id": walkthrough_id, "workspace_id": workspace_id},
        {"_id": 0}
    )
    if not walkthrough:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    
    feedback_list = await db.feedback.find(
        {"walkthrough_id": walkthrough_id, "workspace_id": workspace_id},
        {"_id": 0}
    ).to_list(1000)
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
    file_id = None
    try:
        # Defensive check: filename can be None
        filename = file.filename or "uploaded_file"
        logging.info(f"[upload_file] Upload request received: user={current_user.id}, workspace_id={workspace_id}, reference_type={reference_type}, reference_id={reference_id}, filename={filename}")
        
        # Generate idempotency key if not provided
        if not idempotency_key:
            idempotency_key = str(uuid.uuid4())
        
        # CRITICAL: workspace_id is REQUIRED - do not fallback to owner's workspace
        # This ensures shared workspace members can upload files
        if not workspace_id:
            raise HTTPException(status_code=400, detail="workspace_id is required. Please specify workspace_id in the upload request.")
        
        # Verify user has access to workspace (handles both owners and members)
        # This check ensures collaborators can upload files
        try:
            await check_workspace_access(workspace_id, current_user.id)
        except HTTPException:
            raise
        except Exception as access_error:
            logging.error(f"[upload_file] Failed to check workspace access: {access_error}", exc_info=True)
            raise HTTPException(status_code=403, detail="Access denied to workspace")
        
        # Get workspace by workspace_id (not by owner_id)
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "owner_id": 1})
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        # For idempotency check, use workspace owner's user_id for shared users
        # This ensures idempotency works correctly for all collaborators
        idempotency_user_id = workspace['owner_id'] if workspace['owner_id'] != current_user.id else current_user.id
        
        # Check for existing file with same idempotency key (idempotency check)
        existing_file = await db.files.find_one(
            {"idempotency_key": idempotency_key, "user_id": idempotency_user_id},
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
        
        # Defensive check: file must have content
        if file_size == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
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
        
        # For shared users, count storage against workspace owner's quota
        # For owners, use their own quota
        quota_user_id = workspace['owner_id'] if workspace['owner_id'] != current_user.id else current_user.id
        
        # Check quota: current storage + file size <= allowed storage
        storage_used = await get_user_storage_usage(quota_user_id)
        storage_allowed = await get_user_allowed_storage(quota_user_id)
        
        if storage_used + file_size > storage_allowed:
            raise HTTPException(
                status_code=402,
                detail=f"Storage quota exceeded. Used: {storage_used} bytes, Allowed: {storage_allowed} bytes, File size: {file_size} bytes"
            )
        
        # Determine resource type based on file extension
        file_extension = Path(filename).suffix.lower()
        resource_type = "auto"
        if file_extension == '.gif':
            resource_type = "image"  # Upload GIFs as images (not video - conversion caused issues)
            logging.info(f"[upload_file] GIF detected, using resource_type=image for file {filename}")
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
        
        # Build folder path: guide2026/workspace_owner_id/workspace_id/category_id/walkthrough_id
        # Use workspace owner's ID for folder structure (consistent for all collaborators)
        folder_user_id = workspace['owner_id']
        folder_parts = ["guide2026", folder_user_id, workspace_id]
        if category_id:
            folder_parts.append(category_id)
        if walkthrough_id:
            folder_parts.append(walkthrough_id)
        
        cloudinary_folder = "/".join(folder_parts)
        logging.info(f"[upload_file] Cloudinary folder: {cloudinary_folder} (user={current_user.id}, workspace={workspace_id}, category={category_id}, walkthrough_id={walkthrough_id})")
        
        # Phase 1: Create file record with status=pending (reserves quota)
        # For shared users, file records are associated with workspace owner for quota tracking
        file_owner_id = workspace['owner_id']
        
        file_id = str(uuid.uuid4())
        file_record = File(
            id=file_id,
            user_id=file_owner_id,  # Use workspace owner's ID for quota tracking
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
        # Defensive serialization: Handle missing timestamps for backward compatibility
        if file_dict.get('created_at'):
            file_dict['created_at'] = file_dict['created_at'].isoformat()
        else:
            file_dict['created_at'] = datetime.now(timezone.utc).isoformat()
        if file_dict.get('updated_at'):
            file_dict['updated_at'] = file_dict['updated_at'].isoformat()
        else:
            file_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        # Insert file record (this reserves the quota)
        await db.files.insert_one(file_dict)
        
        # Phase 2: Upload to Cloudinary (MANDATORY - no local storage fallback)
        try:
            upload_params = {
                "public_id": file_id,
                "resource_type": resource_type,
                "folder": cloudinary_folder,  # Organized: guide2026/workspace_owner_id/workspace_id/category_id/walkthrough_id
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
            logging.error(f"[upload_file] Cloudinary upload failed for file {file_id}: {str(e)}", exc_info=True)
            if file_id:
                try:
                    await db.files.update_one(
                        {"id": file_id},
                        {"$set": {
                            "status": FileStatus.FAILED,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                except Exception as update_error:
                    logging.error(f"[upload_file] Failed to update file record status to FAILED: {update_error}", exc_info=True)
            
            # Re-raise HTTPExceptions as-is (they already have proper status codes)
            if isinstance(e, HTTPException):
                raise
            # For other exceptions, wrap in 500 error with detailed logging
            logging.error(f"[upload_file] Unexpected error during Cloudinary upload: {type(e).__name__}: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"File upload failed: {str(e)}. Please try again or contact support."
            )
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        # Catch any other unhandled exceptions in the upload process
        logging.error(f"[upload_file] Unexpected error in upload endpoint: {type(e).__name__}: {str(e)}", exc_info=True)
        
        # Try to clean up file record if it was created
        if file_id:
            try:
                await db.files.update_one(
                    {"id": file_id},
                    {"$set": {
                        "status": FileStatus.FAILED,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
            except Exception as cleanup_error:
                logging.error(f"[upload_file] Failed to cleanup file record: {cleanup_error}", exc_info=True)
        
        raise HTTPException(
            status_code=500,
            detail=f"File upload failed: {str(e)}. Please try again or contact support."
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
    """
    CANONICAL SUBSCRIPTION STATE API - NO EARLY RETURNS
    
    Returns ONLY the current subscription state derived from PayPal.
    Guarantees: All code paths reach final return with complete canonical object.
    
    Returns:
    {
        "plan": "pro" | "free" (string, never undefined),
        "provider": "PAYPAL" | null,
        "access_granted": true | false (boolean, never undefined),
        "access_until": ISO timestamp | null,
        "is_recurring": true | false,
        "management_url": string | null,
        "quota": {...}
    }
    """
    # ========== PHASE 1: RECONCILIATION (ALWAYS RUNS) ==========
    logging.info(f"[GET_PLAN] START for user {current_user.email}")
    
    # Initialize canonical state (defaults = Free plan, no access)
    plan_name = "free"  # STRING, never undefined
    access_granted = False  # BOOLEAN, never undefined
    access_until = None
    is_recurring = False
    management_url = None
    provider = None
    
    # Find PayPal subscription
    subscription_doc = await db.subscriptions.find_one(
        {"user_id": current_user.id, "provider": "paypal"},
        {"_id": 0}
    )
    
    # If subscription exists, derive access from stored PayPal fields (read-only)
    if subscription_doc:
        logging.critical(
            f"📖 [GET_PLAN] DB STATE (READ-ONLY) for user {current_user.id}:\n"
            f"  subscription_id={subscription_doc.get('id')}\n"
            f"  status={subscription_doc.get('status')}\n"
            f"  paypal_verified_status={subscription_doc.get('paypal_verified_status')}\n"
            f"  last_payment_time={subscription_doc.get('last_payment_time')}\n"
            f"  next_billing_time={subscription_doc.get('next_billing_time')}\n"
            f"  final_payment_time={subscription_doc.get('final_payment_time')}"
        )

        paypal_status = (subscription_doc.get("paypal_verified_status") or "").upper()
        next_billing_time = subscription_doc.get("next_billing_time")
        final_payment_time = subscription_doc.get("final_payment_time")
        last_payment_time = subscription_doc.get("last_payment_time")

        next_billing_dt = None
        final_payment_dt = None
        if next_billing_time:
            try:
                next_billing_dt = datetime.fromisoformat(next_billing_time.replace('Z', '+00:00'))
            except Exception as e:
                logging.error(f"[GET_PLAN] Invalid next_billing_time format: {next_billing_time}, error: {e}")
        if final_payment_time:
            try:
                final_payment_dt = datetime.fromisoformat(final_payment_time.replace('Z', '+00:00'))
            except Exception as e:
                logging.error(f"[GET_PLAN] Invalid final_payment_time format: {final_payment_time}, error: {e}")

        access_granted = (
            (next_billing_dt is not None and next_billing_dt > datetime.now(timezone.utc)) or
            (final_payment_dt is not None and final_payment_dt > datetime.now(timezone.utc))
        )

        if not access_granted and not next_billing_dt and not final_payment_dt and last_payment_time:
            access_granted = True
            logging.info("[GET_PLAN] Access granted via last_payment_time fallback (read-only)")

        if access_granted:
            plan_name = "pro"
            if next_billing_time:
                access_until = next_billing_time
            elif final_payment_time:
                access_until = final_payment_time
            is_recurring = (paypal_status == "ACTIVE" and not final_payment_time)

        provider = "PAYPAL"
        provider_subscription_id = subscription_doc.get('provider_subscription_id')
        if provider_subscription_id:
            management_url = f"https://www.paypal.com/myaccount/autopay/connect/{provider_subscription_id}"

        logging.info(
            f"[GET_PLAN] Read-only PayPal state: "
            f"access_granted={access_granted}, "
            f"plan={plan_name}, "
            f"access_until={access_until}"
        )
    else:
        logging.info(f"[GET_PLAN] No PayPal subscription found for {current_user.email}")

    # Fallback: Manual subscriptions should override when PayPal access is not granted
    if plan_name == "free" and not access_granted:
        manual_subscription = await db.subscriptions.find_one(
            {
                "user_id": current_user.id,
                "provider": {"$ne": "paypal"},
                "status": SubscriptionStatus.ACTIVE.value
            },
            {"_id": 0}
        )
        if manual_subscription:
            manual_plan = await db.plans.find_one(
                {"id": manual_subscription.get("plan_id")},
                {"_id": 0, "name": 1}
            )
            if manual_plan and manual_plan.get("name"):
                plan_name = manual_plan["name"]
                access_granted = True
                access_until = manual_subscription.get("effective_end_date") or manual_subscription.get("grace_ends_at")
                is_recurring = False
                provider = None
                logging.info(
                    f"[GET_PLAN] Manual subscription override: plan={plan_name}, access_granted={access_granted}"
                )

    # Fallback: Stored plan_id applies when PayPal access is not granted
    if plan_name == "free" and not access_granted:
        user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0, "plan_id": 1})
        stored_plan_id = user_doc.get("plan_id") if user_doc else None
        if stored_plan_id:
            stored_plan = await db.plans.find_one({"id": stored_plan_id}, {"_id": 0, "name": 1})
            if stored_plan and stored_plan.get("name") and stored_plan.get("name") != "free":
                plan_name = stored_plan["name"]
                access_granted = True
                is_recurring = False
                provider = None
                logging.info(
                    f"[GET_PLAN] Stored plan_id fallback: plan={plan_name}, access_granted={access_granted}"
                )
    
    # ========== PHASE 2: QUOTA INFO (ALWAYS RUNS) ==========
    
    # Get plan document for quota limits
    plan_doc = await db.plans.find_one(
        {"name": plan_name},  # "pro" or "free"
        {"_id": 0}
    )
    
    # Fallback to free plan if plan_doc missing (should never happen)
    if not plan_doc:
        logging.error(f"[GET_PLAN] Plan document not found for plan={plan_name}, falling back to free")
        plan_doc = await db.plans.find_one({"name": "free"}, {"_id": 0})
        if not plan_doc:
            # Last resort: hardcoded free plan limits
            logging.error(f"[GET_PLAN] No plan documents in database! Using hardcoded free plan")
            plan_doc = {
                "max_file_size_bytes": 10485760,  # 10 MB
                "max_workspaces": 1,
                "max_walkthroughs": 5,
                "max_categories": 10,
                "storage_bytes": 524288000  # 500 MB
            }
    
    # Calculate quota usage
    storage_used = await get_user_storage_usage(current_user.id)
    storage_allowed = await get_user_allowed_storage(current_user.id)
    workspace_count = await get_workspace_count(current_user.id)
    
    # Get workspace IDs for user
    workspaces = await db.workspaces.find(
        {"owner_id": current_user.id},
        {"_id": 0, "id": 1}
    ).to_list(100)
    workspace_ids = [w["id"] for w in workspaces]
    
    # Count walkthroughs
    total_walkthroughs = await db.walkthroughs.count_documents({
        "workspace_id": {"$in": workspace_ids},
        "archived": {"$ne": True}
    })
    
    # Count top-level categories
    total_categories = await db.categories.count_documents({
        "workspace_id": {"$in": workspace_ids},
        "$or": [
            {"parent_id": None},
            {"parent_id": ""},
            {"parent_id": {"$exists": False}}
        ]
    })
    
    # ========== PHASE 3: ASSEMBLE CANONICAL RESPONSE (SINGLE RETURN) ==========
    
    canonical_response = {
        "plan": plan_name,  # STRING: "pro" | "free"
        "provider": provider,  # "PAYPAL" | null
        "access_granted": access_granted,  # BOOLEAN: true | false
        "access_until": access_until,  # ISO timestamp | null
        "is_recurring": is_recurring,  # BOOLEAN: true | false
        "management_url": management_url,  # string | null
        "quota": {
            "storage_used_bytes": storage_used,
            "storage_allowed_bytes": storage_allowed,
            "max_file_size_bytes": plan_doc.get('max_file_size_bytes', 10485760),
            "storage_used_percent": round(
                (storage_used / storage_allowed * 100) if storage_allowed > 0 else 0,
                2
            ),
            "workspace_count": workspace_count,
            "workspace_limit": plan_doc.get('max_workspaces', 1),
            "walkthroughs_used": total_walkthroughs,
            "walkthroughs_limit": plan_doc.get('max_walkthroughs', 5),
            "categories_used": total_categories,
            "categories_limit": plan_doc.get('max_categories', 10),
            "over_quota": storage_used > storage_allowed
        }
    }
    
    # Final validation log
    logging.info(
        f"[GET_PLAN] FINAL RESPONSE for {current_user.email}: "
        f"plan={canonical_response['plan']} (type={type(canonical_response['plan']).__name__}), "
        f"access_granted={canonical_response['access_granted']} (type={type(canonical_response['access_granted']).__name__}), "
        f"access_until={canonical_response['access_until']}"
    )
    
    # SINGLE RETURN - Guaranteed canonical structure
    return canonical_response

# UI CLEANUP: Canonical state API complete

# Trial & Subscription Models
# NOTE: start-trial endpoint removed - trials now only start after PayPal subscription activation

# PayPal Subscription Models
class PayPalSubscribeRequest(BaseModel):
    subscriptionID: str

@api_router.post("/billing/paypal/cancel")
async def cancel_paypal_subscription(current_user: User = Depends(get_current_user)):
    """
    UI CLEANUP Fix 13: Redirect to PayPal management
    
    The site does NOT perform cancellations directly.
    Returns PayPal management URL for user to manage subscription.
    """
    subscription_doc = await db.subscriptions.find_one(
        {"user_id": current_user.id, "provider": "paypal"},
        {"_id": 0}
    )
    
    if subscription_doc:
        provider_subscription_id = subscription_doc.get('provider_subscription_id')
        if provider_subscription_id:
            management_url = f"https://www.paypal.com/myaccount/autopay/connect/{provider_subscription_id}"
            return {
                "success": True,
                "message": "Please manage your subscription via PayPal",
                "management_url": management_url
            }
    
    return {
        "success": False,
        "message": "No PayPal subscription found"
    }

# DEPRECATED OLD CANCEL LOGIC - Delete after confirming new flow works
"""
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
"""
# END DEPRECATED

@api_router.post("/billing/paypal/subscribe")  # NOTE: This route name conflicts with subscribe endpoint - should be /billing/paypal/cancel
async def cancel_paypal_subscription(current_user: User = Depends(get_current_user)):
    """
    Cancel user's PayPal subscription.
    
    STRICT RULES (PayPal is single source of truth):
    - NEVER compute or infer dates (no effective_end_date, no started_at + 30 days)
    - After PayPal confirms cancellation, IMMEDIATELY reconcile to fetch PayPal timestamps
    - Store ONLY PayPal fields: next_billing_time, final_payment_time, last_payment_time
    - Access determined ONLY by PayPal timestamps
    - Downgrades happen ONLY via EXPIRED webhook, never here
    
    Access logic (enforced by reconciliation):
        access_granted = (
            (next_billing_time is not None and now < next_billing_time) or
            (final_payment_time is not None and now < final_payment_time)
        )
    """
    subscription = await get_user_subscription(current_user.id)
    
    # No subscription
    if not subscription:
        return JSONResponse({
            "success": True,
            "message": "No subscription found.",
            "status": "no_subscription"
        })
    
    # Not PayPal
    if subscription.provider != "paypal":
        return JSONResponse({
            "success": True,
            "message": "Not a PayPal subscription.",
            "status": "not_paypal"
        })
    
    # PENDING: Mark for cancellation, NO dates
    if subscription.status == SubscriptionStatus.PENDING:
        if subscription.cancel_at_period_end:
            return JSONResponse({
                "success": True,
                "message": "Cancellation already scheduled.",
                "status": "already_cancelled"
            })
        
        await db.subscriptions.update_one(
            {"id": subscription.id},
            {"$set": {
                "cancel_at_period_end": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return JSONResponse({
            "success": True,
            "message": "Cancellation scheduled.",
            "status": "pending_cancellation"
        })
    
    # CANCELLED: Idempotent
    if subscription.status == SubscriptionStatus.CANCELLED:
        return JSONResponse({
            "success": True,
            "message": "Already cancelled.",
            "status": "already_cancelled"
        })
    
    # ACTIVE: Call PayPal cancel, then reconcile
    if subscription.status != SubscriptionStatus.ACTIVE:
        return JSONResponse({
            "success": True,
            "message": "Subscription not active.",
            "status": "not_active"
        })
    
    paypal_subscription_id = subscription.provider_subscription_id
    if not paypal_subscription_id:
        raise HTTPException(status_code=400, detail="PayPal subscription ID not found")
    
    # Call PayPal cancel API
    try:
        access_token = await get_paypal_access_token()
        if not access_token:
            return JSONResponse({
                "success": False,
                "message": "Failed to authenticate with PayPal.",
                "status": "auth_failed"
            })
        
        # Cancel via PayPal API
        async with aiohttp.ClientSession() as session:
            cancel_url = f"{PAYPAL_API_BASE}/v1/billing/subscriptions/{paypal_subscription_id}/cancel"
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            payload = {"reason": "User requested cancellation"}
            
            async with session.post(cancel_url, json=payload, headers=headers) as response:
                if response.status != 204:
                    logging.error(f"PayPal cancel API failed: {response.status}")
                    return JSONResponse({
                        "success": False,
                        "message": "PayPal cancellation failed. Please manage via PayPal directly.",
                        "status": "cancel_failed"
                    })
                
                logging.info(f"PayPal cancel API succeeded: user={current_user.id}, subscription={subscription.id}")
        
        # CRITICAL: Immediately reconcile to fetch PayPal timestamps
        # PayPal provides next_billing_time (until paid period ends) for Auto Pay = OFF
        logging.critical(f"🔄 [CANCEL] Triggering forced reconciliation for subscription {subscription.id}")
        reconcile_result = await reconcile_subscription_with_paypal(subscription.id, force=True)
        
        # FORENSIC LOG: Reconciliation result
        logging.critical(
            f"🔄 [CANCEL] Reconciliation result:\n"
            f"  success={reconcile_result.get('success')}\n"
            f"  access_granted={reconcile_result.get('access_granted')}\n"
            f"  billing_info={reconcile_result.get('billing_info')}\n"
            f"  full_result={reconcile_result}"
        )
        
        if not reconcile_result.get("success"):
            logging.error(f"Reconciliation failed after cancel: {reconcile_result.get('error')}")
            return JSONResponse({
                "success": False,
                "message": "Cancelled with PayPal but unable to verify. Check PayPal directly.",
                "status": "reconcile_failed"
            })
        
        # Extract PayPal timestamps ONLY
        billing_info = reconcile_result.get("billing_info", {})
        next_billing_time = billing_info.get("next_billing_time")  # PayPal-provided
        final_payment_time = billing_info.get("final_payment_time")  # PayPal-provided
        access_granted = reconcile_result.get("access_granted", False)
        
        # FORENSIC LOG: Final response data
        logging.critical(
            f"✅ [CANCEL] Returning to user:\n"
            f"  access_granted={access_granted}\n"
            f"  next_billing_time={next_billing_time}\n"
            f"  final_payment_time={final_payment_time}"
        )
        
        # Format message with PayPal date (if provided)
        access_until_message = "PayPal determines when access ends"
        if next_billing_time:
            try:
                dt = datetime.fromisoformat(next_billing_time.replace('Z', '+00:00'))
                access_until_message = f"Access until {dt.strftime('%B %d, %Y')}"
            except Exception:
                access_until_message = f"Access until {next_billing_time}"
        elif final_payment_time:
            try:
                dt = datetime.fromisoformat(final_payment_time.replace('Z', '+00:00'))
                access_until_message = f"Access until {dt.strftime('%B %d, %Y')}"
            except Exception:
                access_until_message = f"Access until {final_payment_time}"
        
        return JSONResponse({
            "success": True,
            "message": f"Subscription cancelled successfully. {access_until_message}",
            "status": "cancelled",
            "access_granted": access_granted,
            "next_billing_time": next_billing_time,  # PayPal field ONLY
            "final_payment_time": final_payment_time  # PayPal field ONLY
        })
    
    except Exception as e:
        logging.error(f"Cancellation error: {str(e)}", exc_info=True)
        return JSONResponse({
            "success": False,
            "message": "An error occurred. Please manage your subscription via PayPal.",
            "status": "error"
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

# PRODUCTION HARDENING: Rate limiting for reconciliation endpoint
_reconciliation_cache = {}  # {user_id: {"last_call": datetime, "count": int, "result": dict}}
RECONCILIATION_RATE_LIMIT = 5  # Max calls per window
RECONCILIATION_WINDOW_SECONDS = 60  # Time window
RECONCILIATION_CACHE_TTL = 10  # Cache results for 10 seconds

# Auth rate limiting (in-memory)
_auth_rate_limit = {}  # {key: {"count": int, "window_start": float}}
AUTH_RATE_LIMIT = 10  # Max requests per window
AUTH_RATE_WINDOW_SECONDS = 60

def enforce_auth_rate_limit(key: str) -> None:
    now = time.time()
    entry = _auth_rate_limit.get(key)
    if not entry or (now - entry["window_start"]) > AUTH_RATE_WINDOW_SECONDS:
        _auth_rate_limit[key] = {"count": 1, "window_start": now}
        return
    entry["count"] += 1
    if entry["count"] > AUTH_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

@api_router.post("/billing/reconcile")
async def reconcile_my_subscription(current_user: User = Depends(get_current_user)):
    """
    PRODUCTION HARDENING: User-triggered PayPal reconciliation
    
    Security:
    - Only reconciles authenticated user's stored PayPal subscription ID
    - Rejects client-provided subscription IDs
    - Rate-limited: 5 calls per 60 seconds
    - Results cached for 10 seconds
    
    Returns:
        Complete subscription state from PayPal including access decision
    """
    # KILL SWITCH: Check if user reconciliation is enabled
    if not kill_switch.user_reconciliation_enabled:
        logging.warning(f"[RECONCILE] User reconciliation disabled by kill switch (user={current_user.id})")
        return {
            "success": False,
            "error": "Reconciliation temporarily unavailable. Please try again later.",
            "kill_switch_active": True
        }
    
    user_id = current_user.id
    now = datetime.now(timezone.utc)
    
    # METRICS: Track user-triggered reconciliation
    await metrics.increment('reconcile_user_triggered')
    
    # Rate limiting check
    if user_id in _reconciliation_cache:
        cache_entry = _reconciliation_cache[user_id]
        last_call = cache_entry.get("last_call")
        call_count = cache_entry.get("count", 0)
        
        # Check if within rate limit window
        if last_call and (now - last_call).total_seconds() < RECONCILIATION_WINDOW_SECONDS:
            if call_count >= RECONCILIATION_RATE_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {RECONCILIATION_RATE_LIMIT} reconciliation requests per {RECONCILIATION_WINDOW_SECONDS} seconds."
                )
            # Within window, increment count
            cache_entry["count"] = call_count + 1
        else:
            # Window expired, reset
            cache_entry["last_call"] = now
            cache_entry["count"] = 1
    else:
        # First call
        _reconciliation_cache[user_id] = {
            "last_call": now,
            "count": 1
        }
    
    # Check cache for recent result (10 second TTL)
    if user_id in _reconciliation_cache:
        cached_result = _reconciliation_cache[user_id].get("result")
        cached_at = _reconciliation_cache[user_id].get("cached_at")
        if cached_result and cached_at:
            age = (now - cached_at).total_seconds()
            if age < RECONCILIATION_CACHE_TTL:
                logging.info(f"[RECONCILE] Returning cached result for user {user_id} (age: {age}s)")
                return cached_result
    
    # Find user's PayPal subscription
    subscription_doc = await db.subscriptions.find_one(
        {"user_id": user_id, "provider": "paypal"},
        {"_id": 0}
    )
    
    if not subscription_doc:
        return {
            "success": False,
            "error": "No PayPal subscription found for user",
            "user_id": user_id
        }
    
    subscription_id = subscription_doc['id']
    
    # SECURITY: Reconcile only the authenticated user's stored subscription ID
    # Never accept subscription ID from client
    try:
        result = await reconcile_subscription_with_paypal(subscription_id, force=False)
        
        # Cache result
        if user_id in _reconciliation_cache:
            _reconciliation_cache[user_id]["result"] = result
            _reconciliation_cache[user_id]["cached_at"] = now
        
        return result
    except Exception as e:
        # CRITICAL: Catch all exceptions to prevent 500 errors
        logging.error(
            f"[RECONCILE] Unhandled exception for user {user_id}, subscription {subscription_id}: {str(e)}",
            exc_info=True
        )
        
        # Return error response instead of crashing
        return {
            "success": False,
            "error": "Failed to reconcile subscription with PayPal. Please try again later.",
            "details": str(e) if os.getenv("DEBUG") else None,
            "subscription_id": subscription_id
        }

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

# PRODUCTION HARDENING: Terminal vs Non-terminal statuses for POLLING
# Terminal-for-polling: Polling MUST stop when PayPal reports these
TERMINAL_FOR_POLLING = frozenset(['ACTIVE', 'CANCELLED', 'EXPIRED', 'SUSPENDED'])
# Non-terminal-for-polling: Polling continues for these
NON_TERMINAL_FOR_POLLING = frozenset(['APPROVAL_PENDING', 'PENDING'])

# IMPORTANT: Terminal-for-polling ╬ô├½├í Terminal-for-access
# ACTIVE is terminal for polling but may grant access
# CANCELLED is terminal for polling but may preserve access until final_payment_time

async def reconcile_subscription_with_paypal(
    subscription_id: str,
    force: bool = False
) -> Dict[str, Any]:
    """
    PRODUCTION-GRADE PayPal Reconciliation - Single Source of Truth
    
    This function is the ONLY authoritative source for subscription state.
    All other code paths (webhooks, polling, manual checks) MUST delegate here.
    
    Rules (NON-NEGOTIABLE):
    1. Fetch subscription directly from PayPal API
    2. Map PayPal status ╬ô├Ñ├å internal status (deterministic, no inference)
    3. Persist immediately to database
    4. Derive access from billing timestamps, NOT status strings
    5. Handle ALL PayPal statuses explicitly
    6. Stop reconciliation at terminal states (unless force=True)
    7. Return complete state including access decision
    
    Returns:
        {
            "success": bool,
            "subscription_id": str,
            "paypal_status": str,
            "internal_status": str,
            "access_granted": bool,
            "access_reason": str,
            "is_terminal": bool,
            "billing_info": {...},
            "reconciled_at": str
        }
    """
    now = datetime.now(timezone.utc)
    
    # METRICS: Track reconciliation attempt
    await metrics.increment('reconcile_total')
    
    # Fetch subscription from database
    subscription_doc = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not subscription_doc:
        return {
            "success": False,
            "error": "Subscription not found",
            "subscription_id": subscription_id
        }
    
    subscription = Subscription(**subscription_doc)
    
    # Only reconcile PayPal subscriptions
    if subscription.provider != 'paypal':
        return {
            "success": False,
            "error": "Not a PayPal subscription",
            "subscription_id": subscription_id,
            "provider": subscription.provider
        }
    
    # Must have PayPal subscription ID
    if not subscription.provider_subscription_id:
        logging.error(f"[RECONCILE] Subscription {subscription_id} missing provider_subscription_id")
        return {
            "success": False,
            "error": "Missing PayPal subscription ID",
            "subscription_id": subscription_id
        }
    
    # Check if already terminal-for-polling (skip unless force=True)
    # CRITICAL: For CANCELLED subscriptions, if PayPal timestamps are missing, force reconciliation
    if (not force and 
        subscription.paypal_verified_status in TERMINAL_FOR_POLLING and 
        not (subscription.paypal_verified_status == 'CANCELLED' and 
             not (getattr(subscription, 'next_billing_time', None) or getattr(subscription, 'final_payment_time', None)))):
        logging.info(f"[RECONCILE] Subscription {subscription_id} is terminal-for-polling ({subscription.paypal_verified_status}), skipping")
        
        # Even when skipping, we must return accurate access status based on timestamps
        # Re-evaluate access from stored billing info
        access_granted = False
        access_reason = f"Skipped reconciliation (terminal: {subscription.paypal_verified_status})"
        
        # Check if we have billing timestamps that would grant access
        if subscription.paypal_verified_status == 'ACTIVE':
            # For ACTIVE, check if we have valid next_billing_time
            # This is approximate - force reconciliation if precision needed
            access_granted = True  # Conservative: assume ACTIVE means access
            access_reason = "ACTIVE status (cached, not verified with PayPal)"
        elif subscription.paypal_verified_status == 'CANCELLED':
            # STRICT: For CANCELLED, check ONLY PayPal timestamps
            # PayPal provides next_billing_time until period ends (Auto Pay = OFF)
            # PayPal provides final_payment_time after period fully expires
            # If NEITHER exists ΓåÆ NO ACCESS (PayPal is source of truth)
            next_billing_time = getattr(subscription, 'next_billing_time', None)
            final_payment_time = getattr(subscription, 'final_payment_time', None)
            
            # Try next_billing_time first (provided during active period with Auto Pay OFF)
            if next_billing_time:
                try:
                    next_billing_dt = datetime.fromisoformat(next_billing_time.replace('Z', '+00:00'))
                    if next_billing_dt > now:
                        access_granted = True
                        access_reason = f"CANCELLED but access until next_billing_time: {next_billing_time}"
                    else:
                        access_reason = f"CANCELLED and next_billing_time expired: {next_billing_time}"
                except Exception as e:
                    logging.error(f"[RECONCILE] Failed to parse next_billing_time: {next_billing_time}, error: {e}")
                    access_reason = f"CANCELLED with unparseable next_billing_time"
            # Try final_payment_time (provided after period fully expires)
            elif final_payment_time:
                try:
                    final_payment_dt = datetime.fromisoformat(final_payment_time.replace('Z', '+00:00'))
                    if final_payment_dt > now:
                        access_granted = True
                        access_reason = f"CANCELLED but access until final_payment_time: {final_payment_time}"
                    else:
                        access_reason = f"CANCELLED and final_payment_time expired: {final_payment_time}"
                except Exception as e:
                    logging.error(f"[RECONCILE] Failed to parse final_payment_time: {final_payment_time}, error: {e}")
                    access_reason = f"CANCELLED with unparseable final_payment_time"
            else:
                # No PayPal timestamps ΓåÆ NO ACCESS (strict rule)
                access_reason = "CANCELLED with no PayPal timestamps - access denied"
        
        # Return billing_info with ONLY PayPal timestamps (no fallbacks, no inference)
        # If PayPal doesn't provide timestamps, they are null (strict rule)
        return {
            "success": True,
            "subscription_id": subscription_id,
            "paypal_status": subscription.paypal_verified_status,
            "internal_status": subscription.status,
            "access_granted": access_granted,
            "access_reason": access_reason,
            "is_terminal_for_polling": True,
            "billing_info": {
                "last_payment_time": getattr(subscription, 'last_payment_time', None),
                "next_billing_time": getattr(subscription, 'next_billing_time', None),
                "final_payment_time": getattr(subscription, 'final_payment_time', None)
            },
            "skipped": True
        }
    
    try:
        # STEP 1: Fetch subscription from PayPal (SINGLE SOURCE OF TRUTH)
        paypal_details = await get_paypal_subscription_details(
            subscription.provider_subscription_id,
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            action="reconcile",
            source="reconciliation"
        )
        
        if not paypal_details:
            logging.error(f"[RECONCILE] Failed to fetch PayPal details for subscription {subscription_id}")
            return {
                "success": False,
                "error": "PayPal API unavailable or subscription not found",
                "subscription_id": subscription_id
            }
        
        # STEP 2: Extract PayPal status and billing info
        paypal_status = paypal_details.get('status', '').upper()
        billing_info = paypal_details.get('billing_info', {})
        
        # Extract billing timestamps
        last_payment_time = billing_info.get('last_payment', {}).get('time')
        next_billing_time = billing_info.get('next_billing_time')
        final_payment_time = billing_info.get('final_payment_time')
        
        # FORENSIC LOG: Full billing_info from PayPal
        logging.critical(
            f"🔍 [RECONCILE] RAW PAYPAL RESPONSE for subscription {subscription_id}:\n"
            f"  status={paypal_status}\n"
            f"  billing_info={billing_info}\n"
            f"  last_payment_time={last_payment_time}\n"
            f"  next_billing_time={next_billing_time}\n"
            f"  final_payment_time={final_payment_time}"
        )
        
        # STEP 3: TIMESTAMP-DOMINANT ACCESS RULE (NO STATUS GATING)
        # Access is determined EXCLUSIVELY by billing timestamps
        # Status strings are logged but NEVER trusted for access decisions
        
        # Parse timestamps
        next_billing_dt = None
        final_payment_dt = None
        
        if next_billing_time:
            try:
                next_billing_dt = datetime.fromisoformat(next_billing_time.replace('Z', '+00:00'))
            except Exception as e:
                logging.error(f"[RECONCILE] Invalid next_billing_time format: {next_billing_time}, error: {e}")
                await metrics.increment('reconcile_timestamp_parse_error')
        
        if final_payment_time:
            try:
                final_payment_dt = datetime.fromisoformat(final_payment_time.replace('Z', '+00:00'))
            except Exception as e:
                logging.error(f"[RECONCILE] Invalid final_payment_time format: {final_payment_time}, error: {e}")
                await metrics.increment('reconcile_timestamp_parse_error')
        
        # PRODUCTION RULE: Access granted IFF billing timestamps prove it
        access_granted = (
            (next_billing_dt is not None and next_billing_dt > now) or
            (final_payment_dt is not None and final_payment_dt > now)
        )
        
        # MINIMAL COMPLIANT FALLBACK: Honor last confirmed PayPal payment
        # If no future timestamps but payment occurred, grant access for paid period
        # (PayPal edge case: cancelled trial before first regular billing)
        # This is NOT date inference - last_payment_time is PayPal-provided truth
        if not access_granted and not next_billing_dt and not final_payment_dt:
            if last_payment_time:
                access_granted = True
                access_source = "paypal_last_payment_fallback"
                logging.info(
                    f"[RECONCILE] Fallback access granted: last_payment exists but no future timestamps "
                    f"(PayPal edge case: cancelled trial). subscription_id={subscription_id}"
                )
        
        # METRICS & ALERT: Track access decisions
        if access_granted:
            await metrics.increment('access_granted_total')
            if next_billing_dt:
                await metrics.increment('access_granted_next_billing')
            if final_payment_dt:
                await metrics.increment('access_granted_final_payment')
            # Track fallback access
            if not next_billing_dt and not final_payment_dt and last_payment_time:
                await metrics.increment('access_granted_last_payment_fallback')
                logging.info(
                    f"📊 [RECONCILE] Access granted via last_payment fallback: "
                    f"subscription_id={subscription_id}, last_payment={last_payment_time}"
                )
        else:
            await metrics.increment('access_denied_total')
        
        # Access reason (for audit)
        if access_granted:
            if next_billing_dt and next_billing_dt > now:
                access_reason = f"Access until next_billing_time: {next_billing_time}"
            elif final_payment_dt and final_payment_dt > now:
                access_reason = f"Access until final_payment_time: {final_payment_time}"
            elif last_payment_time and not next_billing_dt and not final_payment_dt:
                access_reason = f"Access granted: last_payment confirmed (no end timestamp from PayPal)"
            else:
                access_reason = "Access granted (unknown reason - audit required)"
        else:
            if next_billing_dt and next_billing_dt <= now:
                access_reason = f"next_billing_time expired: {next_billing_time}"
            elif final_payment_dt and final_payment_dt <= now:
                access_reason = f"final_payment_time expired: {final_payment_time}"
            else:
                access_reason = "No valid billing timestamps from PayPal"
        
        # Map PayPal status ╬ô├Ñ├å internal status (for display/tracking only, NOT access)
        internal_status = None
        if paypal_status == 'ACTIVE':
            internal_status = SubscriptionStatus.ACTIVE
        elif paypal_status == 'CANCELLED':
            internal_status = SubscriptionStatus.CANCELLED
        elif paypal_status == 'EXPIRED':
            internal_status = SubscriptionStatus.EXPIRED
        elif paypal_status == 'SUSPENDED':
            internal_status = SubscriptionStatus.SUSPENDED
        elif paypal_status == 'APPROVAL_PENDING':
            internal_status = SubscriptionStatus.PENDING
        else:
            internal_status = SubscriptionStatus.PENDING
            logging.warning(f"[RECONCILE] Unknown PayPal status '{paypal_status}' for subscription {subscription_id}")
        
        # STEP 4: Determine plan based on access
        plan_name = "pro" if access_granted else "free"
        target_plan = await db.plans.find_one({"name": plan_name}, {"_id": 0})
        if not target_plan:
            logging.error(f"[RECONCILE] Plan '{plan_name}' not found in database")
            return {
                "success": False,
                "error": f"Plan '{plan_name}' not found",
                "subscription_id": subscription_id
            }
        
        # STEP 5: Persist to database (IMMEDIATE)
        # CRITICAL: Store PayPal billing timestamps (single source of truth)
        update_data = {
            "status": internal_status,
            "paypal_verified_status": paypal_status,
            "last_verified_at": now.isoformat(),
            "updated_at": now.isoformat(),
            # PayPal API fields (source of truth for access decisions)
            "last_payment_time": last_payment_time,
            "next_billing_time": next_billing_time,
            "final_payment_time": final_payment_time
        }
        
        # Set started_at if newly active
        if internal_status == SubscriptionStatus.ACTIVE and not subscription_doc.get('started_at'):
            update_data["started_at"] = now.isoformat()
        
        # Update subscription
        await db.subscriptions.update_one(
            {"id": subscription_id},
            {"$set": update_data}
        )
        
        # FORENSIC LOG: Confirm what was persisted
        logging.critical(
            f"💾 [RECONCILE] PERSISTED TO DB for subscription {subscription_id}:\n"
            f"  status={internal_status}\n"
            f"  paypal_verified_status={paypal_status}\n"
            f"  last_payment_time={last_payment_time}\n"
            f"  next_billing_time={next_billing_time}\n"
            f"  final_payment_time={final_payment_time}"
        )
        
        # Update user plan
        user_update = {"plan_id": target_plan['id']}
        if next_billing_time and access_granted:
            user_update["trial_ends_at"] = next_billing_time
        
        await db.users.update_one(
            {"id": subscription.user_id},
            {"$set": user_update}
        )
        
        # FORENSIC LOG: Confirm user plan update
        logging.critical(
            f"👤 [RECONCILE] USER UPDATED for {subscription.user_id}:\n"
            f"  plan_id={target_plan['id']} ({plan_name})\n"
            f"  trial_ends_at={next_billing_time if (next_billing_time and access_granted) else 'NOT SET'}"
        )
        
        # STEP 6: Audit logging (COMPREHENSIVE)
        await log_paypal_action(
            action="reconcile_complete",
            paypal_endpoint=f"/v1/billing/subscriptions/{subscription.provider_subscription_id}",
            http_method="GET",
            source="reconciliation",
            user_id=subscription.user_id,
            subscription_id=subscription_id,
            http_status_code=200,
            paypal_status=paypal_status,
            verified=True,
            raw_paypal_response=paypal_details
        )
        
        logging.info(
            f"[RECONCILE] Completed for subscription {subscription_id}: "
            f"paypal_status={paypal_status} ╬ô├Ñ├å internal_status={internal_status}, "
            f"access_granted={access_granted}, plan={plan_name}, reason='{access_reason}'"
        )
        
        # METRICS: Track successful reconciliation
        await metrics.increment('reconcile_success')
        await metrics.increment(f'reconcile_status_{paypal_status.lower()}')
        if paypal_status in TERMINAL_FOR_POLLING:
            await metrics.increment('reconcile_terminal')
        
        # STEP 7: Return complete state
        return {
            "success": True,
            "subscription_id": subscription_id,
            "paypal_status": paypal_status,
            "internal_status": internal_status,
            "access_granted": access_granted,
            "access_reason": access_reason,
            "is_terminal_for_polling": paypal_status in TERMINAL_FOR_POLLING,
            "billing_info": {
                "last_payment_time": last_payment_time,
                "next_billing_time": next_billing_time,
                "final_payment_time": final_payment_time
            },
            "reconciled_at": now.isoformat(),
            "plan_name": plan_name
        }
        
    except Exception as e:
        # METRICS: Track failed reconciliation
        await metrics.increment('reconcile_failed')
        logging.error(f"[RECONCILE] Error for subscription {subscription_id}: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "subscription_id": subscription_id
        }

# DEPRECATED: Legacy function maintained for backward compatibility
# All new code should use reconcile_subscription_with_paypal()
async def reconcile_pending_subscription(subscription: Subscription) -> Optional[Subscription]:
    """
    DEPRECATED: Use reconcile_subscription_with_paypal() instead.
    Maintained for backward compatibility only.
    """
    if subscription.status != SubscriptionStatus.PENDING or subscription.provider != 'paypal':
        return None
    
    result = await reconcile_subscription_with_paypal(subscription.id)
    if result.get("success") and result.get("access_granted"):
        updated_sub = await db.subscriptions.find_one({"id": subscription.id}, {"_id": 0})
        return Subscription(**updated_sub) if updated_sub else None
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
    PRODUCTION HARDENING: PayPal Webhook Handler
    
    This handler is OPTIMISTIC ONLY. It:
    1. Verifies webhook signature (security)
    2. Prevents duplicate processing (idempotency)
    3. Delegates ALL business logic to reconcile_subscription_with_paypal()
    4. Contains ZERO independent decision logic
    
    All state changes are determined by reconciliation function querying PayPal directly.
    Webhooks exist only for optimistic updates - system works even if webhooks never arrive.
    """
    # KILL SWITCH: Check if webhook processing is enabled
    if not kill_switch.webhook_processing_enabled:
        logging.warning("[WEBHOOK] Webhook processing disabled by kill switch")
        # Return 200 to acknowledge receipt (prevents PayPal retries)
        return JSONResponse({"status": "disabled", "message": "Webhook processing temporarily disabled"})
    
    try:
        body = await request.body()
        webhook_data = json.loads(body)
        
        event_type = webhook_data.get('event_type')
        event_id = webhook_data.get('id')
        resource = webhook_data.get('resource', {})
        
        # METRICS: Track webhook receipt
        await metrics.increment('webhook_received_total')
        await metrics.increment(f'webhook_event_{event_type.lower().replace(".", "_")}')
        
        if not event_id:
            logging.error("[WEBHOOK] Missing event ID")
            await metrics.increment('webhook_error_missing_event_id')
            return JSONResponse({"status": "error", "message": "Missing event ID"}, status_code=400)
        
        # PRODUCTION HARDENING: Composite key idempotency (event_id, transmission_time)
        # Protects against PayPal retries, reordering, and mutation
        if not paypal_transmission_time:
            logging.error("[WEBHOOK] Missing transmission_time for idempotency")
            return JSONResponse({"status": "error", "message": "Missing transmission_time"}, status_code=400)
        
        existing_event = await db.processed_webhook_events.find_one(
            {
                "paypal_event_id": event_id,
                "transmission_time": paypal_transmission_time
            },
            {"_id": 0}
        )
        if existing_event:
            logging.info(f"[WEBHOOK] Event already processed: {event_id} at {paypal_transmission_time}")
            return JSONResponse({"status": "success", "message": "Event already processed"})
        
        logging.info(f"[WEBHOOK] Received: event_type={event_type}, event_id={event_id}, resource_id={resource.get('id')}")
        
        # Verify webhook signature (CRITICAL for security)
        if not all([paypal_transmission_id, paypal_cert_url, paypal_auth_algo, paypal_transmission_sig, paypal_transmission_time]):
            logging.error("[WEBHOOK] Missing required headers for signature verification")
            return JSONResponse({"status": "error", "message": "Missing webhook headers"}, status_code=400)
        
        if not PAYPAL_WEBHOOK_ID:
            logging.error("[WEBHOOK] PAYPAL_WEBHOOK_ID not configured")
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
            logging.error(f"[WEBHOOK] Signature verification failed for event {event_id}")
            return JSONResponse({"status": "error", "message": "Invalid webhook signature"}, status_code=401)
        
        # AUDIT LOG: Webhook received
        await log_paypal_action(
            action="webhook_received",
            paypal_endpoint="/v1/notifications/webhooks",
            http_method="POST",
            source="webhook",
            http_status_code=None,
            paypal_status=None,
            verified=True,
            raw_paypal_response=webhook_data
        )
        
        # PRODUCTION HARDENING: Extract PayPal subscription ID
        paypal_subscription_id = resource.get('id') or resource.get('billing_agreement_id')
        if not paypal_subscription_id:
            logging.error(f"[WEBHOOK] Missing PayPal subscription ID in event {event_id}")
            return JSONResponse({"status": "error", "message": "Missing subscription ID"}, status_code=400)
        
        # Find our subscription record
        subscription_doc = await db.subscriptions.find_one(
            {"provider_subscription_id": paypal_subscription_id, "provider": "paypal"},
            {"_id": 0}
        )
        
        subscription_id = None
        if subscription_doc:
            subscription_id = subscription_doc['id']
            
            # PRODUCTION HARDENING: Delegate ALL logic to reconciliation
            # Webhooks contain ZERO independent business logic
            logging.info(f"[WEBHOOK] Delegating to reconciliation: subscription_id={subscription_id}, event_type={event_type}")
            
            reconcile_result = await reconcile_subscription_with_paypal(
                subscription_id=subscription_id,
                force=True  # Force reconciliation even if terminal
            )
            
            if reconcile_result.get("success"):
                logging.info(
                    f"[WEBHOOK] Reconciliation complete: subscription_id={subscription_id}, "
                    f"paypal_status={reconcile_result.get('paypal_status')}, "
                    f"access_granted={reconcile_result.get('access_granted')}, "
                    f"event_type={event_type}"
                )
            else:
                logging.error(
                    f"[WEBHOOK] Reconciliation failed: subscription_id={subscription_id}, "
                    f"error={reconcile_result.get('error')}, event_type={event_type}"
                )
        else:
            # Subscription not found - log for debugging
            all_paypal_subs = await db.subscriptions.find(
                {"provider": "paypal"},
                {"provider_subscription_id": 1, "user_id": 1, "status": 1, "_id": 0}
            ).to_list(20)
            logging.warning(
                f"[WEBHOOK] Subscription not found for PayPal ID: {paypal_subscription_id}. "
                f"Event: {event_type}. Available PayPal subscriptions: {all_paypal_subs}"
            )
        
        # Record processed event for idempotency (composite key)
        processed_event = ProcessedWebhookEvent(
            paypal_event_id=event_id,
            event_type=event_type,
            subscription_id=subscription_id
        )
        processed_event_dict = processed_event.model_dump()
        processed_event_dict['processed_at'] = processed_event_dict['processed_at'].isoformat()
        processed_event_dict['transmission_time'] = paypal_transmission_time  # Composite key component
        await db.processed_webhook_events.insert_one(processed_event_dict)
        
        return JSONResponse({"status": "success"})
    
    except Exception as e:
        logging.error(f"[WEBHOOK] Error: {str(e)}", exc_info=True)
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

# DEPRECATED: Old webhook logic preserved below for reference/rollback
# Delete after confirming new webhook works in production
"""
OLD_WEBHOOK_LOGIC_START
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
                user_id = subscription['user_id']
                update_data = {
                    "plan_id": pro_plan['id']
                }
                if trial_ends_at:
                    update_data["trial_ends_at"] = trial_ends_at
                
                result = await db.users.update_one(
                    {"id": user_id},
                    {"$set": update_data}
                )
                
                # Restore frozen workspace memberships (if user was previously downgraded)
                # Restore memberships that were frozen due to subscription expiration or admin downgrade
                # SECURITY INVARIANT: Only restore memberships with frozen_reason="subscription_expired" or "admin_downgrade"
                restored_count = await db.workspace_members.update_many(
                    {
                        "user_id": user_id,
                        "status": InvitationStatus.PENDING,
                        "frozen_reason": {"$in": ["subscription_expired", "admin_downgrade"]}  # CRITICAL: Only restore frozen memberships
                    },
                    {
                        "$set": {
                            "status": InvitationStatus.ACCEPTED,  # Restore to ACCEPTED
                            "restored_at": now.isoformat()  # Track when restored
                        },
                        "$unset": {
                            "frozen_at": "",
                            "frozen_reason": ""
                        }
                    }
                )
                
                # REGRESSION GUARD: Verify only frozen memberships were restored
                # Check that no new pending invitations (without frozen_reason) were restored
                new_pending_count = await db.workspace_members.count_documents(
                    {
                        "user_id": user_id,
                        "status": InvitationStatus.PENDING,
                        "frozen_reason": {"$exists": False}  # New invitations have no frozen_reason
                    }
                )
                if new_pending_count > 0 and restored_count.modified_count > 0:
                    # This is OK - user may have new pending invitations, but restoration only affected frozen ones
                    logging.debug(f"User {user_id} has {new_pending_count} new pending invitations (not restored)")
                
                if restored_count.modified_count > 0:
                    logging.info(
                        f"User {user_id} resubscribed to Pro. Restored {restored_count.modified_count} workspace memberships."
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
                    user_id = subscription['user_id']
                    
                    # Freeze existing workspace memberships (suspend, do not delete)
                    # Update all ACCEPTED memberships to PENDING (suspended state)
                    # This preserves the membership for restoration on resubscribe
                    # SECURITY INVARIANT: Must freeze ALL ACCEPTED memberships before downgrade
                    frozen_count = await db.workspace_members.update_many(
                        {
                            "user_id": user_id,
                            "status": InvitationStatus.ACCEPTED
                        },
                        {
                            "$set": {
                                "status": InvitationStatus.PENDING,  # Suspend by setting to PENDING
                                "frozen_at": now.isoformat(),  # Track when frozen
                                "frozen_reason": "subscription_expired"  # Reason for suspension
                            }
                        }
                    )
                    
                    # REGRESSION GUARD: Verify memberships were frozen
                    remaining_accepted = await db.workspace_members.count_documents(
                        {"user_id": user_id, "status": InvitationStatus.ACCEPTED}
                    )
                    if remaining_accepted > 0:
                        logging.error(
                            f"SECURITY WARNING: User {user_id} downgraded but {remaining_accepted} ACCEPTED memberships remain. "
                            "This violates security invariant - memberships should be frozen."
                        )
                    
                    await db.users.update_one(
                        {"id": user_id},
                        {
                            "$set": {
                                "plan_id": free_plan['id'],
                                "grace_period_ends_at": None,  # Clear grace period
                                "updated_at": now.isoformat()
                            },
                            "$unset": {"trial_ends_at": ""}  # Clear trial_ends_at when downgrading
                        }
                    )
                    
                    logging.info(
                        f"User {user_id} downgraded to Free. Frozen {frozen_count.modified_count} workspace memberships."
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
            # Payment failed/denied - start grace period (7 days)
            # PayPal will send EXPIRED webhook when subscription actually expires
            # GUARD: Never downgrade on payment failure - downgrade only on EXPIRED
            # CRITICAL: Do NOT downgrade user here - PayPal will send EXPIRED webhook when subscription actually expires
            # User keeps Pro access during grace period (7 days)
            paypal_subscription_id = resource.get('billing_agreement_id') or resource.get('id')
            if not paypal_subscription_id:
                logging.error(f"PayPal webhook: {event_type} missing subscription ID")
                return JSONResponse({"status": "error", "message": "Missing subscription ID"})
            
            subscription = await db.subscriptions.find_one(
                {"provider_subscription_id": paypal_subscription_id, "provider": "paypal"},
                {"_id": 0}
            )
            
            if subscription:
                now = datetime.now(timezone.utc)
                grace_ends_at = now + timedelta(days=7)  # 7-day grace period
                
                # Set grace period on subscription
                await db.subscriptions.update_one(
                    {"id": subscription['id']},
                    {"$set": {
                        "grace_started_at": now.isoformat(),
                        "grace_ends_at": grace_ends_at.isoformat(),
                        "updated_at": now.isoformat()
                    }}
                )
                
                # Set grace period on user (for workspace sharing checks)
                await db.users.update_one(
                    {"id": subscription['user_id']},
                    {"$set": {
                        "grace_period_ends_at": grace_ends_at.isoformat(),
                        "updated_at": now.isoformat()
                    }}
                )
                
                logging.warning(
                    f"PayPal payment failed: user={subscription['user_id']}, subscription={subscription['id']}, "
                    f"event={event_type}. Grace period started until {grace_ends_at.isoformat()}. "
                    f"User keeps access during grace period."
                )
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
        
OLD_WEBHOOK_LOGIC_END
"""

@api_router.get("/metrics")
async def get_production_metrics(current_user: User = Depends(require_admin)):
    """
    PRODUCTION OBSERVABILITY: Get real-time metrics
    Admin-only endpoint for monitoring.
    """
    all_metrics = await metrics.get_all()
    
    # Calculate derived metrics
    total_reconciles = all_metrics.get('reconcile_total', 0)
    success_reconciles = all_metrics.get('reconcile_success', 0)
    failed_reconciles = all_metrics.get('reconcile_failed', 0)
    success_rate = (success_reconciles / total_reconciles * 100) if total_reconciles > 0 else 0
    
    total_access = all_metrics.get('access_granted_total', 0) + all_metrics.get('access_denied_total', 0)
    granted_access = all_metrics.get('access_granted_total', 0)
    grant_rate = (granted_access / total_access * 100) if total_access > 0 else 0
    
    # Check alert conditions
    await check_alert_conditions()
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": all_metrics,
        "derived": {
            "reconciliation_success_rate_pct": round(success_rate, 2),
            "access_grant_rate_pct": round(grant_rate, 2),
            "total_reconciliations": total_reconciles,
            "total_access_decisions": total_access
        },
        "kill_switch": {
            "frontend_polling_enabled": kill_switch.frontend_polling_enabled,
            "webhook_processing_enabled": kill_switch.webhook_processing_enabled,
            "scheduled_reconciliation_enabled": kill_switch.scheduled_reconciliation_enabled,
            "user_reconciliation_enabled": kill_switch.user_reconciliation_enabled
        }
    }

@api_router.post("/admin/kill-switch")
async def control_kill_switch(
    action: str = Query(..., description="enable_all | disable_all | disable_except_scheduled"),
    current_user: User = Depends(require_admin)
):
    """
    PRODUCTION SAFETY: Emergency kill switch control
    Admin-only endpoint for incident response.
    """
    if action == "enable_all":
        kill_switch.enable_all()
        return {"status": "success", "message": "All features enabled"}
    elif action == "disable_all":
        kill_switch.frontend_polling_enabled = False
        kill_switch.webhook_processing_enabled = False
        kill_switch.scheduled_reconciliation_enabled = False
        kill_switch.user_reconciliation_enabled = False
        logging.critical("Γëí╞Æ├£┬┐ KILL SWITCH: All features disabled")
        return {"status": "success", "message": "All features disabled"}
    elif action == "disable_except_scheduled":
        kill_switch.disable_all_except_scheduled()
        return {"status": "success", "message": "Only scheduled reconciliation enabled"}
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@api_router.get("/plans")
async def get_plans(current_user: Optional[User] = Depends(get_current_user_optional)):
    """Get all available plans. Public endpoint for plan selection."""
    plans = await db.plans.find({"is_public": True}, {"_id": 0}).to_list(100)
    return {"plans": plans}

@api_router.get("/workspaces/{workspace_id}/quota")
async def get_workspace_quota(workspace_id: str, current_user: User = Depends(get_current_user)):
    """Get workspace quota usage."""
    # Use check_workspace_access() to enforce plan-based restrictions
    await check_workspace_access(workspace_id, current_user.id)
    
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
    current_user: User = Depends(require_admin)
):
    """
    Reconcile quota usage by recalculating storage from file records.
    Compares calculated storage with expected values and reports discrepancies.
    Admin-only endpoint.
    """
    
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
    current_user: User = Depends(require_admin)
):
    """
    Cleanup old PENDING and FAILED file records.
    - PENDING files older than pending_hours are likely abandoned uploads
    - FAILED files older than failed_days are failed uploads that won't be retried
    Admin-only endpoint.
    """
    
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
# IMPORTANT: allow_credentials=True requires explicit origins (no "*").
cors_origins = ["https://www.interguide.app", "https://interguide.app"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With"
    ],
    expose_headers=["*"],
)

@app.on_event("startup")
async def log_cors_config():
    logging.info(f"[CORS] cors_origins={cors_origins}")
    logging.info(
        "[CORS] config allow_credentials=True "
        "allow_methods=* "
        "allow_headers=Content-Type,Authorization,Accept,Origin,X-Requested-With"
    )

def _parse_cloudinary_public_id(url: str) -> tuple[str, str] | tuple[None, None]:
    if not url or "res.cloudinary.com" not in url or "/image/upload/" not in url:
        return None, None
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path or ""
        parts = [p for p in path.split("/") if p]
        if len(parts) < 3:
            return None, None
        cloud_name = parts[0]
        marker_index = path.find("/image/upload/")
        if marker_index == -1:
            return None, None
        remainder = path[marker_index + len("/image/upload/"):]
        segments = [seg for seg in remainder.split("/") if seg]
        if not segments:
            return None, None
        def is_transform_segment(seg: str) -> bool:
            if seg.startswith("v") and seg[1:].isdigit():
                return True
            if ":" in seg:
                return True
            if re.search(r"(?:^|,)(c_|w_|h_|q_|f_|g_|ar_|b_|e_|d_)", seg):
                return True
            return False
        while segments and is_transform_segment(segments[0]):
            segments.pop(0)
        if not segments:
            return None, None
        public_with_ext = "/".join(segments)
        public_id = public_with_ext.rsplit(".", 1)[0]
        return cloud_name, public_id
    except Exception:
        return None, None

def _get_workspace_og_image_url(logo_url: str | None) -> str | None:
    if not logo_url:
        return None
    cloud_name, public_id = _parse_cloudinary_public_id(logo_url)
    if not cloud_name or not public_id:
        return None
    return (
        f"https://res.cloudinary.com/{cloud_name}/image/upload/"
        f"c_fill,g_center,w_1200,h_630,q_auto,f_jpg/{public_id}.jpg"
    )

def _get_og_image_type(url: str) -> str:
    if url.lower().endswith(".png"):
        return "image/png"
    return "image/jpeg"

_SPA_INDEX_CACHE = {"html": None, "loaded_at": 0.0}

def _load_spa_index_html() -> str | None:
    cached = _SPA_INDEX_CACHE.get("html")
    loaded_at = _SPA_INDEX_CACHE.get("loaded_at", 0.0)
    if cached and (time.time() - loaded_at) < 300:
        return cached
    try:
        build_index = ROOT_DIR.parent / "frontend" / "build" / "index.html"
        if build_index.exists():
            html = build_index.read_text(encoding="utf-8")
            _SPA_INDEX_CACHE["html"] = html
            _SPA_INDEX_CACHE["loaded_at"] = time.time()
            return html
    except Exception:
        pass
    try:
        response = requests.get(FRONTEND_URL, timeout=5)
        if response.status_code == 200 and "<head" in response.text:
            _SPA_INDEX_CACHE["html"] = response.text
            _SPA_INDEX_CACHE["loaded_at"] = time.time()
            return response.text
    except Exception:
        return None
    return None

def _replace_meta_tag(html: str, key: str, value: str, attr: str) -> str:
    escaped_value = html_module.escape(value, quote=True)
    pattern = rf'<meta\s+[^>]*{attr}="{re.escape(key)}"[^>]*>'
    replacement = f'<meta {attr}="{key}" content="{escaped_value}">'
    if re.search(pattern, html, flags=re.IGNORECASE):
        return re.sub(pattern, replacement, html, count=1, flags=re.IGNORECASE)
    return html.replace("</head>", f"    {replacement}\n</head>", 1)

def _inject_portal_og(html: str, title: str, description: str, image_url: str, share_url: str) -> str:
    escaped_title = html_module.escape(title, quote=True)
    escaped_description = html_module.escape(description, quote=True)
    escaped_image = html_module.escape(image_url, quote=True)
    escaped_url = html_module.escape(share_url, quote=True)
    html = re.sub(
        r"<title>.*?</title>",
        f"<title>{escaped_title}</title>",
        html,
        count=1,
        flags=re.IGNORECASE | re.DOTALL,
    )
    html = _replace_meta_tag(html, "description", description, "name")
    html = _replace_meta_tag(html, "og:type", "website", "property")
    html = _replace_meta_tag(html, "og:title", title, "property")
    html = _replace_meta_tag(html, "og:description", description, "property")
    html = _replace_meta_tag(html, "og:image", image_url, "property")
    html = _replace_meta_tag(html, "og:image:width", "1200", "property")
    html = _replace_meta_tag(html, "og:image:height", "630", "property")
    html = _replace_meta_tag(html, "og:image:type", "image/jpeg", "property")
    html = _replace_meta_tag(html, "og:url", share_url, "property")
    html = _replace_meta_tag(html, "twitter:card", "summary_large_image", "name")
    html = _replace_meta_tag(html, "twitter:title", title, "name")
    html = _replace_meta_tag(html, "twitter:description", description, "name")
    html = _replace_meta_tag(html, "twitter:image", image_url, "name")
    html = _replace_meta_tag(html, "twitter:url", share_url, "name")
    if FB_APP_ID:
        html = _replace_meta_tag(html, "fb:app_id", FB_APP_ID, "property")
    return html

def _render_portal_og_html(workspace: dict | None, share_url: str, status_code: int = 200) -> HTMLResponse:
    try:
        workspace_name = (workspace or {}).get("name") or "InterGuide"
        workspace_logo = (workspace or {}).get("logo")
        og_image_url = _get_workspace_og_image_url(workspace_logo)
        if not og_image_url:
            og_image_url = STATIC_OG_IMAGE_URL
        base_html = _load_spa_index_html()
        if not base_html:
            fallback_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:type" content="website" />
    <meta property="og:title" content="{html_module.escape(workspace_name)}" />
    <meta property="og:description" content="Knowledge base" />
    <meta property="og:image" content="{html_module.escape(og_image_url)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{html_module.escape(workspace_name)}" />
    <meta name="twitter:description" content="Knowledge base" />
    <meta name="twitter:image" content="{html_module.escape(og_image_url)}" />
    <title>{html_module.escape(workspace_name)}</title>
    <meta name="description" content="Knowledge base" />
</head>
<body>
    <div id="root"></div>
</body>
</html>"""
            return HTMLResponse(content=fallback_html, status_code=status_code)
        injected = _inject_portal_og(
            base_html,
            workspace_name,
            "Knowledge base",
            og_image_url,
            share_url,
        )
        return HTMLResponse(content=injected, status_code=status_code)
    except Exception:
        fallback_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:type" content="website" />
    <meta property="og:title" content="InterGuide" />
    <meta property="og:description" content="Knowledge base" />
    <meta property="og:image" content="{html_module.escape(STATIC_OG_IMAGE_URL)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="InterGuide" />
    <meta name="twitter:description" content="Knowledge base" />
    <meta name="twitter:image" content="{html_module.escape(STATIC_OG_IMAGE_URL)}" />
    <title>InterGuide</title>
    <meta name="description" content="Knowledge base" />
</head>
<body>
    <div id="root"></div>
</body>
</html>"""
        return HTMLResponse(content=fallback_html, status_code=status_code)

def _render_workspace_og_html(workspace: dict | None, request: Request, redirect_url: str, share_url: str) -> HTMLResponse:
    import html as html_module
    try:
        workspace_name = (workspace or {}).get("name") or "InterGuide"
        workspace_logo = (workspace or {}).get("logo")
        og_image_url = _get_workspace_og_image_url(workspace_logo)
        if not og_image_url:
            og_image_url = STATIC_OG_IMAGE_URL
        og_image_type = "image/jpeg"
        og_title = workspace_name
        og_description = "Knowledge base"
        fb_meta = (
            f'<meta property="fb:app_id" content="{html_module.escape(FB_APP_ID, quote=True)}">'
            if FB_APP_ID else ""
        )
        og_title_escaped = html_module.escape(og_title)
        og_description_escaped = html_module.escape(og_description)
        og_image_url_escaped = html_module.escape(og_image_url)
        share_url_escaped = html_module.escape(share_url)
        redirect_url_escaped = html_module.escape(redirect_url)
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
    <meta property="og:image:type" content="{og_image_type}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:type" content="website">
    <meta property="og:url" content="{share_url_escaped}">
    {fb_meta}
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{og_title_escaped}">
    <meta name="twitter:description" content="{og_description_escaped}">
    <meta name="twitter:image" content="{og_image_url_escaped}">
    
    <!-- Standard Meta Tags -->
    <title>{og_title_escaped}</title>
    <meta name="description" content="{og_description_escaped}">
    
    <meta http-equiv="refresh" content="0;url={redirect_url_escaped}">
    <script>
        window.location.replace("{redirect_url_escaped}");
    </script>
</head>
<body>
    <p>Redirecting to <a href="{redirect_url_escaped}">{workspace_name_escaped}</a>...</p>
</body>
</html>"""
        return HTMLResponse(content=html_content)
    except Exception:
        fallback_image = STATIC_OG_IMAGE_URL
        fb_meta = (
            f'<meta property="fb:app_id" content="{html_module.escape(FB_APP_ID, quote=True)}">'
            if FB_APP_ID else ""
        )
        fallback_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:title" content="InterGuide">
    <meta property="og:description" content="Knowledge base">
    <meta property="og:image" content="{html_module.escape(fallback_image)}">
    <meta property="og:image:secure_url" content="{html_module.escape(fallback_image)}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:type" content="website">
    {fb_meta}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="InterGuide">
    <meta name="twitter:description" content="Knowledge base">
    <meta name="twitter:image" content="{html_module.escape(fallback_image)}">
    <title>InterGuide</title>
    <meta name="description" content="Knowledge base">
    <meta http-equiv="refresh" content="0;url={html_module.escape(redirect_url)}">
    <script>window.location.replace("{html_module.escape(redirect_url)}");</script>
</head>
<body></body>
</html>"""
        return HTMLResponse(content=fallback_html)

# Open Graph preview route for workspace sharing
@app.get("/share/workspace/{slug}", response_class=HTMLResponse)
async def share_workspace(slug: str, request: Request):
    """
    Generate Open Graph HTML preview for workspace sharing.
    This route is used by social media crawlers (WhatsApp, Facebook, etc.) to display
    rich previews when workspace links are shared.
    
    CRITICAL: Uses workspace.logo exactly as stored in database - no transformations.
    """
    # Look up workspace by slug (public route, no auth required)
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    
    if not workspace:
        # Return 404 HTML if workspace not found
        return HTMLResponse(
            content="<html><head><title>Workspace Not Found</title></head><body><h1>Workspace Not Found</h1></body></html>",
            status_code=404
        )
    
    workspace_url = f"{FRONTEND_URL}/workspace/{slug}/walkthroughs"
    share_url = f"{request.url.scheme}://{request.url.netloc}/share/workspace/{slug}"
    return _render_workspace_og_html(workspace, request, workspace_url, share_url)

# Open Graph preview route for portal sharing
# WhatsApp and other crawlers access /portal/{slug} directly, so we need to handle it here
@app.get("/portal/{slug}", response_class=HTMLResponse)
async def share_portal(slug: str, request: Request):
    """
    Generate Open Graph HTML preview for portal sharing.
    This route handles both:
    1. Social media crawlers (WhatsApp, Facebook, etc.) - returns HTML with OG tags
    2. Real users - redirects to the SPA portal page
    
    CRITICAL: Uses workspace.logo exactly as stored in database - no transformations.
    """
    # Look up workspace by slug (public route, no auth required)
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    
    share_url = f"{MAIN_DOMAIN}/portal/{slug}"
    if not workspace:
        return _render_portal_og_html(None, share_url, status_code=404)
    return _render_portal_og_html(workspace, share_url)

@app.get("/portal/{slug}/{path:path}", response_class=HTMLResponse)
async def share_portal_path(slug: str, path: str, request: Request):
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    share_url = f"{MAIN_DOMAIN}/portal/{slug}/{path}"
    if not workspace:
        return _render_portal_og_html(None, share_url, status_code=404)
    return _render_portal_og_html(workspace, share_url)

@app.get("/embed/portal/{slug}", response_class=HTMLResponse)
async def share_embed_portal(slug: str, request: Request):
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    redirect_url = f"{FRONTEND_URL}/embed/portal/{slug}"
    share_url = f"{request.url.scheme}://{request.url.netloc}/embed/portal/{slug}"
    return _render_workspace_og_html(workspace, request, redirect_url, share_url)

@app.get("/embed/portal/{slug}/{path:path}", response_class=HTMLResponse)
async def share_embed_portal_path(slug: str, path: str, request: Request):
    workspace = await db.workspaces.find_one({"slug": slug}, {"_id": 0})
    redirect_url = f"{FRONTEND_URL}/embed/portal/{slug}/{path}"
    share_url = f"{request.url.scheme}://{request.url.netloc}/embed/portal/{slug}/{path}"
    return _render_workspace_og_html(workspace, request, redirect_url, share_url)

# Router will be included at the end of the file, after all routes are defined

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Exception handler for HTTPException
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Return JSON error response for HTTPException."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Exception handler for RequestValidationError
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return JSON error response for validation errors (422)."""
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body}
    )

# Exception handler for unhandled exceptions
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Return JSON error response for unhandled exceptions."""
    import traceback
    logging.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Admin-only email diagnostic endpoint
@api_router.get("/admin/email/config")
async def get_email_config(current_user: User = Depends(require_admin)):
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
    current_user: User = Depends(require_admin)
):
    """
    Send a test email via Resend HTTP API.
    Admin-only endpoint for testing email configuration without creating users.
    Returns detailed Resend API response for debugging.
    """
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
    current_user: User = Depends(require_admin)
):
    """
    Get full PayPal audit log for a subscription.
    Admin-only endpoint for dispute resolution and audits.
    
    Returns chronological audit trail of all PayPal interactions for this subscription.
    """
    
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
    current_user: User = Depends(require_admin)
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
    # Admin role check enforced via require_admin dependency
    
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

async def ensure_workspace_lock_index():
    """
    Ensure unique index exists on workspace_locks.workspace_id.
    
    CRITICAL: This enforces database-level uniqueness guarantee for workspace locks.
    Prevents duplicate locks even under race conditions, process restarts, or concurrent deploys.
    
    Idempotent: Safe to run multiple times. Logs success or existing-index detection.
    Background-safe: Does not block boot if index already exists.
    """
    try:
        # Check if index already exists
        existing_indexes = await db.workspace_locks.list_indexes().to_list(10)
        index_names = [idx.get('name', '') for idx in existing_indexes]
        
        if 'workspace_id_unique' in index_names:
            logging.info("[startup] Workspace lock unique index already exists: workspace_id_unique")
            return True
        
        # Create unique index on workspace_id
        # This ensures only one lock can exist per workspace at the database level
        result = await db.workspace_locks.create_index(
            [("workspace_id", 1)],
            unique=True,
            name="workspace_id_unique"
        )
        logging.info(f"[startup] Created unique index on workspace_locks.workspace_id: {result}")
        return True
        
    except Exception as e:
        # Log error but don't crash - index might already exist or database might be unavailable
        # Application-level atomic operations still provide protection
        error_msg = str(e).lower()
        if "already exists" in error_msg or "duplicate key" in error_msg or "E11000" in error_msg:
            logging.info("[startup] Workspace lock unique index already exists (detected via exception)")
            return True
        else:
            logging.error(f"[startup] Failed to create workspace lock unique index: {e}", exc_info=True)
            logging.warning("[startup] Continuing without unique index - application-level atomic operations provide protection")
            return False

async def cleanup_duplicate_workspace_locks():
    """
    Audit and clean up duplicate workspace_id records in workspace_locks.
    
    CRITICAL: This is a one-time cleanup for any duplicates that existed before the unique index.
    Deterministically keeps the newest lock (by expires_at) and deletes the rest.
    
    Safe: Only runs if duplicates are found. Idempotent.
    """
    try:
        # Find all workspace_ids that have multiple locks
        # Use aggregation to find duplicates
        pipeline = [
            {"$group": {
                "_id": "$workspace_id",
                "count": {"$sum": 1},
                "locks": {"$push": {
                    "id": "$id",
                    "locked_by_user_id": "$locked_by_user_id",
                    "expires_at": "$expires_at",
                    "locked_at": "$locked_at"
                }}
            }},
            {"$match": {"count": {"$gt": 1}}}
        ]
        
        duplicates = await db.workspace_locks.aggregate(pipeline).to_list(1000)
        
        if not duplicates:
            logging.info("[startup] No duplicate workspace locks found - database is clean")
            return 0
        
        total_deleted = 0
        for dup_group in duplicates:
            workspace_id = dup_group["_id"]
            locks = dup_group["locks"]
            
            # Sort by expires_at descending (newest first)
            # Keep the lock with the latest expires_at
            locks_sorted = sorted(
                locks,
                key=lambda x: x.get("expires_at", ""),
                reverse=True
            )
            
            # Keep the newest lock, delete the rest
            keep_lock_id = locks_sorted[0]["id"]
            delete_lock_ids = [lock["id"] for lock in locks_sorted[1:]]
            
            if delete_lock_ids:
                delete_result = await db.workspace_locks.delete_many(
                    {"workspace_id": workspace_id, "id": {"$in": delete_lock_ids}}
                )
                total_deleted += delete_result.deleted_count
                logging.info(
                    f"[startup] Cleaned up {delete_result.deleted_count} duplicate locks for workspace {workspace_id} "
                    f"(kept lock {keep_lock_id}, deleted {delete_lock_ids})"
                )
        
        if total_deleted > 0:
            logging.info(f"[startup] Cleanup complete: removed {total_deleted} duplicate workspace locks")
        else:
            logging.info("[startup] No duplicate locks needed cleanup")
        
        return total_deleted
        
    except Exception as e:
        # Log error but don't crash - cleanup is best-effort
        logging.error(f"[startup] Failed to cleanup duplicate workspace locks: {e}", exc_info=True)
        logging.warning("[startup] Continuing without cleanup - duplicates will be handled by unique index")
        return 0

# ============================================================================
# ADMIN ENDPOINTS - User & Subscription Management
# ============================================================================

class UpdateUserRoleRequest(BaseModel):
    role: UserRole

@api_router.get("/admin/users")
async def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by email or name"),
    current_user: User = Depends(require_admin)
):
    """
    List all users with pagination and search.
    Admin-only endpoint.
    """
    skip = (page - 1) * limit
    
    # Build query
    query = {}
    if search:
        query = {
            "$or": [
                {"email": {"$regex": search, "$options": "i"}},
                {"name": {"$regex": search, "$options": "i"}}
            ]
        }
    
    # Get total count
    total = await db.users.count_documents(query)
    
    # Get users
    users_cursor = db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).sort("created_at", -1)
    users = await users_cursor.to_list(limit)
    
    # Enrich with plan and subscription info
    enriched_users = []
    for user in users:
        user_dict = dict(user)
        
        # Get plan
        plan_id = user.get('plan_id')
        if plan_id:
            plan = await db.plans.find_one({"id": plan_id}, {"_id": 0, "name": 1, "display_name": 1})
            user_dict["plan"] = plan
        
        # Get subscription (include grace period fields)
        subscription_id = user.get('subscription_id')
        if subscription_id:
            subscription = await db.subscriptions.find_one(
                {"id": subscription_id}, 
                {"_id": 0, "status": 1, "started_at": 1, "grace_started_at": 1, "grace_ends_at": 1}
            )
            user_dict["subscription"] = subscription
        
        # Get storage usage
        user_dict["storage_used"] = await get_user_storage_usage(user.get("id"))
        
        enriched_users.append(user_dict)
    
    return {
        "users": enriched_users,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/admin/users/{user_id}")
async def get_user_details(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """
    Get detailed user information including workspaces, walkthroughs, and quota.
    Admin-only endpoint.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_dict = dict(user)
    
    # Get plan
    plan_id = user.get('plan_id')
    if plan_id:
        plan = await db.plans.find_one({"id": plan_id}, {"_id": 0})
        user_dict["plan"] = plan
    
    # Get subscription
    subscription_id = user.get('subscription_id')
    if subscription_id:
        subscription = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
        user_dict["subscription"] = subscription
    
    # Get workspaces
    workspaces = await db.workspaces.find({"owner_id": user_id}, {"_id": 0}).to_list(1000)
    user_dict["workspaces"] = workspaces
    user_dict["workspace_count"] = len(workspaces)
    
    # Get walkthroughs
    workspace_ids = [w["id"] for w in workspaces]
    walkthrough_count = 0
    if workspace_ids:
        walkthrough_count = await db.walkthroughs.count_documents({"workspace_id": {"$in": workspace_ids}})
    user_dict["walkthrough_count"] = walkthrough_count
    
    # Get storage usage
    user_dict["storage_used"] = await get_user_storage_usage(user_id)
    
    # Get quota info
    plan = await get_user_plan(user_id)
    if plan:
        user_dict["quota"] = {
            "storage_allowed": plan.storage_bytes,
            "storage_used": user_dict["storage_used"],
            "workspaces_limit": plan.max_workspaces,
            "workspaces_used": user_dict["workspace_count"],
            "walkthroughs_limit": plan.max_walkthroughs,
            "walkthroughs_used": walkthrough_count
        }
    
    return user_dict

@api_router.get("/admin/users/{user_id}/memberships")
async def get_user_memberships(
    user_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(require_admin)
):
    """
    Get user's workspace memberships including frozen status.
    Admin-only, read-only endpoint.
    Returns paginated list of workspace memberships with status and frozen_reason.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    skip = (page - 1) * limit
    
    # Get memberships
    memberships_cursor = db.workspace_members.find(
        {"user_id": user_id},
        {"_id": 0}
    ).skip(skip).limit(limit).sort("created_at", -1)
    
    memberships = await memberships_cursor.to_list(limit)
    total = await db.workspace_members.count_documents({"user_id": user_id})
    
    # Enrich with workspace names
    enriched_memberships = []
    for membership in memberships:
        membership_dict = dict(membership)
        
        # Get workspace name
        workspace_id = membership.get('workspace_id')
        if workspace_id:
            workspace = await db.workspaces.find_one(
                {"id": workspace_id}, 
                {"_id": 0, "name": 1, "slug": 1}
            )
            if workspace:
                membership_dict["workspace"] = {
                    "name": workspace.get("name"),
                    "slug": workspace.get("slug")
                }
        
        enriched_memberships.append(membership_dict)
    
    return {
        "memberships": enriched_memberships,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

class UpdateUserRoleRequest(BaseModel):
    role: UserRole

@api_router.put("/admin/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    request: UpdateUserRoleRequest,
    current_user: User = Depends(require_admin)
):
    """
    Update user role.
    Admin-only endpoint.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": request.role.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logging.info(f"[ADMIN] User {current_user.id} updated role for user {user_id} to {request.role.value}")
    
    return {"success": True, "user_id": user_id, "role": request.role.value}

@api_router.put("/admin/users/{user_id}/plan")
async def admin_update_user_plan(
    user_id: str,
    plan_name: str = Body(..., description="Plan name to assign"),
    current_user: User = Depends(require_admin)
):
    """
    Admin endpoint to update user's plan.
    Bypasses PayPal subscription requirement - use for testing or manual upgrades.
    If downgrading to Free, immediately applies Free quotas.
    Admin-only endpoint.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get plan
    plan = await db.plans.find_one({"name": plan_name}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_name}' not found")
    
    # Check if downgrading to Free
    old_plan_id = user.get('plan_id')
    old_plan = None
    if old_plan_id:
        old_plan = await db.plans.find_one({"id": old_plan_id}, {"_id": 0, "name": 1})
    
    is_downgrade = old_plan and old_plan.get('name') == 'pro' and plan_name == 'free'
    now = datetime.now(timezone.utc)
    
    # Update user plan
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"plan_id": plan["id"], "updated_at": now.isoformat()}}
    )

    # For paid plans, ensure manual subscription exists and restore memberships
    if plan_name != 'free':
        subscription_id = user.get('subscription_id')
        existing_subscription = None
        if subscription_id:
            existing_subscription = await db.subscriptions.find_one(
                {"id": subscription_id},
                {"_id": 0}
            )

        manual_subscription = await db.subscriptions.find_one(
            {
                "user_id": user_id,
                "provider": {"$ne": "paypal"}
            },
            {"_id": 0}
        )

        if existing_subscription and existing_subscription.get("provider") != "paypal":
            await db.subscriptions.update_one(
                {"id": subscription_id},
                {"$set": {
                    "plan_id": plan["id"],
                    "status": SubscriptionStatus.ACTIVE.value,
                    "updated_at": now.isoformat()
                }}
            )
        elif manual_subscription:
            await db.subscriptions.update_one(
                {"id": manual_subscription["id"]},
                {"$set": {
                    "plan_id": plan["id"],
                    "status": SubscriptionStatus.ACTIVE.value,
                    "updated_at": now.isoformat()
                }}
            )
        else:
            subscription_id = str(uuid.uuid4())
            subscription = Subscription(
                id=subscription_id,
                user_id=user_id,
                plan_id=plan["id"],
                status=SubscriptionStatus.ACTIVE,
                provider="manual"
            )
            sub_dict = subscription.model_dump()
            sub_dict['started_at'] = sub_dict['started_at'].isoformat()
            sub_dict['created_at'] = sub_dict['created_at'].isoformat()
            sub_dict['updated_at'] = sub_dict['updated_at'].isoformat()
            await db.subscriptions.insert_one(sub_dict)
            # Only attach manual subscription if no PayPal subscription is linked
            if not existing_subscription or existing_subscription.get("provider") != "paypal":
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"subscription_id": subscription_id}}
                )

        await db.workspace_members.update_many(
            {
                "user_id": user_id,
                "status": InvitationStatus.PENDING,
                "frozen_reason": {"$in": ["subscription_expired", "admin_downgrade"]}
            },
            {
                "$set": {
                    "status": InvitationStatus.ACCEPTED,
                    "restored_at": now.isoformat()
                },
                "$unset": {
                    "frozen_at": "",
                    "frozen_reason": ""
                }
            }
        )
    
    # If downgrading to Free, check and enforce storage quota immediately
    if is_downgrade:
        storage_used = await get_user_storage_usage(user_id)
        free_storage_limit = plan.get('storage_bytes', 500 * 1024 * 1024)  # Default 500MB
        
        if storage_used > free_storage_limit:
            logging.warning(
                f"[ADMIN] User {user_id} downgraded to Free but storage exceeds limit. "
                f"Used: {storage_used}, Limit: {free_storage_limit}. "
                f"User will need to delete files to continue using service."
            )
            # Note: We don't block the downgrade, but user will hit quota errors on uploads
    
    if user_id in _reconciliation_cache:
        del _reconciliation_cache[user_id]

    logging.info(f"[ADMIN] User {current_user.id} updated plan for user {user_id} to {plan_name}")
    
    return {"success": True, "user_id": user_id, "plan_name": plan_name, "plan_id": plan["id"]}

@api_router.post("/admin/users/{user_id}/subscription/manual")
async def create_manual_subscription(
    user_id: str,
    plan_name: str = Body(..., description="Plan name for subscription"),
    duration_days: Optional[int] = Body(None, description="Subscription duration in days (None = permanent)"),
    current_user: User = Depends(require_admin)
):
    """
    Create a manual subscription for a user (bypasses PayPal).
    Useful for testing, promotions, or manual upgrades.
    Admin-only endpoint.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get plan
    plan = await db.plans.find_one({"name": plan_name}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_name}' not found")
    
    # Create subscription
    subscription_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = None
    if duration_days:
        expires_at = now + timedelta(days=duration_days)
    
    subscription = {
        "id": subscription_id,
        "user_id": user_id,
        "plan_id": plan["id"],
        "status": SubscriptionStatus.ACTIVE.value,
        "provider_subscription_id": None,  # Manual subscription, no PayPal
        "extra_storage_bytes": 0,
        "started_at": now.isoformat(),
        "cancelled_at": None,
        "cancel_at_period_end": False,
        "paypal_verified_status": None,
        "last_verified_at": None,
        "cancellation_requested_at": None,
        "effective_end_date": expires_at.isoformat() if expires_at else None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.subscriptions.insert_one(subscription)
    
    # Update user
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "subscription_id": subscription_id,
            "plan_id": plan["id"],
            "updated_at": now.isoformat()
        }}
    )
    
    logging.info(f"[ADMIN] User {current_user.id} created manual subscription for user {user_id} (plan: {plan_name}, duration: {duration_days} days)")
    
    return {
        "success": True,
        "subscription_id": subscription_id,
        "user_id": user_id,
        "plan_name": plan_name,
        "expires_at": expires_at.isoformat() if expires_at else None
    }

@api_router.delete("/admin/users/{user_id}/subscription")
async def cancel_user_subscription(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """
    Cancel a user's subscription (admin override).
    Admin-only endpoint.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_id = user.get('subscription_id')
    if not subscription_id:
        raise HTTPException(status_code=404, detail="User has no subscription")
    
    # Update subscription
    await db.subscriptions.update_one(
        {"id": subscription_id},
        {"$set": {
            "status": SubscriptionStatus.CANCELLED.value,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update user plan to free
    free_plan = await db.plans.find_one({"name": "free"}, {"_id": 0})
    if free_plan:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "plan_id": free_plan["id"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    logging.info(f"[ADMIN] User {current_user.id} cancelled subscription for user {user_id}")
    
    return {"success": True, "user_id": user_id, "subscription_id": subscription_id}

class UpdateSubscriptionRequest(BaseModel):
    started_at: Optional[str] = None
    effective_end_date: Optional[str] = None
    status: Optional[str] = None

@api_router.put("/admin/users/{user_id}/subscription")
async def update_manual_subscription(
    user_id: str,
    request: UpdateSubscriptionRequest,
    current_user: User = Depends(require_admin)
):
    """
    Update manual subscription details (dates, status).
    ONLY works for manual subscriptions (no PayPal subscription ID).
    Cannot modify PayPal-managed subscriptions.
    Admin-only endpoint.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_id = user.get('subscription_id')
    if not subscription_id:
        raise HTTPException(status_code=404, detail="User has no subscription")
    
    subscription = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Check if this is a PayPal-managed subscription
    if subscription.get('provider_subscription_id'):
        raise HTTPException(
            status_code=403, 
            detail="Cannot modify PayPal-managed subscription. User must manage subscription through PayPal."
        )
    
    # Build update dict
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if request.started_at:
        try:
            # Validate date format
            datetime.fromisoformat(request.started_at.replace('Z', '+00:00'))
            update_dict["started_at"] = request.started_at
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid started_at format. Use ISO 8601 format.")
    
    if request.effective_end_date:
        try:
            # Validate date format (can be null for permanent subscriptions)
            datetime.fromisoformat(request.effective_end_date.replace('Z', '+00:00'))
            update_dict["effective_end_date"] = request.effective_end_date
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid effective_end_date format. Use ISO 8601 format.")
    
    if request.status:
        # Validate status
        valid_statuses = [s.value for s in SubscriptionStatus]
        if request.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        update_dict["status"] = request.status
        
        # If setting to expired or cancelled, update user plan to free
        if request.status in [SubscriptionStatus.EXPIRED.value, SubscriptionStatus.CANCELLED.value]:
            free_plan = await db.plans.find_one({"name": "free"}, {"_id": 0})
            if free_plan:
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {
                        "plan_id": free_plan["id"],
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
    
    # Update subscription
    await db.subscriptions.update_one(
        {"id": subscription_id},
        {"$set": update_dict}
    )
    
    logging.info(f"[ADMIN] User {current_user.id} updated manual subscription for user {user_id}: {update_dict}")
    
    return {"success": True, "user_id": user_id, "subscription_id": subscription_id, "updates": update_dict}

class PaymentReminderRequest(BaseModel):
    message: Optional[str] = None

@api_router.post("/admin/users/{user_id}/payment-reminder")
async def send_payment_reminder(
    user_id: str,
    request: PaymentReminderRequest = Body(default=PaymentReminderRequest()),
    current_user: User = Depends(require_admin)
):
    """
    Send payment reminder to user.
    Creates a system notification for the user.
    Admin-only endpoint.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get subscription info for context
    subscription_id = user.get('subscription_id')
    subscription = None
    if subscription_id:
        subscription = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    
    # Create notification
    notification_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    default_message = "Your subscription requires payment. Please contact support at support@interguide.app to complete your payment and continue enjoying Pro features."
    
    if subscription and subscription.get('effective_end_date'):
        end_date = datetime.fromisoformat(subscription['effective_end_date'].replace('Z', '+00:00'))
        default_message = f"Your subscription expires on {end_date.strftime('%Y-%m-%d')}. Please renew to continue enjoying Pro features. Contact support@interguide.app"
    
    message = request.message or default_message
    
    notification = {
        "id": notification_id,
        "user_id": user_id,
        "type": "payment_reminder",
        "title": "Payment Reminder",
        "message": message,
        "read": False,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=30)).isoformat()
    }
    
    await db.notifications.insert_one(notification)
    
    logging.info(f"[ADMIN] User {current_user.id} sent payment reminder to user {user_id}")
    
    return {
        "success": True,
        "user_id": user_id,
        "notification_id": notification_id,
        "message": message
    }

@api_router.get("/admin/users/{user_id}/subscription")
async def get_user_subscription_details(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """
    Get detailed subscription information for a user.
    Shows whether subscription is PayPal-managed or manual.
    Admin-only endpoint.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_id = user.get('subscription_id')
    if not subscription_id:
        return {
            "has_subscription": False,
            "user_id": user_id,
            "plan_name": "free"
        }
    
    subscription = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not subscription:
        return {
            "has_subscription": False,
            "user_id": user_id,
            "plan_name": "free"
        }
    
    # Get plan details
    plan_id = subscription.get('plan_id')
    plan = None
    if plan_id:
        plan = await db.plans.find_one({"id": plan_id}, {"_id": 0})
    
    # Check if PayPal-managed
    is_paypal_managed = bool(subscription.get('provider_subscription_id'))
    
    result = {
        "has_subscription": True,
        "user_id": user_id,
        "subscription": subscription,
        "plan": plan,
        "is_paypal_managed": is_paypal_managed,
        "can_edit": not is_paypal_managed,  # Can only edit manual subscriptions
        "provider_subscription_id": subscription.get('provider_subscription_id')
    }
    
    return result

@api_router.get("/admin/stats")
async def get_admin_stats(
    current_user: User = Depends(require_admin)
):
    """
    Get system-wide statistics.
    Admin-only endpoint.
    """
    # User stats
    total_users = await db.users.count_documents({})
    verified_users = await db.users.count_documents({"email_verified": True})
    admin_users = await db.users.count_documents({"role": UserRole.ADMIN.value})
    
    # Plan distribution
    plan_distribution = {}
    users_by_plan = await db.users.aggregate([
        {"$group": {"_id": "$plan_id", "count": {"$sum": 1}}}
    ]).to_list(100)
    
    for item in users_by_plan:
        plan_id = item.get("_id")
        if plan_id:
            plan = await db.plans.find_one({"id": plan_id}, {"_id": 0, "name": 1, "display_name": 1})
            if plan:
                plan_distribution[plan["name"]] = {
                    "display_name": plan["display_name"],
                    "count": item.get("count", 0)
                }
    
    # Subscription stats
    active_subscriptions = await db.subscriptions.count_documents({"status": SubscriptionStatus.ACTIVE.value})
    cancelled_subscriptions = await db.subscriptions.count_documents({"status": SubscriptionStatus.CANCELLED.value})
    pending_subscriptions = await db.subscriptions.count_documents({"status": SubscriptionStatus.PENDING.value})
    
    # Workspace stats
    total_workspaces = await db.workspaces.count_documents({})
    
    # Walkthrough stats
    total_walkthroughs = await db.walkthroughs.count_documents({})
    published_walkthroughs = await db.walkthroughs.count_documents({"status": WalkthroughStatus.PUBLISHED.value})
    
    # File stats
    total_files = await db.files.count_documents({})
    active_files = await db.files.count_documents({"status": FileStatus.ACTIVE})
    
    # Storage stats
    active_file_records = await db.files.find({"status": FileStatus.ACTIVE}, {"size_bytes": 1}).to_list(10000)
    total_storage = sum(f.get("size_bytes", 0) for f in active_file_records)
    
    return {
        "users": {
            "total": total_users,
            "verified": verified_users,
            "admins": admin_users,
            "unverified": total_users - verified_users
        },
        "plans": plan_distribution,
        "subscriptions": {
            "active": active_subscriptions,
            "cancelled": cancelled_subscriptions,
            "pending": pending_subscriptions,
            "total": active_subscriptions + cancelled_subscriptions + pending_subscriptions
        },
        "workspaces": {
            "total": total_workspaces
        },
        "walkthroughs": {
            "total": total_walkthroughs,
            "published": published_walkthroughs,
            "draft": total_walkthroughs - published_walkthroughs
        },
        "files": {
            "total": total_files,
            "active": active_files,
            "pending": await db.files.count_documents({"status": FileStatus.PENDING.value}),
            "failed": await db.files.count_documents({"status": FileStatus.FAILED.value})
        },
        "storage": {
            "total_bytes": total_storage,
            "total_gb": round(total_storage / (1024 ** 3), 2)
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ============================================================================
# ADDITIONAL ADMIN ENDPOINTS - Extended User Management
# ============================================================================

class SetCustomQuotaRequest(BaseModel):
    storage_bytes: Optional[int] = None
    max_workspaces: Optional[int] = None
    max_walkthroughs: Optional[int] = None

class SetGracePeriodRequest(BaseModel):
    grace_period_ends_at: Optional[datetime] = None

@api_router.put("/admin/users/{user_id}/disable")
async def disable_user(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """Disable user login. Admin-only endpoint."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"disabled": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logging.info(f"[ADMIN] User {current_user.id} disabled user {user_id}")
    return {"success": True, "user_id": user_id, "disabled": True}

@api_router.put("/admin/users/{user_id}/enable")
async def enable_user(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """Enable user login. Admin-only endpoint."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"disabled": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logging.info(f"[ADMIN] User {current_user.id} enabled user {user_id}")
    return {"success": True, "user_id": user_id, "disabled": False}

@api_router.put("/admin/users/{user_id}/verify-email")
async def verify_user_email(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """Manually verify user email. Admin-only endpoint."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"email_verified": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logging.info(f"[ADMIN] User {current_user.id} verified email for user {user_id}")
    return {"success": True, "user_id": user_id, "email_verified": True}

@api_router.put("/admin/users/{user_id}/unverify-email")
async def unverify_user_email(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """Manually unverify user email. Admin-only endpoint."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"email_verified": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logging.info(f"[ADMIN] User {current_user.id} unverified email for user {user_id}")
    return {"success": True, "user_id": user_id, "email_verified": False}

@api_router.put("/admin/users/{user_id}/soft-delete")
async def soft_delete_user(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """Soft delete user (marks as deleted but preserves data). Admin-only endpoint."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('deleted_at'):
        raise HTTPException(status_code=400, detail="User is already soft deleted")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "disabled": True,  # Also disable login
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logging.info(f"[ADMIN] User {current_user.id} soft deleted user {user_id}")
    return {"success": True, "user_id": user_id, "deleted_at": datetime.now(timezone.utc).isoformat()}

@api_router.put("/admin/users/{user_id}/restore")
async def restore_user(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """Restore a soft-deleted user. Admin-only endpoint."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get('deleted_at'):
        raise HTTPException(status_code=400, detail="User is not soft deleted")
    
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "disabled": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$unset": {
                "deleted_at": ""
            }
        }
    )
    
    logging.info(f"[ADMIN] User {current_user.id} restored user {user_id}")
    return {"success": True, "user_id": user_id, "message": "User restored successfully"}

@api_router.delete("/admin/users/{user_id}")
async def hard_delete_user(
    user_id: str,
    confirm: bool = Query(False, description="Must be True to confirm hard delete"),
    current_user: User = Depends(require_admin)
):
    """Hard delete user (permanently removes user and all associated data). Admin-only endpoint.
    Requires confirm=True query parameter for safety.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Hard delete requires confirm=true query parameter. This action cannot be undone."
        )
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Delete user's workspaces (cascade delete)
    workspace_ids = []
    async for workspace in db.workspaces.find({"owner_id": user_id}, {"_id": 0, "id": 1}):
        workspace_ids.append(workspace["id"])
    
    # Delete workspace memberships
    await db.workspace_members.delete_many({"user_id": user_id})
    
    # Delete workspaces (this will cascade delete walkthroughs, categories, etc. via existing logic)
    for workspace_id in workspace_ids:
        # Get all walkthroughs for file cleanup
        walkthroughs = await db.walkthroughs.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(10000)
        for walkthrough in walkthroughs:
            file_urls = await extract_file_urls_from_walkthrough(walkthrough)
            await delete_files_by_urls(file_urls, workspace_id)
        
        await db.walkthroughs.delete_many({"workspace_id": workspace_id})
        await db.walkthrough_versions.delete_many({"workspace_id": workspace_id})
        await db.categories.delete_many({"workspace_id": workspace_id})
        await db.workspaces.delete_one({"id": workspace_id})
    
    # Delete user's files
    await db.files.delete_many({"user_id": user_id})
    
    # Delete user's subscriptions
    await db.subscriptions.delete_many({"user_id": user_id})
    
    # Delete user's notifications
    await db.notifications.delete_many({"user_id": user_id})
    
    # Delete workspace locks held by user
    await db.workspace_locks.delete_many({"locked_by_user_id": user_id})
    
    # Finally, delete the user
    await db.users.delete_one({"id": user_id})
    
    logging.warning(f"[ADMIN] User {current_user.id} HARD DELETED user {user_id} and all associated data")
    return {"success": True, "user_id": user_id, "message": "User and all associated data permanently deleted"}

@api_router.put("/admin/users/{user_id}/quota")
async def set_custom_quota(
    user_id: str,
    request: SetCustomQuotaRequest,
    current_user: User = Depends(require_admin)
):
    """Set custom quota overrides for user. Admin-only endpoint.
    Set to None to remove override and use plan defaults.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if request.storage_bytes is not None:
        update_fields["custom_storage_bytes"] = request.storage_bytes
    if request.max_workspaces is not None:
        update_fields["custom_max_workspaces"] = request.max_workspaces
    if request.max_walkthroughs is not None:
        update_fields["custom_max_walkthroughs"] = request.max_walkthroughs
    
    await db.users.update_one({"id": user_id}, {"$set": update_fields})
    
    logging.info(f"[ADMIN] User {current_user.id} set custom quotas for user {user_id}: {update_fields}")
    return {"success": True, "user_id": user_id, "custom_quotas": update_fields}

@api_router.put("/admin/users/{user_id}/grace-period")
async def set_grace_period(
    user_id: str,
    request: SetGracePeriodRequest,
    current_user: User = Depends(require_admin)
):
    """Set grace period end date for user. Admin-only endpoint.
    Set to None to remove grace period.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    grace_ends_at_iso = None
    if request.grace_period_ends_at:
        grace_ends_at_iso = request.grace_period_ends_at.isoformat()
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "grace_period_ends_at": grace_ends_at_iso,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logging.info(f"[ADMIN] User {current_user.id} set grace period for user {user_id} until {grace_ends_at_iso}")
    return {"success": True, "user_id": user_id, "grace_period_ends_at": grace_ends_at_iso}

@api_router.put("/admin/users/{user_id}/plan/downgrade")
async def force_downgrade_to_free(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """Force downgrade user to Free plan immediately. Admin-only endpoint.
    Applies Free plan quotas immediately.
    SECURITY INVARIANT: Freezes all workspace memberships on downgrade.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    free_plan = await db.plans.find_one({"name": "free"}, {"_id": 0})
    if not free_plan:
        raise HTTPException(status_code=500, detail="Free plan not found")
    
    now = datetime.now(timezone.utc)
    
    # SECURITY INVARIANT: Freeze all workspace memberships before downgrading
    # This ensures frozen memberships cannot grant access after downgrade
    frozen_count = await db.workspace_members.update_many(
        {
            "user_id": user_id,
            "status": InvitationStatus.ACCEPTED
        },
        {
            "$set": {
                "status": InvitationStatus.PENDING,  # Suspend by setting to PENDING
                "frozen_at": now.isoformat(),
                "frozen_reason": "admin_downgrade"  # Track admin-initiated freeze
            }
        }
    )
    
    # Update user plan
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "plan_id": free_plan["id"],
            "grace_period_ends_at": None,  # Clear grace period
            "updated_at": now.isoformat()
        }}
    )
    
    # Cancel any active subscriptions
    subscription_id = user.get('subscription_id')
    if subscription_id:
        await db.subscriptions.update_one(
            {"id": subscription_id},
            {"$set": {
                "status": SubscriptionStatus.CANCELLED.value,
                "cancelled_at": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )

    # Deactivate all non-PayPal subscriptions for this user
    await db.subscriptions.update_many(
        {
            "user_id": user_id,
            "provider": {"$ne": "paypal"},
            "status": {"$ne": SubscriptionStatus.CANCELLED.value}
        },
        {"$set": {
            "status": SubscriptionStatus.CANCELLED.value,
            "cancelled_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    logging.info(
        f"[ADMIN] User {current_user.id} force downgraded user {user_id} to Free plan. "
        f"Frozen {frozen_count.modified_count} workspace memberships."
    )
    return {"success": True, "user_id": user_id, "plan_name": "free", "plan_id": free_plan["id"]}

@api_router.put("/admin/users/{user_id}/plan/upgrade")
async def force_upgrade_to_pro(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """Force upgrade user to Pro plan immediately. Admin-only endpoint.
    SECURITY INVARIANT: Restores frozen workspace memberships on upgrade.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    pro_plan = await db.plans.find_one({"name": "pro"}, {"_id": 0})
    if not pro_plan:
        raise HTTPException(status_code=500, detail="Pro plan not found")
    
    now = datetime.now(timezone.utc)
    
    # Update user plan
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "plan_id": pro_plan["id"],
            "updated_at": now.isoformat()
        }}
    )
    
    # Create or update subscription to Pro
    subscription_id = user.get('subscription_id')
    if subscription_id:
        # Update existing subscription
        await db.subscriptions.update_one(
            {"id": subscription_id},
            {"$set": {
                "plan_id": pro_plan["id"],
                "status": SubscriptionStatus.ACTIVE.value,
                "updated_at": now.isoformat()
            }}
        )
    else:
        # Create new manual subscription
        subscription_id = str(uuid.uuid4())
        subscription = Subscription(
            id=subscription_id,
            user_id=user_id,
            plan_id=pro_plan["id"],
            status=SubscriptionStatus.ACTIVE,
            provider="manual"
        )
        sub_dict = subscription.model_dump()
        sub_dict['started_at'] = sub_dict['started_at'].isoformat()
        sub_dict['created_at'] = sub_dict['created_at'].isoformat()
        sub_dict['updated_at'] = sub_dict['updated_at'].isoformat()
        await db.subscriptions.insert_one(sub_dict)
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"subscription_id": subscription_id}}
        )
    
    # SECURITY INVARIANT: Restore frozen workspace memberships on upgrade
    # Restore memberships that were frozen due to subscription expiration or admin downgrade
    restored_count = await db.workspace_members.update_many(
        {
            "user_id": user_id,
            "status": InvitationStatus.PENDING,
            "frozen_reason": {"$in": ["subscription_expired", "admin_downgrade"]}
        },
        {
            "$set": {
                "status": InvitationStatus.ACCEPTED,  # Restore to ACCEPTED
                "restored_at": now.isoformat()
            },
            "$unset": {
                "frozen_at": "",
                "frozen_reason": ""
            }
        }
    )
    
    if restored_count.modified_count > 0:
        logging.info(
            f"[ADMIN] User {current_user.id} force upgraded user {user_id} to Pro plan. "
            f"Restored {restored_count.modified_count} workspace memberships."
        )
    else:
        logging.info(f"[ADMIN] User {current_user.id} force upgraded user {user_id} to Pro plan")
    
    return {"success": True, "user_id": user_id, "plan_name": "pro", "plan_id": pro_plan["id"], "subscription_id": subscription_id}

async def verify_security_invariants():
    """
    Regression guards: Verify critical security invariants at startup.
    Fail-fast if any invariant is violated.
    """
    # Guard 1: Verify check_workspace_access() exists and is callable
    if not callable(check_workspace_access):
        error_msg = "SECURITY INVARIANT VIOLATION: check_workspace_access() is not callable"
        logging.critical(error_msg)
        raise RuntimeError(error_msg)
    
    # Guard 2: Verify get_current_user() exists and is callable
    if not callable(get_current_user):
        error_msg = "SECURITY INVARIANT VIOLATION: get_current_user() is not callable"
        logging.critical(error_msg)
        raise RuntimeError(error_msg)
    
    # Guard 3: Verify can_user_share_workspaces() exists and is callable
    if not callable(can_user_share_workspaces):
        error_msg = "SECURITY INVARIANT VIOLATION: can_user_share_workspaces() is not callable"
        logging.critical(error_msg)
        raise RuntimeError(error_msg)
    
    # Guard 4: Verify critical functions have required parameters
    import inspect
    
    # Verify check_workspace_access signature
    check_sig = inspect.signature(check_workspace_access)
    required_params = ['workspace_id', 'user_id']
    for param in required_params:
        if param not in check_sig.parameters:
            error_msg = f"SECURITY INVARIANT VIOLATION: check_workspace_access() missing parameter: {param}"
            logging.critical(error_msg)
            raise RuntimeError(error_msg)
    
    # Verify get_current_user signature
    user_sig = inspect.signature(get_current_user)
    if 'credentials' not in user_sig.parameters:
        error_msg = "SECURITY INVARIANT VIOLATION: get_current_user() missing credentials parameter"
        logging.critical(error_msg)
        raise RuntimeError(error_msg)
    
    logging.info("[SECURITY] All security invariants verified at startup")

async def scheduled_reconciliation_job():
    """
    PRODUCTION HARDENING: Daily reconciliation safety net
    
    Reconciles all subscriptions in non-terminal-for-access states.
    Ensures eventual consistency even if webhooks fail.
    
    Runs daily at 03:00 UTC (low traffic period).
    """
    import asyncio
    
    while True:
        try:
            # Wait 24 hours between runs
            # First run: wait until 03:00 UTC
            now = datetime.now(timezone.utc)
            target_time = now.replace(hour=3, minute=0, second=0, microsecond=0)
            if target_time <= now:
                target_time += timedelta(days=1)
            
            wait_seconds = (target_time - now).total_seconds()
            logging.info(f"[SCHEDULED_RECONCILE] Next run in {wait_seconds/3600:.1f} hours at {target_time.isoformat()}")
            await asyncio.sleep(wait_seconds)
            
            # KILL SWITCH: Check if scheduled reconciliation is enabled
            if not kill_switch.scheduled_reconciliation_enabled:
                logging.warning("[SCHEDULED_RECONCILE] Skipped (disabled by kill switch)")
                continue
            
            # Run reconciliation for all non-terminal subscriptions
            logging.info("[SCHEDULED_RECONCILE] Starting daily reconciliation job")
            await metrics.increment('scheduled_reconcile_run')
            
            # Find all PayPal subscriptions not in terminal-for-access states
            # Terminal-for-access: EXPIRED, SUSPENDED (no timestamps can grant access)
            # Non-terminal: ACTIVE, CANCELLED, PENDING, APPROVAL_PENDING
            subscriptions = await db.subscriptions.find(
                {
                    "provider": "paypal",
                    "status": {"$nin": [SubscriptionStatus.EXPIRED, SubscriptionStatus.SUSPENDED]}
                },
                {"id": 1, "user_id": 1, "status": 1, "_id": 0}
            ).to_list(10000)
            
            total = len(subscriptions)
            success_count = 0
            error_count = 0
            
            logging.info(f"[SCHEDULED_RECONCILE] Found {total} subscriptions to reconcile")
            
            for sub in subscriptions:
                try:
                    result = await reconcile_subscription_with_paypal(sub['id'], force=False)
                    if result.get("success"):
                        success_count += 1
                        if not result.get("access_granted") and result.get("is_terminal_for_polling"):
                            logging.info(
                                f"[SCHEDULED_RECONCILE] Subscription {sub['id']} reconciled: "
                                f"terminal, no access"
                            )
                    else:
                        error_count += 1
                        logging.error(
                            f"[SCHEDULED_RECONCILE] Failed to reconcile subscription {sub['id']}: "
                            f"{result.get('error')}"
                        )
                    
                    # Rate limiting: 100ms between reconciliations (max 600/min)
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    error_count += 1
                    logging.error(f"[SCHEDULED_RECONCILE] Error reconciling subscription {sub['id']}: {e}")
            
            logging.info(
                f"[SCHEDULED_RECONCILE] Completed: {total} total, "
                f"{success_count} success, {error_count} errors"
            )
            
        except Exception as e:
            logging.error(f"[SCHEDULED_RECONCILE] Job error: {e}", exc_info=True)
            # Continue loop even on error
            await asyncio.sleep(3600)  # Wait 1 hour before retry on error

@app.on_event("startup")
async def startup_event():
    """Initialize default plans and ensure workspace lock index on startup."""
    await initialize_default_plans()
    
    # Start scheduled reconciliation job in background
    import asyncio
    asyncio.create_task(scheduled_reconciliation_job())
    
    # CRITICAL: Ensure unique index exists for workspace locks
    # This provides database-level enforcement of lock uniqueness
    index_created = await ensure_workspace_lock_index()
    
    # Clean up any duplicate locks that existed before the index
    # This is a one-time operation - duplicates cannot exist after index is created
    if index_created:
        await cleanup_duplicate_workspace_locks()
    logging.info("Default plans initialized")
    
    # SECURITY: Verify critical invariants at startup
    await verify_security_invariants()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Include router at the END, after all routes are defined
# This ensures all routes (including admin routes) are registered
app.include_router(api_router)
