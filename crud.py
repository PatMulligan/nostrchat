import json
from typing import List, Optional, Tuple

from lnbits.helpers import urlsafe_short_hash

from . import db
from .models import (
    Customer,
    CustomerProfile,
    DirectMessage,
    Merchant,
    MerchantConfig,
    PartialDirectMessage,
    PartialMerchant,
)

######################################## MERCHANT ######################################


async def create_merchant(user_id: str, m: PartialMerchant) -> Merchant:
    merchant_id = urlsafe_short_hash()
    await db.execute(
        """
        INSERT INTO nostrmarket.merchants
               (user_id, id, private_key, public_key, meta)
        VALUES (:user_id, :id, :private_key, :public_key, :meta)
        """,
        {
            "user_id": user_id,
            "id": merchant_id,
            "private_key": m.private_key,
            "public_key": m.public_key,
            "meta": json.dumps(dict(m.config)),
        },
    )
    merchant = await get_merchant(user_id, merchant_id)
    assert merchant, "Created merchant cannot be retrieved"
    return merchant


async def update_merchant(
    user_id: str, merchant_id: str, config: MerchantConfig
) -> Optional[Merchant]:
    await db.execute(
        f"""
            UPDATE nostrmarket.merchants SET meta = :meta, time = {db.timestamp_now}
            WHERE id = :id AND user_id = :user_id
        """,
        {"meta": json.dumps(config.dict()), "id": merchant_id, "user_id": user_id},
    )
    return await get_merchant(user_id, merchant_id)


async def touch_merchant(user_id: str, merchant_id: str) -> Optional[Merchant]:
    await db.execute(
        f"""
            UPDATE nostrmarket.merchants SET time = {db.timestamp_now}
            WHERE id = :id AND user_id = :user_id
        """,
        {"id": merchant_id, "user_id": user_id},
    )
    return await get_merchant(user_id, merchant_id)


async def get_merchant(user_id: str, merchant_id: str) -> Optional[Merchant]:
    row: dict = await db.fetchone(
        """SELECT * FROM nostrmarket.merchants WHERE user_id = :user_id AND id = :id""",
        {
            "user_id": user_id,
            "id": merchant_id,
        },
    )

    return Merchant.from_row(row) if row else None


async def get_merchant_by_pubkey(public_key: str) -> Optional[Merchant]:
    row: dict = await db.fetchone(
        """SELECT * FROM nostrmarket.merchants WHERE public_key = :public_key""",
        {"public_key": public_key},
    )

    return Merchant.from_row(row) if row else None


async def get_merchants_ids_with_pubkeys() -> List[Tuple[str, str]]:
    rows: list[dict] = await db.fetchall(
        """SELECT id, public_key FROM nostrmarket.merchants""",
    )

    return [(row["id"], row["public_key"]) for row in rows]


async def get_merchant_for_user(user_id: str) -> Optional[Merchant]:
    row: dict = await db.fetchone(
        """SELECT * FROM nostrmarket.merchants WHERE user_id = :user_id """,
        {"user_id": user_id},
    )

    return Merchant.from_row(row) if row else None


async def delete_merchant(merchant_id: str) -> None:
    await db.execute(
        "DELETE FROM nostrmarket.merchants WHERE id = :id",
        {
            "id": merchant_id,
        },
    )


######################################## MESSAGES ######################################


async def create_direct_message(
    merchant_id: str, dm: PartialDirectMessage
) -> DirectMessage:
    dm_id = urlsafe_short_hash()
    await db.execute(
        """
        INSERT INTO nostrmarket.direct_messages
        (
            merchant_id, id, event_id, event_created_at,
            message, public_key, type, incoming
        )
        VALUES
            (
            :merchant_id, :id, :event_id, :event_created_at,
            :message, :public_key, :type, :incoming
            )
        ON CONFLICT(event_id) DO NOTHING
        """,
        {
            "merchant_id": merchant_id,
            "id": dm_id,
            "event_id": dm.event_id,
            "event_created_at": dm.event_created_at,
            "message": dm.message,
            "public_key": dm.public_key,
            "type": dm.type,
            "incoming": dm.incoming,
        },
    )
    if dm.event_id:
        msg = await get_direct_message_by_event_id(merchant_id, dm.event_id)
    else:
        msg = await get_direct_message(merchant_id, dm_id)
    assert msg, "Newly created dm couldn't be retrieved"
    return msg


async def get_direct_message(merchant_id: str, dm_id: str) -> Optional[DirectMessage]:
    row: dict = await db.fetchone(
        """
            SELECT * FROM nostrmarket.direct_messages
            WHERE merchant_id = :merchant_id AND id = :id
        """,
        {
            "merchant_id": merchant_id,
            "id": dm_id,
        },
    )
    return DirectMessage.from_row(row) if row else None


