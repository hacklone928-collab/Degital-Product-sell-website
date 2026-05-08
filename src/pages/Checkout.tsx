import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User } from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, increment, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { ShieldCheck, Lock, CreditCard, ArrowLeft, Loader2, PackageCheck, Wallet, ShoppingBag, Check, Copy, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { useCart } from "../lib/CartContext";
import { useSettings } from "../lib/SettingsContext";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  const errorJson = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorJson);
  throw new Error(errorJson);
}

// Use a placeholder if not provided
// @ts-ignore
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder");

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
}

type PaymentGateway = "stripe" | "local";

export default function Checkout({ user, isCartCheckout }: { user: User | null, isCartCheckout?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items: cartItems, totalPrice: cartTotal, clearCart } = useCart();
  const { settings } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [gateway, setGateway] = useState<PaymentGateway>("stripe");
  const [isCOD, setIsCOD] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Set default payment method based on settings
  useEffect(() => {
    if (!loading && settings) {
      if (settings.enableStripe !== false) {
        setGateway("stripe");
        setIsCOD(false);
      } else if (settings.enableLocal !== false) {
        setGateway("local");
        setIsCOD(false);
      } else if (settings.enableCOD !== false) {
        setIsCOD(true);
      }
    }
  }, [loading, settings]);
  const [customerInfo, setCustomerInfo] = useState({
    name: user?.displayName || "",
    email: user?.email || "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setCustomerInfo(prev => ({
              ...prev,
              name: data.name || user.displayName || prev.name,
              email: user.email || prev.email,
              phone: data.phoneNumber || prev.phone,
              address: data.address || prev.address
            }));
          } else {
            setCustomerInfo(prev => ({
              ...prev,
              name: user.displayName || prev.name,
              email: user.email || prev.email
            }));
          }
        } catch (error) {
          console.error("Error fetching user data for checkout:", error);
        }
      }
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth", { state: { from: { pathname: isCartCheckout ? "/cart-checkout" : `/checkout/${id}` } } });
      return;
    }

    const fetchProductAndIntent = async () => {
      if (isSuccess) return;
      try {
        let checkoutProducts: Product[] = [];
        let totalAmount = 0;

        if (isCartCheckout) {
          if (cartItems.length === 0) {
            navigate("/");
            return;
          }
          // Filter out items in hidden categories from cart items for checkout
          const validCartItems = cartItems.filter(item => !(settings?.hiddenCategories || []).includes(item.category));
          if (validCartItems.length === 0) {
            navigate("/");
            return;
          }
          checkoutProducts = validCartItems;
          totalAmount = validCartItems.reduce((sum, item) => sum + item.price, 0);
        } else {
          const prodDoc = await getDoc(doc(db, "products", id!));
          if (prodDoc.exists()) {
            const prodData = { id: prodDoc.id, ...prodDoc.data() } as any;
            
            // Check if hidden
            if (settings?.hiddenCategories?.includes(prodData.category)) {
              navigate("/");
              return;
            }

            checkoutProducts = [prodData];
            totalAmount = prodData.price;
          }
        }

        setProducts(checkoutProducts);

        if (checkoutProducts.length > 0) {
          // Create Intent for Stripe
          const res = await fetch("/api/create-payment-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              productId: isCartCheckout ? null : id, 
              productIds: isCartCheckout ? checkoutProducts.map(p => p.id) : null,
              userId: user.uid,
              amount: totalAmount
            }),
          });
          const data = await res.json();
          setClientSecret(data.clientSecret);
        }
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    fetchProductAndIntent();
  }, [id, user, navigate, isCartCheckout, cartItems, cartTotal, isSuccess]);

  const subtotal = isCartCheckout ? cartTotal : (products[0]?.price || 0);
  const discountAmount = appliedCoupon 
    ? (appliedCoupon.type === "percentage" 
        ? (subtotal * appliedCoupon.value) / 100 
        : appliedCoupon.value)
    : 0;
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsValidatingCoupon(true);
    setCouponError(null);
    try {
      const q = query(collection(db, "coupons"), where("code", "==", couponCode.toUpperCase().trim()), where("isActive", "==", true));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setCouponError("Invalid coupon code.");
        setAppliedCoupon(null);
      } else {
        const couponData = snap.docs[0].data();
        const expiryDate = new Date(couponData.expiryDate);
        if (expiryDate < new Date()) {
          setCouponError("This coupon has expired.");
          setAppliedCoupon(null);
        } else {
          setAppliedCoupon({ id: snap.docs[0].id, ...couponData });
          setCouponError(null);
        }
      }
    } catch (error) {
      console.error(error);
      setCouponError("Failed to validate coupon.");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleOrderSuccess = async (orderId: string) => {
    try {
      if (appliedCoupon) {
        await updateDoc(doc(db, "coupons", appliedCoupon.id), {
          usageCount: increment(1)
        });
      }
      isCartCheckout && clearCart();
      setLastOrderId(orderId);
      setIsSuccess(true);
    } catch (error) {
      console.error("Error updating coupon usage:", error);
      // Still set success as order was created
      isCartCheckout && clearCart();
      setLastOrderId(orderId);
      setIsSuccess(true);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      console.log("Success screen triggered for order:", lastOrderId);
      window.scrollTo(0, 0);
      import("canvas-confetti").then((confetti) => {
        confetti.default({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#6366f1", "#a855f7", "#ec4899"]
        });
      });
    }
  }, [isSuccess]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      <p className="text-gray-500 font-medium">Securing checkout session...</p>
    </div>
  );

  if (products.length === 0) return (
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold text-gray-900">Checkout Error</h2>
      <p className="text-gray-500 mt-2">No products found to checkout.</p>
      <button onClick={() => navigate("/")} className="mt-6 text-indigo-600 font-bold">Return Home</button>
    </div>
  );

  if (isSuccess) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="max-w-xl mx-auto text-center space-y-8">
          <motion.div
             initial={{ scale: 0.5, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner"
          >
            <CheckCircle className="w-10 h-10" />
          </motion.div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Order Submitted!</h2>
            <p className="text-gray-500 font-medium">Your request has been sent for verification. Order ID:</p>
            <div className="inline-block bg-gray-50 border border-gray-100 px-6 py-3 rounded-2xl font-mono font-bold text-indigo-600 text-lg">
              #{lastOrderId.slice(-8).toUpperCase()}
            </div>
          </div>
  
          {/* Detailed Order Summary for Success Screen */}
          <div className="bg-white border-2 border-gray-100 rounded-[32px] overflow-hidden shadow-sm text-left">
            <div className="bg-gray-50/50 p-6 border-b border-gray-100">
               <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Order Summary</div>
               <div className="space-y-4">
                 {products.map(p => (
                   <div key={p.id} className="flex justify-between items-center">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center p-1">
                         <img src={p.imageUrl || "/placeholder.jpg"} className="w-full h-full object-cover rounded-md" />
                       </div>
                       <span className="text-sm font-bold text-gray-800">{p.name}</span>
                     </div>
                     <span className="text-sm font-mono font-bold text-gray-500">৳{p.price.toLocaleString()}</span>
                   </div>
                 ))}
                 <div className="pt-4 border-t border-gray-100 border-dashed flex justify-between items-center">
                   <span className="text-sm font-black text-gray-900 uppercase">Total Paid</span>
                   <span className="text-lg font-black text-indigo-600 font-mono">৳{totalAmount.toLocaleString()}</span>
                 </div>
               </div>
            </div>
  
            <div className="p-6 grid grid-cols-2 gap-6">
              <div>
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Customer</div>
                <div className="text-xs font-bold text-gray-800">{customerInfo.name}</div>
                <div className="text-[10px] text-gray-500">{customerInfo.phone}</div>
              </div>
              <div>
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Payment Method</div>
                <div className="text-xs font-bold text-indigo-600 uppercase">
                  {isCOD ? "Cash on Delivery" : gateway === "local" ? "Manual Local" : "Card Payment"}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Delivery Address</div>
                <div className="text-xs text-gray-600 leading-relaxed font-medium bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {customerInfo.address || "No address provided"}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50 rounded-2xl p-4 sm:p-6 border border-amber-100 space-y-3 text-left">
             <div className="flex items-center gap-2 sm:gap-3 text-amber-900 font-bold">
               <ShieldCheck className="w-5 h-5" /> Manual Verification
             </div>
             <p className="text-xs sm:text-sm text-amber-700 leading-relaxed font-medium">
               An administrator will verify your payment details shortly. Once confirmed, you will find your products in <b>"My Products"</b>.
             </p>
          </div>
  
          <div className="flex flex-col gap-4">
             <button 
               onClick={() => navigate("/my-products")}
               className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all shadow-indigo-200"
             >
               Go to My Products
             </button>
             <div className="flex gap-4">
               <button 
                 onClick={() => navigate(`/invoice/${lastOrderId}`)}
                 className="flex-grow bg-gray-50 text-gray-700 border-2 border-gray-100 py-4 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:bg-white hover:border-indigo-200 transition-all"
               >
                 View Invoice
               </button>
               <button 
                 onClick={() => navigate("/")}
                 className="flex-grow bg-white text-gray-400 py-4 font-bold text-[10px] uppercase tracking-widest hover:text-indigo-600 transition-all"
               >
                 Continue Shopping
               </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-7xl mx-auto py-8">
      {globalError && (
        <div className="lg:col-span-12 p-6 bg-red-50 border-2 border-red-100 rounded-[32px] text-red-600 space-y-2">
           <div className="flex items-center gap-2 font-black uppercase tracking-widest text-xs">
             <ShieldCheck className="w-5 h-5" /> Error Occurred
           </div>
           <p className="text-sm font-medium">{globalError}</p>
           <button 
             onClick={() => setGlobalError(null)}
             className="text-xs font-bold underline"
           >
             Dismiss
           </button>
        </div>
      )}
      <div className="lg:col-span-12 mb-4">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Cancel and Return
        </button>
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-5 space-y-8 order-2 lg:order-1">
        <section className="bg-gray-50 rounded-3xl p-8 border border-gray-100 space-y-6">
          <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-4 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-600" /> Order Summary
          </h2>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {products.map(product => (
              <div key={product.id} className="flex gap-4 group">
                <div className="w-16 h-16 rounded-xl bg-white overflow-hidden border border-gray-100 shrink-0 shadow-sm transition-transform group-hover:scale-105">
                  <img src={product.imageUrl || "/placeholder.jpg"} className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1 py-1">
                  <h3 className="font-bold text-gray-900 text-sm">{product.name}</h3>
                  <p className="text-[10px] text-gray-400 font-bold font-mono tracking-wider">৳{product.price.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200 border-dashed">
            {/* Coupon Section */}
            <div className="space-y-2 py-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Have a coupon?</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter code"
                  className="flex-grow bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button 
                  onClick={handleApplyCoupon}
                  disabled={isValidatingCoupon || !couponCode.trim()}
                  className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {isValidatingCoupon ? "..." : "Apply"}
                </button>
              </div>
              {couponError && (
                <p className="text-[9px] font-bold text-red-500 ml-1">{couponError}</p>
              )}
              {appliedCoupon && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-2 rounded-xl mt-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                      {appliedCoupon.code} Applied
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponCode("");
                    }}
                    className="text-[9px] font-black text-gray-400 uppercase hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium font-mono">৳{subtotal.toLocaleString()}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount ({appliedCoupon.code})</span>
                <span className="font-bold font-mono">-৳{discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Platform Fee</span>
              <span className="text-green-600 font-bold font-mono">FREE</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-4 border-t border-gray-200">
              <span>Total Amount</span>
              <span className="font-mono text-indigo-600">৳{totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </section>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-indigo-900">
            <Lock className="w-5 h-5" />
            <h4 className="font-bold">Secure Digital Purchase</h4>
          </div>
          <p className="text-xs text-indigo-700/70 leading-relaxed">
            Your payment is processed securely. After successful payment, 
            the digital assets will be added to your account instantly with download links.
          </p>
        </div>
      </div>

      {/* Payment Form */}
      <div className="lg:col-span-7 space-y-6 order-1 lg:order-2">
        <section className="bg-white rounded-3xl p-5 sm:p-10 border-2 border-indigo-100 shadow-2xl shadow-indigo-100/50 space-y-5 sm:space-y-8">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 tracking-tight">Checkout Details</h2>
            <p className="text-[10px] sm:text-sm text-gray-500 font-medium">Verify your info and select payment.</p>
          </div>

          {/* Customer Info Section */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                <input 
                  type="text" 
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  placeholder="Your Name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  type="email" 
                  readOnly
                  value={customerInfo.email}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-0 text-gray-400 font-medium cursor-not-allowed"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone</label>
                <input 
                  type="tel" 
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  placeholder="017xxxxxxxx"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Delivery Address / Notes</label>
              <textarea 
                rows={2}
                value={customerInfo.address}
                onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium resize-none"
                placeholder="Village, Post Office, Upazila, District (Required for physical items)"
              />
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-4 h-px bg-gray-200"></span> Payment Method <span className="w-4 h-px bg-gray-200"></span>
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {settings.enableStripe !== false && (
                <button 
                  onClick={() => { setGateway("stripe"); setIsCOD(false); }}
                  className={cn(
                    "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                    gateway === "stripe" && !isCOD ? "border-indigo-600 bg-indigo-50/50" : "border-gray-50 hover:border-gray-100"
                  )}
                >
                  <CreditCard className={cn("w-4 h-4 sm:w-5 sm:h-5", gateway === "stripe" && !isCOD ? "text-indigo-600" : "text-gray-400")} />
                  <div className="text-[9px] sm:text-xs font-bold">Stripe</div>
                </button>
              )}
              {settings.enableLocal !== false && (
                <button 
                  onClick={() => { setGateway("local"); setIsCOD(false); }}
                  className={cn(
                    "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                    gateway === "local" && !isCOD ? "border-pink-600 bg-pink-50/50" : "border-gray-50 hover:border-gray-100"
                  )}
                >
                  <Wallet className={cn("w-4 h-4 sm:w-5 sm:h-5", gateway === "local" && !isCOD ? "text-pink-600" : "text-gray-400")} />
                  <div className="text-[9px] sm:text-xs font-bold">Local</div>
                </button>
              )}
              {settings.enableCOD !== false && (
                <button 
                  onClick={() => setIsCOD(true)}
                  className={cn(
                    "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                    isCOD ? "border-emerald-600 bg-emerald-50/50" : "border-gray-50 hover:border-gray-100"
                  )}
                >
                  <PackageCheck className={cn("w-4 h-4 sm:w-5 sm:h-5", isCOD ? "text-emerald-600" : "text-gray-400")} />
                  <div className="text-[9px] sm:text-xs font-bold">COD</div>
                </button>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isCOD ? (
              <motion.div
                key="cod"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <CODForm 
                  products={products}
                  userId={user?.uid!}
                  customerInfo={customerInfo}
                  amount={totalAmount}
                  appliedCoupon={appliedCoupon}
                  discountAmount={discountAmount}
                  onSuccess={handleOrderSuccess}
                />
              </motion.div>
            ) : gateway === "stripe" ? (
              <motion.div
                key="stripe"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                {clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripeForm 
                      products={products}
                      userId={user?.uid!} 
                      customerInfo={customerInfo}
                      amount={totalAmount} 
                      appliedCoupon={appliedCoupon}
                      discountAmount={discountAmount}
                      onSuccess={handleOrderSuccess}
                    />
                  </Elements>
                ) : (
                  <div className="p-8 text-center text-gray-400 italic text-sm">Initializing Stripe...</div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="local"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <LocalForm 
                  products={products}
                  userId={user?.uid!} 
                  customerInfo={customerInfo}
                  amount={totalAmount}
                  appliedCoupon={appliedCoupon}
                  discountAmount={discountAmount}
                  onSuccess={handleOrderSuccess}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

function CODForm({ products, userId, customerInfo, amount, appliedCoupon, discountAmount, onSuccess }: { products: Product[], userId: string, customerInfo: { name: string; email: string; phone: string; address: string; }, amount: number, appliedCoupon?: any, discountAmount?: number, onSuccess?: (orderId: string) => void }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerInfo.name || !customerInfo.address || !customerInfo.phone) {
      alert("Please enter your name, phone number and delivery address.");
      return;
    }
    setIsLoading(true);

    try {
      const orderItems = products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price
      }));

      const orderRef = await addDoc(collection(db, "orders"), {
        userId,
        productIds: products.map(p => p.id),
        items: orderItems,
        productName: orderItems.length === 1 ? orderItems[0].name : `${orderItems.length} Products`,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        deliveryAddress: customerInfo.address,
        paymentMethod: "cod",
        status: "pending",
        amount,
        couponCode: appliedCoupon?.code || null,
        discountAmount: discountAmount || 0,
        createdAt: serverTimestamp(),
      });

      onSuccess?.(orderRef.id);
    } catch (error) {
      console.error("COD Error:", error);
      alert("Failed to place order. " + (error instanceof Error ? error.message : ""));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 space-y-3">
        <div className="flex items-center gap-3 text-emerald-700">
          <div className="p-2 bg-white rounded-lg shadow-sm border border-emerald-50">
            <PackageCheck className="w-5 h-5" />
          </div>
          <h4 className="font-black text-xs uppercase tracking-widest">Cash on Delivery</h4>
        </div>
        <p className="text-[10px] sm:text-[11px] text-emerald-600/80 leading-relaxed font-medium">
          You will pay with cash when your product is delivered. Please ensure the delivery address provided above is accurate.
        </p>
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full bg-emerald-600 text-white py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
      >
        {isLoading ? "Placing Order..." : `Confirm COD Order - ৳${amount.toLocaleString()}`}
      </button>
    </div>
  );
}

function StripeForm({ products, userId, customerInfo, amount, appliedCoupon, discountAmount, onSuccess }: { products: Product[], userId: string, customerInfo: { name: string; email: string; phone: string; address: string; }, amount: number, appliedCoupon?: any, discountAmount?: number, onSuccess?: (orderId: string) => void }) {
  const productIds = products.map(p => p.id);
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (!customerInfo.name || !customerInfo.address || !customerInfo.phone) {
      setMessage("Please enter your name, phone number and delivery address.");
      return;
    }

    setIsLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message ?? "An error occurred.");
      setIsLoading(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      try {
        const downloadToken = crypto.randomUUID();
        // Create items summary for history
        const orderItems = products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price
        }));

        const orderRef = await addDoc(collection(db, "orders"), {
          userId,
          productIds,
          items: orderItems,
          productName: orderItems.length === 1 ? orderItems[0].name : `${orderItems.length} Products`,
          customerEmail: customerInfo.email,
          customerName: customerInfo.name,
          customerPhone: customerInfo.phone,
          deliveryAddress: customerInfo.address,
          status: "completed",
          amount,
          couponCode: appliedCoupon?.code || null,
          discountAmount: discountAmount || 0,
          paymentIntentId: paymentIntent.id,
          downloadToken,
          gateway: "stripe",
          createdAt: serverTimestamp(),
        });
        
        console.log("Stripe order created successfully:", orderRef.id);
        onSuccess?.(orderRef.id);
      } catch (err) {
        console.error("Stripe Firestore Error:", err);
        setMessage("Payment successful but failed to save order record. Please contact support.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <div className="bg-gray-50/50 p-4 rounded-xl sm:rounded-2xl border border-gray-100">
        <PaymentElement />
      </div>
      {message && <div className="p-3 sm:p-4 bg-red-50 text-red-600 rounded-xl text-xs sm:text-sm font-medium border border-red-100">{message}</div>}
      <button
        disabled={isLoading || !stripe || !elements}
        className="w-full py-3.5 sm:py-4 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-50 active:scale-[0.98]"
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
        Confirm & Pay ৳{amount.toLocaleString()}
      </button>
    </form>
  );
}

function LocalForm({ products, userId, customerInfo, amount, appliedCoupon, discountAmount, onSuccess }: { products: Product[], userId: string, customerInfo: { name: string; email: string; phone: string; address: string; }, amount: number, appliedCoupon?: any, discountAmount?: number, onSuccess?: (orderId: string) => void }) {
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("bkash");
  const [phone, setPhone] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [copied, setCopied] = useState(false);

  const getAdminNumber = () => {
    if (selectedMethod === "bkash") return settings.bkashNumber || "017xxxxxxxx";
    if (selectedMethod === "nagad") return settings.nagadNumber || "018xxxxxxxx";
    if (selectedMethod === "rocket") return settings.rocketNumber || "019xxxxxxxx";
    return "";
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getAdminNumber());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!customerInfo.name || !customerInfo.address || !customerInfo.phone) {
      setError("Please fill your Full Name, Phone Number, and Address in the section above first.");
      return;
    }
    if (!phone || !transactionId) {
      setError("Please provide both your payment number and the Transaction ID / Proof.");
      return;
    }
    setIsLoading(true);

    try {
      const orderItems = products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price
      }));

      const orderRef = await addDoc(collection(db, "orders"), {
        userId,
        productIds: products.map(p => p.id),
        items: orderItems,
        productName: orderItems.length === 1 ? orderItems[0].name : `${orderItems.length} Products`,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone, // Phone from basic data
        paymentPhone: phone, // Phone from payment details
        deliveryAddress: customerInfo.address,
        transactionId: transactionId,
        paymentMethod: selectedMethod,
        status: "pending", // Set to pending for manual confirmation
        amount,
        couponCode: appliedCoupon?.code || null,
        discountAmount: discountAmount || 0,
        createdAt: serverTimestamp(),
      });

      console.log("Local order created successfully:", orderRef.id);
      if (onSuccess) {
        onSuccess(orderRef.id);
      }
    } catch (error: any) {
      console.error("Local order error:", error);
      try {
        handleFirestoreError(error, OperationType.WRITE, "orders");
      } catch (jsonErr: any) {
        setError(jsonErr.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { id: "bkash", logo: settings.bkashLogo },
          { id: "nagad", logo: settings.nagadLogo },
          { id: "rocket", logo: settings.rocketLogo }
        ].map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => setSelectedMethod(method.id)}
            className={cn(
              "p-2 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all flex flex-col items-center gap-1 sm:gap-2",
              selectedMethod === method.id 
                ? "border-pink-600 bg-pink-50" 
                : "border-gray-50 bg-white hover:border-gray-200"
            )}
          >
            {method.logo ? (
              <div className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center p-1">
                <img src={method.logo} alt={method.id} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-50 flex items-center justify-center font-black text-[10px] sm:text-xs uppercase text-gray-400">
                {method.id[0]}
              </div>
            )}
            <span className="text-[8px] sm:text-[10px] uppercase font-black tracking-widest text-gray-500">{method.id}</span>
          </button>
        ))}
      </div>

      <div className="bg-indigo-50/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-3 sm:space-y-4 border border-indigo-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center p-1 shadow-sm border border-indigo-50">
              {selectedMethod === "bkash" && settings.bkashLogo ? <img src={settings.bkashLogo} className="max-w-full max-h-full object-contain" /> : 
               selectedMethod === "nagad" && settings.nagadLogo ? <img src={settings.nagadLogo} className="max-w-full max-h-full object-contain" /> :
               selectedMethod === "rocket" && settings.rocketLogo ? <img src={settings.rocketLogo} className="max-w-full max-h-full object-contain" /> :
               <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />}
            </div>
            <div className="space-y-0.5">
              <div className="text-[8px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-widest">Send Money to</div>
              <div className="text-sm sm:text-xl font-mono font-black text-indigo-900 tracking-wider">
                {getAdminNumber()}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 sm:p-3 bg-white text-indigo-600 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
        <p className="text-[9px] sm:text-[11px] text-indigo-600/70 leading-relaxed font-medium">
          Send <b>৳{amount.toLocaleString()}</b> using your {selectedMethod} app. Enter your payment info below.
        </p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-3 sm:gap-4 bg-gray-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <div className="p-2 sm:p-3 bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-50">
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </div>
          <div className="flex-grow">
            <div className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">Payment Number</div>
            <input 
              type="tel"
              placeholder="017xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-xs sm:text-sm focus:ring-0 outline-none placeholder:text-gray-300 font-mono font-bold"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 bg-gray-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <div className="p-2 sm:p-3 bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-50">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </div>
          <div className="flex-grow">
            <div className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">Transaction ID</div>
            <input 
              type="text"
              placeholder="TRX12345678"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-xs sm:text-sm focus:ring-0 outline-none placeholder:text-gray-300 font-mono font-bold uppercase"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full bg-pink-600 text-white py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-pink-100 hover:bg-pink-700 transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
      >
        {isLoading ? "Submitting..." : `Confirm Payment - ৳${amount.toLocaleString()}`}
      </button>
    </div>
  );
}
