from unittest.mock import MagicMock, patch

import pytest

from src.agent.tools.web_fetch import _extract_html, _validate_public_url, fetch_url


def test_extract_html_removes_navigation_and_scripts():
    title, text = _extract_html(
        b"<html><title>Article</title><nav>Menu</nav><article><h1>Hello</h1>Useful text"
        b"<script>bad()</script></article></html>"
    )
    assert title == "Article"
    assert "Useful text" in text
    assert "Menu" not in text
    assert "bad()" not in text


@patch("src.agent.tools.web_fetch.socket.getaddrinfo")
def test_validate_url_blocks_private_ip(mock_dns):
    mock_dns.return_value = [(None, None, None, None, ("127.0.0.1", 443))]
    with pytest.raises(ValueError, match="mạng nội bộ"):
        _validate_public_url("https://localhost/admin")


@patch("src.agent.tools.web_fetch._validate_public_url", side_effect=lambda value: value)
@patch("src.agent.tools.web_fetch.urllib.request.build_opener")
def test_fetch_url_returns_readable_page(mock_build_opener, _mock_validate):
    response = MagicMock()
    response.geturl.return_value = "https://example.com/article"
    response.headers.get_content_type.return_value = "text/html"
    response.read.return_value = b"<html><title>Example</title><main>Useful article body.</main></html>"
    response.__enter__.return_value = response
    response.__exit__.return_value = None
    mock_build_opener.return_value.open.return_value = response

    page = fetch_url("https://example.com/article")
    assert page["title"] == "Example"
    assert page["text"] == "Useful article body."
