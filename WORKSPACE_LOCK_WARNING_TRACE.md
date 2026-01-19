# "Workspace Currently in Use" Warning - Complete Code Trace

## 1. UI DECISION PATH

### Frontend Code That Shows Warning

**File**: `frontend/src/components/WorkspaceLockModal.jsx`
- **Line 20**: `<DialogTitle>Workspace Currently in Use</DialogTitle>`
- **Line 24**: `<strong>{lockedBy}</strong> is currently connected to this workspace.`

**File**: `frontend/src/pages/DashboardPage.js`
- **Line 33**: `const [lockModalOpen, setLockModalOpen] = useState(false);`
- **Line 35**: `const [lockedBy, setLockedBy] = useState('');`
- **Line 304**: `if (lockResult.locked) {` → triggers modal
- **Line 306**: `setLockedBy(lockResult.locked_by);`
- **Line 308**: `setLockModalOpen(true);`
- **Line 430-433**: `<WorkspaceLockModal open={lockModalOpen} lockedBy={lockedBy} .../>`

### API Response That Triggers Warning

**File**: `frontend/src/lib/api.js`
- **Line 180-197**: `checkWorkspaceLock()` function
- **Line 184**: `const response = await axios.post(\`${API}/workspaces/${workspaceId}/lock?force=false\`);`
- **Line 189**: `if (error.response?.status === 409) {`
- **Line 194**: `return { success: false, locked: true, locked_by: lockedBy, error: detail };`

**File**: `frontend/src/lib/api.js`
- **Line 164-177**: `lockWorkspace()` function
- **Line 166**: `const response = await axios.post(\`${API}/workspaces/${workspaceId}/lock?force=${force}\`);`
- **Line 169**: `if (error.response?.status === 409) {`
- **Line 174**: `return { success: false, locked: true, locked_by: lockedBy, error: detail };`

**Trigger Condition**: HTTP 409 status code from backend

**Payload Field**: `error.response?.data?.detail` contains message with locked_by name

**Regex Extraction**: `detail.match(/Another user \(([^)]+)\)/)` (line 192, 172)

---

## 2. BACKEND RESPONSE CONDITIONS

### Backend Endpoint: POST /workspaces/{workspace_id}/lock

**File**: `backend/server.py:2380-2396`

**Code**:
```python
@api_router.post("/workspaces/{workspace_id}/lock")
async def lock_workspace(
    workspace_id: str,
    force: bool = Query(False, description="Force release existing lock if another user has it"),
    current_user: User = Depends(get_current_user)
):
    await check_workspace_access(workspace_id, current_user.id)
    lock = await acquire_workspace_lock(workspace_id, current_user.id, force=force)
    return {
        "success": True,
        "locked_by_user_id": lock.locked_by_user_id,
        "locked_at": lock.locked_at.isoformat(),
        "expires_at": lock.expires_at.isoformat()
    }
```

**Calls**: `acquire_workspace_lock()` (line 2390)

### Backend Function: acquire_workspace_lock()

**File**: `backend/server.py:903-1058`

**Code Flow**:
```python
# Line 915: Get existing lock (enforces expiration)
existing_lock = await get_workspace_lock(workspace_id)

# Line 917: If lock exists and is valid (not expired)
if existing_lock:
    # Line 919: Same user - extend lock
    if existing_lock.locked_by_user_id == user_id:
        # Extend and return
    # Line 928: Force release
    elif force:
        # Delete and continue
    # Line 945: Different user - raise 409
    else:
        raise HTTPException(
            status_code=409,
            detail=f"Another user ({locked_by_name}) is currently connected..."
        )
```

### get_workspace_lock() Expiration Enforcement

**File**: `backend/server.py:879-901`

