"""Add opportunity sourcing, fit metadata, external applications, and notification preferences."""

import sqlalchemy as sa

from alembic import op

revision = "0005_requirements_completion"
down_revision = "0004_attendance"
branch_labels = None
depends_on = None


def _columns(table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    opportunity_columns = _columns("opportunities")
    additions = [
        ("time_commitment_minutes", sa.Integer(), False, "180"),
        ("is_accessible", sa.Boolean(), False, sa.true()),
        ("eligibility_notes", sa.Text(), False, "Open to volunteers who meet the listed minimum age."),
        ("training_required", sa.Boolean(), False, sa.false()),
        ("training_commitment", sa.Text(), False, "No training required."),
        ("screening_required", sa.Boolean(), False, sa.false()),
        ("screening_steps", sa.Text(), False, "No screening required."),
        ("transportation_info", sa.Text(), False, "Plan your own transport to the meeting point."),
        ("qualifications", sa.Text(), False, "No prior qualifications required."),
        ("listing_source", sa.String(length=180), False, "GiveHub organiser"),
        ("listing_source_url", sa.String(length=1000), True, None),
        ("listing_verification_status", sa.String(length=24), False, "verified"),
        ("source_updated_at", sa.DateTime(timezone=True), True, None),
        ("application_mode", sa.String(length=16), False, "internal"),
        ("external_application_url", sa.String(length=1000), True, None),
    ]
    for name, column_type, nullable, default in additions:
        if name not in opportunity_columns:
            op.add_column(
                "opportunities",
                sa.Column(name, column_type, nullable=nullable, server_default=default),
            )

    organisation_columns = _columns("organisations")
    if "notify_new_applications" not in organisation_columns:
        op.add_column(
            "organisations",
            sa.Column(
                "notify_new_applications",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )


def downgrade() -> None:
    if "notify_new_applications" in _columns("organisations"):
        op.drop_column("organisations", "notify_new_applications")
    for name in (
        "external_application_url",
        "application_mode",
        "source_updated_at",
        "listing_verification_status",
        "listing_source_url",
        "listing_source",
        "qualifications",
        "transportation_info",
        "screening_steps",
        "screening_required",
        "training_commitment",
        "training_required",
        "eligibility_notes",
        "is_accessible",
        "time_commitment_minutes",
    ):
        if name in _columns("opportunities"):
            op.drop_column("opportunities", name)
