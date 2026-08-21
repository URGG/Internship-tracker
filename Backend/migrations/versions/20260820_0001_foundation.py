"""Create the production event and usage ledger foundation.

This migration is intentionally idempotent so it can be applied to both a
fresh database and an older database created by the original application.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260820_0001"
down_revision = None
branch_labels = None
depends_on = None


def _columns(bind, table_name):
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)} if inspector.has_table(table_name) else set()


def _add_missing_columns(bind, table_name, columns):
    for name, column in columns.items():
        if name not in _columns(bind, table_name):
            op.add_column(table_name, column)


def _create_index_if_missing(bind, name, table_name, columns):
    if name not in {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}:
        op.create_index(name, table_name, columns)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("username", sa.String(), nullable=True),
            sa.Column("email", sa.String(), nullable=True),
            sa.Column("hashed_password", sa.String(), nullable=True),
            sa.Column("enc_rapid_key", sa.String(), nullable=True),
            sa.Column("enc_gemini_key", sa.String(), nullable=True),
            sa.Column("stripe_customer_id", sa.String(), nullable=True),
            sa.Column("stripe_subscription_id", sa.String(), nullable=True),
            sa.Column("plan", sa.String(), server_default="free"),
            sa.Column("subscription_status", sa.String(), server_default="free"),
            sa.Column("current_period_end", sa.String(), nullable=True),
        )
    else:
        _add_missing_columns(bind, "users", {
            "email": sa.Column("email", sa.String(), nullable=True),
        })

    if not inspector.has_table("organizations"):
        op.create_table(
            "organizations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("slug", sa.String(), nullable=False),
            sa.Column("owner_id", sa.Integer(), nullable=True),
            sa.Column("plan", sa.String(), server_default="free"),
            sa.Column("created_at", sa.String(), nullable=False),
        )

    if not inspector.has_table("organization_members"):
        op.create_table(
            "organization_members",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("organization_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("role", sa.String(), server_default="member"),
            sa.Column("status", sa.String(), server_default="active"),
            sa.Column("created_at", sa.String(), nullable=False),
        )

    if not inspector.has_table("organization_invitations"):
        op.create_table(
            "organization_invitations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("organization_id", sa.Integer(), nullable=False),
            sa.Column("invited_by", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("role", sa.String(), server_default="member"),
            sa.Column("token", sa.String(), nullable=False),
            sa.Column("expires_at", sa.String(), nullable=False),
            sa.Column("accepted_at", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
        )

    if not inspector.has_table("applications"):
        op.create_table(
            "applications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("organization_id", sa.Integer(), nullable=True),
            sa.Column("company", sa.String(), nullable=True),
            sa.Column("role", sa.String(), nullable=True),
            sa.Column("status", sa.String(), server_default="To Do"),
            sa.Column("source", sa.String(), nullable=True),
            sa.Column("applied_date", sa.String(), nullable=True),
            sa.Column("deadline", sa.String(), nullable=True),
            sa.Column("location", sa.String(), nullable=True),
            sa.Column("remote", sa.Boolean(), server_default=sa.false()),
            sa.Column("link", sa.String(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("recruiter_name", sa.String(), nullable=True),
            sa.Column("recruiter_email", sa.String(), nullable=True),
            sa.Column("referral_name", sa.String(), nullable=True),
            sa.Column("interview_stage", sa.String(), nullable=True),
            sa.Column("next_action_date", sa.String(), nullable=True),
            sa.Column("follow_up_sent", sa.Boolean(), server_default=sa.false()),
            sa.Column("last_contact_date", sa.String(), nullable=True),
            sa.Column("resume_version", sa.String(), nullable=True),
            sa.Column("cover_letter_version", sa.String(), nullable=True),
            sa.Column("activity_log", sa.Text(), nullable=True),
        )
    else:
        _add_missing_columns(bind, "applications", {
            "organization_id": sa.Column("organization_id", sa.Integer(), nullable=True),
            "recruiter_name": sa.Column("recruiter_name", sa.String(), nullable=True),
            "recruiter_email": sa.Column("recruiter_email", sa.String(), nullable=True),
            "referral_name": sa.Column("referral_name", sa.String(), nullable=True),
            "interview_stage": sa.Column("interview_stage", sa.String(), nullable=True),
            "next_action_date": sa.Column("next_action_date", sa.String(), nullable=True),
            "follow_up_sent": sa.Column("follow_up_sent", sa.Boolean(), server_default=sa.false()),
            "last_contact_date": sa.Column("last_contact_date", sa.String(), nullable=True),
            "resume_version": sa.Column("resume_version", sa.String(), nullable=True),
            "cover_letter_version": sa.Column("cover_letter_version", sa.String(), nullable=True),
            "activity_log": sa.Column("activity_log", sa.Text(), nullable=True),
        })

    if not inspector.has_table("search_subscriptions"):
        op.create_table(
            "search_subscriptions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("organization_id", sa.Integer(), nullable=True),
            sa.Column("query", sa.String(), nullable=True),
            sa.Column("location", sa.String(), nullable=True),
            sa.Column("job_type", sa.String(), server_default="INTERN"),
        )
    else:
        _add_missing_columns(bind, "search_subscriptions", {
            "organization_id": sa.Column("organization_id", sa.Integer(), nullable=True),
        })

    if not inspector.has_table("usage_events"):
        op.create_table(
            "usage_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("organization_id", sa.Integer(), nullable=True),
            sa.Column("feature", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=True),
            sa.Column("category", sa.String(), server_default="ai"),
            sa.Column("units", sa.Integer(), server_default="1", nullable=False),
            sa.Column("provider", sa.String(), nullable=True),
            sa.Column("request_id", sa.String(), nullable=True),
            sa.Column("details", sa.Text(), nullable=True),
        )
    else:
        _add_missing_columns(bind, "usage_events", {
            "organization_id": sa.Column("organization_id", sa.Integer(), nullable=True),
            "category": sa.Column("category", sa.String(), server_default="ai"),
            "units": sa.Column("units", sa.Integer(), server_default="1", nullable=False),
            "provider": sa.Column("provider", sa.String(), nullable=True),
            "request_id": sa.Column("request_id", sa.String(), nullable=True),
            "details": sa.Column("details", sa.Text(), nullable=True),
        })
        op.execute("UPDATE usage_events SET category = 'ai' WHERE category IS NULL")
        op.execute("UPDATE usage_events SET units = 1 WHERE units IS NULL")

    if not inspector.has_table("application_events"):
        op.create_table(
            "application_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("organization_id", sa.Integer(), nullable=True),
            sa.Column("application_id", sa.Integer(), nullable=True),
            sa.Column("event_type", sa.String(), nullable=False),
            sa.Column("from_status", sa.String(), nullable=True),
            sa.Column("to_status", sa.String(), nullable=True),
            sa.Column("occurred_at", sa.String(), nullable=False),
            sa.Column("effective_date", sa.String(), nullable=True),
            sa.Column("details", sa.Text(), nullable=True),
        )

    _create_index_if_missing(bind, "ix_users_email", "users", ["email"])
    _create_index_if_missing(bind, "ix_organizations_slug", "organizations", ["slug"])
    _create_index_if_missing(bind, "ix_organization_members_org_user", "organization_members", ["organization_id", "user_id"])
    _create_index_if_missing(bind, "ix_organization_invitations_token", "organization_invitations", ["token"])
    _create_index_if_missing(bind, "ix_application_events_user_type_date", "application_events", ["user_id", "event_type", "effective_date"])
    _create_index_if_missing(bind, "ix_usage_events_user_category_date", "usage_events", ["user_id", "category", "created_at"])
    _create_index_if_missing(bind, "ix_applications_user_status", "applications", ["user_id", "status"])
    _create_index_if_missing(bind, "ix_applications_organization_status", "applications", ["organization_id", "status"])
    _create_index_if_missing(bind, "ix_usage_events_organization_category_date", "usage_events", ["organization_id", "category", "created_at"])


def downgrade() -> None:
    # Do not drop user data automatically during a rollback.
    pass
