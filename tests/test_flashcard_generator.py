from src.agent.tools.flashcard_generator import extract_card_count


def test_flashcards_default_to_fifteen_cards():
    assert extract_card_count("Create flashcards about chapter one") == 15


def test_flashcards_extract_english_and_vietnamese_counts():
    assert extract_card_count("Create 20 flashcards about RAG") == 20
    assert extract_card_count("Tạo 12 thẻ về AI") == 12


def test_flashcard_count_is_capped():
    assert extract_card_count("Generate 99 cards") == 50
