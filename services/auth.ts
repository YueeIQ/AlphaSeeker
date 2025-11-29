import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { User, UserCloudData } from "../types";

// Helper to map Firebase User to our App User
const mapUser = (fbUser: FirebaseUser): User => ({
  uid: fbUser.uid,
  email: fbUser.email || "",
  name: fbUser.email ? fbUser.email.split('@')[0] : "User"
});

export const AuthService = {
  // Listen to auth state changes (Observer)
  onAuthStateChange: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        callback(mapUser(fbUser));
      } else {
        callback(null);
      }
    });
  },

  // REGISTER: Create Auth User + Initial Firestore Doc
  register: async (email: string, password: string): Promise<User> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;
      
      // Initialize empty data document in Firestore: users/{uid}
      // We store the data inside a 'data' field to match your existing structure
      await setDoc(doc(db, "users", fbUser.uid), {
        data: null,
        email: email,
        createdAt: new Date().toISOString()
      });

      return mapUser(fbUser);
    } catch (error: any) {
      console.error("Registration Error:", error);
      let msg = "注册失败";
      if (error.code === 'auth/email-already-in-use') msg = "该邮箱已被注册";
      if (error.code === 'auth/weak-password') msg = "密码太弱";
      throw new Error(msg);
    }
  },

  // LOGIN: Sign in with Firebase
  login: async (email: string, password: string): Promise<User> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return mapUser(userCredential.user);
    } catch (error: any) {
      console.error("Login Error:", error);
      let msg = "登录失败";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = "邮箱或密码错误";
      }
      throw new Error(msg);
    }
  },

  // LOGOUT
  logout: async () => {
    await signOut(auth);
  },

  // SAVE: Write to Firestore users/{uid}/data
  saveData: async (data: UserCloudData): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return; // Guard clause

    try {
      // Using setDoc with merge: true to update or create
      await setDoc(doc(db, "users", currentUser.uid), {
        data: {
          ...data,
          lastSynced: Date.now()
        }
      }, { merge: true });
    } catch (e) {
      console.error("Save to Firestore failed", e);
      throw e;
    }
  },

  // LOAD: Read from Firestore users/{uid}/data
  loadData: async (): Promise<UserCloudData | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    try {
      const docRef = doc(db, "users", currentUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const record = docSnap.data();
        return record.data as UserCloudData || null;
      }
      return null;
    } catch (e) {
      console.error("Load from Firestore failed", e);
      return null;
    }
  }
};