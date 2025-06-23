# TeamBuilder

A modern web application for automatically generating balanced teams from player rosters with smart constraint handling.

## 🚀 Live Demo

**Application URL:** https://5msdtx5yti.space.minimax.io

## ✨ Features

### Core Functionality
- **CSV Upload & Processing**: Robust validation with clear error reporting
- **Smart Team Generation**: Advanced algorithm that balances skill levels while honoring constraints
- **Interactive Team Management**: Drag-and-drop player reassignment with real-time validation
- **Configuration Presets**: Save and load league-specific settings
- **Comprehensive Export**: Multiple export formats (detailed CSV, summary CSV, text reports)

### Team Generation Algorithm
- **Mutual Teammate Requests**: Only honors requests when both players request each other
- **Avoid Constraints**: Hard constraint ensuring players are never on the same team
- **Gender Balance**: Configurable minimum requirements per team
- **Skill Balance**: Automatically balances teams by average skill rating
- **Team Size Limits**: Flexible team size constraints with overflow handling

### User Experience
- **Mobile-First Design**: Optimized for phones and tablets
- **Intuitive Interface**: Clean, practical design with clear navigation
- **Real-Time Feedback**: Instant validation and constraint checking
- **Error Handling**: Comprehensive error messages and recovery suggestions
- **Touch-Friendly**: Large touch targets and smooth interactions

## 📋 CSV Format Requirements

### Required Columns
- **Name**: Player's full name (must be unique)
- **Gender**: M (Male), F (Female), or Other
- **Skill Rating**: Numeric value (typically 0-10 scale)

### Optional Columns
- **Teammate Requests**: Comma-separated list of player names
- **Avoid Requests**: Comma-separated list of player names to avoid

### Sample CSV
```csv
Name,Gender,Skill Rating,Teammate Requests,Avoid Requests
Alice Johnson,F,8,Bob Smith,
Bob Smith,M,7,Alice Johnson,Charlie Brown
Charlie Brown,M,6,,Bob Smith
Diana Prince,F,9,,
```

## 🎯 Usage Guide

### Step 1: Upload Players
1. Navigate to the **Upload** tab
2. Download the sample CSV for reference format
3. Upload your player roster CSV file
4. Review validation results and fix any errors

### Step 2: Configure League
1. Go to the **Configure** tab (enabled after upload)
2. Set team size limits and gender requirements
3. Choose from built-in presets or create custom configuration
4. Generate balanced or random teams

### Step 3: Review Teams
1. Visit the **Teams** tab to see generated teams
2. Drag and drop players between teams if needed
3. Monitor constraint violations and team statistics
4. Use the **Roster** tab for detailed player management

### Step 4: Export Results
1. Access the **Export** tab for multiple export options
2. Generate detailed CSV with all statistics
3. Create summary CSV for quick reference
4. Generate text reports for sharing

## ⚙️ Configuration Options

### Team Size Settings
- **Maximum Team Size**: Upper limit for players per team (1-50)
- **Target Number of Teams**: Optional override for auto-calculation

### Gender Requirements
- **Minimum Females**: Required females per team
- **Minimum Males**: Required males per team
- **Mixed Gender**: Allow teams with varying gender compositions

### Built-in Presets
- **Recreational League**: 12 max, 3 min females, 3 min males
- **Competitive League**: 10 max, 2 min females, 2 min males
- **Youth League**: 15 max, no gender requirements
- **Small-Sided Games**: 7 max, 2 min females, 2 min males

## 🧮 Algorithm Details

### Constraint Priority
1. **Avoid Requests**: Highest priority (hard constraint)
2. **Team Size Limits**: Hard constraint
3. **Gender Requirements**: Hard constraint
4. **Mutual Teammate Requests**: Honored when possible
5. **Skill Balance**: Optimized after other constraints

### Team Generation Process
1. Parse and validate player data
2. Identify mutual teammate requests (both players must request each other)
3. Create constraint groups (pairs + individuals)
4. Sort groups by constraint complexity
5. Assign groups to teams while respecting all constraints
6. Balance teams by skill level through strategic swaps
7. Report unassigned players and constraint violations

### Performance Features
- Fast processing (typically <1 second for 100+ players)
- Real-time constraint validation
- Comprehensive statistics and recommendations

## 📊 Export Formats

### Detailed CSV Export
- Complete player assignments
- Team statistics (average skill, gender breakdown)
- Individual player details
- Unassigned player list

### Summary CSV Export
- Team overview with player lists
- Key statistics per team
- Compact format for sharing

### Text Report Export
- Human-readable team breakdown
- Constraint satisfaction analysis
- Generation statistics and recommendations

## 🛠️ Technical Stack

- **Frontend**: React 18 + TypeScript
- **UI Framework**: Tailwind CSS + Radix UI
- **Build Tool**: Vite
- **State Management**: React Context + Hooks
- **File Processing**: Client-side CSV parsing
- **Deployment**: Static web hosting

## 🔧 Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## 📱 Browser Support

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers
- ✅ Progressive Web App features

## 🎨 Design Philosophy

- **Practical Over Flashy**: Function-first design for busy volunteers
- **Mobile-First**: Optimized for on-the-go team management
- **Clear Communication**: Plain language and obvious navigation
- **Error Prevention**: Extensive validation and user guidance
- **Accessibility**: Screen reader friendly and keyboard navigation

## 🤝 Use Cases

### Recreational Sports Leagues
- Community volleyball leagues
- Corporate softball teams
- Social ultimate frisbee groups
- Mixed martial arts training groups

### Youth Sports
- School intramural programs
- Summer camp activities
- Club sport divisions
- Tournament brackets

### Competitive Leagues
- League drafts with skill balancing
- Tournament seeding
- Training group formation
- Scrimmage team creation

## 📈 Success Metrics

The application tracks and reports:
- Player assignment rate (target: >95%)
- Constraint satisfaction rate
- Mutual request fulfillment
- Processing time and efficiency
- User workflow completion

## 🔐 Privacy & Security

- **No Data Storage**: All processing happens client-side
- **No User Accounts**: No registration or login required
- **Local Configuration**: Settings saved in browser storage
- **File Security**: CSV files processed locally, never uploaded to servers

## 📞 Support

This is a production-ready application designed for immediate use by sports league organizers. The interface includes comprehensive help text, sample data, and error guidance to support self-service usage.

---

**Built for sports league convenors who need to generate balanced teams quickly and correctly.**
