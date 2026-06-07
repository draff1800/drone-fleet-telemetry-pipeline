import {
  defaultLocalDynamoDbConfig,
  localDynamoDbConfigFromEnv,
  rejectedTelemetryTableDefinition,
  telemetryTableDefinition
} from "../../../../../../src/adapters/local/persistence/local-dynamo-db/localDynamoDb";

describe("localDynamoDb", () => {
  afterEach(() => {
    delete process.env.LOCAL_DYNAMODB_ENDPOINT;
    delete process.env.AWS_REGION;
    delete process.env.LOCAL_TELEMETRY_TABLE_NAME;
    delete process.env.LOCAL_REJECTED_TELEMETRY_TABLE_NAME;
  });

  it("builds local configuration from defaults and environment overrides", () => {
    // ARRANGE
    process.env.LOCAL_DYNAMODB_ENDPOINT = "http://dynamodb-local:8000";
    process.env.AWS_REGION = "eu-west-2";
    process.env.LOCAL_TELEMETRY_TABLE_NAME = "TelemetryOverride";
    process.env.LOCAL_REJECTED_TELEMETRY_TABLE_NAME = "RejectedOverride";
    const expectedResult = {
      endpoint: "http://dynamodb-local:8000",
      region: "eu-west-2",
      telemetryTableName: "TelemetryOverride",
      rejectedTelemetryTableName: "RejectedOverride"
    };

    // ACT
    const actualResult = localDynamoDbConfigFromEnv();

    // ASSERT
    expect(actualResult).toEqual(expectedResult);
  });

  it("defaults to the local DynamoDB endpoint and table names", () => {
    // ARRANGE
    const expectedResult = defaultLocalDynamoDbConfig;

    // ACT
    const actualResult = localDynamoDbConfigFromEnv();

    // ASSERT
    expect(actualResult).toEqual(expectedResult);
  });

  it("defines the telemetry table with the same primary access pattern as AWS", () => {
    // ARRANGE
    const expectedResult = {
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
    };

    // ACT
    const actualResult = telemetryTableDefinition("TelemetryTable");

    // ASSERT
    expect(actualResult).toMatchObject(expectedResult);
  });

  it("defines the rejected records table with rejection reason and time keys", () => {
    // ARRANGE
    const expectedResult = {
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
    };

    // ACT
    const actualResult = rejectedTelemetryTableDefinition("RejectedTable");

    // ASSERT
    expect(actualResult).toMatchObject(expectedResult);
  });
});
