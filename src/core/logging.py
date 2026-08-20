import sys
import logging
from loguru import logger


class InterceptHandler(logging.Handler):
    """
    Default handler from loguru documentation to intercept
    standard logging messages towards Loguru sink.
    """
    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging(debug: bool = True) -> None:
    """Configures system logging using loguru."""
    logger.remove()
    log_level = "DEBUG" if debug else "INFO"

    logger.add(
        sys.stdout,
        enqueue=True,
        backtrace=True,
        level=log_level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    )

    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)


__all__ = ["logger", "setup_logging"]
