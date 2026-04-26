import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

DB_PATH = os.getenv("DB_PATH", "data/templates.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def _column_exists(conn, table: str, column: str) -> bool:
    result = await conn.execute(text(f"PRAGMA table_info({table})"))
    rows = result.fetchall()
    return any(row[1] == column for row in rows)


async def _table_exists(conn, table: str) -> bool:
    result = await conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"),
        {"t": table},
    )
    return result.fetchone() is not None


async def init_db():
    from models import User, Template, TemplateField, SchemaConfig, Comment  # noqa: F401

    async with engine.begin() as conn:
        # Enable WAL mode
        await conn.execute(text("PRAGMA journal_mode=WAL"))

        templates_exists = await _table_exists(conn, "templates")

        if templates_exists:
            # --- Incremental migration for existing installations ---

            # 1. Ensure users table exists first (create_all will handle new tables,
            #    but we need it before adding the FK column to templates)
            await conn.run_sync(Base.metadata.create_all)

            # 2. Ensure system user (id=1) exists for backfill
            await conn.execute(text("""
                INSERT OR IGNORE INTO users (id, email, hashed_password, display_name, is_admin, is_active)
                VALUES (1, 'system@internal', '!disabled!', 'System', 0, 0)
            """))

            # 3. Add owner_id to templates if missing
            if not await _column_exists(conn, "templates", "owner_id"):
                # Rebuild templates table to drop the old unique(name) constraint
                # and add owner_id + is_public — SQLite doesn't support DROP CONSTRAINT
                await conn.execute(text("PRAGMA foreign_keys=OFF"))
                await conn.execute(text("""
                    CREATE TABLE templates_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        raw_content TEXT,
                        owner_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
                        is_public INTEGER NOT NULL DEFAULT 0,
                        created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
                        updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
                        UNIQUE (owner_id, name)
                    )
                """))
                await conn.execute(text("""
                    INSERT INTO templates_new
                        (id, name, description, raw_content, owner_id, is_public, created_at, updated_at)
                    SELECT id, name, description, raw_content, 1, 0, created_at, updated_at
                    FROM templates
                """))
                await conn.execute(text("DROP TABLE templates"))
                await conn.execute(text("ALTER TABLE templates_new RENAME TO templates"))
                await conn.execute(text("PRAGMA foreign_keys=ON"))

            # 4. Add is_public to templates if still missing (edge case)
            if not await _column_exists(conn, "templates", "is_public"):
                await conn.execute(text(
                    "ALTER TABLE templates ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0"
                ))

        else:
            # Fresh installation — create everything from scratch
            await conn.run_sync(Base.metadata.create_all)

            # Create system user as placeholder for backfill (id=1)
            await conn.execute(text("""
                INSERT OR IGNORE INTO users (id, email, hashed_password, display_name, is_admin, is_active)
                VALUES (1, 'system@internal', '!disabled!', 'System', 0, 0)
            """))
