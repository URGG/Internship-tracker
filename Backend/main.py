import os
import logging
import requests
import secrets
import time
from datetime import date, datetime, timedelta, timezone
from typing import Optional, List
import re
import uuid
from html import unescape
from ipaddress import ip_address
from pathlib import Path
from socket import getaddrinfo
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse
from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey, Text, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import jwt
import bcrypt
from cryptography.fernet import Fernet
from cryptography.fernet import InvalidToken
from dotenv import load_dotenv
import json

logger = logging.getLogger("intern_track")
if not logger.handlers:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s")

try:
    import stripe
except ImportError:
    stripe = None

try:
    from google import genai as google_genai
    from google.genai import types as google_genai_types
except ImportError:
    google_genai = None
    google_genai_types = None

legacy_genai = None

BACKEND_DIR = Path(__file__).resolve().parent
# Load the backend environment next to this file so both
# `uvicorn main:app` and `uvicorn Backend.main:app` work.
load_dotenv(BACKEND_DIR / ".env")

JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
DATABASE_URL_HINT = (os.getenv("DATABASE_URL") or "").lower()
DEFAULT_APP_ENV = "production" if (
    os.getenv("RENDER", "").lower() == "true"
    or DATABASE_URL_HINT.startswith(("postgres://", "postgresql://"))
) else "development"
APP_ENV = (os.getenv("APP_ENV") or os.getenv("ENVIRONMENT") or DEFAULT_APP_ENV).lower()
try:
    JWT_TTL_DAYS = max(1, int(os.getenv("JWT_TTL_DAYS", "7")))
except (TypeError, ValueError):
    JWT_TTL_DAYS = 7

if not JWT_SECRET or not ENCRYPTION_KEY:
    raise RuntimeError("CRITICAL: Missing JWT_SECRET or ENCRYPTION_KEY in .env file.")

if APP_ENV == "production" and len(JWT_SECRET) < 32:
    raise RuntimeError("CRITICAL: JWT_SECRET must be at least 32 characters in production.")

try:
    cipher_suite = Fernet(ENCRYPTION_KEY.encode())
except Exception as exc:
    raise RuntimeError("CRITICAL: ENCRYPTION_KEY must be a valid Fernet key.") from exc

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
SERVER_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRO_MONTHLY_PRICE_ID = os.getenv("STRIPE_PRO_MONTHLY_PRICE_ID")
STRIPE_LIFETIME_PRICE_ID = os.getenv("STRIPE_LIFETIME_PRICE_ID")
SERVER_RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY")
TURNSTILE_EXPECTED_HOSTNAME = os.getenv("TURNSTILE_EXPECTED_HOSTNAME")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
CORS_ORIGINS = os.getenv("CORS_ORIGINS")

if APP_ENV == "production" and FRONTEND_URL.startswith(("http://localhost", "http://127.0.0.1")):
    raise RuntimeError("CRITICAL: FRONTEND_URL must be your deployed frontend URL in production.")

def parse_csv_env(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]

allowed_origins = parse_csv_env(CORS_ORIGINS)
if FRONTEND_URL and FRONTEND_URL not in allowed_origins:
    allowed_origins.append(FRONTEND_URL)
if APP_ENV != "production":
    for local_origin in ["http://localhost:5173", "http://127.0.0.1:5173"]:
        if local_origin not in allowed_origins:
            allowed_origins.append(local_origin)

if stripe and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if APP_ENV == "production" and not SQLALCHEMY_DATABASE_URL:
    raise RuntimeError("CRITICAL: DATABASE_URL is required in production.")

if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
    # SQLAlchemy 2.1 defaults bare PostgreSQL URLs to psycopg (v3), while
    # this project installs psycopg2-binary for Render compatibility.
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
elif SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgresql+psycopg://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)

if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith(("postgresql://", "postgresql+")) and "sslmode=" not in SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL += "&sslmode=require" if "?" in SQLALCHEMY_DATABASE_URL else "?sslmode=require"

if not SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{(BACKEND_DIR / 'intern_tracker.db').as_posix()}"

if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, pool_pre_ping=True)
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    plan = Column(String, default="free")
    created_at = Column(String, nullable=False)

class OrganizationMember(Base):
    __tablename__ = "organization_members"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    role = Column(String, default="member")
    status = Column(String, default="active")
    created_at = Column(String, nullable=False)

class OrganizationInvitation(Base):
    __tablename__ = "organization_invitations"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=False)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    email = Column(String, nullable=False, index=True)
    role = Column(String, default="member")
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(String, nullable=False)
    accepted_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String)
    enc_rapid_key = Column(String, nullable=True)
    enc_gemini_key = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    plan = Column(String, default="free")
    subscription_status = Column(String, default="free")
    current_period_end = Column(String, nullable=True)
    profile_json = Column(Text, nullable=True)

class JobApplication(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    company = Column(String, index=True)
    role = Column(String)
    status = Column(String, default="To Do")
    source = Column(String)
    applied_date = Column(String, nullable=True)
    deadline = Column(String, nullable=True)
    location = Column(String, nullable=True)
    remote = Column(Boolean, default=False)
    link = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    recruiter_name = Column(String, nullable=True)
    recruiter_email = Column(String, nullable=True)
    referral_name = Column(String, nullable=True)
    interview_stage = Column(String, nullable=True)
    next_action_date = Column(String, nullable=True)
    follow_up_sent = Column(Boolean, default=False)
    last_contact_date = Column(String, nullable=True)
    resume_version = Column(String, nullable=True)
    cover_letter_version = Column(String, nullable=True)
    application_packet = Column(Text, nullable=True)
    activity_log = Column(Text, nullable=True)

class SearchSubscription(Base):
    __tablename__ = "search_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=True)
    query = Column(String)
    location = Column(String)
    job_type = Column(String, default="INTERN")

class UsageEvent(Base):
    __tablename__ = "usage_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=True)
    feature = Column(String, index=True)
    created_at = Column(String, index=True)
    category = Column(String, default="ai", index=True)
    units = Column(Integer, default=1, nullable=False)
    provider = Column(String, nullable=True)
    request_id = Column(String, nullable=True, index=True)
    details = Column(Text, nullable=True)

class ApplicationEvent(Base):
    __tablename__ = "application_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=True)
    # This intentionally is not a cascading foreign key. A deletion event should
    # remain available in the audit trail after the application is removed.
    application_id = Column(Integer, index=True, nullable=True)
    event_type = Column(String, index=True, nullable=False)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=True)
    occurred_at = Column(String, index=True, nullable=False)
    effective_date = Column(String, index=True, nullable=True)
    details = Column(Text, nullable=True)

VALID_STATUSES = {"To Do", "Applied", "Interview", "Offer", "Rejected"}
VALID_INTERVIEW_STAGES = {"", "Online Assessment", "Recruiter Screen", "Technical", "Behavioral", "Final Round", "Take Home"}
VALID_JOB_TYPES = {"", "INTERN", "FULLTIME", "PARTTIME", "CONTRACTOR"}
VALID_DATE_POSTED = {"", "today", "3days", "week", "month"}
STATUS_ALIASES = {"Phone Screen": "Interview"}
INTERVIEW_STAGE_ALIASES = {"Phone Screen": "Recruiter Screen"}

def parse_int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default

AI_MONTHLY_LIMITS = {
    "free": 0,
    "pro": parse_int_env("PRO_AI_MONTHLY_LIMIT", 200),
    "lifetime": parse_int_env("LIFETIME_AI_MONTHLY_LIMIT", 300),
}

class UserAuth(BaseModel):
    username: Optional[str] = None
    password: str
    email: Optional[str] = None
    turnstile_token: Optional[str] = None

class KeysUpdate(BaseModel):
    rapid_key: Optional[str] = None
    gemini_key: Optional[str] = None

class CandidateProfile(BaseModel):
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    zip_code: Optional[str] = ""
    country: Optional[str] = ""
    linkedin_url: Optional[str] = ""
    portfolio_url: Optional[str] = ""
    github_url: Optional[str] = ""
    school: Optional[str] = ""
    degree: Optional[str] = ""
    major: Optional[str] = ""
    graduation_date: Optional[str] = ""
    gpa: Optional[str] = ""
    work_authorization: Optional[str] = ""
    sponsorship: Optional[str] = ""
    salary_expectation: Optional[str] = ""
    why_company: Optional[str] = ""
    why_role: Optional[str] = ""
    additional_information: Optional[str] = ""
    resume_text: Optional[str] = ""

class SubscriptionCreate(BaseModel):
    query: str
    location: str
    job_type: str

class CheckoutRequest(BaseModel):
    plan: str

class JobCreate(BaseModel):
    company: str
    role: str
    status: str
    source: str
    applied_date: Optional[str] = None
    deadline: Optional[str] = None
    location: Optional[str] = None
    remote: bool = False
    link: Optional[str] = None
    notes: Optional[str] = None
    recruiter_name: Optional[str] = None
    recruiter_email: Optional[str] = None
    referral_name: Optional[str] = None
    interview_stage: Optional[str] = None
    next_action_date: Optional[str] = None
    follow_up_sent: bool = False
    last_contact_date: Optional[str] = None
    resume_version: Optional[str] = None
    cover_letter_version: Optional[str] = None
    application_packet: Optional[str] = None
    activity_log: Optional[str] = None

class JobImportRequest(BaseModel):
    jobs: List[JobCreate]

class WorkspaceCreate(BaseModel):
    name: str

class WorkspaceMemberAdd(BaseModel):
    username: str
    role: str = "member"

class WorkspaceInviteCreate(BaseModel):
    email: str
    role: str = "member"

class WorkspaceInviteAccept(BaseModel):
    token: str

class WorkspaceRoleUpdate(BaseModel):
    role: str

class CoverRequest(BaseModel):
    company: str
    role: str
    description: str
    context: str

class IntelRequest(BaseModel):
    company: str
    role: str

class AutofillRequest(BaseModel):
    url: str

class ResumeMatchRequest(BaseModel):
    company: str
    role: str
    description: str
    context: str

class FollowUpRequest(BaseModel):
    company: str
    role: str
    status: str
    recruiter_name: Optional[str] = None
    last_contact_date: Optional[str] = None
    next_action_date: Optional[str] = None
    notes: Optional[str] = None
    context: str

class ApplicationPacketRequest(BaseModel):
    application_id: Optional[int] = None
    company: str
    role: str
    description: str
    context: str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_request_metadata(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled request error method=%s path=%s request_id=%s", request.method, request.url.path, request_id)
        raise
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def ensure_job_application_columns():
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns("applications")} if inspector.has_table("applications") else set()
    additions = {
        "recruiter_name": "VARCHAR",
        "recruiter_email": "VARCHAR",
        "referral_name": "VARCHAR",
        "interview_stage": "VARCHAR",
        "next_action_date": "VARCHAR",
        "follow_up_sent": "BOOLEAN DEFAULT FALSE",
        "last_contact_date": "VARCHAR",
        "resume_version": "VARCHAR",
        "cover_letter_version": "VARCHAR",
        "application_packet": "TEXT",
        "activity_log": "TEXT",
    }

    if not existing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in additions.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(f"ALTER TABLE applications ADD COLUMN {column_name} {column_type}"))

def ensure_user_columns():
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns("users")} if inspector.has_table("users") else set()
    additions = {
        "email": "VARCHAR",
        "stripe_customer_id": "VARCHAR",
        "stripe_subscription_id": "VARCHAR",
        "plan": "VARCHAR DEFAULT 'free'",
        "subscription_status": "VARCHAR DEFAULT 'free'",
        "current_period_end": "VARCHAR",
        "profile_json": "TEXT",
    }

    if not existing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in additions.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"))

def ensure_workspace_columns():
    table_columns = {
        "applications": {"organization_id": "INTEGER"},
        "search_subscriptions": {"organization_id": "INTEGER"},
        "usage_events": {"organization_id": "INTEGER"},
        "application_events": {"organization_id": "INTEGER"},
    }
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table_name, additions in table_columns.items():
            if not inspector.has_table(table_name):
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in additions.items():
                if column_name not in existing_columns:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))

