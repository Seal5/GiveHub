"""Create the GiveHub core schema."""

from alembic import op
from givehub import models  # noqa: F401
from givehub.database import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_opportunities_location_geography "
            "ON opportunities USING GIST "
            "((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography))"
        )


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())