async def get_direct_message_by_event_id(
    merchant_id: str, event_id: str
) -> Optional[DirectMessage]:
    row: dict = await db.fetchone(
        """
        SELECT * FROM nostrmarket.direct_messages
        WHERE merchant_id = :merchant_id AND event_id = :event_id
        """,
        {
            "merchant_id": merchant_id,
            "event_id": event_id,
        },
    )
    return DirectMessage.from_row(row) if row else None


async def get_direct_messages(merchant_id: str, public_key: str) -> List[DirectMessage]:
    rows: list[dict] = await db.fetchall(
        """
        SELECT * FROM nostrmarket.direct_messages
        WHERE merchant_id = :merchant_id AND public_key = :public_key
        ORDER BY event_created_at
        """,
        {"merchant_id": merchant_id, "public_key": public_key},
    )
    return [DirectMessage.from_row(row) for row in rows]


async def get_orders_from_direct_messages(merchant_id: str) -> List[DirectMessage]:
    rows: list[dict] = await db.fetchall(
        """
        SELECT * FROM nostrmarket.direct_messages
        WHERE merchant_id = :merchant_id AND type >= 0 ORDER BY event_created_at, type
        """,
        {"merchant_id": merchant_id},
    )
    return [DirectMessage.from_row(row) for row in rows]


async def get_last_direct_messages_time(merchant_id: str) -> int:
    row: dict = await db.fetchone(
        """
            SELECT time FROM nostrmarket.direct_messages
            WHERE merchant_id = :merchant_id ORDER BY time DESC LIMIT 1
        """,
        {"merchant_id": merchant_id},
    )
    return row["time"] if row else 0


async def get_last_direct_messages_created_at() -> int:
    row: dict = await db.fetchone(
        """
            SELECT event_created_at FROM nostrmarket.direct_messages
            ORDER BY event_created_at DESC LIMIT 1
        """,
        {},
    )
    return row["event_created_at"] if row else 0


async def delete_merchant_direct_messages(merchant_id: str) -> None:
    await db.execute(
        "DELETE FROM nostrmarket.direct_messages WHERE merchant_id = :merchant_id",
        {"merchant_id": merchant_id},
    )


######################################## CUSTOMERS #####################################


async def create_customer(merchant_id: str, data: Customer) -> Customer:
    await db.execute(
        """
        INSERT INTO nostrmarket.customers (merchant_id, public_key, meta)
        VALUES (:merchant_id, :public_key, :meta)
        """,
        {
            "merchant_id": merchant_id,
            "public_key": data.public_key,
            "meta": json.dumps(data.profile) if data.profile else "{}",
        },
    )

    customer = await get_customer(merchant_id, data.public_key)
    assert customer, "Newly created customer couldn't be retrieved"
    return customer


async def get_customer(merchant_id: str, public_key: str) -> Optional[Customer]:
    row: dict = await db.fetchone(
        """
            SELECT * FROM nostrmarket.customers
            WHERE merchant_id = :merchant_id AND public_key = :public_key
        """,
        {
            "merchant_id": merchant_id,
            "public_key": public_key,
        },
    )
    return Customer.from_row(row) if row else None


async def get_customers(merchant_id: str) -> List[Customer]:
    rows: list[dict] = await db.fetchall(
        "SELECT * FROM nostrmarket.customers WHERE merchant_id = :merchant_id",
        {"merchant_id": merchant_id},
    )
    return [Customer.from_row(row) for row in rows]


async def get_all_unique_customers() -> List[Customer]:
    q = """
            SELECT public_key, MAX(merchant_id) as merchant_id, MAX(event_created_at)
            FROM nostrmarket.customers
            GROUP BY public_key
        """
    rows: list[dict] = await db.fetchall(q)
    return [Customer.from_row(row) for row in rows]


async def update_customer_profile(
    public_key: str, event_created_at: int, profile: CustomerProfile
):
    await db.execute(
        """
        UPDATE nostrmarket.customers
        SET event_created_at = :event_created_at, meta = :meta
        WHERE public_key = :public_key
        """,
        {
            "event_created_at": event_created_at,
            "meta": json.dumps(profile.dict()),
            "public_key": public_key,
        },
    )


async def increment_customer_unread_messages(merchant_id: str, public_key: str):
    await db.execute(
        """
        UPDATE nostrmarket.customers
        SET unread_messages = unread_messages + 1
        WHERE merchant_id = :merchant_id AND public_key = :public_key
        """,
        {
            "merchant_id": merchant_id,
            "public_key": public_key,
        },
    )


# ??? two merchants
async def update_customer_no_unread_messages(merchant_id: str, public_key: str):
    await db.execute(
        """
        UPDATE nostrmarket.customers
        SET unread_messages = 0
        WHERE merchant_id = :merchant_id AND public_key = :public_key
        """,
        {
            "merchant_id": merchant_id,
            "public_key": public_key,
        },
    )
