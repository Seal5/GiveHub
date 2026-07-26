"""Record volunteer attendance and contributed hours."""

import sqlalchemy as sa

from alembic import op

revision = "0004_attendance"
down_revision = "0003_waivers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("attendance_records"):
        return
    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "expected",
                "attended",
                "no_show",
                "excused",
                name="attendancestatus",
                native_enum=False,
            ),
            nullable=False,
            server_default="expected",
        ),
        sa.Column("hours", sa.Float(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("recorded_by", sa.Uuid(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_id"),
    )
    op.create_index(
        "ix_attendance_records_application_id", "attendance_records", ["application_id"]
    )
    op.create_index("ix_attendance_records_status", "attendance_records", ["status"])


def downgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("attendance_records"):
        return
    op.drop_index("ix_attendance_records_status", table_name="attendance_records")
    op.drop_index("ix_attendance_records_application_id", table_name="attendance_records")
    op.drop_table("attendance_records")
