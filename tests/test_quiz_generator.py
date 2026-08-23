from src.agent.tools.quiz_generator import extract_question_count


def test_quiz_defaults_to_ten_questions():
    assert extract_question_count("Create a quiz about chapter one") == 10


def test_quiz_extracts_english_and_vietnamese_counts():
    assert extract_question_count("Create 7 questions about RAG") == 7
    assert extract_question_count("Tạo 12 câu hỏi về AI") == 12


def test_quiz_count_is_capped():
    assert extract_question_count("Generate 99 questions") == 30
