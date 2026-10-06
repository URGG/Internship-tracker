"""Add provider provenance to saved jobs and immutable signup consent records."""

from alembic import op
import sqlalchemy as sa


revision = "20261006_0004"
down_revision = "20260821_0003"
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

    if _columns(bind, "applications"):
        _add_missing_columns(bind, "applications", {
            "provider": sa.Column("provider", sa.String(), nullable=True),
            "provider_job_id": sa.Column("provider_job_id", sa.String(), nullable=True),
            "source_url": sa.Column("source_url", sa.String(), nullable=True),
            "source_attribution": sa.Column("source_attribution", sa.String(), nullable=True),
            "source_terms_url": sa.Column("source_terms_url", sa.String(), nullable=True),
            "content_fetched_at": sa.Column("content_fetched_at", sa.String(), nullable=True),
        })

    if not sa.inspect(bind).has_table("legal_acceptances"):
        op.create_table(
            "legal_acceptances",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("terms_version", sa.String(), nullable=False),
            sa.Column("privacy_version", sa.String(), nullable=False),
            sa.Column("accepted_at", sa.String(), nullable=False),
            sa.Column("ip_hash", sa.String(), nullable=True),
            sa.Column("user_agent", sa.String(), nullable=True),
            sa.Column("consent_source", sa.String(), server_default="signup"),
            sa.UniqueConstraint("user_id", "terms_version", "privacy_version", name="uq_legal_acceptance_version"),
        )

    inspector = sa.inspect(bind)
    index_names = {index["name"] for index in inspector.get_indexes("applications")} if inspector.has_table("applications") else set()
    if "ix_applications_provider_job_id" not in index_names:
        op.create_index("ix_applications_provider_job_id", "applications", ["provider", "provider_job_id"])
    legal_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("legal_acceptances")}
    if "ix_legal_acceptances_user_id" not in legal_indexes:
        op.create_index("ix_legal_acceptances_user_id", "legal_acceptances", ["user_id"])


def downgrade() -> None:
    # Preserve provenance and consent history during rollback.
    pass
