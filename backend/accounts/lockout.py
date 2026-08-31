"""
accounts/lockout.py -- per-(username, IP) login lockout.

Sits on top of the 20/min scoped rate throttle: after
settings.LOGIN_MAX_FAILURES consecutive failures for the same
(username, client-IP) pair, that pair is refused for
settings.LOGIN_LOCK_SECONDS. Any successful login clears the counter.

State lives in the Django cache (LocMemCache by default -- fine for the
single-process dev server; use a shared cache backend if you run
multiple workers).
"""
from django.conf import settings
from django.core.cache import cache


def _key(kind, ident):
    return f"login:{kind}:{ident}"


def client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or "unknown"


def identity(username: str, request) -> str:
    return f"{(username or '').strip().lower()}|{client_ip(request)}"


def is_locked(ident: str) -> bool:
    return cache.get(_key("lock", ident)) is not None


def seconds_remaining(ident: str) -> int:
    ttl = cache.ttl(_key("lock", ident)) if hasattr(cache, "ttl") else None
    if ttl:
        return int(ttl)
    return settings.LOGIN_LOCK_SECONDS


def register_failure(ident: str) -> None:
    key = _key("fail", ident)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=settings.LOGIN_FAILURE_WINDOW_SECONDS)
        count = 1
    if count >= settings.LOGIN_MAX_FAILURES:
        cache.set(_key("lock", ident), True, timeout=settings.LOGIN_LOCK_SECONDS)
        cache.delete(key)


def clear(ident: str) -> None:
    cache.delete(_key("fail", ident))
    cache.delete(_key("lock", ident))
