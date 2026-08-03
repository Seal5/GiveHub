"""Add private opportunity listing reports and moderation state."""

import sqlalchemy as sa

from alembic import op

revision = "0008_listing_reports"
down_revision = "0007_source_candidate_review"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "listing_reports" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "listing_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("opportunity_id", sa.Uuid(), nullable=False),
        sa.Column("reporter_id", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("details", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=9), nullable=False, server_default="pending"),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["opportunity_id"], ["opportunities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reporter_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "opportunity_id", "reporter_id", name="uq_listing_reporter_opportunity"
        ),
    )
    op.create_index("ix_listing_reports_opportunity_id", "listing_reports", ["opportunity_id"])
    op.create_index("ix_listing_reports_reporter_id", "listing_reports", ["reporter_id"])
    op.create_index("ix_listing_reports_status", "listing_reports", ["status"])


def downgrade() -> None:
    if "listing_reports" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("listing_reports")
