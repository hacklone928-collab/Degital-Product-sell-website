/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import ThemeToggle from "./components/ThemeToggle";
import { cn } from "./lib/utils";
import ScrollToTop from "./components/ScrollToTop";
import FloatingChat from "./components/FloatingChat";

import { SettingsProvider, useSettings } from "./lib/SettingsContext";
import { CartProvider } from "./lib/CartContext";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";
import Footer from "./components/Footer";

function AppContent() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const { settings, loading: settingsLoading } = useSettings();
  const { theme } = useTheme();
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));

  const isWideAdmin = location.pathname.startsWith("/admin");

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

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!authLoading && !settingsLoading) {
      // Direct transition once ready
      setIsReady(true);
    }
  }, [authLoading, settingsLoading]);

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        {!isReady ? (
          <motion.div 
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-950 overflow-hidden font-sans"
          >
            {/* Background purely aesthetic elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] opacity-50" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-50 rounded-full blur-[120px] opacity-50" />
            
            <div className="relative flex flex-col items-center">
              {settings?.loadingStyle === "classic" ? (
                <div className="mb-8">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-gray-100 rounded-full" />
                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
              ) : settings?.loadingStyle === "minimal" ? (
                <div className="mb-10">
                   <motion.div 
                     animate={{ opacity: [0.3, 1, 0.3] }}
                     transition={{ duration: 2, repeat: Infinity }}
                     className="h-0.5 w-24 bg-indigo-600 rounded-full"
                   />
                </div>
              ) : settings?.loadingStyle === "bento" ? (
                <div className="mb-10 flex gap-1.5 h-16 items-center">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ 
                        height: [20, 50, 20],
                        backgroundColor: i === 1 ? ["#4f46e5", "#818cf8", "#4f46e5"] : ["#e5e7eb", "#4f46e5", "#e5e7eb"]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="w-4 rounded-full bg-gray-200"
                    />
                  ))}
                </div>
              ) : settings?.loadingStyle === "waves" ? (
                <div className="mb-10 relative w-32 h-12 flex items-center justify-center overflow-hidden">
                  <svg viewBox="0 0 120 28" className="w-full fill-indigo-600/30">
                     <motion.path 
                       animate={{ x: [-120, 0] }}
                       transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                       d="M0 15 Q 30 0 60 15 Q 90 30 120 15 V 30 H 0 Z" 
                     />
                     <motion.path 
                       animate={{ x: [0, -120] }}
                       transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                       d="M0 15 Q 30 30 60 15 Q 90 0 120 15 V 30 H 0 Z" 
                       className="fill-indigo-600"
                     />
                  </svg>
                </div>
              ) : settings?.loadingStyle === "dots" ? (
                <div className="mb-10 flex gap-3">
                  {[0, 1, 2].map((i) => (
                    <motion.div 
                      key={i}
                      animate={{ 
                        y: [0, -12, 0],
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      className="w-3 h-3 bg-indigo-600 rounded-full"
                    />
                  ))}
                </div>
              ) : settings?.loadingStyle === "cube" ? (
                <div className="mb-12 relative w-16 h-16" style={{ perspective: '800px' }}>
                  <motion.div
                    animate={{ 
                      rotateX: [0, 90, 180, 270, 360],
                      rotateY: [0, 90, 180, 270, 360]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full relative"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div 
                        key={i}
                        className="absolute inset-0 border-2 border-indigo-600 bg-indigo-50/20"
                        style={{
                           transform: i < 4 
                             ? `rotateY(${i * 90}deg) translateZ(32px)` 
                             : `rotateX(${i === 4 ? 90 : -90}deg) translateZ(32px)`
                        }}
                      />
                    ))}
                  </motion.div>
                </div>
              ) : settings?.loadingStyle === "bars" ? (
                <div className="mb-10 flex items-end gap-1.5 h-10">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ scaleY: [0.3, 1, 0.3] }}
                      transition={{ 
                        duration: 0.8, 
                        repeat: Infinity, 
                        delay: i * 0.1,
                        ease: "easeInOut" 
                      }}
                      className="w-2.5 bg-indigo-600 rounded-full origin-bottom h-full"
                    />
                  ))}
                </div>
              ) : settings?.loadingStyle === "ring" ? (
                <div className="mb-10 relative w-20 h-20">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0.5, opacity: 0.8 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity, 
                        delay: i * 0.6,
                        ease: "easeOut"
                      }}
                      className="absolute inset-0 border-2 border-indigo-600 rounded-full"
                    />
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center">
                     <motion.div 
                       animate={{ scale: [1, 1.3, 1] }}
                       transition={{ duration: 2, repeat: Infinity }}
                       className="w-4 h-4 bg-indigo-600 rounded-full shadow-lg shadow-indigo-200" 
                     />
                  </div>
                </div>
              ) : (
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
              )}
 
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-gray-900 mb-2 italic">
                  {settings?.loadingTitle || "Digital Marketplace"}
                </h2>
                <div className="flex items-center gap-2 justify-center">
                   <div className="h-[1px] w-4 bg-gray-200" />
                   <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                     {settings?.loadingSubtitle || "Syncing Workspace"}
                   </p>
                   <div className="h-[1px] w-4 bg-gray-200" />
                </div>
              </motion.div>
 
              {/* Ambient progress indicator */}
              {settings?.loadingStyle !== "classic" && (
                <div className="absolute bottom-[-60px] w-48 h-1 bg-gray-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
                  />
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="app-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="min-h-screen bg-[#F8F9FC] dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 overflow-x-hidden flex flex-col"
          >
            <Navbar user={user} isAdmin={isAdmin} />
            
            <div className={cn(
              "flex-grow w-full mx-auto py-4 sm:py-8 transition-all duration-300",
              isWideAdmin 
                ? "max-w-none px-2 sm:px-6 lg:px-8" 
                : "max-w-7xl px-4 sm:px-6 lg:px-8"
            )}>
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
            <FloatingChat />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SettingsProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </SettingsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
