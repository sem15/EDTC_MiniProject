// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";


// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDSY5RCZQDso9xLuYjPfyEY24VXl-Aw4Nk",
  authDomain: "edtc-miniproject.firebaseapp.com",
  projectId: "edtc-miniproject",
  storageBucket: "edtc-miniproject.firebasestorage.app",
  messagingSenderId: "644766918572",
  appId: "1:644766918572:web:7e5c046a579be55bdd7c09",
  measurementId: "G-W24PQMC5ZY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// const analytics = getAnalytics(app);

export {
    db,
}