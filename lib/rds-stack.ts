import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as logs from '@aws-cdk/aws-logs'

export class RdsStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 👇 create the VPC
    const vpc = new ec2.Vpc(this, 'my-cdk-vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 3,
      subnetConfiguration: [
        {
          name: 'public-subnet-1',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    // 👇 create a security group for the EC2 instance
    const ec2InstanceSG = new ec2.SecurityGroup(this, 'ec2-instance-sg', {
      vpc,
    });

    ec2InstanceSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'allow SSH connections from anywhere',
    );

    // 👇 create the EC2 instance
    const ec2Instance = new ec2.Instance(this, 'ec2-instance', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      securityGroup: ec2InstanceSG,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO,
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      keyName: 'landingZone',
    });

    const cluster = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_08_1 }),
      credentials: rds.Credentials.fromGeneratedSecret('clusteradmin'), // Optional - will default to 'admin' username and generated password
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
      instanceProps: {
        // optional , defaults to t3.medium
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
        vpc,
      },
      defaultDatabaseName: 'ORCL',
      storageEncrypted: true,
      monitoringInterval: cdk.Duration.seconds(60),
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
    });

    cdk.Tags.of(cluster).add('Name', 'AuroraMysqlRdsCluster', {
    });

    // Allow connections on default port from any IPV4
    cluster.connections.allowDefaultPortFromAnyIpv4();

    // Rotate the master user password every 30 days
    cluster.addRotationSingleUser();

    cluster.connections.allowFrom(ec2Instance, ec2.Port.tcp(5432));

    //VolumeReadIOPS
    const VolumeReadIOPSmetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'VolumeReadIOPS',
      dimensionsMap: {
        dbClusterIdentifier: cluster.clusterIdentifier
      }
    });

    new cloudwatch.Alarm(this, 'VolumeReadIOPSAlarm', {
      metric: VolumeReadIOPSmetric,
      threshold: 100,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
    });

    //VolumeWriteIOPS
    const VolumeWriteIOPSmetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'VolumeWriteIOPS',
      dimensionsMap: {
        dbClusterIdentifier: cluster.clusterIdentifier
      }
    });

    new cloudwatch.Alarm(this, 'VolumeWriteIOPSAlarm', {
      metric: VolumeWriteIOPSmetric,
      threshold: 100,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
    });

    //ReadIOPS
    const ReadIOPSmetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'ReadIOPS',
      dimensionsMap: {
        DBInstanceIdentifier: cluster.instanceIdentifiers[1]
      }
    });

    new cloudwatch.Alarm(this, 'ReadIOPSAlarm', {
      metric: ReadIOPSmetric,
      threshold: 100,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
    });

    // WriteIOPS
    const WriteIOPSmetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'WriteIOPS',
      dimensionsMap: {
        DBInstanceIdentifier: cluster.instanceIdentifiers[0]
      }
    });

    new cloudwatch.Alarm(this, 'WriteIOPSAlarm', {
      metric: WriteIOPSmetric,
      threshold: 100,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
    });

    //ReaderDiskQueueDepth
    const ReaderDiskQueueDepthmetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'DiskQueueDepth',
      dimensionsMap: {
        DBInstanceIdentifier: cluster.instanceIdentifiers[1]
      }
    });

    new cloudwatch.Alarm(this, 'ReaderDiskQueueDepth', {
      metric: ReaderDiskQueueDepthmetric,
      threshold: 100,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
    });
    
    //WriterDiskQueueDepth
    const WriterDiskQueueDepthmetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'DiskQueueDepth',
      dimensionsMap: {
        DBInstanceIdentifier: cluster.instanceIdentifiers[0]
      }
    });

    new cloudwatch.Alarm(this, 'WriterDiskQueueDepth', {
      metric: WriterDiskQueueDepthmetric,
      threshold: 100,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
    });
   }
 }
