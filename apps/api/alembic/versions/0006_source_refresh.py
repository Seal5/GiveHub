"""Add source freshness tracking and a review queue for discovered listings."""

import sqlalchemy as sa

from alembic import op

revision = "0006_source_refresh"
down_revision = "0005_requirements_completion"
branch_labels = None
depends_on = None


def _columns(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table)}


def upgrade() -> None:
    if "source_checked_at" not in _columns("opportunities"):
        op.add_column(
            "opportunities",
            sa.Column("source_checked_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index(
            "ix_opportunities_source_checked_at",
            "opportunities",
            ["source_checked_at"],
        )

    if not _columns("source_candidates"):
        op.create_table(
            "source_candidates",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("source_name", sa.String(length=120), nullable=False),
            sa.Column("source_url", sa.String(length=1000), nullable=False),
            sa.Column("title", sa.String(length=180), nullable=False),
            sa.Column("organisation_name", sa.String(length=180), nullable=False),
            sa.Column("location_label", sa.String(length=240), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("review_status", sa.String(length=24), nullable=False),
            sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("source_url"),
        )
        op.create_index("ix_source_candidates_source_name", "source_candidates", ["source_name"])
        op.create_index("ix_source_candidates_title", "source_candidates", ["title"])
        op.create_index(
            "ix_source_candidates_review_status",
            "source_candidates",
            ["review_status"],
        )


def downgrade() -> None:
    if _columns("source_candidates"):
        op.drop_table("source_candidates")
    if "source_checked_at" in _columns("opportunities"):
        op.drop_index("ix_opportunities_source_checked_at", table_name="opportunities")
        op.drop_column("opportunities", "source_checked_at")
