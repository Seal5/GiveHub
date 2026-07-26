"""Store volunteer reports for opportunity moderation."""

import sqlalchemy as sa

from alembic import op

revision = "0003_opportunity_reports"
down_revision = "0002_opportunity_analytics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("opportunity_reports"):
        return
    op.create_table(
        "opportunity_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("opportunity_id", sa.Uuid(), nullable=False),
        sa.Column("reporter_id", sa.Uuid(), nullable=False),
        sa.Column(
            "reason",
            sa.Enum(
                "misleading",
                "unsafe",
                "inappropriate",
                "scam",
                "other",
                name="reportreason",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "open",
                "resolved",
                "dismissed",
                name="reportstatus",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["opportunity_id"],
            ["opportunities.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["reporter_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("opportunity_id", "reporter_id"),
    )
    op.create_index("ix_opportunity_reports_opportunity_id", "opportunity_reports", ["opportunity_id"])
    op.create_index("ix_opportunity_reports_reporter_id", "opportunity_reports", ["reporter_id"])
    op.create_index("ix_opportunity_reports_reason", "opportunity_reports", ["reason"])
    op.create_index("ix_opportunity_reports_status", "opportunity_reports", ["status"])
    op.create_index("ix_opportunity_reports_created_at", "opportunity_reports", ["created_at"])


def downgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("opportunity_reports"):
        return
    op.drop_index("ix_opportunity_reports_created_at", table_name="opportunity_reports")
    op.drop_index("ix_opportunity_reports_status", table_name="opportunity_reports")
    op.drop_index("ix_opportunity_reports_reason", table_name="opportunity_reports")
    op.drop_index("ix_opportunity_reports_reporter_id", table_name="opportunity_reports")
    op.drop_index("ix_opportunity_reports_opportunity_id", table_name="opportunity_reports")
    op.drop_table("opportunity_reports")
