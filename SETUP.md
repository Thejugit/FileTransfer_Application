# Quick Setup Guide

## Step 1: Start the Server

```bash
cd server
npm install
npm start
```

Server will run on port 3001.

## Step 2: Start the Web App

```bash
cd web
npm install
npm run dev
```

Web app will run on http://localhost:3000

## Step 3: Configure Mobile App

1. Find your computer's IP address:
   - Windows: Open CMD and type `ipconfig` (look for IPv4 Address)
   - Mac/Linux: Open Terminal and type `ifconfig` (look for inet)

2. Edit `mobile/lib/services/webrtc_service.dart`:
   - Change `YOUR_SERVER_IP` to your actual IP address
   - Example: `static const String signalingServer = 'ws://192.168.1.100:3001';`

## Step 4: Run Mobile App

```bash
cd mobile
flutter pub get
flutter run
```

Connect your Android device via USB or use an emulator.

## Usage

**To Send:**
1. Open sender → "Send File"
2. Share the 4-digit code
3. Wait for connection
4. Choose file → Send

**To Receive:**
1. Open receiver → "Receive File"
2. Enter 4-digit code
3. File downloads automatically

## Network Requirements

- Both devices must be on the same Wi-Fi network
- Or deploy the server online for internet-wide access

## Common Issues

**Can't connect?**
- Verify IP address is correct
- Check firewall settings
- Ensure both devices are on same network

**Files not downloading on Android?**
- Grant storage permissions
- Files saved to: Internal Storage/Android/data/.../files/FileTransfer/

---

Enjoy fast file transfers! 🚀