**Code**:
```python
async def get_workspace_lock(workspace_id: str) -> Optional[WorkspaceLock]:
    lock = await db.workspace_locks.find_one({"workspace_id": workspace_id}, {"_id": 0})
    if not lock:
        return None
    
    # Line 891-894: MANDATORY expiration check
    expires_at = datetime.fromisoformat(lock['expires_at'].replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    if now > expires_at:
        # Line 897: Delete expired lock
        await db.workspace_locks.delete_one({"workspace_id": workspace_id})
        logging.info(f"[get_workspace_lock] Expired lock deleted...")
        return None  # Line 899: Return None for expired locks
    
    return WorkspaceLock(**lock)  # Line 901: Only returns if not expired
```

**Verification**:
- ✅ Expired locks are filtered BEFORE response: Line 894-899 deletes expired locks and returns None
- ✅ 409 can only be raised if `existing_lock` exists: Line 917 checks `if existing_lock:`
- ✅ `existing_lock` can only exist if lock is NOT expired: `get_workspace_lock()` returns None for expired locks
- ✅ No cached data: Direct database query on every call (line 887)

**Conclusion**: Expired locks CANNOT trigger 409 response. Backend filters them before checking lock ownership.

---

## 3. NON-LOCK SOURCES VERIFICATION

### Cached Workspace Metadata

**Search Results**: No caching found for workspace lock status.

**File**: `frontend/src/pages/DashboardPage.js`
- **Line 43-61**: `fetchWorkspaces()` - fetches fresh data on mount
- **Line 303**: `await api.checkWorkspaceLock(workspace.id)` - fresh API call
- **Line 362**: `await api.lockWorkspace(workspace.id, false)` - fresh API call
- **Line 384**: `await api.checkWorkspaceLock(workspace.id)` - fresh API call

**Verification**: ✅ No cached lock status - all checks are fresh API calls

### Optimistic UI State

**File**: `frontend/src/pages/DashboardPage.js`
- **Line 35**: `const [lockedBy, setLockedBy] = useState('');` - React state
- **Line 306**: `setLockedBy(lockResult.locked_by);` - Set from API response
- **Line 433**: `lockedBy={lockedBy}` - Passed to modal

**Verification**: ✅ State is set from API response, not optimistic updates

### Stale React State / localStorage

**Search Results**: No localStorage or sessionStorage usage for lock status.

**File**: `frontend/src/pages/DashboardPage.js`
- **Line 35**: `useState('')` - Component-level state, cleared on unmount
- **Line 437**: `setLockedBy('');` - Cleared on modal cancel
- **Line 450**: `setLockedBy('');` - Cleared after force takeover

**Verification**: ✅ No persistent storage - state is component-local and cleared appropriately

### Race Between Navigation + Lock Acquisition

**File**: `frontend/src/pages/DashboardPage.js`
- **Line 303**: `checkWorkspaceLock()` called BEFORE navigation
- **Line 311**: `navigate()` only called if `!lockResult.locked`
- **Line 362**: `lockWorkspace()` called BEFORE navigation
- **Line 368**: `navigate()` only called if `!lockResult.locked`

**File**: `frontend/src/pages/CanvasBuilderPage.js`
- **Line 129**: `lockWorkspace()` called on mount
- **Line 130-132**: If locked, shows toast and navigates away

**Verification**: ✅ Lock check happens before navigation, but there's a race window between check and actual entry

**Race Condition Identified**:
1. User A checks lock → no lock → navigates to workspace page
2. User B checks lock → no lock → navigates to workspace page
3. User A's page mounts → acquires lock
4. User B's page mounts → tries to acquire lock → gets 409

**This is NOT a stale lock issue** - this is legitimate concurrent access detection.

---

## 4. NETWORK-LEVEL VERIFICATION

### Exact Request When Entering Workspace

**File**: `frontend/src/pages/DashboardPage.js:303`
- **Request**: `POST /api/workspaces/{workspace_id}/lock?force=false`
- **Handler**: `frontend/src/lib/api.js:180-197` (`checkWorkspaceLock()`)

**File**: `frontend/src/pages/DashboardPage.js:362`
- **Request**: `POST /api/workspaces/{workspace_id}/lock?force=false`
- **Handler**: `frontend/src/lib/api.js:164-177` (`lockWorkspace()`)

