# Firebase Setup Guide for TeamBuilder

## 🚀 Quick Start - Simple Cloud Save

TeamBuilder now supports optional cloud saving through Firebase. When signed in, your data automatically syncs to the cloud. When signed out, data is saved locally only.

## Features
- **Anonymous Authentication**: No email/password required - just click "Enable Cloud Save"
- **Automatic Migration**: Local data automatically migrates to the cloud on first sign-in
- **Seamless Fallback**: Works offline or when not signed in using localStorage
- **Single Document Storage**: Simple structure - one document per user

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "TeamBuilder")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In Firebase Console, click on "Authentication" in the left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Anonymous" authentication (this is all we need!)

## Step 3: Enable Firestore Database

1. Click on "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in production mode"
4. Select your region (choose closest to your users)
5. Click "Enable"

## Step 4: Get Your Configuration

1. Go to Project Settings (gear icon) → "Project settings"
2. Scroll down to "Your apps" section
3. Click on "</>" (Web) icon
4. Register your app with a nickname (e.g., "TeamBuilder Web")
5. Copy the Firebase configuration values

## Step 5: Configure Your App

1. Create a `.env` file in your project root (copy from `.env.example`):

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id  # Optional
```

2. Replace the values with your actual Firebase configuration

## Step 6: Set Up Security Rules

### Firestore Rules (Simple Version)

Go to Firestore Database → Rules and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🎉 You're Ready!

Your Firebase backend is now configured. The app will:

1. **Sign In**: Click "Enable Cloud Save" in the header to sign in anonymously
2. **Auto Migration**: Your local data will automatically migrate to the cloud on first sign-in
3. **Cloud Sync**: All changes auto-save to both Firestore and localStorage
4. **Sign Out**: Click "Sign Out" to return to local-only storage

## How It Works

### Data Structure
```
users/
  {userId}/
    appState/
      data (document containing the entire AppState)
```

### Sign In Flow
1. User clicks "Enable Cloud Save"
2. Anonymous authentication creates a unique user ID
3. Local data (if any) migrates to Firestore
4. Future saves go to both Firestore and localStorage

### Sign Out Flow
1. User clicks "Sign Out"
2. Data continues to save locally only
3. Cloud data remains intact for next sign-in

### Data Loading Priority
1. If signed in: Load from Firestore first, fallback to localStorage
2. If signed out: Load from localStorage only
3. On error: Always fallback to localStorage

## Troubleshooting

### "Firebase not configured" error
- Make sure `.env.local` file exists with correct values
- Restart the development server after adding environment variables

### "Permission denied" errors
- Check that authentication is enabled
- Verify security rules are deployed
- Ensure user is signed in

### "Quota exceeded" errors
- Check Firebase Console for usage limits
- Consider upgrading to Blaze plan for production use

## Production Considerations

1. **Upgrade to Blaze Plan**: For production usage with many users
2. **Backup Strategy**: Implement regular Firestore backups
3. **Monitoring**: Set up Firebase Performance Monitoring
4. **Analytics**: Enable Google Analytics for user insights
5. **Security**: Review and tighten security rules before launch

## Support

For Firebase issues:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Support](https://firebase.google.com/support)

For TeamBuilder issues:
- Check the main README.md
- Open an issue on GitHub