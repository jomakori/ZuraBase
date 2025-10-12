# Backwards Compatibility Removal Plan

## Overview
Remove all backwards compatibility support for notes and planner URLs format across the codebase. The system will only support path-based URLs going forward.

## Current URL Formats
- **Old format (to be removed):** `/notes?id=123` and `/planner?id=456` (query parameters)
- **New format (only supported):** `/notes/123` and `/planner/456` (path parameters)

## Code Changes Required

### 1. [`frontend/src/notes/NotesApp.tsx`](frontend/src/notes/NotesApp.tsx:18)
**Remove:**
- Lines 18-25: Query parameter ID detection logic
- Lines 28-34: URL normalization for old query parameter format
- Line 18: "backward compatibility" comment

**Replace with:**
```typescript
// Get ID from /notes/:id path only
const initialId = (() => {
  const pathMatch = window.location.pathname.match(/\/notes\/([^/]+)/);
  return pathMatch ? pathMatch[1] : null;
})();
```

### 2. [`frontend/src/planner/PlannerApp.tsx`](frontend/src/planner/PlannerApp.tsx:32)
**Remove:**
- Lines 33-45: Query parameter ID detection and normalization
- Line 32: "backward-compatible" comment
- Lines 398-400: Query parameter setting in createPlanner function

**Replace with:**
```typescript
// Get ID from /planner/:id path only
const initialId = (() => {
  const pathMatch = window.location.pathname.match(/\/planner\/([^/]+)/);
  return pathMatch ? pathMatch[1] : null;
})();
```

**In createPlanner function:**
Replace query parameter setting with path-based URL:
```typescript
// Update URL with the new planner ID
const expectedPath = `/planner/${newPlanner.id}`;
window.history.pushState(null, "", expectedPath);
```

### 3. [`frontend/src/utils/saveUtils.ts`](frontend/src/utils/saveUtils.ts:98)
**Remove:**
- Lines 98-100: Query parameter URL manipulation

**Replace with:**
```typescript
// Update URL with path-based format
const expectedPath = `/notes/${response.id}`; // or `/planner/${response.id}`
window.history.pushState(null, "", expectedPath);
```

## Implementation Steps
1. Remove query parameter detection from NotesApp.tsx
2. Remove query parameter detection from PlannerApp.tsx  
3. Remove URL normalization logic from both apps
4. Update saveUtils.ts to use path-based URLs
5. Remove query parameter handling from PlannerApp.tsx createPlanner
6. Clean up backwards compatibility comments
7. Test functionality with path-based URLs only
8. Verify no regressions

## Testing Strategy
- Test creating new notes/planners
- Test loading existing notes/planners with path-based URLs
- Test sharing functionality
- Verify old query parameter URLs no longer work
- Test navigation between pages
