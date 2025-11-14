# ChronoCrypt KMS Backend Tests

Comprehensive test suite for the KMS backend API and service layer.

## Test Structure

```
tests/
├── kms.test.ts       # Unit tests for KMS Service
├── api.test.ts       # Integration tests for API endpoints
├── e2e.test.ts       # End-to-end workflow tests
├── helpers.ts        # Test utilities and helpers
└── README.md         # This file
```

## Test Categories

### Unit Tests (`kms.test.ts`)

Tests for the KMS Service layer in isolation:

- **Initialization**: Service startup and configuration
- **Master Public Key**: Key generation and export
- **Access Authorization**: Request processing and key derivation
- **Audit Logs**: Logging, filtering, and statistics
- **Policy Management**: CRUD operations and policy enforcement
- **Status and Health**: System status reporting
- **Time Range Handling**: Various time range scenarios
- **Metadata Handling**: Request metadata processing
- **Concurrent Requests**: Race condition testing

**Run unit tests:**
```bash
cd apps/backend
bun test tests/kms.test.ts
```

### Integration Tests (`api.test.ts`)

Tests for the REST API endpoints:

- **Root & Health Endpoints**: Basic connectivity
- **Access Request Endpoints**: POST and GET operations
- **Audit Log Endpoints**: Querying and statistics
- **Policy Endpoints**: Full CRUD cycle
- **Key Management Endpoints**: Public key retrieval
- **Statistics Endpoint**: System metrics
- **CORS**: Cross-origin support
- **Error Handling**: Graceful error responses

**⚠️ IMPORTANT:** Integration tests require the server to be running separately:
```bash
# Terminal 1: Start the server
cd apps/backend
bun run dev

# Terminal 2: Run integration tests
cd apps/backend
bun test tests/api.test.ts
```

**To run only unit and E2E tests (no server required):**
```bash
cd apps/backend
bun test tests/kms.test.ts tests/e2e.test.ts
```

### End-to-End Tests (`e2e.test.ts`)

Complete workflow tests simulating real-world scenarios:

- **Complete Access Request Workflow**: Full lifecycle
- **Multi-User Scenario**: Multiple users with multiple requests
- **Policy Lifecycle**: Create, modify, delete policies
- **Audit Log Analysis**: Complete audit trail verification
- **Time-Based Key Derivation**: Key generation for various ranges
- **Concurrent Operations**: High concurrency testing
- **System Statistics**: Metrics accuracy
- **Error Recovery**: Resilience testing
- **Memory and Performance**: Large-scale operations

**Run E2E tests:**
```bash
cd apps/backend
bun test tests/e2e.test.ts
```

## Running Tests

### Run All Tests

```bash
cd apps/backend
bun test
```

### Run Specific Test File

```bash
bun test tests/kms.test.ts
bun test tests/api.test.ts
bun test tests/e2e.test.ts
```

### Run Specific Test Suite

```bash
bun test --grep "Access Authorization"
```

### Watch Mode

```bash
bun test --watch
```

### Coverage Report

```bash
bun test --coverage
```

## Test Helpers

The `helpers.ts` file provides utility functions:

- **Data Generation**: Generate test requests, users, policies
- **Validation**: Validate response structures
- **Time Utilities**: Time range generation and comparison
- **Batch Execution**: Rate-limited concurrent operations
- **Assertions**: Custom assertion helpers

### Example Usage

```typescript
import {
  generateAccessRequest,
  generateTimeRange,
  validateAccessResponse,
  executeBatch
} from './helpers';

// Generate a test request
const request = generateAccessRequest({
  requesterId: 'test-user-001',
  purpose: 'My test'
});

// Validate a response
const isValid = validateAccessResponse(response);

// Execute batch operations
const results = await executeBatch(
  requests,
  req => kms.authorizeAccess(req),
  { batchSize: 10, delayMs: 100 }
);
```

## Test Coverage

The test suite covers:

- ✅ Core KMS functionality
- ✅ All API endpoints
- ✅ Error handling and validation
- ✅ Concurrent operations
- ✅ Audit logging
- ✅ Policy management
- ✅ Time-based key derivation
- ✅ Multi-user scenarios
- ✅ Performance under load

## Expected Results

When all tests pass, you should see:

```
✓ KMS Service > Initialization (5 tests)
✓ KMS Service > Master Public Key (2 tests)
✓ KMS Service > Access Authorization (3 tests)
✓ KMS Service > Audit Logs (6 tests)
✓ KMS Service > Policy Management (7 tests)
✓ KMS Service > Status and Health (2 tests)
✓ KMS Service > Time Range Handling (3 tests)
✓ KMS Service > Metadata Handling (1 test)
✓ KMS Service > Concurrent Requests (1 test)

✓ End-to-End Workflows > Complete Access Request Workflow (2 tests)
✓ End-to-End Workflows > Multi-User Scenario (1 test)
✓ End-to-End Workflows > Policy Lifecycle (1 test)
✓ End-to-End Workflows > Audit Log Analysis (1 test)
✓ End-to-End Workflows > Time-Based Key Derivation (2 tests)
✓ End-to-End Workflows > Concurrent Operations (1 test)
✓ End-to-End Workflows > System Statistics (2 tests)
✓ End-to-End Workflows > Error Recovery (1 test)
✓ End-to-End Workflows > Memory and Performance (1 test)

Total: 42+ tests passed
```

## Integration Test Setup

For API integration tests, ensure:

1. Backend server is running on port 3001
2. Server has completed initialization
3. No other tests are modifying state concurrently

```bash
# Start server in test mode (if needed)
NODE_ENV=test bun run dev
```

## Performance Benchmarks

Expected performance characteristics:

- **Single Access Request**: < 50ms
- **10 Concurrent Requests**: < 500ms
- **100 Requests Sequential**: < 5s
- **24-Hour Time Range**: < 10s (86400 keys)

## Debugging Tests

### Verbose Output

```bash
bun test --verbose
```

### Debug Specific Test

```bash
bun test tests/kms.test.ts --grep "should grant access"
```

### Check Audit Logs

During tests, audit logs accumulate. You can inspect them:

```typescript
const logs = await kms.getAuditLogs();
console.log(JSON.stringify(logs, null, 2));
```

## Continuous Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: oven-sh/setup-bun@v1
    - run: bun install
    - run: bun test
```

## Test Data Cleanup

Unit and E2E tests use in-memory storage, so no cleanup is needed. Each test gets a fresh KMS instance.

## Contributing

When adding new features:

1. Write unit tests for service layer logic
2. Write integration tests for API endpoints
3. Write E2E tests for complete workflows
4. Ensure all existing tests pass
5. Aim for >80% code coverage

## Troubleshooting

### Tests Fail with "Connection Refused"

- Ensure backend server is running for integration tests
- Check port 3001 is not in use by another application

### Tests Timeout

- Increase timeout in test file: `test('...', async () => {...}, 30000)`
- Check for infinite loops or hung promises

### Flaky Tests

- Add appropriate delays with `await wait(100)`
- Check for race conditions in concurrent tests

### Memory Issues

- Large time range tests may consume significant memory
- Monitor with: `bun --max-old-space-size=4096 test`

## License

MIT
