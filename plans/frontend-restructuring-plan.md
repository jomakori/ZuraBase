# Frontend Restructuring Plan: Feature-Based Architecture with Co-located Tests

## Overview
This plan outlines the migration from a flat directory structure with centralized tests (`__tests__`) to a feature-based architecture with co-located tests (test files next to source files).

## Current State Analysis

### Existing Structure
```
src/
├── __tests__/              # Centralized test directory
│   ├── auth/
│   ├── components/
│   ├── fixtures/           # Test utilities and mocks
│   ├── notes/
│   ├── planner/
│   ├── strands/
│   └── utils/
├── __mocks__/              # Module mocks
├── auth/                   # Auth feature (minimal)
├── components/             # All components (flat)
├── context/                # Context providers
├── notes/                  # Notes feature
├── planner/                # Planner feature
├── strands/                # Strands feature
├── utils/                  # All utilities (flat)
├── types/
├── main.tsx
└── ...
```

### Current Import Patterns
- Relative imports: `import { getNote } from "./api"`
- Cross-feature imports: `import NotesApp from "../notes/NotesApp"`
- Utility imports: `import { useSaveHandler } from "../utils/saveUtils"`
- Component imports: `import CoverSelector from "../components/CoverSelector"`

## Target Structure

```
src/
├── features/
│   ├── authentication/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   └── __tests__/
│   │   │       └── LoginForm.test.tsx
│   │   ├── hooks/
│   │   ├── api/
│   │   │   ├── auth.api.ts
│   │   │   └── __tests__/
│   │   │       └── auth.api.test.ts
│   │   ├── __tests__/
│   │   │   ├── AuthContext.test.tsx
│   │   │   └── authFlow.integration.test.tsx
│   │   ├── AuthContext.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   ├── notes/
│   │   ├── components/
│   │   │   ├── NotesApp.tsx
│   │   │   └── __tests__/
│   │   │       └── NotesApp.test.tsx
│   │   ├── api/
│   │   │   ├── notes.api.ts
│   │   │   └── __tests__/
│   │   │       └── notes.api.test.ts
│   │   ├── __tests__/
│   │   │   └── notesFlow.integration.test.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   ├── planner/
│   │   ├── components/
│   │   │   ├── PlannerApp.tsx
│   │   │   ├── Board.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Lane.tsx
│   │   │   ├── PlannerWizard.tsx
│   │   │   ├── TemplateSelector.tsx
│   │   │   └── __tests__/
│   │   │       ├── Board.test.tsx
│   │   │       ├── Card.test.tsx
│   │   │       └── ...
│   │   ├── api/
│   │   │   ├── planner.api.ts
│   │   │   └── __tests__/
│   │   │       └── planner.api.test.ts
│   │   ├── __tests__/
│   │   │   └── planner.integration.test.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   └── strands/
│       ├── components/
│       │   ├── StrandsApp.tsx
│       │   ├── StrandsList.tsx
│       │   ├── StrandDetail.tsx
│       │   ├── AttachmentList.tsx
│       │   ├── FileUpload.tsx
│       │   ├── TagChip.tsx
│       │   ├── StrandCard.tsx
│       │   ├── SyncProgressModal.tsx
│       │   ├── SyncLogViewer.tsx
│       │   └── __tests__/
│       │       ├── StrandsApp.test.tsx
│       │       ├── AttachmentList.test.tsx
│       │       └── ...
│       ├── api/
│       │   ├── strands.api.ts
│       │   └── __tests__/
│       │       └── strands.api.test.ts
│       ├── services/
│       │   ├── syncService.ts
│       │   └── __tests__/
│       │       └── syncService.test.ts
│       ├── hooks/
│       │   ├── useStrands.ts
│       │   └── __tests__/
│       │       └── useStrands.test.ts
│       ├── __tests__/
│       │   └── strands.integration.test.tsx
│       ├── types.ts
│       └── index.ts
├── shared/
│   ├── components/
│   │   ├── Dialog.tsx
│   │   ├── SaveButton.tsx
│   │   ├── CoverSelector.tsx
│   │   ├── MarkdownEditor.tsx
│   │   ├── NavBar.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── LoadingSplash.tsx
│   │   ├── HomePage.tsx
│   │   ├── LLMConnectionStatus.tsx
│   │   ├── LLMProfilesSettings.tsx
│   │   ├── LLMProfileWizard.tsx
│   │   ├── SearchableModelSelect.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── SharingModal.tsx
│   │   ├── Toast.tsx
│   │   ├── UserProfileDropdown.tsx
│   │   └── __tests__/
│   │       ├── Dialog.test.tsx
│   │       ├── SaveButton.test.tsx
│   │       ├── CoverSelector.test.tsx
│   │       ├── MarkdownEditor.test.tsx
│   │       ├── NavBar.test.tsx
│   │       ├── ErrorBoundary.test.tsx
│   │       ├── LoadingSplash.test.tsx
│   │       ├── LLMProfilesSettings.test.tsx
│   │       └── SettingsPage.test.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useLLMConnectionWizard.ts
│   │   ├── useLLMProfiles.ts
│   │   └── __tests__/
│   │       ├── useAuth.test.ts
│   │       ├── useLLMConnectionWizard.test.ts
│   │       └── useLLMProfiles.test.ts
│   ├── utils/
│   │   ├── authRefresh.ts
│   │   ├── saveUtils.ts
│   │   ├── request.ts
│   │   ├── clientLogger.ts
│   │   ├── llmProfilesApi.ts
│   │   └── __tests__/
│   │       ├── authRefresh.test.ts
│   │       ├── saveUtils.test.ts
│   │       ├── request.test.ts
│   │       ├── clientLogger.test.ts
│   │       └── llmProfilesApi.test.ts
│   ├── types/
│   │   └── env.d.ts
│   ├── context/
│   │   └── LLMProfilesProvider.tsx
│   ├── fixtures/
│   │   ├── mockData.ts
│   │   ├── mockHandlers.ts
│   │   ├── testUtils.tsx
│   │   └── factories.ts
│   └── __mocks__/
│       ├── MarkdownEditor.tsx
│       ├── milkdown.ts
│       ├── milkdownMock.tsx
│       ├── styleMock.js
│       ├── envMock.js
│       └── AppMock.tsx
├── app/
│   ├── App.tsx
│   ├── routes.tsx
│   ├── providers.tsx
│   └── __tests__/
│       └── App.test.tsx
├── assets/
├── styles/
├── main.tsx
├── client.ts
├── getApiBase.ts
├── setupTests.ts
└── vite-env.d.ts
```

