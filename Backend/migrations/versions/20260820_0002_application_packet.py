"""Persist generated application packets."""

from alembic import op
import sqlalchemy as sa


revision = "20260820_0002"
down_revision = "20260820_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("applications"):
        columns = {column["name"] for column in inspector.get_columns("applications")}
        if "application_packet" not in columns:
            op.add_column("applications", sa.Column("application_packet", sa.Text(), nullable=True))


def downgrade() -> None:
    # Keep generated packet data recoverable during rollback.
    pass
