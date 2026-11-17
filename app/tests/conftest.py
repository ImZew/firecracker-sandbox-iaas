import os
import sys

# Ensure `app/` and `app/lambdas/api/` are importable when running `python -m pytest`
APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_LAMBDA_DIR = os.path.join(APP_ROOT, "lambdas", "api")
for p in (APP_ROOT, API_LAMBDA_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

import boto3
import fakeredis
import pytest
from moto import mock_aws

from lambdas.api import cache as cache_module
from lambdas.api import handler as handler_module


@pytest.fixture(autouse=True)
def aws_and_redis_env(monkeypatch):
    """
    Set up an isolated in-memory DynamoDB Single-Table (via moto) and
    in-memory Redis instance (via fakeredis) for every unit test.
    Runs completely offline without requiring LocalStack or Redis containers.
    """
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("TABLE_NAME", "EphemeralSandboxTable")
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-2026")
    monkeypatch.setenv("CACHE_TTL_SECONDS", "300")
    monkeypatch.delenv("AWS_ENDPOINT_URL", raising=False)

    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    cache_module.set_redis_client(fake_redis)

    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
        table = dynamodb.create_table(
            TableName="EphemeralSandboxTable",
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        table.wait_until_exists()
        handler_module.set_dynamodb_table(table)

        yield {
            "table": table,
            "redis": fake_redis,
        }

        handler_module.set_dynamodb_table(None)
        cache_module.set_redis_client(None)