## Key Changes

### 1. Features Folder Structure
- **Purpose**: Domain-specific features with all related code co-located
- **Features**:
  - `authentication/` - Auth context, login components, auth API
  - `notes/` - Notes app, components, API, types
  - `planner/` - Planner app, board components, API
  - `strands/` - Strands app, components, sync service, API

### 2. Shared Folder Structure
- **Purpose**: Reusable components, hooks, utilities, and test infrastructure
- **Sections**:
  - `components/` - UI components used across features
  - `hooks/` - Custom React hooks
  - `utils/` - Utility functions
  - `types/` - Shared TypeScript types
  - `context/` - Shared context providers
  - `fixtures/` - Test utilities, mock data, factories
  - `__mocks__/` - Module mocks for Jest

### 3. App Folder Structure
- **Purpose**: Top-level application setup
- **Contents**:
  - `App.tsx` - Main app component
  - `routes.tsx` - Route definitions
  - `providers.tsx` - Provider setup

### 4. Co-located Tests
- Test files live next to source files with `.test.ts` or `.test.tsx` suffix
- Integration tests stay at feature level (e.g., `notesFlow.integration.test.tsx`)
- Shared test utilities in `shared/fixtures/`

## Implementation Steps

### Phase 1: Preparation
1. Create new directory structure
2. Update `tsconfig.json` with path aliases
3. Update `jest.config.js` with new paths

### Phase 2: Move Feature Files
1. Create `features/authentication/` and move auth files
2. Create `features/notes/` and move notes files
3. Create `features/planner/` and move planner files
4. Create `features/strands/` and move strands files

### Phase 3: Move Shared Files
1. Create `shared/components/` and move shared components
2. Create `shared/hooks/` and move custom hooks
3. Create `shared/utils/` and move utility functions
4. Create `shared/context/` and move context providers
5. Create `shared/fixtures/` and move test utilities
6. Move `__mocks__/` to `shared/__mocks__/`

### Phase 4: Move App Files
1. Create `app/` folder
2. Move `App.tsx`, `App.test.tsx` to `app/`
3. Create `routes.tsx` and `providers.tsx` in `app/`

### Phase 5: Update Imports
1. Update all relative imports to use path aliases
2. Update feature-internal imports
3. Update shared imports
4. Update app-level imports

### Phase 6: Configuration Updates
1. Update `tsconfig.json` with path aliases:
   - `@/features/*`
   - `@/shared/*`
   - `@/app/*`
2. Update `jest.config.js` moduleNameMapper
3. Update `vite.config.ts` if needed

### Phase 7: Verification
1. Run all tests to ensure they pass
2. Check for any remaining import errors
3. Verify build process works

## Path Aliases Configuration

### tsconfig.json Updates
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

### jest.config.js Updates
```javascript
moduleNameMapper: {
  "^@/features/(.*)$": "<rootDir>/src/features/$1",
  "^@/shared/(.*)$": "<rootDir>/src/shared/$1",
  "^@/app/(.*)$": "<rootDir>/src/app/$1",
  "^@/(.*)$": "<rootDir>/src/$1",
  // ... existing mappings
}
```

