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

    // Listen to Firebase (PRIMARY)
    let unsubscribeFirebase = () => {};
    if (firebaseAuth) {
      unsubscribeFirebase = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          currentUser = mapFirebaseUser(user);
          callback(currentUser);
        } else {
          // If Firebase logs out, check if Supabase is still logged in
          try {
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (!session?.user) {
                currentUser = null;
                callback(null);
              }
            }).catch(() => {
              currentUser = null;
              callback(null);
            });
          } catch (e) {
            currentUser = null;
            callback(null);
          }
        }
      });
    }

    // Listen to Supabase (FALLBACK)
    let subscription: any = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          // Only use Supabase user if Firebase hasn't already logged in
          if (!firebaseAuth?.currentUser) {
            currentUser = mapSupabaseUser(session.user);
            callback(currentUser);
          }
        } else {
          // If Supabase logs out, check if Firebase is still logged in
          if (!firebaseAuth || !firebaseAuth.currentUser) {
            currentUser = null;
            callback(null);
          }
        }
      });
      subscription = data.subscription;
    } catch (e) {
      console.error("Supabase auth listener failed (Project might be expired):", e);
    }
    
    // Return unsubscribe function
    return () => {
      if (subscription) subscription.unsubscribe();
      unsubscribeFirebase();
    };
  },

  // REGISTER: Create Auth User
  register: async (email: string, password: string): Promise<User> => {
    let fbUser: User | null = null;
    let sbUser: User | null = null;
    let lastError: any = null;

    // 1. Try Firebase (PRIMARY)
    if (firebaseAuth) {
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
    }

    // 2. Try Supabase (FALLBACK)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        if (data.user.identities && data.user.identities.length === 0) {
          if (!lastError) lastError = new Error('User already registered');
        } else {
          sbUser = mapSupabaseUser(data.user);
        }
      }
    } catch (error: any) {
      console.error("Supabase Registration Error (Project might be expired):", error);
      if (!lastError) lastError = error;
    }

    if (fbUser) return fbUser; // Prefer Firebase
    if (sbUser) return sbUser; // Fallback to Supabase

    let msg = "注册失败";
    if (lastError?.message === 'User already registered') msg = "该邮箱已被注册，请直接登录";
    if (lastError?.message?.includes('weak_password') || lastError?.message?.includes('Password') || lastError?.code === 'auth/weak-password') msg = "密码太弱";
    throw new Error(msg);
  },

  // LOGIN: Sign in
  login: async (email: string, password: string): Promise<User> => {
    let fbUser: User | null = null;
    let sbUser: User | null = null;
    let lastError: any = null;

    // 1. Try Firebase (PRIMARY)
    if (firebaseAuth) {
      try {
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        fbUser = mapFirebaseUser(userCredential.user);
      } catch (error: any) {
        console.error("Firebase Login Error:", error);
        lastError = error;
      }
    }

    // 2. Try Supabase (FALLBACK)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) sbUser = mapSupabaseUser(data.user);
    } catch (error: any) {
      console.error("Supabase Login Error (Project might be expired):", error);
      if (!lastError) lastError = error;
    }

    if (fbUser) return fbUser; // Prefer Firebase
    if (sbUser) return sbUser; // Fallback to Supabase

    let msg = "登录失败";
    if (lastError?.message?.includes('Invalid login credentials') || lastError?.code === 'auth/invalid-credential' || lastError?.code === 'auth/user-not-found' || lastError?.code === 'auth/wrong-password') {
      msg = "邮箱或密码错误";
    }
    throw new Error(msg);
  },

  // LOGOUT
  logout: async () => {
    const promises: Promise<any>[] = [];
    if (firebaseAuth) {
      promises.push(signOut(firebaseAuth));
    }
    try {
      promises.push(supabase.auth.signOut());
    } catch (e) {
      console.error("Supabase logout error:", e);
    }
    await Promise.allSettled(promises);
  },

  // SAVE: Write to both databases
  saveData: async (data: UserCloudData): Promise<void> => {
    const promises: Promise<any>[] = [];

    // 1. Save to Firebase (PRIMARY)
    if (firebaseAuth && firebaseDb && firebaseAuth.currentUser) {
      promises.push(
        setDoc(doc(firebaseDb, 'alphaseeker_user_data', firebaseAuth.currentUser.uid), {
          data: { ...data, lastSynced: Date.now() },
          updated_at: new Date().toISOString()
        })
      );
    }

    // 2. Save to Supabase (FALLBACK)
    try {
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
    } catch (e) {
      console.error("Supabase getSession failed (Project might be expired):", e);
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
    let fbData: UserCloudData | null = null;
    let sbData: UserCloudData | null = null;

    // 1. Try Firebase (PRIMARY)
    if (firebaseAuth && firebaseDb && firebaseAuth.currentUser) {
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

    // 2. Try Supabase (FALLBACK)
    try {
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
    } catch (e) {
      console.error("Supabase getSession failed (Project might be expired):", e);
    }

    // Return the one with the latest lastSynced. If equal or only one exists, prefer Firebase.
    if (fbData && sbData) {
      return (fbData.lastSynced || 0) >= (sbData.lastSynced || 0) ? fbData : sbData;
    }
    
    return fbData || sbData || null;
  }
};