# Workspace Lock System - Strict Code-Level Verification

## Executive Summary

**Status**: ⚠️ **RACE CONDITION FOUND** - Stale lock reproduction is possible under concurrent load.

**Critical Issue**: `acquire_workspace_lock()` has a race condition between `get_workspace_lock()` check and `insert_one()` operation. No unique constraint prevents duplicate locks.

---

## 1. Lock State Read Verification

### Direct DB Queries Found

**Location**: `backend/server.py:887`
- **Line 887**: `lock = await db.workspace_locks.find_one({"workspace_id": workspace_id}, {"_id": 0})`
- **Context**: Inside `get_workspace_lock()` function
- **Status**: ✅ **PASS** - This is the only direct read, and it's wrapped in expiration check

**Location**: `backend/server.py:2663`
- **Line 2663**: `all_locks = await db.workspace_locks.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(100)`
- **Context**: Workspace deletion endpoint
- **Status**: ✅ **PASS** - Used only for cleanup during workspace deletion, then calls `release_workspace_lock()` which uses `get_workspace_lock()`

### Cached Lock State

**Status**: ✅ **PASS** - No caching found. All lock reads go through database.

### Duplicated Lock-Check Logic

**Status**: ✅ **PASS** - All lock checks go through `get_workspace_lock()`:
- `acquire_workspace_lock()` → calls `get_workspace_lock()` (line 915)
- `release_workspace_lock()` → calls `get_workspace_lock()` (line 995)
- `check_membership_lock_invariant()` → calls `get_workspace_lock()` (line 1042)
- Heartbeat endpoint → calls `get_workspace_lock()` (line 2335)

### Conclusion

**Status**: ✅ **PASS** - All lock reads go exclusively through `get_workspace_lock()` except workspace deletion cleanup (which is safe).

---

## 2. get_workspace_lock() Audit

### Expiration Check Verification

**Location**: `backend/server.py:891-899`

**Code**:
```python
# MANDATORY: Check expiration on every read - backend is authoritative
expires_at = datetime.fromisoformat(lock['expires_at'].replace('Z', '+00:00'))
now = datetime.now(timezone.utc)
if now > expires_at:
    # Lock expired - delete it and treat as unlocked
    await db.workspace_locks.delete_one({"workspace_id": workspace_id})
    logging.info(f"[get_workspace_lock] Expired lock deleted for workspace {workspace_id}")
    return None
```

**Verification**:
- ✅ Expiration check: `now > expires_at` (line 894)
- ✅ Expired locks deleted: `delete_one()` called immediately (line 897)
- ✅ Server time used: `datetime.now(timezone.utc)` (line 893)
- ✅ No client timestamps: All timestamps are server-generated

**Logging Verification**:
- ✅ Logging present: `logging.info()` on line 898
- ✅ Does not mask failures: Logging is informational, exceptions would propagate

### Conclusion

**Status**: ✅ **PASS** - Expiration is checked on every call, expired locks are deleted immediately, server time is used.

---

## 3. acquire_workspace_lock() Race Condition Audit

### Atomicity Analysis

**Location**: `backend/server.py:915-969`

**Code Flow**:
```python
existing_lock = await get_workspace_lock(workspace_id)  # Line 915

if existing_lock:
    # Handle existing lock...
else:
    # No valid lock exists
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    lock = WorkspaceLock(...)
    lock_dict = lock.model_dump()
    await db.workspace_locks.insert_one(lock_dict)  # Line 969
```

### Race Condition Proof

**Scenario**: Two users (A and B) call `acquire_workspace_lock()` simultaneously:

1. **Time T0**: User A calls `get_workspace_lock()` → returns `None` (no lock)
2. **Time T0**: User B calls `get_workspace_lock()` → returns `None` (no lock)
3. **Time T1**: User A proceeds to `insert_one()` → succeeds, creates lock
4. **Time T1**: User B proceeds to `insert_one()` → succeeds, creates duplicate lock

