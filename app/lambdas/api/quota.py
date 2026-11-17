import datetime
from decimal import Decimal
from typing import Any, Dict, Optional


# FREE accounts are capped at 4 hours (14,400 seconds) per month; PRO accounts have unlimited execution time.
FREE_MONTHLY_QUOTA_SECONDS = 14400.0
DEFAULT_REQUEST_TIMEOUT_SECONDS = 5.0
MAX_SINGLE_EXECUTION_TIMEOUT_SECONDS = 300.0


class QuotaExceededError(Exception):
    """Raised when a FREE account has exhausted its monthly 14,400s execution quota."""

    def __init__(self, message: str, quota_details: Dict[str, Any]) -> None:
        super().__init__(message)
        self.message = message
        self.quota_details = quota_details
        self.status_code = 429


def get_current_period(now: Optional[datetime.datetime] = None) -> str:
    """Return current billing period in YYYY-MM format (UTC)."""
    dt = now or datetime.datetime.now(datetime.timezone.utc)
    return dt.strftime("%Y-%m")


def quota_pk(account_id: str, period: Optional[str] = None) -> str:
    """Build Single-Table PK: QUOTA#<account_id>#<YYYY-MM>."""
    ym = period or get_current_period()
    return f"QUOTA#{account_id}#{ym}"


def get_quota_status(
    account_id: str,
    tier: str,
    table: Any,
    period: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Read QUOTA#<account_id>#<YYYY-MM> from the DynamoDB Single-Table and compute remaining quota.
    """
    ym = period or get_current_period()
    pk = quota_pk(account_id, ym)
    normalized_tier = (tier or "FREE").upper()

    response = table.get_item(
        Key={
            "PK": pk,
            "SK": "SUMMARY",
        }
    )
    item = response.get("Item") or {}
    accumulated = float(item.get("accumulated_seconds", Decimal("0")))
    execution_count = int(item.get("execution_count", 0))

    if normalized_tier == "PRO":
        return {
            "PK": pk,
            "SK": "SUMMARY",
            "account_id": account_id,
            "period": ym,
            "tier": "PRO",
            "accumulated_seconds": round(accumulated, 4),
            "limit_seconds": None,
            "remaining_seconds": None,
            "unlimited": True,
            "quota_exceeded": False,
            "execution_count": execution_count,
        }

    remaining = max(0.0, round(FREE_MONTHLY_QUOTA_SECONDS - accumulated, 4))
    exceeded = accumulated >= FREE_MONTHLY_QUOTA_SECONDS or remaining <= 0.0
    return {
        "PK": pk,
        "SK": "SUMMARY",
        "account_id": account_id,
        "period": ym,
        "tier": "FREE",
        "accumulated_seconds": round(accumulated, 4),
        "limit_seconds": int(FREE_MONTHLY_QUOTA_SECONDS),
        "remaining_seconds": remaining,
        "unlimited": False,
        "quota_exceeded": exceeded,
        "execution_count": execution_count,
    }


def enforce_quota_and_calculate_timeout(
    account_id: str,
    tier: str,
    requested_timeout: Optional[float],
    table: Any,
    period: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Enforce monthly execution quotas:
      - FREE accounts are capped at 4 hours (14,400 seconds) per month.
      - PRO accounts have unlimited execution time.
      - Rejects requests with QuotaExceededError (HTTP 429) if quota is exceeded.
      - Enforces a strict timeout capped at the user's remaining monthly quota.
    """
    status = get_quota_status(account_id=account_id, tier=tier, table=table, period=period)
    req_timeout = (
        float(requested_timeout)
        if requested_timeout is not None
        else DEFAULT_REQUEST_TIMEOUT_SECONDS
    )
    if req_timeout <= 0:
        req_timeout = DEFAULT_REQUEST_TIMEOUT_SECONDS
    req_timeout = min(req_timeout, MAX_SINGLE_EXECUTION_TIMEOUT_SECONDS)

    if status["tier"] == "FREE":
        if status["quota_exceeded"] or (status["remaining_seconds"] or 0.0) <= 0.0:
            raise QuotaExceededError(
                message=(
                    f"Monthly execution quota of {int(FREE_MONTHLY_QUOTA_SECONDS)} seconds "
                    f"(4 hours) exceeded for FREE account '{account_id}' in period {status['period']}."
                ),
                quota_details=status,
            )
        effective_timeout = min(req_timeout, float(status["remaining_seconds"]))
    else:
        effective_timeout = req_timeout

    return {
        "effective_timeout": round(effective_timeout, 4),
        "requested_timeout": round(req_timeout, 4),
        "quota_status": status,
    }


def accumulate_quota_usage(
    account_id: str,
    tier: str,
    duration_seconds: float,
    table: Any,
    period: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Atomically increment accumulated execution seconds on QUOTA#<account_id>#<YYYY-MM> in DynamoDB.
    """
    ym = period or get_current_period()
    pk = quota_pk(account_id, ym)
    normalized_tier = (tier or "FREE").upper()
    dur_dec = Decimal(str(round(max(0.0, float(duration_seconds)), 4)))
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    table.update_item(
        Key={
            "PK": pk,
            "SK": "SUMMARY",
        },
        UpdateExpression=(
            "SET entity_type = :etype, account_id = :acc, #per = :per, tier = :tier, updated_at = :now "
            "ADD accumulated_seconds :dur, execution_count :inc"
        ),
        ExpressionAttributeNames={
            "#per": "period",
        },
        ExpressionAttributeValues={
            ":etype": "QUOTA",
            ":acc": account_id,
            ":per": ym,
            ":tier": normalized_tier,
            ":now": now_iso,
            ":dur": dur_dec,
            ":inc": Decimal("1"),
        },
    )

    return get_quota_status(account_id=account_id, tier=normalized_tier, table=table, period=ym)
