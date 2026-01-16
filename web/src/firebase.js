import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

// TODO: Replace with your Firebase config
// Get this from Firebase Console -> Project Settings -> Your apps
const firebaseConfig = {
  apiKey: "AIzaSyDK6ZDRpp47G2OfKvBILQaN4wB_Vg813nU",
  authDomain: "ftapp-93e2e.firebaseapp.com",
  databaseURL: "https://ftapp-93e2e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ftapp-93e2e",
  storageBucket: "ftapp-93e2e.firebasestorage.app",
  messagingSenderId: "613615250882",
  appId: "1:613615250882:web:b3c5e38a8e8723be523a5b"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const database = getDatabase(app);
