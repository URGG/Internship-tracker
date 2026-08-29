"""Persist reusable candidate application profile data."""

from alembic import op
import sqlalchemy as sa


revision = "20260821_0003"
down_revision = "20260820_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("users"):
        columns = {column["name"] for column in inspector.get_columns("users")}
        if "profile_json" not in columns:
            op.add_column("users", sa.Column("profile_json", sa.Text(), nullable=True))


def downgrade() -> None:
    # Keep profile data recoverable during rollback.
    pass
