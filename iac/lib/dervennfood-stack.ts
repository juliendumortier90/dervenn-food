import * as path from "node:path";
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

const defaultFrontDomainName = "counter.dervenn-trail.org";
const defaultFrontCertificateArn =
  "arn:aws:acm:us-east-1:114563865686:certificate/fa1877b2-2517-45c5-8a40-36ade1143d9a";
const defaultAllowedOrigin = `https://${defaultFrontDomainName}`;

export class DervennFoodStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const basicAuthUsername = process.env.DERVENN_BASIC_AUTH_USERNAME;
    const publicBasicAuthPassword = process.env.DERVENN_PUBLIC_BASIC_AUTH_PASSWORD;
    const adminBasicAuthPassword = process.env.DERVENN_ADMIN_BASIC_AUTH_PASSWORD;
    const allowedOrigin = process.env.DERVENN_ALLOWED_ORIGIN ?? defaultAllowedOrigin;
    const frontDomainName = process.env.DERVENN_FRONT_DOMAIN ?? defaultFrontDomainName;
    const frontCertificateArn = process.env.DERVENN_FRONT_CERTIFICATE_ARN ?? defaultFrontCertificateArn;

    if (!basicAuthUsername || !publicBasicAuthPassword || !adminBasicAuthPassword) {
      throw new Error(
        "DERVENN_BASIC_AUTH_USERNAME, DERVENN_PUBLIC_BASIC_AUTH_PASSWORD and DERVENN_ADMIN_BASIC_AUTH_PASSWORD are required"
      );
    }

    if (frontDomainName && !frontCertificateArn) {
      throw new Error("DERVENN_FRONT_CERTIFICATE_ARN is required when DERVENN_FRONT_DOMAIN is set");
    }

    const bikeEventsTable = new dynamodb.Table(this, "DervennBikeEventsTable", {
      tableName: "dervenn-bike-events",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const bikeStatsTable = new dynamodb.Table(this, "DervennBikeStatsTable", {
      tableName: "dervenn-bike-stats",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const planningTable = new dynamodb.Table(this, "DervennPlanningTable", {
      tableName: "dervenn-planning",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const bikeLambdaEnvironment = {
      BIKE_EVENTS_TABLE_NAME: bikeEventsTable.tableName,
      BIKE_STATS_TABLE_NAME: bikeStatsTable.tableName,
      ALLOWED_ORIGIN: allowedOrigin
    };

    const planningLambdaEnvironment = {
      PLANNING_TABLE_NAME: planningTable.tableName,
      ALLOWED_ORIGIN: allowedOrigin
    };

    const lambdaDefaults: Partial<lambdaNodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      bundling: {
        target: "node20",
        sourceMap: true
      }
    };

    const bikeCounterFunction = new lambdaNodejs.NodejsFunction(this, "BikeCounterFunction", {
      ...lambdaDefaults,
      entry: path.join(__dirname, "../../back/src/handlers/bikeCounter.ts"),
      environment: bikeLambdaEnvironment
    });

    const planningFunction = new lambdaNodejs.NodejsFunction(this, "PlanningFunction", {
      ...lambdaDefaults,
      entry: path.join(__dirname, "../../back/src/handlers/planning.ts"),
      environment: planningLambdaEnvironment
    });

    const basicAuthAuthorizer = new lambdaNodejs.NodejsFunction(this, "BasicAuthAuthorizerFunction", {
      ...lambdaDefaults,
      entry: path.join(__dirname, "../../back/src/handlers/basicAuthAuthorizer.ts"),
      environment: {
        BASIC_AUTH_USERNAME: basicAuthUsername,
        PUBLIC_BASIC_AUTH_PASSWORD: publicBasicAuthPassword,
        ADMIN_BASIC_AUTH_PASSWORD: adminBasicAuthPassword
      }
    });

    bikeEventsTable.grantReadWriteData(bikeCounterFunction);
    bikeStatsTable.grantReadWriteData(bikeCounterFunction);
    planningTable.grantReadWriteData(planningFunction);

    const api = new apigateway.RestApi(this, "DervennApi", {
      restApiName: "Dervenn API",
      defaultCorsPreflightOptions: {
        allowOrigins: [allowedOrigin],
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "OPTIONS"]
      }
    });

    const authorizer = new apigateway.RequestAuthorizer(this, "DervennBasicAuthAuthorizer", {
      handler: basicAuthAuthorizer,
      identitySources: [apigateway.IdentitySource.header("Authorization")],
      resultsCacheTtl: Duration.seconds(0)
    });

    const bikeResource = api.root.addResource("bike");
    const bikeCounterResource = bikeResource.addResource("counter");
    bikeCounterResource.addMethod("POST", new apigateway.LambdaIntegration(bikeCounterFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });

    const bikeStatsResource = bikeResource.addResource("stats");
    bikeStatsResource.addMethod("GET", new apigateway.LambdaIntegration(bikeCounterFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });
    bikeStatsResource.addMethod("POST", new apigateway.LambdaIntegration(bikeCounterFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });

    const bikeHistoryResource = bikeResource.addResource("history");
    bikeHistoryResource.addMethod("GET", new apigateway.LambdaIntegration(bikeCounterFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });

    const bikeResetSessionResource = bikeResource.addResource("resetsession");
    bikeResetSessionResource.addMethod("POST", new apigateway.LambdaIntegration(bikeCounterFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });

    const planningResource = api.root.addResource("planning");
    const planningEditionsResource = planningResource.addResource("editions");
    planningEditionsResource.addMethod("GET", new apigateway.LambdaIntegration(planningFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });

    const planningEditionItemResource = planningEditionsResource.addResource("{editionId}");
    planningEditionItemResource.addMethod("GET", new apigateway.LambdaIntegration(planningFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });

    const planningAdminResource = planningResource.addResource("admin");
    const planningAdminEditionsResource = planningAdminResource.addResource("editions");
    planningAdminEditionsResource.addMethod("GET", new apigateway.LambdaIntegration(planningFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });
    planningAdminEditionsResource.addMethod("POST", new apigateway.LambdaIntegration(planningFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });

    const planningAdminEditionItemResource = planningAdminEditionsResource.addResource("{editionId}");
    planningAdminEditionItemResource.addMethod("GET", new apigateway.LambdaIntegration(planningFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });
    planningAdminEditionItemResource.addMethod("POST", new apigateway.LambdaIntegration(planningFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });

    const websiteBucket = new s3.Bucket(this, "FrontWebsiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const frontCertificate = frontCertificateArn
      ? acm.Certificate.fromCertificateArn(this, "FrontCertificate", frontCertificateArn)
      : undefined;

    const distribution = new cloudfront.Distribution(this, "FrontDistribution", {
      defaultRootObject: "index.html",
      certificate: frontCertificate,
      domainNames: frontDomainName ? [frontDomainName] : undefined,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(1)
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(1)
        }
      ]
    });

    websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [websiteBucket.arnForObjects("*")],
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`
          }
        }
      })
    );

    new s3deploy.BucketDeployment(this, "DeployFront", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../front/dist")),
        s3deploy.Source.jsonData("runtime-config.json", {
          apiBaseUrl: api.url.replace(/\/$/, "")
        })
      ],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ["/*"]
    });

    new CfnOutput(this, "ApiUrl", {
      value: api.url
    });

    new CfnOutput(this, "FrontUrl", {
      value: frontDomainName ? `https://${frontDomainName}` : `https://${distribution.domainName}`
    });
  }
}
