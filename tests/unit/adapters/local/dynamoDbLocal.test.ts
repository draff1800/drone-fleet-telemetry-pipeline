import {
  defaultLocalDynamoDbConfig,
  localDynamoDbConfigFromEnv,
  rejectedRecordsTableDefinition,
  telemetryTableDefinition
} from "../../../../src/adapters/local/dynamoDbLocal";

describe("dynamoDbLocal", () => {
  afterEach(() => {
    delete process.env.LOCAL_DYNAMODB_ENDPOINT;
    delete process.env.AWS_REGION;
    delete process.env.LOCAL_TELEMETRY_TABLE_NAME;
    delete process.env.LOCAL_REJECTED_TABLE_NAME;
  });

  it("builds local configuration from defaults and environment overrides", () => {
    process.env.LOCAL_DYNAMODB_ENDPOINT = "http://dynamodb-local:8000";
    process.env.AWS_REGION = "eu-west-2";
    process.env.LOCAL_TELEMETRY_TABLE_NAME = "TelemetryOverride";
    process.env.LOCAL_REJECTED_TABLE_NAME = "RejectedOverride";

    expect(localDynamoDbConfigFromEnv()).toEqual({
      endpoint: "http://dynamodb-local:8000",
      region: "eu-west-2",
      telemetryTableName: "TelemetryOverride",
      rejectedTableName: "RejectedOverride"
    });
  });

  it("defaults to the local DynamoDB endpoint and table names", () => {
    expect(localDynamoDbConfigFromEnv()).toEqual(defaultLocalDynamoDbConfig);
  });

  it("defines the telemetry table with the same primary access pattern as AWS", () => {
    expect(telemetryTableDefinition("TelemetryTable")).toMatchObject({
      TableName: "TelemetryTable",
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        {
          AttributeName: "PK",
          KeyType: "HASH"
        },
        {
          AttributeName: "SK",
          KeyType: "RANGE"
        }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "EventTypeTimeIndex",
          KeySchema: [
            {
              AttributeName: "eventType",
              KeyType: "HASH"
            },
            {
              AttributeName: "timestamp",
              KeyType: "RANGE"
            }
          ]
        }
      ]
    });
  });

  it("defines the rejected records table with rejection reason and time keys", () => {
    expect(rejectedRecordsTableDefinition("RejectedTable")).toMatchObject({
      TableName: "RejectedTable",
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        {
          AttributeName: "PK",
          KeyType: "HASH"
        },
        {
          AttributeName: "SK",
          KeyType: "RANGE"
        }
      ]
    });
  });
});
