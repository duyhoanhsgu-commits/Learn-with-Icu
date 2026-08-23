"""Safely fetch readable content from a specific public web URL."""

import ipaddress
import socket
import urllib.parse
import urllib.request
from io import BytesIO

from bs4 import BeautifulSoup
from pypdf import PdfReader

from src.core.logging import logger

_TIMEOUT_SECONDS = 12
_MAX_DOWNLOAD_BYTES = 2_000_000
_MAX_TEXT_CHARACTERS = 15_000
_USER_AGENT = "Mozilla/5.0 (compatible; ICU-Learning-Agent/1.0)"


def _validate_public_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("URL phải sử dụng http hoặc https.")
    try:
        default_port = 443 if parsed.scheme == "https" else 80
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or default_port)
    except socket.gaierror as exc:
        raise ValueError("Không thể phân giải tên miền.") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError("Không được phép truy cập localhost hoặc mạng nội bộ.")
    return parsed.geturl()


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return super().redirect_request(
            req, fp, code, msg, headers, _validate_public_url(newurl)
        )


def _extract_html(data: bytes) -> tuple[str, str]:
    soup = BeautifulSoup(data, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else "Untitled page"
    for element in soup(["script", "style", "noscript", "nav", "footer", "header", "aside"]):
        element.decompose()
    root = soup.find("article") or soup.find("main") or soup.body or soup
    text = "\n".join(line.strip() for line in root.get_text("\n").splitlines() if line.strip())
    return title, text[:_MAX_TEXT_CHARACTERS]


def _extract_pdf(data: bytes) -> tuple[str, str]:
    reader = PdfReader(BytesIO(data))
    text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    return "PDF document", text[:_MAX_TEXT_CHARACTERS]


def fetch_url(url: str) -> dict[str, str]:
    """Fetch one public URL and return its title, final URL, and readable text."""
    safe_url = _validate_public_url(url)
    request = urllib.request.Request(safe_url, headers={"User-Agent": _USER_AGENT})
    opener = urllib.request.build_opener(_SafeRedirectHandler())
    try:
        with opener.open(request, timeout=_TIMEOUT_SECONDS) as response:
            final_url = _validate_public_url(response.geturl())
            content_type = response.headers.get_content_type()
            data = response.read(_MAX_DOWNLOAD_BYTES + 1)
    except Exception as exc:
        logger.warning(f"URL fetch failed for {safe_url}: {exc}")
        raise ValueError(f"Không thể đọc URL: {safe_url}") from exc

    if len(data) > _MAX_DOWNLOAD_BYTES:
        raise ValueError("Trang vượt quá giới hạn tải 2 MB.")
    if content_type == "application/pdf":
        title, text = _extract_pdf(data)
    elif content_type in {"text/html", "application/xhtml+xml"}:
        title, text = _extract_html(data)
    elif content_type.startswith("text/"):
        title, text = final_url, data.decode("utf-8", errors="ignore")[:_MAX_TEXT_CHARACTERS]
    else:
        raise ValueError(f"Không hỗ trợ Content-Type: {content_type}")
    if not text.strip():
        raise ValueError("Trang không có nội dung văn bản có thể đọc.")
    return {"title": title, "url": final_url, "text": text}
