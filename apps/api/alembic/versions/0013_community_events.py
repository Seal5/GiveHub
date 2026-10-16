"""Community invitations, private RSVPs, announcements and durable delivery jobs."""

from alembic import op

revision = "0013_community_events"
down_revision = "0012_attendance_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from givehub.community_models import Gathering, GatheringDelivery, GatheringMessage, GatheringRSVP
    for model in (Gathering, GatheringRSVP, GatheringMessage, GatheringDelivery):
        model.__table__.create(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    for table in ("gathering_deliveries", "gathering_messages", "gathering_rsvps", "gatherings"):
        op.drop_table(table)
