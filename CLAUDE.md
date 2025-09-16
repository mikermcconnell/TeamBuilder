# TeamBuilder - Claude Context File

## App Overview
**TeamBuilder** is a React-based web application that automatically generates balanced sports teams from player rosters with smart constraint handling. It's designed for sports league organizers who need to create fair teams quickly. The app now features cloud storage, user authentication, and collaborative session management.

**Live Demo:** https://5msdtx5yti.space.minimax.io

## Tech Stack
- **Frontend:** React 18 + TypeScript
- **UI Framework:** Tailwind CSS + Radix UI components
- **Build Tool:** Vite
- **State Management:** React Context + Hooks + localStorage + Firestore
- **Backend:** Firebase (Authentication + Firestore Database)
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
│   └── dataStorageService.ts # Unified data storage layer
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
│   └── index.ts       # TypeScript interfaces
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

interface TeamGenerationStats {
  totalPlayers: number;
  assignedPlayers: number;
  unassignedPlayers: number;
  mutualRequestsHonored: number;
  mutualRequestsBroken: number;
  avoidRequestsViolated: number;
  generationTime: number;
}

// Firebase-related interfaces
interface SessionData {
  id?: string;
  userId: string;
  name: string;
  appState: AppState;
  createdAt: Date;
  updatedAt: Date;
}

interface SavedRoster {
  id?: string;
  userId: string;
  name: string;
  players: Player[];
  playerGroups?: PlayerGroup[];
  createdAt: Date;
  updatedAt: Date;
}

