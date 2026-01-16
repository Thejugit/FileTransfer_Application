# Firebase Setup Instructions

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: "ftApp"
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Firebase Storage

1. In Firebase Console, click "Storage" in left sidebar
2. Click "Get Started"
3. Choose "Start in test mode"
4. Click "Next" and "Done"
5. **IMPORTANT:** Update Storage Rules to allow CORS:
   - Click on "Rules" tab
   - Replace with this:
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   - Click "Publish"

## Step 3: Enable Realtime Database

1. Click "Realtime Database" in left sidebar
2. Click "Create Database"
3. Choose your location
4. Start in "test mode"
5. Click "Enable"

## Step 4: Get Firebase Config

1. Click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the web icon `</>`
5. Register app with nickname "File Transfer Web"
6. Copy the `firebaseConfig` object

## Step 5: Update Code

1. Open `web/src/firebase.js`
2. Replace the `firebaseConfig` object with your config
3. Save the file

## Step 6: Install Dependencies and Run

```bash
cd web
npm install
npm run dev
```

## CORS Fix (If you still get CORS errors)

If you see CORS errors after setup:

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Set CORS configuration:
```bash
cd web
gsutil cors set cors.json gs://ftapp-93e2e.firebasestorage.app
```

Replace `ftapp-93e2e` with your project ID.

## Security Rules (Optional - for production)

### Storage Rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /transfers/{code}/{fileName} {
      allow write: if request.resource.size < 100 * 1024 * 1024; // 100MB limit
      allow read: if true;
      allow delete: if true;
    }
  }
}
```

### Database Rules
```json
{
  "rules": {
    "transfers": {
      "$code": {
        ".write": true,
        ".read": true,
        ".indexOn": ["timestamp"]
      }
    }
  }
}
```

## Features

- ✅ No WebRTC complexity
- ✅ Reliable file transfer
- ✅ Files expire after 30 minutes
- ✅ Automatic cleanup
- ✅ Progress tracking
- ✅ Works across any network

## Notes

- Files are temporarily stored in Firebase Storage
- 4-digit codes map to Firebase database entries
- Files auto-delete after download or expiry
- Free tier: 1GB storage, 10GB/month transfer
