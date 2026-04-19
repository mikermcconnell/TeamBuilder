# 🏆 TeamBuilder - Sports Team Generator

**Generate perfectly balanced sports teams in seconds.** TeamBuilder helps organizers create fair teams from a player roster using skill balancing, gender rules, player preferences, saved workspaces, and interactive team editing.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/teambuilder)

## ⚡ Key Features

- **🎯 Smart Team Generation**: Constraint-based balancing for skill, team size, and player requests
- **📊 CSV Upload Support**: Easy player roster management with CSV file import
- **⚖️ Gender Balance**: Automatic gender distribution for fair team composition  
- **👥 Player Preferences**: Honor teammate requests and avoid pairings
- **🤖 AI Assist Features**: Optional AI help for name matching and team adjustment suggestions
- **📈 Generation Analytics**: Detailed statistics on team generation performance
- **💾 Export & Reporting**: CSV exports and text reports for team rosters
- **🎮 Interactive Management**: Drag-and-drop player management between teams
- **☁️ Saved Projects**: Save and reload workspaces and rosters when signed in
- **📱 Mobile Responsive**: Works perfectly on all devices

## 🚀 Perfect For

- **Sports Coaches**: Generate balanced teams for practices and games
- **Recreation Leagues**: Fair team distribution for recreational sports
- **Corporate Events**: Team building activities and company sports days
- **School Programs**: PE classes and intramural sports organization
- **Tournament Organizers**: Quick team creation for competitions
- **Youth Sports**: Summer camps and club activities
- **Community Groups**: Local sports meetups and leagues

## 🌐 Live Demo