def ensure_usage_event_columns():
    inspector = inspect(engine)
    if not inspector.has_table("usage_events"):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("usage_events")}
    additions = {
        "category": "VARCHAR DEFAULT 'ai'",
        "units": "INTEGER DEFAULT 1",
        "provider": "VARCHAR",
        "request_id": "VARCHAR",
        "details": "TEXT",
    }

    with engine.begin() as connection:
        for column_name, column_type in additions.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE usage_events ADD COLUMN {column_name} {column_type}"))
        connection.execute(text("UPDATE usage_events SET category = 'ai' WHERE category IS NULL"))
        connection.execute(text("UPDATE usage_events SET units = 1 WHERE units IS NULL"))

def ensure_production_indexes():
    statements = [
        "CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)",
        "CREATE INDEX IF NOT EXISTS ix_organizations_slug ON organizations (slug)",
        "CREATE INDEX IF NOT EXISTS ix_organization_members_org_user ON organization_members (organization_id, user_id)",
        "CREATE INDEX IF NOT EXISTS ix_organization_invitations_token ON organization_invitations (token)",
        "CREATE INDEX IF NOT EXISTS ix_application_events_user_type_date ON application_events (user_id, event_type, effective_date)",
        "CREATE INDEX IF NOT EXISTS ix_usage_events_user_category_date ON usage_events (user_id, category, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_applications_user_status ON applications (user_id, status)",
        "CREATE INDEX IF NOT EXISTS ix_applications_organization_status ON applications (organization_id, status)",
        "CREATE INDEX IF NOT EXISTS ix_usage_events_organization_category_date ON usage_events (organization_id, category, created_at)",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

def migrate_removed_phone_screen_stage():
    inspector = inspect(engine)
    if not inspector.has_table("applications"):
        return

    with engine.begin() as connection:
        connection.execute(
            text("UPDATE applications SET status = :new_status WHERE status = :old_status"),
            {"new_status": "Interview", "old_status": "Phone Screen"},
        )
        connection.execute(
            text("UPDATE applications SET interview_stage = :new_stage WHERE interview_stage = :old_stage"),
            {"new_stage": "Recruiter Screen", "old_stage": "Phone Screen"},
        )

Base.metadata.create_all(bind=engine)
ensure_job_application_columns()
ensure_user_columns()
ensure_workspace_columns()
ensure_usage_event_columns()
migrate_removed_phone_screen_stage()
ensure_production_indexes()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None: raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.username == username).first()
    if user is None: raise HTTPException(status_code=401, detail="User not found")
    return user

WORKSPACE_ROLES = {"owner", "admin", "member", "viewer"}
MANAGE_WORKSPACE_ROLES = {"owner", "admin"}
EDIT_WORKSPACE_ROLES = {"owner", "admin", "member"}

def normalize_email(value: Optional[str]) -> Optional[str]:
    email = (value or "").strip().lower()
    if not email:
        return None
    if len(email) > 320 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    return email

def auth_identifier(user: UserAuth) -> str:
    identifier = (user.email or user.username or "").strip().lower()
    if not identifier:
        raise HTTPException(status_code=400, detail="Email or username is required")
    return identifier

def workspace_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:70]
    return slug or "workspace"

def ensure_default_workspace(db: Session, current_user: User) -> Organization:
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.status == "active",
    ).order_by(OrganizationMember.id.asc()).first()
    if membership:
        return db.query(Organization).filter(Organization.id == membership.organization_id).first()

    base_slug = workspace_slug(f"{current_user.username}-workspace")
    slug = base_slug
    suffix = 2
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{suffix}"
        suffix += 1
    workspace = Organization(
        name=f"{current_user.username}'s Workspace",
        slug=slug,
        owner_id=current_user.id,
        plan=normalize_plan(current_user.plan),
        created_at=utc_now_iso(),
    )
    db.add(workspace)
    db.flush()
    db.add(OrganizationMember(
        organization_id=workspace.id,
        user_id=current_user.id,
        role="owner",
        status="active",
        created_at=utc_now_iso(),
    ))
    for model in (JobApplication, SearchSubscription, UsageEvent, ApplicationEvent):
        db.query(model).filter(
            model.user_id == current_user.id,
            model.organization_id.is_(None),
        ).update({model.organization_id: workspace.id}, synchronize_session=False)
    db.commit()
    return workspace

def get_current_workspace(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    default_workspace = ensure_default_workspace(db, current_user)
    requested_id = (request.headers.get("X-Workspace-ID") or "").strip()
    workspace_id = int(requested_id) if requested_id.isdigit() else default_workspace.id
    path_workspace_id = request.path_params.get("workspace_id")
    if path_workspace_id is not None and int(path_workspace_id) != workspace_id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == workspace_id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.status == "active",
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="You do not have access to this workspace")
    workspace = db.query(Organization).filter(Organization.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    request.state.workspace_role = membership.role
    return workspace

def get_workspace_role(db: Session, workspace_id: int, user_id: int) -> str:
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == workspace_id,
        OrganizationMember.user_id == user_id,
        OrganizationMember.status == "active",
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="You do not have access to this workspace")
    return membership.role

def require_workspace_role(db: Session, workspace: Organization, user_id: int, allowed_roles):
    role = get_workspace_role(db, workspace.id, user_id)
    if role not in allowed_roles:
        raise HTTPException(status_code=403, detail="You do not have permission to manage this workspace")
    return role

def verify_turnstile(token: Optional[str], request: Request, action: str):
    if not TURNSTILE_SECRET_KEY:
        return
    if not token:
        raise HTTPException(status_code=400, detail="Verification required. Please complete the security check and try again.")
    payload = {
        "secret": TURNSTILE_SECRET_KEY,
        "response": token,
    }
    if request.client and request.client.host:
        payload["remoteip"] = request.client.host
    try:
        response = requests.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", data=payload, timeout=5)
        response.raise_for_status()
        result = response.json()
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Security verification is temporarily unavailable. Try again shortly.")
    if not result.get("success"):
        logger.warning("Turnstile verification failed action=%s errors=%s", action, result.get("error-codes"))
        raise HTTPException(status_code=400, detail="Security verification failed. Please try again.")
    if TURNSTILE_EXPECTED_HOSTNAME and result.get("hostname") != TURNSTILE_EXPECTED_HOSTNAME:
        raise HTTPException(status_code=400, detail="Security verification hostname mismatch.")
    if result.get("action") and result.get("action") != action:
        raise HTTPException(status_code=400, detail="Security verification action mismatch.")

def require_stripe():
    if stripe is None:
        raise HTTPException(status_code=500, detail="Stripe dependency is not installed")
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe secret key is not configured")

def get_checkout_plan(plan: str):
    plans = {
        "pro_monthly": {
            "price_id": STRIPE_PRO_MONTHLY_PRICE_ID,
            "mode": "subscription",
            "app_plan": "pro",
        },
        "lifetime": {
            "price_id": STRIPE_LIFETIME_PRICE_ID,
            "mode": "payment",
            "app_plan": "lifetime",
        },
    }
    checkout_plan = plans.get(plan)
    if not checkout_plan:
        raise HTTPException(status_code=400, detail="Unknown checkout plan")
    if not checkout_plan["price_id"]:
        raise HTTPException(status_code=500, detail=f"Stripe price ID is not configured for {plan}")
    return checkout_plan

def stripe_object_to_dict(value):
    if hasattr(value, "to_dict_recursive"):
        return value.to_dict_recursive()
    return value

def is_subscription_active(status: Optional[str]) -> bool:
    return status in {"active", "trialing"}

def format_stripe_timestamp(value):
    if not value:
        return None
    return datetime.fromtimestamp(value, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def sync_user_subscription_from_stripe(user: User, subscription):
    # Lifetime access is permanent. A delayed webhook for an older or
    # unrelated subscription must not downgrade that entitlement.
    if normalize_plan(user.plan) == "lifetime":
        return
    data = stripe_object_to_dict(subscription)
    user.stripe_subscription_id = data.get("id")
    user.subscription_status = data.get("status") or "unknown"
    user.current_period_end = format_stripe_timestamp(data.get("current_period_end"))
    user.plan = "pro" if is_subscription_active(user.subscription_status) else "free"

def grant_lifetime_access(user: User):
    user.plan = "lifetime"
    user.subscription_status = "active"
    user.stripe_subscription_id = None
    user.current_period_end = None

def sync_user_subscription_by_id(db: Session, subscription_id: Optional[str]):
    if not subscription_id:
        return None
    subscription = stripe.Subscription.retrieve(subscription_id)
    user = find_user_for_stripe_event(db, subscription)
    if user:
        sync_user_subscription_from_stripe(user, subscription)
        db.commit()
    return user

def get_invoice_subscription_id(invoice: dict) -> Optional[str]:
    subscription_id = invoice.get("subscription")
    if subscription_id:
        return subscription_id
    subscription_details = invoice.get("subscription_details") or {}
    return subscription_details.get("subscription")

def find_user_for_stripe_event(db: Session, event_object):
    data = stripe_object_to_dict(event_object)
    user_id = data.get("client_reference_id") or (data.get("metadata") or {}).get("user_id")
    if user_id:
        try:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                return user
        except (TypeError, ValueError):
            pass

    customer_id = data.get("customer")
    if customer_id:
        return db.query(User).filter(User.stripe_customer_id == customer_id).first()
    return None

def load_activity_log(value: Optional[str]):
    if not value:
        return []
    try:
        data = json.loads(value)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []

def append_activity(existing_log: Optional[str], message: str):
    entries = load_activity_log(existing_log)
    entries.append({
        "message": message,
        "timestamp": utc_now_iso(),
    })
    return json.dumps(entries[-50:])

def utc_now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def add_usage_event(
    db: Session,
    user_id: int,
    feature: str,
    category: str = "product",
    units: int = 1,
    provider: Optional[str] = None,
    request_id: Optional[str] = None,
    details: Optional[dict] = None,
    organization_id: Optional[int] = None,
):
    db.add(UsageEvent(
        user_id=user_id,
        organization_id=organization_id,
        feature=feature,
        category=category,
        units=max(1, int(units or 1)),
        provider=provider,
        request_id=request_id,
        details=json.dumps(details or {}, separators=(",", ":")),
        created_at=utc_now_iso(),
    ))

def request_id_for(request: Optional[Request]):
    return getattr(getattr(request, "state", None), "request_id", None)

def add_application_event(
    db: Session,
    user_id: int,
    application_id: Optional[int],
    event_type: str,
    from_status: Optional[str] = None,
    to_status: Optional[str] = None,
    effective_date: Optional[str] = None,
    details: Optional[dict] = None,
    organization_id: Optional[int] = None,
):
    db.add(ApplicationEvent(
        user_id=user_id,
        organization_id=organization_id,
        application_id=application_id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        occurred_at=utc_now_iso(),
        effective_date=effective_date or str(date.today()),
        details=json.dumps(details or {}, separators=(",", ":")),
    ))

def add_initial_application_events(db: Session, user_id: int, job: JobApplication):
    effective_date = job.applied_date if job.status != "To Do" else str(date.today())
    event_scope = {"organization_id": job.organization_id}
    add_application_event(
        db, user_id, job.id, "application_created", to_status=job.status,
        effective_date=effective_date,
        details={"company": job.company, "role": job.role, "source": job.source},
        **event_scope,
    )
    if job.status != "To Do" and job.applied_date:
        add_application_event(
            db, user_id, job.id, "application_submitted", to_status=job.status,
            effective_date=job.applied_date,
            details={"company": job.company, "role": job.role, "source": job.source},
            **event_scope,
        )
    if job.status in {"Interview", "Offer", "Rejected"} or job.last_contact_date:
        add_application_event(
            db, user_id, job.id, "response_recorded", to_status=job.status,
            effective_date=job.last_contact_date or str(date.today()),
            details={"source": "existing_record"},
            **event_scope,
        )
    if job.status == "Interview":
        add_application_event(db, user_id, job.id, "interview_reached", to_status=job.status, effective_date=job.last_contact_date or str(date.today()), **event_scope)
    if job.status == "Offer":
        add_application_event(db, user_id, job.id, "offer_received", to_status=job.status, effective_date=job.last_contact_date or str(date.today()), **event_scope)
    if job.status == "Rejected":
        add_application_event(db, user_id, job.id, "rejected", to_status=job.status, effective_date=job.last_contact_date or str(date.today()), **event_scope)

def ensure_application_event_backfill(db: Session):
    jobs = db.query(JobApplication).all()
    if not jobs:
        return
    existing_ids = {
        event.application_id
        for event in db.query(ApplicationEvent).filter(ApplicationEvent.event_type == "application_created").all()
        if event.application_id is not None
    }
    changed = False
    for job in jobs:
        if job.id in existing_ids:
            continue
        add_initial_application_events(db, job.user_id, job)
        changed = True
    if changed:
        db.commit()

def model_to_dict(model: BaseModel):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()

TRACKING_QUERY_PREFIXES = ("utm_",)
TRACKING_QUERY_KEYS = {
    "fbclid", "gclid", "gbraid", "wbraid", "mc_cid", "mc_eid", "igshid",
    "ref", "ref_src", "source", "src", "campaign", "trk", "li_fat_id",
}

def normalize_spaces(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).lower()

def normalize_job_link(value: Optional[str]) -> Optional[str]:
    raw = (value or "").strip()
    if not raw:
        return None

    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return raw

    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]

    path = re.sub(r"/+", "/", parsed.path or "/")
    if path != "/":
        path = path.rstrip("/")

    query_items = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        lowered_key = key.lower()
        if lowered_key in TRACKING_QUERY_KEYS or any(lowered_key.startswith(prefix) for prefix in TRACKING_QUERY_PREFIXES):
            continue
        query_items.append((lowered_key, value))

    query = urlencode(sorted(query_items))
    return urlunparse((scheme, netloc, path, "", query, ""))

