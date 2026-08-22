import json
from unittest.mock import MagicMock, patch

from src.agent.tools.web_search import _search_duckduckgo, _search_tavily, web_search


def _mock_response(body: str):
    response = MagicMock()
    response.read.return_value = body.encode("utf-8")
    response.__enter__.return_value = response
    response.__exit__.return_value = None
    return response


@patch("src.agent.tools.web_search.urllib.request.urlopen")
def test_search_duckduckgo_parses_results(mock_urlopen):
    mock_urlopen.return_value = _mock_response(
        '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">'
        "Example &amp; title</a>"
        '<a class="result__snippet">A <b>useful</b> result.</a>'
    )

    results = _search_duckduckgo("example")

    assert results == [
        {
            "title": "Example & title",
            "url": "https://example.com",
            "snippet": "A useful result.",
        }
    ]


@patch("src.agent.tools.web_search.urllib.request.urlopen")
def test_search_tavily_parses_results(mock_urlopen):
    mock_urlopen.return_value = _mock_response(
        json.dumps(
            {
                "results": [
                    {
                        "title": "Article",
                        "url": "https://example.com/article",
                        "content": "Summary",
                    }
                ]
            }
        )
    )

    results = _search_tavily("news", "secret")

    assert results[0]["title"] == "Article"
    assert results[0]["snippet"] == "Summary"


def test_web_search_rejects_blank_query():
    assert web_search("   ") == "Câu truy vấn tìm kiếm không được để trống."
