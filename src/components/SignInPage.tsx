import React, { useState, useEffect } from 'react';
import { auth } from '@/config/firebase';
import { signInAnonymously, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Cloud, CloudOff, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

interface SignInPageProps {
  onMigrationComplete?: () => void;
}

export const SignInPage: React.FC<SignInPageProps> = ({ onMigrationComplete }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
      if (user && onMigrationComplete) {
        // Trigger migration check when user signs in
        onMigrationComplete();
      }
    });

    return () => unsubscribe();
  }, [onMigrationComplete]);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInAnonymously(auth);
      toast.success('Signed in successfully! Your data will now sync to the cloud.');
      console.log('Anonymous sign-in successful:', result.user.uid);
    } catch (error) {
      console.error('Sign-in error:', error);
      toast.error('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      toast.success('Signed out successfully. Data will be saved locally only.');
    } catch (error) {
      console.error('Sign-out error:', error);
      toast.error('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return null; // Don't render anything while checking auth state
  }

  return (
    <div className="flex items-center gap-2">
      {user ? (
        <>
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Cloud className="h-4 w-4" />
            <span>Cloud sync active</span>
          </div>
          <Button
            onClick={handleSignOut}
            disabled={loading}
            variant="ghost"
            size="sm"
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CloudOff className="h-4 w-4" />
            <span>Local only</span>
          </div>
          <Button
            onClick={handleSignIn}
            disabled={loading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <LogIn className="h-4 w-4" />
            Enable Cloud Save
          </Button>
        </>
      )}
    </div>
  );
};

export default SignInPage;