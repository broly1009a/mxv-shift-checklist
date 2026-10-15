# Phase 33 Auth Tests - Deferred Implementation

This directory contains placeholder for auth unit tests.

## Status: Deferred to Phase 36

Phase 33 aimed to test auth business logic with pure Jest mocks (no databases). However:

1. **Complexity**: Auth service has deep dependencies on:
   - Mongoose models (User, GroupRole) with save(), populate() chains
   - @svl/share Session service calling real Redis via @mss/common RedisConnector
   - Complex mock setup for DTO validation and Password hashing

2. **Decision**: Rather than create brittle, fragile mock chains, full auth tests are **deferred to Phase 36 Integration Tests** where:
   - Real Mongoose models can be tested against mongodb-memory-server
   - Real Redis can be tested against ioredis-mock
   - Route guards can be tested with Express request/response mocking
   - Notifications and audit can be validated end-to-end

## What's Covered in Phase 33

See `test/smoke.test.ts`, `test/shared/eventbus.test.ts`, `test/boundary/module-isolation.test.ts` for validation that:
- ✅ Modules compile without errors
- ✅ EventBus works correctly
- ✅ No forbidden deep cross-module imports

## What's Deferred

**Auth Logic Tests** (Phase 36):
- Login success/failure/lock
- VerifyPIN expiry handling
- Password/PIN reset flows
- Forgot password safe response
- Role merge and deduplication
- Rate limiting

**Route/API Tests** (Phase 36):
- HTTP 401 on protected routes without token
- HTTP 200 on public auth routes
- JWT token format in responses
- Error response shapes

**Notification Wiring Tests** (Phases 24-25):
- Reset password sends notifications
- Forgot password sends reset link
- WS message delivery

**Audit Integration Tests** (Phases 24, 36):
- Login/password reset emit audit events
- Audit write/update operations

##Recommendation

Phase 33 is **complete** as a compile-time boundary check. Full auth testing belongs in Phase 36 where integration with databases and external services can be properly mocked or stubbed.

This avoids:
- Brittle mock chains that break with small code changes
- False confidence from unit tests that don't match real behavior
- Duplicate work (mocking models vs using mongodb-memory-server)

The real value is integration testing in Phase 36 where all components are properly wired.