def normalize_job_payload(job: JobCreate):
    payload = model_to_dict(job)
    payload["company"] = payload["company"].strip()
    payload["role"] = payload["role"].strip()
    payload["status"] = payload["status"].strip()
    payload["source"] = (payload["source"] or "Other").strip() or "Other"
    payload["interview_stage"] = (payload["interview_stage"] or "").strip()
    payload["status"] = STATUS_ALIASES.get(payload["status"], payload["status"])
    payload["interview_stage"] = INTERVIEW_STAGE_ALIASES.get(payload["interview_stage"], payload["interview_stage"])

    if not payload["company"] or not payload["role"]:
        raise HTTPException(status_code=400, detail="Company and role are required")
    for field_name, max_length in [("company", 160), ("role", 200), ("source", 80)]:
        if len(payload[field_name]) > max_length:
            raise HTTPException(status_code=400, detail=f"{field_name.replace('_', ' ').capitalize()} is too long")

    if payload["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid application status")
    if payload["interview_stage"] not in VALID_INTERVIEW_STAGES:
        raise HTTPException(status_code=400, detail="Invalid interview stage")

    for key in [
        "applied_date", "deadline", "location", "link", "notes", "recruiter_name",
        "recruiter_email", "referral_name", "interview_stage", "next_action_date",
        "last_contact_date", "resume_version", "cover_letter_version", "application_packet"
    ]:
        if payload.get(key) == "":
            payload[key] = None

    for key in ["applied_date", "deadline", "next_action_date", "last_contact_date"]:
        if payload.get(key):
            try:
                payload[key] = date.fromisoformat(payload[key]).isoformat()
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"{key.replace('_', ' ').capitalize()} must be YYYY-MM-DD")

    # A To Do item is a saved lead, not an application. Do not let lead
    # imports inflate application analytics or stale-application reminders.
    if payload["status"] == "To Do":
        payload["applied_date"] = None
    elif not payload.get("applied_date"):
        payload["applied_date"] = str(date.today())

    for key, max_length in {
        "location": 160,
        "notes": 12000,
        "recruiter_name": 160,
        "recruiter_email": 320,
        "referral_name": 160,
        "resume_version": 120,
        "cover_letter_version": 120,
        "application_packet": 50000,
        "link": 2048,
    }.items():
        if payload.get(key) and len(payload[key]) > max_length:
            raise HTTPException(status_code=400, detail=f"{key.replace('_', ' ').capitalize()} is too long")

    payload["link"] = normalize_job_link(payload.get("link"))
    payload["activity_log"] = payload.get("activity_log") or None

    return payload

def normalize_subscription_payload(sub: SubscriptionCreate):
    payload = model_to_dict(sub)
    payload["query"] = payload["query"].strip()[:120]
    payload["location"] = (payload["location"] or "Remote").strip()[:120] or "Remote"
    payload["job_type"] = (payload["job_type"] or "INTERN").strip().upper()
    if not payload["query"]:
        raise HTTPException(status_code=400, detail="Search query is required")
    if payload["job_type"] not in VALID_JOB_TYPES:
        raise HTTPException(status_code=400, detail="Invalid job type")
    return payload

def find_duplicate_job(db: Session, user_id: int, payload: dict, ignore_job_id: Optional[int] = None, organization_id: Optional[int] = None):
    query = db.query(JobApplication)
    if organization_id:
        query = query.filter(JobApplication.organization_id == organization_id)
    else:
        query = query.filter(JobApplication.user_id == user_id)
    if ignore_job_id is not None:
        query = query.filter(JobApplication.id != ignore_job_id)

    normalized_link = normalize_job_link(payload.get("link"))
    if payload.get("link"):
        for candidate in query.filter(JobApplication.link.isnot(None)).all():
            if normalize_job_link(candidate.link) == normalized_link:
                return candidate

    normalized_company = normalize_spaces(payload["company"])
    normalized_role = normalize_spaces(payload["role"])
    for candidate in query.all():
        if normalize_spaces(candidate.company) == normalized_company and normalize_spaces(candidate.role) == normalized_role:
            return candidate
    return None

def job_identity_changed(existing_job: JobApplication, payload: dict) -> bool:
    existing_link = normalize_job_link(existing_job.link) or ""
    next_link = normalize_job_link(payload.get("link")) or ""
    return (
        existing_link != next_link
        or normalize_spaces(existing_job.company) != normalize_spaces(payload["company"])
        or normalize_spaces(existing_job.role) != normalize_spaces(payload["role"])
    )

def duplicate_audit_for_user(db: Session, user_id: int, organization_id: Optional[int] = None):
    by_identity = {}
    query = db.query(JobApplication)
    query = query.filter(JobApplication.organization_id == organization_id) if organization_id else query.filter(JobApplication.user_id == user_id)
    for job in query.all():
        link_key = normalize_job_link(job.link)
        identity = ("link", link_key) if link_key else ("company_role", normalize_spaces(job.company), normalize_spaces(job.role))
        by_identity.setdefault(identity, []).append(job)

    duplicates = []
    for identity, jobs in by_identity.items():
        if len(jobs) < 2:
            continue
        duplicates.append({
            "identity": list(identity),
            "count": len(jobs),
            "jobs": [
                {
                    "id": job.id,
                    "company": job.company,
                    "role": job.role,
                    "status": job.status,
                    "link": job.link,
                }
                for job in jobs
            ],
        })
    return duplicates

def normalize_plan(plan: Optional[str]) -> str:
    plan_value = (plan or "free").lower()
    return plan_value if plan_value in AI_MONTHLY_LIMITS else "free"

def is_paid_plan(plan: Optional[str]) -> bool:
    return normalize_plan(plan) in {"pro", "lifetime"}

def current_month_start_iso() -> str:
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def get_monthly_ai_usage(db: Session, user_id: int, organization_id: Optional[int] = None) -> int:
    query = db.query(UsageEvent).filter(UsageEvent.created_at >= current_month_start_iso())
    query = query.filter(UsageEvent.organization_id == organization_id) if organization_id else query.filter(UsageEvent.user_id == user_id)
    events = query.all()
    return sum((event.units or 1) for event in events if event.category in {None, "ai"})

def record_ai_usage(db: Session, user_id: int, feature: str, request_id: Optional[str] = None, organization_id: Optional[int] = None):
    add_usage_event(db, user_id, feature, category="ai", provider="gemini", request_id=request_id, organization_id=organization_id)
    db.commit()

def get_monthly_usage_breakdown(db: Session, user_id: int, organization_id: Optional[int] = None):
    query = db.query(UsageEvent).filter(UsageEvent.created_at >= current_month_start_iso())
    query = query.filter(UsageEvent.organization_id == organization_id) if organization_id else query.filter(UsageEvent.user_id == user_id)
    events = query.all()
    breakdown = {}
    for event in events:
        category = event.category or "ai"
        breakdown.setdefault(category, {})
        breakdown[category][event.feature] = breakdown[category].get(event.feature, 0) + (event.units or 1)
    return breakdown

def get_ai_monthly_limit(plan: Optional[str]) -> int:
    return AI_MONTHLY_LIMITS.get(normalize_plan(plan), 0)

def decrypt_user_gemini_key(current_user: User) -> str:
    try:
        return cipher_suite.decrypt(current_user.enc_gemini_key.encode()).decode()
    except InvalidToken:
        raise HTTPException(
            status_code=400,
            detail="Stored Gemini API key could not be decrypted. Re-save your Gemini key in Settings."
        )

def get_ai_usage_summary(current_user: User, db: Session, organization_id: Optional[int] = None):
    plan = normalize_plan(current_user.plan)
    used = get_monthly_ai_usage(db, current_user.id, organization_id)
    limit = get_ai_monthly_limit(plan)
    has_server_ai = bool(SERVER_GEMINI_API_KEY)
    has_own_key = bool(current_user.enc_gemini_key)
    included = is_paid_plan(plan)

    return {
        "plan": plan,
        "ai_used_this_month": used,
        "ai_monthly_limit": limit,
        "ai_remaining_this_month": max(0, limit - used),
        "ai_included": included,
        "ai_server_configured": has_server_ai,
        "has_user_gemini_key": has_own_key,
        "ai_available": (included and has_server_ai and used < limit) or has_own_key,
        "usage_period": current_month_start_iso()[:7],
        "usage": get_monthly_usage_breakdown(db, current_user.id, organization_id),
    }

def get_gemini_key_for_user(current_user: User, db: Session, organization_id: Optional[int] = None):
    plan = normalize_plan(current_user.plan)
    paid = is_paid_plan(plan)

    if paid and SERVER_GEMINI_API_KEY:
        used = get_monthly_ai_usage(db, current_user.id, organization_id)
        limit = get_ai_monthly_limit(plan)
        if used >= limit:
            if current_user.enc_gemini_key:
                return decrypt_user_gemini_key(current_user), False
            raise HTTPException(status_code=429, detail="Monthly built-in AI limit reached. Add your own Gemini key in Settings to keep using AI.")
        return SERVER_GEMINI_API_KEY, True

    if current_user.enc_gemini_key:
        return decrypt_user_gemini_key(current_user), False

    if paid:
        raise HTTPException(status_code=503, detail="Built-in AI is not configured yet. Add your own Gemini key in Settings or try again later.")

    raise HTTPException(status_code=402, detail="Upgrade for built-in AI or add your own Gemini API key in Settings.")

def extract_gemini_text(response) -> str:
    try:
        text_value = getattr(response, "text", None)
        if text_value:
            return text_value.strip()
    except Exception:
        pass

    candidates = getattr(response, "candidates", None) or []
    parts = []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", None) or []:
            candidate_text = getattr(part, "text", None)
            if candidate_text:
                parts.append(candidate_text)

    joined = "\n".join(part.strip() for part in parts if part and part.strip()).strip()
    if joined:
        return joined

    prompt_feedback = getattr(response, "prompt_feedback", None)
    block_reason = getattr(prompt_feedback, "block_reason", None)
    if block_reason:
        raise HTTPException(status_code=502, detail=f"AI response was blocked: {block_reason}")

    raise HTTPException(status_code=502, detail="AI service returned an empty response")