**File**: `frontend/src/pages/CanvasBuilderPage.js:129`
- **Request**: `POST /api/workspaces/{workspace_id}/lock?force=false`
- **Handler**: `frontend/src/lib/api.js:164-177` (`lockWorkspace()`)

### Backend Response Verification

**File**: `backend/server.py:2380-2396`
- **Endpoint**: `POST /workspaces/{workspace_id}/lock`
- **Calls**: `acquire_workspace_lock()` (line 2390)

**File**: `backend/server.py:915-955`
- **Line 915**: `existing_lock = await get_workspace_lock(workspace_id)` - Expiration enforced
- **Line 917**: `if existing_lock:` - Only true if lock exists AND not expired
- **Line 945-955**: Raises 409 ONLY if `existing_lock` exists (not expired) AND `locked_by_user_id != user_id`

**Verification**: ✅ 409 is returned ONLY for valid, non-expired locks held by different users

### Frontend Inference from Stale Data

**File**: `frontend/src/lib/api.js:189-194`
- **Line 189**: `if (error.response?.status === 409) {`
- **Line 191**: `const detail = error.response?.data?.detail || '';`
- **Line 192**: `const match = detail.match(/Another user \(([^)]+)\)/);`

**Verification**: ✅ Frontend extracts locked_by from HTTP 409 response, not from cached data

---

## 5. FINAL VERDICT

### Option B: Backend CANNOT produce this warning for expired locks

**Proof**:

1. **Expiration Enforcement**: `get_workspace_lock()` (line 891-899) deletes expired locks and returns None
2. **409 Condition**: `acquire_workspace_lock()` (line 952-955) raises 409 ONLY if `existing_lock` exists
3. **Lock Existence**: `existing_lock` can only exist if `get_workspace_lock()` returns non-None
4. **Non-None Return**: `get_workspace_lock()` returns None for expired locks (line 899)
5. **Conclusion**: Expired locks CANNOT cause 409 response

**Code References**:
- `backend/server.py:891-899`: Expiration check deletes expired locks
- `backend/server.py:915`: `existing_lock = await get_workspace_lock(workspace_id)` - Expiration enforced
- `backend/server.py:917`: `if existing_lock:` - Only true for non-expired locks
- `backend/server.py:952-955`: 409 raised ONLY if `existing_lock` exists (not expired)

### Remaining Non-Backend Causes

**Legitimate Concurrent Access**:
- User A enters workspace → acquires lock
- User B tries to enter → gets 409 (valid, lock is active)
- This is CORRECT behavior, not a bug

**Race Condition Window**:
- User A checks lock → no lock → navigates
- User B checks lock → no lock → navigates  
- User A's page mounts → acquires lock
- User B's page mounts → gets 409
- **This is legitimate** - User A acquired lock first

**Frontend State Persistence**:
- `lockedBy` state persists in React component (line 35)
- Modal remains open until user cancels or forces entry (line 433)
- **This is UI behavior, not a backend bug**

**Conclusion**: The warning CAN legitimately appear for valid, non-expired locks. Expired locks CANNOT trigger the warning due to expiration enforcement in `get_workspace_lock()`.

---

## Files Referenced

**Frontend**:
- `frontend/src/components/WorkspaceLockModal.jsx`: Lines 13-44
- `frontend/src/pages/DashboardPage.js`: Lines 33-35, 303-308, 362-366, 384-388, 430-433
- `frontend/src/lib/api.js`: Lines 164-177, 180-197

**Backend**:
- `backend/server.py`: Lines 879-901, 903-1058, 2380-2396

---

## Final Statement

**Backend CANNOT produce "Workspace Currently in Use" warning for expired locks.**

The warning can ONLY appear for valid, non-expired locks held by different users. This is correct behavior. If users see the warning after another user has left, it means:

1. The lock is still valid (not expired) - user left less than 10 minutes ago
2. OR there's a legitimate concurrent access attempt
3. OR frontend state is showing stale modal (user needs to refresh or cancel modal)

Expired locks are automatically deleted by `get_workspace_lock()` before any 409 response can be generated.
