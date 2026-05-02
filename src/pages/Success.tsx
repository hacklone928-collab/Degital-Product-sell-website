import { useLocation, Link, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { CheckCircle, Download, ShoppingBag, ArrowRight, Zap, Mail, Clock, ShieldCheck, FileText } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

export default function Success() {
  const location = useLocation();
  const { orderId, token, productName, status } = location.state || {};

  useEffect(() => {
    if (orderId) {
      import("canvas-confetti").then((confetti) => {
        confetti.default({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#6366f1", "#a855f7", "#ec4899"]
        });
      });
    }
  }, [orderId]);

  if (!orderId) return <Navigate to="/" />;

  const isPending = status === "pending";
  const downloadUrl = `/api/download/${orderId}?token=${token}`;

  return (
    <div className="max-w-3xl mx-auto py-12 md:py-20 text-center space-y-12">
      <div className="space-y-4">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 10 }}
          className="flex justify-center"
        >
          <div className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center shadow-inner",
            isPending ? "bg-amber-100" : "bg-green-100"
          )}>
            {isPending ? (
              <Clock className="w-12 h-12 text-amber-600 animate-pulse" />
            ) : (
              <CheckCircle className="w-12 h-12 text-green-600" />
            )}
          </div>
        </motion.div>
        
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight uppercase px-4">
            {isPending ? "Order Submitted!" : "Payment Successful!"}
          </h1>
          <p className="text-gray-500 text-sm sm:text-lg font-medium px-4">
            {isPending 
              ? "Your request is being reviewed by our team." 
              : "Thank you for your purchase. Your digital assets are ready."}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[32px] sm:rounded-[40px] border-2 border-gray-100 p-6 md:p-12 shadow-2xl shadow-indigo-100 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50" />
        
        <div className="space-y-4 relative">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-[10px] font-black border border-indigo-100 uppercase tracking-widest">
            <Zap className="w-4 h-4 fill-current" />
            Order #{orderId.slice(-8).toUpperCase()}
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter">{productName}</h3>
          
          {isPending ? (
            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 text-left space-y-3">
              <div className="flex items-center gap-3 text-amber-900 font-bold">
                <ShieldCheck className="w-5 h-5" /> Manual Verification Required
              </div>
              <p className="text-sm text-amber-700 leading-relaxed font-medium">
                We've received your transaction details. An administrator will verify your payment and release the product. 
                You will find your purchased products in the <b>"My Products"</b> section once confirmed.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Download link expires in 24 hours.</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3">
          {isPending ? (
            <Link 
              to="/my-products"
              className="w-full sm:w-auto sm:flex-grow sm:max-w-xs flex items-center justify-center gap-3 bg-indigo-600 text-white px-8 py-4 sm:py-5 rounded-2xl sm:rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
            >
              <ShoppingBag className="w-5 h-5" />
              My Products
            </Link>
          ) : (
            <a 
              href={downloadUrl}
              className="w-full sm:w-auto sm:flex-grow sm:max-w-xs flex items-center justify-center gap-3 bg-emerald-600 text-white px-8 py-4 sm:py-5 rounded-2xl sm:rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
            >
              <Download className="w-5 h-5" />
              Download
            </a>
          )}
          <Link 
            to={`/invoice/${orderId}`}
            className="w-full sm:w-auto sm:flex-grow sm:max-w-[180px] flex items-center justify-center gap-3 bg-gray-50 text-gray-700 border-2 border-gray-100 px-8 py-4 sm:py-5 rounded-2xl sm:rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-white hover:border-indigo-100 transition-all"
          >
            <FileText className="w-5 h-5 text-indigo-600" />
            Invoice
          </Link>
        </div>
        
        <div className="pt-8 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4 text-left">
            <div className="p-3 bg-gray-50 rounded-xl">
              <Mail className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-gray-900">Email Receipt</h4>
              <p className="text-xs text-gray-500">We've sent a detailed receipt to your registered email address.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 text-left">
            <div className="p-3 bg-gray-50 rounded-xl">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-gray-900">Purchase History</h4>
              <p className="text-xs text-gray-500">Access your past purchases anytime via your account dashboard.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-8">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:gap-4 transition-all"
        >
          Keep Browsing Marketplace <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
