import React, { useState, useRef } from 'react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { ref as dbRef, set, get, onValue, remove } from 'firebase/database';
import { storage, database } from './firebase';
import './App.css';

function App() {
  const [mode, setMode] = useState(null);
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [status, setStatus] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState(0);
  
  const uploadTaskRef = useRef(null);
  const startTimeRef = useRef(null);

  const generateCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const startSending = () => {
    setMode('send');
    const newCode = generateCode();
    setCode(newCode);
    setStatus('Code generated. Choose a file to send.');
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const sendFile = async () => {
    if (!selectedFile || !code) {
      alert('Please select a file');
      return;
    }

    try {
      setStatus(`Uploading: ${selectedFile.name}`);
      startTimeRef.current = Date.now();

      // Upload file to Firebase Storage
      const fileRef = storageRef(storage, `transfers/${code}/${selectedFile.name}`);
      const uploadTask = uploadBytesResumable(fileRef, selectedFile);
      uploadTaskRef.current = uploadTask;

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(progress);
          
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const speed = snapshot.bytesTransferred / elapsed / 1024 / 1024;
          setTransferSpeed(speed);
        },
        (error) => {
          console.error('Upload error:', error);
          setStatus('Upload failed: ' + error.message);
        },
        async () => {
          // Upload complete, get download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Store metadata in Realtime Database
          await set(dbRef(database, `transfers/${code}`), {
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileType: selectedFile.type,
            downloadURL: downloadURL,
            timestamp: Date.now(),
            expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
          });

          setStatus('File uploaded! Receiver can download now.');
          setProgress(100);
        }
      );
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

    try {
      // Check if transfer exists
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

      setStatus(`Downloading: ${data.fileName}`);
      startTimeRef.current = Date.now();

      // Download file
      const response = await fetch(data.downloadURL);
      const blob = await response.blob();
      
      // Track progress
      const reader = response.body.getReader();
      const contentLength = data.fileSize;
      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        const progress = (receivedLength / contentLength) * 100;
        setProgress(progress);
        
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const speed = receivedLength / elapsed / 1024 / 1024;
        setTransferSpeed(speed);
      }

      // Create blob and download
      const completeBlob = new Blob(chunks, { type: data.fileType });
      const url = URL.createObjectURL(completeBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus('Download complete!');
      setProgress(100);

      // Clean up
      setTimeout(async () => {
        try {
          await remove(transferRef);
          const fileRef = storageRef(storage, `transfers/${inputCode}/${data.fileName}`);
          await deleteObject(fileRef);
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }, 5000);

    } catch (error) {
      console.error('Error:', error);
      setStatus('Error: ' + error.message);
    }
  };

  const reset = () => {
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
    }
    setMode(null);
    setCode('');
    setInputCode('');
    setStatus('');
    setSelectedFile(null);
    setProgress(0);
    setTransferSpeed(0);
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
              Download
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
        
        {status && (
          <div className="status">
            {status}
          </div>
        )}
        
        {mode === 'send' && !selectedFile && (
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
          </div>
        )}
        
        {selectedFile && progress === 0 && (
          <div className="file-section">
            <div className="file-info">
              <div className="file-name">{selectedFile.name}</div>
              <div className="file-size">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button className="btn btn-primary" onClick={sendFile}>
              Upload File
            </button>
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
