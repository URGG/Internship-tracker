import os
import requests
from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Query
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
import google.generativeai as genai
import json

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

if not JWT_SECRET or not ENCRYPTION_KEY:
    raise RuntimeError("CRITICAL: Missing JWT_SECRET or ENCRYPTION_KEY in .env file.")

cipher_suite = Fernet(ENCRYPTION_KEY.encode())
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./intern_tracker.db"

if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    enc_rapid_key = Column(String, nullable=True)
    enc_gemini_key = Column(String, nullable=True)

class JobApplication(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    company = Column(String, index=True)
    role = Column(String)
    status = Column(String, default="To Do")
    source = Column(String)
    applied_date = Column(String, default=str(date.today()))
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

VALID_STATUSES = {"To Do", "Applied", "Phone Screen", "Interview", "Offer", "Rejected"}
VALID_INTERVIEW_STAGES = {"", "Online Assessment", "Recruiter Screen", "Phone Screen", "Technical", "Behavioral", "Final Round", "Take Home"}

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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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

Base.metadata.create_all(bind=engine)
ensure_job_application_columns()

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

def normalize_job_payload(job: JobCreate):
    payload = job.dict()
    payload["company"] = payload["company"].strip()
    payload["role"] = payload["role"].strip()
    payload["status"] = payload["status"].strip()
    payload["source"] = (payload["source"] or "Other").strip() or "Other"
    payload["interview_stage"] = (payload["interview_stage"] or "").strip()

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

    payload["activity_log"] = payload.get("activity_log") or None

    return payload

def find_duplicate_job(db: Session, user_id: int, payload: dict, ignore_job_id: Optional[int] = None):
    query = db.query(JobApplication).filter(JobApplication.user_id == user_id)
    if ignore_job_id is not None:
        query = query.filter(JobApplication.id != ignore_job_id)

    if payload.get("link"):
        duplicate = query.filter(JobApplication.link == payload["link"]).first()
        if duplicate:
            return duplicate

    normalized_company = payload["company"].lower()
    normalized_role = payload["role"].lower()
    candidates = query.filter(JobApplication.company == payload["company"], JobApplication.role == payload["role"]).all()
    for candidate in candidates:
        if candidate.company.lower() == normalized_company and candidate.role.lower() == normalized_role:
            return candidate
    return None

@app.post("/api/signup")
def signup(user: UserAuth, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username taken")
    hashed_pw = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_user = User(username=user.username, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    return {"message": "Success"}

@app.post("/api/login")
def login(user: UserAuth, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not bcrypt.checkpw(user.password.encode('utf-8'), db_user.hashed_password.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = jwt.encode({"sub": db_user.username, "exp": datetime.utcnow() + timedelta(days=7)}, JWT_SECRET, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer", "username": db_user.username}

@app.post("/api/update-keys")
def update_keys(keys: KeysUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if keys.rapid_key:
        current_user.enc_rapid_key = cipher_suite.encrypt(keys.rapid_key.encode()).decode()
    if keys.gemini_key:
        current_user.enc_gemini_key = cipher_suite.encrypt(keys.gemini_key.encode()).decode()
    db.commit()
    return {"message": "Keys secured"}

@app.get("/api/jobs")
def get_jobs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(JobApplication).filter(JobApplication.user_id == current_user.id).all()

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
    try:
        url = f"https://api.teleport.org/api/cities/?search={q}"
        resp = requests.get(url, timeout=5)
        return resp.json()
    except Exception as e:
        return {"_embedded": {"city:search-results": []}}

@app.get("/api/search")
def search_jobs(query: str, location: str, jobType: str, datePosted: str, current_user: User = Depends(get_current_user)):
    if not current_user.enc_rapid_key:
        raise HTTPException(status_code=400, detail="Add RapidAPI Key in Settings first")
    
    user_rapid_key = cipher_suite.decrypt(current_user.enc_rapid_key.encode()).decode()
    url = "https://jsearch.p.rapidapi.com/search"
    params = {
        "query": f"{query} in {location}",
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-cover")
def generate_cover(req: CoverRequest, current_user: User = Depends(get_current_user)):
    if not current_user.enc_gemini_key:
        raise HTTPException(status_code=400, detail="Add Gemini API Key in Settings first")
    
    gemini_key = cipher_suite.decrypt(current_user.enc_gemini_key.encode()).decode()
    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""
    Write a professional and concise cover letter for an internship application.
    Company: {req.company}
    Role: {req.role}
    Job Description: {req.description}
    Applicant Background: {req.context}
    
    Keep it under 300 words. Focus on how the applicant's skills match the job description.
    """
    
    try:
        response = model.generate_content(prompt)
        return {"text": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/api/company-intel")
def get_company_intel(req: IntelRequest, current_user: User = Depends(get_current_user)):
    if not current_user.enc_gemini_key:
        raise HTTPException(status_code=400, detail="Add Gemini API Key in Settings first")
    
    gemini_key = cipher_suite.decrypt(current_user.enc_gemini_key.encode()).decode()
    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
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
        response = model.generate_content(prompt)
        content = response.text.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        return json.loads(content)
    except Exception as e:
        return {
            "estimated_salary": "N/A",
            "culture_pros": ["Could not fetch intel"],
            "culture_cons": ["Please check manually"],
            "interview_difficulty": "Unknown",
            "recent_news": f"Error: {str(e)}"
        }

@app.get("/api/subscriptions")
def get_subs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(SearchSubscription).filter(SearchSubscription.user_id == current_user.id).all()

@app.post("/api/subscriptions")
def add_sub(sub: SubscriptionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_sub = SearchSubscription(**sub.dict(), user_id=current_user.id)
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
    
    user_rapid_key = cipher_suite.decrypt(current_user.enc_rapid_key.encode()).decode()
    subs = db.query(SearchSubscription).filter(SearchSubscription.user_id == current_user.id).all()
    
    if not subs:
        return {"message": "No active hunts. Add some keywords first!", "added": 0}

    existing_links = {j.link for j in db.query(JobApplication).filter(JobApplication.user_id == current_user.id).all() if j.link}
    new_jobs_count = 0

    for sub in subs:
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
