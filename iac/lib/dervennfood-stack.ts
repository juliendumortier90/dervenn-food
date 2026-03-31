import * as path from "node:path";
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export class DervennFoodStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const basicAuthUsername = process.env.DERVENN_BASIC_AUTH_USERNAME;
    const foodBasicAuthPassword = process.env.DERVENN_FOOD_BASIC_AUTH_PASSWORD;
    const bikeBasicAuthPassword = process.env.DERVENN_BIKE_BASIC_AUTH_PASSWORD;
    const allowedOrigin = process.env.DERVENN_ALLOWED_ORIGIN ?? "*";

    if (!basicAuthUsername || !foodBasicAuthPassword || !bikeBasicAuthPassword) {
      throw new Error(
        "DERVENN_BASIC_AUTH_USERNAME, DERVENN_FOOD_BASIC_AUTH_PASSWORD and DERVENN_BIKE_BASIC_AUTH_PASSWORD are required"
      );
    }

    const commandesTable = new dynamodb.Table(this, "CommandesTable", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const bikeTable = new dynamodb.Table(this, "DervennBikeTable", {
      tableName: "dervenn-bike",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const foodLambdaEnvironment = {
      TABLE_NAME: commandesTable.tableName,
      ALLOWED_ORIGIN: allowedOrigin
    };

    const bikeLambdaEnvironment = {
      BIKE_TABLE_NAME: bikeTable.tableName,
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

    const commandesFunction = new lambdaNodejs.NodejsFunction(this, "CommandesFunction", {
      ...lambdaDefaults,
      entry: path.join(__dirname, "../../back/src/handlers/commandes.ts"),
      environment: foodLambdaEnvironment
    });

    const bikeCounterFunction = new lambdaNodejs.NodejsFunction(this, "BikeCounterFunction", {
      ...lambdaDefaults,
      entry: path.join(__dirname, "../../back/src/handlers/bikeCounter.ts"),
      environment: bikeLambdaEnvironment
    });

    const basicAuthAuthorizer = new lambdaNodejs.NodejsFunction(this, "BasicAuthAuthorizerFunction", {
      ...lambdaDefaults,
      entry: path.join(__dirname, "../../back/src/handlers/basicAuthAuthorizer.ts"),
      environment: {
        BASIC_AUTH_USERNAME: basicAuthUsername,
        FOOD_BASIC_AUTH_PASSWORD: foodBasicAuthPassword,
        BIKE_BASIC_AUTH_PASSWORD: bikeBasicAuthPassword
      }
    });

    commandesTable.grantReadWriteData(commandesFunction);
    bikeTable.grantReadWriteData(bikeCounterFunction);

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

    const commandesResource = api.root.addResource("commandes");
    commandesResource.addMethod("GET", new apigateway.LambdaIntegration(commandesFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });
    commandesResource.addMethod("POST", new apigateway.LambdaIntegration(commandesFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    });

    const commandesPretesResource = commandesResource.addResource("pretes");
    commandesPretesResource.addMethod("GET", new apigateway.LambdaIntegration(commandesFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
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

    const websiteBucket = new s3.Bucket(this, "FrontWebsiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const distribution = new cloudfront.Distribution(this, "FrontDistribution", {
      defaultRootObject: "index.html",
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
      value: `https://${distribution.domainName}`
    });
  }
}