def normalize_ai_error(error: Exception) -> HTTPException:
    message = str(error)
    lowered = message.lower()
    if "api_key_invalid" in lowered or "api key not valid" in lowered or "invalid api key" in lowered:
        return HTTPException(status_code=400, detail="Gemini API key is invalid. Re-save a valid key in Settings.")
    if "quota" in lowered or "rate limit" in lowered or "429" in lowered:
        return HTTPException(status_code=429, detail="Gemini quota or rate limit was reached. Try again later or check your Gemini account.")
    if "not found" in lowered and "model" in lowered:
        return HTTPException(status_code=502, detail=f"Gemini model '{GEMINI_MODEL}' is not available for this API key.")
    return HTTPException(status_code=502, detail=f"Gemini request failed: {message}")

def normalize_rapidapi_key(value: Optional[str]) -> str:
    """Accept the raw key as well as common copy/paste formats."""
    key = str(value or "").strip()
    lowered = key.lower()
    for prefix in ("bearer ", "x-rapidapi-key:"):
        if lowered.startswith(prefix):
            key = key[len(prefix):].strip()
            break
    return key.strip().strip("\"'").strip()

def get_rapidapi_key(current_user: User) -> str:
    """Use a user's key first, then an optional backend-managed key."""
    if current_user.enc_rapid_key:
        try:
            return normalize_rapidapi_key(cipher_suite.decrypt(current_user.enc_rapid_key.encode()).decode())
        except InvalidToken:
            raise HTTPException(
                status_code=400,
                detail="Stored RapidAPI key could not be decrypted. Re-save your RapidAPI key in Settings.",
            )

    server_key = normalize_rapidapi_key(SERVER_RAPIDAPI_KEY)
    if server_key:
        return server_key
    raise HTTPException(
        status_code=400,
        detail="Live job search is not configured. Add a RapidAPI key in Settings or set RAPIDAPI_KEY on the backend.",
    )

JSEARCH_HOST = "jsearch.p.rapidapi.com"
JSEARCH_SEARCH_URL = f"https://{JSEARCH_HOST}/search-v2"
try:
    RAPIDAPI_TIMEOUT_SECONDS = max(10, int(os.getenv("RAPIDAPI_TIMEOUT_SECONDS", "30")))
except (TypeError, ValueError):
    RAPIDAPI_TIMEOUT_SECONDS = 30

def extract_jsearch_jobs(payload) -> list:
    """Read both the current search-v2 and legacy JSearch response shapes."""
    if not isinstance(payload, dict):
        return []
    data = payload.get("data", [])
    if isinstance(data, dict):
        data = data.get("jobs", data.get("data", []))
    return data if isinstance(data, list) else []

def build_jsearch_params(query: str, location: str, date_posted: Optional[str] = None, employment_type: Optional[str] = None) -> dict:
    """Build JSearch params without sending empty optional filters."""
    params = {
        "query": f"{query} in {location}",
        "page": "1",
        "num_pages": "1",
    }
    if date_posted:
        params["date_posted"] = date_posted
    if employment_type:
        params["employment_types"] = employment_type
    return params

def request_jsearch(operation: str, api_key: str, params: dict):
    """Call JSearch with a bounded retry for transient upstream timeouts."""
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": JSEARCH_HOST,
    }
    for attempt in range(2):
        try:
            response = requests.get(
                JSEARCH_SEARCH_URL,
                headers=headers,
                params=params,
                timeout=(5, RAPIDAPI_TIMEOUT_SECONDS),
            )
            if response.status_code >= 500 and attempt == 0:
                time.sleep(0.75)
                continue
            return response
        except requests.Timeout:
            if attempt == 0:
                time.sleep(0.75)
                continue
            raise HTTPException(
                status_code=504,
                detail=f"{operation} timed out while contacting JSearch. Try again shortly or check your RapidAPI JSearch subscription.",
            )
        except requests.RequestException as exc:
            raise HTTPException(status_code=502, detail=f"{operation} request failed: {str(exc)}")

    raise HTTPException(status_code=502, detail=f"{operation} is temporarily unavailable. Try again shortly.")

def rapidapi_error_detail(response, operation: str):
    """Turn upstream RapidAPI statuses into safe, actionable application errors."""
    status = response.status_code
    if status in {401, 403}:
        return 400, (
            f"{operation} could not authenticate with RapidAPI. Check that the key is correct "
            "and that your RapidAPI account is subscribed to JSearch."
        )
    if status == 404:
        return 502, (
            f"{operation} reached RapidAPI, but JSearch returned HTTP 404. "
            "Make sure the RapidAPI key has an active JSearch subscription, then re-save the key in Settings."
        )
    if status == 429:
        return 429, f"{operation} hit the RapidAPI quota or rate limit. Check your RapidAPI plan and try again later."
    if status >= 500:
        return 502, f"{operation} is temporarily unavailable because RapidAPI returned HTTP {status}. Try again shortly."
    if 400 <= status < 500:
        return 400, f"{operation} was rejected by RapidAPI (HTTP {status}). Check the search values and JSearch access."
    return 502, f"{operation} failed because RapidAPI returned HTTP {status}. Try again shortly."

def raise_rapidapi_error(response, operation: str):
    status_code, detail = rapidapi_error_detail(response, operation)
    raise HTTPException(status_code=status_code, detail=detail)

def validate_gemini_key(api_key: str):
    try:
        generate_gemini_content(api_key, "Reply with exactly: OK", temperature=0)
    except HTTPException as exc:
        raise HTTPException(status_code=exc.status_code, detail=f"Gemini key validation failed: {exc.detail}")

def validate_rapidapi_key(api_key: str):
    api_key = normalize_rapidapi_key(api_key)
    response = request_jsearch(
        "RapidAPI key validation",
        api_key,
        build_jsearch_params("software engineering intern", "Remote", "today", "INTERN"),
    )

    if response.status_code >= 400:
        raise_rapidapi_error(response, "RapidAPI key validation")

    try:
        payload = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="RapidAPI validation returned an invalid response from JSearch. Try again shortly.")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="RapidAPI validation returned an invalid response from JSearch. Try again shortly.")
    if str(payload.get("status", "")).upper() in {"ERROR", "FAILED"}:
        raise HTTPException(status_code=502, detail="RapidAPI validation reached JSearch, but JSearch rejected the request.")

def generate_gemini_content(api_key: str, prompt: str, schema: Optional[dict] = None, temperature: float = 0.4) -> str:
    if google_genai and google_genai_types:
        try:
            client = google_genai.Client(api_key=api_key)
            config_kwargs = {"temperature": temperature}
            if schema:
                config_kwargs["response_mime_type"] = "application/json"
                config_kwargs["response_json_schema"] = schema
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=google_genai_types.GenerateContentConfig(**config_kwargs),
            )
            return extract_gemini_text(response)
        except HTTPException:
            raise
        except Exception as e:
            raise normalize_ai_error(e)

    if not legacy_genai:
        raise HTTPException(status_code=500, detail="Gemini SDK is not installed on the backend")

    try:
        legacy_genai.configure(api_key=api_key)
        generation_config = {"temperature": temperature}
        if schema:
            generation_config["response_mime_type"] = "application/json"
            generation_config["response_schema"] = schema
        model = legacy_genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt, generation_config=generation_config)
        return extract_gemini_text(response)
    except HTTPException:
        raise
    except Exception as e:
        raise normalize_ai_error(e)

def generate_user_gemini_content(current_user: User, db: Session, feature: str, prompt: str, schema: Optional[dict] = None, temperature: float = 0.4, request_id: Optional[str] = None, organization_id: Optional[int] = None) -> str:
    api_key, records_usage = get_gemini_key_for_user(current_user, db, organization_id)
    content = generate_gemini_content(api_key, prompt, schema, temperature)
    if records_usage:
        record_ai_usage(db, current_user.id, feature, request_id=request_id, organization_id=organization_id)
    return content

def extract_json_object(raw: str) -> dict:
    content = (raw or "").strip()
    if "```json" in content:
        content = content.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in content:
        content = content.split("```", 1)[1].split("```", 1)[0].strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(content[start:end + 1])
        raise

def normalize_username(value: str) -> str:
    username = (value or "").strip().lower()
    if not re.fullmatch(r"[a-z0-9._@-]{3,80}", username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-80 characters and use only letters, numbers, dots, underscores, hyphens, or @.",
        )
    return username

def bounded_text(value: Optional[str], max_length: int) -> str:
    return str(value or "").strip()[:max_length]

PROFILE_FIELD_LIMITS = {
    "first_name": 120,
    "last_name": 120,
    "email": 320,
    "phone": 60,
    "address": 240,
    "city": 120,
    "state": 120,
    "zip_code": 30,
    "country": 120,
    "linkedin_url": 2048,
    "portfolio_url": 2048,
    "github_url": 2048,
    "school": 240,
    "degree": 160,
    "major": 160,
    "graduation_date": 40,
    "gpa": 30,
    "work_authorization": 500,
    "sponsorship": 500,
    "salary_expectation": 160,
    "why_company": 3000,
    "why_role": 3000,
    "additional_information": 5000,
    "resume_text": 30000,
}

def normalize_profile_payload(profile: CandidateProfile) -> dict:
    payload = model_to_dict(profile)
    for field_name, max_length in PROFILE_FIELD_LIMITS.items():
        payload[field_name] = bounded_text(payload.get(field_name), max_length)
    return payload

def load_profile(current_user: User) -> dict:
    try:
        profile = json.loads(current_user.profile_json or "{}")
    except (TypeError, json.JSONDecodeError):
        profile = {}
    if not isinstance(profile, dict):
        profile = {}
    profile.setdefault("email", current_user.email or "")
    for field_name in PROFILE_FIELD_LIMITS:
        profile.setdefault(field_name, "")
    return profile

def validate_password(value: str):
    if not value or len(value) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(value) > 256:
        raise HTTPException(status_code=400, detail="Password is too long")

RESUME_MATCH_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "missing_keywords": {"type": "array", "items": {"type": "string"}},
        "summary": {"type": "string"},
        "next_steps": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["score", "strengths", "missing_keywords", "summary", "next_steps"],
}

APPLICATION_PACKET_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer"},
        "summary": {"type": "string"},
        "missing_keywords": {"type": "array", "items": {"type": "string"}},
        "tailored_bullets": {"type": "array", "items": {"type": "string"}},
        "cover_letter": {"type": "string"},
        "application_answers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "answer": {"type": "string"},
                },
                "required": ["question", "answer"],
            },
        },
        "interview_questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "focus": {"type": "string"},
                },
                "required": ["question", "focus"],
            },
        },
        "next_actions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["score", "summary", "missing_keywords", "tailored_bullets", "cover_letter", "application_answers", "interview_questions", "next_actions"],
}

COMPANY_INTEL_SCHEMA = {
    "type": "object",
    "properties": {
        "estimated_salary": {"type": "string"},
        "culture_pros": {"type": "array", "items": {"type": "string"}},
        "culture_cons": {"type": "array", "items": {"type": "string"}},
        "interview_difficulty": {"type": "string"},
        "recent_news": {"type": "string"},
    },
    "required": ["estimated_salary", "culture_pros", "culture_cons", "interview_difficulty", "recent_news"],
}

def clean_scraped_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = unescape(value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()

def extract_meta_content(html: str, name: str) -> str:
    patterns = [
        rf'<meta[^>]+property=["\']{re.escape(name)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+name=["\']{re.escape(name)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']{re.escape(name)}["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']{re.escape(name)}["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return clean_scraped_text(match.group(1))
    return ""

def infer_source_from_url(url: str) -> str:
    lowered = url.lower()
    if "linkedin" in lowered:
        return "LinkedIn"
    if "indeed" in lowered:
        return "Indeed"
    if "handshake" in lowered:
        return "Handshake"
    return "Other"

def ensure_public_http_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Enter a valid http or https job URL")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="Job URL cannot include credentials")

    hostname = parsed.hostname.lower()
    if hostname in {"localhost", "0.0.0.0"} or hostname.endswith(".localhost"):
        raise HTTPException(status_code=400, detail="Local URLs cannot be imported")

    try:
        addresses = {info[4][0] for info in getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))}
    except OSError:
        raise HTTPException(status_code=400, detail="Could not resolve job URL")

    for address in addresses:
        parsed_address = ip_address(address)
        if (
            parsed_address.is_private
            or parsed_address.is_loopback
            or parsed_address.is_link_local
            or parsed_address.is_reserved
            or parsed_address.is_multicast
            or parsed_address.is_unspecified
        ):
            raise HTTPException(status_code=400, detail="Private or internal URLs cannot be imported")

    return url

