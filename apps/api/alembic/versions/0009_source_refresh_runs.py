"""Persist source refresh health and execution history."""

import sqlalchemy as sa

from alembic import op

revision = "0009_source_refresh_runs"
down_revision = "0008_listing_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "source_refresh_runs" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "source_refresh_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trigger", sa.String(length=24), nullable=False, server_default="scheduled"),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="queued"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("discovered", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("candidates_added", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("candidates_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("checked", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expired", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unavailable", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_protected", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("out_of_area", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_source_refresh_runs_status", "source_refresh_runs", ["status"])
    op.create_index(
        "ix_source_refresh_runs_completed_at", "source_refresh_runs", ["completed_at"]
    )


def downgrade() -> None:
    if "source_refresh_runs" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("source_refresh_runs")