## Import Path Examples

### Before
```typescript
import { getNote } from "./api";
import NotesApp from "../notes/NotesApp";
import { useSaveHandler } from "../utils/saveUtils";
import CoverSelector from "../components/CoverSelector";
import { AuthContext } from "../auth/AuthContext";
```

### After
```typescript
import { getNote } from "@/features/notes/api/notes.api";
import NotesApp from "@/features/notes/components/NotesApp";
import { useSaveHandler } from "@/shared/utils/saveUtils";
import CoverSelector from "@/shared/components/CoverSelector";
import { AuthContext } from "@/features/authentication/AuthContext";
```

## File Movement Summary

### Features to Move
- `auth/` → `features/authentication/`
- `notes/` → `features/notes/`
- `planner/` → `features/planner/`
- `strands/` → `features/strands/`

### Shared Components to Move
- `components/Dialog.tsx` → `shared/components/`
- `components/SaveButton.tsx` → `shared/components/`
- `components/CoverSelector.tsx` → `shared/components/`
- `components/MarkdownEditor.tsx` → `shared/components/`
- `components/NavBar.tsx` → `shared/components/`
- `components/ErrorBoundary.tsx` → `shared/components/`
- `components/LoadingSplash.tsx` → `shared/components/`
- `components/HomePage.tsx` → `shared/components/`
- `components/LLMConnectionStatus.tsx` → `shared/components/`
- `components/LLMProfilesSettings.tsx` → `shared/components/`
- `components/LLMProfileWizard.tsx` → `shared/components/`
- `components/SearchableModelSelect.tsx` → `shared/components/`
- `components/SettingsPage.tsx` → `shared/components/`
- `components/SharingModal.tsx` → `shared/components/`
- `components/Toast.tsx` → `shared/components/`
- `components/UserProfileDropdown.tsx` → `shared/components/`

### Shared Utilities to Move
- `utils/authRefresh.ts` → `shared/utils/`
- `utils/clientLogger.ts` → `shared/utils/`
- `utils/llmProfilesApi.ts` → `shared/utils/`
- `utils/llmProfilesHooks.ts` → `shared/hooks/`
- `utils/request.ts` → `shared/utils/`
- `utils/saveUtils.ts` → `shared/utils/`
- `utils/useLLMConnectionWizard.ts` → `shared/hooks/`

### Shared Context to Move
- `context/LLMProfilesProvider.tsx` → `shared/context/`

### App Files to Move
- `components/App.tsx` → `app/`
- `components/App.test.tsx` → `app/`

### Test Files to Co-locate (Nested __tests__ Structure)
- `__tests__/auth/*` → `features/authentication/__tests__/`
- `__tests__/notes/*` → `features/notes/__tests__/`
- `__tests__/notes/api/*` → `features/notes/api/__tests__/`
- `__tests__/notes/components/*` → `features/notes/components/__tests__/`
- `__tests__/planner/*` → `features/planner/__tests__/`
- `__tests__/planner/api/*` → `features/planner/api/__tests__/`
- `__tests__/strands/*` → `features/strands/__tests__/`
- `__tests__/strands/api/*` → `features/strands/api/__tests__/`
- `__tests__/strands/services/*` → `features/strands/services/__tests__/`
- `__tests__/components/core/*` → `shared/components/__tests__/`
- `__tests__/utils/*` → `shared/utils/__tests__/`
- `__tests__/fixtures/*` → `shared/fixtures/`
- `__mocks__/*` → `shared/__mocks__/`

## Considerations

### Testing
- Jest configuration will need to recognize tests in new locations
- Test utilities in `shared/fixtures/` will be accessible to all tests
- Mock files in `shared/__mocks__/` will be centralized

### Import Paths
- Path aliases make imports clearer and more maintainable
- Reduces relative import chains (`../../../`)
- Makes it easier to move files without breaking imports

### Build Process
- Vite should handle path aliases automatically
- Jest needs explicit moduleNameMapper configuration
- TypeScript will resolve paths via tsconfig.json

### Backwards Compatibility
- This is a breaking change for the codebase structure
- All imports must be updated
- No gradual migration possible

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking imports during migration | Use automated find/replace with careful validation |
| Test discovery issues | Verify Jest config recognizes new test locations |
| Circular dependencies | Review imports after migration |
| Build failures | Test build after each major phase |
| Missing files | Create comprehensive file movement checklist |

## Success Criteria

- [ ] All files moved to new locations
- [ ] All imports updated and working
- [ ] All tests pass (unit, integration, e2e)
- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Application runs correctly in development
- [ ] Application builds correctly for production

## Timeline Estimate

This is a significant refactoring that will require:
1. Directory structure creation
2. File movements
3. Import path updates across ~50+ files
4. Configuration updates
5. Testing and verification

The work should be done systematically in phases to minimize risk and allow for testing at each stage.
