import os
import sys
import json

os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DATABASE_URL", "sqlite:///./Backend/test-ci.db")
os.environ.setdefault("JWT_SECRET", "ci-only-jwt-secret-that-is-long-enough")
os.environ.setdefault("ENCRYPTION_KEY", "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=")
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import (  # noqa: E402
    ApplicationEvent,
    JobApplication,
    Organization,
    OrganizationInvitation,
    OrganizationMember,
    SearchSubscription,
    SessionLocal,
    User,
    UsageEvent,
    add_initial_application_events,
    add_usage_event,
    build_analytics_payload,
    get_monthly_usage_breakdown,
    normalize_job_link,
    normalize_job_payload,
    JobCreate,
)
from fastapi.testclient import TestClient


def clear_database(db):
    db.query(ApplicationEvent).delete()
    db.query(UsageEvent).delete()
    db.query(SearchSubscription).delete()
    db.query(JobApplication).delete()
    db.query(OrganizationInvitation).delete()
    db.query(OrganizationMember).delete()
    db.query(Organization).delete()
    db.query(User).delete()
    db.commit()


def test_job_normalization_keeps_leads_out_of_submitted_metrics():
    lead = normalize_job_payload(JobCreate(company="  Acme  ", role=" SWE Intern ", status="To Do", source="Search"))
    submitted = normalize_job_payload(JobCreate(company="Acme", role="SWE Intern", status="Applied", source="Search"))

    assert lead["company"] == "Acme"
    assert lead["applied_date"] is None
    assert submitted["applied_date"]


def test_analytics_uses_event_history_and_explicit_denominators():
    db = SessionLocal()
    clear_database(db)
    try:
        user = User(username="analytics-test", hashed_password="test")
        db.add(user)
        db.flush()
        job = JobApplication(
            user_id=user.id,
            company="Acme",
            role="SWE Intern",
            status="Interview",
            source="LinkedIn",
            applied_date="2026-08-01",
            last_contact_date="2026-08-04",
        )
        db.add(job)
        db.flush()
        add_initial_application_events(db, user.id, job)
        db.commit()

        analytics = build_analytics_payload(db, user.id)
        assert analytics["submitted"] == 1
        assert analytics["responses"] == 1
        assert analytics["interviews"] == 1
        assert analytics["responseRate"] == "100.0"
        assert analytics["avgDaysToResponse"] == "3.0"
        assert analytics["metricDefinitions"]["responseRate"]
    finally:
        clear_database(db)
        db.close()


def test_product_usage_tracks_units_separately_from_ai():
    db = SessionLocal()
    clear_database(db)
    try:
        user = User(username="usage-test", hashed_password="test")
        db.add(user)
        db.flush()
        add_usage_event(db, user.id, "job_search", details={"results": 12})
        add_usage_event(db, user.id, "hunter_jobs_added", units=4)
        add_usage_event(db, user.id, "generate_cover", category="ai", provider="gemini")
        db.commit()

        usage = get_monthly_usage_breakdown(db, user.id)
        assert usage["product"]["job_search"] == 1
        assert usage["product"]["hunter_jobs_added"] == 4
        assert usage["ai"]["generate_cover"] == 1
    finally:
        clear_database(db)
        db.close()


def test_job_links_remove_tracking_parameters():
    assert normalize_job_link("https://www.example.com/jobs/42/?utm_source=linkedin&ref=feed") == "https://example.com/jobs/42"


