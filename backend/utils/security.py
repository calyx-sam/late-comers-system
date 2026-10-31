"""Security utilities — token hashing, formula injection, phone masking."""

import hashlib
import secrets


def generate_token():
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def neutralise_formula(value: str) -> str:
    """Prefix cells starting with =, +, -, @ with a tab to prevent Excel formula injection."""
    if value and isinstance(value, str) and value[0] in ('=', '+', '-', '@'):
        return '\t' + value
    return value


def mask_phone(phone: str) -> str:
    """Mask all but last 4 digits of a phone number."""
    if phone and len(phone) > 4:
        return 'X' * (len(phone) - 4) + phone[-4:]
    return phone or ''
