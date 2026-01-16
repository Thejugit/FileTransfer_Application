import 'dart:async';
import 'dart:io';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:path_provider/path_provider.dart';

class WebRTCService {
  static const String signalingServer = 'ws://YOUR_SERVER_IP:3001';
  static const int chunkSize = 16384;

  WebSocketChannel? _channel;
  RTCPeerConnection? _peerConnection;
  RTCDataChannel? _dataChannel;
  
  final Function(String) onCodeGenerated;
  final Function(String) onStatusChanged;
  final Function(bool) onConnectionChanged;
  final Function(double, double) onProgressChanged;
  final Function(String, String) onFileReceived;

  List<Uint8List> _receivedChunks = [];
  Map<String, dynamic>? _fileMetadata;
  DateTime? _startTime;
  int _bytesTransferred = 0;

  WebRTCService({
    required this.onCodeGenerated,
    required this.onStatusChanged,
    required this.onConnectionChanged,
    required this.onProgressChanged,
    required this.onFileReceived,
  });

  Future<void> startSending() async {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(signalingServer));
      
      _channel!.stream.listen((message) {
        _handleSignalingMessage(json.decode(message));
      }, onError: (error) {
        onStatusChanged('Connection error');
      });

      _channel!.sink.add(json.encode({'type': 'create-room'}));
    } catch (e) {
      onStatusChanged('Error: ${e.toString()}');
    }
  }

  Future<void> startReceiving(String code) async {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(signalingServer));
      
      _channel!.stream.listen((message) {
        _handleSignalingMessage(json.decode(message));
      }, onError: (error) {
        onStatusChanged('Connection error');
      });

      _channel!.sink.add(json.encode({'type': 'join-room', 'code': code}));
    } catch (e) {
      onStatusChanged('Error: ${e.toString()}');
    }
  }

  Future<void> _handleSignalingMessage(Map<String, dynamic> data) async {
    switch (data['type']) {
      case 'room-created':
        onCodeGenerated(data['code']);
        break;

      case 'peer-joined':
        onStatusChanged('Peer joined! Establishing connection...');
        await _createPeerConnection();
        
        if (_dataChannel == null) {
          _dataChannel = await _peerConnection!.createDataChannel(
            'fileTransfer',
            RTCDataChannelInit(),
          );
          _setupDataChannel(_dataChannel!);
        }
        
        final offer = await _peerConnection!.createOffer();
        await _peerConnection!.setLocalDescription(offer);
        _channel!.sink.add(json.encode({
          'type': 'offer',
          'offer': offer.toMap(),
        }));
        break;

      case 'offer':
        await _createPeerConnection();
        
        _peerConnection!.onDataChannel = (channel) {
          _dataChannel = channel;
          _setupDataChannel(channel);
        };
        
        await _peerConnection!.setRemoteDescription(
          RTCSessionDescription(data['offer']['sdp'], data['offer']['type']),
        );
        
        final answer = await _peerConnection!.createAnswer();
        await _peerConnection!.setLocalDescription(answer);
        _channel!.sink.add(json.encode({
          'type': 'answer',
          'answer': answer.toMap(),
        }));
        break;

      case 'answer':
        await _peerConnection!.setRemoteDescription(
          RTCSessionDescription(data['answer']['sdp'], data['answer']['type']),
        );
        break;

      case 'ice-candidate':
        if (data['candidate'] != null) {
          await _peerConnection!.addCandidate(
            RTCIceCandidate(
              data['candidate']['candidate'],
              data['candidate']['sdpMid'],
              data['candidate']['sdpMLineIndex'],
            ),
          );
        }
        break;

      case 'peer-disconnected':
        onStatusChanged('Peer disconnected');
        onConnectionChanged(false);
        break;

      case 'error':
        onStatusChanged('Error: ${data['message']}');
        break;
    }
  }

  Future<void> _createPeerConnection() async {
    final configuration = {
      'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'},
        {'urls': 'stun:stun1.l.google.com:19302'},
      ]
    };

    _peerConnection = await createPeerConnection(configuration);

    _peerConnection!.onIceCandidate = (candidate) {
      _channel!.sink.add(json.encode({
        'type': 'ice-candidate',
        'candidate': candidate.toMap(),
      }));
        };

    _peerConnection!.onIceConnectionState = (state) {
      print('ICE connection state: $state');
      if (state == RTCIceConnectionState.RTCIceConnectionStateConnected) {
        onConnectionChanged(true);
        onStatusChanged('Connected! Ready to transfer.');
      } else if (state == RTCIceConnectionState.RTCIceConnectionStateDisconnected ||
          state == RTCIceConnectionState.RTCIceConnectionStateFailed) {
        onConnectionChanged(false);
        onStatusChanged('Connection lost');
      }
    };
  }

  void _setupDataChannel(RTCDataChannel channel) {
    channel.onMessage = (RTCDataChannelMessage message) {
      if (message.isBinary) {
        _receivedChunks.add(message.binary);
        _bytesTransferred += message.binary.length;

        if (_fileMetadata != null) {
          final progress = (_bytesTransferred / _fileMetadata!['size']) * 100;
          final elapsed = DateTime.now().difference(_startTime!).inMilliseconds / 1000;
          final speed = _bytesTransferred / elapsed / 1024 / 1024;
          
          onProgressChanged(progress, speed);

          if (_bytesTransferred >= _fileMetadata!['size']) {
            _saveReceivedFile();
          }
        }
      } else {
        final data = json.decode(message.text);
        if (data['type'] == 'file-metadata') {
          _fileMetadata = data;
          _receivedChunks = [];
          _startTime = DateTime.now();
          _bytesTransferred = 0;
          onStatusChanged('Receiving: ${data['name']}');
        }
      }
    };

    channel.onDataChannelState = (state) {
      print('Data channel state: $state');
    };
  }

  Future<void> _saveReceivedFile() async {
    try {
      final directory = await getExternalStorageDirectory();
      final downloadsDir = Directory('${directory!.path}/FileTransfer');
      
      if (!await downloadsDir.exists()) {
        await downloadsDir.create(recursive: true);
      }

      final filePath = '${downloadsDir.path}/${_fileMetadata!['name']}';
      final file = File(filePath);
      
      final completeData = Uint8List.fromList(
        _receivedChunks.expand((chunk) => chunk).toList(),
      );
      
      await file.writeAsBytes(completeData);
      
      onFileReceived(_fileMetadata!['name'], filePath);
    } catch (e) {
      onStatusChanged('Error saving file: ${e.toString()}');
    }
  }

  Future<void> sendFile(File file) async {
    if (_dataChannel == null) {
      onStatusChanged('Connection not ready');
      return;
    }

    try {
      final fileName = file.path.split('/').last;
      final fileSize = await file.length();

      // Send metadata
      final metadata = json.encode({
        'type': 'file-metadata',
        'name': fileName,
        'size': fileSize,
      });
      
      _dataChannel!.send(RTCDataChannelMessage(metadata));

      onStatusChanged('Sending: $fileName');
      _startTime = DateTime.now();
      _bytesTransferred = 0;

      // Send file in chunks
      final stream = file.openRead();
      await for (var chunk in stream) {
        final uint8Chunk = Uint8List.fromList(chunk);
        
        // Split into smaller chunks if needed
        for (var i = 0; i < uint8Chunk.length; i += chunkSize) {
          final end = (i + chunkSize < uint8Chunk.length) 
              ? i + chunkSize 
              : uint8Chunk.length;
          final subChunk = uint8Chunk.sublist(i, end);
          
          _dataChannel!.send(RTCDataChannelMessage.fromBinary(subChunk));
          _bytesTransferred += subChunk.length;

          final progress = (_bytesTransferred / fileSize) * 100;
          final elapsed = DateTime.now().difference(_startTime!).inMilliseconds / 1000;
          final speed = _bytesTransferred / elapsed / 1024 / 1024;
          
          onProgressChanged(progress, speed);
          
          // Small delay to prevent overwhelming the channel
          await Future.delayed(const Duration(microseconds: 100));
        }
      }

      onStatusChanged('File sent successfully!');
    } catch (e) {
      onStatusChanged('Error sending file: ${e.toString()}');
    }
  }

  void cleanup() {
    _dataChannel?.close();
    _peerConnection?.close();
    _channel?.sink.close();
  }
}
