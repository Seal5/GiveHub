"""Retain attendance separately for additional recurring sessions."""

from alembic import op

revision = "0012_attendance_sessions"
down_revision = "0011_pilot_readiness"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from givehub.models import SessionAttendance

    SessionAttendance.__table__.create(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    op.drop_table("session_attendance")
