/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

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

import { SettingsProvider, useSettings } from "./lib/SettingsContext";
import { CartProvider } from "./lib/CartContext";
import Footer from "./components/Footer";

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const { loading: settingsLoading } = useSettings();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const adminEmails = ["businessonline.6251@gmail.com", "hacklone928@gmail.com"];
        setIsAdmin(userDoc.data()?.role === "admin" || adminEmails.includes(user.email || ""));
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  if (authLoading || settingsLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 bg-indigo-100 rounded-full animate-pulse"></div>
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 animate-pulse">Loading Infrastructure</p>
    </div>
  );

  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        <motion.div 
          key="app-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="min-h-screen bg-white font-sans text-gray-900 overflow-x-hidden flex flex-col"
        >
          <Navbar user={user} isAdmin={isAdmin} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex-grow">
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
          </main>
          <Footer user={user} isAdmin={isAdmin} />
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
