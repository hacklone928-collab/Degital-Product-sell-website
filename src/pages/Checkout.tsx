import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User } from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, increment, updateDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { ShieldCheck, Lock, CreditCard, ArrowLeft, Loader2, PackageCheck, Wallet, ShoppingBag, Check, Copy, CheckCircle, DollarSign, Inbox, Plus, Minus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { useCart } from "../lib/CartContext";
import { useSettings } from "../lib/SettingsContext";
import { BD_DIVISIONS, BD_DISTRICTS, BD_UPAZILAS } from "../lib/bd-data";
import { getCoordsForLocation } from "../lib/geo-utils";

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
  originalPrice?: number;
  imageUrl?: string;
  quantity: number;
  size?: string;
}

type PaymentGateway = "stripe" | "local" | "binance" | "payoneer" | "sslcommerz" | "shurjopay";

export default function Checkout({ user, isCartCheckout }: { user: User | null, isCartCheckout?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items: cartItems, totalPrice: cartTotal, clearCart, updateQuantity, removeFromCart } = useCart();
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
  const [usdRate, setUsdRate] = useState<number>(0.0091); // Default fallback
  const [activeGateways, setActiveGateways] = useState<any[]>([]);

  // Real-time synchronization of payment gateway statuses from DB to Checkout selection page
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "payment_gateways"), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveGateways(list);
    });
    return () => unsub();
  }, []);

  // Sync URL status parameters in Checkout redirect handlers
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const orderId = urlParams.get("orderId");
    
    if (status === "success" && orderId) {
      setLastOrderId(orderId);
      setIsSuccess(true);
      if (isCartCheckout) {
        clearCart();
      }
    } else if (status === "failed") {
      setGlobalError("Payment transaction failed. Please choose another channel or try again.");
    } else if (status === "cancelled") {
      setGlobalError("Payment was cancelled by the user. Feel free to complete it using any payment gateway below.");
    }
  }, [clearCart, isCartCheckout]);

  // Pull products lists directly from order doc on payment success redirect if state was reset
  useEffect(() => {
    if (isSuccess && lastOrderId) {
      getDoc(doc(db, "orders", lastOrderId)).then((snap) => {
        if (snap.exists()) {
          const orderData = snap.data();
          if (products.length === 0 && orderData.items) {
            setProducts(orderData.items);
          }
          // Self-healing: if order is not completed/paid, do it from client side
          if (orderData.status !== "completed") {
            console.log("Healing order status client-side...");
            updateDoc(doc(db, "orders", lastOrderId), {
              status: "completed",
              isPaid: true,
              paidAt: serverTimestamp()
            }).catch((err) => console.warn("Client self-healing update order failed: ", err));
          }
        }
      });
    }
  }, [isSuccess, lastOrderId, products.length]);

  useEffect(() => {
    if (isCartCheckout && !loading && cartItems.length === 0 && !isSuccess) {
      navigate("/");
    }
  }, [cartItems.length, isCartCheckout, loading, isSuccess, navigate]);

  useEffect(() => {
    const fetchUsdRate = async () => {
      try {
        const res = await fetch("https://api.exchangerate-api.com/v4/latest/BDT");
        const data = await res.json();
        if (data && data.rates && data.rates.USD) {
          setUsdRate(data.rates.USD);
          console.log("Live BDT to USD Rate:", data.rates.USD);
        }
      } catch (error) {
        console.error("Error fetching USD rate:", error);
      }
    };
    fetchUsdRate();
  }, []);

  // Set default payment method based on settings
  useEffect(() => {
    if (!loading && settings) {
      if (settings.enableStripe !== false) {
        setGateway("stripe");
        setIsCOD(false);
      } else if (settings.enableSSLCommerz !== false) {
        setGateway("sslcommerz");
        setIsCOD(false);
      } else if (settings.enableShurjoPay !== false) {
        setGateway("shurjopay");
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
    division: "",
    district: "",
    upazila: "",
    union: "",
    village: "",
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
              address: data.address || prev.address,
              division: data.division || prev.division,
              district: data.district || prev.district,
              upazila: data.upazila || prev.upazila,
              union: data.union || prev.union,
              village: data.village || prev.village
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
          totalAmount = validCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
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
      const q = query(collection(db, "coupons"), where("code", "==", couponCode.toUpperCase().trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setCouponError("Invalid coupon code.");
        setAppliedCoupon(null);
      } else {
        const couponData = snap.docs[0].data();
        if (!couponData.isActive) {
          setCouponError("This coupon is no longer active.");
          setAppliedCoupon(null);
          return;
        }
        const expiryDate = new Date(couponData.expiryDate);
        // Make it valid until the end of the expiry day
        const endOfExpiryDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate(), 23, 59, 59, 999);
        
        if (endOfExpiryDay < new Date()) {
          setCouponError("This coupon has expired.");
          setAppliedCoupon(null);
        } else if (couponData.usageLimit > 0 && couponData.usageCount >= couponData.usageLimit) {
          setCouponError("Coupon usage limit reached.");
          setAppliedCoupon(null);
        } else {
          setAppliedCoupon({ id: snap.docs[0].id, ...couponData });
          setCouponError(null);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "coupons");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleOrderSuccess = async (orderId: string) => {
    try {
      isCartCheckout && clearCart();
      setLastOrderId(orderId);
      setIsSuccess(true);
    } catch (error) {
      console.error("Error finalizing checkout:", error);
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

  if (isSuccess) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="max-w-xl mx-auto text-center space-y-8">
        <motion.div
           initial={{ scale: 0.5, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner"
        >
          <CheckCircle className="w-10 h-10" />
        </motion.div>
        
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Order Submitted!</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Your request has been sent for verification. Order ID:</p>
          <div className="inline-block bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 px-6 py-3 rounded-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400 text-lg">
            #{lastOrderId.slice(-8).toUpperCase()}
          </div>
        </div>

        {/* Detailed Order Summary for Success Screen */}
        <div className="bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-[32px] overflow-hidden shadow-sm text-left">
          <div className="bg-gray-50/50 dark:bg-gray-800/20 p-6 border-b border-gray-100 dark:border-gray-800">
             <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Order Summary</div>
             <div className="space-y-4">
               {products.map(p => (
                 <div key={`${p.id}-${p.size}`} className="flex justify-between items-center">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center p-1 relative">
                       <img src={p.imageUrl || "/placeholder.jpg"} className="w-full h-full object-cover rounded-md" />
                       <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm">
                         {p.quantity}
                       </span>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{p.name}</span>
                       {p.size && <span className="text-[8px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-tighter">Size: {p.size}</span>}
                     </div>
                   </div>
                   <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400">৳{(p.price * p.quantity).toLocaleString()}</span>
                 </div>
               ))}
               <div className="pt-4 border-t border-gray-100 dark:border-gray-800 border-dashed flex justify-between items-center">
                 <span className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase">Total Paid</span>
                 <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">৳{totalAmount.toLocaleString()}</span>
               </div>
             </div>
          </div>

          <div className="p-6 grid grid-cols-2 gap-6">
            <div>
              <div className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Customer</div>
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200">{customerInfo.name}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">{customerInfo.phone}</div>
            </div>
            <div>
              <div className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Payment Method</div>
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                {isCOD ? "Cash on Delivery" : gateway === "local" ? "Manual Local" : "Card Payment"}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Delivery Address</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium bg-gray-50 dark:bg-gray-950 p-3 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                {customerInfo.village && <p><span className="font-bold">Village:</span> {customerInfo.village}</p>}
                {customerInfo.union && <p><span className="font-bold">Union:</span> {customerInfo.union}</p>}
                <p><span className="font-bold">Area:</span> {customerInfo.upazila}, {customerInfo.district}</p>
                <p><span className="font-bold">Division:</span> {customerInfo.division}</p>
                {customerInfo.address && <p className="mt-2 text-[10px] italic border-t border-gray-200 dark:border-gray-800 pt-1 text-gray-500">{customerInfo.address}</p>}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 sm:p-6 border border-amber-100 dark:border-amber-900/30 space-y-3 text-left">
           <div className="flex items-center gap-2 sm:gap-3 text-amber-900 dark:text-amber-300 font-bold">
             <ShieldCheck className="w-5 h-5" /> Manual Verification
           </div>
           <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
             An administrator will verify your payment details shortly. Once confirmed, you will find your products in <b>"My Products"</b>.
           </p>
        </div>

        <div className="flex flex-col gap-4">
           <button 
             onClick={() => navigate("/my-products")}
             className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all"
           >
             Go to My Products
           </button>
           <div className="flex gap-4">
             <button 
               onClick={() => navigate(`/invoice/${lastOrderId}`)}
               className="flex-grow bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-2 border-gray-100 dark:border-gray-700 py-4 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:bg-white dark:hover:bg-gray-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition-all"
             >
               View Invoice
             </button>
             <button 
               onClick={() => navigate("/")}
               className="flex-grow bg-white dark:bg-transparent text-gray-400 dark:text-gray-500 py-4 font-bold text-[10px] uppercase tracking-widest hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
             >
               Continue Shopping
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}

if (products.length === 0) return (
  <div className="text-center py-20 bg-white dark:bg-gray-950 transition-colors">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Checkout Error</h2>
    <p className="text-gray-500 dark:text-gray-400 mt-2">No products found to checkout.</p>
    <button onClick={() => navigate("/")} className="mt-6 text-indigo-600 dark:text-indigo-400 font-bold hover:underline transition-all">Return Home</button>
  </div>
);

return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-7xl mx-auto py-8">
      {globalError && (
        <div className="lg:col-span-12 p-6 bg-red-50 dark:bg-red-950/20 border-2 border-red-100 dark:border-red-900/30 rounded-[32px] text-red-600 dark:text-red-400 space-y-2">
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
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Cancel and Return
        </button>
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-5 space-y-8 order-1 lg:order-1">
        <section className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 space-y-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-800 pb-4 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Order Summary
          </h2>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {products.map(product => (
              <div key={`${product.id}-${product.size}`} className="flex gap-4 group">
                <div className="w-16 h-16 rounded-xl bg-white dark:bg-gray-800 overflow-hidden border border-gray-100 dark:border-gray-700 shrink-0 shadow-sm transition-transform group-hover:scale-105 relative">
                  <img src={product.imageUrl || "/placeholder.jpg"} className="w-full h-full object-cover" />
                  <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800">
                    {product.quantity}
                  </span>
                </div>
                <div className="space-y-1 py-1 flex-grow">
                  <div className="flex justify-between items-start">
                    <div className="flex-grow">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{product.name}</h3>
                      <div className="flex items-center gap-3 mt-0.5">
                        {product.size && (
                          <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/40">
                            Size: {product.size}
                          </span>
                        )}
                        <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">৳{product.price.toLocaleString()} each</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-900 dark:text-gray-100 font-bold font-mono">৳{(product.price * product.quantity).toLocaleString()}</p>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <p className="text-[9px] text-red-500 font-bold line-through opacity-60">৳{product.originalPrice.toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  {isCartCheckout && (
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-0.5 shadow-sm transition-colors">
                        <button 
                          onClick={() => updateQuantity(product.id, product.quantity - 1)}
                          className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Decrease Quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] font-bold text-gray-900 dark:text-gray-100 min-w-[16px] text-center">{product.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(product.id, product.quantity + 1)}
                          className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Increase Quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFromCart(product.id)}
                        className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-all hover:scale-110 active:scale-95"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200 border-dashed">
            {/* Coupon Section */}
            <div className="space-y-2 py-2">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block ml-1">Have a coupon?</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter code"
                  className="flex-grow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
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
                <p className="text-[9px] font-bold text-red-500 dark:text-red-400 ml-1">{couponError}</p>
              )}
              {appliedCoupon && (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 p-2 rounded-xl mt-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">
                      {appliedCoupon.code} Applied
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponCode("");
                    }}
                    className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase hover:text-red-500 dark:hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
              <span className="font-medium font-mono dark:text-gray-200">৳{subtotal.toLocaleString()}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                <span>Discount ({appliedCoupon.code})</span>
                <span className="font-bold font-mono">-৳{discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Platform Fee</span>
              <span className="text-green-600 dark:text-emerald-500 font-bold font-mono">FREE</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white pt-4 border-t border-gray-200 dark:border-gray-800">
              <span>Total Amount</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">৳{totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </section>

        <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-indigo-900 dark:text-indigo-300">
            <Lock className="w-5 h-5" />
            <h4 className="font-bold">Secure Digital Purchase</h4>
          </div>
          <p className="text-xs text-indigo-700/70 dark:text-indigo-400 leading-relaxed">
            Your payment is processed securely. After successful payment, 
            the digital assets will be added to your account instantly with download links.
          </p>
        </div>
      </div>

      {/* Payment Form */}
      <div className="lg:col-span-7 space-y-6 order-2 lg:order-2">
        <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-10 border-2 border-indigo-100 dark:border-gray-800 shadow-2xl shadow-indigo-100/50 dark:shadow-none space-y-5 sm:space-y-8">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Checkout Details</h2>
            <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Verify your info and select payment.</p>
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
                  className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium dark:text-gray-100"
                  placeholder="Your Name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  type="email" 
                  readOnly
                  value={customerInfo.email}
                  className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-0 text-gray-400 dark:text-gray-600 font-medium cursor-not-allowed"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone</label>
                <input 
                  type="tel" 
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium dark:text-gray-100"
                  placeholder="017xxxxxxxx"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Division</label>
                <select 
                  value={customerInfo.division}
                  onChange={(e) => setCustomerInfo({...customerInfo, division: e.target.value, district: "", upazila: ""})}
                  className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium dark:text-gray-100"
                >
                  <option value="">Select Division</option>
                  {BD_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">District</label>
                <select 
                  value={customerInfo.district}
                  disabled={!customerInfo.division}
                  onChange={(e) => setCustomerInfo({...customerInfo, district: e.target.value, upazila: ""})}
                  className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium dark:text-gray-100 disabled:opacity-50"
                >
                  <option value="">Select District</option>
                  {customerInfo.division && BD_DISTRICTS[customerInfo.division]?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Upazila</label>
                <select 
                  value={customerInfo.upazila}
                  disabled={!customerInfo.district}
                  onChange={(e) => setCustomerInfo({...customerInfo, upazila: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium dark:text-gray-100 disabled:opacity-50"
                >
                  <option value="">Select Upazila</option>
                  {customerInfo.district && (BD_UPAZILAS[customerInfo.district] || []).map(u => <option key={u} value={u}>{u}</option>)}
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Union / Area</label>
                <input 
                  type="text" 
                  value={customerInfo.union}
                  onChange={(e) => setCustomerInfo({...customerInfo, union: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium dark:text-gray-100"
                  placeholder="Your Union"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Village / Local Area</label>
                <input 
                  type="text" 
                  value={customerInfo.village}
                  onChange={(e) => setCustomerInfo({...customerInfo, village: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium dark:text-gray-100"
                  placeholder="Village name, House No, Road No"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Additional Notes</label>
              <textarea 
                rows={2}
                value={customerInfo.address}
                onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-xl px-4 py-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium resize-none dark:text-gray-100"
                placeholder="Any special instructions for delivery"
              />
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-4 h-px bg-gray-200 dark:bg-gray-800"></span> Payment Method <span className="w-4 h-px bg-gray-200 dark:bg-gray-800"></span>
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {settings.enableStripe !== false && (
                <button 
                  onClick={() => { setGateway("stripe"); setIsCOD(false); }}
                  className={cn(
                    "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                    gateway === "stripe" && !isCOD ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20" : "border-gray-50 dark:border-gray-800 hover:border-gray-100 dark:hover:border-gray-700 bg-white dark:bg-gray-950"
                  )}
                >
                  <CreditCard className={cn("w-4 h-4 sm:w-5 sm:h-5", gateway === "stripe" && !isCOD ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400")} />
                  <div className={cn("text-[9px] sm:text-xs font-bold", gateway === "stripe" && !isCOD ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400")}>Stripe</div>
                </button>
              )}
              {settings.enableSSLCommerz !== false && (
                <button 
                  onClick={() => { setGateway("sslcommerz"); setIsCOD(false); }}
                  className={cn(
                    "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                    gateway === "sslcommerz" && !isCOD ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20" : "border-gray-50 dark:border-gray-800 hover:border-gray-100 dark:hover:border-gray-700 bg-white dark:bg-gray-950"
                  )}
                >
                  {activeGateways.find(g => g.id === "sslcommerz")?.logo ? (
                    <img src={activeGateways.find(g => g.id === "sslcommerz")?.logo} className="w-5 h-5 object-contain" />
                  ) : (
                    <CreditCard className={cn("w-4 h-4 sm:w-5 sm:h-5", gateway === "sslcommerz" && !isCOD ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400")} />
                  )}
                  <div className={cn("text-[8px] sm:text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400")}>SSLCommerz</div>
                </button>
              )}
              {settings.enableShurjoPay !== false && (
                <button 
                  onClick={() => { setGateway("shurjopay"); setIsCOD(false); }}
                  className={cn(
                    "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                    gateway === "shurjopay" && !isCOD ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20" : "border-gray-50 dark:border-gray-800 hover:border-gray-100 dark:hover:border-gray-700 bg-white dark:bg-gray-950"
                  )}
                >
                  {activeGateways.find(g => g.id === "shurjopay")?.logo ? (
                    <img src={activeGateways.find(g => g.id === "shurjopay")?.logo} className="w-5 h-5 object-contain" />
                  ) : (
                    <CreditCard className={cn("w-4 h-4 sm:w-5 sm:h-5", gateway === "shurjopay" && !isCOD ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400")} />
                  )}
                  <div className={cn("text-[8px] sm:text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400")}>ShurjoPay</div>
                </button>
              )}
              {settings.enableLocal !== false && (
                <button 
                  onClick={() => { setGateway("local"); setIsCOD(false); }}
                  className={cn(
                    "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                    gateway === "local" && !isCOD ? "border-pink-600 bg-pink-50/50 dark:bg-pink-900/20" : "border-gray-50 dark:border-gray-800 hover:border-gray-100 dark:hover:border-gray-700 bg-white dark:bg-gray-950"
                  )}
                >
                  <Wallet className={cn("w-4 h-4 sm:w-5 sm:h-5", gateway === "local" && !isCOD ? "text-pink-600 dark:text-pink-400" : "text-gray-400")} />
                  <div className={cn("text-[9px] sm:text-xs font-bold", gateway === "local" && !isCOD ? "text-pink-600 dark:text-pink-400" : "text-gray-400")}>Local</div>
                </button>
              )}
              {settings.enableBinancePay && (
                <button 
                  onClick={() => { setGateway("binance"); setIsCOD(false); }}
                  className={cn(
                    "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                    gateway === "binance" && !isCOD ? "border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/20" : "border-gray-50 dark:border-gray-800 hover:border-gray-100 dark:hover:border-gray-700 bg-white dark:bg-gray-950"
                  )}
                >
                  <DollarSign className={cn("w-4 h-4 sm:w-5 sm:h-5", gateway === "binance" && !isCOD ? "text-yellow-600 dark:text-yellow-400" : "text-gray-400")} />
                  <div className={cn("text-[9px] sm:text-xs font-bold", gateway === "binance" && !isCOD ? "text-yellow-600 dark:text-yellow-400" : "text-gray-400")}>Binance</div>
                </button>
              )}
              {settings.enablePayoneer && (
                <button 
                  onClick={() => { setGateway("payoneer"); setIsCOD(false); }}
                  className={cn(
                    "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                    gateway === "payoneer" && !isCOD ? "border-cyan-600 bg-cyan-50/50 dark:bg-cyan-900/20" : "border-gray-50 dark:border-gray-800 hover:border-gray-100 dark:hover:border-gray-700 bg-white dark:bg-gray-950"
                  )}
                >
                  <Inbox className={cn("w-4 h-4 sm:w-5 sm:h-5", gateway === "payoneer" && !isCOD ? "text-cyan-600 dark:text-cyan-400" : "text-gray-400")} />
                  <div className={cn("text-[9px] sm:text-xs font-bold", gateway === "payoneer" && !isCOD ? "text-cyan-600 dark:text-cyan-400" : "text-gray-400")}>Payoneer</div>
                </button>
              )}
              {settings.enableCOD !== false && (
                <button 
                  onClick={() => setIsCOD(true)}
                  className={cn(
                    "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                    isCOD ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20" : "border-gray-50 dark:border-gray-800 hover:border-gray-100 dark:hover:border-gray-700 bg-white dark:bg-gray-950"
                  )}
                >
                  <PackageCheck className={cn("w-4 h-4 sm:w-5 sm:h-5", isCOD ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400")} />
                  <div className={cn("text-[9px] sm:text-xs font-bold", isCOD ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400")}>COD</div>
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
                  subtotal={subtotal}
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
                      subtotal={subtotal}
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
            ) : gateway === "binance" ? (
              <motion.div
                key="binance"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <BinanceForm 
                  products={products}
                  userId={user?.uid!} 
                  customerInfo={customerInfo}
                  subtotal={subtotal}
                  amount={totalAmount}
                  amountUSD={Number((totalAmount * usdRate).toFixed(2))}
                  usdRate={usdRate}
                  appliedCoupon={appliedCoupon}
                  discountAmount={discountAmount}
                  onSuccess={handleOrderSuccess}
                />
              </motion.div>
            ) : gateway === "payoneer" ? (
              <motion.div
                key="payoneer"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <PayoneerForm 
                  products={products}
                  userId={user?.uid!} 
                  customerInfo={customerInfo}
                  subtotal={subtotal}
                  amount={totalAmount}
                  amountUSD={Number((totalAmount * usdRate).toFixed(2))}
                  usdRate={usdRate}
                  appliedCoupon={appliedCoupon}
                  discountAmount={discountAmount}
                  onSuccess={handleOrderSuccess}
                />
              </motion.div>
            ) : gateway === "sslcommerz" ? (
              <motion.div
                key="sslcommerz"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <SslCommerzForm 
                  products={products}
                  userId={user?.uid!} 
                  customerInfo={customerInfo}
                  subtotal={subtotal}
                  amount={totalAmount}
                  appliedCoupon={appliedCoupon}
                  discountAmount={discountAmount}
                  onSuccess={handleOrderSuccess}
                />
              </motion.div>
            ) : gateway === "shurjopay" ? (
              <motion.div
                key="shurjopay"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <ShurjoPayForm 
                  products={products}
                  userId={user?.uid!} 
                  customerInfo={customerInfo}
                  subtotal={subtotal}
                  amount={totalAmount}
                  appliedCoupon={appliedCoupon}
                  discountAmount={discountAmount}
                  onSuccess={handleOrderSuccess}
                />
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
                  subtotal={subtotal}
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

function CODForm({ products, userId, customerInfo, subtotal, amount, appliedCoupon, discountAmount, onSuccess }: { products: Product[], userId: string, customerInfo: { name: string; email: string; phone: string; address: string; division: string; district: string; upazila: string; union: string; village: string; }, subtotal: number, amount: number, appliedCoupon?: any, discountAmount?: number, onSuccess?: (orderId: string) => void }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.division || !customerInfo.district) {
      setError("Please enter your name, phone number, and complete the address selection.");
      return;
    }
    setIsLoading(true);

    try {
      const orderItems = products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        size: p.size || null,
        quantity: p.quantity
      }));

      const locationCoords = getCoordsForLocation(customerInfo.district, customerInfo.division);

      const orderRef = await addDoc(collection(db, "orders"), {
        userId,
        productIds: products.map(p => p.id),
        items: orderItems,
        productName: orderItems.length === 1 ? (orderItems[0].size ? `${orderItems[0].name} (${orderItems[0].size})` : orderItems[0].name) : `${orderItems.length} Products`,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        deliveryAddress: customerInfo.address,
        division: customerInfo.division,
        district: customerInfo.district,
        upazila: customerInfo.upazila,
        union: customerInfo.union,
        village: customerInfo.village,
        lat: locationCoords.lat,
        lng: locationCoords.lng,
        paymentMethod: "cod",
        status: "pending",
        amount: subtotal,
        grossAmount: subtotal,
        discountAmount: discountAmount || 0,
        netAmount: amount,
        couponCode: appliedCoupon?.code || null,
        bonusAssigneeEmail: appliedCoupon?.assignedEmail || null,
        bonusAmountGiven: appliedCoupon?.assignedEmail ? (appliedCoupon.bonusPercentage > 0 ? (amount * appliedCoupon.bonusPercentage / 100) : (appliedCoupon.bonusAmount || 0)) : 0,
        createdAt: serverTimestamp(),
      });

      onSuccess?.(orderRef.id);
    } catch (error) {
      console.error("COD Error:", error);
      setError("Failed to place order. " + (error instanceof Error ? error.message : ""));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-3">
        <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
          <div className="p-2 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-emerald-50 dark:border-emerald-900/20">
            <PackageCheck className="w-5 h-5" />
          </div>
          <h4 className="font-black text-xs uppercase tracking-widest">Cash on Delivery</h4>
        </div>
        <p className="text-[10px] sm:text-[11px] text-emerald-600/80 dark:text-emerald-400 leading-relaxed font-medium">
          You will pay with cash when your product is delivered. Please ensure the delivery address provided above is accurate.
        </p>
      </div>
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold border border-red-100 dark:border-red-900/30 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse shrink-0"></div>
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full bg-emerald-600 text-white py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-emerald-100 dark:shadow-none transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
      >
        {isLoading ? "Placing Order..." : `Confirm COD Order - ৳${amount.toLocaleString()}`}
      </button>
    </div>
  );
}

function StripeForm({ products, userId, customerInfo, subtotal, amount, appliedCoupon, discountAmount, onSuccess }: { products: Product[], userId: string, customerInfo: { name: string; email: string; phone: string; address: string; division: string; district: string; upazila: string; union: string; village: string; }, subtotal: number, amount: number, appliedCoupon?: any, discountAmount?: number, onSuccess?: (orderId: string) => void }) {
  const productIds = products.map(p => p.id);
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (!customerInfo.name || !customerInfo.phone || !customerInfo.division || !customerInfo.district) {
      setMessage("Please enter your name, phone number and complete your address.");
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
          price: p.price,
          size: p.size || null,
          quantity: p.quantity
        }));

        const locationCoords = getCoordsForLocation(customerInfo.district, customerInfo.division);

        const orderRef = await addDoc(collection(db, "orders"), {
          userId,
          productIds,
          items: orderItems,
          productName: orderItems.length === 1 ? (orderItems[0].size ? `${orderItems[0].name} (${orderItems[0].size})` : orderItems[0].name) : `${orderItems.length} Products`,
          customerEmail: customerInfo.email,
          customerName: customerInfo.name,
          customerPhone: customerInfo.phone,
          deliveryAddress: customerInfo.address,
          division: customerInfo.division,
          district: customerInfo.district,
          upazila: customerInfo.upazila,
          union: customerInfo.union,
          village: customerInfo.village,
          lat: locationCoords.lat,
          lng: locationCoords.lng,
          status: "completed",
          amount: subtotal,
          grossAmount: subtotal,
          discountAmount: discountAmount || 0,
          netAmount: amount,
          couponCode: appliedCoupon?.code || null,
          bonusAssigneeEmail: appliedCoupon?.assignedEmail || null,
          bonusAmountGiven: appliedCoupon?.assignedEmail ? (appliedCoupon.bonusPercentage > 0 ? (amount * appliedCoupon.bonusPercentage / 100) : (appliedCoupon.bonusAmount || 0)) : 0,
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
      <div className="bg-gray-50/50 dark:bg-gray-950/50 p-4 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800">
        <PaymentElement />
      </div>
      {message && <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs sm:text-sm font-medium border border-red-100 dark:border-red-900/30">{message}</div>}
      <button
        disabled={isLoading || !stripe || !elements}
        className="w-full py-3.5 sm:py-4 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-50 active:scale-[0.98]"
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
        Confirm & Pay ৳{amount.toLocaleString()}
      </button>
    </form>
  );
}

function BinanceForm({ products, userId, customerInfo, subtotal, amount, amountUSD, usdRate, appliedCoupon, discountAmount, onSuccess }: { products: Product[], userId: string, customerInfo: { name: string; email: string; phone: string; address: string; division: string; district: string; upazila: string; union: string; village: string; }, subtotal: number, amount: number, amountUSD: number, usdRate: number, appliedCoupon?: any, discountAmount?: number, onSuccess?: (orderId: string) => void }) {
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(settings.binanceId || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.division || !customerInfo.district) {
      setError("Please fill your Full Name, Phone Number, and Complete Address in the section above first.");
      return;
    }
    if (!transactionId) {
      setError("Please provide the Transaction ID / Proof.");
      return;
    }
    setIsLoading(true);

    try {
      const orderItems = products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        size: p.size || null,
        quantity: p.quantity
      }));

      const locationCoords = getCoordsForLocation(customerInfo.district, customerInfo.division);

      const orderRef = await addDoc(collection(db, "orders"), {
        userId,
        productIds: products.map(p => p.id),
        items: orderItems,
        productName: orderItems.length === 1 ? (orderItems[0].size ? `${orderItems[0].name} (${orderItems[0].size})` : orderItems[0].name) : `${orderItems.length} Products`,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        deliveryAddress: customerInfo.address,
        division: customerInfo.division,
        district: customerInfo.district,
        upazila: customerInfo.upazila,
        union: customerInfo.union,
        village: customerInfo.village,
        lat: locationCoords.lat,
        lng: locationCoords.lng,
        transactionId: transactionId,
        paymentMethod: "binance",
        status: "pending",
        amount: subtotal,
        grossAmount: subtotal,
        discountAmount: discountAmount || 0,
        netAmount: amount,
        amountUSD: amountUSD,
        usdRate: usdRate,
        couponCode: appliedCoupon?.code || null,
        bonusAssigneeEmail: appliedCoupon?.assignedEmail || null,
        bonusAmountGiven: appliedCoupon?.assignedEmail ? (appliedCoupon.bonusPercentage > 0 ? (amount * appliedCoupon.bonusPercentage / 100) : (appliedCoupon.bonusAmount || 0)) : 0,
        createdAt: serverTimestamp(),
      });

      onSuccess?.(orderRef.id);
    } catch (error: any) {
      console.error("Binance order error:", error);
      setError("Failed to place order.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50/50 dark:bg-yellow-900/10 p-6 rounded-3xl border border-yellow-100 dark:border-yellow-900/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-2xl flex items-center justify-center p-2 shadow-sm border border-yellow-50 dark:border-yellow-900/40">
              <DollarSign className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest">Binance Pay ID</div>
              <div className="text-xl font-mono font-black text-yellow-900 dark:text-yellow-100 tracking-wider text-wrap break-all">
                {settings.binanceId || "Not Set"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="p-3 bg-white dark:bg-gray-800 text-yellow-600 dark:text-yellow-500 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 border border-yellow-50 dark:border-yellow-900/40"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        
        {settings.binanceQR && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="w-40 h-40 bg-white dark:bg-gray-800 p-2 rounded-2xl border-2 border-yellow-100 dark:border-yellow-900/40 shadow-inner">
              <img src={settings.binanceQR} alt="Binance QR" className="w-full h-full object-contain" />
            </div>
            <span className="text-[9px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest">Scan to Pay</span>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <div className="flex justify-between items-center text-[11px] text-yellow-800 dark:text-yellow-400 font-bold uppercase tracking-tight">
            <span>Payable (BDT)</span>
            <span>৳{amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-yellow-800 dark:text-yellow-400 font-bold uppercase tracking-tight">
            <span>Current USD Rate</span>
            <span>৳1 = ${usdRate.toFixed(4)}</span>
          </div>
          <div className="h-px bg-yellow-200 dark:bg-yellow-800 w-full opacity-50"></div>
          <div className="flex justify-between items-center text-sm text-yellow-900 dark:text-yellow-100 font-black uppercase tracking-tight">
            <span>Payable (USD)</span>
            <span className="text-lg">${amountUSD.toFixed(2)}</span>
          </div>
        </div>

        <p className="text-[10px] text-yellow-700/60 dark:text-yellow-500/60 leading-relaxed font-medium pt-2">
          Send exactly <b>${amountUSD.toFixed(2)}</b> to the Binance Pay ID shown above or scan the QR code. Enter Transaction ID below.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 focus-within:ring-2 focus-within:ring-yellow-500 transition-all">
          <div className="p-3 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-50 dark:border-gray-800">
            <ShoppingBag className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="flex-grow">
            <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Transaction ID</div>
            <input 
              type="text"
              placeholder="Binance TXID"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700 font-mono font-bold uppercase dark:text-white"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full bg-yellow-500 text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-yellow-100 dark:shadow-none hover:bg-yellow-600 transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
      >
        {isLoading ? "Submitting..." : `Confirm Binance Payment - ৳${amount.toLocaleString()}`}
      </button>
    </div>
  );
}

function PayoneerForm({ products, userId, customerInfo, subtotal, amount, amountUSD, usdRate, appliedCoupon, discountAmount, onSuccess }: { products: Product[], userId: string, customerInfo: { name: string; email: string; phone: string; address: string; division: string; district: string; upazila: string; union: string; village: string; }, subtotal: number, amount: number, amountUSD: number, usdRate: number, appliedCoupon?: any, discountAmount?: number, onSuccess?: (orderId: string) => void }) {
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(settings.payoneerEmail || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.division || !customerInfo.district) {
      setError("Please fill your Full Name, Phone Number, and Complete Address in the section above first.");
      return;
    }
    if (!transactionId) {
      setError("Please provide the Transaction ID / Email used.");
      return;
    }
    setIsLoading(true);

    try {
      const orderItems = products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        size: p.size || null,
        quantity: p.quantity
      }));

      const locationCoords = getCoordsForLocation(customerInfo.district, customerInfo.division);

      const orderRef = await addDoc(collection(db, "orders"), {
        userId,
        productIds: products.map(p => p.id),
        items: orderItems,
        productName: orderItems.length === 1 ? (orderItems[0].size ? `${orderItems[0].name} (${orderItems[0].size})` : orderItems[0].name) : `${orderItems.length} Products`,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        deliveryAddress: customerInfo.address,
        division: customerInfo.division,
        district: customerInfo.district,
        upazila: customerInfo.upazila,
        union: customerInfo.union,
        village: customerInfo.village,
        lat: locationCoords.lat,
        lng: locationCoords.lng,
        transactionId: transactionId,
        paymentMethod: "payoneer",
        status: "pending",
        amount: subtotal,
        grossAmount: subtotal,
        discountAmount: discountAmount || 0,
        netAmount: amount,
        amountUSD: amountUSD,
        usdRate: usdRate,
        couponCode: appliedCoupon?.code || null,
        bonusAssigneeEmail: appliedCoupon?.assignedEmail || null,
        bonusAmountGiven: appliedCoupon?.assignedEmail ? (appliedCoupon.bonusPercentage > 0 ? (amount * appliedCoupon.bonusPercentage / 100) : (appliedCoupon.bonusAmount || 0)) : 0,
        createdAt: serverTimestamp(),
      });

      onSuccess?.(orderRef.id);
    } catch (error: any) {
      console.error("Payoneer order error:", error);
      setError("Failed to place order.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-cyan-50/50 dark:bg-cyan-900/10 p-6 rounded-3xl border border-cyan-100 dark:border-cyan-900/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-2xl flex items-center justify-center p-2 shadow-sm border border-cyan-50 dark:border-cyan-900/40">
              <Inbox className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">Payoneer Email</div>
              <div className="text-sm sm:text-lg font-mono font-black text-cyan-900 dark:text-cyan-100 tracking-tight break-all">
                {settings.payoneerEmail || "Not Set"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="p-3 bg-white dark:bg-gray-800 text-cyan-600 dark:text-cyan-400 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 border border-cyan-50 dark:border-cyan-900/40"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex justify-between items-center text-[11px] text-cyan-800 dark:text-cyan-400 font-bold uppercase tracking-tight">
            <span>Payable (BDT)</span>
            <span>৳{amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-cyan-800 dark:text-cyan-400 font-bold uppercase tracking-tight">
            <span>Current USD Rate</span>
            <span>৳1 = ${usdRate.toFixed(4)}</span>
          </div>
          <div className="h-px bg-cyan-200 dark:bg-cyan-800 w-full opacity-50"></div>
          <div className="flex justify-between items-center text-sm text-cyan-900 dark:text-cyan-100 font-black uppercase tracking-tight">
            <span>Payable (USD)</span>
            <span className="text-lg">${amountUSD.toFixed(2)}</span>
          </div>
        </div>
        
        <p className="text-[10px] text-cyan-700/60 dark:text-cyan-400/60 leading-relaxed font-medium pt-2">
          Send exactly <b>${amountUSD.toFixed(2)}</b> to the Payoneer email shown above. Enter Transaction ID or your Payoneer email below.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 focus-within:ring-2 focus-within:ring-cyan-500 transition-all">
          <div className="p-3 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-50 dark:border-gray-800">
            <ShoppingBag className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="flex-grow">
            <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Transaction ID / Proof</div>
            <input 
              type="text"
              placeholder="Ref Number or Your Email"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700 font-mono font-bold uppercase dark:text-white"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold border border-red-100 dark:border-red-900/30">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full bg-cyan-600 text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-cyan-100 dark:shadow-none hover:bg-cyan-700 transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
      >
        {isLoading ? "Submitting..." : `Confirm Payoneer Payment - ৳${amount.toLocaleString()}`}
      </button>
    </div>
  );
}

function LocalForm({ products, userId, customerInfo, subtotal, amount, appliedCoupon, discountAmount, onSuccess }: { products: Product[], userId: string, customerInfo: { name: string; email: string; phone: string; address: string; division: string; district: string; upazila: string; union: string; village: string; }, subtotal: number, amount: number, appliedCoupon?: any, discountAmount?: number, onSuccess?: (orderId: string) => void }) {
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
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.division || !customerInfo.district) {
      setError("Please fill your Full Name, Phone Number, and Complete Address in the section above first.");
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
        price: p.price,
        size: p.size || null,
        quantity: p.quantity
      }));

      const locationCoords = getCoordsForLocation(customerInfo.district, customerInfo.division);

      const orderRef = await addDoc(collection(db, "orders"), {
        userId,
        productIds: products.map(p => p.id),
        items: orderItems,
        productName: orderItems.length === 1 ? (orderItems[0].size ? `${orderItems[0].name} (${orderItems[0].size})` : orderItems[0].name) : `${orderItems.length} Products`,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone, // Phone from basic data
        paymentPhone: phone, // Phone from payment details
        deliveryAddress: customerInfo.address,
        division: customerInfo.division,
        district: customerInfo.district,
        upazila: customerInfo.upazila,
        union: customerInfo.union,
        village: customerInfo.village,
        lat: locationCoords.lat,
        lng: locationCoords.lng,
        transactionId: transactionId,
        paymentMethod: selectedMethod,
        status: "pending", // Set to pending for manual confirmation
        amount: subtotal,
        grossAmount: subtotal,
        discountAmount: discountAmount || 0,
        netAmount: amount,
        couponCode: appliedCoupon?.code || null,
        bonusAssigneeEmail: appliedCoupon?.assignedEmail || null,
        bonusAmountGiven: appliedCoupon?.assignedEmail ? (appliedCoupon.bonusPercentage > 0 ? (amount * appliedCoupon.bonusPercentage / 100) : (appliedCoupon.bonusAmount || 0)) : 0,
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
                ? "border-pink-600 bg-pink-50 dark:bg-pink-900/20" 
                : "border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-gray-200 dark:hover:border-gray-700"
            )}
          >
            {method.logo ? (
              <div className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center p-1">
                <img src={method.logo} alt={method.id} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center font-black text-[10px] sm:text-xs uppercase text-gray-400 dark:text-gray-500">
                {method.id[0]}
              </div>
            )}
            <span className="text-[8px] sm:text-[10px] uppercase font-black tracking-widest text-gray-500 dark:text-gray-400">{method.id}</span>
          </button>
        ))}
      </div>

      <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-3 sm:space-y-4 border border-indigo-100 dark:border-indigo-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl flex items-center justify-center p-1 shadow-sm border border-indigo-50 dark:border-indigo-900/40">
              {selectedMethod === "bkash" && settings.bkashLogo ? <img src={settings.bkashLogo} className="max-w-full max-h-full object-contain" /> : 
               selectedMethod === "nagad" && settings.nagadLogo ? <img src={settings.nagadLogo} className="max-w-full max-h-full object-contain" /> :
               selectedMethod === "rocket" && settings.rocketLogo ? <img src={settings.rocketLogo} className="max-w-full max-h-full object-contain" /> :
               <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />}
            </div>
            <div className="space-y-0.5">
              <div className="text-[8px] sm:text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest">Send Money to</div>
              <div className="text-sm sm:text-xl font-mono font-black text-indigo-900 dark:text-indigo-100 tracking-wider">
                {getAdminNumber()}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 sm:p-3 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
        <p className="text-[9px] sm:text-[11px] text-indigo-600/70 dark:text-indigo-400/70 leading-relaxed font-medium">
          Send <b>৳{amount.toLocaleString()}</b> using your {selectedMethod} app. Enter your payment info below.
        </p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-3 sm:gap-4 bg-gray-50 dark:bg-gray-950 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <div className="p-2 sm:p-3 bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl shadow-sm border border-gray-50 dark:border-gray-800">
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="flex-grow">
            <div className="text-[8px] sm:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5 sm:mb-1">Payment Number</div>
            <input 
              type="tel"
              placeholder="017xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-xs sm:text-sm focus:ring-0 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700 font-mono font-bold dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 bg-gray-50 dark:bg-gray-950 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <div className="p-2 sm:p-3 bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl shadow-sm border border-gray-50 dark:border-gray-800">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="flex-grow">
            <div className="text-[8px] sm:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5 sm:mb-1">Transaction ID</div>
            <input 
              type="text"
              placeholder="TRX12345678"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-xs sm:text-sm focus:ring-0 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700 font-mono font-bold uppercase dark:text-white"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold border border-red-100 dark:border-red-900/30 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full bg-pink-600 text-white py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-pink-100 dark:shadow-none hover:bg-pink-700 transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
      >
        {isLoading ? "Submitting..." : `Confirm Payment - ৳${amount.toLocaleString()}`}
      </button>
    </div>
  );
}

function SslCommerzForm({ products, userId, customerInfo, subtotal, amount, appliedCoupon, discountAmount, onSuccess }: { products: Product[], userId: string, customerInfo: { name: string; email: string; phone: string; address: string; division: string; district: string; upazila: string; union: string; village: string; }, subtotal: number, amount: number, appliedCoupon?: any, discountAmount?: number, onSuccess?: (orderId: string) => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async () => {
    setError("");
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.email || !customerInfo.division || !customerInfo.district) {
      setError("Please complete your Billing & Shipping details (Name, Phone, Email, Address) at the top of the page first.");
      return;
    }
    setIsLoading(true);

    try {
      // Fetch gateway settings directly on client-side as resilient fallback for Cloud Run environments
      let clientCredentials = null;
      try {
        const gatewaySnap = await getDoc(doc(db, "payment_gateways", "sslcommerz"));
        if (gatewaySnap.exists()) {
          clientCredentials = gatewaySnap.data();
        }
      } catch (e) {
        console.warn("Client failed to fetch gateway config:", e);
      }

      // Pre-persist order doc client side using user's authenticated Session to handle sandbox DB bounds
      const txnId = `TXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const downloadToken = crypto.randomUUID();
      const orderItems = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        size: p.size || null,
        quantity: p.quantity
      }));

      await setDoc(doc(db, "orders", txnId), {
        userId,
        productIds: products.map((p: any) => p.id),
        items: orderItems,
        productName: orderItems.length === 1 ? (orderItems[0].size ? `${orderItems[0].name} (${orderItems[0].size})` : orderItems[0].name) : `${orderItems.length} Products`,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        deliveryAddress: customerInfo.address || "N/A",
        division: customerInfo.division || "",
        district: customerInfo.district || "",
        upazila: customerInfo.upazila || "",
        union: customerInfo.union || "",
        village: customerInfo.village || "",
        paymentMethod: "SSLCommerz",
        status: "pending_payment", 
        amount: subtotal,
        grossAmount: subtotal,
        discountAmount: discountAmount || 0,
        netAmount: amount,
        couponCode: appliedCoupon?.code || null,
        isPaid: false,
        downloadToken,
        createdAt: serverTimestamp(),
        transactionId: txnId,
        paymentGatewayId: "sslcommerz"
      });

      const res = await fetch("/api/payment/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway: "sslcommerz",
          txnId, // PASS THE DYNAMICALLY GENERATED PRE-SAVED ID
          userId,
          products,
          customerInfo,
          subtotal,
          amount,
          couponCode: appliedCoupon?.code || null,
          discountAmount: discountAmount || 0,
          clientCredentials
        })
      });

      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl; 
      } else {
        throw new Error(data.error || "Failed to initialize secure checkout session.");
      }
    } catch (err: any) {
      setError(err.message || "An expected network occurrence took place. Please retry.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Premium Receipt Breakdown */}
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-900 p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex justify-between items-center text-xs font-medium text-gray-500 dark:text-gray-400">
          <span>Order Subtotal</span>
          <span className="font-mono text-gray-900 dark:text-gray-100">৳{subtotal.toLocaleString()}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span>Coupon Discount</span>
            <span className="font-mono font-bold">-৳{discountAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="border-t border-dashed border-gray-200 dark:border-gray-800 my-2 pt-2 flex justify-between items-center">
          <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200">Total Payable Amount</span>
          <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 font-mono">
            ৳{amount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* SSLCommerz Channel Selector Showcase */}
      <div className="bg-gradient-to-b from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-indigo-950/10 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800/60 text-left space-y-4 shadow-inner">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-100 dark:bg-rose-950/40 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h4 className="text-[10px] sm:text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">SSLCommerz Sandbox</h4>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Verified Gateway Network</p>
            </div>
          </div>
          <span className="text-[8px] font-extrabold uppercase tracking-widest text-[#d12053] bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-full border border-rose-100/30">
            Secure 256-Bit
          </span>
        </div>
        
        <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
          Pay instantly via credit cards, net banking, or local digital wallets:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {[
            { name: "bKash", type: "mfs", color: "text-[#D12053] hover:bg-rose-50 dark:hover:bg-rose-950/20 bg-rose-50/20 hover:border-rose-300" },
            { name: "Nagad", type: "mfs", color: "text-[#F86214] hover:bg-orange-50 dark:hover:bg-orange-950/20 bg-orange-50/20 hover:border-orange-300" },
            { name: "Rocket", type: "mfs", color: "text-[#8C3494] hover:bg-purple-50 dark:hover:bg-purple-950/20 bg-purple-50/20 hover:border-purple-300" },
            { name: "Upay", type: "mfs", color: "text-[#FFC400] hover:bg-yellow-50 dark:hover:bg-yellow-950/20 bg-yellow-50/20 hover:border-yellow-300" },
            { name: "Visa Card", type: "card", color: "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 bg-blue-50/20 hover:border-blue-300" },
            { name: "MasterCard", type: "card", color: "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 bg-red-50/20 hover:border-red-300" },
            { name: "AMEX Card", type: "card", color: "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 bg-blue-50/20 hover:border-blue-300" },
            { name: "NetBanking", type: "bank", color: "text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/20 bg-teal-50/20 hover:border-teal-300" }
          ].map((chan) => (
            <div 
              key={chan.name} 
              className={cn(
                "group cursor-pointer bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 p-2.5 rounded-xl text-center transition-all duration-300 shadow-sm flex flex-col items-center justify-center gap-1 hover:-translate-y-0.5 hover:shadow-md",
                chan.color
              )}
            >
              <span className="text-[10px] font-black tracking-wider uppercase">{chan.name}</span>
              <span className="text-[7px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold font-mono">{chan.type}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold border border-red-100 dark:border-red-900/40 shadow-sm animate-pulse">
          ⚠️ {error}
        </div>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={isLoading}
        className="w-full relative overflow-hidden bg-gradient-to-r from-slate-900 to-[#d12053] text-white py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-lg shadow-rose-200/50 dark:shadow-none hover:-translate-y-1 hover:brightness-110 active:translate-y-0 active:scale-[0.99] transition-all duration-300 disabled:opacity-50 disabled:translate-y-0 disabled:scale-100 flex items-center justify-center gap-2.5"
      >
        <div className="absolute inset-0 bg-white/5 opacity-0 hover:opacity-100 transition-opacity duration-300" />
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            Generating SSLCommerz Handshake...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 text-rose-300" />
            <span>Pay Securely via SSLCommerz (৳{amount.toLocaleString()})</span>
          </>
        )}
      </button>

      {/* Security note guarantees */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>100% Encrypted Connection Verified by SSLCommerz</span>
      </div>
    </div>
  );
}

function ShurjoPayForm({ products, userId, customerInfo, subtotal, amount, appliedCoupon, discountAmount, onSuccess }: { products: Product[], userId: string, customerInfo: { name: string; email: string; phone: string; address: string; division: string; district: string; upazila: string; union: string; village: string; }, subtotal: number, amount: number, appliedCoupon?: any, discountAmount?: number, onSuccess?: (orderId: string) => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async () => {
    setError("");
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.email || !customerInfo.division || !customerInfo.district) {
      setError("Please complete your Billing & Shipping details (Name, Phone, Email, Address) at the top of the page first.");
      return;
    }
    setIsLoading(true);

    try {
      // Fetch gateway settings directly on client-side as resilient fallback for Cloud Run environments
      let clientCredentials = null;
      try {
        const gatewaySnap = await getDoc(doc(db, "payment_gateways", "shurjopay"));
        if (gatewaySnap.exists()) {
          clientCredentials = gatewaySnap.data();
        }
      } catch (e) {
        console.warn("Client failed to fetch gateway config:", e);
      }

      // Pre-persist order doc client side using user's authenticated Session to handle sandbox DB bounds
      const txnId = `TXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const downloadToken = crypto.randomUUID();
      const orderItems = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        size: p.size || null,
        quantity: p.quantity
      }));

      await setDoc(doc(db, "orders", txnId), {
        userId,
        productIds: products.map((p: any) => p.id),
        items: orderItems,
        productName: orderItems.length === 1 ? (orderItems[0].size ? `${orderItems[0].name} (${orderItems[0].size})` : orderItems[0].name) : `${orderItems.length} Products`,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        deliveryAddress: customerInfo.address || "N/A",
        division: customerInfo.division || "",
        district: customerInfo.district || "",
        upazila: customerInfo.upazila || "",
        union: customerInfo.union || "",
        village: customerInfo.village || "",
        paymentMethod: "ShurjoPay",
        status: "pending_payment", 
        amount: subtotal,
        grossAmount: subtotal,
        discountAmount: discountAmount || 0,
        netAmount: amount,
        couponCode: appliedCoupon?.code || null,
        isPaid: false,
        downloadToken,
        createdAt: serverTimestamp(),
        transactionId: txnId,
        paymentGatewayId: "shurjopay"
      });

      const res = await fetch("/api/payment/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway: "shurjopay",
          txnId, // PASS THE DYNAMICALLY GENERATED PRE-SAVED ID
          userId,
          products,
          customerInfo,
          subtotal,
          amount,
          couponCode: appliedCoupon?.code || null,
          discountAmount: discountAmount || 0,
          clientCredentials
        })
      });

      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl; 
      } else {
        throw new Error(data.error || "Failed to initialize secure checkout session.");
      }
    } catch (err: any) {
      setError(err.message || "An expected network occurrence took place. Please retry.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Premium Receipt Breakdown */}
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-900 p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex justify-between items-center text-xs font-medium text-gray-500 dark:text-gray-400">
          <span>Order Subtotal</span>
          <span className="font-mono text-gray-900 dark:text-gray-100">৳{subtotal.toLocaleString()}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span>Coupon Discount</span>
            <span className="font-mono font-bold">-৳{discountAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="border-t border-dashed border-gray-200 dark:border-gray-800 my-2 pt-2 flex justify-between items-center">
          <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200">Total Payable Amount</span>
          <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
            ৳{amount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ShurjoPay Channel Selector Showcase */}
      <div className="bg-gradient-to-b from-slate-50 to-emerald-50/30 dark:from-slate-950 dark:to-emerald-950/10 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800/60 text-left space-y-4 shadow-inner">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/40 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="text-[10px] sm:text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">shurjopay Sandbox</h4>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Verified Payment Network</p>
            </div>
          </div>
          <span className="text-[8px] font-extrabold uppercase tracking-widest text-[#10b981] bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-100/30">
            Secure 256-Bit
          </span>
        </div>
        
        <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
          Pay instantly via credit cards, net banking, or local digital wallets:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {[
            { name: "bKash", type: "mfs", color: "text-[#D12053] hover:bg-rose-50 dark:hover:bg-rose-950/20 bg-rose-50/20 hover:border-rose-300" },
            { name: "Nagad", type: "mfs", color: "text-[#F86214] hover:bg-orange-50 dark:hover:bg-orange-950/20 bg-orange-50/20 hover:border-orange-300" },
            { name: "Rocket", type: "mfs", color: "text-[#8C3494] hover:bg-purple-50 dark:hover:bg-purple-950/20 bg-purple-50/20 hover:border-purple-300" },
            { name: "Upay", type: "mfs", color: "text-[#FFC400] hover:bg-yellow-50 dark:hover:bg-yellow-950/20 bg-yellow-50/20 hover:border-yellow-300" },
            { name: "Visa Card", type: "card", color: "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 bg-blue-50/20 hover:border-blue-300" },
            { name: "MasterCard", type: "card", color: "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 bg-red-50/20 hover:border-red-300" },
            { name: "AMEX Card", type: "card", color: "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 bg-blue-50/20 hover:border-blue-300" },
            { name: "NetBanking", type: "bank", color: "text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/20 bg-teal-50/20 hover:border-teal-300" }
          ].map((chan) => (
            <div 
              key={chan.name} 
              className={cn(
                "group cursor-pointer bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 p-2.5 rounded-xl text-center transition-all duration-300 shadow-sm flex flex-col items-center justify-center gap-1 hover:-translate-y-0.5 hover:shadow-md",
                chan.color
              )}
            >
              <span className="text-[10px] font-black tracking-wider uppercase">{chan.name}</span>
              <span className="text-[7px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold font-mono">{chan.type}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold border border-red-100 dark:border-red-900/40 shadow-sm animate-pulse">
          ⚠️ {error}
        </div>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={isLoading}
        className="w-full relative overflow-hidden bg-gradient-to-r from-slate-900 to-[#10b981] text-white py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-lg shadow-emerald-200/50 dark:shadow-none hover:-translate-y-1 hover:brightness-110 active:translate-y-0 active:scale-[0.99] transition-all duration-300 disabled:opacity-50 disabled:translate-y-0 disabled:scale-100 flex items-center justify-center gap-2.5"
      >
        <div className="absolute inset-0 bg-white/5 opacity-0 hover:opacity-100 transition-opacity duration-300" />
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            Generating shurjopay Handshake...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 text-emerald-300" />
            <span>Pay Securely via shurjopay (৳{amount.toLocaleString()})</span>
          </>
        )}
      </button>

      {/* Security note guarantees */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>100% Encrypted Connection Verified by shurjopay</span>
      </div>
    </div>
  );
}
