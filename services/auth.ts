import { supabase } from "./supabase";
import { firebaseAuth, firebaseDb } from "./firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { User, UserCloudData } from "../types";

// Helper to map Supabase User to our App User
const mapSupabaseUser = (sbUser: any): User => ({
  uid: sbUser.id,
  email: sbUser.email || "",
  name: sbUser.email ? sbUser.email.split('@')[0] : "User"
});

// Helper to map Firebase User to our App User
const mapFirebaseUser = (fbUser: any): User => ({
  uid: fbUser.uid,
  email: fbUser.email || "",
  name: fbUser.email ? fbUser.email.split('@')[0] : "User"
});

export const AuthService = {
  // Listen to auth state changes (Observer)
  onAuthStateChange: (callback: (user: User | null) => void) => {
    let currentUser: User | null = null;

    // Listen to Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        currentUser = mapSupabaseUser(session.user);
        callback(currentUser);
      } else {
        // If Supabase logs out, check if Firebase is still logged in
        if (!firebaseAuth.currentUser) {
          currentUser = null;
          callback(null);
        }
      }
    });

    // Listen to Firebase
    const unsubscribeFirebase = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        currentUser = mapFirebaseUser(user);
        callback(currentUser);
      } else {
        // If Firebase logs out, check if Supabase is still logged in
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session?.user) {
            currentUser = null;
            callback(null);
          }
        });
      }
    });
    
    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
      unsubscribeFirebase();
    };
  },

  // REGISTER: Create Auth User
  register: async (email: string, password: string): Promise<User> => {
    let sbUser: User | null = null;
    let fbUser: User | null = null;
    let lastError: any = null;

    // Try Supabase
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        if (data.user.identities && data.user.identities.length === 0) {
          throw new Error('User already registered');
        }
        sbUser = mapSupabaseUser(data.user);
      }
    } catch (error: any) {
      console.error("Supabase Registration Error:", error);
      lastError = error;
    }

    // Try Firebase
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      fbUser = mapFirebaseUser(userCredential.user);
    } catch (error: any) {
      console.error("Firebase Registration Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        lastError = new Error('User already registered');
      } else {
        lastError = error;
      }
    }

    if (sbUser) return sbUser;
    if (fbUser) return fbUser;

    let msg = "注册失败";
    if (lastError?.message === 'User already registered') msg = "该邮箱已被注册，请直接登录";
    if (lastError?.message?.includes('weak_password') || lastError?.message?.includes('Password') || lastError?.code === 'auth/weak-password') msg = "密码太弱";
    throw new Error(msg);
  },

  // LOGIN: Sign in
  login: async (email: string, password: string): Promise<User> => {
    let sbUser: User | null = null;
    let fbUser: User | null = null;
    let lastError: any = null;

    // Try Supabase
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) sbUser = mapSupabaseUser(data.user);
    } catch (error: any) {
      console.error("Supabase Login Error:", error);
      lastError = error;
    }

    // Try Firebase
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      fbUser = mapFirebaseUser(userCredential.user);
    } catch (error: any) {
      console.error("Firebase Login Error:", error);
      lastError = error;
    }

    if (sbUser) return sbUser;
    if (fbUser) return fbUser;

    let msg = "登录失败";
    if (lastError?.message?.includes('Invalid login credentials') || lastError?.code === 'auth/invalid-credential' || lastError?.code === 'auth/user-not-found' || lastError?.code === 'auth/wrong-password') {
      msg = "邮箱或密码错误";
    }
    throw new Error(msg);
  },

  // LOGOUT
  logout: async () => {
    await Promise.allSettled([
      supabase.auth.signOut(),
      signOut(firebaseAuth)
    ]);
  },

  // SAVE: Write to both databases
  saveData: async (data: UserCloudData): Promise<void> => {
    const promises: Promise<any>[] = [];

    // Save to Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      promises.push(
        supabase
          .from('alphaseeker_user_data')
          .upsert({
            user_id: session.user.id,
            data: { ...data, lastSynced: Date.now() },
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' }) as unknown as Promise<any>
      );
    }

    // Save to Firebase
    if (firebaseAuth.currentUser) {
      promises.push(
        setDoc(doc(firebaseDb, 'alphaseeker_user_data', firebaseAuth.currentUser.uid), {
          data: { ...data, lastSynced: Date.now() },
          updated_at: new Date().toISOString()
        })
      );
    }

    if (promises.length === 0) return;

    const results = await Promise.allSettled(promises);
    const hasSuccess = results.some(r => r.status === 'fulfilled');
    
    if (!hasSuccess) {
      console.error("Save to both databases failed", results);
      throw new Error("云端同步失败，请检查网络连接");
    }
  },

  // LOAD: Read from Supabase or Firebase
  loadData: async (): Promise<UserCloudData | null> => {
    let sbData: UserCloudData | null = null;
    let fbData: UserCloudData | null = null;

    // Try Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        const { data, error } = await supabase
          .from('alphaseeker_user_data')
          .select('data')
          .eq('user_id', session.user.id)
          .single();

        if (!error && data?.data) {
          sbData = data.data as UserCloudData;
        }
      } catch (e) {
        console.error("Load from Supabase failed", e);
      }
    }

    // Try Firebase
    if (firebaseAuth.currentUser) {
      try {
        const docSnap = await getDoc(doc(firebaseDb, 'alphaseeker_user_data', firebaseAuth.currentUser.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data?.data) {
            fbData = data.data as UserCloudData;
          }
        }
      } catch (e) {
        console.error("Load from Firebase failed", e);
      }
    }

    // Return the one with the latest lastSynced, or whichever is available
    if (sbData && fbData) {
      return (sbData.lastSynced || 0) > (fbData.lastSynced || 0) ? sbData : fbData;
    }
    
    return sbData || fbData || null;
  }
};