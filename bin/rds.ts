#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { RdsStack } from '../lib/rds-stack';

const app = new cdk.App();
new RdsStack(app, 'RdsStack', {
  stackName: 'RdsStack',
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
