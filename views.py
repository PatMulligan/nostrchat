from fastapi import Depends, Request
from fastapi.templating import Jinja2Templates
from lnbits.core.models import User
from lnbits.decorators import check_user_exists
from starlette.responses import HTMLResponse

from . import nostrchat_ext, nostrchat_renderer

templates = Jinja2Templates(directory="templates")


@nostrchat_ext.get("/", response_class=HTMLResponse)
async def index(request: Request, user: User = Depends(check_user_exists)):
    return nostrchat_renderer().TemplateResponse(
        "nostrchat/index.html",
        {"request": request, "user": user.json()},
    )


@nostrchat_ext.get("/market", response_class=HTMLResponse)
async def market(request: Request):
    return nostrchat_renderer().TemplateResponse(
        "nostrchat/market.html",
        {"request": request},
    )
