# ZuraBase Frontend

Modern React frontend for ZuraBase, built with TypeScript, Vite, Tailwind CSS, and Jest.

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Headless UI
- **Routing**: React Router DOM v7
- **State Management**: React Context (feature‑specific)
- **Rich Text Editor**: Milkdown
- **Drag & Drop**: @hello‑pangea/dnd
- **Testing**: Jest, React Testing Library, user‑event
- **Code Quality**: ESLint, Prettier, TypeScript strict
- **Containerization**: Docker, Docker Compose
- **Secrets Management**: Doppler

## Project Structure (Feature‑Based Architecture)

The frontend is organized around **domain features** with a dedicated `shared` directory for reusable code. This structure improves maintainability, enforces clear boundaries, and makes onboarding easier.

### Directory Breakdown

```
frontend/src/
├── app/                           # Application‑level setup
│   ├── client.ts                  # Axios instance with interceptors
│   ├── getApiBase.ts              # Dynamic API base URL (dev/prod)
│   ├── main.tsx                   # React entry point (providers, router)
│   └── setupTests.ts              # Global test configuration
├── features/                      # Self‑contained feature modules
│   ├── auth/                      # Authentication & user management
│   │   ├── index.ts               # Public API of the feature
│   │   ├── types.ts               # TypeScript interfaces
│   │   ├── api/                   # Auth‑specific API calls
│   │   ├── components/            # Login, logout, profile UI
│   │   ├── context/               # AuthContext (user, loading, login/logout)
│   │   └── hooks/                 # Custom hooks for auth logic
│   ├── notes/                     # Notes creation, editing, listing
│   │   ├── api/notes.api.ts       # CRUD operations for notes
│   │   ├── components/NotesApp.tsx # Main notes UI
│   │   └── __tests__/             # Notes‑specific tests
│   ├── planner/                   # Kanban‑style task planner
│   │   ├── api/planner.api.ts     # Planner board & card endpoints
│   │   ├── components/Board.tsx   # Drag‑and‑drop board
│   │   ├── components/Card.tsx    # Individual task cards
│   │   ├── components/Lane.tsx    # Board columns
│   │   └── components/PlannerApp.tsx # Top‑level planner component
│   └── strands/                   # Strands (linked content) system
│       ├── SYNC_SYSTEM.md         # Strand‑sync design document
│       ├── api/strands.api.ts     # Strands API client
│       ├── components/StrandsApp.tsx # Main strands UI
│       ├── hooks/strands.hooks.ts # Custom hooks for strands
│       └── services/syncService.ts # Background sync logic
├── shared/                        # Reusable code across features
│   ├── components/                # Generic UI components
│   │   ├── App.tsx                # Root application component
│   │   ├── Dialog.tsx             # Modal dialog
│   │   ├── ErrorBoundary.tsx      # React error boundary
│   │   ├── LoadingSplash.tsx      # Full‑page loading spinner
│   │   ├── NavBar.tsx             # Top navigation bar
│   │   ├── CoverSelector.tsx      # Image cover picker
│   │   ├── MarkdownEditor.tsx     # Milkdown‑based markdown editor
│   │   ├── LLMProfilesSettings.tsx # LLM connection settings UI
│   │   ├── LLMProfileWizard.tsx   # Step‑by‑step LLM setup
│   │   ├── SaveButton.tsx         # Smart save button with state
│   │   ├── SearchableModelSelect.tsx # Searchable dropdown
│   │   ├── SettingsPage.tsx       # User settings page
│   │   ├── SharingModal.tsx       # Share‑content modal
│   │   ├── Toast.tsx              # Notification toast
│   │   └── UserProfileDropdown.tsx # User menu dropdown
│   ├── context/                   # Global contexts
│   │   └── LLMProfilesProvider.tsx # Provides LLM profiles to the app
│   ├── hooks/                     # Custom React hooks
│   │   ├── llmProfilesHooks.ts    # Hooks for LLM profiles data
│   │   └── useLLMConnectionWizard.ts # Wizard for connecting LLMs
│   ├── utils/                     # Utility functions
│   │   ├── authRefresh.ts         # Token refresh logic
│   │   ├── clientLogger.ts        # Client‑side logging
│   │   ├── llmProfilesApi.ts      # API client for LLM profiles
│   │   ├── request.ts             # Wrapped fetch with error handling
│   │   └── saveUtils.ts           # Generic save/autosave utilities
│   ├── fixtures/                  # Test utilities & mock data
│   │   ├── factories.ts           # Factory functions for test data
│   │   ├── mockData.ts            # Pre‑defined mock objects
│   │   ├── mockHandlers.ts        # MSW request handlers
│   │   └── testUtils.tsx          # Custom test render functions
│   └── __mocks__/                 # Legacy Jest mocks (to be cleaned)
├── styles/                        # Global styles
│   └── index.css                  # Tailwind imports & custom CSS
├── types/                         # TypeScript definitions
│   └── env.d.ts                   # Environment variable types
├── __tests__/                     # All test files (mirrors source structure)
└── __mocks__/                     # Jest module mocks
```

### Path Aliases

To eliminate brittle relative imports (`../../../`), the project uses path aliases configured in `tsconfig.json` and `jest.config.js`.

