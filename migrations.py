async def m001_initial(db):
    """
    Initial merchants table.
    """
    await db.execute(
        """
        CREATE TABLE nostrmarket.merchants (
            user_id TEXT NOT NULL,
            id TEXT PRIMARY KEY,
            private_key TEXT NOT NULL,
            public_key TEXT NOT NULL,
            meta TEXT NOT NULL DEFAULT '{}',
            time TIMESTAMP
        );
        """
    )

    """
    Initial chat messages table.
    """
    await db.execute(
        f"""
        CREATE TABLE nostrmarket.direct_messages (
            merchant_id TEXT NOT NULL,
            id TEXT PRIMARY KEY,
            event_id TEXT,
            event_created_at INTEGER NOT NULL,
            message TEXT NOT NULL,
            public_key TEXT NOT NULL,
            incoming BOOLEAN NOT NULL DEFAULT false,
            time TIMESTAMP NOT NULL DEFAULT {db.timestamp_now},
            type INTEGER NOT NULL DEFAULT -1,
            UNIQUE(event_id)
        );
        """
    )

    if db.type != "SQLITE":
        """
        Create indexes for message fetching
        """
        await db.execute(
            """
            CREATE INDEX idx_messages_timestamp
            ON nostrmarket.direct_messages (time DESC)
            """
        )
        await db.execute(
            "CREATE INDEX idx_event_id ON nostrmarket.direct_messages (event_id)"
        )

    """
    Initial customers table.
    """
    await db.execute(
        """
        CREATE TABLE nostrmarket.customers (
            merchant_id TEXT NOT NULL,
            public_key TEXT NOT NULL,
            event_created_at INTEGER,
            unread_messages INTEGER NOT NULL DEFAULT 1,
            meta TEXT NOT NULL DEFAULT '{}'
        );
        """
    )

