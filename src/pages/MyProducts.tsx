import React, { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Package, Download, ExternalLink, ShieldCheck, Clock, CheckCircle2, User, Key, Copy, Check, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router-dom";

interface Order {
  id: string;
  status: string;
  productName: string;
  amount: number;
  productIds: string[];
  createdAt: any;
  items?: { id: string, name: string }[];
  downloadToken?: string;
  credentials?: { [key: string]: { username?: string, password?: string } };
  adminNote?: string;
}

interface Product {
  id: string;
  name: string;
  fileUrl?: string;
}

export default function MyProducts() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMyOrdersAndProducts = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        // Fetch Orders
        const q = query(
          collection(db, "orders"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const orderData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
        setOrders(orderData);

        // Fetch All unique product IDs from orders
        const allProductIds = Array.from(new Set(orderData.flatMap(o => o.productIds || [])));
        
        if (allProductIds.length > 0) {
          // Fetch product details for all these IDs
          const productsSnap = await getDocs(collection(db, "products"));
          const pMap: Record<string, Product> = {};
          productsSnap.docs.forEach(doc => {
            if (allProductIds.includes(doc.id)) {
              pMap[doc.id] = { id: doc.id, ...doc.data() } as Product;
            }
          });
          setProductsMap(pMap);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyOrdersAndProducts();
  }, [navigate]);

  const handleDownload = (fileUrl?: string) => {
    if (!fileUrl) {
      alert("No download link available for this product yet. Please contact support.");
      return;
    }
    window.open(fileUrl, "_blank");
  };

  const CopyableField = ({ label, value, icon: Icon }: { label: string, value: string, icon: any }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="flex flex-col gap-1 flex-grow">
        <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">{label}</span>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-700 group/field relative transition-colors">
          <Icon className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-500" />
          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 font-mono truncate max-w-[120px]">{value}</span>
          <button 
            onClick={handleCopy}
            className="ml-auto p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-[10px]">Loading Your Products...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-10 px-4 sm:px-0 space-y-8 sm:space-y-12">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 bg-indigo-600 text-white rounded-2xl sm:rounded-3xl shadow-xl shadow-indigo-100 dark:shadow-none">
          <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>
        <div>
          <h1 className="text-xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase transition-colors">My Virtual Assets</h1>
          <p className="text-[10px] sm:text-base text-gray-500 dark:text-gray-400 font-medium">Access and manage all your purchased digital goods.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {orders.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[40px] border-2 border-dashed border-gray-200 dark:border-gray-800 transition-colors">
            <Package className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">No purchases found</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Start exploring our premium marketplace.</p>
            <Link to="/" className="inline-block mt-6 px-10 py-4 bg-indigo-600 text-white rounded-full font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">
              Browse Marketplace
            </Link>
          </div>
        ) : (
          orders.map((order, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={order.id}
              className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 p-8 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
            >
              <div className="flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Order ID: #{order.id.slice(-8).toUpperCase()}</span>
                        {order.status === "completed" ? (
                          <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full uppercase tracking-widest">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        ) : order.status === "returned" ? (
                          <span className="flex items-center gap-1 text-[9px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded-full uppercase tracking-widest">
                            <Clock className="w-3 h-3 text-rose-500" /> Returned
                          </span>
                        ) : order.status === "cancelled" ? (
                          <span className="flex items-center gap-1 text-[9px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded-full uppercase tracking-widest">
                            <Clock className="w-3 h-3 text-rose-500" /> Cancelled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-full uppercase tracking-widest animate-pulse">
                            <Clock className="w-3 h-3" /> Pending Approval
                          </span>
                        )}
                      </div>
                      <Link 
                        to={`/invoice/${order.id}`}
                        className="flex items-center gap-1 text-[9px] font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 px-3 py-1 rounded-full uppercase tracking-widest transition-all border border-indigo-100 dark:border-indigo-900/50"
                      >
                        <FileText className="w-3 h-3" /> Invoice
                      </Link>
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                  </div>
                </div>
                
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight transition-colors">
                    {order.productName}
                  </h3>

                  <div className="grid grid-cols-1 gap-3">
                    {(order.productIds || []).map((pId) => {
                      const product = productsMap[pId];
                      const creds = order.credentials?.[pId];
                      
                      return (
                        <div key={pId} className="flex flex-col p-4 bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 gap-4 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center shadow-sm border border-gray-50 dark:border-gray-800 transition-colors">
                                <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                {product?.name || "Loading product info..."}
                              </span>
                            </div>
                            
                            {order.status === "completed" ? (
                              <button 
                                onClick={() => handleDownload(product?.fileUrl)}
                                className="px-6 py-2.5 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white transition-all shadow-sm shadow-indigo-100/10"
                              >
                                <Download className="w-3.5 h-3.5" /> Download Asset
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-white dark:bg-gray-900 px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                                Link pending
                              </span>
                            )}
                          </div>

                          {order.status === "completed" && creds && (creds.username || creds.password) && (
                            <div className="pt-4 border-t border-gray-200/50 dark:border-gray-800 flex flex-wrap gap-4">
                              {creds.username && (
                                <CopyableField label="Login ID" value={creds.username} icon={User} />
                              )}
                              {creds.password && (
                                <CopyableField label="Password" value={creds.password} icon={Key} />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {order.adminNote && order.status === "completed" && (
                  <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 space-y-3">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest px-1">
                      <ShieldCheck className="w-4 h-4" /> Message from Admin
                    </div>
                    <div className="bg-white dark:bg-gray-900/60 p-5 rounded-2xl border border-indigo-200/50 dark:border-indigo-900/50 shadow-sm">
                      <p className="text-sm text-gray-700 dark:text-gray-300 font-medium whitespace-pre-wrap leading-relaxed">
                        {order.adminNote}
                      </p>
                    </div>
                  </div>
                )}

                {order.status !== "completed" && (
                  <div className="pt-4 border-t border-gray-50 dark:border-gray-800">
                    {order.status === "returned" || order.status === "cancelled" ? (
                      <p className="text-[11px] text-rose-600 dark:text-rose-500 font-bold leading-snug flex items-center gap-2">
                        <Clock className="w-4 h-4 text-rose-500" /> This order was returned/cancelled. Access to file downloads and credentials has been revoked.
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-600 dark:text-amber-500 font-bold leading-snug flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Admin is verifying your payment. Download links will appear here once confirmed.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
