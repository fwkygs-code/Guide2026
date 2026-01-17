# Media URL Persistence Test Plan

## Test Scenario: First 3 Steps Photo Deletion

### Expected Behavior
1. Steps 0, 1, 2 have `media_url` set (photos uploaded)
2. User saves walkthrough
3. Steps 0, 1, 2 should retain their `media_url` values

### Current Implementation

#### Frontend Save Logic (CanvasBuilderPage.js)
- **Line 256-260**: Always sends `media_url` from state
  - If `undefined` → sends `null`
  - If `null` → sends `null`
  - If string → sends string
- **Backend receives**: Always gets `media_url` (never missing)

#### Backend Save Logic (server.py)
- **Line 1345-1346**: Preserves existing if `None` or empty string
  ```python
  final_media_url = step_data.media_url if (step_data.media_url is not None and step_data.media_url != '') else existing_media_url
  ```

### Potential Issues

1. **State Loss**: If `step.media_url` becomes `undefined` in state before save
   - **Fix**: Ensure `updateStep` preserves `media_url` when updating other fields

2. **Reordering Race**: `reorderSteps` might read stale data
   - **Fix**: Added 100ms delay before reordering

3. **Loading Issue**: If DB returns `undefined`, we set to `null` in state
   - **Current**: `media_url: step.media_url !== undefined ? step.media_url : null`
   - **Issue**: If DB has value but response is malformed, we lose it

### Debugging Steps

1. Check browser console for logs:
   - `[CanvasBuilder] Loaded step:` - Shows what was loaded from DB
   - `[CanvasBuilder] Saving step:` - Shows what's being sent to backend
   - `[CanvasBuilder] Loaded step after save:` - Shows what was saved

2. Check backend logs for:
   - `[update_step] Step {id}: Media URL - existing: X, provided: Y, final: Z`
   - `[update_step] Step {id}: Successfully saved to database`

3. Verify state preservation:
   - Before save: Check `walkthrough.steps[0].media_url` in React DevTools
   - After save: Check if value is still there

### Manual Test Checklist

- [ ] Upload photos to steps 0, 1, 2
- [ ] Check browser console - verify `media_url` values in state
- [ ] Save walkthrough
- [ ] Check console logs - verify `media_url` is sent in `updateData`
- [ ] Check backend logs - verify existing value is preserved
- [ ] Refresh page - verify photos are still there
- [ ] Check database directly - verify `media_url` values are stored