🎮 **Try it now**: [teambuilder-mu.vercel.app](https://teambuilder-mu.vercel.app)

No signup required - upload your CSV and start generating teams instantly!

## ✅ TODO

- Remove the "Clear Saved Data" button from the roster page; it is no longer needed.

## 📋 Quick Start Guide

### 1. Upload Your Roster
- Download our sample CSV template
- Add your players with optional skill ratings and preferences
- Upload and validate your roster

### 2. Configure Teams
- Set team size limits
- Define gender balance requirements
- Choose balanced or random generation

### 3. Generate & Manage
- AI creates optimized teams
- Drag players between teams if needed
- Review detailed statistics

### 4. Export & Share
- Export detailed or summary CSVs
- Generate a text report for sharing or printing
- Save the project for future edits

## 📊 CSV Format

### Required Fields
- **Name**: Player's full name
- **Gender**: M, F, or Other  
- **Skill Rating**: 0-10 scale

### Optional Fields
- **Email**: For player notifications
- **Teammate Requests**: Preferred teammates
- **Avoid Requests**: Players to separate

### Sample Format
```csv
Name,Gender,Skill Rating,Email,Teammate Requests,Avoid Requests
Alice Johnson,F,8,alice@email.com,Bob Smith,
Bob Smith,M,7,bob@email.com,Alice Johnson,Charlie Brown
Charlie Brown,M,6,,Bob Smith,
Diana Prince,F,9,diana@email.com,,
```

## 🎯 Algorithm Features

### Smart Balancing
- **Skill Distribution**: Even average skill ratings across teams
- **Gender Balance**: Configurable requirements per team
- **Size Optimization**: Flexible team size constraints
- **Constraint Satisfaction**: Honor player preferences when possible

### Advanced Features
- **Mutual Requests**: Only honors two-way teammate requests
- **Avoid Violations**: Prevents unwanted player pairings
- **Overflow Handling**: Manages players when perfect balance isn't possible
- **Real-time Validation**: Instant feedback on team changes

## 🔧 Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS + shadcn/ui components
- **State Management**: React Hooks + Local Storage
- **Performance**: Code splitting and lazy loading
- **SEO**: Comprehensive meta tags and structured data
- **Deployment**: Vercel edge network

## 📈 Performance & SEO

### Core Web Vitals Optimized
- **LCP**: < 1.2s (Largest Contentful Paint)
- **FID**: < 100ms (First Input Delay)  
- **CLS**: < 0.1 (Cumulative Layout Shift)

### Search Engine Optimized
- Structured data markup for rich snippets
- Open Graph and Twitter Card integration
- Mobile-first responsive design
- Semantic HTML structure
- Fast loading times

## 🛠️ Local Development

```bash
# Clone repository
git clone https://github.com/your-username/teambuilder.git
cd teambuilder

# Install dependencies
npm install

# Add your server-side OpenAI key to .env.local
# OPENAI_API_KEY=your_key_here

# Optional: switch name matching to a local/self-hosted Gemma provider
# AI_PROVIDER=gemma
# GEMMA_BASE_URL=http://127.0.0.1:11434
# GEMMA_MODEL=gemma4

# Start frontend-only development server
npm run dev

# Start the app with Vercel API routes enabled
npm run dev:vercel

# Build for production
npm run build
```

Use `npm run dev:vercel` if you want the server-side AI features to work locally.

### Publish generated teams into a saved project

If you already have a registration export and a generated teams CSV, you can turn that into a TeamBuilder project backup and optionally publish it straight to Firestore:

```bash
pnpm workspace:publish \
  --roster "Rosters/Spring Outdoor 2026_event-registrations_2026-04-14_11_23.csv" \
  --teams "Rosters/Spring Outdoor 2026_generated_teams.csv" \
  --project-name "Spring Outdoor 2026 AI Draft"
```

Add `--publish firestore --user-email you@example.com` to write the workspace directly into the signed-in user's project list. The script also keeps mutual request groups so the draft can be regenerated later inside the app.

Direct Firestore publish now supports either:

- an existing local Firebase CLI login on this machine, or
- Firebase Admin credentials in `.env.local`

For repeatable automation or headless environments, add one of these to `.env.local`:

```bash
FIREBASE_PROJECT_ID=teambuilder-3b79e
FIREBASE_SERVICE_ACCOUNT_PATH=C:/secure/team-builder-service-account.json
```

or:

```bash
FIREBASE_PROJECT_ID=teambuilder-3b79e
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

### Optional Gemma setup for AI name matching and group suggestions

The current Gemma rollout supports:
- `/api/ai/name-match`
- `/api/ai/group-suggestions`
- `/api/ai/team-suggestions`

Other AI endpoints still use OpenAI for now.

Add these values to `.env.local` if you want name matching to use a local or self-hosted Gemma runtime:

```bash
AI_PROVIDER=gemma
GEMMA_BASE_URL=http://127.0.0.1:11434
GEMMA_MODEL=gemma4
```

Current assumptions for the Gemma provider:
- It targets an Ollama-compatible `/api/chat` endpoint
- The model must return valid JSON
- Team draft generation still uses OpenAI in this milestone

## 🌟 Use Cases & Examples

### Recreational Sports
- **Volleyball Leagues**: Balance skill levels for competitive matches
- **Soccer Meetups**: Create fair teams for pickup games
- **Basketball Tournaments**: Organize balanced brackets

### Educational Settings
- **PE Classes**: Quick team formation for sports activities
- **Summer Camps**: Fair team distribution for camp games
- **Intramural Sports**: Balanced competition between students

### Corporate Events
- **Team Building**: Mixed department team formation
- **Company Sports Day**: Fair competition across skill levels
- **Office Tournaments**: Balanced brackets for competitions

### Youth Sports
- **Club Teams**: Age and skill appropriate groupings
- **Training Sessions**: Balanced practice teams
- **Tournament Preparation**: Strategic team composition

## 📱 Browser Support

- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers (iOS/Android)
- ✅ Progressive Web App features

## 🤝 Contributing

We welcome contributions! Here's how to help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏷️ Keywords

team generator, sports teams, balanced teams, player roster, team builder, sports organizer, coach tools, fair teams, team formation, sports management, CSV upload, skill balancing, recreational sports, league management, team selection, sports algorithm, team balancing software, athletic team creation, sports team maker, coaching tools, tournament organization

---

**Made with ❤️ for coaches, organizers, and sports enthusiasts worldwide**
