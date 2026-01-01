# Frontend Restructuring Plan - Executive Summary

## Status
**COMPLETED** – All six phases executed successfully as of December 31, 2025.

## Vision
Reorganize the frontend codebase from a flat structure with centralized tests to a **feature-based architecture with nested `__tests__` folders** for better code organization, maintainability, and test co-location.

## Key Architectural Changes

### Current Problems
- ✗ Flat component and utility directories make it hard to understand feature boundaries
- ✗ Centralized `__tests__` directory separates tests from source code
- ✗ Relative imports with multiple `../` chains are fragile and hard to refactor
- ✗ No clear separation between feature-specific and shared code

### Proposed Solution
- ✓ **Features folder**: Domain-specific features (authentication, notes, planner, strands)
- ✓ **Shared folder**: Reusable components, hooks, utilities, and test infrastructure
- ✓ **Nested `__tests__` folders**: Tests live in `__tests__/` subdirectories within each module
- ✓ **Path aliases**: Use `@/features`, `@/shared`, `@/app` for clear, maintainable imports
- ✓ **App folder**: Top-level application setup (routes, providers, main App component)

## Structure Overview

```
src/
├── features/                    # Domain-specific features
│   ├── authentication/
│   ├── notes/
│   ├── planner/
│   └── strands/
├── shared/                      # Reusable code
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── context/
│   ├── fixtures/               # Test utilities
│   └── __mocks__/              # Module mocks
├── app/                         # App-level setup
├── assets/
├── styles/
└── main.tsx
```

## Test Organization Strategy

Tests are organized in **nested `__tests__` folders** for better separation:

```
features/notes/
├── components/
│   ├── NotesApp.tsx
│   └── __tests__/
│       └── NotesApp.test.tsx
├── api/
│   ├── notes.api.ts
│   └── __tests__/
│       └── notes.api.test.ts
└── __tests__/
    └── notesFlow.integration.test.tsx
```

This approach:
- Keeps tests close to source code
- Maintains clear separation between source and test files
- Makes it easy to find tests for any module
- Supports integration tests at feature level

## Implementation Phases

### Phase 1: Preparation
- Create new directory structure
- Update `tsconfig.json` with path aliases
- Update `jest.config.js` with new paths

### Phase 2: Move Feature Files
- Move `auth/` → `features/authentication/`
- Move `notes/` → `features/notes/`
- Move `planner/` → `features/planner/`
- Move `strands/` → `features/strands/`

### Phase 3: Move Shared Files
- Move shared components to `shared/components/`
- Move custom hooks to `shared/hooks/`
- Move utilities to `shared/utils/`
- Move context providers to `shared/context/`
- Move test utilities to `shared/fixtures/`
- Move mocks to `shared/__mocks__/`

### Phase 4: Move App Files
- Move `App.tsx` and `App.test.tsx` to `app/`
- Create `routes.tsx` and `providers.tsx` in `app/`

### Phase 5: Update Imports
- Update all relative imports to use path aliases
- Verify no circular dependencies
- Update test imports

### Phase 6: Configuration Updates
- Update `tsconfig.json` with path aliases
- Update `jest.config.js` moduleNameMapper
- Update `vite.config.ts` if needed

### Phase 7: Verification
- Run all tests
- Check for TypeScript errors
- Verify build process
- Test application in development and production

## Import Path Changes

### Before
```typescript
import { getNote } from "./api";
import NotesApp from "../notes/NotesApp";
import { useSaveHandler } from "../utils/saveUtils";
import CoverSelector from "../components/CoverSelector";
```

### After
```typescript
import { getNote } from "@/features/notes/api/notes.api";
import NotesApp from "@/features/notes/components/NotesApp";
import { useSaveHandler } from "@/shared/utils/saveUtils";
import CoverSelector from "@/shared/components/CoverSelector";
```

## Files Affected

### Features (4 features)
- `authentication/` - Auth context, login components
- `notes/` - Notes app, components, API
- `planner/` - Planner app, board components, API
- `strands/` - Strands app, components, sync service, API

### Shared Components (16 components)
- Dialog, SaveButton, CoverSelector, MarkdownEditor
- NavBar, ErrorBoundary, LoadingSplash, HomePage
- LLMConnectionStatus, LLMProfilesSettings, LLMProfileWizard
- SearchableModelSelect, SettingsPage, SharingModal, Toast, UserProfileDropdown

### Shared Utilities (7 utilities)
- authRefresh, clientLogger, llmProfilesApi
- request, saveUtils, useLLMConnectionWizard, useLLMProfiles

### Tests to Reorganize
- ~20+ test files from `__tests__/` to nested `__tests__/` folders
- Test fixtures and mocks consolidated in `shared/`

## Configuration Changes

### tsconfig.json
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/features/*": ["src/features/*"],
      "@/shared/*": ["src/shared/*"],
      "@/app/*": ["src/app/*"],
      "@/*": ["src/*"]
    }
  }
}
```

### jest.config.js
```javascript
moduleNameMapper: {
  "^@/features/(.*)$": "<rootDir>/src/features/$1",
  "^@/shared/(.*)$": "<rootDir>/src/shared/$1",
  "^@/app/(.*)$": "<rootDir>/src/app/$1",
  "^@/(.*)$": "<rootDir>/src/$1",
  // ... existing mappings
}
```

## Success Criteria

- [x] All files moved to new locations
- [x] All imports updated and working
- [x] All tests pass (unit, integration, e2e)
- [x] Build completes without errors
- [x] No TypeScript errors
- [x] No ESLint errors
- [x] Application runs correctly in development
- [x] Application builds correctly for production

## Benefits

1. **Better Code Organization**: Features are self-contained with clear boundaries
2. **Improved Maintainability**: Related code is grouped together
3. **Easier Testing**: Tests are co-located with source code
4. **Clearer Imports**: Path aliases eliminate relative import chains
5. **Scalability**: Easy to add new features following the same pattern
6. **Reduced Cognitive Load**: Developers can focus on one feature at a time

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking imports during migration | Systematic phase-by-phase approach with validation |
| Test discovery issues | Verify Jest config recognizes new test locations |
| Circular dependencies | Review imports after migration |
| Build failures | Test build after each major phase |
| Missing files | Create comprehensive file movement checklist |

## Next Steps

**Completed** – All phases have been executed and verified.

### Final Actions Taken
- Old directories (`components/`, `utils/`, `context/`, `auth/`, `notes/`, `planner/`, `strands/`) removed
- No broken imports confirmed via TypeScript check
- Created `frontend/RESTRUCTURING.md` documenting the changes
- Updated this summary with completion status
- Verified tests pass and build succeeds (see Phase 6 verification)

The frontend restructuring is now complete and ready for development.
