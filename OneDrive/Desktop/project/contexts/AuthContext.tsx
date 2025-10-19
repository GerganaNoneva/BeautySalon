import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync, savePushToken } from '@/lib/notifications';

type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: 'admin' | 'client';
  created_by_admin: boolean;
  phone_verified: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  needsPhoneVerification: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithFacebook: () => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any; userId: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPhoneVerification, setNeedsPhoneVerification] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, 'User ID:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    setLoading(true);
    try {
      console.log('Loading profile for userId:', userId);
      let retries = 3;
      let data = null;
      let error = null;

      while (retries > 0 && !data) {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        data = result.data;
        error = result.error;

        if (!data && retries > 1) {
          console.log(`Profile not found, retrying... (${retries - 1} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 500));
          retries--;
        } else {
          break;
        }
      }

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      if (data) {
        console.log('Profile loaded successfully:', {
          id: data.id,
          email: data.email,
          role: data.role,
          phone: data.phone,
          isAdmin: data.role === 'admin',
          createdByAdmin: data.created_by_admin,
          phoneVerified: data.phone_verified
        });
        setProfile(data);

        const isClient = data.role === 'client';
        const wasCreatedByAdmin = data.created_by_admin === true;
        const hasNoPhone = !data.phone || data.phone === '';

        console.log('Phone verification check:', {
          isClient,
          wasCreatedByAdmin,
          hasNoPhone,
          willNeedVerification: isClient && !wasCreatedByAdmin && hasNoPhone
        });

        const needsPhone = isClient && !wasCreatedByAdmin && hasNoPhone;
        setNeedsPhoneVerification(needsPhone);

        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken && userId) {
          await savePushToken(userId, pushToken);
        }
      } else {
        console.log('Profile not found after retries, will be created by trigger');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signInWithFacebook = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && data.user) {
      return { error: null, userId: data.user.id };
    }

    return { error, userId: null };
  };

  const signOut = async () => {
    console.log('Signing out...');
    setProfile(null);
    setUser(null);
    setSession(null);
    setNeedsPhoneVerification(false);
    await supabase.auth.signOut();
    console.log('Signed out successfully');
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        needsPhoneVerification,
        signIn,
        signInWithGoogle,
        signInWithFacebook,
        signUp,
        signOut,
        refreshProfile,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
