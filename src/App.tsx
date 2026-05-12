/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "./lib/firestoreUtils";

import { motion, AnimatePresence } from "motion/react";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import Auth from "./pages/Auth";
import Checkout from "./pages/Checkout";
import Success from "./pages/Success";
import AdminDashboard from "./pages/AdminDashboard";
import Contact from "./pages/Contact";
import DynamicPage from "./pages/DynamicPage";
import MyProducts from "./pages/MyProducts";
import Invoice from "./pages/Invoice";
import Profile from "./pages/Profile";
import Navbar from "./components/Navbar";
import ScrollToTop from "./components/ScrollToTop";

import { SettingsProvider, useSettings } from "./lib/SettingsContext";
import { CartProvider } from "./lib/CartContext";
import Footer from "./components/Footer";

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const { settings, loading: settingsLoading } = useSettings();
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));

  useEffect(() => {
    if (settings) {
      document.title = settings.tabTitle || settings.siteName || "Digital Marketplace";
      
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = settings.faviconUrl || "/favicon.ico";
    }
  }, [settings]);

  useEffect(() => {
    const trackPresence = async () => {
      try {
        await setDoc(doc(db, "active_sessions", sessionId), {
          lastSeen: serverTimestamp(),
          uid: auth.currentUser?.uid || null,
          email: auth.currentUser?.email || null,
          path: window.location.pathname
        });
      } catch (err) {
        console.warn("Presence tracking failed:", err);
      }
    };

    trackPresence();
    const interval = setInterval(trackPresence, 30000);

    const handleBeforeUnload = () => {
      // Best effort delete on close, doesn't always work but helps
      deleteDoc(doc(db, "active_sessions", sessionId)).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      deleteDoc(doc(db, "active_sessions", sessionId)).catch(() => {});
    };
  }, [sessionId, user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const adminEmails = ["businessonline.6251@gmail.com", "hacklone928@gmail.com"];
          const role = userDoc.data()?.role;
          setIsAdmin(role === "admin" || role === "super_admin" || role === "moderator" || adminEmails.includes(user.email || ""));
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  if (authLoading || settingsLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      {/* Background purely aesthetic elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-50 rounded-full blur-[120px] opacity-50" />
      
      <div className="relative flex flex-col items-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative mb-8"
        >
          {/* Main loader circle */}
          <div className="relative w-24 h-24">
            <svg className="w-full h-full rotate-[-90deg]">
              <circle
                cx="48"
                cy="48"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-100"
              />
              <motion.circle
                cx="48"
                cy="48"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="text-indigo-600"
                initial={{ strokeDasharray: "0 283" }}
                animate={{ strokeDasharray: "200 283" }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  repeatType: "reverse"
                }}
              />
            </svg>
            
            {/* Center pulsing point */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-10 h-10 bg-indigo-600/10 rounded-2xl flex items-center justify-center p-2.5"
              >
                <div className="w-full h-full bg-indigo-600 rounded-lg" />
              </motion.div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-gray-900 mb-2 italic">
            {settings?.siteName || "Marketplace"}
          </h2>
          <div className="flex items-center gap-2 justify-center">
             <div className="h-[1px] w-4 bg-gray-200" />
             <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
               Syncing Workspace
             </p>
             <div className="h-[1px] w-4 bg-gray-200" />
          </div>
        </motion.div>

        {/* Ambient progress indicator */}
        <div className="absolute bottom-[-60px] w-48 h-1 bg-gray-50 rounded-full overflow-hidden">
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-full h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
          />
        </div>
      </div>
    </div>
  );

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <motion.div 
          key="app-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="min-h-screen bg-white font-sans text-gray-900 overflow-x-hidden flex flex-col"
        >
          <Navbar user={user} isAdmin={isAdmin} />
    <div className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/checkout/:id" element={<Checkout user={user} />} />
        <Route path="/cart-checkout" element={<Checkout user={user} isCartCheckout />} />
        <Route path="/success" element={<Success />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/p/:slug" element={<DynamicPage />} />
        <Route path="/my-products" element={<MyProducts />} />
        <Route path="/invoice/:orderId" element={<Invoice />} />
        <Route path="/profile" element={user ? <Profile /> : <Navigate to="/auth" />} />
        <Route 
          path="/admin" 
          element={isAdmin ? <AdminDashboard /> : <Navigate to="/" />} 
        />
      </Routes>
    </div>
          <Footer />
        </motion.div>
      </AnimatePresence>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </SettingsProvider>
  );
}