def scrape_job_posting(url: str) -> dict:
    current_url = url
    response = None
    try:
        for _ in range(4):
            current_url = ensure_public_http_url(current_url)
            response = requests.get(
                current_url,
                timeout=10,
                allow_redirects=False,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
                },
            )
            if response.is_redirect or response.is_permanent_redirect:
                redirect_url = response.headers.get("location")
                if not redirect_url:
                    raise HTTPException(status_code=400, detail="Job page returned an invalid redirect")
                current_url = urljoin(current_url, redirect_url)
                continue
            response.raise_for_status()
            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > 5_000_000:
                raise HTTPException(status_code=400, detail="Job page is too large to import")
            break
        else:
            raise HTTPException(status_code=400, detail="Job page redirected too many times")
    except HTTPException:
        raise
    except (ValueError, requests.RequestException) as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch job page: {str(e)}")

    html = response.text
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    title = clean_scraped_text(title_match.group(1)) if title_match else ""
    og_title = extract_meta_content(html, "og:title")
    description = extract_meta_content(html, "og:description") or extract_meta_content(html, "description")

    json_ld_matches = re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.IGNORECASE | re.DOTALL)
    company = ""
    role = ""
    location = ""
    remote = False
    for raw_block in json_ld_matches:
        block = raw_block.strip()
        try:
            parsed = json.loads(block)
        except json.JSONDecodeError:
            continue
        entries = parsed if isinstance(parsed, list) else [parsed]
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            role = role or clean_scraped_text(entry.get("title"))
            hiring_org = entry.get("hiringOrganization")
            if isinstance(hiring_org, dict):
                company = company or clean_scraped_text(hiring_org.get("name"))
            job_location = entry.get("jobLocation")
            if isinstance(job_location, list) and job_location:
                job_location = job_location[0]
            if isinstance(job_location, dict):
                address = job_location.get("address") or {}
                city = clean_scraped_text(address.get("addressLocality"))
                region = clean_scraped_text(address.get("addressRegion"))
                location = location or ", ".join([part for part in [city, region] if part])
            remote = remote or entry.get("jobLocationType") == "TELECOMMUTE"

    merged_title = og_title or title
    if not role and merged_title:
        role = merged_title.split(" at ")[0].split(" | ")[0].strip()
    if not company and merged_title and " at " in merged_title:
        company = merged_title.split(" at ", 1)[1].split(" | ")[0].strip()

    if not company:
        company = extract_meta_content(html, "og:site_name")

    lowered_blob = f"{merged_title} {description}".lower()
    remote = remote or "remote" in lowered_blob

    if not location:
        location_patterns = [
            r"location[:\s]+([A-Za-z .'-]+,\s?[A-Za-z]{2,})",
            r"in\s+([A-Za-z .'-]+,\s?[A-Za-z]{2,})",
        ]
        for pattern in location_patterns:
            match = re.search(pattern, clean_scraped_text(html)[:5000], re.IGNORECASE)
            if match:
                location = clean_scraped_text(match.group(1))
                break

    return {
        "company": company or "Unknown Company",
        "role": role or "Unknown Role",
        "location": location,
        "remote": remote,
        "description": description or merged_title,
        "source": infer_source_from_url(url),
        "link": current_url,
    }

@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    required_tables = [
        "users",
        "organizations",
        "organization_members",
        "organization_invitations",
        "applications",
        "search_subscriptions",
        "application_events",
        "usage_events",
    ]
    schema = {table_name: False for table_name in required_tables}
    try:
        db.execute(text("SELECT 1"))
        inspector = inspect(db.bind)
        schema = {table_name: inspector.has_table(table_name) for table_name in required_tables}
        database = "ok" if all(schema.values()) else "degraded"
    except Exception as exc:
        logger.exception("Database health check failed: %s", exc)
        database = "error"

    payload = {
        "status": "ok" if database == "ok" else "degraded",
        "database": database,
        "database_backend": engine.dialect.name,
        "schema": schema,
        "job_search": {
            "provider": "jsearch",
            "configured": bool(normalize_rapidapi_key(SERVER_RAPIDAPI_KEY)),
        },
        "stripe": {
            "enabled": bool(stripe and STRIPE_SECRET_KEY),
            "webhook_configured": bool(STRIPE_WEBHOOK_SECRET),
            "pro_price_configured": bool(STRIPE_PRO_MONTHLY_PRICE_ID),
            "lifetime_price_configured": bool(STRIPE_LIFETIME_PRICE_ID),
        },
        "ai": {
            "server_gemini_configured": bool(SERVER_GEMINI_API_KEY),
            "pro_monthly_limit": AI_MONTHLY_LIMITS["pro"],
            "lifetime_monthly_limit": AI_MONTHLY_LIMITS["lifetime"],
        },
        "gemini_model": GEMINI_MODEL,
        "environment": APP_ENV,
    }
    return JSONResponse(status_code=200 if database == "ok" else 503, content=payload)

@app.post("/api/signup")
def signup(user: UserAuth, request: Request, db: Session = Depends(get_db)):
    verify_turnstile(user.turnstile_token, request, "signup")
    username_seed = user.username or re.sub(r"[^a-z0-9._-]+", "-", (user.email or "").split("@")[0].lower())
    username = normalize_username(username_seed)
    email = normalize_email(user.email)
    validate_password(user.password)
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username taken")
    if email and db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_pw = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_user = User(username=username, email=email, hashed_password=hashed_pw)
    db.add(new_user)
    db.flush()
    ensure_default_workspace(db, new_user)
    db.commit()
    return {"message": "Success"}

