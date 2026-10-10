import os
import sys
import json
import base64
import hashlib
import hmac
import struct
import time
from pathlib import Path

os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{(Path(__file__).resolve().parents[1] / 'test-ci.db').as_posix()}")
os.environ.setdefault("JWT_SECRET", "ci-only-jwt-secret-that-is-long-enough")
os.environ.setdefault("ENCRYPTION_KEY", "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=")
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import (  # noqa: E402
    ApplicationEvent,
    JobApplication,
    Organization,
    OrganizationInvitation,
    OrganizationMember,
    AuthSession,
    SecurityToken,
    PrivacyPreference,
    PrivacyRequest,
    LegalAcceptance,
    SearchSubscription,
    SessionLocal,
    User,
    UsageEvent,
    add_initial_application_events,
    add_usage_event,
    build_analytics_payload,
    get_monthly_usage_breakdown,
    hash_security_token,
    normalize_job_link,
    normalize_job_payload,
    normalize_rapidapi_key,
    extract_jsearch_jobs,
    build_search_result,
    deduplicate_search_results,
    rapidapi_error_detail,
    JobCreate,
)
from fastapi.testclient import TestClient


def totp_code(secret):
    key = base64.b32decode(secret + "=" * ((8 - len(secret) % 8) % 8), casefold=True)
    counter = int(time.time() // 30)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    index = digest[-1] & 0x0F
    number = (struct.unpack(">I", digest[index:index + 4])[0] & 0x7FFFFFFF) % 1000000
    return f"{number:06d}"


def clear_database(db):
    db.query(PrivacyRequest).delete()
    db.query(PrivacyPreference).delete()
    db.query(SecurityToken).delete()
    db.query(AuthSession).delete()
    db.query(LegalAcceptance).delete()
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
        db.add(PrivacyPreference(user_id=user.id, analytics=True, updated_at="2026-10-09T00:00:00Z"))
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


def test_rapidapi_key_normalization_supports_common_copy_formats():
    assert normalize_rapidapi_key("  Bearer 'rapid-key'  ") == "rapid-key"
    assert normalize_rapidapi_key("X-RapidAPI-Key: rapid-key") == "rapid-key"


def test_rapidapi_errors_are_actionable_and_do_not_leak_upstream_details():
    class Response:
        def __init__(self, status_code):
            self.status_code = status_code

    invalid_status, invalid_detail = rapidapi_error_detail(Response(401), "Job search")
    missing_status, missing_detail = rapidapi_error_detail(Response(404), "Job search")

    assert invalid_status == 400
    assert "subscribed to JSearch" in invalid_detail
    assert missing_status == 502
    assert "HTTP 404" in missing_detail


def test_jsearch_search_v2_response_shape_is_normalized():
    job = {"job_id": "job-1", "job_title": "Software Engineer"}
    assert extract_jsearch_jobs({"status": "OK", "data": {"cursor": "next", "jobs": [job]}}) == [job]
    assert extract_jsearch_jobs({"status": "OK", "data": [job]}) == [job]


def test_provider_results_are_normalized_and_deduplicated_across_sources():
    first = build_search_result(
        provider="JSearch",
        provider_job_id="j-1",
        company="Acme",
        role="Software Intern",
        location="Remote",
        remote=True,
        posted="2026-10-06T00:00:00Z",
        link="https://jobs.example.com/1/?utm_source=test",
        source_url="https://jobs.example.com/1",
        description="Build things.",
        source_terms_url="https://example.com/terms",
        source_attribution="JSearch",
    )
    duplicate = {**first, "provider": "usajobs", "source": "USAJOBS", "_id": "USAJOBS:1"}
    results = deduplicate_search_results([first, duplicate])
    assert len(results) == 1
    assert results[0]["link"] == "https://jobs.example.com/1"
    assert results[0]["fetched_at"]


def test_api_records_events_and_exposes_authoritative_analytics():
    db = SessionLocal()
    clear_database(db)
    db.close()
    client = TestClient(__import__("main").app)

    assert client.post("/api/signup", json={"username": "api-test", "password": "password123"}).status_code == 200
    login = client.post("/api/login", json={"username": "api-test", "password": "password123"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    profile = client.put("/api/profile", headers=headers, json={
        "first_name": "Api",
        "last_name": "Tester",
        "email": "api-test@example.com",
        "phone": "555-0100",
        "school": "State University",
        "degree": "B.S.",
        "major": "Computer Science",
        "work_authorization": "Authorized to work in the United States",
        "resume_text": "Built a student project.",
    })
    assert profile.status_code == 200
    assert client.get("/api/profile", headers=headers).json()["profile"]["school"] == "State University"

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


def test_email_login_and_saved_data_survive_a_fresh_client():
    db = SessionLocal()
    clear_database(db)
    db.close()
    app = __import__("main").app

    signup = TestClient(app)
    assert signup.post("/api/signup", json={
        "username": "email-login-test",
        "email": "email-login@example.com",
        "password": "password123",
    }).status_code == 200
    login = signup.post("/api/login", json={"email": "EMAIL-LOGIN@EXAMPLE.COM", "password": "password123"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    created = signup.post("/api/jobs", headers=headers, json={
        "company": "Persistence Co",
        "role": "Software Intern",
        "status": "Applied",
        "source": "LinkedIn",
    })
    assert created.status_code == 200

    fresh_client = TestClient(app)
    jobs = fresh_client.get("/api/jobs", headers=headers)
    assert jobs.status_code == 200
    assert [(job["company"], job["role"]) for job in jobs.json()] == [("Persistence Co", "Software Intern")]


def test_health_reports_required_schema():
    db = SessionLocal()
    try:
        response = __import__("main").health(db)
        assert response.status_code == 200
        body = json.loads(response.body)
        assert body["database"] == "ok"
        assert all(body["schema"].values())
    finally:
        db.close()


def test_mfa_is_optional_until_enabled_and_then_required_at_login():
    db = SessionLocal()
    clear_database(db)
    db.close()
    client = TestClient(__import__("main").app)

    assert client.post("/api/signup", json={"username": "mfa-test", "password": "password123"}).status_code == 200
    initial_login = client.post("/api/login", json={"username": "mfa-test", "password": "password123"})
    assert initial_login.status_code == 200
    headers = {"Authorization": f"Bearer {initial_login.json()['access_token']}"}

    setup = client.post("/api/security/mfa/setup", headers=headers)
    assert setup.status_code == 200
    code = totp_code(setup.json()["secret"])
    enabled = client.post("/api/security/mfa/enable", headers=headers, params={"code": code})
    assert enabled.status_code == 200

    missing_code = client.post("/api/login", json={"username": "mfa-test", "password": "password123"})
    assert missing_code.status_code == 401
    assert "MFA" in missing_code.json()["detail"]

    login_with_mfa = client.post("/api/login", json={"username": "mfa-test", "password": "password123", "mfa_code": totp_code(setup.json()["secret"])})
    assert login_with_mfa.status_code == 200

    disabled = client.post("/api/security/mfa/disable", headers=headers, params={"code": totp_code(setup.json()["secret"])})
    assert disabled.status_code == 200
    assert client.post("/api/login", json={"username": "mfa-test", "password": "password123"}).status_code == 200


def test_username_recovery_returns_generic_result_for_known_and_unknown_email():
    db = SessionLocal()
    clear_database(db)
    db.close()
    client = TestClient(__import__("main").app)

    assert client.post("/api/signup", json={"username": "recovery-test", "email": "recovery@example.com", "password": "password123"}).status_code == 200
    known = client.post("/api/security/username-recovery/request", json={"email": "recovery@example.com"})
    unknown = client.post("/api/security/username-recovery/request", json={"email": "nobody@example.com"})

    assert known.status_code == 200
    assert unknown.status_code == 200
    assert known.json()["message"] == unknown.json()["message"]


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
    raw_invitation_token = invitation.json()["invite_url"].split("invite=", 1)[1]
    db = SessionLocal()
    try:
        stored_invitation = db.query(OrganizationInvitation).filter(OrganizationInvitation.id == invitation.json()["id"]).first()
        assert stored_invitation.token == hash_security_token(raw_invitation_token)
        assert stored_invitation.token != raw_invitation_token
    finally:
        db.close()
    assert client.post("/api/signup", json={"username": "invited-user", "email": "invited@example.com", "password": "password123"}).status_code == 200
    invited_login = client.post("/api/login", json={"email": "invited@example.com", "password": "password123"})
    invited_headers = {"Authorization": f"Bearer {invited_login.json()['access_token']}"}
    accepted = client.post("/api/workspace-invitations/accept", headers=invited_headers, json={"token": raw_invitation_token})
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
