"""Add source candidate review audit fields and imported host display names."""

import sqlalchemy as sa

from alembic import op

revision = "0007_source_candidate_review"
down_revision = "0006_source_refresh"
branch_labels = None
depends_on = None


def _columns(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table)}


def upgrade() -> None:
    if "host_organisation_name" not in _columns("opportunities"):
        op.add_column(
            "opportunities",
            sa.Column("host_organisation_name", sa.String(length=180), nullable=True),
        )

    candidate_columns = _columns("source_candidates")
    with op.batch_alter_table("source_candidates") as batch_op:
        if "reviewed_at" not in candidate_columns:
            batch_op.add_column(
                sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True)
            )
        if "reviewed_by" not in candidate_columns:
            batch_op.add_column(sa.Column("reviewed_by", sa.Uuid(), nullable=True))
            batch_op.create_foreign_key(
                "fk_source_candidates_reviewed_by_profiles",
                "profiles",
                ["reviewed_by"],
                ["id"],
            )
        if "promoted_opportunity_id" not in candidate_columns:
            batch_op.add_column(
                sa.Column("promoted_opportunity_id", sa.Uuid(), nullable=True)
            )
            batch_op.create_foreign_key(
                "fk_source_candidates_promoted_opportunity",
                "opportunities",
                ["promoted_opportunity_id"],
                ["id"],
            )
            batch_op.create_unique_constraint(
                "uq_source_candidates_promoted_opportunity_id",
                ["promoted_opportunity_id"],
            )


def downgrade() -> None:
    candidate_columns = _columns("source_candidates")
    with op.batch_alter_table("source_candidates") as batch_op:
        if "promoted_opportunity_id" in candidate_columns:
            batch_op.drop_column("promoted_opportunity_id")
        if "reviewed_by" in candidate_columns:
            batch_op.drop_column("reviewed_by")
        if "reviewed_at" in candidate_columns:
            batch_op.drop_column("reviewed_at")
    if "host_organisation_name" in _columns("opportunities"):
        op.drop_column("opportunities", "host_organisation_name")
