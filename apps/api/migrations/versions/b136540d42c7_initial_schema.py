import sqlalchemy as sa
from alembic import op

from app.core.settings import MigrationSettings

revision = "b136540d42c7"
down_revision = None


def upgrade() -> None:
    op.create_table(
        "institution",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_institution")),
    )
    op.create_table(
        "person",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("institution_id", sa.Uuid(), nullable=False),
        sa.Column("external_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["institution_id"], ["institution.id"], name=op.f("fk_person_institution_id_institution")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_person")),
        sa.UniqueConstraint(
            "institution_id", "external_id", name=op.f("uq_person_institution_id_external_id")
        ),
    )
    op.create_table(
        "user",
        sa.Column("institution_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.Enum("manager", "teacher", name="user_role"), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=1024), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_superuser", sa.Boolean(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["institution_id"], ["institution.id"], name=op.f("fk_user_institution_id_institution")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user")),
    )
    op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)
    op.create_table(
        "accesstoken",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token", sa.String(length=43), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], name=op.f("fk_accesstoken_user_id_user"), ondelete="cascade"
        ),
        sa.PrimaryKeyConstraint("token", name=op.f("pk_accesstoken")),
    )
    op.create_index(op.f("ix_accesstoken_created_at"), "accesstoken", ["created_at"], unique=False)

    op.execute("ALTER TABLE person ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE person FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY person_institution_isolation ON person
        USING (institution_id = NULLIF(current_setting('app.current_institution_id', TRUE), '')::uuid)
        WITH CHECK (institution_id = NULLIF(current_setting('app.current_institution_id', TRUE), '')::uuid)
        """
    )

    service_user = MigrationSettings().database_url.hosts()[0]["username"]
    if service_user is None:
        raise ValueError("DATABASE_URL has no user to grant the service privileges to")
    service_role = op.get_bind().dialect.identifier_preparer.quote(service_user)
    op.execute(f"GRANT SELECT, INSERT ON institution TO {service_role}")
    op.execute(f'GRANT SELECT, INSERT, UPDATE ON "user" TO {service_role}')
    op.execute(f"GRANT SELECT, INSERT, DELETE ON accesstoken TO {service_role}")
    op.execute(f"GRANT SELECT, INSERT ON person TO {service_role}")


def downgrade() -> None:
    op.drop_index(op.f("ix_accesstoken_created_at"), table_name="accesstoken")
    op.drop_table("accesstoken")
    op.drop_index(op.f("ix_user_email"), table_name="user")
    op.drop_table("user")
    op.execute("DROP TYPE user_role")
    op.drop_table("person")
    op.drop_table("institution")
