#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DervennFoodStack } from "../lib/dervennfood-stack";

const app = new cdk.App();

new DervennFoodStack(app, "DervennFoodStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "eu-west-3"
  }
});
