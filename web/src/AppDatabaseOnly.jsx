import React, { useState } from 'react';
import { ref as dbRef, set, get, remove } from 'firebase/database';
import { database } from './firebase';
import './App.css';

function App() {
  const [transferType, setTransferType] = useState('file'); // 'file' or 'text'
  const [mode, setMode] = useState(null);
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [status, setStatus] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [textContent, setTextContent] = useState('');
  const [receivedText, setReceivedText] = useState('');

  const generateCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const startSending = () => {
    setMode('send');
    const newCode = generateCode();
    setCode(newCode);
    if (transferType === 'file') {
      setStatus('Code generated. Choose a file to send.');
    } else {
      setStatus('Code generated. Type your text and send.');
    }
  };

  const sendText = async () => {
    if (!textContent.trim() || !code) {
      alert('Please enter some text');
      return;
    }

    try {
      setStatus('Uploading text...');
      setProgress(50);

      await set(dbRef(database, `transfers/${code}`), {
        type: 'text',
        content: textContent,
        timestamp: Date.now(),
        expiresAt: Date.now() + (2 * 60 * 1000), // 2 minutes
        devices: [],
        maxDevices: 5
      });

      setStatus('Text uploaded! Receiver can retrieve now.');
      setProgress(100);
    } catch (error) {
      console.error('Error:', error);
      setStatus('Error: ' + error.message);
    }
  };

  const retrieveText = async () => {
    if (inputCode.length !== 4) {
      alert('Please enter a 4-digit code');
      return;
    }

    setMode('receive');
    setStatus('Looking for text...');
    setProgress(10);

    try {
      const transferRef = dbRef(database, `transfers/${inputCode}`);
      const snapshot = await get(transferRef);

      if (!snapshot.exists()) {
        setStatus('Invalid code or text expired');
        return;
      }

      const data = snapshot.val();
      
      if (Date.now() > data.expiresAt) {
        setStatus('Text has expired');
        await remove(transferRef);
        return;
      }

      if (data.type !== 'text') {
        setStatus('Error: This code is for a file, not text');
        return;
      }

      setReceivedText(data.content);
      
      // Generate unique device ID if not exists
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `device_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('deviceId', deviceId);
      }
      
      const devices = data.devices || [];
      const deviceCount = devices.length;
      const maxDevices = data.maxDevices || 5;
      
      // Check if device already downloaded
      if (!devices.includes(deviceId)) {
        // Check device limit
        if (deviceCount >= maxDevices) {
          setStatus('Device limit reached (5 devices max)');
          return;
        }
        
        devices.push(deviceId);
        const remainingSlots = maxDevices - devices.length;
        
        setStatus(`Text retrieved! (${remainingSlots} device${remainingSlots !== 1 ? 's' : ''} remaining)`);
        
        // Update devices list or remove if limit reached
        try {
          if (devices.length >= maxDevices) {
            await remove(transferRef);
          } else {
            await set(transferRef, { ...data, devices });
          }
        } catch (error) {
          console.error('Update error:', error);
        }
      } else {
        setStatus('Text retrieved! (Already downloaded on this device)');
      }
      
      setProgress(100);

    } catch (error) {
      console.error('Error:', error);
      setStatus('Error: ' + error.message);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(receivedText);
    setStatus('Copied to clipboard!');
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      // Check total file size (max 10MB for free tier)
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      if (totalSize > 10 * 1024 * 1024) {
        alert('Total files too large! Maximum 10MB combined on free tier.');
        return;
      }
      setSelectedFiles(files);
    }
  };

  const sendFile = async () => {
    if (!selectedFiles.length || !code) {
      alert('Please select files');
      return;
    }

    try {
      setStatus(`Encoding ${selectedFiles.length} file(s)...`);
      setProgress(10);

      // Process all files
      const filesData = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        filesData.push({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileData: base64Data
        });
      }

      setStatus(`Uploading ${selectedFiles.length} file(s) to database...`);
      setProgress(50);

      // Store in Realtime Database
      await set(dbRef(database, `transfers/${code}`), {
        type: 'file',
        files: filesData,
        fileCount: selectedFiles.length,
        timestamp: Date.now(),
        expiresAt: Date.now() + (2 * 60 * 1000), // 2 minutes
        devices: [],
        maxDevices: 5
      });

      setStatus(`${selectedFiles.length} file(s) uploaded! Receiver can download now.`);
      setProgress(100);
    } catch (error) {
      console.error('Error:', error);
      setStatus('Error: ' + error.message);
    }
  };

  const startReceiving = async () => {
    if (inputCode.length !== 4) {
      alert('Please enter a 4-digit code');
      return;
    }

    setMode('receive');
    setStatus('Looking for file...');
    setProgress(10);

    try {
      // Get from Realtime Database
      const transferRef = dbRef(database, `transfers/${inputCode}`);
      const snapshot = await get(transferRef);

      if (!snapshot.exists()) {
        setStatus('Invalid code or file expired');
        return;
      }

      const data = snapshot.val();
      
      // Check if expired
      if (Date.now() > data.expiresAt) {
        setStatus('File has expired');
        await remove(transferRef);
        return;
      }

      // Check type
      if (data.type !== 'file') {
        setStatus('Error: This code is for text, not a file');
        return;
      }

      // Generate unique device ID if not exists
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `device_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('deviceId', deviceId);
      }
      
      const devices = data.devices || [];
      const deviceCount = devices.length;
      const maxDevices = data.maxDevices || 5;
      
      // Check if device already downloaded
      const alreadyDownloaded = devices.includes(deviceId);
      
      if (!alreadyDownloaded) {
        // Check device limit
        if (deviceCount >= maxDevices) {
          setStatus('Device limit reached (5 devices max)');
          setProgress(0);
          return;
        }
      }

      setStatus(`Downloading: ${data.fileCount || 1} file(s)`);
      setProgress(50);

      // Handle multiple files or single file
      const filesToDownload = data.files || [{
        fileName: data.fileName,
        fileData: data.fileData
      }];

      // Download all files
      for (let i = 0; i < filesToDownload.length; i++) {
        const fileInfo = filesToDownload[i];
        
        setStatus(`Downloading: ${fileInfo.fileName} (${i + 1}/${filesToDownload.length})`);
        
        const response = await fetch(fileInfo.fileData);
        const blob = await response.blob();
        
        // Create blob with correct type
        const typedBlob = new Blob([blob], { type: fileInfo.fileType || blob.type });
        const url = URL.createObjectURL(typedBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfo.fileName || `file_${i + 1}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Cleanup and delay between downloads
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        // Wait 500ms between downloads to avoid browser blocking
        if (i < filesToDownload.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      setProgress(80);

      if (!alreadyDownloaded) {
        devices.push(deviceId);
        const remainingSlots = maxDevices - devices.length;
        
        setStatus(`Download complete! (${remainingSlots} device${remainingSlots !== 1 ? 's' : ''} remaining)`);
        
        // Update devices list or remove if limit reached
        try {
          if (devices.length >= maxDevices) {
            await remove(transferRef);
          } else {
            await set(transferRef, { ...data, devices });
          }
        } catch (error) {
          console.error('Update error:', error);
        }
      } else {
        setStatus('Download complete! (Already downloaded on this device)');
      }
      
      setProgress(100);

    } catch (error) {
      console.error('Error:', error);
      setStatus('Error: ' + error.message);
    }
  };

  const reset = () => {
    setMode(null);
    setCode('');
    setInputCode('');
    setStatus('');
    setSelectedFiles([]);
    setProgress(0);
    setTextContent('');
    setReceivedText('');
  };

  const switchTransferType = (type) => {
    setTransferType(type);
    reset();
  };

  if (!mode) {
    return (
      <div className="container">
        <div className="navbar">
          <button 
            className={`nav-btn ${transferType === 'file' ? 'active' : ''}`}
            onClick={() => switchTransferType('file')}
          >
            FILE TRANSFER
          </button>
          <button 
            className={`nav-btn ${transferType === 'text' ? 'active' : ''}`}
            onClick={() => switchTransferType('text')}
          >
            TEXT TRANSFER
          </button>
        </div>
        <div className="card">
          <h1>{transferType === 'file' ? 'FILE TRANSFER' : 'TEXT TRANSFER'}</h1>
          <p className="subtitle">
            {transferType === 'file' ? 'Fast & secure file sharing' : 'Fast & secure text sharing'}
          </p>
          {transferType === 'file' && (
            <p className="subtitle" style={{fontSize: '0.85rem', color: '#666'}}>
              Max 10MB | 2 min expiry | 5 devices
            </p>
          )}
          {transferType === 'text' && (
            <p className="subtitle" style={{fontSize: '0.85rem', color: '#666'}}>
              2 min expiry | 5 devices max
            </p>
          )}
          
          <div className="button-group">
            <button className="btn btn-primary" onClick={startSending}>
              {transferType === 'file' ? 'Send File' : 'Send Text'}
            </button>
            <button className="btn btn-secondary" onClick={() => setMode('receive-input')}>
              {transferType === 'file' ? 'Receive File' : 'Receive Text'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'receive-input') {
    return (
      <div className="container">
        <div className="navbar">
          <button 
            className={`nav-btn ${transferType === 'file' ? 'active' : ''}`}
            onClick={() => switchTransferType('file')}
          >
            FILE TRANSFER
          </button>
          <button 
            className={`nav-btn ${transferType === 'text' ? 'active' : ''}`}
            onClick={() => switchTransferType('text')}
          >
            TEXT TRANSFER
          </button>
        </div>
        <div className="card">
          <h1>Enter Code</h1>
          <p className="subtitle">
            Enter the 4-digit code to {transferType === 'file' ? 'receive file' : 'receive text'}
          </p>
          
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
              onClick={transferType === 'file' ? startReceiving : retrieveText}
              disabled={inputCode.length !== 4}
            >
              {transferType === 'file' ? 'Download' : 'Retrieve'}
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
      <div className="navbar">
        <button 
          className={`nav-btn ${transferType === 'file' ? 'active' : ''}`}
          onClick={() => switchTransferType('file')}
        >
          FILE TRANSFER
        </button>
        <button 
          className={`nav-btn ${transferType === 'text' ? 'active' : ''}`}
          onClick={() => switchTransferType('text')}
        >
          TEXT TRANSFER
        </button>
      </div>
      <div className="card">
        <h1>{mode === 'send' ? (transferType === 'file' ? 'SEND FILE' : 'SEND TEXT') : (transferType === 'file' ? 'RECEIVE FILE' : 'RECEIVE TEXT')}</h1>
        
        {code && (
          <div className="code-display">
            <div className="code-label">Share this code:</div>
            <div className="code-value">{code}</div>
          </div>
        )}
        
        {status && (
          <div className="status">
            {status}
          </div>
        )}
        
        {mode === 'send' && transferType === 'file' && selectedFiles.length === 0 && (
          <div className="file-section">
            <input
              type="file"
              id="file-input"
              onChange={handleFileSelect}
              multiple
              style={{ display: 'none' }}
            />
            <label htmlFor="file-input" className="btn btn-secondary">
              Choose Files (Max 10MB total)
            </label>
          </div>
        )}

        {mode === 'send' && transferType === 'text' && progress === 0 && (
          <div className="text-section">
            <textarea
              className="text-input"
              placeholder="Type your text here..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows="10"
            />
            <button 
              className="btn btn-primary" 
              onClick={sendText}
              disabled={!textContent.trim()}
            >
              Send Text
            </button>
          </div>
        )}
        
        {selectedFiles.length > 0 && progress === 0 && (
          <div className="file-section">
            {selectedFiles.map((file, index) => (
              <div key={index} className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-size">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            ))}
            <div className="file-info" style={{marginTop: '10px', borderColor: '#76B900'}}>
              <div className="file-name">Total: {selectedFiles.length} file(s)</div>
              <div className="file-size">
                {(selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button className="btn btn-primary" onClick={sendFile}>
              Upload Files
            </button>
          </div>
        )}
        
        {progress > 0 && progress < 100 && (
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-text">
              {progress.toFixed(0)}%
            </div>
          </div>
        )}
        
        {progress === 100 && transferType === 'file' && (
          <div className="success-message">
            TRANSFER COMPLETE!
          </div>
        )}

        {progress === 100 && transferType === 'text' && mode === 'receive' && receivedText && (
          <div className="text-section">
            <div className="received-text">
              <div className="text-label">RECEIVED TEXT:</div>
              <div className="text-display">{receivedText}</div>
            </div>
            <button className="btn btn-primary" onClick={copyToClipboard}>
              Copy to Clipboard
            </button>
          </div>
        )}

        {progress === 100 && transferType === 'text' && mode === 'send' && (
          <div className="success-message">
            TEXT SENT SUCCESSFULLY!
          </div>
        )}
        
        <button className="btn btn-secondary" onClick={reset}>
          {progress === 100 ? `Transfer Another ${transferType === 'file' ? 'File' : 'Text'}` : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

export default App;
