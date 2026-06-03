# Project instructions

This is a take-home challenge for a Senior Backend Engineer role at ScreenCloud.

## Goal

Build a local-first, cloud-native TypeScript drone telemetry pipeline.

The local MVP must run without AWS credentials. The deployed architecture should use API Gateway, SQS, Lambda, DynamoDB and DLQ via Serverless Framework.

## Architecture principles

- Keep core business logic independent of AWS runtime code.
- Use thin adapters for local file runner, API Gateway handler and SQS handler.
- Use ports/interfaces for persistence, logging, metrics and error reporting.
- Prefer small, testable functions.
- Use Zod for validation.
- Use structured logging.
- Distinguish validation failures from system failures.
- Invalid telemetry records should not crash the whole batch.
- System failures should be allowed to retry in AWS.
- Do not commit secrets.
- Keep README accurate and reviewer-friendly.

## Commands to run

After meaningful code changes, run:

- npm run typecheck
- npm test
- npm run process:sample

Before final submission, run:

- npm run lint
- npm run typecheck
- npm test
- npm run process:sample

## Style

- TypeScript strict mode.
- No unnecessary frameworks.
- Prefer clear names over clever abstractions.
- Keep AWS-specific code out of core processing.
- Add tests for edge cases.
