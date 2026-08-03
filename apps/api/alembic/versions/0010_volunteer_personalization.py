"""Store volunteer matching preferences collected during onboarding."""

import sqlalchemy as sa

from alembic import op

revision = "0010_volunteer_personalization"
down_revision = "0009_source_refresh_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("profiles")}
    additions = [
        ("onboarding_completed", sa.Boolean(), sa.false()),
        ("preferred_cause_slugs", sa.JSON(), sa.text("'[]'")),
        ("preferred_availability", sa.JSON(), sa.text("'[]'")),
        ("preferred_recurrences", sa.JSON(), sa.text("'[]'")),
        ("max_time_commitment_minutes", sa.Integer(), None),
        ("accessible_only", sa.Boolean(), sa.false()),
        ("age_group", sa.String(length=24), None),
        ("training_preference", sa.String(length=16), sa.text("'any'")),
        ("screening_preference", sa.String(length=16), sa.text("'any'")),
        ("transportation_preference", sa.String(length=24), sa.text("'any'")),
    ]
    for name, kind, default in additions:
        if name not in columns:
            op.add_column(
                "profiles",
                sa.Column(name, kind, nullable=default is None, server_default=default),
            )


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("profiles")}
    for name in [
        "transportation_preference",
        "screening_preference",
        "training_preference",
        "age_group",
        "accessible_only",
        "max_time_commitment_minutes",
        "preferred_recurrences",
        "preferred_availability",
        "preferred_cause_slugs",
        "onboarding_completed",
    ]:
        if name in columns:
            op.drop_column("profiles", name)
