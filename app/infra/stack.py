import os
from aws_cdk import (
    CfnOutput,
    Duration,
    RemovalPolicy,
    Stack,
    aws_apigateway as apigw,
    aws_dynamodb as ddb,
    aws_lambda as _lambda,
)
from constructs import Construct


class AppStack(Stack):
    """
    CDK Stack for the Ephemeral Code Execution IaaS (Firecracker-style MicroVM Control Plane).
    Defines:
      - DynamoDB Single-Table (PK, SK, PAY_PER_REQUEST)
      - Lambda Layer for shared dependencies
      - Python 3.11 Lambda functions with AWS_ENDPOINT_URL and REDIS_HOST=redis
      - API Gateway (LambdaRestApi) with CfnOutput ApiUrl
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        # 1. Tabla DynamoDB — Single Table Design (PK, SK, PAY_PER_REQUEST)
        self.table = ddb.Table(
            self,
            "AppTable",
            table_name="EphemeralSandboxTable",
            partition_key=ddb.Attribute(
                name="PK",
                type=ddb.AttributeType.STRING,
            ),
            sort_key=ddb.Attribute(
                name="SK",
                type=ddb.AttributeType.STRING,
            ),
            billing_mode=ddb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # 2. Lambda Layer — Dependencias compartidas
        deps_layer = _lambda.LayerVersion(
            self,
            "DependenciasLayer",
            code=_lambda.Code.from_asset(os.path.join(base_dir, "layers", "dependencias")),
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_11],
            description="Dependencias para Lambdas (redis, PyJWT, boto3)",
        )

        common_env = {
            "TABLE_NAME": self.table.table_name,
            "AWS_ENDPOINT_URL": os.environ.get("AWS_ENDPOINT_URL", "http://emulador:4566"),
            "REDIS_HOST": os.environ.get("REDIS_HOST", "redis"),
            "REDIS_PORT": os.environ.get("REDIS_PORT", "6379"),
            "JWT_SECRET": os.environ.get("JWT_SECRET", "aurora-firecracker-super-secret-jwt-key-2026"),
            "CACHE_TTL_SECONDS": "300",
        }

        # 3. Lambda Handler Principal — Control Plane & Ephemeral Sandbox Runner
        self.api_handler = _lambda.Function(
            self,
            "ApiHandler",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="handler.main",
            code=_lambda.Code.from_asset(os.path.join(base_dir, "lambdas", "api")),
            layers=[deps_layer],
            timeout=Duration.seconds(60),
            memory_size=256,
            environment=common_env,
        )

        # 4. Lambda Handler de Health Check
        self.health_handler = _lambda.Function(
            self,
            "HealthHandler",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="handler.main",
            code=_lambda.Code.from_asset(os.path.join(base_dir, "lambdas", "health")),
            layers=[deps_layer],
            timeout=Duration.seconds(10),
            memory_size=128,
            environment=common_env,
        )

        self.table.grant_read_write_data(self.api_handler)
        self.table.grant_read_data(self.health_handler)

        # 5. API Gateway — LambdaRestApi
        self.api = apigw.LambdaRestApi(
            self,
            "Api",
            handler=self.api_handler,
            proxy=True,
            deploy_options=apigw.StageOptions(stage_name="prod"),
        )

        # Output ApiUrl (como se documenta en el flujo de cdklocal deploy)
        CfnOutput(
            self,
            "ApiUrl",
            value=self.api.url,
            description="URL base del API Gateway desplegado en LocalStack/MiniStack",
        )


ProyectoFinalStack = AppStack
