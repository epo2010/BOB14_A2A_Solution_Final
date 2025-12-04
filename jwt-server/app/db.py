"""Redis client configuration shared across the app."""

import redis

from .config import settings


# decode_responses ensures we always work with Python strings
# TENANT_REDIS_URL가 별도로 없으면 REDIS_URL을 fallback으로 사용해 로컬 실행 시 포트 미스매치(예: 6380)로 인한 연결 실패를 최소화한다.
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
tenant_redis_client = redis.Redis.from_url(
    settings.TENANT_REDIS_URL or settings.REDIS_URL,
    decode_responses=True,
)
