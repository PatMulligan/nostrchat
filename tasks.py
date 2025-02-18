import asyncio

from lnbits.core.models import Payment
from lnbits.tasks import register_invoice_listener
from loguru import logger

from .nostr.nostr_client import NostrClient
from .services import (
    process_nostr_message,
    subscribe_to_all_nostraccts,
)


async def wait_for_nostr_events(nostr_client: NostrClient):
    while True:
        try:
            await subscribe_to_all_nostraccts()

            while True:
                message = await nostr_client.get_event()
                await process_nostr_message(message)
        except Exception as e:
            logger.warning(f"Subcription failed. Will retry in one minute: {e}")
            await asyncio.sleep(10)
