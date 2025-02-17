import asyncio
import json
from typing import List, Optional, Tuple

from lnbits.bolt11 import decode
from lnbits.core.crud import get_wallet
from lnbits.core.services import create_invoice, websocket_updater
from loguru import logger

from . import nostr_client
from .crud import (
    CustomerProfile,
    create_customer,
    create_direct_message,
    get_customer,
    get_last_direct_messages_created_at,
    get_merchant_by_pubkey,
    get_merchants_ids_with_pubkeys,
    increment_customer_unread_messages,
    update_customer_profile,
)
from .models import (
    Customer,
    DirectMessage,
    DirectMessageType,
    Merchant,
    Nostrable,
    PartialDirectMessage,
)
from .nostr.event import NostrEvent

async def update_merchant_to_nostr(
    merchant: Merchant, delete_merchant=False
) -> Merchant:
    event: Optional[NostrEvent] = None
    if delete_merchant:
        # merchant profile updates not supported yet
        event = await sign_and_send_to_nostr(merchant, merchant, delete_merchant)
    assert event
    merchant.config.event_id = event.id
    return merchant


async def sign_and_send_to_nostr(
    merchant: Merchant, n: Nostrable, delete=False
) -> NostrEvent:
    event = (
        n.to_nostr_delete_event(merchant.public_key)
        if delete
        else n.to_nostr_event(merchant.public_key)
    )
    event.sig = merchant.sign_hash(bytes.fromhex(event.id))
    await nostr_client.publish_nostr_event(event)

    return event


async def send_dm(
    merchant: Merchant,
    other_pubkey: str,
    type_: int,
    dm_content: str,
):
    dm_event = merchant.build_dm_event(dm_content, other_pubkey)

    dm = PartialDirectMessage(
        event_id=dm_event.id,
        event_created_at=dm_event.created_at,
        message=dm_content,
        public_key=other_pubkey,
        type=type_,
    )
    dm_reply = await create_direct_message(merchant.id, dm)

    await nostr_client.publish_nostr_event(dm_event)

    await websocket_updater(
        merchant.id,
        json.dumps(
            {
                "type": f"dm:{dm.type}",
                "customerPubkey": other_pubkey,
                "dm": dm_reply.dict(),
            }
        ),
    )


async def process_nostr_message(msg: str):
    try:
        type_, *rest = json.loads(msg)

        if type_.upper() == "EVENT":
            _, event = rest
            event = NostrEvent(**event)
            if event.kind == 0:
                await _handle_customer_profile_update(event)
            elif event.kind == 4:
                await _handle_nip04_message(event)
            return

    except Exception as ex:
        logger.debug(ex)

async def _handle_nip04_message(event: NostrEvent):
    merchant_public_key = event.pubkey
    merchant = await get_merchant_by_pubkey(merchant_public_key)

    if not merchant:
        p_tags = event.tag_values("p")
        if len(p_tags) and p_tags[0]:
            merchant_public_key = p_tags[0]
            merchant = await get_merchant_by_pubkey(merchant_public_key)

    assert merchant, f"Merchant not found for public key '{merchant_public_key}'"

    if event.pubkey == merchant_public_key:
        assert len(event.tag_values("p")) != 0, "Outgong message has no 'p' tag"
        clear_text_msg = merchant.decrypt_message(
            event.content, event.tag_values("p")[0]
        )
        await _handle_outgoing_dms(event, merchant, clear_text_msg)
    elif event.has_tag_value("p", merchant_public_key):
        clear_text_msg = merchant.decrypt_message(event.content, event.pubkey)
        await _handle_incoming_dms(event, merchant, clear_text_msg)
    else:
        logger.warning(f"Bad NIP04 event: '{event.id}'")


