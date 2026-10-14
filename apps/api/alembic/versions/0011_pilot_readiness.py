"""Explicit review and privacy lifecycle state."""

import sqlalchemy as sa

from alembic import op

revision = "0011_pilot_readiness"
down_revision = "0010_volunteer_personalization"
branch_labels = None
depends_on = None


def upgrade() -> None:
    additions = {
        "profiles": [
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deletion_requested_at", sa.DateTime(timezone=True), nullable=True),
        ],
        "organisations": [
            sa.Column("verification_note", sa.Text(), nullable=False, server_default=""),
            sa.Column("reviewed_by", sa.Uuid(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        ],
        "opportunities": [
            sa.Column(
                "unconfirmed_fields", sa.JSON(), nullable=False, server_default=sa.text("'[]'")
            ),
        ],
    }
    for table, columns in additions.items():
        existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}
        for column in columns:
            if column.name not in existing:
                op.add_column(table, column)
    # Initial migrations create model tables on a fresh database; existing databases need this table.
    from givehub.models import SourcePolicy

    SourcePolicy.__table__.create(op.get_bind(), checkfirst=True)
    # Beta approval was automatic. Require an evidenced review before a pilot.
    op.execute(
        sa.text(
            "UPDATE organisations SET verification_status = 'pending' WHERE reviewed_at IS NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE opportunities SET status = 'unpublished' WHERE status = 'published' AND organisation_id IN (SELECT id FROM organisations WHERE verification_status = 'pending')"
        )
    )
    op.execute(
        sa.text(
            "UPDATE opportunities SET listing_verification_status = 'pending' WHERE listing_source_url IS NOT NULL"
        )
    )
    # Legacy imported drafts also need review; no published records are changed.
    table = sa.table(
        "opportunities",
        sa.column("status"),
        sa.column("listing_source_url"),
        sa.column("unconfirmed_fields", sa.JSON),
    )
    op.get_bind().execute(
        table.update()
        .where(table.c.status == "draft", table.c.listing_source_url.is_not(None))
        .values(
            unconfirmed_fields=[
                "starts_at",
                "ends_at",
                "capacity",
                "minimum_age",
                "latitude",
                "longitude",
                "meeting_point",
                "eligibility_notes",
                "safety_notes",
                "external_application_url",
            ]
        )
    )


def downgrade() -> None:
    op.drop_table("source_policies")
    for table, names in {
        "profiles": ["deleted_at", "deletion_requested_at"],
        "organisations": ["verification_note", "reviewed_by", "reviewed_at"],
        "opportunities": ["unconfirmed_fields"],
    }.items():
        with op.batch_alter_table(table) as batch:
            for name in names:
                batch.drop_column(name)
