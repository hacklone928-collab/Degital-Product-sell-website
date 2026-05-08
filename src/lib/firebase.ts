import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Test connection to verify project configuration
import { doc, getDocFromServer } from "firebase/firestore";
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firestore connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.error("Firestore is offline. Please check your Firebase configuration.");
    } else {
      console.error("Firestore connection error:", error);
    }
  }
}
testConnection();
