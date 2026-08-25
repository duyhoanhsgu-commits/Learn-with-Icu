from src.storage.postgres import LearningSpace


def test_learning_space_has_nullable_fixed_context():
    column = LearningSpace.__table__.columns["fixed_context"]

    assert column.nullable is True
    assert LearningSpace(name="Space", color="blue").fixed_context is None
