"""Add privacy controls, account security sessions, and self-service requests."""

from alembic import op
import sqlalchemy as sa


revision = "20261006_0005"
down_revision = "20261006_0004"
branch_labels = None
depends_on = None


def _columns(bind, table_name):
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)} if inspector.has_table(table_name) else set()


def _add_missing_columns(bind, table_name, columns):
    for name, column in columns.items():
        if name not in _columns(bind, table_name):
            op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()
    _add_missing_columns(bind, "users", {
        "email_verified": sa.Column("email_verified", sa.Boolean(), server_default=sa.false(), nullable=False),
        "mfa_secret_enc": sa.Column("mfa_secret_enc", sa.String(), nullable=True),
        "mfa_enabled": sa.Column("mfa_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        "created_at": sa.Column("created_at", sa.String(), nullable=True),
    })

    if not sa.inspect(bind).has_table("auth_sessions"):
        op.create_table(
            "auth_sessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("jti", sa.String(), nullable=False, unique=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("expires_at", sa.String(), nullable=False),
            sa.Column("last_seen_at", sa.String(), nullable=False),
            sa.Column("revoked_at", sa.String(), nullable=True),
            sa.Column("user_agent", sa.String(), nullable=True),
            sa.Column("ip_hash", sa.String(), nullable=True),
        )
    if not sa.inspect(bind).has_table("security_tokens"):
        op.create_table(
            "security_tokens",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("token_hash", sa.String(), nullable=False, unique=True),
            sa.Column("purpose", sa.String(), nullable=False),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("expires_at", sa.String(), nullable=False),
            sa.Column("used_at", sa.String(), nullable=True),
        )
    if not sa.inspect(bind).has_table("privacy_preferences"):
        op.create_table(
            "privacy_preferences",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False, unique=True),
            sa.Column("analytics", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("marketing", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("personalized_search", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("updated_at", sa.String(), nullable=False),
        )
    if not sa.inspect(bind).has_table("privacy_requests"):
        op.create_table(
            "privacy_requests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("request_type", sa.String(), nullable=False),
            sa.Column("status", sa.String(), server_default="received", nullable=False),
            sa.Column("details", sa.Text(), nullable=True),
            sa.Column("requested_at", sa.String(), nullable=False),
            sa.Column("completed_at", sa.String(), nullable=True),
        )

    for name, table, columns in [
        ("ix_auth_sessions_user_active", "auth_sessions", ["user_id", "revoked_at", "expires_at"]),
        ("ix_security_tokens_user_purpose", "security_tokens", ["user_id", "purpose", "used_at"]),
        ("ix_privacy_requests_user_status", "privacy_requests", ["user_id", "status"]),
    ]:
        inspector = sa.inspect(bind)
        if name not in {index["name"] for index in inspector.get_indexes(table)}:
            op.create_index(name, table, columns)


def downgrade() -> None:
    # Preserve security and privacy records during rollback.
    pass
