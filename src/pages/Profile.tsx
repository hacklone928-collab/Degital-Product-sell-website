import React, { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { User, MapPin, Mail, Save, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    address: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, "users", auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            name: data.name || auth.currentUser.displayName || "",
            address: data.address || "",
          });
        } else {
          setProfile({
            name: auth.currentUser.displayName || "",
            address: "",
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setSaving(true);
    setSuccess(false);
    
    try {
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        name: profile.name,
        address: profile.address,
        email: auth.currentUser.email,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-indigo-600 font-bold transition-colors group text-sm">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl shadow-indigo-100/50 border border-indigo-50 overflow-hidden"
        >
          <div className="p-6 sm:p-12 bg-indigo-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="relative flex items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 sm:w-24 sm:h-24 bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-[32px] border border-white/20 flex items-center justify-center p-1">
                <div className="w-full h-full bg-white rounded-xl sm:rounded-[28px] flex items-center justify-center">
                  <User className="w-8 h-8 sm:w-12 sm:h-12 text-indigo-600" />
                </div>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <h1 className="text-xl sm:text-4xl font-black tracking-tight uppercase">User Profile</h1>
                <p className="text-indigo-200 text-[10px] sm:text-sm font-medium tracking-wide">Manage your info</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdate} className="p-6 sm:p-12 space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 gap-6 sm:gap-8">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Mail className="w-3 h-3" /> Email Address
                </label>
                <input 
                  type="email"
                  value={auth.currentUser?.email || ""}
                  readOnly
                  className="w-full bg-gray-50 border-none rounded-xl sm:rounded-2xl px-5 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm font-bold text-gray-400 cursor-not-allowed"
                />
                <p className="text-[9px] text-gray-400 italic ml-2">Email cannot be changed.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <User className="w-3 h-3 text-indigo-600" /> Full Name
                </label>
                <input 
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({...profile, name: e.target.value})}
                  placeholder="Enter your full name"
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white focus:ring-0 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm font-bold text-gray-900 transition-all placeholder:text-gray-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-indigo-600" /> Delivery Address
                </label>
                <textarea 
                  rows={3}
                  value={profile.address}
                  onChange={(e) => setProfile({...profile, address: e.target.value})}
                  placeholder="Street, City, State, ZIP, Country"
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white focus:ring-0 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm font-bold text-gray-900 transition-all placeholder:text-gray-300 resize-none"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={saving}
                className={cn(
                  "w-full sm:w-auto min-w-[180px] py-4 sm:py-5 px-8 rounded-2xl sm:rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-xl active:scale-95",
                  success 
                    ? "bg-emerald-500 text-white shadow-emerald-100" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                )}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : success ? (
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
                {saving ? "Saving..." : success ? "Profile Saved" : "Update Profile"}
              </button>
            </div>
          </form>
        </motion.div>

        <div className="bg-indigo-50/50 p-6 rounded-[32px] border border-indigo-100 flex items-start gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-indigo-900">Delivery Information</h4>
            <p className="text-xs text-indigo-600/70 font-medium leading-relaxed mt-1">
              Your saved address will be automatically used during checkout for faster processing of your orders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