def test_api_records_events_and_exposes_authoritative_analytics():
    db = SessionLocal()
    clear_database(db)
    db.close()
    client = TestClient(__import__("main").app)

    assert client.post("/api/signup", json={"username": "api-test", "password": "password123"}).status_code == 200
    login = client.post("/api/login", json={"username": "api-test", "password": "password123"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    lead = client.post("/api/jobs", headers=headers, json={
        "company": "Lead Co", "role": "Design Intern", "status": "To Do", "source": "Search",
    })
    submitted = client.post("/api/jobs", headers=headers, json={
        "company": "Applied Co", "role": "SWE Intern", "status": "Applied", "source": "LinkedIn",
    })
    assert lead.status_code == 200
    assert submitted.status_code == 200

    analytics = client.get("/api/analytics", headers=headers)
    assert analytics.status_code == 200
    assert analytics.headers.get("X-Request-ID")
    body = analytics.json()
    assert body["total"] == 2
    assert body["submitted"] == 1
    assert body["responseRate"] == "0.0"


def test_workspace_members_share_only_the_selected_workspace(monkeypatch):
    db = SessionLocal()
    clear_database(db)
    db.close()
    client = TestClient(__import__("main").app)

    owner_signup = client.post("/api/signup", json={"username": "workspace-owner", "email": "owner@example.com", "password": "password123"})
    member_signup = client.post("/api/signup", json={"username": "workspace-member", "email": "member@example.com", "password": "password123"})
    assert owner_signup.status_code == 200
    assert member_signup.status_code == 200

    owner_login = client.post("/api/login", json={"email": "owner@example.com", "password": "password123"})
    member_login = client.post("/api/login", json={"email": "member@example.com", "password": "password123"})
    owner_headers = {"Authorization": f"Bearer {owner_login.json()['access_token']}"}
    member_headers = {"Authorization": f"Bearer {member_login.json()['access_token']}"}
    owner_workspace = client.get("/api/workspaces", headers=owner_headers).json()[0]
    owner_scope = {**owner_headers, "X-Workspace-ID": str(owner_workspace["id"])}

    created = client.post("/api/jobs", headers=owner_scope, json={
        "company": "Shared Co", "role": "Product Intern", "status": "To Do", "source": "Referral",
    })
    assert created.status_code == 200
    monkeypatch.setattr(__import__("main"), "generate_user_gemini_content", lambda *args, **kwargs: json.dumps({
        "score": 84,
        "summary": "Strong product and communication fit.",
        "missing_keywords": ["experimentation"],
        "tailored_bullets": ["Built a product prototype from user feedback."],
        "cover_letter": "Dear Hiring Team,\nI am excited to apply.",
        "application_answers": [{"question": "Why this role?", "answer": "I enjoy building useful products."}],
        "interview_questions": [{"question": "Tell me about a project.", "focus": "Use a clear STAR story."}],
        "next_actions": ["Review the missing keyword."],
    }))
    packet = client.post("/api/application-packet", headers=owner_scope, json={
        "application_id": created.json()["id"],
        "company": "Shared Co",
        "role": "Product Intern",
        "description": "Build products with users.",
        "context": "Product and communication experience.",
    })
    assert packet.status_code == 200
    assert packet.json()["score"] == 84
    assert client.get("/api/jobs", headers=owner_scope).json()[0]["application_packet"]
    member_workspace = client.get("/api/workspaces", headers=member_headers).json()[0]
    member_scope = {**member_headers, "X-Workspace-ID": str(member_workspace["id"])}
    blocked_packet = client.post("/api/application-packet", headers=member_scope, json={
        "application_id": created.json()["id"],
        "company": "Shared Co",
        "role": "Product Intern",
        "description": "Build products with users.",
        "context": "Product and communication experience.",
    })
    assert blocked_packet.status_code == 404
    assert client.post("/api/workspaces/%s/members" % owner_workspace["id"], headers=owner_scope, json={"username": "member@example.com", "role": "member"}).status_code == 200
    invitation = client.post("/api/workspaces/%s/invitations" % owner_workspace["id"], headers=owner_scope, json={"email": "invited@example.com", "role": "viewer"})
    assert invitation.status_code == 200
    assert "invite=" in invitation.json()["invite_url"]
    assert client.post("/api/signup", json={"username": "invited-user", "email": "invited@example.com", "password": "password123"}).status_code == 200
    invited_login = client.post("/api/login", json={"email": "invited@example.com", "password": "password123"})
    invited_headers = {"Authorization": f"Bearer {invited_login.json()['access_token']}"}
    accepted = client.post("/api/workspace-invitations/accept", headers=invited_headers, json={"token": invitation.json()["invite_url"].split("invite=", 1)[1]})
    assert accepted.status_code == 200
    assert accepted.json()["id"] == owner_workspace["id"]

    member_workspaces = client.get("/api/workspaces", headers=member_headers).json()
    shared_workspace = next(workspace for workspace in member_workspaces if workspace["id"] == owner_workspace["id"])
    member_scope = {**member_headers, "X-Workspace-ID": str(shared_workspace["id"])}
    shared_jobs = client.get("/api/jobs", headers=member_scope)
    assert shared_jobs.status_code == 200
    assert len(shared_jobs.json()) == 1
    assert shared_jobs.json()[0]["company"] == "Shared Co"

    member_id = next(member["user_id"] for member in client.get("/api/workspaces/%s/members" % owner_workspace["id"], headers=owner_scope).json() if member["username"] == "workspace-member")
    assert client.patch("/api/workspaces/%s/members/%s" % (owner_workspace["id"], member_id), headers=owner_scope, json={"role": "viewer"}).status_code == 200
    assert client.post("/api/application-packet", headers=member_scope, json={
        "application_id": created.json()["id"],
        "company": "Shared Co",
        "role": "Product Intern",
        "description": "Build products with users.",
        "context": "Product and communication experience.",
    }).status_code == 403
    assert client.post("/api/jobs", headers=member_scope, json={
        "company": "Viewer Co", "role": "Research Intern", "status": "To Do", "source": "Referral",
    }).status_code == 403

    own_workspace = next(workspace for workspace in member_workspaces if workspace["id"] != shared_workspace["id"])
    own_jobs = client.get("/api/jobs", headers={**member_headers, "X-Workspace-ID": str(own_workspace["id"])})
    assert own_jobs.status_code == 200
    assert own_jobs.json() == []
