import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/webrtc_service.dart';
import 'dart:io';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _mode;
  String _code = '';
  final TextEditingController _codeController = TextEditingController();
  String _status = '';
  File? _selectedFile;
  double _progress = 0;
  double _transferSpeed = 0;
  bool _connected = false;
  WebRTCService? _webrtcService;

  @override
  void dispose() {
    _codeController.dispose();
    _webrtcService?.cleanup();
    super.dispose();
  }

  Future<void> _requestPermissions() async {
    if (Platform.isAndroid) {
      final status = await Permission.storage.request();
      if (status.isDenied) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Storage permission is required'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  void _startSending() async {
    await _requestPermissions();
    
    setState(() {
      _mode = 'send';
      _status = 'Connecting to server...';
    });

    _webrtcService = WebRTCService(
      onCodeGenerated: (code) {
        setState(() {
          _code = code;
          _status = 'Share this code with receiver';
        });
      },
      onStatusChanged: (status) {
        setState(() {
          _status = status;
        });
      },
      onConnectionChanged: (connected) {
        setState(() {
          _connected = connected;
          if (connected) {
            _status = 'Connected! Choose a file to send';
          }
        });
      },
      onProgressChanged: (progress, speed) {
        setState(() {
          _progress = progress;
          _transferSpeed = speed;
        });
      },
      onFileReceived: (fileName, filePath) {
        setState(() {
          _status = 'File saved: $fileName';
          _progress = 100;
        });
      },
    );

    await _webrtcService!.startSending();
  }

  void _startReceiving() async {
    await _requestPermissions();
    
    if (_codeController.text.length != 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a 4-digit code'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _mode = 'receive';
      _status = 'Connecting to server...';
    });

    _webrtcService = WebRTCService(
      onCodeGenerated: (code) {},
      onStatusChanged: (status) {
        setState(() {
          _status = status;
        });
      },
      onConnectionChanged: (connected) {
        setState(() {
          _connected = connected;
          if (connected) {
            _status = 'Connected! Waiting for file...';
          }
        });
      },
      onProgressChanged: (progress, speed) {
        setState(() {
          _progress = progress;
          _transferSpeed = speed;
        });
      },
      onFileReceived: (fileName, filePath) {
        setState(() {
          _status = 'File received: $fileName';
          _progress = 100;
        });
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('File saved to: $filePath'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 5),
          ),
        );
      },
    );

    await _webrtcService!.startReceiving(_codeController.text);
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles();
    
    if (result != null && result.files.single.path != null) {
      setState(() {
        _selectedFile = File(result.files.single.path!);
      });
    }
  }

  Future<void> _sendFile() async {
    if (_selectedFile == null || _webrtcService == null) {
      return;
    }

    await _webrtcService!.sendFile(_selectedFile!);
  }

  void _reset() {
    _webrtcService?.cleanup();
    setState(() {
      _mode = null;
      _code = '';
      _codeController.clear();
      _status = '';
      _selectedFile = null;
      _progress = 0;
      _transferSpeed = 0;
      _connected = false;
      _webrtcService = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_mode == null) {
      return _buildModeSelection();
    } else if (_mode == 'receive-input') {
      return _buildCodeInput();
    } else {
      return _buildTransferScreen();
    }
  }

  Widget _buildModeSelection() {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.folder_rounded,
                size: 80,
                color: Color(0xFF667EEA),
              ),
              const SizedBox(height: 24),
              const Text(
                'File Transfer',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Fast & secure file sharing',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 48),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _startSending,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF667EEA),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Send File'),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _mode = 'receive-input';
                    });
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1A1A1A),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Receive File'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCodeInput() {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _reset,
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                'Enter Code',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter the 4-digit code to receive file',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                maxLength: 4,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 16,
                ),
                decoration: const InputDecoration(
                  counterText: '',
                  hintText: '0000',
                ),
                onChanged: (value) {
                  setState(() {});
                },
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _codeController.text.length == 4
                      ? _startReceiving
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF667EEA),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(0xFF1A1A1A),
                  ),
                  child: const Text('Connect'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTransferScreen() {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(_mode == 'send' ? 'Send File' : 'Receive File'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            children: [
              if (_code.isNotEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      const Text(
                        'Share this code:',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white70,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _code,
                        style: const TextStyle(
                          fontSize: 56,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 8,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _connected
                      ? const Color(0xFF1B5E20)
                      : const Color(0xFF1A1A1A),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _status,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _connected ? Colors.lightGreenAccent : Colors.grey,
                    fontWeight: _connected ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              if (_mode == 'send' && _connected) ...[
                if (_selectedFile == null)
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _pickFile,
                      icon: const Icon(Icons.attach_file),
                      label: const Text('Choose File'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1A1A1A),
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                if (_selectedFile != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A1A1A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(0xFF667EEA),
                        width: 2,
                      ),
                    ),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.insert_drive_file,
                          size: 48,
                          color: Color(0xFF667EEA),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _selectedFile!.path.split('/').last,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${(_selectedFile!.lengthSync() / 1024 / 1024).toStringAsFixed(2)} MB',
                          style: const TextStyle(
                            color: Colors.grey,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _sendFile,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF667EEA),
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Send File'),
                    ),
                  ),
                ],
              ],
              if (_progress > 0 && _progress < 100) ...[
                const Spacer(),
                Column(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: _progress / 100,
                        minHeight: 12,
                        backgroundColor: const Color(0xFF1A1A1A),
                        valueColor: const AlwaysStoppedAnimation<Color>(
                          Color(0xFF667EEA),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${_progress.toStringAsFixed(1)}% • ${_transferSpeed.toStringAsFixed(2)} MB/s',
                      style: const TextStyle(
                        color: Colors.grey,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
              ],
              if (_progress == 100) ...[
                const Spacer(),
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1B5E20),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.check_circle,
                        color: Colors.lightGreenAccent,
                        size: 32,
                      ),
                      SizedBox(width: 12),
                      Text(
                        'Transfer Complete!',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.lightGreenAccent,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
              ],
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _reset,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1A1A1A),
                    foregroundColor: Colors.white,
                  ),
                  child: Text(_progress == 100 ? 'Transfer Another File' : 'Cancel'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