interface SavedTeams {
  id?: string;
  userId: string;
  name: string;
  teams: Team[];
  unassignedPlayers: Player[];
  config: LeagueConfig;
  stats?: TeamGenerationStats;
  createdAt: Date;
  updatedAt: Date;
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
- **Collaboration Ready:** Share rosters and teams (future feature)

### CSV Upload & Processing
- Validates required columns: Name, Gender, Skill Rating
- Optional columns: Teammate Requests, Avoid Requests, Email, Exec Skill Rating
- Supports player grouping via CSV
- Batch operations for roster management
- Comprehensive error reporting and warnings

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

3. **Advanced Features:**
   - Executive skill rating support
   - Player grouping with visual indicators
   - Real-time constraint validation
   - Generation statistics and performance metrics

### Enhanced UI Features

#### Main Interface (6-tab workflow)
1. **Upload:** CSV file processing with drag-and-drop
2. **Groups:** Player grouping management with color coding
3. **Roster:** Enhanced player management with virtualized table
4. **Generate Teams:** Advanced configuration and team generation
5. **Teams:** Interactive team display with drag-and-drop reassignment
6. **Export:** Multiple export formats (CSV, JSON, PDF-ready)

#### Full-Screen Team Builder
- Dedicated full-screen mode for focused team management
- Drag-and-drop player assignment between teams
- Real-time team statistics and constraint validation
- Visual constraint violation indicators
- Inline team name editing

#### Performance Optimizations
- **Virtualized Player Table:** Handles 1000+ players smoothly
- **Debounced State Updates:** Optimized save operations
- **Lazy Loading:** Components load as needed
- **Error Boundaries:** Isolated component failures don't crash app

### Roster Management
- **Batch Operations:** Add, edit, delete multiple players
- **Player Cards:** Visual player representation with all details
- **Smart Search:** Filter by name, team, group, or attributes
- **Import/Export:** Multiple format support
- **Validation:** Real-time constraint checking

### Configuration Presets
- Recreational League: 12 max, 3 min F, 3 min M
- Competitive League: 10 max, 2 min F, 2 min M
- Youth League: 15 max, no gender requirements
- Small-Sided Games: 7 max, 2 min F, 2 min M
- **Custom Presets:** Save your own configurations to cloud

## Important Files to Understand

### Core Logic
- `src/utils/teamGenerator.ts` - Main team generation algorithm
- `src/utils/csvProcessor.ts` - CSV parsing and validation
- `src/utils/performance.ts` - Performance optimization utilities
- `src/utils/validation.ts` - Data validation utilities
- `src/App.tsx` - Main application component with state management

### Key Components
- `src/components/CSVUploader.tsx` - File upload and validation
- `src/components/TeamDisplay.tsx` - Team visualization and drag-and-drop
- `src/components/ConfigurationPanel.tsx` - Settings management
- `src/components/ExportPanel.tsx` - Export functionality
- `src/components/SessionManager.tsx` - Cloud session management
- `src/components/FullScreenTeamBuilder.tsx` - Full-screen team builder
- `src/components/VirtualizedPlayerTable.tsx` - Performance-optimized player list
- `src/components/SavedRostersList.tsx` - Cloud roster management
- `src/components/SavedTeamsManager.tsx` - Cloud team management

### Firebase Services
- `src/services/authService.ts` - Authentication logic
- `src/services/firestoreService.ts` - Database operations
- `src/services/dataStorageService.ts` - Unified storage layer
- `src/services/rosterService.ts` - Roster persistence
- `src/services/teamsService.ts` - Team persistence
- `src/config/firebase.ts` - Firebase configuration

### Configuration
- `vite.config.ts` - Vite configuration with base path `/TeamBuilder/`
- `package.json` - Dependencies and scripts
- `tailwind.config.js` - Tailwind CSS configuration
- `firebase.json` - Firebase project configuration
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Database indexes

## Development Notes

### Code Patterns
- Uses React hooks extensively (useState, useCallback, useEffect, useRef)
- Functional components throughout
- TypeScript interfaces defined in `src/types/index.ts`
- Tailwind CSS for styling with Radix UI components
- Error boundaries implemented for crash protection
- Firebase SDK for backend operations
- React Window for virtualization

### State Updates
- Immutable state updates using spread operators
- Dual persistence: localStorage for offline, Firestore for cloud
- Debounced saves to optimize performance
- Complex state calculations for team statistics
- Optimistic UI updates with error recovery

### Performance Considerations
- Team generation typically <1 second for 100+ players
- Virtualized rendering handles 1000+ players smoothly
- Real-time constraint validation with debouncing
- Optimistic UI updates with error handling
- Lazy loading for Firebase services
- Component-level error boundaries prevent cascading failures

### Firebase Integration
- **Authentication Flow:**
  - Anonymous auth for quick start
  - Email/password for full features
  - Seamless upgrade from anonymous to registered
- **Data Structure:**
  - User-scoped collections in Firestore
  - Optimized queries with indexes
  - Security rules enforce user isolation
- **Performance:**
  - Offline persistence enabled
  - Batched writes for efficiency
  - Cached reads minimize API calls

## Common Tasks

### Adding New Features
1. Update types in `src/types/index.ts` if needed
2. Add business logic to appropriate utility file
3. Create/update React components
4. Update `AppState` and persistence if needed
5. Add Firebase service if cloud storage required
6. Update Firestore security rules if new collections added

### Working with Firebase
1. **Local Development:**
   - Firebase config in `src/config/firebase.ts`
   - Use Firebase emulator for local testing (optional)
   - Test runner available in dev mode
2. **Adding Collections:**
   - Update Firestore rules in `firestore.rules`
   - Add indexes in `firestore.indexes.json` if needed
   - Create service in `src/services/`
3. **Authentication:**
   - Use `authService.ts` for all auth operations
   - Handle both anonymous and registered users

### Debugging
- Check browser console for errors
- Inspect localStorage (`teamBuilderState` key) for local state
- Use Firebase Console for cloud data inspection
- Use React DevTools for component debugging
- Check Network tab for Firebase API calls
- Review Firestore security rule denials in Firebase Console

### Testing
- Firebase test runner available in development mode
- Manual testing workflow covers all user paths
- Component isolation with error boundaries
- Ask user about preferred testing approach before adding tests

## Build & Deployment
- Vite builds to `dist/` folder
- Static site deployment ready (Vercel, Netlify, etc.)
- Base path configured for `/TeamBuilder/` deployment
- Firebase backend hosted separately
- Environment variables needed:
  - Firebase configuration (API keys, project ID, etc.)
  - Set in `.env.local` for local development

## Environment
- Windows development environment
- Git repository with continuous feature additions
- Firebase backend for authentication and data storage
- Hybrid local/cloud data architecture
- Production deployment on Vercel with analytics

## Recent Major Updates

### Cloud Integration (Latest)
- **Firebase Authentication:** Anonymous and email/password sign-in
- **Cloud Storage:** Save rosters, teams, and configurations to Firestore
- **Session Management:** Save and restore complete app states
- **Multi-device Sync:** Access data from any device with authentication

### Performance Enhancements
- **Virtualized Tables:** React Window integration for large datasets
- **Optimized Rendering:** Debounced updates and memoization
- **Error Boundaries:** Component isolation prevents app crashes
- **Lazy Loading:** On-demand component and service loading

### UI/UX Improvements
- **Full-Screen Mode:** Dedicated team management interface
- **Tutorial System:** First-time user onboarding
- **Player Cards:** Enhanced visual player representation
- **Batch Operations:** Efficient roster management
- **Real-time Validation:** Instant feedback on constraints

### Data Management
- **Executive Skill Ratings:** Additional skill dimension for players
- **Email Support:** Player email tracking for communication
- **Version Control:** Track roster changes over time
- **Import/Export:** Multiple format support for data portability

## Workflow Examples

### First-Time User Flow
1. Tutorial landing page introduces features
2. Start with anonymous sign-in (no account needed)
3. Upload CSV or use sample roster
4. Configure league settings
5. Generate balanced teams
6. Optional: Create account to save work

### Returning User Flow
1. Sign in with email/password
2. Load saved session or roster
3. Make adjustments as needed
4. Generate new teams or modify existing
5. Save updates to cloud
6. Export for distribution

### League Manager Workflow
1. Import roster from registration system (CSV)
2. Review and clean data in Roster Manager
3. Set league-specific constraints
4. Generate multiple team configurations
5. Save best configuration to cloud
6. Export teams for communication
7. Share team assignments via export formats