async def _handle_incoming_dms(
    event: NostrEvent, merchant: Merchant, clear_text_msg: str
):
    customer = await get_customer(merchant.id, event.pubkey)
    if not customer:
        await _handle_new_customer(event, merchant)
    else:
        await increment_customer_unread_messages(merchant.id, event.pubkey)

    dm_type, json_data = PartialDirectMessage.parse_message(clear_text_msg)
    new_dm = await _persist_dm(
        merchant.id,
        dm_type.value,
        event.pubkey,
        event.id,
        event.created_at,
        clear_text_msg,
    )

    # TODO: comment out for now
    # if json_data:
    #     reply_type, dm_reply = await _handle_incoming_structured_dm(
    #         merchant, new_dm, json_data
    #     )
    #     if dm_reply:
    #         await reply_to_structured_dm(
    #             merchant, event.pubkey, reply_type.value, dm_reply
    #         )


async def _handle_outgoing_dms(
    event: NostrEvent, merchant: Merchant, clear_text_msg: str
):
    sent_to = event.tag_values("p")
    type_, _ = PartialDirectMessage.parse_message(clear_text_msg)
    if len(sent_to) != 0:
        dm = PartialDirectMessage(
            event_id=event.id,
            event_created_at=event.created_at,
            message=clear_text_msg,
            public_key=sent_to[0],
            type=type_.value,
        )
        await create_direct_message(merchant.id, dm)


# TODO: comment out for now
# async def _handle_incoming_structured_dm(
#     merchant: Merchant, dm: DirectMessage, json_data: dict
# ) -> Tuple[DirectMessageType, Optional[str]]:
#     try:
#         if dm.type == DirectMessageType.CUSTOMER_ORDER.value and merchant.config.active:
#             json_resp = await _handle_new_order(
#                 merchant.id, merchant.public_key, dm, json_data
#             )
#
#             return DirectMessageType.PAYMENT_REQUEST, json_resp
#
#     except Exception as ex:
#         logger.warning(ex)
#
#     return DirectMessageType.PLAIN_TEXT, None


async def _persist_dm(
    merchant_id: str,
    dm_type: int,
    from_pubkey: str,
    event_id: str,
    event_created_at: int,
    msg: str,
) -> DirectMessage:
    dm = PartialDirectMessage(
        event_id=event_id,
        event_created_at=event_created_at,
        message=msg,
        public_key=from_pubkey,
        incoming=True,
        type=dm_type,
    )
    new_dm = await create_direct_message(merchant_id, dm)

    await websocket_updater(
        merchant_id,
        json.dumps(
            {
                "type": f"dm:{dm_type}",
                "customerPubkey": from_pubkey,
                "dm": new_dm.dict(),
            }
        ),
    )
    return new_dm


async def reply_to_structured_dm(
    merchant: Merchant, customer_pubkey: str, dm_type: int, dm_reply: str
):
    dm_event = merchant.build_dm_event(dm_reply, customer_pubkey)
    dm = PartialDirectMessage(
        event_id=dm_event.id,
        event_created_at=dm_event.created_at,
        message=dm_reply,
        public_key=customer_pubkey,
        type=dm_type,
    )
    await create_direct_message(merchant.id, dm)
    await nostr_client.publish_nostr_event(dm_event)

    await websocket_updater(
        merchant.id,
        json.dumps(
            {"type": f"dm:{dm_type}", "customerPubkey": dm.public_key, "dm": dm.dict()}
        ),
    )

async def resubscribe_to_all_merchants():
    await nostr_client.unsubscribe_merchants()
    # give some time for the message to propagate
    await asyncio.sleep(1)
    await subscribe_to_all_merchants()


async def subscribe_to_all_merchants():
    ids = await get_merchants_ids_with_pubkeys()
    public_keys = [pk for _, pk in ids]

    last_dm_time = await get_last_direct_messages_created_at()

    await nostr_client.subscribe_merchants(
        public_keys, last_dm_time, 0
    )


async def _handle_new_customer(event: NostrEvent, merchant: Merchant):
    await create_customer(
        merchant.id, Customer(merchant_id=merchant.id, public_key=event.pubkey)
    )
    await nostr_client.user_profile_temp_subscribe(event.pubkey)


async def _handle_customer_profile_update(event: NostrEvent):
    try:
        profile = json.loads(event.content)
        await update_customer_profile(
            event.pubkey,
            event.created_at,
            CustomerProfile(
                name=profile["name"] if "name" in profile else "",
                about=profile["about"] if "about" in profile else "",
            ),
        )
    except Exception as ex:
        logger.warning(ex)

