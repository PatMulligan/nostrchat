import json
from http import HTTPStatus
from typing import List, Optional

from fastapi import Depends
from fastapi.exceptions import HTTPException
from lnbits.core.services import websocket_updater
from lnbits.decorators import (
    WalletTypeInfo,
    require_admin_key,
    require_invoice_key,
)
# TODO: remove pretty sure not needed
# from lnbits.utils.exchange_rates import currencies
from loguru import logger

from . import nostr_client, nostrmarket_ext
from .crud import (
    create_customer,
    create_direct_message,
    create_merchant,
    delete_merchant,
    delete_merchant_direct_messages,
    get_customer,
    get_customers,
    get_direct_messages,
    get_last_direct_messages_time,
    get_merchant_by_pubkey,
    get_merchant_for_user,
    touch_merchant,
    update_customer_no_unread_messages,
    update_merchant,
)
from .helpers import normalize_public_key
from .models import (
    Customer,
    DirectMessage,
    Merchant,
    PartialDirectMessage,
    PartialMerchant,
)
from .services import (
    resubscribe_to_all_merchants,
    subscribe_to_all_merchants,
    update_merchant_to_nostr,
)

######################################## MERCHANT ######################################


@nostrmarket_ext.post("/api/v1/merchant")
async def api_create_merchant(
    data: PartialMerchant,
    wallet: WalletTypeInfo = Depends(require_admin_key),
) -> Merchant:

    try:
        merchant = await get_merchant_by_pubkey(data.public_key)
        assert merchant is None, "A merchant already uses this public key"

        merchant = await get_merchant_for_user(wallet.wallet.user)
        assert merchant is None, "A merchant already exists for this user"

        merchant = await create_merchant(wallet.wallet.user, data)

        await resubscribe_to_all_merchants()

        await nostr_client.merchant_temp_subscription(data.public_key)

        return merchant
    except AssertionError as ex:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=str(ex),
        ) from ex
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot create merchant",
        ) from ex


@nostrmarket_ext.get("/api/v1/merchant")
async def api_get_merchant(
    wallet: WalletTypeInfo = Depends(require_invoice_key),
) -> Optional[Merchant]:

    try:
        merchant = await get_merchant_for_user(wallet.wallet.user)
        if not merchant:
            return None

        merchant = await touch_merchant(wallet.wallet.user, merchant.id)
        assert merchant
        last_dm_time = await get_last_direct_messages_time(merchant.id)
        assert merchant.time
        merchant.config.restore_in_progress = (merchant.time - last_dm_time) < 30

        return merchant
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot get merchant",
        ) from ex


@nostrmarket_ext.delete("/api/v1/merchant/{merchant_id}")
async def api_delete_merchant(
    merchant_id: str,
    wallet: WalletTypeInfo = Depends(require_admin_key),
):

    try:
        merchant = await get_merchant_for_user(wallet.wallet.user)
        assert merchant, "Merchant cannot be found"
        assert merchant.id == merchant_id, "Wrong merchant ID"

        await nostr_client.unsubscribe_merchants()

        await delete_merchant_direct_messages(merchant.id)
        await delete_merchant(merchant.id)

    except AssertionError as ex:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=str(ex),
        ) from ex
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot get merchant",
        ) from ex
    finally:
        await subscribe_to_all_merchants()


@nostrmarket_ext.put("/api/v1/merchant/{merchant_id}/nostr")
async def api_republish_merchant(
    merchant_id: str,
    wallet: WalletTypeInfo = Depends(require_admin_key),
):
    try:
        merchant = await get_merchant_for_user(wallet.wallet.user)
        assert merchant, "Merchant cannot be found"
        assert merchant.id == merchant_id, "Wrong merchant ID"

        merchant = await update_merchant_to_nostr(merchant)
        await update_merchant(wallet.wallet.user, merchant.id, merchant.config)

    except AssertionError as ex:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=str(ex),
        ) from ex
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot republish to nostr",
        ) from ex


@nostrmarket_ext.get("/api/v1/merchant/{merchant_id}/nostr")
async def api_refresh_merchant(
    merchant_id: str,
    wallet: WalletTypeInfo = Depends(require_admin_key),
):
    try:
        merchant = await get_merchant_for_user(wallet.wallet.user)
        assert merchant, "Merchant cannot be found"
        assert merchant.id == merchant_id, "Wrong merchant ID"

        await nostr_client.merchant_temp_subscription(merchant.public_key)

    except AssertionError as ex:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=str(ex),
        ) from ex
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot refresh from nostr",
        ) from ex


