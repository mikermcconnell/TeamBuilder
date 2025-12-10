# TeamBuilder - Context & Architecture

## About This Context File
This `context.md` file serves as the primary source of truth for LLMs and developers working on the TeamBuilder project. It provides high-level architectural context, key conventions, and critical workflows that may not be immediately obvious from code alone.

### Maintenance Guidelines
To ensure this file remains useful for future models and developers:
1.  **Keep it Current**: Update this file whenever major architectural changes, new tech stack additions, or significant refactors occur.
2.  **Focus on High-Level Context**: Avoid listing every utility function. Focus on core business logic, data boundaries, and architectural patterns.
3.  **Document "Why", not just "What"**: Explain the reasoning behind key decisions (e.g., specific constraint priorities, dual storage strategy).
4.  **Include Critical Workflows**: Testing, specific deployment quirks, or complex user flows (like the hybrid auth/storage state machine) are essential.
5.  **Performance & Constraints**: Explicitly mention performance targets (e.g., "virtualization needed for >500 players") to guide future optimization efforts.

---

## App Overview
**TeamBuilder** is a React-based web application that automatically generates balanced sports teams from player rosters with smart constraint handling. It's designed for sports league organizers who need to create fair teams quickly. The app features cloud storage, user authentication, and collaborative session management.

**Live Demo:** https://5msdtx5yti.space.minimax.io

## Tech Stack
- **Frontend:** React 18 + TypeScript
- **UI Framework:** Tailwind CSS + Radix UI components
- **Build Tool:** Vite
- **State Management:** React Context + Hooks + localStorage + Firestore
- **Backend:** Firebase (Authentication + Firestore Database)
- **AI Integration:** Google Gemini API (via Vercel Edge Functions)
- **Performance:** React Window for virtualization, optimized rendering
- **Package Manager:** pnpm
- **Analytics:** Vercel Analytics

## Key Scripts & Commands
```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build for production (includes TypeScript compilation)
pnpm preview          # Preview production build
pnpm lint             # Run ESLint

# Testing
# No specific test framework configured - check README or ask user for testing approach
```

## Project Structure
```
src/
├── components/         # React components
│   ├── ui/            # Radix UI components (extensive collection)
│   ├── ai/            # AI Assistant components
│   ├── CSVUploader.tsx
│   ├── ConfigurationPanel.tsx
│   ├── TeamDisplay.tsx
│   ├── PlayerRoster.tsx
│   ├── ExportPanel.tsx
│   ├── PlayerGroups.tsx
│   ├── SessionManager.tsx    # Cloud session management
│   ├── SignInPage.tsx        # Authentication UI
│   ├── SavedRostersList.tsx  # Cloud-saved rosters
│   ├── SavedTeamsManager.tsx # Cloud-saved teams
│   ├── RosterManager.tsx     # Enhanced roster management
│   ├── FullScreenTeamBuilder.tsx # Full-screen team builder mode
│   ├── VirtualizedPlayerTable.tsx # Performance-optimized player list
│   ├── PlayerCard.tsx        # Player detail cards
│   ├── PlayerEmail.tsx       # Email management for players
│   ├── GenerationStats.tsx   # Team generation statistics
│   ├── TutorialLanding.tsx   # First-time user tutorial
│   ├── ErrorBoundary.tsx     # Error handling wrapper
│   └── ...
├── services/          # Backend services
│   ├── authService.ts        # Firebase authentication
│   ├── firestoreService.ts   # Firestore database operations
│   ├── storageService.ts     # Cloud storage management
│   ├── teamsService.ts       # Team persistence
│   ├── rosterService.ts      # Roster persistence
│   ├── rosterStorage.ts      # Roster version management
│   ├── dataStorageService.ts # Unified data storage layer
│   ├── geminiService.ts      # AI team generation service
│   └── ...
├── config/
│   └── firebase.ts    # Firebase configuration
├── utils/             # Business logic utilities
│   ├── teamGenerator.ts      # Core team balancing algorithm
│   ├── configManager.ts      # Configuration persistence
│   ├── csvProcessor.ts       # CSV parsing and validation
│   ├── exportUtils.ts        # Export functionality
│   ├── playerGrouping.ts     # Player grouping logic
│   ├── performance.ts        # Performance optimization utilities
│   ├── validation.ts         # Data validation utilities
│   └── firebaseTestRunner.ts # Firebase test utilities (dev only)
├── tests/             # Test files
├── types/
│   ├── index.ts       # TypeScript interfaces
│   └── ai.ts          # AI-related interfaces
├── hooks/             # Custom React hooks
└── assets/            # Static assets (logo.svg, icons)
```

