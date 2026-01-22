# Dot Resize Data Flow Verification

## ✅ Data Structure Path (Verified)

### 1. Source of Truth
**Line 2008:**
```javascript
const markers = block.data?.markers || [];
```
- `markers` is read from `block.data.markers`
- This is the **source of truth**
- Not a local state or ref

### 2. Update Function
**Lines 2035-2041:**
```javascript
const updateMarker = (index, updates) => {
  const newMarkers = [...markers];                              // ✅ Clone array
  newMarkers[index] = { ...newMarkers[index], ...updates };    // ✅ Spread marker + updates
  onUpdate({ data: { ...block.data, markers: newMarkers } });  // ✅ Update source
};
```

**Verification:**
- ✅ Creates new array (immutable update)
- ✅ Merges updates into marker object
- ✅ Calls `onUpdate` to update `block.data`
- ✅ Updates the **data structure**, not a ref

### 3. Resize Handler Calls updateMarker
**Lines 2125-2152:**
```javascript
} else if (interactionMode === 'resizing-dot' && resizingMarker !== null) {
  animationFrameRef.current = requestAnimationFrame(() => {
    // ... calculate newSize ...
    updateMarker(resizingMarker, { size: newSize });  // ✅ Calls updateMarker
  });
}
```

**Verification:**
- ✅ Calls `updateMarker` with `{ size: newSize }`
- ✅ This updates `block.data.markers[index].size`

### 4. Render Reads from Data Structure
**Lines 2275-2278:**
```javascript
{markers.map((marker, idx) => {
  const markerSize = marker.size || 3;  // ✅ Reads from marker.size
  // ...
})}
```

**Lines 2364-2365 (Dot render):**
```javascript
width: `${markerSize}%`,   // ✅ Uses marker.size
height: `${markerSize}%`,  // ✅ Uses marker.size
```

**Verification:**
- ✅ Reads `marker.size` from the data structure
- ✅ Not reading from a ref or temporary variable
- ✅ Uses the updated value

---

## 🔍 Potential Issues Found

### Issue 1: RAF Callback Closure
**Problem:**
```javascript
animationFrameRef.current = requestAnimationFrame(() => {
  const marker = markers[resizingMarker];  // ⚠️ Stale closure
  // ...
  updateMarker(resizingMarker, { size: newSize });
});
```

The `markers` array in the RAF callback is from the **closure** at render time. If updates are batched, this could be stale.

**However:** We're not using `marker.size` for the calculation - we calculate `newSize` from pointer distance, so this shouldn't affect the update.

### Issue 2: React Update Batching
**Problem:**
- `updateMarker` is called inside RAF callback
- React might batch multiple `onUpdate` calls
- Component might not re-render until RAF completes

**Result:** Dot size updates might not be visible in real-time during drag.

### Issue 3: Parent Component State
**Unknown:**
- We don't know if `onUpdate` actually triggers a state update in the parent
- The parent component must update its state and pass new `block` prop
- If parent doesn't update state, changes won't persist

---

## 🧪 Diagnostic Tests Needed

### Test 1: Is updateMarker being called?
**Console should show:**
```
[updateMarker] called { index: 0, updates: { size: 10.4 }, ... }
```

If NOT appearing → RAF callback not executing

### Test 2: Is the new size calculated?
**Console should show:**
```
[Dot Resize] { newSize: 10.4, currentSize: 3 }
```

If `newSize` is always 3 → Calculation issue

### Test 3: Does the marker object update?
**Console should show:**
```
[updateMarker] newMarker { size: 10.4, ... }
```

If size is still 3 → Spread not working

### Test 4: Does it persist after release?
**Action:** Drag handle, release, check dot size

If size reverts → Parent not updating state

---

## 💡 Immediate Fix Ideas

### Fix 1: Move calculation outside RAF
```javascript
// Calculate outside RAF
const marker = markers[resizingMarker];
const rect = imageRef.current.getBoundingClientRect();
const currentX = ((e.clientX - rect.left) / rect.width) * 100;
const currentY = ((e.clientY - rect.top) / rect.height) * 100;
const centerX = dragStartPos.current.centerX;
const centerY = dragStartPos.current.centerY;
const deltaX = currentX - centerX;
const deltaY = currentY - centerY;
const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
const newRadius = Math.max(0.25, Math.min(7.5, distance));
const newSize = newRadius * 2;

// Only use RAF for the update
animationFrameRef.current = requestAnimationFrame(() => {
  updateMarker(resizingMarker, { size: newSize });
});
```

### Fix 2: Force synchronous update
```javascript
// Don't use RAF for resize updates
if (interactionMode === 'resizing-dot' && resizingMarker !== null) {
  // Calculate and update immediately
  updateMarker(resizingMarker, { size: newSize });
}
```

### Fix 3: Use flushSync (React 18)
```javascript
import { flushSync } from 'react-dom';

flushSync(() => {
  updateMarker(resizingMarker, { size: newSize });
});
```

---

## ✅ Conclusion

**Data flow is CORRECT:**
1. ✅ Reading from `block.data.markers` (source of truth)
2. ✅ Updating via `onUpdate({ data: { ...block.data, markers } })`
3. ✅ Rendering from `marker.size`
4. ✅ Not using refs for storage

**Potential issues:**
1. ⚠️ RAF callback might have stale closure
2. ⚠️ React batching might delay re-renders
3. ⚠️ Parent component might not be updating state
4. ⚠️ Multiple RAF calls might be conflicting

**Next step:** Run with debug logging to see which part fails.
