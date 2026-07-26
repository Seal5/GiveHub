"""Track opportunity funnel analytics."""

import sqlalchemy as sa

from alembic import op

revision = "0002_opportunity_analytics"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("opportunity_events"):
        return
    op.create_table(
        "opportunity_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("opportunity_id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum(
                "viewed",
                "application_started",
                "application_submitted",
                "shared",
                name="opportunityeventtype",
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
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_opportunity_events_opportunity_id",
        "opportunity_events",
        ["opportunity_id"],
    )
    op.create_index(
        "ix_opportunity_events_profile_id",
        "opportunity_events",
        ["profile_id"],
    )
    op.create_index(
        "ix_opportunity_events_event_type",
        "opportunity_events",
        ["event_type"],
    )
    op.create_index(
        "ix_opportunity_events_created_at",
        "opportunity_events",
        ["created_at"],
    )


def downgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("opportunity_events"):
        return
    op.drop_index("ix_opportunity_events_created_at", table_name="opportunity_events")
    op.drop_index("ix_opportunity_events_event_type", table_name="opportunity_events")
    op.drop_index("ix_opportunity_events_profile_id", table_name="opportunity_events")
    op.drop_index("ix_opportunity_events_opportunity_id", table_name="opportunity_events")
    op.drop_table("opportunity_events")