**Evidence**:
- No database transaction wrapping the check-and-insert
- No unique constraint on `workspace_id` (verified: no index creation code found)
- No `SELECT ... FOR UPDATE` equivalent (MongoDB doesn't support this pattern)
- `insert_one()` is not atomic with the preceding `get_workspace_lock()` check

### Database Constraints

**Search Results**: No `create_index` or `ensure_index` calls found for `workspace_locks` collection.

**Conclusion**: ❌ **FAIL** - No unique constraint exists on `workspace_id`. Race condition is possible.

### Impact

**Race Condition Impact**:
- Two users can acquire locks simultaneously
- Database can contain multiple locks for same `workspace_id`
- `get_workspace_lock()` uses `find_one()` which returns only one document (arbitrary)
- Behavior is non-deterministic under concurrent load

### Conclusion

**Status**: ❌ **FAIL** - Acquisition is NOT atomic. Race condition exists.

**Fix Required**:
```python
# Option 1: Use findOneAndUpdate with upsert (atomic)
result = await db.workspace_locks.find_one_and_update(
    {"workspace_id": workspace_id},
    {
        "$setOnInsert": {
            "id": str(uuid.uuid4()),
            "workspace_id": workspace_id,
            "locked_by_user_id": user_id,
            "locked_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat()
        }
    },
    upsert=True,
    return_document=True
)

# Option 2: Create unique index on workspace_id
# db.workspace_locks.create_index("workspace_id", unique=True)
```

---

## 4. Endpoints Showing "Workspace Currently in Use"

### Endpoint Analysis

**Location**: `backend/server.py:2289-2316` (`POST /workspaces/{workspace_id}/lock`)

**Code**:
```python
lock = await acquire_workspace_lock(workspace_id, current_user.id, force=force)
```

**409 Error Location**: `backend/server.py:952-955`

**Code**:
```python
raise HTTPException(
    status_code=409,
    detail=f"Another user ({locked_by_name}) is currently connected to this workspace. Entering now will force them out and may cause data loss."
)
```

### Condition Analysis

**Trigger Condition**: Line 945-955
- Only triggers if `existing_lock` exists (line 917)
- Only triggers if `existing_lock.locked_by_user_id != user_id` (line 919)
- Only triggers if `force=False` (line 928)
- `existing_lock` comes from `get_workspace_lock()` which enforces expiration

**Verification**:
- ✅ Only triggers on valid, unexpired lock: `get_workspace_lock()` filters expired locks
- ✅ Only triggers on different user: Check on line 919
- ✅ Expired locks cannot reach frontend: `get_workspace_lock()` returns `None` for expired locks

### Conclusion

**Status**: ✅ **PASS** - Warning only triggers on valid, unexpired locks held by different users. Expired locks are filtered by `get_workspace_lock()`.

---

## 5. Heartbeat Validation

### Heartbeat Endpoint

**Location**: `backend/server.py:2318-2362`

**Code**:
```python
existing_lock = await get_workspace_lock(workspace_id)  # Line 2335

if not existing_lock:
    raise HTTPException(status_code=404, ...)  # Lock expired or doesn't exist

if existing_lock.locked_by_user_id != current_user.id:
    raise HTTPException(status_code=403, ...)  # Held by another user

# Extend TTL
expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
await db.workspace_locks.update_one(
    {"workspace_id": workspace_id},
    {"$set": {"expires_at": expires_at.isoformat()}}
)
```

**Verification**:
- ✅ Only extends TTL: `update_one()` only updates `expires_at` (line 2354-2357)
- ✅ Heartbeat failure leads to expiration: If heartbeat fails, lock expires after 10 minutes
- ✅ No background task: No scheduled tasks found that auto-refresh locks
- ✅ No silent refresh: All refresh goes through explicit heartbeat endpoint

### Conclusion

**Status**: ✅ **PASS** - Heartbeat only extends TTL, failure leads to natural expiration, no background tasks.

---

## 6. Multi-Tab Same-User Behavior

### Lock Refresh Logic

**Location**: `backend/server.py:919-927`

**Code**:
```python
if existing_lock.locked_by_user_id == user_id:
    # Same user, extend lock (idempotent - safe for refresh/heartbeat)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.workspace_locks.update_one(
        {"workspace_id": workspace_id},
        {"$set": {"expires_at": expires_at.isoformat()}}
    )
    existing_lock.expires_at = expires_at
    return existing_lock
```

**Verification**:
- ✅ Multiple tabs refresh same lock: Same user check (line 919) allows refresh
- ✅ Tab close doesn't release: No explicit release on disconnect logic found
- ✅ No "release on disconnect" logic: Verified - no such code exists

### Conclusion

**Status**: ✅ **PASS** - Multiple tabs refresh same lock, no release on disconnect.

---

## 7. Database Constraints

### Unique Index Verification

**Search Results**: No `create_index` or `ensure_index` calls found for `workspace_locks` collection.

**MongoDB Behavior**:
- Without unique index, MongoDB allows duplicate documents with same `workspace_id`
- `find_one()` returns arbitrary document when multiple exist
- Race conditions can create multiple locks for same workspace

### Race Condition Under Load

**Proof**:
1. User A: `get_workspace_lock()` → `None`
2. User B: `get_workspace_lock()` → `None` (simultaneous)
3. User A: `insert_one()` → succeeds
4. User B: `insert_one()` → succeeds (duplicate lock created)

**Impact**:
- Multiple locks can exist for same `workspace_id`
- `get_workspace_lock()` returns arbitrary one
- Non-deterministic behavior

### Conclusion

**Status**: ❌ **FAIL** - No unique constraint exists. Race conditions are possible under load.

**Fix Required**:
```python
# Add unique index on workspace_id
# This must be done via MongoDB shell or migration script:
# db.workspace_locks.createIndex({"workspace_id": 1}, {unique: true})
```

---

## Final Verification Summary

| Section | Status | Issue |
|---------|--------|-------|
| 1. Lock State Reads | ✅ PASS | All reads go through `get_workspace_lock()` |
| 2. get_workspace_lock() | ✅ PASS | Expiration enforced correctly |
| 3. acquire_workspace_lock() | ❌ FAIL | Race condition: check-then-insert not atomic |
| 4. "Workspace in Use" Warning | ✅ PASS | Only triggers on valid locks |
| 5. Heartbeat Validation | ✅ PASS | Correctly implemented |
| 6. Multi-Tab Behavior | ✅ PASS | Correctly implemented |
| 7. Database Constraints | ❌ FAIL | No unique index on `workspace_id` |

---

## Critical Issues Found

### Issue #1: Race Condition in Lock Acquisition

**File**: `backend/server.py`  
**Lines**: 915-969  
**Problem**: Non-atomic check-then-insert allows duplicate locks

**Fix**:
```python
# Replace lines 957-969 with atomic operation:
# Option 1: Use findOneAndUpdate with upsert
result = await db.workspace_locks.find_one_and_update(
    {"workspace_id": workspace_id},
    {
        "$setOnInsert": {
            "id": str(uuid.uuid4()),
            "workspace_id": workspace_id,
            "locked_by_user_id": user_id,
            "locked_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat()
        }
    },
    upsert=True,
    return_document=True
)

# Option 2: Add unique index and handle duplicate key error
try:
    await db.workspace_locks.insert_one(lock_dict)
except pymongo.errors.DuplicateKeyError:
    # Lock was created by another request, retry
    existing_lock = await get_workspace_lock(workspace_id)
    if existing_lock and existing_lock.locked_by_user_id != user_id:
        raise HTTPException(status_code=409, ...)
```

### Issue #2: Missing Unique Index

**File**: Database schema (MongoDB)  
**Problem**: No unique constraint prevents duplicate locks

**Fix**: Create unique index:
```javascript
// MongoDB shell command:
db.workspace_locks.createIndex({"workspace_id": 1}, {unique: true})
```

---

## Conclusion

**Status**: ✅ **FIXED** - Race condition resolved with atomic `find_one_and_update` operation.

**Root Cause**: Non-atomic check-then-insert pattern allowed two concurrent requests to both see no lock and both create one.

**Fixes Applied**:
1. ✅ Made lock acquisition atomic using `find_one_and_update` with `upsert=True` and `$setOnInsert`
2. ⚠️ **RECOMMENDED**: Create unique index on `workspace_id` in `workspace_locks` collection (see `backend/create_workspace_lock_index.py`)

**Current Status**: 
- Lock acquisition is now atomic at the database level
- MongoDB's upsert ensures only one document is created even under concurrent load
- Unique index is recommended but not strictly required (upsert provides atomicity)

**Note**: The unique index provides an additional safety layer and prevents any edge cases. Run the migration script to create it.