| Alias        | Maps to        | Typical Use Case |
|--------------|----------------|------------------|
| `@/features/*` | `src/features/*` | Feature‑specific imports |
| `@/shared/*`   | `src/shared/*`   | Shared components, hooks, utils |
| `@/app/*`      | `src/app/*`      | App‑level configuration |
| `@/*`          | `src/*`          | General source imports |

**Example imports:**
```typescript
import NotesApp from '@/features/notes/components/NotesApp';
import { useSaveHandler } from '@/shared/utils/saveUtils';
import CoverSelector from '@/shared/components/CoverSelector';
import { getApiBase } from '@/app/getApiBase';
```

## Development

### Prerequisites

- Node.js 18+ and npm
- Doppler CLI (for environment variables) – [Installation guide](https://docs.doppler.com/docs/install-cli)
- Docker & Docker Compose (optional, for containerized workflows)

### Environment Setup

1. **Clone the repository** (if you haven’t already)
2. **Install Doppler CLI** and authenticate (`doppler login`)
3. **Setup Doppler project** (already configured for ZuraBase)
4. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   ```
5. **Copy environment template** (if needed):
   ```bash
   cp .env.example .env.local
   ```
   (The app primarily uses Doppler, but local `.env` can be used for overrides.)

### Running the Development Server

```bash
cd frontend
npm run dev
```

The dev server will start at `http://localhost:5173` with hot‑module replacement (HMR) and fast refresh.

### Running with Docker (Full Stack)

From the project root, you can start the entire stack (frontend + backend + databases) using the provided Make command:

```bash
make up
```

This command:
- Pulls Doppler secrets for the `dev` environment
- Generates a Docker Compose file with injected secrets
- Builds and starts the frontend container (and dependent services)

To stop the stack:
```bash
make down
```

## Testing

### Philosophy

Tests are **co‑located** with source code in nested `__tests__` directories. This keeps tests close to the code they verify and makes it easy to see what is (and isn’t) tested.

### Running Tests Locally

| Command | Purpose |
|---------|---------|
| `npm test` | Runs all tests with coverage report |
| `npm run test:watch` | Runs tests in watch mode (interactive) |
| `npm run type-check` | TypeScript type checking (no emit) |

Coverage reports are generated in `coverage/` (HTML, lcov, etc.).

### Running Tests via Docker

To run frontend tests in an isolated container (with test‑specific environment variables):

```bash
make test_fe
```

This command:
- Uses the `dev_testing` Doppler configuration
- Runs `npm test -- --ci` inside the frontend container
- Ensures a clean, reproducible test environment

### Test Structure

- **Unit tests**: Test individual functions, components, or hooks.
- **Integration tests**: Test interactions between components, APIs, and contexts.
- **End‑to‑end tests**: (Planned) Will use Playwright or Cypress.

Example test location:
```
src/features/notes/components/NotesApp.tsx
src/features/notes/components/__tests__/NotesApp.test.tsx
```

### Mocking

- **API calls**: Mocked with [MSW (Mock Service Worker)](https://mswjs.io/) in integration tests.
- **Modules**: Jest module mocks are placed in `src/shared/__mocks__/` and `src/__mocks__/`.
- **Test data**: Factory functions in `src/shared/fixtures/factories.ts` generate consistent test objects.

## Building for Production

```bash
cd frontend
npm run build
```

The production build:
- Runs TypeScript compiler (`tsc`)
- Bundles with Vite (optimized for performance)
- Outputs to `frontend/dist/`
- Includes hashed filenames, minification, and code splitting

To preview the production build locally:
```bash
npm run preview
```

## Type Checking

The project uses TypeScript with strict mode. To verify types without building:

```bash
npm run type-check
```

This is automatically run in CI and can be used as a pre‑commit check.

## Code Quality & Tooling

### ESLint

Configuration: `eslint.config.js` (flat config).  
Run linting: `npx eslint src/` (or via editor integration).

### Prettier

Configuration: `.prettierrc`.  
Format all files: `npx prettier --write src/`.

### Pre‑commit Hooks

Managed by Husky (if installed). The repository includes a `.pre‑commit-config.yaml` that runs linting and formatting before commits.

### Editor Integration

- VS Code settings are shared in `.vscode/`.
- Recommended extensions: ESLint, Prettier, Tailwind CSS IntelliSense.

## Troubleshooting

### Common Issues

| Issue | Possible Solution |
|-------|-------------------|
| `Doppler secrets not found` | Ensure you’ve run `doppler login` and have access to the ZuraBase project. |
| `npm install fails` | Try deleting `node_modules` and `package‑lock.json`, then re‑run. |
| `Tests fail with “Unable to find element”` | Check that the test’s mocked API responses match the component’s expectations. |
| `TypeScript errors after restructuring` | Verify that path aliases are correctly resolved in your editor; restart TS server. |

## Contributing

When adding a new feature:

1. Create a new directory under `src/features/` (e.g., `src/features/your‑feature/`).
2. Follow the existing pattern: `index.ts`, `types.ts`, `api/`, `components/`, `hooks/`, `context/` as needed.
3. Write tests in co‑located `__tests__` directories.
4. Update this README if the change affects the overall structure or tooling.

When adding a reusable component or utility, place it in the appropriate `src/shared/` subdirectory.