## Core Interfaces
```typescript
interface Player {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'Other';
  skillRating: number;
  execSkillRating: number | null;  // Executive skill rating (null = N/A)
  teammateRequests: string[];
  avoidRequests: string[];
  teamId?: string;
  groupId?: string;
  email?: string;
  unfulfilledRequests?: UnfulfilledRequest[];
}

interface Team {
  id: string;
  name: string;
  players: Player[];
  averageSkill: number;
  genderBreakdown: { M: number; F: number; Other: number; };
  isNameEditable?: boolean;
}

interface LeagueConfig {
  id: string;
  name: string;
  maxTeamSize: number;
  minFemales: number;
  minMales: number;
  targetTeams?: number;
  allowMixedGender: boolean;
}

interface PlayerGroup {
  id: string;
  label: string; // A, B, C, etc.
  color: string; // Color for visual identification
  playerIds: string[];
  players: Player[];
}
```

## State Management
- **Primary State:** Stored in `AppState` interface in `App.tsx`
- **Local Persistence:** Automatically saves to localStorage (`teamBuilderState` key)
- **Cloud Persistence:** Firebase Firestore for authenticated users
- **Hybrid Storage:** Uses `dataStorageService` to seamlessly handle both local and cloud storage
- **State includes:** players, teams, unassignedPlayers, playerGroups, config, stats, savedConfigs
- **Auth State:** Managed through Firebase Auth with anonymous and email options
- **Performance:** Debounced saves, optimized state updates, virtualized rendering for large datasets

## Key Features

### Authentication & User Management
- **Anonymous Sign-in:** Use app without creating an account
- **Email/Password Authentication:** Full account for cloud features
- **Automatic Session Management:** State persists between sessions
- **Multi-device Support:** Access your data from any device

### Cloud Storage Features
- **Saved Sessions:** Save and restore complete app states
- **Roster Library:** Save and manage multiple player rosters
- **Team Archives:** Save successful team configurations for reuse
- **Version Control:** Track roster versions and changes over time

### Team Generation Algorithm
1. **Constraint Priority:**
   - Avoid Requests (highest - hard constraint)
   - Team Size Limits (hard constraint)
   - Gender Requirements (hard constraint)
   - Mutual Teammate Requests (honored when possible)
   - Skill Balance (optimized after other constraints)

2. **Generation Types:**
   - Balanced Teams: Honors constraints and balances skill
   - Random Teams: Ignores preferences, random distribution
   - **AI Suggestions (New):** Intelligent team adjustments via Gemini

### Enhanced UI Features
- **Full-Screen Team Builder:** Dedicated mode with drag-and-drop
- **AI Assistant Panel:** Natural language queries for team manipulation (e.g., "Make teams more balanced")
- **Persistent Teams:** Empty teams remain on board for easier manual sorting
- **Visualized Unfulfilled Requests:** Icons showing broken links/groups in player cards

## Development Notes

### Code Patterns
- Functional components with Hooks (useState, useCallback, useEffect, useMemo)
- TypeScript for type safety
- Tailwind CSS for responsive styling
- Error boundaries for crash protection
- Firebase SDK for backend operations

### State Updates
- Immutable state updates
- Dual persistence (Local + Cloud)
- Optimistic UI updates

### Performance Considerations
- Team generation typically <1 second for 100+ players
- Virtualized rendering handles 1000+ players smoothly
- Real-time constraint validation with debouncing

### Common Tasks
- **Adding New Features**: Update types, add utility logic, create components, update persistence.
- **Firebase Integration**: Use `src/config/firebase.ts` and services in `src/services/`.
- **Debugging**: Use Console, React DevTools, and Firebase Console.
