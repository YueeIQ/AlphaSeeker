import { supabase } from "./supabase";
import { User, UserCloudData } from "../types";

// Helper to map Supabase User to our App User
const mapUser = (sbUser: any): User => ({
  uid: sbUser.id,
  email: sbUser.email || "",
  name: sbUser.email ? sbUser.email.split('@')[0] : "User"
});

export const AuthService = {
  // Listen to auth state changes (Observer)
  onAuthStateChange: (callback: (user: User | null) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        callback(mapUser(session.user));
      } else {
        callback(null);
      }
    });
    
    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  },

  // REGISTER: Create Auth User
  register: async (email: string, password: string): Promise<User> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // If user already exists, Supabase might return a user but with an empty identities array
        if (data.user.identities && data.user.identities.length === 0) {
          throw new Error('User already registered');
        }
        return mapUser(data.user);
      }
      
      throw new Error("注册失败");
    } catch (error: any) {
      console.error("Registration Error:", error);
      let msg = "注册失败";
      if (error.message === 'User already registered') msg = "该邮箱已被注册，请直接登录";
      if (error.message.includes('weak_password') || error.message.includes('Password')) msg = "密码太弱";
      throw new Error(msg);
    }
  },

  // LOGIN: Sign in with Supabase
  login: async (email: string, password: string): Promise<User> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        return mapUser(data.user);
      }
      
      throw new Error("登录失败");
    } catch (error: any) {
      console.error("Login Error:", error);
      let msg = "登录失败";
      if (error.message.includes('Invalid login credentials')) {
        msg = "邮箱或密码错误";
      }
      throw new Error(msg);
    }
  },

  // LOGOUT
  logout: async () => {
    await supabase.auth.signOut();
  },

  // SAVE: Write to Supabase alphaseeker_user_data
  saveData: async (data: UserCloudData): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return; // Guard clause

    try {
      const { error } = await supabase
        .from('alphaseeker_user_data')
        .upsert({
          user_id: session.user.id,
          data: {
            ...data,
            lastSynced: Date.now()
          },
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (e) {
      console.error("Save to Supabase failed", e);
      throw e;
    }
  },

  // LOAD: Read from Supabase alphaseeker_user_data
  loadData: async (): Promise<UserCloudData | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    try {
      const { data, error } = await supabase
        .from('alphaseeker_user_data')
        .select('data')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found, which is fine for a new user
          return null;
        }
        throw error;
      }

      if (data && data.data) {
        return data.data as UserCloudData;
      }
      return null;
    } catch (e) {
      console.error("Load from Supabase failed", e);
      return null;
    }
  }
};