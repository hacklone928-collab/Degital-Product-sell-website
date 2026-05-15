import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, googleProvider } from "../lib/firebase";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestoreUtils";
import { Mail, Lock, User, Github, Chrome } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            role: "user",
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError("Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        try {
          await setDoc(doc(db, "users", result.user.uid), {
            uid: result.user.uid,
            email,
            displayName: name,
            role: "user",
            createdAt: new Date().toISOString(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${result.user.uid}`);
        }
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-950 rounded-[32px] sm:rounded-[40px] shadow-2xl shadow-indigo-100 dark:shadow-none border border-gray-100 dark:border-gray-800 p-6 sm:p-12 w-full max-w-md relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 sm:h-2 bg-indigo-600" />
        
        <div className="space-y-6 sm:space-y-8">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              {isLogin ? "Welcome Back" : "Connect with Us"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 sm:mt-2">
              {isLogin ? "Enter your credentials to access your account" : "Create an account to start buying assets"}
            </p>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 sm:gap-3 px-4 py-2.5 sm:py-3 border border-gray-200 dark:border-gray-800 rounded-xl sm:rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-all font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-200"
            >
              <Chrome className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
              Continue with Google
            </button>
            
            <div className="relative flex items-center gap-3 text-gray-400 dark:text-gray-500 text-xs uppercase font-bold tracking-widest py-2">
              <div className="flex-grow h-px bg-gray-100 dark:bg-gray-800" />
              or use email
              <div className="flex-grow h-px bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3 sm:space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input 
                    type="text" 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-gray-50 dark:bg-gray-900 border border-transparent dark:border-gray-800 rounded-xl sm:rounded-2xl focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 transition-all outline-none text-sm dark:text-white"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-gray-50 dark:bg-gray-900 border border-transparent dark:border-gray-800 rounded-xl sm:rounded-2xl focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 transition-all outline-none text-sm dark:text-white"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-gray-50 dark:bg-gray-900 border border-transparent dark:border-gray-800 rounded-xl sm:rounded-2xl focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 transition-all outline-none text-sm dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-[10px] ml-1">{error}</p>}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 sm:py-4 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
            >
              {loading ? "Processing..." : (isLogin ? "Sign In" : "Create Account")}
            </button>
          </form>

          <div className="text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
