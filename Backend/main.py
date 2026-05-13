import os
import requests
from datetime import date, datetime, timedelta
from typing import Optional, List
import re
from html import unescape
from ipaddress import ip_address
from socket import getaddrinfo
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
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

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
APP_ENV = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()

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

if not SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./intern_tracker.db"

if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, pool_pre_ping=True)
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    enc_rapid_key = Column(String, nullable=True)
    enc_gemini_key = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    plan = Column(String, default="free")
    subscription_status = Column(String, default="free")
    current_period_end = Column(String, nullable=True)

class JobApplication(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    company = Column(String, index=True)
    role = Column(String)
    status = Column(String, default="To Do")
    source = Column(String)
    applied_date = Column(String, default=lambda: str(date.today()))
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
    activity_log = Column(Text, nullable=True)

class SearchSubscription(Base):
    __tablename__ = "search_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    query = Column(String)
    location = Column(String)
    job_type = Column(String, default="INTERN")

class UsageEvent(Base):
    __tablename__ = "usage_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    feature = Column(String, index=True)
    created_at = Column(String, index=True)

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
    username: str
    password: str

class KeysUpdate(BaseModel):
    rapid_key: Optional[str] = None
    gemini_key: Optional[str] = None

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
    activity_log: Optional[str] = None

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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        "stripe_customer_id": "VARCHAR",
        "stripe_subscription_id": "VARCHAR",
        "plan": "VARCHAR DEFAULT 'free'",
        "subscription_status": "VARCHAR DEFAULT 'free'",
        "current_period_end": "VARCHAR",
    }

    if not existing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in additions.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"))

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
migrate_removed_phone_screen_stage()

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
    return datetime.utcfromtimestamp(value).isoformat(timespec="seconds") + "Z"

def sync_user_subscription_from_stripe(user: User, subscription):
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
        "timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z"
    })
    return json.dumps(entries[-50:])

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

    if payload["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid application status")
    if payload["interview_stage"] not in VALID_INTERVIEW_STAGES:
        raise HTTPException(status_code=400, detail="Invalid interview stage")

    for key in [
        "applied_date", "deadline", "location", "link", "notes", "recruiter_name",
        "recruiter_email", "referral_name", "interview_stage", "next_action_date",
        "last_contact_date", "resume_version", "cover_letter_version"
    ]:
        if payload.get(key) == "":
            payload[key] = None

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

def find_duplicate_job(db: Session, user_id: int, payload: dict, ignore_job_id: Optional[int] = None):
    query = db.query(JobApplication).filter(JobApplication.user_id == user_id)
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

def duplicate_audit_for_user(db: Session, user_id: int):
    by_identity = {}
    for job in db.query(JobApplication).filter(JobApplication.user_id == user_id).all():
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
    now = datetime.utcnow()
    return datetime(now.year, now.month, 1).isoformat(timespec="seconds") + "Z"

def get_monthly_ai_usage(db: Session, user_id: int) -> int:
    return db.query(UsageEvent).filter(
        UsageEvent.user_id == user_id,
        UsageEvent.created_at >= current_month_start_iso(),
    ).count()

def record_ai_usage(db: Session, user_id: int, feature: str):
    db.add(UsageEvent(
        user_id=user_id,
        feature=feature,
        created_at=datetime.utcnow().isoformat(timespec="seconds") + "Z",
    ))
    db.commit()

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

def get_ai_usage_summary(current_user: User, db: Session):
    plan = normalize_plan(current_user.plan)
    used = get_monthly_ai_usage(db, current_user.id)
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
    }

def get_gemini_key_for_user(current_user: User, db: Session):
    plan = normalize_plan(current_user.plan)
    paid = is_paid_plan(plan)

    if paid and SERVER_GEMINI_API_KEY:
        used = get_monthly_ai_usage(db, current_user.id)
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

def validate_gemini_key(api_key: str):
    try:
        generate_gemini_content(api_key, "Reply with exactly: OK", temperature=0)
    except HTTPException as exc:
        raise HTTPException(status_code=exc.status_code, detail=f"Gemini key validation failed: {exc.detail}")