@nostrmarket_ext.put("/api/v1/merchant/{merchant_id}/toggle")
async def api_toggle_merchant(
    merchant_id: str,
    wallet: WalletTypeInfo = Depends(require_admin_key),
) -> Merchant:
    try:
        merchant = await get_merchant_for_user(wallet.wallet.user)
        assert merchant, "Merchant cannot be found"
        assert merchant.id == merchant_id, "Wrong merchant ID"

        merchant.config.active = not merchant.config.active
        await update_merchant(wallet.wallet.user, merchant.id, merchant.config)

        return merchant
    except AssertionError as ex:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=str(ex),
        ) from ex
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot get merchant",
        ) from ex


@nostrmarket_ext.delete("/api/v1/merchant/{merchant_id}/nostr")
async def api_delete_merchant_on_nostr(
    merchant_id: str,
    wallet: WalletTypeInfo = Depends(require_admin_key),
):
    try:
        merchant = await get_merchant_for_user(wallet.wallet.user)
        assert merchant, "Merchant cannot be found"
        assert merchant.id == merchant_id, "Wrong merchant ID"

        merchant = await update_merchant_to_nostr(merchant, True)
        await update_merchant(wallet.wallet.user, merchant.id, merchant.config)

    except AssertionError as ex:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=str(ex),
        ) from ex
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot get merchant",
        ) from ex


######################################## DIRECT MESSAGES ###############################


@nostrmarket_ext.get("/api/v1/message/{public_key}")
async def api_get_messages(
    public_key: str, wallet: WalletTypeInfo = Depends(require_invoice_key)
) -> List[DirectMessage]:
    try:
        merchant = await get_merchant_for_user(wallet.wallet.user)
        assert merchant, "Merchant cannot be found"

        messages = await get_direct_messages(merchant.id, public_key)
        await update_customer_no_unread_messages(merchant.id, public_key)
        return messages
    except AssertionError as ex:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=str(ex),
        ) from ex
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot get direct message",
        ) from ex


@nostrmarket_ext.post("/api/v1/message")
async def api_create_message(
    data: PartialDirectMessage, wallet: WalletTypeInfo = Depends(require_admin_key)
) -> DirectMessage:
    try:
        merchant = await get_merchant_for_user(wallet.wallet.user)
        assert merchant, "Merchant cannot be found"

        dm_event = merchant.build_dm_event(data.message, data.public_key)
        data.event_id = dm_event.id
        data.event_created_at = dm_event.created_at

        dm = await create_direct_message(merchant.id, data)
        await nostr_client.publish_nostr_event(dm_event)

        return dm
    except AssertionError as ex:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=str(ex),
        ) from ex
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot create message",
        ) from ex


######################################## CUSTOMERS #####################################


@nostrmarket_ext.get("/api/v1/customer")
async def api_get_customers(
    wallet: WalletTypeInfo = Depends(require_invoice_key),
) -> List[Customer]:
    try:
        merchant = await get_merchant_for_user(wallet.wallet.user)
        assert merchant, "Merchant cannot be found"
        return await get_customers(merchant.id)

    except AssertionError as ex:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=str(ex),
        ) from ex
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot create message",
        ) from ex


@nostrmarket_ext.post("/api/v1/customer")
async def api_create_customer(
    data: Customer,
    wallet: WalletTypeInfo = Depends(require_admin_key),
) -> Customer:

    try:
        pubkey = normalize_public_key(data.public_key)

        merchant = await get_merchant_for_user(wallet.wallet.user)
        assert merchant, "A merchant does not exists for this user"
        assert merchant.id == data.merchant_id, "Invalid merchant id for user"

        existing_customer = await get_customer(merchant.id, pubkey)
        assert existing_customer is None, "This public key already exists"

        customer = await create_customer(
            merchant.id, Customer(merchant_id=merchant.id, public_key=pubkey)
        )

        await nostr_client.user_profile_temp_subscribe(pubkey)

        return customer
    except (ValueError, AssertionError) as ex:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=str(ex),
        ) from ex
    except Exception as ex:
        logger.warning(ex)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Cannot create customer",
        ) from ex


######################################## OTHER ########################################


@nostrmarket_ext.get("/api/v1/currencies")
async def api_list_currencies_available():
    return list(currencies.keys())


@nostrmarket_ext.put("/api/v1/restart")
async def restart_nostr_client(wallet: WalletTypeInfo = Depends(require_admin_key)):
    try:
        await nostr_client.restart()
    except Exception as ex:
        logger.warning(ex)
