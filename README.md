# 📁 File Transfer Application

A fast, peer-to-peer file transfer application that enables seamless file sharing between Android devices and web browsers using WebRTC technology.

## ✨ Features

- 🚀 **Lightning Fast**: WebRTC peer-to-peer connection for maximum transfer speed
- 🔒 **Secure**: Direct connection between devices with 4-digit pairing code
- 🌐 **Cross-Platform**: Transfer files between Android and any web browser
- 🎨 **Beautiful UI**: Simple, clean interface with dark AMOLED theme for mobile
- 📊 **Real-Time Progress**: Live transfer speed and progress tracking
- 💪 **Large File Support**: Handles files of any size with chunked transfer

## 🏗️ Architecture

The application consists of three components:

1. **Signaling Server** (Node.js + WebSocket)
   - Manages room creation and peer discovery
   - Facilitates WebRTC connection establishment
   - No file data passes through the server

2. **Web App** (React + Vite)
   - Modern, responsive web interface
   - Works on desktop and mobile browsers
   - Simple, intuitive design

3. **Mobile App** (Flutter)
   - Native Android application
   - Dark AMOLED theme for battery efficiency
   - Optimized for touch interfaces

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- Flutter SDK (v3.0 or higher)
- Android Studio (for mobile development)

### 1. Setup Signaling Server

```bash
cd server
npm install
npm start
```

The server will run on `http://localhost:3001`

### 2. Setup Web Application

```bash
cd web
npm install
npm run dev
```

The web app will be available at `http://localhost:3000`

### 3. Setup Mobile Application

**Important**: Update the server IP address in the mobile app:

Edit `mobile/lib/services/webrtc_service.dart`:
```dart
static const String signalingServer = 'ws://YOUR_SERVER_IP:3001';
```

Replace `YOUR_SERVER_IP` with your computer's local IP address (find it using `ipconfig` on Windows or `ifconfig` on Mac/Linux).

Then build and run:

```bash
cd mobile
flutter pub get
flutter run
```

## 📱 How to Use

### Sending Files

1. Open the sender device (mobile or web)
2. Click "Send File"
3. A 4-digit code will be generated and displayed
4. Share this code with the receiver
5. Once connected, choose a file to send
6. Click "Send File" to start the transfer

### Receiving Files

1. Open the receiver device (mobile or web)
2. Click "Receive File"
3. Enter the 4-digit code from the sender
4. Wait for connection to establish
5. File will automatically download when sender initiates transfer

## 🔧 Configuration

### Server Configuration

Edit `server/server.js` to change:
- Port: `const PORT = process.env.PORT || 3001;`
- Room expiry: `30 * 60 * 1000` (currently 30 minutes)

### Network Configuration

For local network use:
1. Ensure all devices are on the same network
2. Update mobile app with server's local IP
3. Access web app using server's IP (e.g., `http://192.168.1.100:3000`)

For internet use (requires deployment):
1. Deploy server to a cloud platform (Heroku, AWS, etc.)
2. Update both web and mobile apps with server's public URL
3. Ensure WebSocket connections are supported (wss:// for HTTPS)

## 🌐 Deployment

### Deploy Server (Example: Heroku)

```bash
cd server
heroku create your-app-name
git push heroku main
```

### Deploy Web App (Example: Vercel)

```bash
cd web
npm install -g vercel
vercel --prod
```

### Build Mobile App

```bash
cd mobile
flutter build apk --release
```

The APK will be in `mobile/build/app/outputs/flutter-apk/app-release.apk`

## 🎯 Performance Optimization

The app is optimized for maximum transfer speed:

- **WebRTC Data Channels**: Direct peer-to-peer connection
- **Chunked Transfer**: 16KB chunks for reliable streaming
- **No Server Bottleneck**: Files don't pass through the server
- **Efficient Encoding**: Binary transfer with minimal overhead

Expected transfer speeds:
- Same network (Wi-Fi): 50-100 MB/s
- Internet: Depends on both connections' upload/download speeds

## 🛡️ Security

- Files are transferred directly between peers (end-to-end)
- Server only facilitates connection establishment
- 4-digit codes expire after 30 minutes
- Rooms are deleted after use
- No file data is stored on the server

## 🐛 Troubleshooting

### "Connection error" on mobile
- Verify server IP address is correct
- Ensure both devices are on the same network
- Check if firewall is blocking connections

### "Invalid code" error
- Codes expire after 30 minutes
- Verify you entered the correct 4 digits
- Sender must create room first

### Slow transfer speeds
- Check network quality
- Ensure devices have good signal strength
- Try connecting both devices to 5GHz Wi-Fi if available

### Files not downloading on mobile
- Grant storage permissions in app settings
- Check available storage space
- Files are saved to `Android/data/.../files/FileTransfer/`

## 📦 Project Structure

```
FileTransfer_Application/
├── server/              # Node.js signaling server
│   ├── server.js       # WebSocket server implementation
│   └── package.json    # Server dependencies
├── web/                # React web application
│   ├── src/
│   │   ├── App.jsx    # Main app component
│   │   ├── App.css    # Styling
│   │   └── main.jsx   # Entry point
│   └── package.json   # Web dependencies
└── mobile/            # Flutter Android app
    ├── lib/
    │   ├── main.dart              # App entry point
    │   ├── screens/
    │   │   └── home_screen.dart  # Main UI screen
    │   └── services/
    │       └── webrtc_service.dart # WebRTC logic
    └── pubspec.yaml              # Flutter dependencies
```

## 🔮 Future Enhancements

- [ ] iOS support
- [ ] Multiple file selection
- [ ] Folder transfer
- [ ] Transfer history
- [ ] QR code sharing
- [ ] Pause/resume transfers
- [ ] File compression option
- [ ] Chat functionality

## 📄 License

MIT License - Feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## 💡 Technical Details

### WebRTC Connection Flow

1. Sender creates a room and gets a 4-digit code
2. Receiver joins room using the code
3. Sender creates an offer (SDP)
4. Offer is sent to receiver via signaling server
5. Receiver creates an answer (SDP)
6. Answer is sent back to sender
7. ICE candidates are exchanged
8. Direct peer connection is established
9. Data channel opens for file transfer

### Why WebRTC?

- **Fast**: Direct peer-to-peer connection
- **Secure**: Encrypted by default (DTLS-SRTP)
- **Efficient**: UDP-based with TCP fallback
- **Reliable**: Built-in congestion control and error handling
- **Browser Support**: Works in all modern browsers

---

**Built with ❤️ for fast, seamless file sharing**