def validate_rapidapi_key(api_key: str):
    try:
        response = requests.get(
            "https://jsearch.p.rapidapi.com/search",
            headers={
                "X-RapidAPI-Key": api_key,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
            },
            params={
                "query": "software engineering intern in Remote",
                "page": "1",
                "num_pages": "1",
                "date_posted": "today",
                "employment_types": "INTERN",
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"RapidAPI validation request failed: {str(exc)}")

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=400, detail="RapidAPI key validation failed: key is invalid or does not have JSearch access.")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="RapidAPI key validation failed: quota or rate limit reached.")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"RapidAPI key validation failed with status {response.status_code}.")

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

def generate_user_gemini_content(current_user: User, db: Session, feature: str, prompt: str, schema: Optional[dict] = None, temperature: float = 0.4) -> str:
    api_key, records_usage = get_gemini_key_for_user(current_user, db)
    content = generate_gemini_content(api_key, prompt, schema, temperature)
    if records_usage:
        record_ai_usage(db, current_user.id, feature)
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
    url = ensure_public_http_url(url)
    try:
        response = requests.get(
            url,
            timeout=10,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            },
        )
        response.raise_for_status()
    except requests.RequestException as e:
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
        "link": url,
    }

@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "error"

    return {
        "status": "ok" if database == "ok" else "degraded",
        "database": database,
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

@app.post("/api/signup")
def signup(user: UserAuth, db: Session = Depends(get_db)):
    username = normalize_username(user.username)
    validate_password(user.password)
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username taken")
    hashed_pw = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_user = User(username=username, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    return {"message": "Success"}

@app.post("/api/login")
def login(user: UserAuth, db: Session = Depends(get_db)):
    username = normalize_username(user.username)
    db_user = db.query(User).filter(User.username == username).first()
    if not db_user or not bcrypt.checkpw(user.password.encode('utf-8'), db_user.hashed_password.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = jwt.encode({"sub": db_user.username, "exp": datetime.utcnow() + timedelta(days=7)}, JWT_SECRET, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer", "username": db_user.username}

@app.post("/api/update-keys")
def update_keys(keys: KeysUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rapid_key = (keys.rapid_key or "").strip()
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

@app.get("/api/billing/me")
def get_billing_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ai_summary = get_ai_usage_summary(current_user, db)
    return {
        **ai_summary,
        "subscription_status": current_user.subscription_status or "free",
        "current_period_end": current_user.current_period_end,
    }

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
def get_jobs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(JobApplication).filter(JobApplication.user_id == current_user.id).all()

@app.get("/api/jobs/duplicates")
def get_duplicate_jobs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return duplicate_audit_for_user(db, current_user.id)

@app.post("/api/jobs")
def create_job(job: JobCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payload = normalize_job_payload(job)
    duplicate = find_duplicate_job(db, current_user.id, payload)
    if duplicate:
        raise HTTPException(status_code=409, detail="This application is already being tracked")

    payload["activity_log"] = append_activity(None, f"Application created in {payload['status']}")
    if payload.get("source"):
        payload["activity_log"] = append_activity(payload["activity_log"], f"Source set to {payload['source']}")
    new_job = JobApplication(**payload, user_id=current_user.id)
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job

@app.put("/api/jobs/{job_id}")
def update_job(job_id: int, job: JobCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_job = db.query(JobApplication).filter(JobApplication.id == job_id, JobApplication.user_id == current_user.id).first()
    if not db_job: raise HTTPException(status_code=404, detail="Job not found")
    payload = normalize_job_payload(job)
    if job_identity_changed(db_job, payload):
        duplicate = find_duplicate_job(db, current_user.id, payload, ignore_job_id=job_id)
        if duplicate:
            raise HTTPException(status_code=409, detail="This application is already being tracked")

    activity_log = db_job.activity_log
    if db_job.status != payload["status"]:
        activity_log = append_activity(activity_log, f"Status changed from {db_job.status} to {payload['status']}")
    if db_job.interview_stage != payload.get("interview_stage"):
        next_stage = payload.get("interview_stage") or "None"
        activity_log = append_activity(activity_log, f"Interview stage updated to {next_stage}")
    if db_job.next_action_date != payload.get("next_action_date"):
        next_action = payload.get("next_action_date") or "cleared"
        activity_log = append_activity(activity_log, f"Next action date set to {next_action}")
    if db_job.follow_up_sent != payload.get("follow_up_sent"):
        activity_log = append_activity(activity_log, "Follow-up marked as sent" if payload.get("follow_up_sent") else "Follow-up marked as pending")
    if db_job.last_contact_date != payload.get("last_contact_date") and payload.get("last_contact_date"):
        activity_log = append_activity(activity_log, f"Last contact updated to {payload['last_contact_date']}")

    payload["activity_log"] = activity_log
    for key, value in payload.items():
        setattr(db_job, key, value)
    db.commit()
    db.refresh(db_job)
    return db_job

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_job = db.query(JobApplication).filter(JobApplication.id == job_id, JobApplication.user_id == current_user.id).first()
    if not db_job: raise HTTPException(status_code=404, detail="Job not found")
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
        return resp.json()
    except requests.RequestException:
        return {"_embedded": {"city:search-results": []}}

@app.post("/api/autofill-job-link")
def autofill_job_link(req: AutofillRequest, current_user: User = Depends(get_current_user)):
    url = (req.url or "").strip()
    return scrape_job_posting(url)

@app.get("/api/search")
def search_jobs(query: str, location: str, jobType: str, datePosted: str, current_user: User = Depends(get_current_user)):
    if not current_user.enc_rapid_key:
        raise HTTPException(status_code=400, detail="Add RapidAPI Key in Settings first")
    jobType = (jobType or "").strip().upper()
    datePosted = (datePosted or "").strip()
    if jobType not in VALID_JOB_TYPES:
        raise HTTPException(status_code=400, detail="Invalid job type")
    if datePosted not in VALID_DATE_POSTED:
        raise HTTPException(status_code=400, detail="Invalid date filter")
    
    try:
        user_rapid_key = cipher_suite.decrypt(current_user.enc_rapid_key.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=400, detail="Stored RapidAPI key could not be decrypted. Re-save your RapidAPI key in Settings.")

    url = "https://jsearch.p.rapidapi.com/search"
    params = {
        "query": f"{query.strip()[:120]} in {location.strip()[:120]}",
        "page": "1",
        "num_pages": "1",
        "date_posted": datePosted,
        "employment_types": jobType
    }
    headers = {
        "X-RapidAPI-Key": user_rapid_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="RapidAPI Error")
        
        data = response.json().get("data", [])
        results = []
        for j in data:
            results.append({
                "_id": j.get("job_id"),
                "company": j.get("employer_name", "Unknown"),
                "role": j.get("job_title", "Role"),
                "source": "Search",
                "remote": bool(j.get("job_is_remote")),
                "location": f"{j.get('job_city', '')}, {j.get('job_state', '')}".strip(", "),
                "posted": j.get("job_posted_at_datetime_utc", "")[:10],
                "link": j.get("job_apply_link") or j.get("job_google_link"),
                "desc": j.get("job_description", "")
            })
        return results
    except HTTPException:
        raise
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"RapidAPI request failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/resume-match")
def resume_match(req: ResumeMatchRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = f"""
    You are evaluating a candidate's resume against an internship posting.
    Company: {req.company}
    Role: {req.role}
    Job Description: {req.description}
    Resume Context: {req.context}

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
        content = generate_user_gemini_content(current_user, db, "resume_match", prompt, RESUME_MATCH_SCHEMA, temperature=0.2)
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

@app.post("/api/generate-followup")
def generate_followup(req: FollowUpRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = f"""
    Write a concise, professional follow-up email for a job applicant.
    Company: {req.company}
    Role: {req.role}
    Current Status: {req.status}
    Recruiter Name: {req.recruiter_name or "Hiring Team"}
    Last Contact Date: {req.last_contact_date or "Unknown"}
    Next Action Date: {req.next_action_date or "Not set"}
    Notes: {req.notes or "None"}
    Applicant Background: {req.context}

    Keep it under 180 words.
    Include a subject line on the first line in the format: Subject: ...
    Then include the email body.
    Make it polite, specific, and not overly formal.
    """

    try:
        return {"text": generate_user_gemini_content(current_user, db, "generate_followup", prompt)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/api/generate-cover")
def generate_cover(req: CoverRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = f"""
    Write a professional and concise cover letter for an internship application.
    Company: {req.company}
    Role: {req.role}
    Job Description: {req.description}
    Applicant Background: {req.context}
    
    Keep it under 300 words. Focus on how the applicant's skills match the job description.
    """
    
    try:
        return {"text": generate_user_gemini_content(current_user, db, "generate_cover", prompt)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/api/company-intel")
def get_company_intel(req: IntelRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = f"""
    Provide professional insights for an internship/job applicant for the company '{req.company}' and role '{req.role}'.
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
        content = generate_user_gemini_content(current_user, db, "company_intel", prompt, COMPANY_INTEL_SCHEMA, temperature=0.3)
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
def get_subs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(SearchSubscription).filter(SearchSubscription.user_id == current_user.id).all()

@app.post("/api/subscriptions")
def add_sub(sub: SubscriptionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payload = normalize_subscription_payload(sub)
    new_sub = SearchSubscription(**payload, user_id=current_user.id)
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    return new_sub

@app.delete("/api/subscriptions/{sub_id}")
def del_sub(sub_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_sub = db.query(SearchSubscription).filter(SearchSubscription.id == sub_id, SearchSubscription.user_id == current_user.id).first()
    if not db_sub: raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(db_sub)
    db.commit()
    return {"message": "Unsubscribed"}

@app.post("/api/hunter/run")
def run_hunter(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.enc_rapid_key:
        raise HTTPException(status_code=400, detail="Add RapidAPI Key in Settings first")
    
    try:
        user_rapid_key = cipher_suite.decrypt(current_user.enc_rapid_key.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=400, detail="Stored RapidAPI key could not be decrypted. Re-save your RapidAPI key in Settings.")

    subs = db.query(SearchSubscription).filter(SearchSubscription.user_id == current_user.id).all()
    
    if not subs:
        return {"message": "No active hunts. Add some keywords first!", "added": 0}

    existing_links = {j.link for j in db.query(JobApplication).filter(JobApplication.user_id == current_user.id).all() if j.link}
    new_jobs_count = 0

    for sub in subs:
        if sub.job_type not in VALID_JOB_TYPES:
            continue
        url = "https://jsearch.p.rapidapi.com/search"
        params = {"query": f"{sub.query} in {sub.location}", "page": "1", "num_pages": "1", "date_posted": "week", "employment_types": sub.job_type}
        headers = {"X-RapidAPI-Key": user_rapid_key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com"}
        
        try:
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json().get("data", [])
                for j in data:
                    link = j.get("job_apply_link") or j.get("job_google_link")
                    if link and link not in existing_links:
                        new_job = JobApplication(
                            user_id=current_user.id,
                            company=j.get("employer_name", "Unknown"),
                            role=j.get("job_title", "Role"),
                            status="To Do",
                            source="Auto-Hunter",
                            applied_date=str(date.today()),
                            location=f"{j.get('job_city', '')}, {j.get('job_state', '')}".strip(", "),
                            remote=bool(j.get("job_is_remote")),
                            link=link,
                            notes=(j.get("job_description") or "")[:200]
                        )
                        db.add(new_job)
                        existing_links.add(link)
                        new_jobs_count += 1
        except Exception as e:
            print(f"Hunter failed for {sub.query}: {str(e)}")

    db.commit()
    return {"message": f"Hunter finished! Found {new_jobs_count} new opportunities.", "added": new_jobs_count}
