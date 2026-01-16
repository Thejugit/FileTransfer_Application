import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const SIGNALING_SERVER = 'ws://localhost:3001';
const CHUNK_SIZE = 16384; // 16KB chunks for reliable transfer

function App() {
  const [mode, setMode] = useState(null); // 'send' or 'receive'
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [status, setStatus] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState(0);
  const [connected, setConnected] = useState(false);
  
  const wsRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const fileReaderRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const fileMetadataRef = useRef(null);
  const startTimeRef = useRef(null);
  const bytesTransferredRef = useRef(0);
  const pendingChunksRef = useRef([]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const createPeerConnection = () => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    const pc = new RTCPeerConnection(config);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        console.log('Sending ICE candidate');
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
        }));
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };
    
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnected(true);
        setStatus('Connected! Ready to transfer.');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnected(false);
        setStatus('Connection lost. Please try again.');
      }
    };
    
    return pc;
  };

  const startSending = () => {
    setMode('send');
    setStatus('Connecting to server...');
    
    const ws = new WebSocket(SIGNALING_SERVER);
    wsRef.current = ws;
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'create-room' }));
    };
    
    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received message:', data.type);
        
        switch (data.type) {
          case 'room-created':
            setCode(data.code);
            setStatus(`Share this code: ${data.code}`);
            break;
            
          case 'peer-joined':
            setStatus('Peer joined! Establishing connection...');
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;
            
            const dataChannel = pc.createDataChannel('fileTransfer', {
              ordered: true
            });
            setupDataChannel(dataChannel);
            
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log('Sending offer');
            ws.send(JSON.stringify({ 
              type: 'offer', 
              offer: { type: offer.type, sdp: offer.sdp } 
            }));
            break;
            
          case 'answer':
            console.log('Received answer');
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
            break;
            
          case 'ice-candidate':
            if (data.candidate) {
              console.log('Adding ICE candidate');
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(data.candidate)
              );
            }
            break;
            
          case 'peer-disconnected':
            setStatus('Peer disconnected');
            setConnected(false);
            break;
            
          case 'error':
            setStatus(`Error: ${data.message}`);
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        setStatus('Connection error occurred');
      }
    };
    
    ws.onerror = () => {
      setStatus('Connection error. Please check server.');
    };
  };

  const startReceiving = () => {
    if (inputCode.length !== 4) {
      alert('Please enter a 4-digit code');
      return;
    }
    
    setMode('receive');
    setStatus('Connecting to server...');
    
    const ws = new WebSocket(SIGNALING_SERVER);
    wsRef.current = ws;
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join-room', code: inputCode }));
    };
    
    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received message:', data.type);
        
        switch (data.type) {
          case 'peer-joined':
            setStatus('Waiting for connection...');
            break;
            
          case 'offer':
            console.log('Received offer');
            setStatus('Establishing connection...');
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;
            
            pc.ondatachannel = (event) => {
              console.log('Data channel received');
              setupDataChannel(event.channel);
            };
            
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log('Sending answer');
            ws.send(JSON.stringify({ 
              type: 'answer', 
              answer: { type: answer.type, sdp: answer.sdp } 
            }));
            break;
            
          case 'ice-candidate':
            if (data.candidate && peerConnectionRef.current) {
              console.log('Adding ICE candidate');
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(data.candidate)
              );
            }
            break;
            
          case 'peer-disconnected':
            setStatus('Peer disconnected');
            setConnected(false);
            break;
            
          case 'error':
            setStatus(`Error: ${data.message}`);
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        setStatus('Connection error occurred');
      }
    };
  };

  const setupDataChannel = (channel) => {
    dataChannelRef.current = channel;
    
    channel.onopen = () => {
      console.log('Data channel opened');
      setConnected(true);
      setStatus('Connected! Ready to transfer.');
    };
    
    channel.onclose = () => {
      console.log('Data channel closed');
      setConnected(false);
    };
    
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data);
          console.log('Received metadata:', message);
          
          if (message.type === 'file-metadata') {
            fileMetadataRef.current = message;
            receivedChunksRef.current = [];
            setStatus(`Receiving: ${message.name}`);
            startTimeRef.current = Date.now();
            bytesTransferredRef.current = 0;
            console.log('Metadata set, processing', pendingChunksRef.current.length, 'pending chunks');
            
            // Process any chunks that arrived early
            if (pendingChunksRef.current.length > 0) {
              pendingChunksRef.current.forEach(chunk => {
                receivedChunksRef.current.push(chunk);
                bytesTransferredRef.current += chunk.byteLength;
              });
              pendingChunksRef.current = [];
              
              const progress = (bytesTransferredRef.current / fileMetadataRef.current.size) * 100;
              setProgress(progress);
            }
          }
        } catch (error) {
          console.error('Error parsing metadata:', error);
        }
      } else {
        if (!fileMetadataRef.current) {
          console.log('Buffering binary chunk (no metadata yet), size:', event.data.byteLength);
          pendingChunksRef.current.push(event.data);
          return;
        }
        
        receivedChunksRef.current.push(event.data);
        bytesTransferredRef.current += event.data.byteLength;
        
        const progress = (bytesTransferredRef.current / fileMetadataRef.current.size) * 100;
        setProgress(progress);
        
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const speed = bytesTransferredRef.current / elapsed / 1024 / 1024;
        setTransferSpeed(speed);
        
        if (bytesTransferredRef.current >= fileMetadataRef.current.size) {
          const blob = new Blob(receivedChunksRef.current);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileMetadataRef.current.name;
          a.click();
          URL.revokeObjectURL(url);
          
          setStatus('File received successfully!');
          setProgress(100);
        }
      }
    };
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const sendFile = async () => {
    if (!selectedFile || !dataChannelRef.current) {
      alert('Please select a file and wait for connection');
      return;
    }
    
    const channel = dataChannelRef.current;
    
    if (channel.readyState !== 'open') {
      alert('Connection not ready. Please wait.');
      return;
    }
    
    // Send metadata
    const metadata = {
      type: 'file-metadata',
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type
    };
    console.log('Sending metadata:', metadata);
    channel.send(JSON.stringify(metadata));
    
    // Wait 2 seconds for receiver to process metadata
    console.log('Waiting 2 seconds before sending file...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Starting file transfer');
    setStatus(`Sending: ${selectedFile.name}`);
    startTimeRef.current = Date.now();
    bytesTransferredRef.current = 0;
    
    // Send file in chunks
    let offset = 0;
    const reader = new FileReader();
    
    reader.onload = (e) => {
      channel.send(e.target.result);
      bytesTransferredRef.current += e.target.result.byteLength;
      offset += e.target.result.byteLength;
      
      const progress = (offset / selectedFile.size) * 100;
      setProgress(progress);
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const speed = bytesTransferredRef.current / elapsed / 1024 / 1024;
      setTransferSpeed(speed);
      
      if (offset < selectedFile.size) {
        readSlice(offset);
      } else {
        setStatus('File sent successfully!');
        setProgress(100);
      }
    };
    
    const readSlice = (offset) => {
      const slice = selectedFile.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };
    
    readSlice(0);
  };

  const reset = () => {
    cleanup();
    setMode(null);
    setCode('');
    setInputCode('');
    setStatus('');
    setSelectedFile(null);
    setProgress(0);
    setTransferSpeed(0);
    setConnected(false);
    receivedChunksRef.current = [];
    fileMetadataRef.current = null;
    pendingChunksRef.current = [];
  };

  if (!mode) {
    return (
      <div className="container">
        <div className="card">
          <h1>📁 File Transfer</h1>
          <p className="subtitle">Fast & secure file sharing</p>
          
          <div className="button-group">
            <button className="btn btn-primary" onClick={startSending}>
              Send File
            </button>
            <button className="btn btn-secondary" onClick={() => setMode('receive-input')}>
              Receive File
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'receive-input') {
    return (
      <div className="container">
        <div className="card">
          <h1>Enter Code</h1>
          <p className="subtitle">Enter the 4-digit code to receive file</p>
          
          <input
            type="text"
            className="code-input"
            maxLength="4"
            placeholder="0000"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
          
          <div className="button-group">
            <button 
              className="btn btn-primary" 
              onClick={startReceiving}
              disabled={inputCode.length !== 4}
            >
              Connect
            </button>
            <button className="btn btn-secondary" onClick={reset}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1>{mode === 'send' ? '📤 Send File' : '📥 Receive File'}</h1>
        
        {code && (
          <div className="code-display">
            <div className="code-label">Share this code:</div>
            <div className="code-value">{code}</div>
          </div>
        )}
        
        <div className={`status ${connected ? 'connected' : ''}`}>
          {status}
        </div>
        
        {mode === 'send' && connected && (
          <div className="file-section">
            <input
              type="file"
              id="file-input"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-input" className="btn btn-secondary">
              Choose File
            </label>
            
            {selectedFile && (
              <div className="file-info">
                <div className="file-name">{selectedFile.name}</div>
                <div className="file-size">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            )}
            
            {selectedFile && (
              <button className="btn btn-primary" onClick={sendFile}>
                Send File
              </button>
            )}
          </div>
        )}
        
        {progress > 0 && progress < 100 && (
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-text">
              {progress.toFixed(1)}% • {transferSpeed.toFixed(2)} MB/s
            </div>
          </div>
        )}
        
        {progress === 100 && (
          <div className="success-message">
            ✓ Transfer Complete!
          </div>
        )}
        
        <button className="btn btn-secondary" onClick={reset}>
          {progress === 100 ? 'Transfer Another File' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

export default App;
