import React, { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { User, MapPin, Mail, Save, CheckCircle2, Loader2, ArrowLeft, Database, Copy, Check, Gift, BarChart3, TrendingUp, Package, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    address: "",
    bonusBalance: 0,
    paymentAccounts: {
      bkash: "",
      nagad: ""
    }
  });
  const [coupons, setCoupons] = useState<any[]>([]);
  const [affiliateStats, setAffiliateStats] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<"bkash" | "nagad">("bkash");

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
            bonusBalance: data.bonusBalance || 0,
            paymentAccounts: data.paymentAccounts || { bkash: "", nagad: "" }
          });
        } else {
          setProfile({
            name: auth.currentUser.displayName || "",
            address: "",
            bonusBalance: 0,
            paymentAccounts: { bkash: "", nagad: "" }
          });
        }

        // Fetch assigned coupons
        if (auth.currentUser.email) {
          const email = auth.currentUser.email.toLowerCase().trim();
          const q = query(
            collection(db, "coupons"),
            where("assignedEmail", "==", email),
            where("isActive", "==", true)
          );
          const querySnap = await getDocs(q);
          const userCoupons = querySnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          setCoupons(userCoupons);

          // Fetch affiliate orders for stats
          const oq = query(
            collection(db, "orders"),
            where("bonusAssigneeEmail", "==", email)
          );
          const orderSnap = await getDocs(oq);
          const orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

          // Aggregate product-wise stats
          const productMap = new Map();
          let totalSales = 0;

          orders.forEach((order: any) => {
            if (order.status !== 'completed' && order.status !== 'delivered') return;
            
            totalSales += (order.grossAmount || order.amount || 0);
            const productId = order.productId;
            if (!productId) return;

            if (!productMap.has(productId)) {
              // Find the coupon rate for this product/user context if possible
              const relevantCoupon = userCoupons.find((c: any) => c.code === order.couponCode);
              
              productMap.set(productId, {
                name: order.productName || 'Product',
                id: productId,
                sold: 0,
                bonus: 0,
                rate: relevantCoupon ? (relevantCoupon.bonusPercentage > 0 ? `${relevantCoupon.bonusPercentage}%` : `৳${relevantCoupon.bonusAmount}`) : 'Fixed'
              });
            }

            const stats = productMap.get(productId);
            stats.sold++;
            stats.bonus += (order.bonusAmountGiven || 0);
          });

          setAffiliateStats(Array.from(productMap.values()).sort((a, b) => b.bonus - a.bonus));
          
          const sortedOrders = orders.sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return dateB.getTime() - dateA.getTime();
          });

          const ordersWithRate = sortedOrders.map((order: any) => {
            const relevantCoupon = userCoupons.find((c: any) => c.code === order.couponCode);
            return {
              ...order,
              rate: relevantCoupon ? (relevantCoupon.bonusPercentage > 0 ? `${relevantCoupon.bonusPercentage}%` : `৳${relevantCoupon.bonusAmount}`) : null
            };
          });

          setRecentOrders(ordersWithRate.slice(0, 15));
        }

      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

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
        paymentAccounts: profile.paymentAccounts,
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

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (amount > profile.bonusBalance) {
      alert("Insufficient bonus balance.");
      return;
    }

    const accountNumber = profile.paymentAccounts[withdrawMethod];
    if (!accountNumber) {
      alert(`Please save your ${withdrawMethod} number first.`);
      return;
    }

    try {
      setSaving(true);
      await addDoc(collection(db, "withdrawals"), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        amount: amount,
        method: withdrawMethod,
        accountNumber: accountNumber,
        status: "pending",
        createdAt: serverTimestamp()
      });

      alert("Withdrawal request submitted successfully!");
      setIsWithdrawing(false);
      setWithdrawAmount("");
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      alert("Failed to submit withdrawal request.");
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
    <div className="min-h-screen bg-transparent py-4 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-8 px-4 sm:px-0">
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

        {/* Bonus Balance & Payments */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-[32px] border border-indigo-50 shadow-xl shadow-indigo-100/30"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-tight">Bonus Wallet</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Withdraw earned bonuses</p>
                </div>
              </div>
              <button 
                onClick={() => setIsWithdrawing(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
              >
                Withdraw
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Available Balance</span>
              <div className="text-4xl font-black text-emerald-600 tracking-tighter">৳{profile.bonusBalance.toLocaleString()}</div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-50 flex items-center gap-4">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full border-2 border-white bg-indigo-50 flex items-center justify-center p-1 font-black text-[8px] text-indigo-600">BK</div>
                <div className="w-8 h-8 rounded-full border-2 border-white bg-pink-50 flex items-center justify-center p-1 font-black text-[8px] text-pink-600">NG</div>
              </div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Instant disbursement once approved</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-[32px] border border-indigo-50 shadow-xl shadow-indigo-100/30"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Save className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-tight">Withdrawal Accounts</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Save your bKash & Nagad info</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">bKash Number</label>
                <input 
                  type="text"
                  placeholder="017xxxxxxxx"
                  value={profile.paymentAccounts.bkash}
                  onChange={e => setProfile({...profile, paymentAccounts: {...profile.paymentAccounts, bkash: e.target.value}})}
                  className="w-full bg-gray-50 border-none rounded-xl px-5 py-3 text-xs font-bold text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Nagad Number</label>
                <input 
                  type="text"
                  placeholder="017xxxxxxxx"
                  value={profile.paymentAccounts.nagad}
                  onChange={e => setProfile({...profile, paymentAccounts: {...profile.paymentAccounts, nagad: e.target.value}})}
                  className="w-full bg-gray-50 border-none rounded-xl px-5 py-3 text-xs font-bold text-gray-900"
                />
              </div>
            </div>
          </motion.div>
        </section>

        {coupons.length > 0 && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Affiliate Partner Hub</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Growth analytics & reward tracking</p>
                </div>
              </div>
            </div>

            {/* Partner Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
               {[
                 { label: "Commission Earned", value: `৳${profile.bonusBalance.toLocaleString()}`, icon: Database, color: "text-emerald-600", bg: "bg-emerald-50" },
                 { label: "Coupons Active", value: coupons.length, icon: Gift, color: "text-pink-600", bg: "bg-pink-50" },
                 { label: "Products Sold", value: affiliateStats.reduce((s, a) => s + a.sold, 0), icon: Package, color: "text-amber-600", bg: "bg-amber-50" },
               ].map((s, i) => (
                 <div key={i} className="bg-white p-5 rounded-3xl border border-indigo-50 shadow-sm relative group overflow-hidden">
                    <div className={cn("p-2 rounded-xl inline-flex mb-3 transition-transform group-hover:scale-110", s.bg, s.color)}>
                      <s.icon className="w-4 h-4" />
                    </div>
                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</div>
                    <div className="text-lg font-black text-gray-900 tracking-tight">{s.value}</div>
                 </div>
               ))}
            </div>

            {/* Performance breakdown */}
            {affiliateStats.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                 <div className="lg:col-span-3 bg-white p-8 rounded-[40px] border border-indigo-50 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                       <BarChart3 className="w-5 h-5 text-indigo-600" />
                       <h4 className="font-bold text-gray-900 uppercase text-xs tracking-widest">Earnings by Product</h4>
                    </div>
                    <div className="h-[250px]">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={affiliateStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" hide />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                            <Tooltip 
                               contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                               itemStyle={{ fontWeight: 900 }}
                            />
                            <Bar dataKey="bonus" name="Bonus Earned" fill="#4f46e5" radius={[8, 8, 0, 0]}>
                               {affiliateStats.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'][index % 5]} />
                               ))}
                            </Bar>
                         </BarChart>
                       </ResponsiveContainer>
                    </div>
                 </div>

                 <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <Package className="w-5 h-5 text-amber-600" />
                       <h4 className="font-bold text-gray-900 uppercase text-xs tracking-widest">Earnings by Product</h4>
                    </div>
                    <div className="space-y-3">
                       {affiliateStats.slice(0, 10).map((item, idx) => (
                         <div key={idx} className="bg-white p-4 rounded-3xl border border-gray-100 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                            <div className="flex items-center gap-3 overflow-hidden">
                               <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center font-mono font-black text-xs text-gray-400 group-hover:text-indigo-600 transition-colors flex-shrink-0">
                                  {idx + 1}
                               </div>
                               <div className="min-w-0">
                                  <div className="text-[11px] font-black text-gray-900 uppercase tracking-tight truncate">{item.name}</div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-[9px] font-bold text-gray-400 shrink-0">{item.sold} units sold</div>
                                    <div className="w-1 h-1 rounded-full bg-gray-200" />
                                    <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{item.rate} Bonus</div>
                                  </div>
                               </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                               <div className="text-sm font-black text-emerald-600">৳{item.bonus.toLocaleString()}</div>
                               <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Commission</div>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            )}

            {/* Detailed Sales List */}
            {recentOrders.length > 0 && (
              <div className="bg-white p-8 rounded-[40px] border border-indigo-50 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-indigo-600" />
                    <h4 className="font-bold text-gray-900 uppercase text-xs tracking-widest">Recent Conversions</h4>
                  </div>
                  <div className="text-[10px] font-bold text-gray-400">Showing last 15 sales</div>
                </div>
                <div className="overflow-x-auto -mx-8 px-8">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Product</th>
                        <th className="text-center py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                        <th className="text-center py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                        <th className="text-right py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentOrders.map((order, idx) => (
                        <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="py-4">
                            <div className="text-xs font-bold text-gray-900 truncate max-w-[150px]">{order.productName || 'Product'}</div>
                            <div className="flex items-center gap-2">
                              <div className="text-[9px] font-black text-indigo-500 uppercase">Code: {order.couponCode || 'N/A'}</div>
                              {order.rate && (
                                <>
                                  <div className="w-1 h-1 rounded-full bg-gray-200" />
                                  <div className="text-[9px] font-black text-emerald-500 uppercase">{order.rate} Bonus</div>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-4 text-center text-[10px] font-medium text-gray-500 whitespace-nowrap px-4">
                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-4 text-center">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                              order.status === 'completed' || order.status === 'delivered' 
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : order.status === 'pending'
                                ? "bg-amber-50 text-amber-600 border border-amber-100"
                                : "bg-gray-50 text-gray-400 border border-gray-100"
                            )}>
                              {order.status}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                             <div className="text-xs font-black text-indigo-600">৳{(order.bonusAmountGiven || 0).toLocaleString()}</div>
                             {order.status !== 'completed' && order.status !== 'delivered' && (
                               <div className="text-[7px] font-bold text-amber-500 uppercase tracking-tighter">Estimated</div>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {coupons.map(coupon => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={coupon.id}
                  className="bg-white p-6 rounded-3xl border border-indigo-50 shadow-xl shadow-indigo-100/20 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-3">
                    <button 
                      onClick={() => copyToClipboard(coupon.code)}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all active:scale-90"
                    >
                      {copiedCode === coupon.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-900 text-white rounded-xl flex items-center justify-center">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-lg font-black text-gray-900 tracking-tight select-all">{coupon.code}</div>
                        <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{coupon.type} OFF</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-end pt-4 border-t border-gray-50">
                      <div>
                        <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Reward Value</div>
                        <div className="text-2xl font-black text-indigo-600">
                          {coupon.type === 'percentage' ? `${coupon.value}%` : `৳${coupon.value.toLocaleString()}`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Your Bonus</div>
                        <div className="text-xl font-black text-emerald-600">
                          {coupon.bonusPercentage > 0 
                            ? `${coupon.bonusPercentage}%` 
                            : `৳${(coupon.bonusAmount || 0).toLocaleString()}`}
                          <span className="text-[10px] text-gray-400 ml-1">/{coupon.bonusPercentage > 0 ? "sale" : "use"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Valid Until</div>
                        <div className="text-[10px] font-bold text-gray-900">
                          {new Date(coupon.expiryDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

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
      {/* Withdrawal Modal */}
      {isWithdrawing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-gray-50">
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Withdraw Funds</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Available: ৳{profile.bonusBalance}</p>
            </div>

            <form onSubmit={handleWithdrawalRequest} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount to Withdraw</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    max={profile.bonusBalance}
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => setWithdrawMethod("bkash")}
                      className={cn(
                        "py-4 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all",
                        withdrawMethod === "bkash" ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-gray-50 text-gray-400"
                      )}
                    >
                      bKash
                    </button>
                    <button 
                      type="button"
                      onClick={() => setWithdrawMethod("nagad")}
                      className={cn(
                        "py-4 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all",
                        withdrawMethod === "nagad" ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-gray-50 text-gray-400"
                      )}
                    >
                      Nagad
                    </button>
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 italic text-[9px] text-amber-700 font-bold">
                  Funds will be sent to the saved {withdrawMethod} number in your profile.
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsWithdrawing(false)}
                  className="flex-1 py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving || !withdrawAmount || Number(withdrawAmount) > profile.bonusBalance}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                >
                  {saving ? "Processing..." : "Confirm Request"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
