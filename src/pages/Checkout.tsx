import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User } from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { ShieldCheck, Lock, CreditCard, ArrowLeft, Loader2, PackageCheck, Wallet, ShoppingBag, Check, Copy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { useCart } from "../lib/CartContext";
import { useSettings } from "../lib/SettingsContext";

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
  const [products, setProducts] = useState<Product[]>([]);
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [gateway, setGateway] = useState<PaymentGateway>("stripe");

  useEffect(() => {
    if (!user) {
      navigate("/auth", { state: { from: { pathname: isCartCheckout ? "/cart-checkout" : `/checkout/${id}` } } });
      return;
    }

    const fetchProductAndIntent = async () => {
      try {
        let checkoutProducts: Product[] = [];
        let totalAmount = 0;

        if (isCartCheckout) {
          if (cartItems.length === 0) {
            navigate("/");
            return;
          }
          checkoutProducts = cartItems;
          totalAmount = cartTotal;
        } else {
          const prodDoc = await getDoc(doc(db, "products", id!));
          if (prodDoc.exists()) {
            const prodData = { id: prodDoc.id, ...prodDoc.data() } as Product;
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
  }, [id, user, navigate, isCartCheckout, cartItems, cartTotal]);

  const totalAmount = isCartCheckout ? cartTotal : (products[0]?.price || 0);

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-6xl mx-auto py-8">
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
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium font-mono">৳{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Platform Fee</span>
              <span className="text-green-600 font-bold font-mono">FREE</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-4 border-t border-gray-200">
              <span>Total Amount</span>
              <span className="font-mono">৳{totalAmount.toLocaleString()}</span>
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
      <div className="lg:col-span-7 space-y-8 order-1 lg:order-2">
        <section className="bg-white rounded-3xl p-8 md:p-10 border-2 border-indigo-100 shadow-2xl shadow-indigo-100/50 space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Payment Method</h2>
            <p className="text-sm text-gray-500">Select how you want to pay.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setGateway("stripe")}
              className={cn(
                "p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all",
                gateway === "stripe" ? "border-indigo-600 bg-indigo-50/50" : "border-gray-100 hover:border-gray-200"
              )}
            >
              <CreditCard className={cn("w-6 h-6", gateway === "stripe" ? "text-indigo-600" : "text-gray-400")} />
              <div className="text-sm font-bold">Stripe / Cards</div>
            </button>
            <button 
              onClick={() => setGateway("local")}
              className={cn(
                "p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all",
                gateway === "local" ? "border-pink-600 bg-pink-50/50" : "border-gray-100 hover:border-gray-200"
              )}
            >
              <Wallet className={cn("w-6 h-6", gateway === "local" ? "text-pink-600" : "text-gray-400")} />
              <div className="text-sm font-bold">Local (bKash/Nagad)</div>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {gateway === "stripe" ? (
              <motion.div
                key="stripe"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripeForm 
                      products={products}
                      userId={user?.uid!} 
                      userEmail={user?.email || "No Email"}
                      userName={user?.displayName || "Anonymous User"}
                      amount={totalAmount} 
                      onSuccess={() => isCartCheckout && clearCart()}
                    />
                  </Elements>
                ) : (
                  <div className="p-8 text-center text-gray-500 italic">Initializing Stripe...</div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="local"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <LocalForm 
                  products={products}
                  userId={user?.uid!} 
                  userEmail={user?.email || "No Email"}
                  userName={user?.displayName || "Anonymous User"}
                  amount={totalAmount}
                  onSuccess={() => isCartCheckout && clearCart()}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

function StripeForm({ products, userId, userEmail, userName, amount, onSuccess }: { products: Product[], userId: string, userEmail: string, userName: string, amount: number, onSuccess?: () => void }) {
  const productIds = products.map(p => p.id);
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

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
          customerEmail: userEmail,
          customerName: userName,
          status: "completed",
          amount,
          paymentIntentId: paymentIntent.id,
          downloadToken,
          gateway: "stripe",
          createdAt: serverTimestamp(),
        });
        
        onSuccess?.();
        navigate("/success", { 
          state: { 
            orderId: orderRef.id, 
            token: downloadToken,
            productName: productIds.length > 1 ? `${productIds.length} Products` : "Your Digital Product" 
          } 
        });
      } catch (err) {
        setMessage("Order processing failed.");
        setIsLoading(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {message && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">{message}</div>}
      <button
        disabled={isLoading || !stripe || !elements}
        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
        Confirm Stripe Order
      </button>
    </form>
  );
}

function LocalForm({ products, userId, userEmail, userName, amount, onSuccess }: { products: Product[], userId: string, userEmail: string, userName: string, amount: number, onSuccess?: () => void }) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
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
    if (!phone || !transactionId) {
      alert("Please enter both your payment number and transaction ID.");
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
        customerEmail: userEmail,
        customerName: userName,
        customerPhone: phone,
        transactionId: transactionId,
        paymentMethod: selectedMethod,
        status: "pending", // Set to pending for manual confirmation
        amount,
        createdAt: serverTimestamp(),
      });

      onSuccess?.();
      navigate("/success", { 
        state: { 
          orderId: orderRef.id, 
          status: "pending",
          productName: orderItems.length === 1 ? orderItems[0].name : `${orderItems.length} Products`
        } 
      });
    } catch (error) {
      console.error("Manual Checkout Error:", error);
      alert("Failed to place order. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
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
              "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
              selectedMethod === method.id 
                ? "border-pink-600 bg-pink-50" 
                : "border-gray-100 bg-white hover:border-gray-200"
            )}
          >
            {method.logo ? (
              <div className="w-12 h-12 flex items-center justify-center p-1">
                <img src={method.logo} alt={method.id} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center font-black text-xs uppercase text-gray-400">
                {method.id[0]}
              </div>
            )}
            <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-gray-500">{method.id}</span>
          </button>
        ))}
      </div>

      <div className="bg-indigo-50 p-6 rounded-3xl space-y-4 border border-indigo-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-1 shadow-sm border border-indigo-100">
              {selectedMethod === "bkash" && settings.bkashLogo ? <img src={settings.bkashLogo} className="max-w-full max-h-full object-contain" /> : 
               selectedMethod === "nagad" && settings.nagadLogo ? <img src={settings.nagadLogo} className="max-w-full max-h-full object-contain" /> :
               selectedMethod === "rocket" && settings.rocketLogo ? <img src={settings.rocketLogo} className="max-w-full max-h-full object-contain" /> :
               <Wallet className="w-6 h-6 text-indigo-400" />}
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Send Money to</div>
              <div className="text-xl font-mono font-black text-indigo-900 tracking-wider transition-all">
                {getAdminNumber()}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="p-3 bg-white text-indigo-600 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-[11px] text-indigo-600/70 leading-relaxed font-medium">
          Please send <b>৳{amount.toLocaleString()}</b> manually using your {selectedMethod} app to the number above. Then provide the details below to confirm.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <div className="p-3 bg-white rounded-xl shadow-sm">
            <Wallet className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-grow">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Your Payment Number</div>
            <input 
              type="tel"
              placeholder="017xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 outline-none placeholder:text-gray-300 font-mono font-bold"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <div className="p-3 bg-white rounded-xl shadow-sm">
            <ShoppingBag className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-grow">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Transaction ID</div>
            <input 
              type="text"
              placeholder="TRX12345678"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 outline-none placeholder:text-gray-300 font-mono font-bold uppercase"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full bg-pink-600 text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-pink-100 hover:bg-pink-700 transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
      >
        {isLoading ? "Submitting..." : `Confirm Payment - ৳${amount.toLocaleString()}`}
      </button>
    </div>
  );
}
