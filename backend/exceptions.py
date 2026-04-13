"""Domain-specific exceptions used by the API and agents."""


class AppError(Exception):
    """Base class for all expected, recoverable application errors."""

    status_code: int = 500

    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code


class ValidationError(AppError):
    status_code = 400


class NotFoundError(AppError):
    status_code = 404


class LLMError(AppError):
    """Wraps any failure that originates from the LLM call layer."""

    status_code = 502


class LLMParseError(LLMError):
    """LLM returned content that could not be parsed into the expected shape."""
