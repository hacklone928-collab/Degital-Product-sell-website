import React, { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { db, auth } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Printer, Download, ArrowLeft, ShieldCheck, Zap, Mail, Calendar, Hash, CreditCard, Phone, Package } from "lucide-react";
import { motion } from "motion/react";

interface Order {
  id: string;
  userId: string;
  productName: string;
  amount: number;
  status: string;
  paymentMethod: string;
  transactionId: string;
  createdAt: any;
  customerEmail?: string;
  customerName?: string;
  deliveryAddress?: string;
  email?: string;
}

export default function Invoice() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!orderId) return;
      try {
        const [orderSnap, settingsSnap] = await Promise.all([
          getDoc(doc(db, "orders", orderId)),
          getDoc(doc(db, "settings", "site"))
        ]);

        if (orderSnap.exists()) {
          setOrder({ id: orderSnap.id, ...orderSnap.data() });
        }
        if (settingsSnap.exists()) {
          setSettings(settingsSnap.data());
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 transition-colors duration-500">
        <div className="w-12 h-12 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const superAdminEmails = ["businessonline.6251@gmail.com", "hacklone928@gmail.com"];
  const isAuthorized = auth.currentUser?.uid === order?.userId || 
                      superAdminEmails.includes(auth.currentUser?.email || "");

  if (!order || !isAuthorized) {
    return <Navigate to="/" />;
  }

  const invoiceTitle = settings?.invoiceTitle || "Official Invoice";
  const invoiceSubtitle = settings?.invoiceSubtitle || "Digital Asset Purchase";
  const invoiceFooter = settings?.invoiceFooter || "Thank you for choosing our platform for your digital assets.";
  const invoiceNote = settings?.invoiceNote || "This is a computer generated invoice and does not require a physical signature.";

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = order.createdAt?.toDate 
    ? order.createdAt.toDate().toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) 
    : 'N/A';

  const subtotal = order.grossAmount || order.amount || 0;
  const discount = order.discountAmount || 0;
  const total = order.netAmount || (subtotal - discount);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4 md:px-0 transition-colors duration-500">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation / Actions Bar */}
        <div className="flex justify-between items-center no-print">
          <Link to="/my-products" className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-bold group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to my products
          </Link>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>

        {/* Invoice Body */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden"
        >
          {/* Header */}
          <div className="p-8 md:p-12 bg-indigo-600 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full -ml-24 -mb-24 blur-2xl" />
            
            <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h1 className="text-3xl font-black tracking-tighter uppercase">{invoiceTitle}</h1>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-indigo-100/80 text-xs font-bold uppercase tracking-widest">
                    <Hash className="w-3.5 h-3.5 font-bold" /> #{order.id.slice(-8).toUpperCase()}
                  </div>
                  <div className="flex items-center gap-2 text-indigo-100/80 text-xs font-bold uppercase tracking-widest">
                    <Calendar className="w-3.5 h-3.5" /> {formattedDate}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black">৳{total.toLocaleString()}</div>
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 border border-white/30">
                  {order.status === "completed" ? "Paid" : "Pending"}
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-12 space-y-12">
            {/* Meta Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">Billed To</h4>
                <div className="space-y-2">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{order.customerName || "Customer"}</div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-medium text-sm">
                    <Mail className="w-4 h-4 text-indigo-500" /> {order.customerEmail || order.email}
                  </div>
                  {order.customerPhone && (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-medium text-sm">
                      <Phone className="w-4 h-4 text-indigo-500" /> {order.customerPhone}
                    </div>
                  )}
                  {order.deliveryAddress && (
                    <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                      <h5 className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Delivery Address</h5>
                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-[280px]">
                        {order.village && <p><span className="font-bold text-gray-900 dark:text-gray-200">Village:</span> {order.village}</p>}
                        {order.union && <p><span className="font-bold text-gray-900 dark:text-gray-200">Union:</span> {order.union}</p>}
                        <p><span className="font-bold text-gray-900 dark:text-gray-200">Area:</span> {order.upazila}, {order.district}</p>
                        <p><span className="font-bold text-gray-900 dark:text-gray-200">Division:</span> {order.division}</p>
                        {order.deliveryAddress !== "N/A" && <p className="mt-2 text-xs italic">{order.deliveryAddress}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4 text-left md:text-right">
                <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">Payment Details</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 md:justify-end text-gray-900 dark:text-white font-bold">
                    <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> {order.paymentMethod?.toUpperCase() || "MANUAL"}
                  </div>
                  <div className="text-xs font-bold text-gray-400 font-mono">TXN: {order.transactionId || "N/A"}</div>
                </div>
              </div>
            </div>

            {/* Item Table */}
            <div className="bg-gray-50 dark:bg-gray-950/50 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left">
                <thead className="bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 text-[10px] uppercase font-black text-gray-400 dark:text-gray-500 tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                    order.items.map((item: any, i: number) => {
                      const itemSubtotal = (Number(item.price || 0) * (item.quantity || 1));
                      return (
                        <tr key={item.id || i}>
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-2xl flex items-center justify-center shadow-sm border border-gray-50 dark:border-gray-800">
                                <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 dark:text-white">{item.name || "Product Item"}</div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {item.size && (
                                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40 uppercase tracking-widest">
                                      Size: {item.size}
                                    </span>
                                  )}
                                  {item.quantity && (
                                    <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900/40 uppercase tracking-widest">
                                      Qty: {item.quantity}
                                    </span>
                                  )}
                                  {item.quantity > 1 && (
                                    <span className="text-[9px] font-medium text-gray-400">
                                      (৳{Number(item.price || 0).toLocaleString()} each)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-6 text-right font-black text-gray-900 dark:text-white">
                            ৳{itemSubtotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-6 py-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-2xl flex items-center justify-center shadow-sm border border-gray-50 dark:border-gray-800">
                            <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">{order.productName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{invoiceSubtitle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-8 text-right font-black text-gray-900 dark:text-white">
                        ৳{subtotal.toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-white/50 dark:bg-gray-900/50 space-y-1">
                  <tr>
                    <td className="px-6 py-3 text-right font-bold text-gray-400 dark:text-gray-500 uppercase text-[9px] tracking-widest">Subtotal</td>
                    <td className="px-6 py-3 text-right font-bold text-gray-900 dark:text-white text-sm">৳{subtotal.toLocaleString()}</td>
                  </tr>
                  {discount > 0 && (
                    <tr>
                      <td className="px-6 py-3 text-right font-bold text-emerald-500 uppercase text-[9px] tracking-widest">Discount</td>
                      <td className="px-6 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">-৳{discount.toLocaleString()}</td>
                    </tr>
                  )}
                  <tr className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-6 py-6 text-right font-bold text-gray-500 dark:text-gray-400 uppercase text-[10px] tracking-widest">Total Net Amount</td>
                    <td className="px-6 py-6 text-right font-black text-2xl text-indigo-600 dark:text-indigo-400">৳{total.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="pt-12 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest">
                <ShieldCheck className="w-5 h-5 font-black" /> Verified Purchase
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium max-w-sm ml-auto">{invoiceFooter}</p>
                <Link to="/" className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline mt-1 inline-block">Visit Marketplace</Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Note for User */}
        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 text-center no-print">
          <p className="text-xs sm:text-sm text-indigo-700 dark:text-indigo-300 font-medium italic">
            {invoiceNote}
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .min-h-screen { min-height: auto !important; height: auto !important; padding: 0 !important; }
          .max-w-3xl { max-width: 100% !important; margin: 0 !important; space-y: 0 !important; }
          .rounded-[40px] { border-radius: 0 !important; border: none !important; box-shadow: none !important; }
          .p-8, .p-12 { padding: 40px !important; }
          .bg-indigo-600 { background-color: #4f46e5 !important; -webkit-print-color-adjust: exact; color: white !important; }
          .shadow-2xl { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
