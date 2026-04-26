import os
import requests
from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import jwt
import bcrypt
from cryptography.fernet import Fernet
from cryptography.fernet import InvalidToken
from dotenv import load_dotenv
import google.generativeai as genai


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

class SearchSubscription(Base):
    __tablename__ = "search_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    query = Column(String)
    location = Column(String)
    job_type = Column(String, default="INTERN")

Base.metadata.create_all(bind=engine)

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

class CoverRequest(BaseModel):
    company: str
    role: str
    description: str
    context: str

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
    new_job = JobApplication(**job.dict(), user_id=current_user.id)
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job

@app.put("/api/jobs/{job_id}")
def update_job(job_id: int, job: JobCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_job = db.query(JobApplication).filter(JobApplication.id == job_id, JobApplication.user_id == current_user.id).first()
    if not db_job: raise HTTPException(status_code=404, detail="Job not found")
    for key, value in job.dict().items():
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

@app.get("/api/search")
def search_jobs(query: str, location: str, jobType: str, datePosted: str, current_user: User = Depends(get_current_user)):
    if not current_user.enc_rapid_key:
        raise HTTPException(status_code=400, detail="Missing RapidAPI Key")
    try:
        user_rapid_key = cipher_suite.decrypt(current_user.enc_rapid_key.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Key decryption failed")
    
    url = "https://jsearch.p.rapidapi.com/search"
    params = {"query": f"{query} in {location}", "page": "1", "num_pages": "1", "date_posted": datePosted, "employment_types": jobType}
    headers = {"X-RapidAPI-Key": user_rapid_key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com"}
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code != 200: raise HTTPException(status_code=response.status_code, detail=response.text)
    data = response.json().get("data", [])
    
    return [{
        "_id": j.get("job_id"), "company": j.get("employer_name", "Unknown"), "role": j.get("job_title", "Role"),
        "location": f"{j.get('job_city', '')}, {j.get('job_state', '')}".strip(", "), "remote": bool(j.get("job_is_remote")),
        "link": j.get("job_apply_link") or j.get("job_google_link"), "source": "Search",
        "posted": (j.get("job_posted_at_datetime_utc") or "")[:10], "desc": (j.get("job_description") or "")[:400]
    } for j in data]

@app.post("/api/generate-cover")
def generate_cover(req: CoverRequest, current_user: User = Depends(get_current_user)):
    # ... (existing code)
    pass

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

    # Get existing links to avoid duplicates
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