@app.post("/api/login")
def login(user: UserAuth, request: Request, db: Session = Depends(get_db)):
    verify_turnstile(user.turnstile_token, request, "login")
    identifier = auth_identifier(user)
    if "@" in identifier:
        db_user = db.query(User).filter(User.email == normalize_email(identifier)).first()
    else:
        db_user = db.query(User).filter(User.username == normalize_username(identifier)).first()
    if not db_user or not bcrypt.checkpw(user.password.encode('utf-8'), db_user.hashed_password.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = jwt.encode(
        {
            "sub": db_user.username,
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(days=JWT_TTL_DAYS),
            "jti": uuid.uuid4().hex,
            "typ": "access",
        },
        JWT_SECRET,
        algorithm=ALGORITHM,
    )
    return {"access_token": token, "token_type": "bearer", "username": db_user.username}

@app.post("/api/update-keys")
def update_keys(keys: KeysUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rapid_key = normalize_rapidapi_key(keys.rapid_key)
    gemini_key = (keys.gemini_key or "").strip()
    validated = []
    if rapid_key:
        validate_rapidapi_key(rapid_key)
        current_user.enc_rapid_key = cipher_suite.encrypt(rapid_key.encode()).decode()
        validated.append("rapidapi")
    if gemini_key:
        validate_gemini_key(gemini_key)
        current_user.enc_gemini_key = cipher_suite.encrypt(gemini_key.encode()).decode()
        validated.append("gemini")
    if not validated:
        raise HTTPException(status_code=400, detail="Paste at least one key to validate and save.")
    db.commit()
    return {"message": "Keys validated and secured", "validated": validated}

@app.get("/api/profile")
def get_profile(current_user: User = Depends(get_current_user)):
    return {"profile": load_profile(current_user)}

@app.put("/api/profile")
def update_profile(profile: CandidateProfile, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payload = normalize_profile_payload(profile)
    if payload.get("email"):
        payload["email"] = normalize_email(payload["email"]) or ""
    current_user.profile_json = json.dumps(payload, separators=(",", ":"))
    db.commit()
    return {"profile": payload}

@app.get("/api/billing/me")
def get_billing_status(workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ai_summary = get_ai_usage_summary(current_user, db, workspace.id)
    return {
        **ai_summary,
        "subscription_status": current_user.subscription_status or "free",
        "current_period_end": current_user.current_period_end,
    }

def workspace_to_dict(db: Session, workspace: Organization, user_id: int):
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == workspace.id,
        OrganizationMember.user_id == user_id,
        OrganizationMember.status == "active",
    ).first()
    member_count = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == workspace.id,
        OrganizationMember.status == "active",
    ).count()
    return {
        "id": workspace.id,
        "name": workspace.name,
        "slug": workspace.slug,
        "plan": workspace.plan or "free",
        "role": membership.role if membership else None,
        "member_count": member_count,
        "is_owner": bool(membership and membership.role == "owner"),
    }

@app.get("/api/workspaces")
def get_workspaces(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_default_workspace(db, current_user)
    memberships = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.status == "active",
    ).order_by(OrganizationMember.id.asc()).all()
    workspaces = []
    for membership in memberships:
        workspace = db.query(Organization).filter(Organization.id == membership.organization_id).first()
        if workspace:
            workspaces.append(workspace_to_dict(db, workspace, current_user.id))
    return workspaces

@app.post("/api/workspaces")
def create_workspace(payload: WorkspaceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = bounded_text(payload.name, 100)
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Workspace name must be at least 2 characters")
    base_slug = workspace_slug(name)
    slug = base_slug
    suffix = 2
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{suffix}"
        suffix += 1
    workspace = Organization(name=name, slug=slug, owner_id=current_user.id, plan=normalize_plan(current_user.plan), created_at=utc_now_iso())
    db.add(workspace)
    db.flush()
    db.add(OrganizationMember(organization_id=workspace.id, user_id=current_user.id, role="owner", status="active", created_at=utc_now_iso()))
    db.commit()
    return workspace_to_dict(db, workspace, current_user.id)

@app.get("/api/workspaces/{workspace_id}/members")
def get_workspace_members(workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    members = db.query(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id).filter(
        OrganizationMember.organization_id == workspace.id,
        OrganizationMember.status == "active",
    ).order_by(OrganizationMember.created_at.asc()).all()
    return [
        {
            "user_id": member.user_id,
            "username": user.username,
            "email": user.email,
            "role": member.role,
            "joined_at": member.created_at,
            "is_current_user": member.user_id == current_user.id,
        }
        for member, user in members
    ]

@app.post("/api/workspaces/{workspace_id}/members")
def add_workspace_member(payload: WorkspaceMemberAdd, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, MANAGE_WORKSPACE_ROLES)
    role = (payload.role or "member").strip().lower()
    if role not in {"admin", "member", "viewer"}:
        raise HTTPException(status_code=400, detail="Invalid workspace role")
    identifier = (payload.username or "").strip().lower()
    user = db.query(User).filter((User.username == identifier) | (User.email == identifier)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Ask them to create an account first.")
    existing = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == workspace.id,
        OrganizationMember.user_id == user.id,
    ).first()
    if existing:
        if existing.status == "active":
            raise HTTPException(status_code=409, detail="That user is already in this workspace")
        existing.status = "active"
        existing.role = role
        db.commit()
        return {"user_id": user.id, "username": user.username, "email": user.email, "role": role}
    member = OrganizationMember(organization_id=workspace.id, user_id=user.id, role=role, status="active", created_at=utc_now_iso())
    db.add(member)
    db.commit()
    return {"user_id": user.id, "username": user.username, "email": user.email, "role": role}

@app.post("/api/workspaces/{workspace_id}/invitations")
def create_workspace_invitation(payload: WorkspaceInviteCreate, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, MANAGE_WORKSPACE_ROLES)
    email = normalize_email(payload.email)
    role = (payload.role or "member").strip().lower()
    if role not in {"admin", "member", "viewer"}:
        raise HTTPException(status_code=400, detail="Invalid workspace role")
    token = secrets.token_urlsafe(32)
    invitation = OrganizationInvitation(
        organization_id=workspace.id,
        invited_by=current_user.id,
        email=email,
        role=role,
        token=token,
        expires_at=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat(timespec="seconds").replace("+00:00", "Z"),
        created_at=utc_now_iso(),
    )
    db.add(invitation)
    db.commit()
    return {
        "id": invitation.id,
        "email": email,
        "role": role,
        "expires_at": invitation.expires_at,
        "invite_url": f"{FRONTEND_URL}/?invite={token}",
    }

@app.post("/api/workspace-invitations/accept")
def accept_workspace_invitation(payload: WorkspaceInviteAccept, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invitation = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.token == payload.token.strip(),
        OrganizationInvitation.accepted_at.is_(None),
    ).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already accepted")
    if invitation.expires_at < utc_now_iso():
        raise HTTPException(status_code=400, detail="This invitation has expired")
    if current_user.email != invitation.email:
        raise HTTPException(status_code=403, detail="Sign in with the invited email address to accept this invitation")
    existing = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == invitation.organization_id,
        OrganizationMember.user_id == current_user.id,
    ).first()
    if existing and existing.status == "active":
        raise HTTPException(status_code=409, detail="You are already in this workspace")
    if existing:
        existing.status = "active"
        existing.role = invitation.role
    else:
        db.add(OrganizationMember(organization_id=invitation.organization_id, user_id=current_user.id, role=invitation.role, status="active", created_at=utc_now_iso()))
    invitation.accepted_at = utc_now_iso()
    db.commit()
    workspace = db.query(Organization).filter(Organization.id == invitation.organization_id).first()
    return workspace_to_dict(db, workspace, current_user.id)

@app.patch("/api/workspaces/{workspace_id}/members/{member_id}")
def update_workspace_member(member_id: int, payload: WorkspaceRoleUpdate, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, MANAGE_WORKSPACE_ROLES)
    role = (payload.role or "").strip().lower()
    if role not in {"admin", "member", "viewer"}:
        raise HTTPException(status_code=400, detail="Invalid workspace role")
    member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == workspace.id,
        OrganizationMember.user_id == member_id,
        OrganizationMember.status == "active",
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Workspace member not found")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Transfer ownership before changing the owner role")
    member.role = role
    db.commit()
    return {"user_id": member.user_id, "role": member.role}

@app.delete("/api/workspaces/{workspace_id}/members/{member_id}")
def remove_workspace_member(member_id: int, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, MANAGE_WORKSPACE_ROLES)
    member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == workspace.id,
        OrganizationMember.user_id == member_id,
        OrganizationMember.status == "active",
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Workspace member not found")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="The workspace owner cannot be removed")
    member.status = "removed"
    db.commit()
    return {"message": "Member removed"}

def build_analytics_payload(db: Session, user_id: int, organization_id: Optional[int] = None):
    job_query = db.query(JobApplication)
    event_query = db.query(ApplicationEvent)
    if organization_id:
        job_query = job_query.filter(JobApplication.organization_id == organization_id)
        event_query = event_query.filter(ApplicationEvent.organization_id == organization_id)
    else:
        job_query = job_query.filter(JobApplication.user_id == user_id)
        event_query = event_query.filter(ApplicationEvent.user_id == user_id)
    jobs = job_query.all()
    events = event_query.order_by(ApplicationEvent.occurred_at.asc()).all()
    job_map = {job.id: job for job in jobs}
    active_ids = set(job_map)

    def event_date(event):
        raw = event.effective_date or (event.occurred_at or "")[:10]
        try:
            return date.fromisoformat(raw[:10])
        except (TypeError, ValueError):
            return date.today()

    submitted_dates = {}
    response_dates = {}
    interview_ids = set()
    offer_ids = set()
    rejected_ids = set()
    activity_days = {}

    for event in events:
        if event.application_id not in active_ids:
            continue
        event_day = event_date(event)
        day_key = event_day.isoformat()
        activity_days[day_key] = activity_days.get(day_key, 0) + 1
        if event.event_type == "application_submitted":
            submitted_dates.setdefault(event.application_id, event_day)
        elif event.event_type == "response_recorded":
            response_dates.setdefault(event.application_id, event_day)
        elif event.event_type == "interview_reached":
            interview_ids.add(event.application_id)
        elif event.event_type == "offer_received":
            offer_ids.add(event.application_id)
        elif event.event_type == "rejected":
            rejected_ids.add(event.application_id)

    # Existing records created before the event ledger was introduced still
    # contribute safely until their history is backfilled.
    for job in jobs:
        if job.status != "To Do" and job.applied_date:
            try:
                submitted_dates.setdefault(job.id, date.fromisoformat(job.applied_date))
            except ValueError:
                pass
        if job.status in {"Interview", "Offer", "Rejected"} or job.last_contact_date:
            try:
                response_dates.setdefault(job.id, date.fromisoformat(job.last_contact_date or job.applied_date or str(date.today())))
            except ValueError:
                response_dates.setdefault(job.id, date.today())
        if job.status == "Interview":
            interview_ids.add(job.id)
        if job.status == "Offer":
            offer_ids.add(job.id)
        if job.status == "Rejected":
            rejected_ids.add(job.id)

    submitted_ids = set(submitted_dates) & active_ids
    responded_ids = set(response_dates) & submitted_ids
    interview_ids &= submitted_ids
    offer_ids &= submitted_ids
    rejected_ids &= submitted_ids

    response_days = [
        (response_dates[job_id] - submitted_dates[job_id]).days
        for job_id in responded_ids
        if response_dates[job_id] >= submitted_dates[job_id]
    ]
    avg_days = (sum(response_days) / len(response_days)) if response_days else None

    timeline_map = {}
    source_map = {}
    for job in jobs:
        if job.id not in submitted_ids:
            continue
        submitted_day = submitted_dates[job.id].isoformat()
        timeline_map[submitted_day] = timeline_map.get(submitted_day, 0) + 1
        source = job.source or "Other"
        source_item = source_map.setdefault(source, {"source": source, "count": 0, "responses": 0, "interviews": 0, "offers": 0})
        source_item["count"] += 1
        source_item["responses"] += int(job.id in responded_ids)
        source_item["interviews"] += int(job.id in interview_ids)
        source_item["offers"] += int(job.id in offer_ids)

    sources = []
    for item in source_map.values():
        count = item["count"]
        sources.append({
            "source": item["source"],
            "count": count,
            "responseRate": f"{(item['responses'] / count * 100):.0f}" if count else "0",
            "interviewRate": f"{(item['interviews'] / count * 100):.0f}" if count else "0",
            "offerRate": f"{(item['offers'] / count * 100):.0f}" if count else "0",
        })
    sources.sort(key=lambda item: item["count"], reverse=True)

    today = date.today()
    week_start = today - timedelta(days=6)
    weekly_submitted = sum(1 for value in submitted_dates.values() if week_start <= value <= today)
    weekly_responses = sum(1 for value in response_dates.values() if week_start <= value <= today)
    channel_momentum = {}
    for job in jobs:
        if job.id in interview_ids or job.id in offer_ids:
            channel_momentum[job.source or "Other"] = channel_momentum.get(job.source or "Other", 0) + 1
    strongest_channel = max(channel_momentum, key=channel_momentum.get) if channel_momentum else "No signal yet"

    funnel_map = {"To Do": 0, "Applied": 0, "Interview": 0, "Offer": 0, "Rejected": 0}
    for job in jobs:
        if job.status in funnel_map:
            funnel_map[job.status] += 1

    interview_stage_map = {}
    for job in jobs:
        if job.interview_stage:
            interview_stage_map[job.interview_stage] = interview_stage_map.get(job.interview_stage, 0) + 1

    applications_count = len(jobs)
    submitted_count = len(submitted_ids)
    response_count = len(responded_ids)
    interview_count = len(interview_ids)
    offer_count = len(offer_ids)
    return {
        "generated_at": utc_now_iso(),
        "definition_version": 1,
        "total": applications_count,
        "submitted": submitted_count,
        "responses": response_count,
        "interviews": interview_count,
        "offers": offer_count,
        "responseRate": f"{(response_count / submitted_count * 100):.1f}" if submitted_count else "0.0",
        "interviewRate": f"{(interview_count / submitted_count * 100):.1f}" if submitted_count else "0.0",
        "offerRate": f"{(offer_count / submitted_count * 100):.1f}" if submitted_count else "0.0",
        "avgDaysToResponse": f"{avg_days:.1f}" if avg_days is not None else "-",
        "timeline": [{"date": key, "applications": timeline_map[key]} for key in sorted(timeline_map)],
        "funnel": [{"status": key, "count": value} for key, value in funnel_map.items()],
        "sources": sources,
        "interviewStages": [{"stage": key, "count": value} for key, value in interview_stage_map.items()],
        "activityDays": [{"date": key, "count": value} for key, value in sorted(activity_days.items())],
        "weekly": {
            "applied": weekly_submitted,
            "responses": weekly_responses,
            "followUpsDue": sum(1 for job in jobs if job.next_action_date and job.next_action_date <= str(today) and not job.follow_up_sent),
            "deadlinesSoon": sum(1 for job in jobs if job.deadline and str(today) <= job.deadline <= str(today + timedelta(days=7))),
            "strongestChannel": strongest_channel,
        },
        "metricDefinitions": {
            "submitted": "Saved applications with a non-lead status and an application date.",
            "responseRate": "Applications with a recorded response divided by submitted applications.",
            "interviewRate": "Applications that reached an interview divided by submitted applications.",
            "offerRate": "Applications that reached an offer divided by submitted applications.",
            "avgDaysToResponse": "Average calendar days from application date to the first recorded response.",
        },
    }

@app.get("/api/analytics")
def get_analytics(workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_application_event_backfill(db)
    return build_analytics_payload(db, current_user.id, workspace.id)

@app.post("/api/billing/create-checkout-session")
def create_checkout_session(req: CheckoutRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_stripe()
    checkout_plan = get_checkout_plan(req.plan)

    try:
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(
                name=current_user.username,
                metadata={"user_id": str(current_user.id), "username": current_user.username},
            )
            current_user.stripe_customer_id = customer.id
            db.commit()

        session_params = {
            "customer": current_user.stripe_customer_id,
            "client_reference_id": str(current_user.id),
            "mode": checkout_plan["mode"],
            "line_items": [{"price": checkout_plan["price_id"], "quantity": 1}],
            "allow_promotion_codes": True,
            "success_url": f"{FRONTEND_URL}/?checkout=success&plan={req.plan}",
            "cancel_url": f"{FRONTEND_URL}/?checkout=cancelled",
            "metadata": {"user_id": str(current_user.id), "plan": checkout_plan["app_plan"]},
        }
        if checkout_plan["mode"] == "subscription":
            session_params["subscription_data"] = {"metadata": {"user_id": str(current_user.id), "plan": checkout_plan["app_plan"]}}
        else:
            session_params["payment_intent_data"] = {"metadata": {"user_id": str(current_user.id), "plan": checkout_plan["app_plan"]}}

        session = stripe.checkout.Session.create(**session_params)
        return {"url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe checkout failed: {getattr(e, 'user_message', None) or str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe checkout failed: {str(e)}")

@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    require_stripe()
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Stripe webhook secret is not configured")

    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    try:
        event = stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Stripe payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    event_type = event["type"]
    event_object = event["data"]["object"]
    event_data = stripe_object_to_dict(event_object)

    if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        user = find_user_for_stripe_event(db, event_object)
        if user:
            user.stripe_customer_id = event_data.get("customer") or user.stripe_customer_id
            if event_data.get("mode") == "payment" and (event_type == "checkout.session.async_payment_succeeded" or event_data.get("payment_status") == "paid"):
                grant_lifetime_access(user)
            elif event_data.get("mode") == "subscription" and event_data.get("subscription"):
                try:
                    subscription = stripe.Subscription.retrieve(event_data["subscription"])
                    sync_user_subscription_from_stripe(user, subscription)
                except stripe.error.StripeError:
                    user.subscription_status = "pending"
            db.commit()

    if event_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "customer.subscription.paused",
        "customer.subscription.resumed",
    }:
        user = find_user_for_stripe_event(db, event_object)
        if user:
            sync_user_subscription_from_stripe(user, event_object)
            db.commit()

    if event_type in {"invoice.payment_failed", "invoice.payment_succeeded", "invoice.paid", "invoice.payment_action_required", "invoice.finalization_failed"}:
        subscription_id = get_invoice_subscription_id(event_data)
        if subscription_id:
            sync_user_subscription_by_id(db, subscription_id)

    return {"received": True}

@app.get("/api/jobs")
def get_jobs(workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(JobApplication).filter(JobApplication.organization_id == workspace.id).all()

@app.get("/api/jobs/duplicates")
def get_duplicate_jobs(workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return duplicate_audit_for_user(db, current_user.id, workspace.id)

@app.post("/api/jobs/import")
def import_jobs(req: JobImportRequest, request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, EDIT_WORKSPACE_ROLES)
    if not req.jobs:
        raise HTTPException(status_code=400, detail="The backup does not contain any applications")
    if len(req.jobs) > 500:
        raise HTTPException(status_code=400, detail="You can restore at most 500 applications at a time")

    pending_identities = set()
    normalized_jobs = []
    skipped = 0

    for job in req.jobs:
        payload = normalize_job_payload(job)
        normalized_link = normalize_job_link(payload.get("link"))
        identity_keys = {
            ("company_role", normalize_spaces(payload["company"]), normalize_spaces(payload["role"]))
        }
        if normalized_link:
            identity_keys.add(("link", normalized_link))
        if identity_keys & pending_identities or find_duplicate_job(db, current_user.id, payload, organization_id=workspace.id):
            skipped += 1
            continue

        pending_identities.update(identity_keys)
        activity_entries = load_activity_log(payload.get("activity_log"))
        payload["activity_log"] = (
            json.dumps(activity_entries[-50:])
            if activity_entries
            else append_activity(None, f"Application restored in {payload['status']}")
        )
        normalized_jobs.append(payload)

    for payload in normalized_jobs:
        restored_job = JobApplication(**payload, user_id=current_user.id, organization_id=workspace.id)
        db.add(restored_job)
        db.flush()
        add_initial_application_events(db, current_user.id, restored_job)

    if normalized_jobs:
        add_usage_event(db, current_user.id, "json_restore", units=len(normalized_jobs), request_id=request_id_for(request), details={"skipped": skipped}, organization_id=workspace.id)

    db.commit()
    return {
        "added": len(normalized_jobs),
        "skipped": skipped,
        "jobs": db.query(JobApplication).filter(JobApplication.organization_id == workspace.id).all(),
    }

@app.post("/api/jobs")
def create_job(job: JobCreate, request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, EDIT_WORKSPACE_ROLES)
    payload = normalize_job_payload(job)
    duplicate = find_duplicate_job(db, current_user.id, payload, organization_id=workspace.id)
    if duplicate:
        raise HTTPException(status_code=409, detail="This application is already being tracked")

    payload["activity_log"] = append_activity(None, f"Application created in {payload['status']}")
    if payload.get("source"):
        payload["activity_log"] = append_activity(payload["activity_log"], f"Source set to {payload['source']}")
    new_job = JobApplication(**payload, user_id=current_user.id, organization_id=workspace.id)
    db.add(new_job)
    db.flush()
    add_initial_application_events(db, current_user.id, new_job)
    add_usage_event(db, current_user.id, "application_created", request_id=request_id_for(request), details={"source": payload.get("source")}, organization_id=workspace.id)
    db.commit()
    db.refresh(new_job)
    return new_job

@app.put("/api/jobs/{job_id}")
def update_job(job_id: int, job: JobCreate, request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, EDIT_WORKSPACE_ROLES)
    db_job = db.query(JobApplication).filter(JobApplication.id == job_id, JobApplication.organization_id == workspace.id).first()
    if not db_job: raise HTTPException(status_code=404, detail="Job not found")
    payload = normalize_job_payload(job)
    if job_identity_changed(db_job, payload):
        duplicate = find_duplicate_job(db, current_user.id, payload, ignore_job_id=job_id, organization_id=workspace.id)
        if duplicate:
            raise HTTPException(status_code=409, detail="This application is already being tracked")

    previous_status = db_job.status
    previous_applied_date = db_job.applied_date
    previous_last_contact_date = db_job.last_contact_date
    previous_follow_up_sent = db_job.follow_up_sent
    activity_log = db_job.activity_log
    changed_fields = []
    if previous_status != payload["status"]:
        changed_fields.append("status")
        activity_log = append_activity(activity_log, f"Status changed from {previous_status} to {payload['status']}")
    if db_job.interview_stage != payload.get("interview_stage"):
        changed_fields.append("interview_stage")
        next_stage = payload.get("interview_stage") or "None"
        activity_log = append_activity(activity_log, f"Interview stage updated to {next_stage}")
    if db_job.next_action_date != payload.get("next_action_date"):
        changed_fields.append("next_action_date")
        next_action = payload.get("next_action_date") or "cleared"
        activity_log = append_activity(activity_log, f"Next action date set to {next_action}")
    if db_job.follow_up_sent != payload.get("follow_up_sent"):
        changed_fields.append("follow_up_sent")
        activity_log = append_activity(activity_log, "Follow-up marked as sent" if payload.get("follow_up_sent") else "Follow-up marked as pending")
    if db_job.last_contact_date != payload.get("last_contact_date") and payload.get("last_contact_date"):
        changed_fields.append("last_contact_date")
        activity_log = append_activity(activity_log, f"Last contact updated to {payload['last_contact_date']}")

    for key in payload:
        if key not in changed_fields and getattr(db_job, key, None) != payload[key]:
            changed_fields.append(key)

    payload["activity_log"] = activity_log
    for key, value in payload.items():
        setattr(db_job, key, value)
    if previous_status != payload["status"]:
        add_application_event(
            db, current_user.id, db_job.id, "status_changed",
            from_status=previous_status, to_status=payload["status"],
            effective_date=payload.get("applied_date"),
            details={"company": db_job.company, "role": db_job.role},
            organization_id=workspace.id,
        )
    if (
        ((previous_status == "To Do" and payload["status"] != "To Do") or not previous_applied_date)
        and payload["status"] != "To Do"
        and payload.get("applied_date")
    ):
        add_application_event(
            db, current_user.id, db_job.id, "application_submitted",
            from_status=previous_status, to_status=payload["status"],
            effective_date=payload["applied_date"],
            details={"company": db_job.company, "role": db_job.role, "source": db_job.source},
            organization_id=workspace.id,
        )
    if (previous_last_contact_date is None and payload.get("last_contact_date")) or (
        previous_status not in {"Interview", "Offer", "Rejected"} and payload["status"] in {"Interview", "Offer", "Rejected"}
    ):
        add_application_event(
            db, current_user.id, db_job.id, "response_recorded", to_status=payload["status"],
            effective_date=payload.get("last_contact_date") or str(date.today()),
            details={"source": "status_change" if not payload.get("last_contact_date") else "last_contact_date"},
            organization_id=workspace.id,
        )
    if previous_status != "Interview" and payload["status"] == "Interview":
        add_application_event(db, current_user.id, db_job.id, "interview_reached", from_status=previous_status, to_status=payload["status"], effective_date=payload.get("last_contact_date") or str(date.today()), organization_id=workspace.id)
    if previous_status != "Offer" and payload["status"] == "Offer":
        add_application_event(db, current_user.id, db_job.id, "offer_received", from_status=previous_status, to_status=payload["status"], effective_date=payload.get("last_contact_date") or str(date.today()), organization_id=workspace.id)
    if previous_status != "Rejected" and payload["status"] == "Rejected":
        add_application_event(db, current_user.id, db_job.id, "rejected", from_status=previous_status, to_status=payload["status"], effective_date=payload.get("last_contact_date") or str(date.today()), organization_id=workspace.id)
    if not previous_follow_up_sent and payload.get("follow_up_sent"):
        add_application_event(db, current_user.id, db_job.id, "follow_up_sent", to_status=payload["status"], effective_date=str(date.today()), organization_id=workspace.id)
    if changed_fields:
        add_application_event(db, current_user.id, db_job.id, "application_updated", from_status=previous_status, to_status=payload["status"], effective_date=str(date.today()), details={"fields": changed_fields}, organization_id=workspace.id)
        add_usage_event(db, current_user.id, "application_updated", request_id=request_id_for(request), details={"fields": changed_fields}, organization_id=workspace.id)
    db.commit()
    db.refresh(db_job)
    return db_job

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, EDIT_WORKSPACE_ROLES)
    db_job = db.query(JobApplication).filter(JobApplication.id == job_id, JobApplication.organization_id == workspace.id).first()
    if not db_job: raise HTTPException(status_code=404, detail="Job not found")
    add_application_event(
        db, current_user.id, db_job.id, "application_deleted", from_status=db_job.status,
        effective_date=str(date.today()),
        details={"company": db_job.company, "role": db_job.role, "source": db_job.source},
        organization_id=workspace.id,
    )
    add_usage_event(db, current_user.id, "application_deleted", request_id=request_id_for(request), organization_id=workspace.id)
    db.delete(db_job)
    db.commit()
    return {"message": "Deleted"}

@app.get("/api/cities")
def proxy_cities(q: str):
    """Proxy Teleport API to avoid CORS or network blocks in the browser"""
    q = (q or "").strip()[:80]
    if len(q) < 2:
        return {"_embedded": {"city:search-results": []}}
    try:
        resp = requests.get("https://api.teleport.org/api/cities/", params={"search": q}, timeout=5)
        resp.raise_for_status()
        payload = resp.json()
        return payload if isinstance(payload, dict) else {"_embedded": {"city:search-results": []}}
    except (requests.RequestException, ValueError):
        return {"_embedded": {"city:search-results": []}}

@app.post("/api/autofill-job-link")
def autofill_job_link(req: AutofillRequest, current_user: User = Depends(get_current_user)):
    url = (req.url or "").strip()
    return scrape_job_posting(url)

@app.get("/api/search")
def search_jobs(query: str, location: str, jobType: str, datePosted: str, request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = (query or "").strip()[:120]
    location = (location or "").strip()[:120]
    if not query or not location:
        raise HTTPException(status_code=400, detail="Search keywords and location are required")
    jobType = (jobType or "").strip().upper()
    datePosted = (datePosted or "").strip()
    if jobType not in VALID_JOB_TYPES:
        raise HTTPException(status_code=400, detail="Invalid job type")
    if datePosted not in VALID_DATE_POSTED:
        raise HTTPException(status_code=400, detail="Invalid date filter")

    user_rapid_key = get_rapidapi_key(current_user)

    params = build_jsearch_params(query, location, datePosted, jobType)
    try:
        response = request_jsearch("Job search", user_rapid_key, params)
        if response.status_code != 200:
            raise_rapidapi_error(response, "Job search")

        try:
            payload = response.json()
        except ValueError:
            raise HTTPException(status_code=502, detail="Job search returned an invalid response from RapidAPI. Try again shortly.")
        if not isinstance(payload, dict):
            raise HTTPException(status_code=502, detail="Job search returned an invalid response from RapidAPI. Try again shortly.")
        if str(payload.get("status", "")).upper() in {"ERROR", "FAILED"}:
            raise HTTPException(status_code=502, detail="RapidAPI rejected the job search. Check your JSearch subscription and try again.")

        data = extract_jsearch_jobs(payload)
        results = []
        for j in data:
            if not isinstance(j, dict):
                continue
            result_link = j.get("job_apply_link") or j.get("job_google_link")
            result_company = bounded_text(j.get("employer_name"), 160) or "Unknown"
            result_role = bounded_text(j.get("job_title"), 200) or "Role"
            posted_at = bounded_text(j.get("job_posted_at_datetime_utc"), 40)
            results.append({
                "_id": j.get("job_id") or result_link or f"{result_company}:{result_role}",
                "company": result_company,
                "role": result_role,
                "source": "Search",
                "remote": bool(j.get("job_is_remote")),
                "location": f"{j.get('job_city', '')}, {j.get('job_state', '')}".strip(", "),
                "posted": posted_at[:10],
                "link": result_link,
                "desc": j.get("job_description", "")
            })
        add_usage_event(
            db, current_user.id, "job_search", request_id=request_id_for(request), details={"query": query, "location": location, "job_type": jobType, "results": len(results)}, organization_id=workspace.id,
        )
        db.commit()
        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/resume-match")
def resume_match(req: ResumeMatchRequest, request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = f"""
    You are evaluating a candidate's resume against an internship posting.
    Company: {bounded_text(req.company, 160)}
    Role: {bounded_text(req.role, 200)}
    Job Description: {bounded_text(req.description, 16000)}
    Resume Context: {bounded_text(req.context, 30000)}

    Return EXACTLY valid JSON in this shape:
    {{
      "score": 0,
      "strengths": ["point 1", "point 2", "point 3"],
      "missing_keywords": ["keyword 1", "keyword 2", "keyword 3"],
      "summary": "two sentence summary",
      "next_steps": ["step 1", "step 2", "step 3"]
    }}

    Score must be an integer from 0 to 100.
    Keep it concise, concrete, and resume-focused.
    """

    try:
        content = generate_user_gemini_content(current_user, db, "resume_match", prompt, RESUME_MATCH_SCHEMA, temperature=0.2, request_id=request_id_for(request), organization_id=workspace.id)
        parsed = extract_json_object(content)
        parsed["score"] = max(0, min(100, int(parsed.get("score", 0))))
        parsed["strengths"] = parsed.get("strengths") or []
        parsed["missing_keywords"] = parsed.get("missing_keywords") or []
        parsed["next_steps"] = parsed.get("next_steps") or []
        parsed["summary"] = parsed.get("summary") or ""
        return parsed
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/api/application-packet")
def application_packet(req: ApplicationPacketRequest, request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, EDIT_WORKSPACE_ROLES)
    job = None
    if req.application_id is not None:
        job = db.query(JobApplication).filter(
            JobApplication.id == req.application_id,
            JobApplication.organization_id == workspace.id,
        ).first()
        if not job:
            raise HTTPException(status_code=404, detail="Application not found")

    description = bounded_text(req.description, 16000) or bounded_text(job.notes if job else "", 16000)
    prompt = f"""
    Build a practical application packet for an internship candidate.
    Company: {bounded_text(req.company, 160)}
    Role: {bounded_text(req.role, 200)}
    Job Description: {description or "Not provided. Make the recommendations general and say when details are missing."}
    Candidate Resume/Profile: {bounded_text(req.context, 30000)}

    Return EXACTLY valid JSON with these fields:
    - score: integer 0-100 for fit based only on the provided information
    - summary: two concise sentences explaining the fit
    - missing_keywords: up to 8 important job terms not clearly supported by the resume
    - tailored_bullets: up to 4 truthful resume bullet rewrites based only on existing candidate experience; do not invent metrics, employers, or skills
    - cover_letter: a concise, specific cover letter under 280 words
    - application_answers: up to 3 likely application questions with concise answers
    - interview_questions: 5 likely interview questions, each with a short focus note
    - next_actions: 4 concrete actions ordered by priority

    Never claim the candidate has experience that is not present in the resume/profile. If the job description is missing, keep the output conservative and tell the candidate what information to add.
    """

    try:
        content = generate_user_gemini_content(
            current_user,
            db,
            "application_packet",
            prompt,
            APPLICATION_PACKET_SCHEMA,
            temperature=0.3,
            request_id=request_id_for(request),
            organization_id=workspace.id,
        )
        parsed = extract_json_object(content)
        parsed["score"] = max(0, min(100, int(parsed.get("score", 0))))
        parsed["summary"] = bounded_text(parsed.get("summary"), 1200)
        parsed["cover_letter"] = bounded_text(parsed.get("cover_letter"), 12000)
        for field in ("missing_keywords", "tailored_bullets", "next_actions"):
            values = parsed.get(field)
            parsed[field] = [bounded_text(value, 800) for value in values if isinstance(value, str)][:8] if isinstance(values, list) else []
        answers = parsed.get("application_answers") if isinstance(parsed.get("application_answers"), list) else []
        parsed["application_answers"] = [
            {"question": bounded_text(item.get("question"), 500), "answer": bounded_text(item.get("answer"), 1800)}
            for item in answers
            if isinstance(item, dict)
        ][:3]
        questions = parsed.get("interview_questions") if isinstance(parsed.get("interview_questions"), list) else []
        parsed["interview_questions"] = [
            {"question": bounded_text(item.get("question"), 500), "focus": bounded_text(item.get("focus"), 500)}
            for item in questions
            if isinstance(item, dict)
        ][:5]
        if job:
            job.application_packet = json.dumps(parsed, separators=(",", ":"))
            db.commit()
        return {**parsed, "saved": bool(job)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/api/generate-followup")
def generate_followup(req: FollowUpRequest, request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = f"""
    Write a concise, professional follow-up email for a job applicant.
    Company: {bounded_text(req.company, 160)}
    Role: {bounded_text(req.role, 200)}
    Current Status: {bounded_text(req.status, 80)}
    Recruiter Name: {bounded_text(req.recruiter_name, 160) or "Hiring Team"}
    Last Contact Date: {bounded_text(req.last_contact_date, 40) or "Unknown"}
    Next Action Date: {bounded_text(req.next_action_date, 40) or "Not set"}
    Notes: {bounded_text(req.notes, 6000) or "None"}
    Applicant Background: {bounded_text(req.context, 30000)}

    Keep it under 180 words.
    Include a subject line on the first line in the format: Subject: ...
    Then include the email body.
    Make it polite, specific, and not overly formal.
    """

    try:
        return {"text": generate_user_gemini_content(current_user, db, "generate_followup", prompt, request_id=request_id_for(request), organization_id=workspace.id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/api/generate-cover")
def generate_cover(req: CoverRequest, request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = f"""
    Write a professional and concise cover letter for an internship application.
    Company: {bounded_text(req.company, 160)}
    Role: {bounded_text(req.role, 200)}
    Job Description: {bounded_text(req.description, 16000)}
    Applicant Background: {bounded_text(req.context, 30000)}

    Keep it under 300 words. Focus on how the applicant's skills match the job description.
    """

    try:
        return {"text": generate_user_gemini_content(current_user, db, "generate_cover", prompt, request_id=request_id_for(request), organization_id=workspace.id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/api/company-intel")
def get_company_intel(req: IntelRequest, request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = f"""
    Provide professional insights for an internship/job applicant for the company '{bounded_text(req.company, 160)}' and role '{bounded_text(req.role, 200)}'.
    Return the response in EXACTLY this JSON format:
    {{
        "estimated_salary": "e.g., $35 - $55/hr",
        "culture_pros": ["pro 1", "pro 2"],
        "culture_cons": ["con 1", "con 2"],
        "interview_difficulty": "e.g., Medium-Hard",
        "recent_news": "Brief one sentence about recent company performance or news."
    }}
    Be concise and realistic. If unsure, provide best estimates based on industry standards for this company.
    Do not include any other text or markdown formatting outside the JSON.
    """

    try:
        content = generate_user_gemini_content(current_user, db, "company_intel", prompt, COMPANY_INTEL_SCHEMA, temperature=0.3, request_id=request_id_for(request), organization_id=workspace.id)
        parsed = extract_json_object(content)
        parsed["estimated_salary"] = parsed.get("estimated_salary") or "N/A"
        parsed["culture_pros"] = parsed.get("culture_pros") or []
        parsed["culture_cons"] = parsed.get("culture_cons") or []
        parsed["interview_difficulty"] = parsed.get("interview_difficulty") or "Unknown"
        parsed["recent_news"] = parsed.get("recent_news") or ""
        return parsed
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.get("/api/subscriptions")
def get_subs(workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(SearchSubscription).filter(SearchSubscription.organization_id == workspace.id).all()

@app.post("/api/subscriptions")
def add_sub(sub: SubscriptionCreate, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, EDIT_WORKSPACE_ROLES)
    payload = normalize_subscription_payload(sub)
    existing_subscriptions = db.query(SearchSubscription).filter(SearchSubscription.organization_id == workspace.id).all()
    if len(existing_subscriptions) >= 25:
        raise HTTPException(status_code=400, detail="You can have at most 25 active hunts")
    if any(
        normalize_spaces(existing.query) == normalize_spaces(payload["query"])
        and normalize_spaces(existing.location) == normalize_spaces(payload["location"])
        and existing.job_type == payload["job_type"]
        for existing in existing_subscriptions
    ):
        raise HTTPException(status_code=409, detail="That hunt is already active")
    new_sub = SearchSubscription(**payload, user_id=current_user.id, organization_id=workspace.id)
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    return new_sub

@app.delete("/api/subscriptions/{sub_id}")
def del_sub(sub_id: int, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, EDIT_WORKSPACE_ROLES)
    db_sub = db.query(SearchSubscription).filter(SearchSubscription.id == sub_id, SearchSubscription.organization_id == workspace.id).first()
    if not db_sub: raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(db_sub)
    db.commit()
    return {"message": "Unsubscribed"}

@app.post("/api/hunter/run")
def run_hunter(request: Request, workspace: Organization = Depends(get_current_workspace), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_workspace_role(db, workspace, current_user.id, EDIT_WORKSPACE_ROLES)
    user_rapid_key = get_rapidapi_key(current_user)

    subs = db.query(SearchSubscription).filter(SearchSubscription.organization_id == workspace.id).all()

    if not subs:
        add_usage_event(db, current_user.id, "hunter_run", request_id=request_id_for(request), details={"hunts": 0, "added": 0}, organization_id=workspace.id)
        db.commit()
        return {"message": "No active hunts. Add some keywords first!", "added": 0}

    existing_links = {
        normalize_job_link(j.link)
        for j in db.query(JobApplication).filter(JobApplication.organization_id == workspace.id).all()
        if j.link
    }
    new_jobs_count = 0
    failures = []

    for sub in subs:
        if sub.job_type not in VALID_JOB_TYPES:
            continue
        params = build_jsearch_params(sub.query, sub.location, "week", sub.job_type)

        try:
            response = request_jsearch("Auto-hunter search", user_rapid_key, params)
            if response.status_code == 200:
                data = extract_jsearch_jobs(response.json())
                for j in data:
                    link = j.get("job_apply_link") or j.get("job_google_link")
                    normalized_link = normalize_job_link(link)
                    if normalized_link and normalized_link not in existing_links:
                        new_job = JobApplication(
                            user_id=current_user.id,
                            organization_id=workspace.id,
                            company=bounded_text(j.get("employer_name"), 160) or "Unknown",
                            role=bounded_text(j.get("job_title"), 200) or "Role",
                            status="To Do",
                            source="Auto-Hunter",
                            applied_date=None,
                            location=f"{j.get('job_city') or ''}, {j.get('job_state') or ''}".strip(", "),
                            remote=bool(j.get("job_is_remote")),
                            link=normalized_link,
                            notes=bounded_text(j.get("job_description"), 200)
                        )
                        db.add(new_job)
                        db.flush()
                        add_initial_application_events(db, current_user.id, new_job)
                        existing_links.add(normalized_link)
                        new_jobs_count += 1
            else:
                _, detail = rapidapi_error_detail(response, "Auto-hunter search")
                failures.append({"query": sub.query, "status": response.status_code, "error": detail})
        except Exception as e:
            logger.warning("Hunter search failed query=%s error=%s", sub.query, str(e))
            failures.append({"query": sub.query, "error": "request failed"})

    add_usage_event(db, current_user.id, "hunter_run", request_id=request_id_for(request), details={"hunts": len(subs), "added": new_jobs_count, "failures": len(failures)}, organization_id=workspace.id)
    if new_jobs_count:
        add_usage_event(db, current_user.id, "hunter_jobs_added", units=new_jobs_count, request_id=request_id_for(request), organization_id=workspace.id)
    db.commit()
    message = f"Hunter finished! Found {new_jobs_count} new opportunities."
    if failures:
        message += f" {len(failures)} search(es) failed."
    return {"message": message, "added": new_jobs_count, "failures": failures}
