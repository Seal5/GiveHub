"""Add versioned waivers and per-application acceptances."""

import sqlalchemy as sa

from alembic import op

revision = "0003_waivers"
down_revision = "0002_opportunity_analytics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("waiver_documents"):
        op.create_table(
            "waiver_documents",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("organisation_id", sa.Uuid(), nullable=True),
            sa.Column("title", sa.String(length=180), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["organisation_id"], ["organisations.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_waiver_documents_organisation_id", "waiver_documents", ["organisation_id"]
        )
        op.create_index("ix_waiver_documents_is_active", "waiver_documents", ["is_active"])

    if not inspector.has_table("waiver_acceptances"):
        op.create_table(
            "waiver_acceptances",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("application_id", sa.Uuid(), nullable=False),
            sa.Column("waiver_document_id", sa.Uuid(), nullable=False),
            sa.Column("signed_name", sa.String(length=120), nullable=False),
            sa.Column("is_minor", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("guardian_name", sa.String(length=120), nullable=True),
            sa.Column("guardian_email", sa.String(length=320), nullable=True),
            sa.Column("guardian_relationship", sa.String(length=80), nullable=True),
            sa.Column("signed_ip", sa.String(length=45), nullable=True),
            sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["application_id"], ["applications.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["waiver_document_id"], ["waiver_documents.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("application_id"),
        )
        op.create_index(
            "ix_waiver_acceptances_application_id", "waiver_acceptances", ["application_id"]
        )
        op.create_index(
            "ix_waiver_acceptances_waiver_document_id",
            "waiver_acceptances",
            ["waiver_document_id"],
        )

    columns = {column["name"] for column in inspector.get_columns("opportunities")}
    if "requires_waiver" not in columns:
        op.add_column(
            "opportunities",
            sa.Column(
                "requires_waiver", sa.Boolean(), nullable=False, server_default=sa.true()
            ),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("opportunities")}
    if "requires_waiver" in columns:
        op.drop_column("opportunities", "requires_waiver")
    if inspector.has_table("waiver_acceptances"):
        op.drop_index(
            "ix_waiver_acceptances_waiver_document_id", table_name="waiver_acceptances"
        )
        op.drop_index("ix_waiver_acceptances_application_id", table_name="waiver_acceptances")
        op.drop_table("waiver_acceptances")
    if inspector.has_table("waiver_documents"):
        op.drop_index("ix_waiver_documents_is_active", table_name="waiver_documents")
        op.drop_index("ix_waiver_documents_organisation_id", table_name="waiver_documents")
        op.drop_table("waiver_documents")
