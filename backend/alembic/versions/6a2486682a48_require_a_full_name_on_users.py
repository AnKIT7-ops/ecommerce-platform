"""require a full name on users

Revision ID: 6a2486682a48
Revises: 344fa34cc067
Create Date: 2026-09-19 14:31:02.118455

The API began requiring ``full_name`` on registration and profile updates, but
the column stayed nullable, so the database still permitted what the schema
refused. This closes that gap.

Rows predating the change have no name to promote, and inventing one would put
a fabricated person's name in the table. The backfill instead derives a label
from the only name-like data the row actually contains - the local part of the
email - so an operator can still tell whose account it is. Separators become
spaces and the result is title-cased: ``ada.lovelace@example.com`` becomes
``Ada Lovelace``, ``shopper@example.com`` becomes ``Shopper``.

Blank and whitespace-only names are backfilled the same way. They satisfy a
bare NOT NULL but are exactly the empty name the new schema rejects, so leaving
them would keep the inconsistency this migration exists to remove.

The downgrade restores nullability but cannot restore which rows were null:
that information is overwritten by the backfill. Take a dump first if you need
to reverse this on data you care about.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6a2486682a48"
down_revision: Union[str, Sequence[str], None] = "344fa34cc067"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Derive a readable label from the email local part.
_BACKFILL = sa.text(
    """
    UPDATE users
    SET full_name = initcap(
        btrim(
            regexp_replace(split_part(email, '@', 1), '[._+-]+', ' ', 'g')
        )
    )
    WHERE full_name IS NULL OR btrim(full_name) = ''
    """
)


def upgrade() -> None:
    """Backfill missing names, then forbid new ones."""
    connection = op.get_bind()
    result = connection.execute(_BACKFILL)
    print(f"  backfilled {result.rowcount} user(s) with no full name")

    op.alter_column(
        "users",
        "full_name",
        existing_type=sa.String(length=255),
        nullable=False,
    )


def downgrade() -> None:
    """Allow a null name again. Does not restore which rows were null."""
    op.alter_column(
        "users",
        "full_name",
        existing_type=sa.String(length=255),
        nullable=True,
    )
