# /home/agents/tools/redis_item_tools.py
import os
import redis
from typing import Optional

# Redis ??
REDIS_HOST = os.getenv("AGENT_REDIS_HOST", os.getenv("REDIS_HOST", "localhost"))
REDIS_PORT = int(os.getenv("AGENT_REDIS_PORT", os.getenv("REDIS_PORT", "6379")))
REDIS_DB = int(os.getenv("AGENT_REDIS_DB", os.getenv("REDIS_DB", "0")))

redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_DB,
    decode_responses=True
)


def _item_id_candidates(item_id: str) -> list[str]:
    """Generate normalized item ids that match the Redis keys."""
    raw = item_id.strip().upper()
    trimmed = raw
    if trimmed.startswith("ITEM"):
        trimmed = trimmed[4:]

    candidates: list[str] = []
    if trimmed:
        base_candidate = trimmed if trimmed.startswith("I") else f"I{trimmed}"
        candidates.append(base_candidate)

    digits = "".join(ch for ch in trimmed if ch.isdigit())
    if not digits:
        digits = "".join(ch for ch in raw if ch.isdigit())

    if digits:
        padded = f"I{int(digits):04d}"
        if padded not in candidates:
            candidates.append(padded)

    return candidates


def _lookup_item_data(item_id: str) -> tuple[str | None, dict]:
    for candidate in _item_id_candidates(item_id):
        key = f"item:{candidate}"
        data = redis_client.hgetall(key)
        if data:
            return candidate, data
    return None, {}


def get_item_details(item_id: str) -> dict:
    """Return the Redis hash for the requested item ID."""
    normalized_id, data = _lookup_item_data(item_id)
    if not data:
        return {"status": "error", "message": f"No item found for {item_id}"}
    return {"status": "success", "item_id": normalized_id, "data": data}


def track_item_inventory(item_id: str, warehouse_id: Optional[str] = None) -> dict:
    """Track inventory for the item, optionally filtering by warehouse."""
    normalized_id, data = _lookup_item_data(item_id)
    if not data:
        return {"status": "error", "message": f"No item found for {item_id}"}

    if warehouse_id:
        if data.get("warehouse_id") == warehouse_id:
            return {
                "status": "success",
                "item_id": normalized_id,
                "warehouse_id": warehouse_id,
                "quantity": data.get("quantity"),
            }
        return {
            "status": "error",
            "message": f"Item {item_id} not found in warehouse {warehouse_id}",
        }

    return {"status": "success", "item_id": normalized_id, "data": data}


def get_all_warehouse_inventories_for_item(item_id: str) -> dict:
    """Return the stored inventory summary for the item."""
    normalized_id, data = _lookup_item_data(item_id)
    if not data:
        return {"status": "error", "message": f"No item found for {item_id}"}
    return {"status": "success", "item_id": normalized_id, "data": data}
