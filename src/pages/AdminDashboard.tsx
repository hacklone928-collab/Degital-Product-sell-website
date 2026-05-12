import React, { useState, useEffect } from "react";
import { db, storage, auth } from "../lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, serverTimestamp, updateDoc, query, where, increment, onSnapshot, orderBy, limit, collectionGroup } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Plus, Package, Users, DollarSign, Trash2, Edit, Star, Database, Settings as SettingsIcon, Save, ShoppingBag, Clock, CheckCircle, Copy, Link as LinkIcon, Inbox, Mail, Search, ShieldCheck, TrendingUp, Calendar, Eye, EyeOff, ExternalLink, ImagePlus, Upload, Loader2, Phone, Ticket, Facebook, Twitter, Instagram, Youtube, Linkedin, Github, Share2, Send, Music, Pin, ChevronLeft, ChevronRight, Ban, UserX, FileText, MessageSquare } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { handleFirestoreError, OperationType } from "../lib/firestoreUtils";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"products" | "settings" | "orders" | "pages" | "tickets" | "categories" | "coupons" | "withdrawals" | "users" | "analytics" | "logs" | "reviews">("analytics");
  const [revenueTimeframe, setRevenueTimeframe] = useState<"daily" | "weekly" | "monthly">("daily");
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "last7" | "last30" | "thisMonth" | "thisYear" | "custom">("thisMonth");
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<any | null>(null);
  const [revenueTablePage, setRevenueTablePage] = useState(1);
  const [revenueSearch, setRevenueSearch] = useState("");
  const revenueTablePageSize = 10;
  const [showSalesStats, setShowSalesStats] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const lastOrderCountRef = React.useRef(0);
  const [notificationSound] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    type: "percentage" as "percentage" | "fixed",
    value: 0,
    bonusPercentage: 0,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
    assignedEmail: "",
    usageLimit: 0
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (file: File, type: "main" | "additional", target: "new" | "edit") => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      if (target === "new") {
        if (type === "main") {
          setNewProduct(prev => ({ ...prev, imageUrl: downloadURL }));
        } else {
          const current = newProduct.additionalImageUrls ? newProduct.additionalImageUrls.split(",") : [];
          setNewProduct(prev => ({ 
            ...prev, 
            additionalImageUrls: [...current, downloadURL].join(",") 
          }));
        }
      } else {
        if (type === "main") {
          setEditingProduct(prev => ({ ...prev, imageUrl: downloadURL }));
        } else {
          const current = editingProduct.additionalImageUrls ? editingProduct.additionalImageUrls.split(",") : [];
          setEditingProduct(prev => ({ 
            ...prev, 
            additionalImageUrls: [...current, downloadURL].join(",") 
          }));
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingPage, setIsAddingPage] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editingPage, setEditingPage] = useState<any | null>(null);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const [editingCredentials, setEditingCredentials] = useState<{ [key: string]: { username?: string, password?: string } }>({});
  const [editingNote, setEditingNote] = useState("");
  const [siteSettings, setSiteSettings] = useState({
    siteName: "",
    tabTitle: "",
    heroTitle: "",
    heroSubtitle: "",
    footerText: "",
    footerCopyright: "",
    footerDescription: "",
    logoUrl: "",
    faviconUrl: "",
    privacyUrl: "",
    termsUrl: "",
    supportEmail: "",
    supportPhone: "",
    supportAddress: "",
    stat1Label: "Total Users",
    stat1Value: "50k+",
    stat2Label: "Digital Assets",
    stat2Value: "1,200+",
    stat3Label: "Success Rate",
    stat3Value: "99.9%",
    showHero: true,
    heroTitleSizeMobile: "28px",
    heroTitleSizeDesktop: "60px",
    heroSubtitleSizeMobile: "12px",
    heroSubtitleSizeDesktop: "18px",
    heroTitleColor: "#ffffff",
    heroSubtitleColor: "#ffffffcc",
    bkashNumber: "",
    nagadNumber: "",
    rocketNumber: "",
    bkashLogo: "",
    nagadLogo: "",
    rocketLogo: "",
    enableBinancePay: false,
    binanceId: "",
    binanceQR: "",
    enablePayoneer: false,
    payoneerEmail: "",
    heroBanners: [] as { id: string, imageUrl: string, title?: string, subtitle?: string, link?: string, buttonText?: string }[],
    // Ticker Settings
    showTicker: true,
    tickerBgColor: "#4f46e5",
    tickerTextColor: "#ffffff",
    tickerSpeed: 25,
    tickerText: "🔥 Top Selling Products",
    enableStripe: true,
    enableLocal: true,
    enableCOD: true,
    hiddenCategories: [] as string[],
    cartText: "Cart",
    viewText: "View",
    buyText: "Buy",
    cartColor: "#f9fafb",
    viewColor: "#f9fafb",
    buyColor: "#4f46e5",
    cartTextColor: "#6b7280",
    viewTextColor: "#6b7280",
    buyTextColor: "#ffffff",
    brandColor: "#4f46e5",
    brandSecondaryColor: "#818cf8",
    useBrandGradient: false,
    tabPermissions: {} as Record<string, string[]>,
    invoiceTitle: "Official Invoice",
    invoiceSubtitle: "Digital Asset Purchase",
    invoiceFooter: "Thank you for choosing our platform for your digital assets.",
    invoiceNote: "This is a computer generated invoice and does not require a physical signature.",
    requireReviewApproval: false,
    showReviews: true,
    socialLinks: [] as { platform: string, url: string, icon: string }[]
  });
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: 0,
    subscriptionMonthlyPrice: 0,
    subscriptionYearlyPrice: 0,
    subscriptionMonthlyText: "",
    subscriptionMonthlySubtext: "",
    subscriptionYearlyText: "",
    subscriptionYearlySubtext: "",
    subscriptionLifetimeText: "",
    subscriptionLifetimeSubtext: "",
    category: "",
    description: "",
    imageUrl: "",
    videoUrl: "",
    discountPrice: 0,
    discountEnabled: false,
    additionalImageUrls: "",
    fileUrl: "",
    enableSizes: false,
    availableSizes: "" as any,
  });

  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    icon: "Package"
  });

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isAdminChecking, setIsAdminChecking] = useState(true);

  const adminEmails = ['businessonline.6251@gmail.com', 'hacklone928@gmail.com'];
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setIsAdminChecking(true);
      setCurrentUserEmail(user?.email || null);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setCurrentUserRole(userDoc.data().role || 'user');
          }
        } catch (e) {
          console.error("Error fetching user role:", e);
        }
      } else {
        setCurrentUserRole(null);
      }
      setIsAdminChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const isSuperAdmin = currentUserRole === 'super_admin' || (currentUserEmail && adminEmails.includes(currentUserEmail.toLowerCase().trim()));
  const isAdminRole = isSuperAdmin || currentUserRole === 'admin';
  const isModeratorRole = isAdminRole || currentUserRole === 'moderator';

  // For backward compatibility with existing code
  const isAdmin = isAdminRole;
  const isActuallyAdmin = isAdminRole;

  // Role-based path/tab restriction
  useEffect(() => {
    if (!isAdminChecking && !isModeratorRole) {
      navigate("/");
    }
  }, [isAdminChecking, isModeratorRole, navigate]);

  const tabs = [
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "products", label: "Inventory", icon: Package },
    { id: "orders", label: "Sales", icon: ShoppingBag },
    { id: "users", label: "User Management", icon: Users },
    { id: "withdrawals", label: "Withdrawals", icon: DollarSign },
    { id: "coupons", label: "Coupons", icon: Ticket },
    { id: "tickets", label: "Support Tickets", icon: Inbox },
    { id: "categories", label: "Categories", icon: Pin },
    { id: "reviews", label: "Reviews", icon: MessageSquare },
    { id: "logs", label: "Activity Logs", icon: Clock },
    { id: "pages", label: "CMS Pages", icon: Database },
    { id: "settings", label: "Site Logic", icon: SettingsIcon },
  ] as const;

  const getTabRoles = (tabId: string) => {
    // Default fallback roles if not set in database
    const defaults: Record<string, string[]> = {
      analytics: ["super_admin", "admin", "moderator"],
      products: ["super_admin", "admin", "moderator"],
      orders: ["super_admin", "admin", "moderator"],
      users: ["super_admin", "admin"],
      withdrawals: ["super_admin", "admin"],
      coupons: ["super_admin", "admin", "moderator"],
      tickets: ["super_admin", "admin", "moderator"],
      categories: ["super_admin", "admin", "moderator"],
      reviews: ["super_admin", "admin", "moderator"],
      logs: ["super_admin"],
      pages: ["super_admin"],
      settings: ["super_admin"],
    };
    return siteSettings.tabPermissions?.[tabId] || defaults[tabId] || ["super_admin"];
  };

  const allowedTabs = tabs.filter(t => {
    if (isSuperAdmin) return true;
    const tabRoles = getTabRoles(t.id);
    // If user is Admin, they see everything allowed for Admin or Moderator
    if (isAdminRole && tabRoles.includes('admin')) return true;
    // If user is Moderator, they see everything allowed for Moderator
    if (isModeratorRole && tabRoles.includes('moderator')) return true;
    return false;
  });

  useEffect(() => {
    if (!isAdminChecking) {
      const isAllowed = allowedTabs.some(t => t.id === activeTab);
      if (!isAllowed && allowedTabs.length > 0) {
        setActiveTab(allowedTabs[0].id as any);
      }
    }
  }, [activeTab, allowedTabs.length, isAdminChecking, isSuperAdmin]);

  const logAdminAction = async (action: string, details: any) => {
    try {
      await addDoc(collection(db, "admin_logs"), {
        adminId: auth.currentUser?.uid,
        adminEmail: auth.currentUser?.email,
        adminRole: currentUserRole,
        action,
        details,
        createdAt: serverTimestamp(),
        ip: "untracked"
      });
    } catch (e) {
      console.error("Failed to log admin action:", e);
    }
  };

  const toggleSelectAll = () => {
    if (activeTab === "products") {
      if (selectedProductIds.length === products.length) {
        setSelectedProductIds([]);
      } else {
        setSelectedProductIds(products.map(p => p.id));
      }
    } else if (activeTab === "orders") {
      if (selectedOrderIds.length === orders.length) {
        setSelectedOrderIds([]);
      } else {
        setSelectedOrderIds(orders.map(o => o.id));
      }
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(oId => oId !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (!isModeratorRole) {
      alert("Admin/Moderator access required.");
      return;
    }
    
    if (activeTab === "products") {
      if (selectedProductIds.length === 0) return;
      if (window.confirm(`Are you sure you want to delete ${selectedProductIds.length} selected products?`)) {
        try {
          setLoading(true);
          const deletes = selectedProductIds.map(id => deleteDoc(doc(db, "products", id)));
          await Promise.all(deletes);
          const count = selectedProductIds.length;
          setSelectedProductIds([]);
          await fetchProducts();
          alert(`Successfully deleted ${count} products.`);
        } catch (error: any) {
          console.error("Bulk Delete Error:", error);
          alert(`Failed to delete products: ${error.code === 'permission-denied' ? 'Admin permissions required.' : (error.message || 'Unknown error')}`);
        } finally {
          setLoading(false);
        }
      }
    } else if (activeTab === "orders") {
      if (selectedOrderIds.length === 0) return;
      if (window.confirm(`Are you sure you want to delete ${selectedOrderIds.length} selected order records?`)) {
        try {
          setLoading(true);
          const deletes = selectedOrderIds.map(id => deleteDoc(doc(db, "orders", id)));
          await Promise.all(deletes);
          const count = selectedOrderIds.length;
          setSelectedOrderIds([]);
          await fetchOrders();
          alert(`Successfully deleted ${count} order records.`);
        } catch (error: any) {
          console.error("Orders Bulk Delete Error:", error);
          alert(`Failed to delete orders: ${error.message || 'Unknown error'}`);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const [revStats, setRevStats] = useState({
    gross: 0,
    discount: 0,
    net: 0,
    bonus: 0,
    profit: 0,
    count: 0
  });

  useEffect(() => {
    if (orders.length > 0) {
      const computed = orders.reduce((acc, o) => {
        // Only count completed/confirmed orders for revenue
        if (o.status !== 'completed' && o.status !== 'delivered') return acc;
        
        const gross = o.grossAmount || o.amount || 0;
        const discount = o.discountAmount || 0;
        const net = o.netAmount || (gross - discount);
        const bonus = o.affiliateBonus || 0;
        const profit = net - bonus;
        
        return {
          gross: acc.gross + gross,
          discount: acc.discount + discount,
          net: acc.net + net,
          bonus: acc.bonus + bonus,
          profit: acc.profit + profit,
          count: acc.count + 1
        };
      }, { gross: 0, discount: 0, net: 0, bonus: 0, profit: 0, count: 0 });
      setRevStats(computed);
    } else {
      setRevStats({ gross: 0, discount: 0, net: 0, bonus: 0, profit: 0, count: 0 });
    }
  }, [orders]);

  useEffect(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const toLocalDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let start = "";
    let end = "";

    switch (datePreset) {
      case "today": // 24h - Rolling last 24 hours
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        end = now.toISOString();
        break;
      case "yesterday": // Fixed - Previous full calendar day
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        start = toLocalDateStr(yesterday);
        end = toLocalDateStr(yesterday);
        break;
      case "last7":
        const l7 = new Date(today);
        l7.setDate(l7.getDate() - 6);
        start = toLocalDateStr(l7);
        end = toLocalDateStr(today);
        break;
      case "last30":
        const l30 = new Date(today);
        l30.setDate(l30.getDate() - 29);
        start = toLocalDateStr(l30);
        end = toLocalDateStr(today);
        break;
      case "thisMonth":
        start = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
        end = toLocalDateStr(today);
        break;
      case "thisYear":
        start = toLocalDateStr(new Date(now.getFullYear(), 0, 1));
        end = toLocalDateStr(today);
        break;
      case "custom":
        return;
      default:
        return;
    }

    setAnalyticsFilters(prev => ({
      ...prev,
      startDate: start,
      endDate: end
    }));
  }, [datePreset]);

  const [analyticsFilters, setAnalyticsFilters] = useState({
    coupon: "",
    product: "",
    email: "",
    startDate: "",
    endDate: ""
  });

  const getAdvancedAnalytics = () => {
    const couponMap = new Map();
    coupons.forEach(c => {
      if (analyticsFilters.coupon && c.code !== analyticsFilters.coupon) return;
      couponMap.set(c.code, {
        ...c,
        actualUsage: 0,
        grossRevenue: 0,
        discountGiven: 0,
        netRevenue: 0,
        affiliateBonus: 0,
        lastUsed: null,
        products: new Map()
      });
    });

    const startOfTime = analyticsFilters.startDate ? new Date(analyticsFilters.startDate.includes('T') ? analyticsFilters.startDate : analyticsFilters.startDate + 'T00:00:00') : null;
    const endOfTime = analyticsFilters.endDate ? new Date(analyticsFilters.endDate.includes('T') ? analyticsFilters.endDate : analyticsFilters.endDate + 'T23:59:59') : null;

    orders.forEach(order => {
      if (order.status !== 'completed' && order.status !== 'delivered') return;
      
      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt instanceof Date ? order.createdAt : new Date());
      
      if (startOfTime && orderDate < startOfTime) return;
      if (endOfTime && orderDate > endOfTime) return;
      if (analyticsFilters.product && order.productId !== analyticsFilters.product) return;
      if (analyticsFilters.email && order.bonusAssigneeEmail?.toLowerCase() !== analyticsFilters.email.toLowerCase()) return;

      const code = order.couponCode?.toUpperCase().trim();
      if (code && couponMap.has(code)) {
        const stats = couponMap.get(code);
        stats.actualUsage++;
        stats.grossRevenue += (order.grossAmount || order.amount || 0);
        stats.discountGiven += (order.discountAmount || 0);
        stats.netRevenue += (order.netAmount || 0);
        stats.affiliateBonus += (order.affiliateBonus || 0);
        
        if (!stats.lastUsed || orderDate > stats.lastUsed) {
          stats.lastUsed = orderDate;
        }

        const productId = order.productId;
        if (productId) {
          const prod = products.find(p => p.id === productId);
          if (!stats.products.has(productId)) {
            stats.products.set(productId, {
              id: productId,
              name: prod?.name || 'Unknown Product',
              sold: 0,
              gross: 0,
              discount: 0,
              net: 0
            });
          }
          const pStats = stats.products.get(productId);
          pStats.sold++;
          pStats.gross += (order.grossAmount || order.amount || 0);
          pStats.discount += (order.discountAmount || 0);
          pStats.net += (order.netAmount || 0);
        }
      }
    });

    return Array.from(couponMap.values())
      .filter(c => c.actualUsage > 0 || !analyticsFilters.coupon)
      .map(c => ({
        ...c,
        productBreakdown: Array.from(c.products.values())
      })).sort((a, b) => b.netRevenue - a.netRevenue);
  };

  const getProductEarningStats = () => {
    const productMap = new Map();
    const startOfTime = analyticsFilters.startDate ? new Date(analyticsFilters.startDate.includes('T') ? analyticsFilters.startDate : analyticsFilters.startDate + 'T00:00:00') : null;
    const endOfTime = analyticsFilters.endDate ? new Date(analyticsFilters.endDate.includes('T') ? analyticsFilters.endDate : analyticsFilters.endDate + 'T23:59:59') : null;

    orders.forEach(order => {
      const isPaid = order.status === 'completed' || order.status === 'delivered' || order.paymentStatus === 'paid';
      if (!isPaid) return;

      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt instanceof Date ? order.createdAt : null);
      if (!orderDate) return;

      if (startOfTime && orderDate < startOfTime) return;
      if (endOfTime && orderDate > endOfTime) return;

      const productId = order.productId;
      if (!productId) return;

      if (!productMap.has(productId)) {
        const prod = products.find(p => p.id === productId);
        productMap.set(productId, {
          id: productId,
          name: prod?.name || 'Unknown Product',
          sold: 0,
          gross: 0,
          discount: 0,
          net: 0,
          bonus: 0
        });
      }

      const stats = productMap.get(productId);
      const qty = Number(order.quantity || 1);
      stats.sold += qty;
      stats.gross += Number(order.grossAmount || order.amount || 0);
      stats.discount += Number(order.discountAmount || 0);
      stats.net += Number(order.netAmount || 0);
      stats.bonus += Number(order.affiliateBonus || 0);
    });
    return Array.from(productMap.values()).sort((a, b) => b.sold - a.sold);
  };

  const getAffiliateLeaderboard = () => {
    const affiliateMap = new Map();
    const startOfTime = analyticsFilters.startDate ? new Date(analyticsFilters.startDate) : null;
    if (startOfTime) startOfTime.setHours(0, 0, 0, 0);
    const endOfTime = analyticsFilters.endDate ? new Date(analyticsFilters.endDate) : null;
    if (endOfTime) endOfTime.setHours(23, 59, 59, 999);

    orders.forEach(order => {
      const isPaid = order.status === 'completed' || order.status === 'delivered' || order.paymentStatus === 'paid';
      if (!isPaid) return;

      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt instanceof Date ? order.createdAt : null);
      if (!orderDate) return;

      if (startOfTime && orderDate < startOfTime) return;
      if (endOfTime && orderDate > endOfTime) return;
      
      if (analyticsFilters.product && order.productId !== analyticsFilters.product) return;
      if (analyticsFilters.coupon && order.couponCode?.toUpperCase().trim() !== analyticsFilters.coupon?.toUpperCase().trim() && analyticsFilters.coupon) return;

      const email = order.bonusAssigneeEmail;
      if (!email) return;
      if (analyticsFilters.email && email.toLowerCase() !== analyticsFilters.email.toLowerCase()) return;

      if (!affiliateMap.has(email)) {
        affiliateMap.set(email, {
          email,
          displayName: email.split('@')[0],
          totalBonus: 0,
          conversions: 0,
          grossGenerated: 0
        });
      }

      const stats = affiliateMap.get(email);
      stats.totalBonus += (order.bonusAmountGiven || order.affiliateBonus || 0);
      stats.conversions++;
      stats.grossGenerated += (order.grossAmount || order.amount || 0);
    });
    return Array.from(affiliateMap.values()).sort((a, b) => b.totalBonus - a.totalBonus);
  };

  const getHeatmapData = () => {
    const year = selectedCalendarMonth.getFullYear();
    const month = selectedCalendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const heatmap: { [key: string]: any } = {};

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      heatmap[dateStr] = {
        date: dateStr,
        day: i,
        gross: 0,
        net: 0,
        discount: 0,
        commission: 0,
        orders: 0
      };
    }

    orders.forEach(order => {
      if (order.status !== 'completed' && order.status !== 'delivered') return;
      const date = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt instanceof Date ? order.createdAt : null);
      if (!date) return;
      if (date.getFullYear() !== year || date.getMonth() !== month) return;

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (heatmap[dateStr]) {
        heatmap[dateStr].gross += (order.grossAmount || order.amount || 0);
        heatmap[dateStr].discount += (order.discountAmount || 0);
        heatmap[dateStr].net += (order.netAmount || (order.amount || 0) - (order.discountAmount || 0));
        heatmap[dateStr].commission += (order.affiliateBonus || 0);
        heatmap[dateStr].orders++;
      }
    });

    return Object.values(heatmap);
  };

  const getDetailedRevenueAnalytics = () => {
    const dailyMap = new Map();
    const startOfTime = analyticsFilters.startDate ? new Date(analyticsFilters.startDate.includes('T') ? analyticsFilters.startDate : analyticsFilters.startDate + 'T00:00:00') : null;
    const endOfTime = analyticsFilters.endDate ? new Date(analyticsFilters.endDate.includes('T') ? analyticsFilters.endDate : analyticsFilters.endDate + 'T23:59:59') : null;

    orders.forEach(order => {
      // Precise status check for revenue
      const isPaid = order.status === 'completed' || order.status === 'delivered' || order.paymentStatus === 'paid';
      if (!isPaid) return;

      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt instanceof Date ? order.createdAt : null);
      if (!orderDate) return;

      if (startOfTime && orderDate < startOfTime) return;
      if (endOfTime && orderDate > endOfTime) return;

      // Use local date for consistency in Bangladesh timezone
      const dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          gross: 0,
          net: 0,
          discount: 0,
          commission: 0,
          orders: 0,
          profit: 0,
          units: 0
        });
      }

      const stats = dailyMap.get(dateKey);
      const gross = Number(order.grossAmount || order.amount || 0);
      const discount = Number(order.discountAmount || 0);
      const net = Number(order.netAmount || gross - discount);
      const commission = Number(order.affiliateBonus || 0);
      const profit = net - commission;
      const qty = Number(order.quantity || 1);

      stats.gross += gross;
      stats.net += net;
      stats.discount += discount;
      stats.commission += commission;
      stats.orders++;
      stats.profit += profit;
      stats.units += qty;
    });

    return Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  };

  const heatmapData = getHeatmapData();
  const dailyAnalyticsList = getDetailedRevenueAnalytics();
  const analyticsData = getAdvancedAnalytics();
  const productStats = getProductEarningStats();
  const affiliateStats = getAffiliateLeaderboard();

  // These are for the new Revenue Statistics tab
  const filteredRevenueTable = dailyAnalyticsList.filter(item => {
    if (!revenueSearch) return true;
    return item.date.includes(revenueSearch);
  });

  const paginatedRevenue = filteredRevenueTable.slice(
    (revenueTablePage - 1) * revenueTablePageSize,
    revenueTablePage * revenueTablePageSize
  );

  const revenueStatsSummary = dailyAnalyticsList.reduce((acc, curr) => ({
    gross: acc.gross + curr.gross,
    net: acc.net + curr.net,
    discount: acc.discount + curr.discount,
    commission: acc.commission + curr.commission,
    orders: acc.orders + curr.orders,
    profit: acc.profit + curr.profit,
    units: acc.units + (curr.units || 0)
  }), { gross: 0, net: 0, discount: 0, commission: 0, orders: 0, profit: 0, units: 0 });

  // Fixed period stats for quick reference (regardless of filters)
  const getQuickStats = () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Start of week (Sunday)
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const startOfWeek = new Date(d.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    let todayRev = 0;
    let weekRev = 0;
    let monthRev = 0;

    orders.forEach(order => {
      const isPaid = order.status === 'completed' || order.status === 'delivered' || order.paymentStatus === 'paid';
      if (!isPaid) return;

      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt instanceof Date ? order.createdAt : null);
      if (!orderDate) return;

      const gross = Number(order.grossAmount || order.amount || 0);
      const discount = Number(order.discountAmount || 0);
      const net = Number(order.netAmount || gross - discount);

      // Today
      const orderDateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
      if (orderDateStr === todayStr) {
        todayRev += net;
      }

      // Week
      if (orderDate >= startOfWeek) {
        weekRev += net;
      }

      // Month
      if (orderDate >= startOfMonth) {
        monthRev += net;
      }
    });

    return { today: todayRev, week: weekRev, month: monthRev };
  };

  const getOrderCounts = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    return orders.reduce((acc, order) => {
      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate().toISOString().split('T')[0] : "";
      if (orderDate === todayStr) acc.new++;
      if (order.status === 'pending') acc.pending++;
      if (order.status === 'completed' || order.status === 'delivered') acc.completed++;
      return acc;
    }, { new: 0, pending: 0, completed: 0 });
  };

  const quickStats = getQuickStats();
  const orderCounts = getOrderCounts();

  const getRevenueChartData = () => {
    if (revenueTimeframe === "daily") {
      // Sort ascending for chart
      return Array.from(dailyAnalyticsList).sort((a, b) => a.date.localeCompare(b.date));
    }

    const aggregated = new Map();
    dailyAnalyticsList.forEach(day => {
      // day.date is YYYY-MM-DD local format
      const parts = day.date.split("-");
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      let key = "";
      
      if (revenueTimeframe === "weekly") {
        // Start of week logic
        const d = new Date(date);
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek;
        const sunday = new Date(d.setDate(diff));
        key = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
      } else {
        // Monthly
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      }

      if (!aggregated.has(key)) {
        aggregated.set(key, { 
          date: key, 
          gross: 0, 
          net: 0, 
          profit: 0, 
          orders: 0, 
          discount: 0, 
          commission: 0, 
          units: 0,
          label: revenueTimeframe === "weekly" ? key : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        });
      }
      const existing = aggregated.get(key);
      existing.gross += day.gross;
      existing.net += day.net;
      existing.profit += day.profit;
      existing.orders += day.orders;
      existing.discount += day.discount;
      existing.commission += day.commission;
      existing.units += (day.units || 0);
    });

    return Array.from(aggregated.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const chartData = getRevenueChartData();

  const mostViewedProducts = [...products].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);

  const stats = [
    { label: "Gross Sales", value: `৳${revenueStatsSummary.gross.toLocaleString()}`, icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Net Revenue", value: `৳${revenueStatsSummary.net.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Profit", value: `৳${revenueStatsSummary.profit.toLocaleString()}`, icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total Orders", value: revenueStatsSummary.orders.toLocaleString(), icon: ShoppingBag, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Total Bonuses", value: `৳${revenueStatsSummary.commission.toLocaleString()}`, icon: Users, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Total Discount", value: `৳${revenueStatsSummary.discount.toLocaleString()}`, icon: ShoppingBag, color: "text-red-600", bg: "bg-red-50" },
  ];

  const detailedStats = {
    daily: heatmapData.find(d => d.day === new Date().getDate())?.gross || 0,
    weekly: revenueStatsSummary.gross / 4,
    monthly: revenueStatsSummary.gross
  };

  useEffect(() => {
    // Real-time Listeners
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "products"));

    const unsubCoupons = onSnapshot(collection(db, "coupons"), (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "coupons"));

    const unsubSessions = onSnapshot(collection(db, "active_sessions"), (snap) => {
      const now = Date.now();
      const active = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((s: any) => {
        const lastSeen = s.lastSeen?.toMillis ? s.lastSeen.toMillis() : (s.lastSeen?.seconds ? s.lastSeen.seconds * 1000 : 0);
        return now - lastSeen < 5 * 60 * 1000;
      });
      setActiveSessions(active);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "active_sessions"));

    const unsubCategories = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "categories"));

    const unsubPages = onSnapshot(collection(db, "pages"), (snap) => {
      setPages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "pages"));

    let unsubOrders: (() => void) | undefined;
    let unsubTickets: (() => void) | undefined;
    let unsubWithdrawals: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;
    let unsubReviews: (() => void) | undefined;

    if (isModeratorRole) {
      unsubReviews = onSnapshot(query(collection(db, "reviews"), orderBy("createdAt", "desc")), (snap) => {
        setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, "reviews"));

      unsubOrders = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
        const newOrdersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Play sound if new orders are added (ignoring initial load)
        if (lastOrderCountRef.current > 0 && newOrdersList.length > lastOrderCountRef.current) {
          notificationSound.play().catch(e => console.log("Audio play failed:", e));
        }
        
        lastOrderCountRef.current = newOrdersList.length;
        setOrders(newOrdersList);
      }, (error) => handleFirestoreError(error, OperationType.LIST, "orders"));

      unsubTickets = onSnapshot(collection(db, "support_tickets"), (snap) => {
        setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, "support_tickets"));

      unsubWithdrawals = onSnapshot(collection(db, "withdrawals"), (snap) => {
        setWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, "withdrawals"));

      unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, "users"));

      unsubLogs = onSnapshot(query(collection(db, "admin_logs"), orderBy("createdAt", "desc"), limit(50)), (snap) => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, "admin_logs"));
    }

    // Add site settings snapshot for real-time RBAC updates
    const unsubSettings = onSnapshot(doc(db, "settings", "site"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSiteSettings(prev => ({ 
          ...prev, 
          ...data,
          tabPermissions: data.tabPermissions || {} 
        }));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, "settings/site"));

    return () => {
      unsubProducts();
      unsubCoupons();
      unsubSessions();
      unsubCategories();
      unsubPages();
      unsubSettings();
      unsubOrders?.();
      unsubTickets?.();
      unsubWithdrawals?.();
      unsubUsers?.();
      unsubLogs?.();
      unsubReviews?.();
    };
  }, [isModeratorRole]);

  const fetchUsers = async () => {
    if (!isAdminRole) return;
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "users");
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    if (!isAdminRole) return;
    
    // Safety: Only super admin can create super admins or demote them
    const targetUser = users.find(u => u.id === userId);
    if (!isSuperAdmin) {
      if (newRole === 'super_admin' || targetUser?.role === 'super_admin') {
        alert("Only Super Admins can manage Super Admin accounts.");
        return;
      }
    }

    try {
      await updateDoc(doc(db, "users", userId), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
      await logAdminAction('update_user_role', { userId, newRole });
      fetchUsers();
      alert(`User role updated to ${newRole}`);
    } catch (error) {
      console.error(error);
      alert("Failed to update user role.");
    }
  };

  const handleUpdateUserBalance = async (userId: string, amount: string) => {
    if (!isAdminRole) return;
    const num = parseFloat(amount);
    if (isNaN(num)) return;

    try {
      await updateDoc(doc(db, "users", userId), {
        bonusBalance: num,
        updatedAt: serverTimestamp()
      });
      await logAdminAction('update_user_balance', { userId, newBalance: num });
      alert("User balance updated successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to update user balance.");
    }
  };

  const handleToggleUserStatus = async (userId: string, currentBanned: boolean) => {
    if (!isAdminRole) return;
    try {
      const targetUser = users.find(u => u.id === userId);
      if (targetUser?.role === 'super_admin' && !isSuperAdmin) {
        alert("Only Super Admins can manage Super Admin accounts.");
        return;
      }

      await updateDoc(doc(db, "users", userId), {
        isBanned: !currentBanned,
        updatedAt: serverTimestamp()
      });
      await logAdminAction(currentBanned ? 'unban_user' : 'ban_user', { userId });
      alert(currentBanned ? "User unbanned successfully!" : "User banned successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to update user status.");
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const snap = await getDocs(collection(db, "withdrawals"));
      setWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "withdrawals");
    }
  };

  const fetchCoupons = async () => {
    try {
      const snap = await getDocs(collection(db, "coupons"));
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "coupons");
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedCode = newCoupon.code.toUpperCase().trim();
      
      // Duplicate Check
      const checkQ = query(collection(db, "coupons"), where("code", "==", normalizedCode));
      const checkSnap = await getDocs(checkQ);
      if (!checkSnap.empty) {
        alert("A coupon with this code already exists. Please use a unique code.");
        return;
      }

      const couponData: any = {
        ...newCoupon,
        code: normalizedCode,
        value: Number(newCoupon.value),
        bonusPercentage: Number(newCoupon.bonusPercentage),
        usageLimit: Number(newCoupon.usageLimit),
        usageCount: 0,
        createdAt: serverTimestamp(),
      };
      
      if (!couponData.assignedEmail) {
        delete couponData.assignedEmail;
      } else {
        couponData.assignedEmail = couponData.assignedEmail.toLowerCase().trim();
      }

      await addDoc(collection(db, "coupons"), couponData);
      setIsAddingCoupon(false);
      setNewCoupon({
        code: "",
        type: "percentage",
        value: 0,
        bonusPercentage: 0,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isActive: true,
        assignedEmail: "",
        usageLimit: 0
      });
      fetchCoupons();
      alert("Coupon added successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to add coupon.");
    }
  };

  const handleUpdateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    try {
      const { id, ...data } = editingCoupon;
      const couponData: any = {
        ...data,
        code: data.code.toUpperCase().trim(),
        value: Number(data.value),
        bonusPercentage: Number(data.bonusPercentage || 0),
        usageLimit: Number(data.usageLimit || 0),
        updatedAt: serverTimestamp(),
      };

      if (!couponData.assignedEmail) {
        couponData.assignedEmail = null;
      } else {
        couponData.assignedEmail = couponData.assignedEmail.toLowerCase().trim();
      }

      await updateDoc(doc(db, "coupons", id), couponData);
      setEditingCoupon(null);
      fetchCoupons();
      alert("Coupon updated successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to update coupon.");
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this coupon?")) return;
    try {
      await deleteDoc(doc(db, "coupons", id));
      fetchCoupons();
      alert("Coupon deleted successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to delete coupon.");
    }
  };

  const fetchTickets = async () => {
    try {
      const snap = await getDocs(collection(db, "support_tickets"));
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "support_tickets");
    }
  };

  const handleToggleFakeOrder = async (orderId: string, currentFake: boolean) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const isMarkingAsFake = !currentFake;
      
      const updates: any = {
        isFake: isMarkingAsFake,
        updatedAt: serverTimestamp()
      };

      // If the order had a bonus processed, we need to adjust the user's balance
      if (order && order.bonusProcessed && order.bonusAssigneeEmail && (order.bonusAmountGiven || 0) > 0) {
        // Find user by email
        const uq = query(collection(db, "users"), where("email", "==", order.bonusAssigneeEmail.toLowerCase()));
        const userSnap = await getDocs(uq);
        
        if (!userSnap.empty) {
          const userRef = doc(db, "users", userSnap.docs[0].id);
          const bonusChange = isMarkingAsFake ? -order.bonusAmountGiven : order.bonusAmountGiven;
          
          await updateDoc(userRef, {
            bonusBalance: increment(bonusChange)
          });
          
          // Optionally track the adjustment in the order
          updates.bonusAdjustedForFake = isMarkingAsFake;
        }
      }

      await updateDoc(doc(db, "orders", orderId), updates);
      fetchOrders();
      alert(`Order marked as ${isMarkingAsFake ? 'FAKE' : 'VALID'}. Bonus balance adjusted accordingly.`);
    } catch (error) {
      console.error(error);
      alert("Failed to update status.");
    }
  };

  const handleProcessWithdrawal = async (id: string, newStatus: "completed" | "rejected") => {
    try {
      const withdrawal = withdrawals.find(w => w.id === id);
      if (!withdrawal) return;

      if (newStatus === "completed") {
        // Deduct from user's balance
        const userRef = doc(db, "users", withdrawal.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentBalance = userSnap.data().bonusBalance || 0;
          if (currentBalance < withdrawal.amount) {
            alert("Warning: User has insufficient balance for this withdrawal.");
          }
          await updateDoc(userRef, {
            bonusBalance: Math.max(0, currentBalance - withdrawal.amount)
          });
        }
      }

      await updateDoc(doc(db, "withdrawals", id), { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      });
      await logAdminAction('process_withdrawal', { withdrawalId: id, status: newStatus });
      fetchWithdrawals();
      alert(`Withdrawal request ${newStatus}!`);
    } catch (error) {
      console.error(error);
      alert("Failed to process withdrawal.");
    }
  };

  const handleFullReset = async () => {
    if (!isSuperAdmin) {
      alert("Unauthorized: Only Super Admins can perform a full marketplace reset.");
      return;
    }
    if (!window.confirm("CRITICAL ACTION: This will delete ALL products, orders, tickets, coupons and pages. The site will be factory reset. Continue?")) return;

    try {
      setLoading(true);
      const collections = ["products", "orders", "support_tickets", "pages", "coupons", "withdrawals"];
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        const deletes = snap.docs.map(d => deleteDoc(doc(db, col, d.id)));
        await Promise.all(deletes);
      }
      
      // Reset settings to default but keep existing role based access or reset it too? 
      // Resetting to empty record for tabPermissions to use system defaults
      await setDoc(doc(db, "settings", "site"), {
        siteName: "Digital Marketplace",
        heroTitle: "Premium Digital Assets",
        heroSubtitle: "High-quality software, plugins, and templates for modern developers.",
        footerText: "© 2024 Digital Marketplace. All rights reserved.",
        footerCopyright: "© 2024 Digital Marketplace. All rights reserved.",
        footerDescription: "Quality digital assets for developers, designers, and creators worldwide.",
        logoUrl: "",
        faviconUrl: "",
        privacyUrl: "",
        termsUrl: "",
        supportEmail: "",
        supportPhone: "",
        supportAddress: "",
        stat1Label: "Total Users",
        stat1Value: "5,000+",
        stat2Label: "Assets",
        stat2Value: "100+",
        stat3Label: "Reviews",
        stat3Value: "4.9/5",
        showHero: true,
        showTicker: true,
        bkashNumber: "",
        nagadNumber: "",
        rocketNumber: "",
        heroBannerUrl: "",
        tabPermissions: {} // Reset RBAC to defaults
      });

      alert("Website reset successfully! Everything has been cleared.");
      await logAdminAction('system_full_reset', { timestamp: new Date().toISOString() });
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Failed to perform reset.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOrder = async (id: string) => {
    if (!isActuallyAdmin) return;
    try {
      const downloadToken = crypto.randomUUID();
      const updates: any = {
        status: "completed",
        downloadToken: downloadToken,
        adminNote: editingNote,
        updatedAt: serverTimestamp()
      };

      // Include credentials if any are set
      if (Object.keys(editingCredentials).length > 0) {
        updates.credentials = editingCredentials;
      }

      // Handle bonus for coupon assignee and track usage
      const order = orders.find(o => o.id === id);
      if (order && order.couponCode && !order.bonusProcessed) {
        const q = query(collection(db, "coupons"), where("code", "==", order.couponCode));
        const couponSnap = await getDocs(q);
        if (!couponSnap.empty) {
          const couponDoc = couponSnap.docs[0];
          const couponData = couponDoc.data();
          
          // Increment usage count on approval - AS REQUESTED
          await updateDoc(doc(db, "coupons", couponDoc.id), {
            usageCount: increment(1)
          });
          
          if (couponData.assignedEmail && (couponData.bonusPercentage > 0 || couponData.bonusAmount > 0)) {
            // Calculate bonus based on net sale
            // NET SALE = (Original Price - Discount)
            const netSale = order.netAmount || order.amount || 0;
            const bonusPercentage = couponData.bonusPercentage || 0;
            const bonusAmount = bonusPercentage > 0 
              ? (netSale * bonusPercentage) / 100 
              : (couponData.bonusAmount || 0);

            if (bonusAmount > 0) {
              // Find user by email
              const uq = query(collection(db, "users"), where("email", "==", couponData.assignedEmail.toLowerCase().trim()));
              const userSnap = await getDocs(uq);
              if (!userSnap.empty) {
                const userDoc = userSnap.docs[0];
                const userRef = doc(db, "users", userDoc.id);
                
                await updateDoc(userRef, {
                  bonusBalance: increment(bonusAmount)
                });
                
                // Track commission
                await addDoc(collection(db, "commissions"), {
                  affiliateId: userDoc.id,
                  affiliateEmail: couponData.assignedEmail,
                  orderId: id,
                  amount: bonusAmount,
                  status: "paid",
                  createdAt: serverTimestamp()
                });

                updates.affiliateBonus = bonusAmount;
                updates.affiliateId = userDoc.id;
                updates.bonusProcessed = true;
                updates.bonusAmountGiven = bonusAmount;
                updates.bonusAssigneeEmail = couponData.assignedEmail;
              }
            } else {
              // Mark as processed even if bonus is 0 to avoid re-checking
              updates.bonusProcessed = true;
            }
          } else {
            // Mark as processed if no bonus defined
            updates.bonusProcessed = true;
          }
        } else {
          // If coupon code exists but doc not found (deleted?), still mark as processed
          updates.bonusProcessed = true;
        }
      }

      await updateDoc(doc(db, "orders", id), updates);
      await logAdminAction('confirm_order', { orderId: id });
      await fetchOrders();
      alert("Order confirmed! Product is now available to the user.");
      setSelectedOrderId(null);
      setEditingCredentials({});
      setEditingNote("");
    } catch (error: any) {
      alert(`Failed to confirm order: ${error.message}`);
    }
  };

  const handleUpdateOrderCredentials = async () => {
    if (!selectedOrderId || !isActuallyAdmin) return;
    try {
      await updateDoc(doc(db, "orders", selectedOrderId), {
        credentials: editingCredentials,
        adminNote: editingNote,
        updatedAt: serverTimestamp()
      });
      await fetchOrders();
      alert("Note & Credentials updated successfully!");
    } catch (error: any) {
      alert(`Update Error: ${error.message}`);
    }
  };

  const handleClearAll = async () => {
    let collectionName = "";
    let confirmMsg = "";
    let successMsg = "";
    let callback = () => {};

    if (activeTab === "products") {
      collectionName = "products";
      confirmMsg = "Are you sure you want to delete ALL products? This cannot be undone.";
      successMsg = "All products cleared successfully!";
      callback = fetchProducts;
    } else if (activeTab === "orders") {
      collectionName = "orders";
      confirmMsg = "Are you sure you want to delete ALL order records?";
      successMsg = "All orders cleared!";
      callback = fetchOrders;
    } else if (activeTab === "tickets") {
      collectionName = "support_tickets";
      confirmMsg = "Are you sure you want to delete ALL messages in your inbox?";
      successMsg = "Inbox cleared!";
      callback = fetchTickets;
    } else if (activeTab === "pages") {
      collectionName = "pages";
      confirmMsg = "Are you sure you want to delete ALL custom pages?";
      successMsg = "All pages deleted!";
      callback = fetchPages;
    }

    if (!collectionName || !isSuperAdmin) {
      alert("Only Super Admins can clear all records.");
      return;
    }
    if (!window.confirm(confirmMsg)) return;
    const confirmation = window.prompt("Type 'DELETE' to confirm:");
    if (confirmation?.toUpperCase() !== "DELETE") return;

    try {
      setLoading(true);
      const snap = await getDocs(collection(db, collectionName));
      if (snap.empty) {
        alert(`No ${activeTab} found to clear.`);
        setLoading(false);
        return;
      }
      
      const docs = snap.docs;
      const chunkSize = 25;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);
        await Promise.all(chunk.map(d => deleteDoc(doc(db, collectionName, d.id))));
      }

      await callback();
      alert(successMsg);
    } catch (error) {
      console.error(error);
      alert(`Failed to access ${activeTab} collection.`);
      handleFirestoreError(error, OperationType.DELETE, collectionName);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const snap = await getDocs(collection(db, "categories"));
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "categories");
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "categories"), {
        ...newCategory,
        createdAt: serverTimestamp(),
      });
      setIsAddingCategory(false);
      setNewCategory({ name: "", description: "", icon: "Package" });
      fetchCategories();
      alert("Category added successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to add category.");
    }
  };

  const handleToggleReviewStatus = async (reviewId: string, currentStatus: string) => {
    if (!isModeratorRole) return;
    try {
      const newStatus = currentStatus === "approved" ? "pending" : "approved";
      const review = reviews.find(r => r.id === reviewId);
      if (!review) return;

      // Update in top-level collection
      await updateDoc(doc(db, "reviews", reviewId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // Update in sub-collection if productId exists
      if (review.productId) {
        await updateDoc(doc(db, "products", review.productId, "reviews", reviewId), {
          status: newStatus,
          updatedAt: serverTimestamp()
        });

        // If approving for the first time, update product rating
        if (newStatus === "approved" && currentStatus !== "approved") {
          const productRef = doc(db, "products", review.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const productData = productSnap.data();
            const currentRating = productData.rating || 0;
            const currentCount = productData.reviewCount || 0;
            const newCount = currentCount + 1;
            const newRating = ((currentRating * currentCount) + (review.rating || 5)) / newCount;

            await updateDoc(productRef, {
              rating: Number(newRating.toFixed(1)),
              reviewCount: increment(1),
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      await logAdminAction('update_review_status', { reviewId, newStatus });
      alert(`Review status updated to ${newStatus}`);
    } catch (error) {
      console.error(error);
      alert("Failed to update review status.");
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!isModeratorRole) return;
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      const review = reviews.find(r => r.id === reviewId);
      
      // Delete from top-level
      await deleteDoc(doc(db, "reviews", reviewId));

      // Delete from sub-collection
      if (review && review.productId) {
        await deleteDoc(doc(db, "products", review.productId, "reviews", reviewId));
        
        // If it was already approved, we should ideally decrement the count and re-calc average
        // but that's complex without the full review history. For now just delete.
      }

      await logAdminAction('delete_review', { reviewId });
      alert("Review deleted successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to delete review.");
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id, ...data } = editingCategory;
      await setDoc(doc(db, "categories", id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      setEditingCategory(null);
      fetchCategories();
      alert("Category updated successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to update category.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await deleteDoc(doc(db, "categories", id));
      fetchCategories();
      alert("Category deleted successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to delete category.");
    }
  };

  const fetchPages = async () => {
    try {
      const snap = await getDocs(collection(db, "pages"));
      setPages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "pages");
    }
  };

  const fetchProducts = async () => {
    try {
      const snap = await getDocs(collection(db, "products"));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "products");
    }
  };

  const fetchOrders = async () => {
    try {
      const snap = await getDocs(collection(db, "orders"));
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "orders");
    }
  };

  const fetchSettings = async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "site"));
      if (snap.exists()) {
        const data = snap.data();
        setSiteSettings(prev => ({
          ...prev,
          ...data,
          socialLinks: data.socialLinks || [],
          tabPermissions: data.tabPermissions || {},
          faviconUrl: data.faviconUrl || "",
          invoiceTitle: data.invoiceTitle || "Official Invoice",
          invoiceSubtitle: data.invoiceSubtitle || "Digital Asset Purchase",
          invoiceFooter: data.invoiceFooter || "Thank you for choosing our platform for your digital assets.",
          invoiceNote: data.invoiceNote || "This is a computer generated invoice and does not require a physical signature.",
        }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "settings/site");
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await setDoc(doc(db, "settings", "site"), siteSettings);
    await logAdminAction('update_site_settings', { timestamp: new Date().toISOString() });
    alert("Settings updated successfully!");
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct({
      ...product,
      availableSizes: Array.isArray(product.availableSizes) ? product.availableSizes.join(", ") : (product.availableSizes || "")
    });
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id, ...data } = editingProduct;
      await setDoc(doc(db, "products", id), {
        ...data,
        price: Number(data.price),
        discountPrice: Number(data.discountPrice || 0),
        subscriptionMonthlyPrice: data.category === "Subscription" ? Number(data.subscriptionMonthlyPrice || 0) : 0,
        subscriptionYearlyPrice: data.category === "Subscription" ? Number(data.subscriptionYearlyPrice || 0) : 0,
        subscriptionMonthlyText: data.subscriptionMonthlyText || "",
        subscriptionMonthlySubtext: data.subscriptionMonthlySubtext || "",
        subscriptionYearlyText: data.subscriptionYearlyText || "",
        subscriptionYearlySubtext: data.subscriptionYearlySubtext || "",
        subscriptionLifetimeText: data.subscriptionLifetimeText || "",
        subscriptionLifetimeSubtext: data.subscriptionLifetimeSubtext || "",
        availableSizes: typeof data.availableSizes === "string" ? data.availableSizes.split(",").map((s: string) => s.trim()).filter(Boolean) : (data.availableSizes || []),
        updatedAt: serverTimestamp(),
      });
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id, ...data } = editingPage;
      await setDoc(doc(db, "pages", id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      setEditingPage(null);
      fetchPages();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddPage = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = (e.target as any).title.value;
    const slug = (e.target as any).slug.value;
    const content = (e.target as any).content.value;
    
    await addDoc(collection(db, "pages"), {
      title,
      slug,
      content,
      updatedAt: serverTimestamp(),
    });
    
    setIsAddingPage(false);
    fetchPages();
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "products"), {
        ...newProduct,
        price: Number(newProduct.price),
        discountPrice: Number(newProduct.discountPrice || 0),
        subscriptionMonthlyPrice: newProduct.category === "Subscription" ? Number(newProduct.subscriptionMonthlyPrice || 0) : 0,
        subscriptionYearlyPrice: newProduct.category === "Subscription" ? Number(newProduct.subscriptionYearlyPrice || 0) : 0,
        subscriptionMonthlyText: newProduct.subscriptionMonthlyText || "",
        subscriptionMonthlySubtext: newProduct.subscriptionMonthlySubtext || "",
        subscriptionYearlyText: newProduct.subscriptionYearlyText || "",
        subscriptionYearlySubtext: newProduct.subscriptionYearlySubtext || "",
        subscriptionLifetimeText: newProduct.subscriptionLifetimeText || "",
        subscriptionLifetimeSubtext: newProduct.subscriptionLifetimeSubtext || "",
        availableSizes: typeof newProduct.availableSizes === "string" ? newProduct.availableSizes.split(",").map(s => s.trim()).filter(Boolean) : [],
        rating: 4.5 + Math.random() * 0.5,
        reviewCount: Math.floor(Math.random() * 50),
        createdAt: serverTimestamp(),
      });
      setIsAdding(false);
      fetchProducts();
      setNewProduct({ 
        name: "", 
        price: 0, 
        subscriptionMonthlyPrice: 0, 
        subscriptionYearlyPrice: 0, 
        subscriptionMonthlyText: "",
        subscriptionMonthlySubtext: "",
        subscriptionYearlyText: "",
        subscriptionYearlySubtext: "",
        subscriptionLifetimeText: "",
        subscriptionLifetimeSubtext: "",
        category: "Software", 
        description: "", 
        imageUrl: "", 
        videoUrl: "",
        discountPrice: 0,
        discountEnabled: false,
        additionalImageUrls: "", 
        fileUrl: "",
        enableSizes: false,
        availableSizes: "" as any
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500">Manage your product catalog and view marketplace performance.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-4 items-center w-full sm:w-auto">
          {!isAdminChecking && !isModeratorRole && auth.currentUser && (
            <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-xs font-bold border border-amber-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> VIEW ONLY MODE
            </div>
          )}
          {activeTab === "products" && selectedProductIds.length > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="bg-red-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-200 flex items-center gap-2 hover:bg-red-600 hover:-translate-y-0.5 active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected ({selectedProductIds.length})
            </button>
          )}
          {activeTab === "orders" && selectedOrderIds.length > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="bg-red-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-200 flex items-center gap-2 hover:bg-red-600 hover:-translate-y-0.5 active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Delete Records ({selectedOrderIds.length})
            </button>
          )}
          {activeTab !== "settings" && isSuperAdmin && (
            <button 
              onClick={() => {
                handleClearAll();
              }}
              className="border px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 hover:-translate-y-0.5 active:scale-95 border-red-100 bg-red-50/50 text-red-600 hover:bg-red-50 hover:border-red-200"
            >
              <Trash2 className="w-4 h-4" /> Clear All {activeTab === "tickets" ? "Inbox" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </button>
          )}
          <button 
            onClick={() => {
              if (!isModeratorRole) {
                alert("Action Denied: You do not have permissions.");
                return;
              }
              setIsAdding(true);
            }}
            className={cn(
              "px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 hover:-translate-y-0.5 active:scale-95 flex-1 sm:flex-none",
              isModeratorRole 
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200" 
                : "bg-gray-100 text-gray-400 shadow-none cursor-not-allowed"
            )}
          >
            <Plus className="w-4 h-4" /> <span className="whitespace-nowrap">New Product</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-6 text-center sm:text-left">
            <div className={cn("p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shrink-0", stat.bg)}>
              <stat.icon className={cn("w-5 h-5 sm:w-6 sm:h-6", stat.color)} />
            </div>
            <div>
              <div className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest">{stat.label}</div>
              <div className="text-xl sm:text-3xl font-black text-gray-900 truncate">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Statistics Section */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 rounded-xl">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Revenue Statistics</h3>
              <p className="text-xs text-gray-500">Daily earnings performance over time</p>
            </div>
          </div>
          <div className="flex bg-gray-50 p-1 rounded-xl">
            <button 
              onClick={() => setRevenueTimeframe("daily")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                revenueTimeframe === "daily" ? "bg-white shadow-sm text-gray-900" : "text-gray-400"
              )}
            >
              Daily
            </button>
            <button 
              onClick={() => setRevenueTimeframe("weekly")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                revenueTimeframe === "weekly" ? "bg-white shadow-sm text-gray-900" : "text-gray-400"
              )}
            >
              Weekly
            </button>
            <button 
              onClick={() => setRevenueTimeframe("monthly")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                revenueTimeframe === "monthly" ? "bg-white shadow-sm text-gray-900" : "text-gray-400"
              )}
            >
              Monthly
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 pb-4">
          <div className="bg-indigo-50/30 p-3 rounded-2xl border border-indigo-50">
            <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Today</div>
            <div className="text-lg font-black text-indigo-600">৳{detailedStats.daily.toLocaleString()}</div>
          </div>
          <div className="bg-emerald-50/30 p-3 rounded-2xl border border-emerald-50">
            <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Weekly</div>
            <div className="text-lg font-black text-emerald-600">৳{detailedStats.weekly.toLocaleString()}</div>
          </div>
          <div className="bg-amber-50/30 p-3 rounded-2xl border border-amber-50">
            <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Monthly</div>
            <div className="text-lg font-black text-amber-600">৳{detailedStats.monthly.toLocaleString()}</div>
          </div>
          <div className="bg-purple-50/30 p-3 rounded-2xl border border-purple-50">
            <div className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">New Orders</div>
            <div className="text-lg font-black text-purple-600">{orderCounts.new}</div>
          </div>
          <div className="bg-rose-50/30 p-3 rounded-2xl border border-rose-100 flex justify-between items-end">
            <div>
              <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Pending</div>
              <div className="text-lg font-black text-rose-600">{orderCounts.pending}</div>
            </div>
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)] mb-1" />
          </div>
          <div className="bg-emerald-50/30 p-3 rounded-2xl border border-emerald-100 flex justify-between items-end">
            <div>
              <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Done</div>
              <div className="text-lg font-black text-emerald-600">{orderCounts.completed}</div>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)] mb-1" />
          </div>
        </div>

        <div className="h-[300px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    padding: '12px'
                  }}
                  itemStyle={{ fontWeight: 800 }}
                  labelStyle={{ marginBottom: '4px', fontWeight: 600, color: '#111827' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="gross" 
                  name="Gross Sales"
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorGross)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="net" 
                  name="Net Revenue"
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorNet)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 flex-col gap-2 border-2 border-dashed border-gray-100 rounded-3xl">
              <Calendar className="w-8 h-8 opacity-20" />
              <p className="text-sm font-medium">No sales data found to visualize yet</p>
            </div>
          )}
        </div>

        {/* Coupon & Affiliate Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-gray-100">
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <Ticket className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-gray-900 uppercase text-xs tracking-widest">Top Coupons</h4>
             </div>
             <div className="space-y-3">
                {coupons
                  .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
                  .slice(0, 5)
                  .map((coupon, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-gray-100 font-mono font-bold text-[10px] text-indigo-600">
                           {i + 1}
                         </div>
                         <div>
                            <div className="text-xs font-black text-gray-900 tracking-tight">{coupon.code}</div>
                            <div className="text-[10px] text-gray-500 font-medium">{coupon.usageCount || 0} uses</div>
                         </div>
                      </div>
                      <div className="text-xs font-bold text-indigo-600">
                        ৳{orders
                          .filter(o => o.couponCode === coupon.code && (o.status === 'completed' || o.status === 'delivered'))
                          .reduce((sum, o) => sum + (o.discountAmount || 0), 0)
                          .toLocaleString()} saved
                      </div>
                    </div>
                  ))}
                {coupons.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No coupons found.</p>
                )}
             </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-gray-900 uppercase text-xs tracking-widest">Top Earners</h4>
             </div>
             <div className="space-y-3">
                {Array.from(new Set(orders.map(o => o.bonusAssigneeEmail).filter(Boolean)))
                  .map(email => {
                    const totalBonus = orders
                      .filter(o => o.bonusAssigneeEmail === email && (o.status === 'completed' || o.status === 'delivered'))
                      .reduce((sum, o) => sum + (o.bonusAmountGiven || 0), 0);
                    const orderCount = orders.filter(o => o.bonusAssigneeEmail === email).length;
                    return { email, totalBonus, orderCount };
                  })
                  .sort((a, b) => b.totalBonus - a.totalBonus)
                  .slice(0, 5)
                  .map((earner, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-emerald-100 font-mono font-bold text-[10px] text-emerald-600">
                           {i + 1}
                         </div>
                         <div>
                            <div className="text-xs font-black text-gray-900 tracking-tight max-w-[150px] truncate">{earner.email}</div>
                            <div className="text-[10px] text-gray-500 font-medium">{earner.orderCount} conversions</div>
                         </div>
                      </div>
                      <div className="text-xs font-bold text-emerald-600">
                        ৳{earner.totalBonus.toLocaleString()}
                      </div>
                    </div>
                  ))}
             </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex gap-1 p-1 bg-gray-100/50 rounded-2xl w-full overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap sticky top-16 z-20 backdrop-blur-sm">
          {allowedTabs.map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap flex-shrink-0 flex items-center gap-2",
                activeTab === tab.id 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              )}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "analytics" ? (
          <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Professional Analytics Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white p-8 sm:p-10 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-32 -mt-32" />
               <div className="relative z-10 space-y-2">
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                   <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Real-time Attribution</span>
                 </div>
                 <h3 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Revenue Statistics</h3>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest max-w-md leading-relaxed">
                   Comprehensive financial performance monitoring and marketing ROI tracking
                 </p>
               </div>

               <div className="relative z-10 flex flex-wrap items-center gap-3">
                  <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                    {[
                      { id: "today", label: "24h" },
                      { id: "yesterday", label: "Fixed" },
                      { id: "last7", label: "7 Days" },
                      { id: "last30", label: "30 Days" },
                      { id: "thisMonth", label: "Month" },
                      { id: "thisYear", label: "Year" },
                      { id: "custom", label: "Range" }
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setDatePreset(p.id as any)}
                        className={cn(
                          "px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all",
                          datePreset === p.id 
                            ? "bg-white text-indigo-600 shadow-md shadow-indigo-200/20" 
                            : "text-gray-400 hover:text-gray-600"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                 </div>
                 <button 
                  onClick={() => {
                    const csvContent = "Date,Gross,Discount,Net,Commission,Profit,Orders\n" + 
                      dailyAnalyticsList.map(row => `${row.date},${row.gross},${row.discount},${row.net},${row.commission},${row.profit},${row.orders}`).join("\n");
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('hidden', '');
                    a.setAttribute('href', url);
                    a.setAttribute('download', `revenue_report_${new Date().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all active:scale-95"
                 >
                   <Save className="w-4 h-4" />
                   Export Report
                 </button>
               </div>
            </div>

            {/* Filtered Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
               {[
                 { label: "Filtered Gross", value: `৳${revenueStatsSummary.gross.toLocaleString()}`, icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-50" },
                 { label: "Filtered Net", value: `৳${revenueStatsSummary.net.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
                 { label: "Filtered Profit", value: `৳${revenueStatsSummary.profit.toLocaleString()}`, icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-50" },
                 { label: "Filtered Orders", value: revenueStatsSummary.orders.toLocaleString(), icon: ShoppingBag, color: "text-purple-600", bg: "bg-purple-50" },
                 { label: "Bonus Attribution", value: `৳${revenueStatsSummary.commission.toLocaleString()}`, icon: Users, color: "text-amber-600", bg: "bg-amber-50" },
                 { label: "Units Sold", value: revenueStatsSummary.units.toLocaleString(), icon: Package, color: "text-rose-600", bg: "bg-rose-50" },
               ].map((stat: any, i) => (
                 <motion.div
                   key={i}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.1 }}
                   className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-6 group hover:shadow-lg transition-all"
                 >
                   <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center p-3 transition-transform group-hover:scale-110 group-hover:rotate-6", stat.bg, stat.color)}>
                     <stat.icon className="w-full h-full" />
                   </div>
                   <div className="flex-1">
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                     <div className="flex items-center justify-between">
                       <h4 className="text-2xl font-black text-gray-900 tracking-tighter">
                         {stat.value}
                       </h4>
                       {stat.badge && (
                         <div className={cn(
                           "w-2 h-2 rounded-full animate-pulse",
                           stat.label.includes("Pending") ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                         )} />
                       )}
                     </div>
                   </div>
                 </motion.div>
               ))}
            </div>

            {/* Recent Orders Section */}
            <div className="bg-white p-8 rounded-[45px] border border-gray-100 shadow-sm overflow-hidden">
               <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-indigo-50 rounded-[28px] flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">Recent Operations</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time live transactional stream</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab("orders")}
                    className="px-6 py-3 bg-gray-50 text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100"
                  >
                    View All Orders
                  </button>
               </div>
               
               <div className="overflow-x-auto -mx-8">
                  <table className="w-full text-left">
                     <thead className="bg-gray-50/50">
                        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                           <th className="px-8 py-5">Order Details</th>
                           <th className="px-8 py-5">Customer</th>
                           <th className="px-8 py-5">Amount</th>
                           <th className="px-8 py-5">Status</th>
                           <th className="px-8 py-5 text-right">Time</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {orders.slice(0, 10).map((order) => (
                           <tr key={order.id} className="hover:bg-gray-50/30 transition-colors group">
                              <td className="px-8 py-5">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                       <Package className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <div className="min-w-0 max-w-[200px]">
                                       <div className="text-[11px] font-black text-gray-900 uppercase truncate">{order.productName}</div>
                                       <div className="text-[9px] font-mono text-gray-400">#{order.id.slice(-8).toUpperCase()}</div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-8 py-5">
                                 <div className="text-[11px] font-bold text-gray-900">{order.userName || 'Guest'}</div>
                                 <div className="text-[9px] text-gray-400 truncate max-w-[150px]">{order.userEmail}</div>
                              </td>
                              <td className="px-8 py-5">
                                 <div className="text-xs font-black text-gray-900">৳{(order.netAmount || order.amount).toLocaleString()}</div>
                              </td>
                              <td className="px-8 py-5">
                                 <span className={cn(
                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                    order.status === 'completed' || order.status === 'delivered'
                                       ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                       : order.status === 'pending'
                                          ? "bg-rose-50 text-rose-600 border-rose-100"
                                          : "bg-amber-50 text-amber-600 border-amber-100"
                                 )}>
                                    {order.status}
                                 </span>
                              </td>
                              <td className="px-8 py-5 text-right">
                                 <div className="text-[10px] font-bold text-gray-400 flex items-center justify-end gap-1.5">
                                    <Clock className="w-3 h-3" />
                                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                 </div>
                              </td>
                           </tr>
                        ))}
                        {orders.length === 0 && (
                           <tr>
                              <td colSpan={5} className="py-20 text-center">
                                 <div className="inline-flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center">
                                       <ShoppingBag className="w-8 h-8 text-gray-200" />
                                    </div>
                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No transaction records found</p>
                                 </div>
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Detailed Filters Expandable */}
            <div className="bg-white p-6 sm:p-8 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1 flex items-center gap-2">
                       <Ticket className="w-3 h-3" />
                       Filter by Coupon
                    </label>
                    <select 
                      value={analyticsFilters.coupon}
                      onChange={e => setAnalyticsFilters({...analyticsFilters, coupon: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="">All Marketing Channels</option>
                      {coupons.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1 flex items-center gap-2">
                       <Package className="w-3 h-3" />
                       Filter by Product
                    </label>
                    <select 
                      value={analyticsFilters.product}
                      onChange={e => setAnalyticsFilters({...analyticsFilters, product: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="">All Product Categories</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                 </div>
                 {datePreset === "custom" && (
                   <>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">From Date</label>
                       <input 
                         type="date"
                         value={analyticsFilters.startDate}
                         onChange={e => setAnalyticsFilters({...analyticsFilters, startDate: e.target.value})}
                         className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                       />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">To Date</label>
                       <input 
                         type="date"
                         value={analyticsFilters.endDate}
                         onChange={e => setAnalyticsFilters({...analyticsFilters, endDate: e.target.value})}
                         className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                       />
                    </motion.div>
                   </>
                 )}
                 {datePreset !== "custom" && (
                   <div className="lg:col-span-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1 flex items-center gap-2">
                         <Mail className="w-3 h-3" />
                         Search Affiliate
                      </label>
                      <input 
                        type="text"
                        placeholder="Search by affiliate email address..."
                        value={analyticsFilters.email}
                        onChange={e => setAnalyticsFilters({...analyticsFilters, email: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                   </div>
                 )}
               </div>
            </div>

            {/* Live Activity Feed & Global Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 space-y-8">
                {/* Core Revenue Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { label: "Gross Sales", value: revenueStatsSummary.gross, icon: TrendingUp, color: "text-white", bg: "bg-indigo-600", desc: "Total before discounts", live: true },
                    { label: "Net Revenue", value: revenueStatsSummary.net, icon: DollarSign, color: "text-white", bg: "bg-emerald-600", desc: "Revenue after discounts", live: true },
                    { label: "Net Profit", value: revenueStatsSummary.profit, icon: ShieldCheck, color: "text-white", bg: "bg-blue-600", desc: "Net minus commissions", live: true },
                    { label: "Total Orders", value: revenueStatsSummary.orders, icon: ShoppingBag, color: "text-indigo-600", bg: "bg-indigo-50", desc: "Successful conversions", isCount: true, live: true },
                    { label: "Total Units", value: revenueStatsSummary.units, icon: Package, color: "text-emerald-600", bg: "bg-emerald-50", desc: "Items sold", isCount: true },
                    { label: "Discounts", value: revenueStatsSummary.discount, icon: Ticket, color: "text-rose-600", bg: "bg-rose-50", desc: "Coupon value" },
                  ].map((s, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "p-8 rounded-[40px] border shadow-sm relative overflow-hidden group hover:shadow-xl transition-all",
                        s.bg.includes('600') ? `${s.bg} border-transparent` : "bg-white border-gray-100"
                      )}
                    >
                      {s.live && (
                        <div className="absolute top-6 right-6 flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-full">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[7px] font-black text-white/90 uppercase tracking-tighter">Live</span>
                        </div>
                      )}
                      <div className={cn("inline-flex p-3 rounded-2xl mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-sm", 
                        s.bg.includes('600') ? "bg-white/20 text-white" : s.bg + " " + s.color
                      )}>
                        <s.icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className={cn("text-[10px] font-black uppercase tracking-widest", 
                          s.bg.includes('600') ? "text-white/60" : "text-gray-400"
                        )}>{s.label}</div>
                        <div className={cn("text-2xl sm:text-3xl font-black tracking-tighter",
                          s.bg.includes('600') ? "text-white" : "text-gray-900"
                        )}>
                          {s.isCount ? "" : "৳"}{s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <p className={cn("text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity",
                          s.bg.includes('600') ? "text-white/40" : "text-gray-300"
                        )}>{s.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm h-full flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-sm font-black text-gray-900 uppercase tracking-tighter">Live Sales Feed</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Real-time transactions</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Active</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                    {orders.slice(0, 10).map((order, idx) => (
                      <motion.div 
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        key={order.id} 
                        className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 group hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                          {order.status === 'completed' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <Clock className="w-5 h-5 text-amber-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-black text-gray-900 uppercase truncate mb-0.5">{order.productName}</div>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-indigo-600">৳{(order.netAmount || order.amount).toLocaleString()}</span>
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                               {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                             </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {orders.length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <ShoppingBag className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No recent sales</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

              {/* Real-time Active Pulse */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="col-span-2 lg:col-span-3 xl:col-span-12 bg-gray-900 p-8 rounded-[45px] border border-gray-800 shadow-2xl shadow-indigo-900/10 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className="w-16 h-16 bg-indigo-500/10 rounded-[28px] border border-indigo-500/20 flex items-center justify-center">
                        <Users className="w-8 h-8 text-indigo-400" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-gray-900 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">Active Operations</h3>
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/20">LIVE</span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time pulse of your digital marketplace</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 md:gap-12">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Real-time Pulse</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-white tracking-tighter">{activeSessions.length}</span>
                        <span className="text-xs font-bold text-indigo-400 uppercase">Users Online</span>
                      </div>
                    </div>
                    
                    <div className="hidden sm:block h-10 w-px bg-gray-800" />

                    <div className="flex -space-x-3 overflow-hidden">
                      {activeSessions.slice(0, 5).map((s, i) => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-gray-900 bg-gray-800 flex items-center justify-center overflow-hidden ring-2 ring-indigo-500/20 group-hover:translate-x-1 transition-transform cursor-pointer" title={s.email || "Guest"}>
                          <img src={`https://ui-avatars.com/api/?name=${s.email || i}&background=random&color=fff&size=64`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {activeSessions.length > 5 && (
                        <div className="w-10 h-10 rounded-full border-2 border-gray-900 bg-gray-800 flex items-center justify-center text-[10px] font-black text-gray-400 ring-2 ring-indigo-500/20">
                          +{activeSessions.length - 5}
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest max-w-[180px] leading-relaxed hidden lg:block">
                      {activeSessions.length > 0 ? (
                        <>Current global traffic distributed across <span className="text-white">{new Set(activeSessions.map(s => s.path)).size} unique entry points</span></>
                      ) : "Searching for active user heartbeat..."}
                    </p>
                  </div>
                </div>
              </motion.div>

            {/* Real-time Order Stream & Product Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="lg:col-span-6">
                  <div className="bg-white p-8 rounded-[45px] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                     <div className="flex items-center gap-6 mb-8">
                        <div className="w-16 h-16 bg-emerald-50 rounded-[28px] flex items-center justify-center flex-shrink-0">
                           <ShoppingBag className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase italic">Best Sellers</h3>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time sales distribution</p>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {productStats.slice(0, 6).map((p, i) => (
                           <div key={i} className="bg-gray-50 px-6 py-4 rounded-[24px] border border-gray-100 flex items-center gap-4 hover:bg-emerald-50 hover:border-emerald-100 transition-all cursor-default group">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform flex-shrink-0">
                                 <Package className="w-5 h-5 text-emerald-500" />
                              </div>
                              <div className="min-w-0">
                                 <div className="text-[10px] font-black text-gray-900 uppercase tracking-tighter truncate">{p.name}</div>
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black text-emerald-600">{p.sold} Sold</span>
                                    <div className="w-1 h-1 rounded-full bg-gray-200" />
                                    <span className="text-[10px] font-black text-gray-400">
                                      {!isSuperAdmin && currentUserRole === 'moderator' ? '৳••••••' : `৳${p.net.toLocaleString()}`}
                                    </span>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               <div className="lg:col-span-6">
                  <div className="bg-white p-8 rounded-[45px] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                     <div className="flex items-center gap-6 mb-8">
                        <div className="w-16 h-16 bg-indigo-50 rounded-[28px] flex items-center justify-center flex-shrink-0">
                           <Eye className="w-8 h-8 text-indigo-600" />
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase italic">Most Seen</h3>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Hottest items by visitor interest</p>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {mostViewedProducts.slice(0, 6).map((p, i) => (
                           <div key={i} className="bg-gray-50 px-6 py-4 rounded-[24px] border border-gray-100 flex items-center gap-4 hover:bg-indigo-50 hover:border-indigo-100 transition-all cursor-default group">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform flex-shrink-0">
                                 <Eye className="w-5 h-5 text-indigo-500" />
                              </div>
                              <div className="min-w-0">
                                 <div className="text-[10px] font-black text-gray-900 uppercase tracking-tighter truncate">{p.name}</div>
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black text-indigo-600">{p.views || 0} Views</span>
                                    <div className="w-1 h-1 rounded-full bg-gray-200" />
                                    <span className="text-[10px] font-black text-gray-400 truncate">{p.category}</span>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>

            {/* Interactive Charts & Calendar Heatmap */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
               {/* Left: Line Charts */}
               <div className="xl:col-span-8 space-y-8">
                  <div className="bg-white p-10 rounded-[45px] border border-gray-100 shadow-sm space-y-10 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/30 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none" />
                     <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                           <div className="w-16 h-16 bg-indigo-600 rounded-[35px] flex items-center justify-center shadow-2xl shadow-indigo-200">
                              <TrendingUp className="w-8 h-8 text-white" />
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic">Earnings Velocity</h3>
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Live Sync</span>
                                </div>
                              </div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                Real-time {revenueTimeframe} financial momentum tracking
                              </p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50/80 backdrop-blur-md p-2 rounded-2xl border border-gray-100 self-start">
                          {(["daily", "weekly", "monthly"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setRevenueTimeframe(t)}
                              className={cn(
                                "px-6 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all",
                                revenueTimeframe === t 
                                  ? "bg-white text-indigo-600 shadow-md shadow-indigo-500/5 ring-1 ring-black/5" 
                                  : "text-gray-400 hover:text-gray-600 hover:bg-white/50"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                     </div>

                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 p-8 bg-gray-50/80 rounded-[2.5rem] border border-gray-100 shadow-inner">
                        <div className="space-y-1">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Avg Order Value</span>
                           <div className="text-2xl font-black text-gray-900 tracking-tighter">৳{revenueStatsSummary.orders ? Math.round(revenueStatsSummary.net / revenueStatsSummary.orders).toLocaleString() : '0'}</div>
                        </div>
                        <div className="space-y-1">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Conv. Rate</span>
                           <div className="text-2xl font-black text-emerald-600 tracking-tighter">{activeSessions.length ? ((revenueStatsSummary.orders / (activeSessions.length * 10)) * 100).toFixed(1) : '1.2'}%</div>
                        </div>
                        <div className="space-y-1">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Marketing Spend</span>
                           <div className="text-2xl font-black text-rose-500 tracking-tighter">৳{revenueStatsSummary.discount.toLocaleString()}</div>
                        </div>
                        <div className="space-y-1">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Net Multiplier</span>
                           <div className="text-2xl font-black text-indigo-600 tracking-tighter">{(revenueStatsSummary.net / (revenueStatsSummary.gross || 1)).toFixed(2)}x</div>
                        </div>
                     </div>

                     <div className="h-[450px] w-full relative">
                        <div className="absolute top-0 right-0 p-4 z-10 flex flex-wrap items-center justify-end gap-6">
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-sm" />
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Gross Sales</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Net Revenue</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Net Profit</span>
                           </div>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 80, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              minTickGap={30}
                              tick={{ fontSize: 10, fontWeight: 900, fill: '#6b7280' }}
                              tickFormatter={(val) => {
                                const d = new Date(val);
                                if (revenueTimeframe === "daily") return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                                if (revenueTimeframe === "weekly") return `Wk ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
                                return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                              }}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fontWeight: 900, fill: '#6b7280' }}
                              tickFormatter={(val) => `৳${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                            />
                            <Tooltip 
                              cursor={{ stroke: '#4f46e5', strokeWidth: 2, strokeDasharray: '5 5' }}
                              contentStyle={{ borderRadius: '32px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)', padding: '24px', backgroundColor: '#ffffff', outline: 'none' }}
                              labelStyle={{ fontWeight: 900, marginBottom: '16px', color: '#111827', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 900, padding: '4px 0' }}
                              formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, '']}
                              labelFormatter={(label) => {
                                const d = new Date(label);
                                if (revenueTimeframe === "monthly") return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                                if (revenueTimeframe === "weekly") {
                                  const end = new Date(d);
                                  end.setDate(end.getDate() + 6);
                                  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                                }
                                return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                              }}
                            />
                            <Area type="monotone" dataKey="gross" name="Gross" stroke="#4f46e5" strokeWidth={6} fillOpacity={1} fill="url(#colorGross)" />
                            <Area type="monotone" dataKey="net" name="Net" stroke="#10b981" strokeWidth={6} fillOpacity={1} fill="url(#colorNet)" />
                            <Area type="monotone" dataKey="profit" name="Profit" stroke="#3b82f6" strokeWidth={6} fillOpacity={1} fill="url(#colorProfit)" />
                          </AreaChart>
                        </ResponsiveContainer>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-center gap-3 border-l-4 border-amber-400 pl-4 py-1">
                          <div>
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Coupon Contribution</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Marketing efficiency metrics</p>
                          </div>
                        </div>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="date" hide />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#9ca3af' }} />
                              <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                              <Bar dataKey="discount" name="Discount" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                     </div>
                     <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-center gap-3 border-l-4 border-indigo-400 pl-4 py-1">
                          <div>
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Order Volume</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Customer activity trends</p>
                          </div>
                        </div>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="date" hide />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#9ca3af' }} />
                              <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                              <Area type="stepAfter" dataKey="orders" name="Orders" stroke="#6366f1" fill="#e0e7ff" strokeWidth={3} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Right: Revenue Heatmap */}
               <div className="xl:col-span-4 space-y-8">
                 <div className="bg-white p-8 rounded-[45px] border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-indigo-600" />
                          Calendar Heatmap
                       </h3>
                       <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
                          <button onClick={() => setSelectedCalendarMonth(new Date(selectedCalendarMonth.setMonth(selectedCalendarMonth.getMonth() - 1)))} className="p-1 hover:bg-white rounded-lg transition-colors"><Plus className="w-3 h-3 rotate-45" /></button>
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 min-w-[100px] text-center">
                            {selectedCalendarMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                          </span>
                          <button onClick={() => setSelectedCalendarMonth(new Date(selectedCalendarMonth.setMonth(selectedCalendarMonth.getMonth() + 1)))} className="p-1 hover:bg-white rounded-lg transition-colors"><Plus className="w-3 h-3" /></button>
                       </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                       {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                         <div key={day} className="text-[9px] font-black text-gray-300 uppercase text-center mb-2">{day}</div>
                       ))}
                       {Array.from({ length: new Date(selectedCalendarMonth.getFullYear(), selectedCalendarMonth.getMonth(), 1).getDay() }).map((_, i) => (
                         <div key={`empty-${i}`} className="aspect-square" />
                       ))}
                       {heatmapData.map((d, i) => {
                         const intensity = d.gross === 0 ? 0 : (d.gross > 10000 ? 4 : d.gross > 5000 ? 3 : d.gross > 1000 ? 2 : 1);
                         const colors = [
                           "bg-gray-50 text-gray-300 shadow-inner",
                           "bg-indigo-50 text-indigo-400 border border-indigo-100",
                           "bg-indigo-200 text-indigo-600",
                           "bg-indigo-400 text-white",
                           "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                         ];
                         return (
                           <motion.button
                             key={i}
                             whileHover={{ scale: 1.1, zIndex: 10 }}
                             onClick={() => setSelectedCalendarDay(d)}
                             className={cn(
                               "aspect-square rounded-xl flex items-center justify-center text-[10px] font-black transition-all",
                               colors[intensity]
                             )}
                           >
                             {d.day}
                           </motion.button>
                         );
                       })}
                    </div>

                    <div className="mt-8 p-6 bg-gray-50 rounded-3xl border border-gray-100 min-h-[160px] flex flex-col justify-center">
                       {selectedCalendarDay ? (
                         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                            <div className="flex items-center justify-between">
                               <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(selectedCalendarDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                               <div className="text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded-full">{selectedCalendarDay.orders} Orders</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div>
                                  <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Gross</div>
                                  <div className="text-sm font-black text-gray-900">৳{selectedCalendarDay.gross.toLocaleString()}</div>
                               </div>
                               <div>
                                  <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Net</div>
                                  <div className="text-sm font-black text-emerald-600">৳{selectedCalendarDay.net.toLocaleString()}</div>
                               </div>
                            </div>
                            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                               <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Discount: ৳{selectedCalendarDay.discount.toLocaleString()}</div>
                               <div className="text-[8px] font-black text-amber-600 uppercase">Comm: ৳{selectedCalendarDay.commission.toLocaleString()}</div>
                            </div>
                         </motion.div>
                       ) : (
                         <div className="text-center space-y-2 py-4">
                            <Calendar className="w-8 h-8 text-gray-200 mx-auto" />
                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Select a day to view details</p>
                         </div>
                       )}
                    </div>
                 </div>

                 <div className="bg-gradient-to-br from-gray-900 to-indigo-950 p-8 rounded-[45px] text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16" />
                    <h4 className="text-lg font-black tracking-tighter uppercase mb-2">Business Health</h4>
                    <div className="space-y-6 mt-6">
                       <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                             <span>Margin Retention</span>
                             <span>{((revenueStatsSummary.profit / (revenueStatsSummary.gross || 1)) * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${(revenueStatsSummary.profit / (revenueStatsSummary.gross || 1)) * 100}%` }}
                               className="h-full bg-emerald-500" 
                             />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                             <span>Coupon Burn Rate</span>
                             <span>{((revenueStatsSummary.discount / (revenueStatsSummary.gross || 1)) * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${(revenueStatsSummary.discount / (revenueStatsSummary.gross || 1)) * 100}%` }}
                               className="h-full bg-amber-500" 
                             />
                          </div>
                       </div>
                    </div>
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-8 leading-relaxed">
                       Calculated based on current filtering settings. Profit is defined as Net Revenue minus all affiliate payouts.
                    </p>
                 </div>
               </div>
            </div>

            {/* Master Analytics Table */}
            <div className="bg-white rounded-[50px] border border-gray-100 shadow-sm overflow-hidden">
               <div className="p-8 sm:p-10 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50/20">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Detailed Revenue Ledger</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Full transactional breakdown by date</p>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="Search dates (YYYY-MM-DD)..."
                          value={revenueSearch}
                          onChange={e => setRevenueSearch(e.target.value)}
                          className="pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 min-w-[250px] shadow-sm"
                        />
                     </div>
                  </div>
               </div>

               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-white border-b border-gray-50">
                           <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Analytics Period</th>
                           <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Gross Sales</th>
                           <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Marketing Cost</th>
                           <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Net Revenue</th>
                           <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Affiliate Bonus</th>
                           <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Estimated Profit</th>
                           <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Volume</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {paginatedRevenue.map((row, i) => (
                           <tr key={i} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-10 py-6">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-mono font-black text-xs">
                                       {new Date(row.date).getDate()}
                                    </div>
                                    <div>
                                       <div className="text-xs font-black text-gray-900 uppercase tracking-tight">{new Date(row.date).toLocaleDateString('en-GB', { weekday: 'long' })}</div>
                                       <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{row.date}</div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-10 py-6 text-right font-bold text-xs text-gray-800">৳{row.gross.toLocaleString()}</td>
                              <td className="px-10 py-6 text-right font-bold text-xs text-rose-500">-৳{row.discount.toLocaleString()}</td>
                              <td className="px-10 py-6 text-right">
                                 <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-xs">
                                    ৳{row.net.toLocaleString()}
                                 </span>
                              </td>
                              <td className="px-10 py-6 text-right font-bold text-xs text-amber-600">৳{row.commission.toLocaleString()}</td>
                              <td className="px-10 py-6 text-right">
                                 <div className="text-sm font-black text-indigo-600 tracking-tighter">৳{row.profit.toLocaleString()}</div>
                              </td>
                              <td className="px-10 py-6 text-center">
                                 <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-xl">
                                    <ShoppingBag className="w-3 h-3 text-gray-400" />
                                    <span className="text-[10px] font-black text-gray-900">{row.orders}</span>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               {/* Table Pagination */}
               <div className="p-8 bg-gray-50/30 border-t border-gray-50 flex items-center justify-between">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                     Showing {Math.min(filteredRevenueTable.length, (revenueTablePage - 1) * revenueTablePageSize + 1)} - {Math.min(filteredRevenueTable.length, revenueTablePage * revenueTablePageSize)} of {filteredRevenueTable.length} entries
                  </div>
                  <div className="flex items-center gap-2">
                     <button 
                       disabled={revenueTablePage === 1}
                       onClick={() => setRevenueTablePage(p => p - 1)}
                       className="p-2 border border-gray-200 rounded-xl hover:bg-white disabled:opacity-30 transition-all"
                     >
                       <ChevronLeft className="w-4 h-4" />
                     </button>
                     <div className="flex items-center gap-1">
                        {Array.from({ length: Math.ceil(filteredRevenueTable.length / revenueTablePageSize) }).slice(0, 5).map((_, i) => (
                           <button 
                             key={i} 
                             onClick={() => setRevenueTablePage(i + 1)}
                             className={cn("w-8 h-8 rounded-xl text-[10px] font-black transition-all", revenueTablePage === i + 1 ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-gray-400 hover:bg-white hover:text-gray-600")}
                           >
                             {i + 1}
                           </button>
                        ))}
                     </div>
                     <button 
                       disabled={revenueTablePage === Math.ceil(filteredRevenueTable.length / revenueTablePageSize)}
                       onClick={() => setRevenueTablePage(p => p + 1)}
                       className="p-2 border border-gray-200 rounded-xl hover:bg-white disabled:opacity-30 transition-all"
                     >
                       <ChevronRight className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            </div>

            {/* Performance Drill-down Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {/* 1. Coupon Analytics */}
               <div className="bg-white rounded-[45px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-gray-50 bg-indigo-50/20">
                     <h3 className="text-lg font-black text-gray-900 tracking-tighter uppercase">Coupon ROI</h3>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Marketing efficiency attribution</p>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[500px] p-2">
                     <div className="space-y-2">
                        {analyticsData.map((data, i) => (
                           <div key={i} className="p-6 hover:bg-gray-50 rounded-[35px] transition-all border border-transparent hover:border-indigo-100 group">
                              <div className="flex items-center justify-between mb-4">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-lg shadow-indigo-500/20">
                                       {data.code[0]}
                                    </div>
                                    <div>
                                       <div className="text-sm font-black text-gray-900 uppercase tracking-tighter">{data.code}</div>
                                       <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{data.type} discount</div>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <div className="text-sm font-black text-indigo-600">৳{data.netRevenue.toLocaleString()}</div>
                                    <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Net Revenue</div>
                                 </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                 <div className="bg-white p-2.5 rounded-2xl border border-gray-50 text-center">
                                    <div className="text-[8px] font-black text-gray-300 uppercase mb-0.5">Uses</div>
                                    <div className="text-[11px] font-black text-gray-900">{data.actualUsage}</div>
                                 </div>
                                 <div className="bg-white p-2.5 rounded-2xl border border-gray-50 text-center">
                                    <div className="text-[8px] font-black text-gray-300 uppercase mb-0.5">Discount</div>
                                    <div className="text-[11px] font-black text-rose-500">৳{data.discountGiven.toLocaleString()}</div>
                                 </div>
                                 <div className="bg-white p-2.5 rounded-2xl border border-gray-50 text-center">
                                    <div className="text-[8px] font-black text-gray-300 uppercase mb-0.5">Earnings</div>
                                    <div className="text-[11px] font-black text-emerald-600">৳{(data.netRevenue - data.affiliateBonus).toLocaleString()}</div>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* 2. Product Performance */}
               <div className="bg-white rounded-[45px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-gray-50 bg-emerald-50/20">
                     <h3 className="text-lg font-black text-gray-900 tracking-tighter uppercase">Product Volume</h3>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Inventory performance & revenue</p>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[500px] p-2">
                     <div className="space-y-2">
                        {productStats.map((data, i) => (
                           <div key={i} className="p-6 hover:bg-gray-50 rounded-[35px] transition-all border border-transparent hover:border-emerald-100 group">
                              <div className="flex items-center justify-between mb-4">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-black text-[10px]">
                                       {i + 1}
                                    </div>
                                    <div className="min-w-0">
                                       <div className="text-sm font-black text-gray-900 truncate tracking-tighter max-w-[120px]">{data.name}</div>
                                       <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{data.sold} Units Sold</div>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <div className="text-sm font-black text-emerald-600">৳{data.net.toLocaleString()}</div>
                                    <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Net Sales</div>
                                 </div>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(data.net / (productStats[0].net || 1)) * 100}%` }}
                                    className="h-full bg-emerald-500" 
                                 />
                              </div>
                              <div className="flex justify-between items-center mt-3 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                 <span>Net Profit: ৳{(data.net - data.bonus).toLocaleString()}</span>
                                 <span>Share: {((data.net / (revenueStatsSummary.net || 1)) * 100).toFixed(1)}%</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* 3. Top Affiliates */}
               <div className="bg-white rounded-[45px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-gray-50 bg-amber-50/20">
                     <h3 className="text-lg font-black text-gray-900 tracking-tighter uppercase">Top Promoters</h3>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Growth engine & conversion rates</p>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[500px] p-2">
                     <div className="space-y-2">
                        {affiliateStats.map((data, i) => (
                           <div key={i} className="p-6 hover:bg-gray-50 rounded-[35px] transition-all border border-transparent hover:border-amber-100 group">
                              <div className="flex items-center justify-between mb-4">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                                       <Users className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div>
                                       <div className="text-sm font-black text-gray-900 tracking-tighter">{data.displayName}</div>
                                       <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{data.conversions} Conversions</div>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <div className="text-sm font-black text-amber-600">৳{data.totalBonus.toLocaleString()}</div>
                                    <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Payout</div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-2 p-2.5 bg-white rounded-2xl border border-gray-50">
                                 <div className="flex-1 space-y-1">
                                    <div className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Gross Captured</div>
                                    <div className="text-xs font-black text-gray-700">৳{data.grossGenerated.toLocaleString()}</div>
                                 </div>
                                 <div className="h-8 w-px bg-gray-50" />
                                 <div className="px-4 text-center">
                                    <div className="text-[8px] font-black text-gray-300 uppercase tracking-widest">ROI</div>
                                    <div className="text-xs font-black text-amber-500">x{((data.grossGenerated / (data.totalBonus || 1)).toFixed(1))}</div>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          </section>
        ) : activeTab === "categories" ? (
          <section className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Category Management</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Manage product categories and filters</p>
              </div>
              <button 
                onClick={() => setIsAddingCategory(true)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            </div>
            
            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-l-4 border-amber-500 pl-4 py-1">
                <div>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Visibility & Filtering</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Control which categories appear on the storefront</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from(new Set(["Software", "Plugins", "Scripts", "Apps", "Templates", "Subscription", ...categories.map(c => c.name)])).map(catName => {
                  const isHidden = siteSettings.hiddenCategories?.includes(catName);
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => {
                        if (!isModeratorRole) {
                          alert("Action Denied: Management permissions required.");
                          return;
                        }
                        const currentHidden = siteSettings.hiddenCategories || [];
                        const nextHidden = isHidden 
                          ? currentHidden.filter(name => name !== catName)
                          : [...currentHidden, catName];
                        setSiteSettings({...siteSettings, hiddenCategories: nextHidden});
                      }}
                      className={cn(
                        "p-4 rounded-2xl border transition-all text-center space-y-2 flex flex-col items-center justify-center group",
                        isHidden 
                          ? "bg-gray-50 border-gray-200 text-gray-400 grayscale" 
                          : "bg-indigo-50 border-indigo-100 text-indigo-700 shadow-sm"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-xl transition-colors",
                        isHidden ? "bg-gray-200" : "bg-white"
                      )}>
                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-tighter truncate w-full">{catName}</span>
                      <div className={cn(
                        "text-[8px] font-bold px-2 py-0.5 rounded-full uppercase",
                        isHidden ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                      )}>
                        {isHidden ? "Hidden" : "Visible"}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <div className="pt-4 flex justify-end">
                <button 
                  onClick={handleUpdateSettings}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Visibility
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map(category => (
                <div key={category.id} className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-[60px] -mr-8 -mt-8 transition-all group-hover:bg-indigo-100/50" />
                  
                  <div className="relative">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                      {category.icon === "Package" ? <Package className="w-6 h-6" /> : <Database className="w-6 h-6" />}
                    </div>
                    
                    <h4 className="text-lg font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                      {category.name}
                      {siteSettings.hiddenCategories?.includes(category.name) && (
                        <span className="text-[8px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Hidden</span>
                      )}
                    </h4>
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                      {category.description || "No description provided."}
                    </p>
                    
                    <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full">
                        {products.filter(p => p.category === category.name).length} Products
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            if (!isModeratorRole) {
                              alert("Action Denied: Management permissions required.");
                              return;
                            }
                            setEditingCategory(category);
                          }}
                          className={cn(
                            "p-2 rounded-xl transition-colors",
                            isModeratorRole ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100" : "text-gray-200 bg-gray-50/50 cursor-not-allowed"
                          )}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (!isModeratorRole) {
                              alert("Action Denied: Management permissions required.");
                              return;
                            }
                            handleDeleteCategory(category.id);
                          }}
                          className={cn(
                            "p-2 rounded-xl transition-colors",
                            isModeratorRole ? "text-red-600 bg-red-50 hover:bg-red-100" : "text-gray-200 bg-gray-50/50 cursor-not-allowed"
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {categories.length === 0 && (
                <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-[40px] border-2 border-dashed border-gray-200">
                  <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No categories found. Add your first one above.</p>
                </div>
              )}
            </div>
          </section>
        ) : activeTab === "products" ? (
          <section className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 gap-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <h3 className="font-bold text-gray-900 whitespace-nowrap">Product Inventory</h3>
                <div className="relative flex-grow sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {selectedProductIds.length > 0 && (
                  <button 
                    onClick={handleDeleteSelected}
                    className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedProductIds.length})
                  </button>
                )}
                {isSuperAdmin && products.length > 0 && (
                  <button 
                    onClick={handleClearAll}
                    className="bg-gray-100 text-gray-500 hover:text-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
                    title="Clear all products"
                  >
                    <Database className="w-3.5 h-3.5" /> Clear All
                  </button>
                )}
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-widest whitespace-nowrap">
                  {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length} Items
                </span>
              </div>
            </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-[9px] sm:text-[10px] uppercase font-black text-gray-400 tracking-widest">
          <tr>
            <th className="px-3 sm:px-6 py-4 sm:py-5 w-10">
              <input 
                type="checkbox" 
                checked={selectedProductIds.length === products.length && products.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </th>
            <th className="px-3 sm:px-6 py-4 sm:py-5">Product</th>
            <th className="hidden sm:table-cell px-6 py-5">Category</th>
            <th className="px-3 sm:px-6 py-4 sm:py-5 border-l border-gray-100">Price</th>
            <th className="hidden md:table-cell px-6 py-5 border-l border-gray-100">Stats</th>
            <th className="px-3 sm:px-6 py-4 sm:py-5 text-right border-l border-gray-100">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {products
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(p => (
            <tr key={p.id} className={cn(
              "hover:bg-gray-50/80 transition-colors group",
              selectedProductIds.includes(p.id) && "bg-indigo-50/30"
            )}>
              <td className="px-3 sm:px-6 py-3 sm:py-4">
                <input 
                  type="checkbox" 
                  checked={selectedProductIds.includes(p.id)}
                  onChange={() => toggleSelectProduct(p.id)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </td>
              <td className="px-3 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gray-100 overflow-hidden shadow-inner border border-gray-100 group-hover:scale-105 transition-transform flex-shrink-0">
                    <img src={p.imageUrl || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80"} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-gray-900 text-xs sm:text-sm truncate">{p.name}</div>
                    <div className="text-[8px] sm:text-[10px] text-gray-400 uppercase font-bold tracking-tight">ID: {p.id.slice(0, 6)}</div>
                  </div>
                </div>
              </td>
              <td className="hidden sm:table-cell px-6 py-4">
                <span className="px-3 py-1 rounded-lg bg-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  {p.category}
                </span>
              </td>
              <td className="px-3 sm:px-6 py-3 sm:py-4 border-l border-gray-50 sm:border-gray-100">
                <div className="bg-emerald-50 text-emerald-700 px-2 sm:px-3 py-1 rounded-lg inline-block font-mono font-black text-[10px] sm:text-xs">
                  ৳{p.price.toLocaleString()}
                </div>
              </td>
              <td className="hidden md:table-cell px-6 py-4 border-l border-gray-100">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                  <span className="text-gray-900">{p.rating}</span>
                  <span className="text-gray-400 font-medium">({p.reviewCount})</span>
                </div>
              </td>
              <td className="px-3 sm:px-6 py-3 sm:py-4 text-right border-l border-gray-50 sm:border-gray-100">
                <div className="flex justify-end gap-1">
                  <button 
                    onClick={() => {
                      if (!isModeratorRole) {
                        alert("Action Denied: You do not have permissions.");
                        return;
                      }
                      handleEditProduct(p);
                    }}
                    title="Edit Product"
                    className="p-2 sm:p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl sm:rounded-2xl transition-all border border-transparent hover:border-indigo-100 shadow-sm hover:shadow-indigo-50 active:scale-90"
                  >
                    <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button 
                    onClick={async () => {
                      if (!isModeratorRole) {
                        alert("Management access required for this action.");
                        return;
                      }
                      if(window.confirm(`Permanently delete "${p.name}"? This cannot be undone.`)) {
                        try {
                          console.log("Deleting product:", p.id);
                          await deleteDoc(doc(db, "products", p.id));
                          await fetchProducts();
                          alert("Product deleted successfully.");
                        } catch (error: any) {
                          console.error("Delete Fail:", error);
                          alert(`Delete failed: ${error.code === 'permission-denied' ? 'Admin permissions required in security rules.' : error.message}`);
                          handleFirestoreError(error, OperationType.DELETE, `products/${p.id}`);
                        }
                      }
                    }}
                    title="Delete Product"
                    className={cn(
                      "p-2 sm:p-3 transition-all rounded-xl sm:rounded-2xl border border-transparent active:scale-90",
                      isModeratorRole ? "text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 shadow-sm hover:shadow-red-50" : "text-gray-200 bg-gray-50/50 cursor-not-allowed"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-20 text-center">
                <div className="flex flex-col items-center gap-3 opacity-30">
                  <Package className="w-12 h-12" />
                  <p className="font-bold text-gray-900">No products found matching your search</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
        ) : activeTab === "orders" ? (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-gray-900">Sales Ledger</h3>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setShowSalesStats(false)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      !showSalesStats ? "bg-white shadow-sm text-gray-900" : "text-gray-400"
                    )}
                  >
                    Recent Sales
                  </button>
                  <button 
                    onClick={() => setShowSalesStats(true)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      showSalesStats ? "bg-white shadow-sm text-gray-900" : "text-gray-400"
                    )}
                  >
                    Analytics & Trends
                  </button>
                </div>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Find orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            {showSalesStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Daily Revenue Breakdown</h4>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {Object.entries(orders.reduce((acc: any, o) => {
                      const d = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown';
                      acc[d] = (acc[d] || 0) + (o.amount || 0);
                      return acc;
                    }, {})).sort((a: any, b: any) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([date, amount]: any) => (
                      <div key={date} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-100">
                             <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <span className="text-sm font-bold text-gray-700">{date}</span>
                        </div>
                        <span className="text-sm font-black text-indigo-600">৳{amount.toLocaleString()}</span>
                      </div>
                    ))}
                    {orders.length === 0 && (
                      <div className="text-center py-12 text-gray-400">No sales data available.</div>
                    )}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Revenue Growth</h4>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                        <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[9px] sm:text-[10px] uppercase font-black text-gray-400 tracking-widest border-b border-gray-100">
                      <tr>
                        <th className="px-3 sm:px-6 py-4 sm:py-5 w-10">
                          <input 
                            type="checkbox" 
                            checked={selectedOrderIds.length === orders.length && orders.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-3 sm:px-6 py-4 sm:py-5">Order ID</th>
                        <th className="px-3 sm:px-6 py-4 sm:py-5">Customer</th>
                        <th className="hidden sm:table-cell px-6 py-5 border-l border-gray-100">Method</th>
                        <th className="px-3 sm:px-6 py-4 sm:py-5">Status</th>
                        <th className="px-3 sm:px-6 py-4 sm:py-5 border-l border-gray-100">Amount</th>
                        <th className="px-3 sm:px-6 py-4 sm:py-5 text-right border-l border-gray-100">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orders
                        .filter(o => {
                          const term = searchTerm.toLowerCase().replace(/^#/, '');
                          return (
                            o.id.toLowerCase().includes(term) || 
                            o.customerName?.toLowerCase().includes(term) ||
                            o.email?.toLowerCase().includes(term) ||
                            o.customerEmail?.toLowerCase().includes(term) ||
                            o.deliveryAddress?.toLowerCase().includes(term) ||
                            o.transactionId?.toLowerCase().includes(term) ||
                            o.customerPhone?.toLowerCase().includes(term) ||
                            o.paymentPhone?.toLowerCase().includes(term)
                          );
                        })
                        .map(o => (
                        <tr key={o.id} className={cn(
                          "hover:bg-gray-50/50 transition-colors group",
                          selectedOrderIds.includes(o.id) && "bg-indigo-50/30"
                        )}>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <input 
                              type="checkbox" 
                              checked={selectedOrderIds.includes(o.id)}
                              onChange={() => toggleSelectOrder(o.id)}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex flex-col">
                              <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase font-mono">#{o.id.slice(-8).toUpperCase()}</span>
                              <span className="text-[8px] sm:text-[9px] text-gray-400 mt-0.5 whitespace-nowrap">{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Just now'}</span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex flex-col max-w-[100px] sm:max-w-none">
                              <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">{o.customerName || "Anonymous"}</span>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] sm:text-xs text-gray-500 truncate">{o.customerEmail || o.email}</span>
                                  {o.deliveryAddress && (
                                    <span className="flex items-center gap-0.5 text-[8px] font-black bg-purple-50 text-purple-600 px-1 rounded uppercase tracking-tighter">
                                      <ShoppingBag className="w-2 h-2" />
                                      Details
                                    </span>
                                  )}
                                </div>
                                {o.couponCode && (
                                  <div className="mt-1 flex items-center gap-1">
                                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-widest border border-indigo-100/50">
                                      Coupon: {o.couponCode}
                                    </span>
                                    {(o.discountAmount || 0) > 0 && (
                                      <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase tracking-widest border border-emerald-100/50 font-mono">
                                        -৳{o.discountAmount.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {o.isFake && (
                                  <div className="mt-1 flex items-center gap-1">
                                    <span className="text-[9px] font-black bg-red-50 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-widest border border-red-200">
                                      FAKE ORDER
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="hidden sm:table-cell px-6 py-4 border-l border-gray-50">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                                o.paymentMethod === "bkash" ? "bg-pink-50 text-pink-600 border border-pink-100" :
                                o.paymentMethod === "nagad" ? "bg-orange-50 text-orange-600 border border-orange-100" : 
                                o.paymentMethod === "binance" ? "bg-yellow-50 text-yellow-600 border border-yellow-100" :
                                o.paymentMethod === "payoneer" ? "bg-cyan-50 text-cyan-600 border border-cyan-100" :
                                "bg-indigo-50 text-indigo-600 border border-indigo-100"
                              )}>
                                {o.paymentMethod}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-gray-400">{o.transactionId}</span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-1.5">
                              {o.status === "completed" ? (
                                <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500" />
                              ) : (
                                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                              )}
                              <span className={cn(
                                "text-[8px] sm:text-[10px] font-black uppercase tracking-widest",
                                o.status === "completed" ? "text-green-600" : "text-amber-600"
                              )}>
                                {o.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 border-l border-gray-50">
                            <span className="text-xs sm:text-sm font-black text-gray-900">৳{(o.amount || 0).toLocaleString()}</span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-right border-l border-gray-50">
                            <div className="flex justify-end gap-1">
                              <button 
                                onClick={() => handleToggleFakeOrder(o.id, o.isFake)}
                                title={o.isFake ? "Mark as Valid" : "Mark as Fake"}
                                className={cn(
                                  "p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all border border-transparent shadow-sm active:scale-90",
                                  o.isFake ? "text-emerald-500 bg-emerald-50 hover:bg-emerald-100" : "text-amber-500 bg-amber-50 hover:bg-amber-100"
                                )}
                              >
                                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedOrderId(o.id);
                                  setEditingCredentials(o.credentials || {});
                                  setEditingNote(o.adminNote || "");
                                }}
                                className="p-2 sm:p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl sm:rounded-2xl transition-all border border-transparent hover:border-indigo-100 shadow-sm active:scale-90"
                              >
                                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                              {o.status === "pending" && isModeratorRole && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleConfirmOrder(o.id); }}
                                  className="bg-indigo-600 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                                >
                                  OK
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        ))}
                      {orders.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-20 text-center text-gray-400">
                             No order records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </section>
        ) : activeTab === "withdrawals" ? (
          <section className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Withdrawal Requests</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Review and process user bonus withdrawals</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-widest">
                    {withdrawals.filter(w => w.status === 'pending').length} Pending
                  </span>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400 tracking-widest">
                    <tr>
                      <th className="px-6 py-5">User</th>
                      <th className="px-6 py-5">Amount</th>
                      <th className="px-6 py-5">Payment Details</th>
                      <th className="px-6 py-5">Status</th>
                      <th className="px-6 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {withdrawals
                      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
                      .map(w => (
                      <tr key={w.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-black text-gray-900 text-sm">{w.userEmail}</div>
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            {w.createdAt?.toDate?.().toLocaleDateString() || "Recently"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-lg font-black text-indigo-600">৳{w.amount.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <div className={cn(
                               "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight shadow-sm",
                               w.method === 'bkash' ? "bg-pink-100 text-pink-600" : "bg-indigo-100 text-indigo-600"
                             )}>
                               {w.method}
                             </div>
                             <span className="font-mono text-xs font-bold text-gray-700">{w.accountNumber}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                            w.status === 'completed' ? "bg-emerald-50 text-emerald-600" : 
                            w.status === 'pending' ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                          )}>
                             <Clock className="w-3 h-3" />
                             {w.status}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {w.status === 'pending' ? (
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleProcessWithdrawal(w.id, "rejected")}
                                className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all active:scale-95 border border-red-100"
                              >
                                Reject
                              </button>
                              <button 
                                onClick={() => handleProcessWithdrawal(w.id, "completed")}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                              >
                                Complete Payment
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {withdrawals.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                           No withdrawal requests found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : activeTab === "coupons" ? (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Coupon Management</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Manage discount codes and promotions</p>
              </div>
              <button 
                onClick={() => setIsAddingCoupon(true)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Coupon
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coupons.map(coupon => (
                <div key={coupon.id} className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm relative group overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 flex gap-1">
                     <button 
                       onClick={() => setEditingCoupon(coupon)}
                       className="p-2 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                     >
                       <Edit className="w-4 h-4" />
                     </button>
                     <button 
                       onClick={() => handleDeleteCoupon(coupon.id)}
                       className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>

                   <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <Database className="w-5 h-5" />
                         </div>
                         <div>
                           <div className="text-lg font-black text-gray-900 tracking-tight">{coupon.code}</div>
                           <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{coupon.type} Discount</div>
                         </div>
                       </div>
                       {!coupon.isActive && (
                         <span className="text-[8px] font-black bg-red-50 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-widest">Inactive</span>
                       )}
                       {coupon.expiryDate && new Date(coupon.expiryDate) < new Date() && (
                         <span className="text-[8px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full uppercase tracking-widest">Expired</span>
                       )}
                     </div>

                     {coupon.assignedEmail && (
                       <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-xl border border-amber-100">
                         <Mail className="w-3.5 h-3.5 text-amber-600" />
                         <div className="flex flex-col">
                           <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest leading-none">Assigned To</span>
                           <span className="text-[10px] font-bold text-amber-900 truncate max-w-[150px]">{coupon.assignedEmail}</span>
                         </div>
                       </div>
                     )}

                     <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
                        <div>
                          <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Value</div>
                          <div className="text-xl font-black text-indigo-600">
                             {coupon.type === 'percentage' ? `${coupon.value}%` : `৳${coupon.value.toLocaleString()}`}
                          </div>
                        </div>
                        <div>
                          <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Bonus</div>
                          <div className="text-xl font-black text-emerald-600">
                             {coupon.bonusPercentage || 0}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Uses</div>
                          <div className="text-sm font-black text-gray-900">
                            {coupon.usageCount || 0} / {coupon.usageLimit > 0 ? coupon.usageLimit : '∞'}
                          </div>
                        </div>
                     </div>

                     <div className="flex items-center justify-between pt-4">
                        <div className="flex items-center gap-1.5">
                           <Clock className="w-3 h-3 text-gray-400" />
                           <span className="text-[10px] font-bold text-gray-500">Expires: {new Date(coupon.expiryDate).toLocaleDateString()}</span>
                        </div>
                        {(() => {
                           const expiryDate = new Date(coupon.expiryDate);
                           const endOfExpiryDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate(), 23, 59, 59, 999);
                           const isExpired = endOfExpiryDay < new Date();
                           return (
                             <span className={cn(
                               "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                               isExpired ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                             )}>
                               {isExpired ? "Expired" : "Active"}
                             </span>
                           );
                        })()}
                     </div>
                   </div>
                </div>
              ))}

              {coupons.length === 0 && (
                <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-[40px] border-2 border-dashed border-gray-200">
                  <Database className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No coupons found. Create one to get started.</p>
                </div>
              )}
            </div>
          </section>
        ) : activeTab === "pages" ? (
          <section className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Custom Pages</h3>
              <button 
                onClick={() => setIsAddingPage(true)}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] uppercase font-black tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-indigo-100"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Page
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-400 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Slug</th>
                    <th className="px-6 py-4">Last Updated</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pages.map(page => (
                    <tr key={page.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 font-bold text-gray-900">{page.title}</td>
                      <td className="px-6 py-4 font-mono text-xs text-indigo-600">/{page.slug}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {page.updatedAt?.toDate().toLocaleDateString() || "Recently"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              const url = `${window.location.origin}/p/${page.slug}`;
                              navigator.clipboard.writeText(url);
                              alert("Link copied to clipboard!");
                            }}
                            title="Copy Link"
                            className="p-2 text-gray-400 hover:text-emerald-600 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (!isActuallyAdmin) {
                                alert("Action Denied: You do not have administrator permissions.");
                                return;
                              }
                              setEditingPage(page);
                            }}
                            className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (!isActuallyAdmin) {
                                alert("Action Denied: You do not have administrator permissions.");
                                return;
                              }
                              if(window.confirm("Are you sure you want to delete this page?")) {
                                try {
                                  await deleteDoc(doc(db, "pages", page.id));
                                  await fetchPages();
                                  alert("Page deleted successfully!");
                                } catch (error) {
                                  console.error(error);
                                  handleFirestoreError(error, OperationType.DELETE, `pages/${page.id}`);
                                }
                              }
                            }}
                            className={cn(
                              "p-2 transition-colors",
                              isActuallyAdmin ? "text-gray-400 hover:text-red-600" : "text-gray-200"
                            )}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pages.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-gray-400 font-medium">
                        No pages created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : activeTab === "tickets" ? (
          <section className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Support Inbox</h3>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {tickets.length} Messages
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-400 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Sender</th>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Message</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tickets.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{t.name}</div>
                        <div className="text-xs text-gray-400">{t.email}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{t.subject}</td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-xs text-gray-500 line-clamp-2">{t.message}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">
                        {t.createdAt?.toDate().toLocaleDateString() || "Recently"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setSelectedTicket(t)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Inbox className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (!isActuallyAdmin) {
                                alert("Action Denied: You do not have administrator permissions.");
                                return;
                              }
                              if(window.confirm("Delete this message?")) {
                                try {
                                  await deleteDoc(doc(db, "support_tickets", t.id));
                                  await fetchTickets();
                                  alert("Message deleted successfully!");
                                } catch (error) {
                                  console.error(error);
                                  handleFirestoreError(error, OperationType.DELETE, `support_tickets/${t.id}`);
                                }
                              }
                            }}
                            className={cn(
                              "p-2 transition-colors",
                              isActuallyAdmin ? "text-gray-400 hover:text-red-600" : "text-gray-200"
                            )}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-400 font-medium">
                        Your inbox is empty.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
         ) : activeTab === "reviews" ? (
          <section className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Review Management</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Moderate client reviews and product ratings</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-widest whitespace-nowrap">
                    {reviews.length} Total Reviews
                  </span>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400 tracking-widest">
                    <tr>
                      <th className="px-6 py-5">Product</th>
                      <th className="px-6 py-5">User</th>
                      <th className="px-6 py-5">Rating & Comment</th>
                      <th className="px-6 py-5">Status</th>
                      <th className="px-6 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {reviews
                      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
                      .map(r => (
                      <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-black text-gray-900 text-xs truncate max-w-[150px]">
                            {r.productName || "Deleted Product"}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {r.productId || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500 uppercase">
                              {r.userName?.charAt(0) || "?"}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-900">{r.userName}</div>
                              <div className="text-[8px] font-bold text-gray-400 uppercase">{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : 'Just now'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 mb-1">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={cn("w-2.5 h-2.5", i < r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200")} 
                              />
                            ))}
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2 max-w-xs">{r.comment}</p>
                        </td>
                        <td className="px-6 py-4">
                           <button 
                             onClick={() => handleToggleReviewStatus(r.id, r.status)}
                             className={cn(
                               "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                               r.status === "approved" ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200" : "bg-amber-100 text-amber-600 hover:bg-amber-200"
                             )}
                           >
                             {r.status === "approved" ? <CheckCircle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                             {r.status}
                           </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleDeleteReview(r.id)}
                                className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reviews.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic">
                          No reviews found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : activeTab === "logs" ? (
          <section className="space-y-6">
            <div className="bg-white p-8 rounded-[45px] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">System Activity Logs</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Audit trail of all administrative actions</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 text-center">
                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Logged Events</div>
                    <div className="text-xl font-black text-indigo-600">Live</div>
                  </div>
                </div>
            </div>

            <div className="bg-white rounded-[45px] border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400 tracking-widest border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-6">Admin</th>
                      <th className="px-8 py-6">Action</th>
                      <th className="px-8 py-6">Target</th>
                      <th className="px-8 py-6">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logs.length === 0 ? (
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td colSpan={4} className="px-8 py-20 text-center text-gray-400 font-bold italic">
                          No activity logs found. Administrative actions will appear here in real-time.
                        </td>
                      </tr>
                    ) : (
                      logs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500 uppercase">
                                {log.adminEmail?.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[11px] font-bold text-gray-700">{log.adminEmail}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-widest border border-indigo-100">
                              {log.action?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <code className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md max-w-[200px] truncate block">
                              {JSON.stringify(log.details)}
                            </code>
                          </td>
                          <td className="px-8 py-6 text-[10px] font-bold text-gray-400">
                            {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Just now'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : activeTab === "users" ? (
          <section className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">User Management</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Manage user roles and permissions</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search email or name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-gray-900"
                    />
                  </div>
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-widest whitespace-nowrap">
                    {users.length} Total Users
                  </span>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400 tracking-widest">
                    <tr>
                      <th className="px-6 py-5">User</th>
                      <th className="px-6 py-5">Balance</th>
                      <th className="px-6 py-5">Role</th>
                      <th className="px-6 py-5">Status</th>
                      <th className="px-6 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users
                      .filter(u => {
                        const term = searchTerm.toLowerCase();
                        return (
                          u.email?.toLowerCase().includes(term) ||
                          u.displayName?.toLowerCase().includes(term) ||
                          u.id.toLowerCase().includes(term)
                        );
                      })
                      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
                      .map(u => (
                      <tr key={u.id} className={cn("hover:bg-gray-50/50 transition-colors", u.isBanned && "opacity-60 grayscale-[0.5]")}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs">
                              {u.displayName?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <div>
                              <div className="font-black text-gray-900 text-sm flex items-center gap-2">
                                {u.displayName || "Anonymous User"}
                                {u.isBanned && <Ban className="w-3 h-3 text-red-500" />}
                              </div>
                              <div className="text-[10px] font-bold text-gray-400 lowercase tracking-tight">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              defaultValue={u.bonusBalance || 0}
                              onBlur={(e) => {
                                if (parseFloat(e.target.value) !== (u.bonusBalance || 0)) {
                                  handleUpdateUserBalance(u.id, e.target.value);
                                }
                              }}
                              className="w-20 bg-gray-50 border-none rounded-lg px-2 py-1 text-xs font-black text-indigo-600 focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                            <div className="text-[8px] font-bold text-gray-400 hidden sm:block uppercase tracking-widest">Bonus</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select 
                             value={u.role || 'user'} 
                             onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                             disabled={u.email === currentUserEmail || (!isSuperAdmin && u.role === 'super_admin')}
                             className="bg-gray-50 border-none rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                           >
                             <option value="user">User</option>
                             <option value="moderator">Moderator</option>
                             <option value="admin">Admin</option>
                             {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                           </select>
                        </td>
                        <td className="px-6 py-4">
                           <div className={cn(
                             "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                             u.isBanned ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                           )}>
                             {u.isBanned ? <UserX className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
                             {u.isBanned ? "Banned" : "Active"}
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleToggleUserStatus(u.id, u.isBanned || false)}
                                title={u.isBanned ? "Unban User" : "Ban User"}
                                disabled={u.email === currentUserEmail || (!isSuperAdmin && u.role === 'super_admin')}
                                className={cn(
                                  "p-2 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50",
                                  u.isBanned ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-red-50 text-red-600 hover:bg-red-100"
                                )}
                              >
                                {u.isBanned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.filter(u => {
                      const term = searchTerm.toLowerCase();
                      return u.email?.toLowerCase().includes(term) || u.displayName?.toLowerCase().includes(term);
                    }).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic">
                          No users matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-indigo-50 rounded-xl">
                <SettingsIcon className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Website Configuration</h3>
                <p className="text-sm text-gray-500">Customize the site appearance and hero content.</p>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="mb-8 space-y-6">
                <div className="flex items-center gap-4 bg-purple-50 border border-purple-100 p-6 rounded-[2rem]">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-purple-600">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-purple-900 uppercase tracking-tighter">Role-Based Access Control</h4>
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mt-0.5">Manage page visibility for Admin & Moderator roles</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-[2.5rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Page / Tab</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin Access</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Moderator Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {tabs.map(tab => {
                        const currentRoles = getTabRoles(tab.id);
                        const toggleRole = async (role: string) => {
                          const updated = currentRoles.includes(role) 
                            ? currentRoles.filter(r => r !== role)
                            : [...currentRoles, role];
                          
                          const newPermissions = {
                            ...(siteSettings.tabPermissions || {}),
                            [tab.id]: updated
                          };

                          try {
                            setSiteSettings(prev => ({ ...prev, tabPermissions: newPermissions }));
                            await updateDoc(doc(db, "settings", "site"), {
                              tabPermissions: newPermissions
                            });
                          } catch (err) {
                            console.error("Failed to update permissions:", err);
                          }
                        };

                        return (
                          <tr key={tab.id} className="hover:bg-gray-50/30 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-purple-50 transition-colors">
                                  <tab.icon className="w-4 h-4 text-gray-400 group-hover:text-purple-600" />
                                </div>
                                <span className="text-sm font-black text-gray-700">{tab.label}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={currentRoles.includes('admin')}
                                  onChange={() => toggleRole('admin')}
                                />
                                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                              </label>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={currentRoles.includes('moderator')}
                                  onChange={() => toggleRole('moderator')}
                                />
                                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem]">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-tighter">Invoice Customization</h4>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">Control the text displayed on user invoices</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Invoice Header Title</label>
                      <input 
                        type="text" 
                        value={siteSettings.invoiceTitle}
                        onChange={e => setSiteSettings({...siteSettings, invoiceTitle: e.target.value})}
                        placeholder="Official Invoice"
                        className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Item Subtitle (Description)</label>
                      <input 
                        type="text" 
                        value={siteSettings.invoiceSubtitle}
                        onChange={e => setSiteSettings({...siteSettings, invoiceSubtitle: e.target.value})}
                        placeholder="Digital Asset Purchase"
                        className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Footer Message</label>
                      <textarea 
                        rows={2}
                        value={siteSettings.invoiceFooter}
                        onChange={e => setSiteSettings({...siteSettings, invoiceFooter: e.target.value})}
                        placeholder="Thank you for choosing our platform..."
                        className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Bottom Disclaimer/Note</label>
                      <input 
                        type="text" 
                        value={siteSettings.invoiceNote}
                        onChange={e => setSiteSettings({...siteSettings, invoiceNote: e.target.value})}
                        placeholder="This is a computer generated invoice..."
                        className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 bg-amber-50 border border-amber-100 p-6 rounded-[2rem]">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-amber-600">
                    <Star className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-900 uppercase tracking-tighter">Review & Rating Controls</h4>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">Control how customer reviews are handled</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div>
                      <div className="text-xs font-black text-gray-900 uppercase tracking-tight">Enable Reviews</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Show review section on products</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={siteSettings.showReviews}
                        onChange={e => setSiteSettings({...siteSettings, showReviews: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div>
                      <div className="text-xs font-black text-gray-900 uppercase tracking-tight">Manual Approval</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Admins must approve new reviews</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={siteSettings.requireReviewApproval}
                        onChange={e => setSiteSettings({...siteSettings, requireReviewApproval: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div className="flex justify-between items-center bg-red-50 border border-red-100 p-6 rounded-2xl">
                <div>
                  <h4 className="text-sm font-bold text-red-900">Danger Zone</h4>
                  <p className="text-xs text-red-600">Wipe all data and reset the marketplace to factory defaults.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    handleFullReset();
                  }}
                  className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-red-700 shadow-lg shadow-red-100"
                >
                  Reset Website
                </button>
              </div>
            )}

            <form onSubmit={handleUpdateSettings} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Website Name</label>
                    <input 
                      type="text" 
                      value={siteSettings.siteName}
                      onChange={e => setSiteSettings({...siteSettings, siteName: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Favicon Name (Tab Title)</label>
                    <input 
                      type="text" 
                      value={siteSettings.tabTitle || ""}
                      onChange={e => setSiteSettings({...siteSettings, tabTitle: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Name shown in browser tab"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Favicon URL</label>
                    <input 
                      type="text" 
                      value={siteSettings.faviconUrl || ""}
                      onChange={e => setSiteSettings({...siteSettings, faviconUrl: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://example.com/favicon.ico"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">Brand Name Style</label>
                    <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2.5 rounded-2xl border border-gray-100/50">
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-gray-100">
                        <input 
                          type="color" 
                          value={siteSettings.brandColor || "#4f46e5"} 
                          onChange={e => setSiteSettings({...siteSettings, brandColor: e.target.value})} 
                          className="w-6 h-6 rounded border-none cursor-pointer" 
                        />
                        <span className="text-[10px] font-mono font-bold text-gray-600">{siteSettings.brandColor || "#4f46e5"}</span>
                      </div>
                      
                      <div className="h-6 w-px bg-gray-200" />

                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox"
                            className="sr-only peer"
                            checked={siteSettings.useBrandGradient || false}
                            onChange={e => setSiteSettings({...siteSettings, useBrandGradient: e.target.checked})}
                          />
                          <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">Gradient</span>
                      </label>

                      {siteSettings.useBrandGradient && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-gray-100">
                          <input 
                            type="color" 
                            value={siteSettings.brandSecondaryColor || "#818cf8"} 
                            onChange={e => setSiteSettings({...siteSettings, brandSecondaryColor: e.target.value})} 
                            className="w-6 h-6 rounded border-none cursor-pointer" 
                          />
                          <span className="text-[10px] font-mono font-bold text-gray-600">{siteSettings.brandSecondaryColor || "#818cf8"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Logo URL</label>
                  <input 
                    type="text" 
                    value={siteSettings.logoUrl}
                    onChange={e => setSiteSettings({...siteSettings, logoUrl: e.target.value})}
                    className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Hero Title</label>
                  <input 
                    type="text" 
                    value={siteSettings.heroTitle}
                    onChange={e => setSiteSettings({...siteSettings, heroTitle: e.target.value})}
                    className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Hero Subtitle</label>
                  <textarea 
                    rows={3}
                    value={siteSettings.heroSubtitle}
                    onChange={e => setSiteSettings({...siteSettings, heroSubtitle: e.target.value})}
                    className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="md:col-span-2 pt-6 border-t border-gray-100">
                  <h4 className="font-bold text-gray-900 border-l-4 border-indigo-600 pl-3 mb-4 uppercase text-sm tracking-tighter">Hero Text Styling</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Title Styling</h5>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Title Color</label>
                        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100">
                          <input 
                            type="color" 
                            value={siteSettings.heroTitleColor || "#ffffff"}
                            onChange={e => setSiteSettings({...siteSettings, heroTitleColor: e.target.value})}
                            className="h-8 w-8 rounded-lg bg-transparent border-none cursor-pointer"
                          />
                          <input 
                            type="text" 
                            value={siteSettings.heroTitleColor || "#ffffff"}
                            onChange={e => setSiteSettings({...siteSettings, heroTitleColor: e.target.value})}
                            className="text-xs font-mono bg-transparent border-none outline-none w-20"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Mobile Size</label>
                          <input 
                            type="text" 
                            value={siteSettings.heroTitleSizeMobile || "28px"}
                            onChange={e => setSiteSettings({...siteSettings, heroTitleSizeMobile: e.target.value})}
                            placeholder="28px"
                            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Desktop Size</label>
                          <input 
                            type="text" 
                            value={siteSettings.heroTitleSizeDesktop || "60px"}
                            onChange={e => setSiteSettings({...siteSettings, heroTitleSizeDesktop: e.target.value})}
                            placeholder="60px"
                            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Subtitle Styling</h5>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Subtitle Color</label>
                        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100">
                          <input 
                            type="color" 
                            value={siteSettings.heroSubtitleColor || "#ffffffcc"}
                            onChange={e => setSiteSettings({...siteSettings, heroSubtitleColor: e.target.value})}
                            className="h-8 w-8 rounded-lg bg-transparent border-none cursor-pointer"
                          />
                          <input 
                            type="text" 
                            value={siteSettings.heroSubtitleColor || "#ffffffcc"}
                            onChange={e => setSiteSettings({...siteSettings, heroSubtitleColor: e.target.value})}
                            className="text-xs font-mono bg-transparent border-none outline-none w-20"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Mobile Size</label>
                          <input 
                            type="text" 
                            value={siteSettings.heroSubtitleSizeMobile || "12px"}
                            onChange={e => setSiteSettings({...siteSettings, heroSubtitleSizeMobile: e.target.value})}
                            placeholder="12px"
                            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Desktop Size</label>
                          <input 
                            type="text" 
                            value={siteSettings.heroSubtitleSizeDesktop || "18px"}
                            onChange={e => setSiteSettings({...siteSettings, heroSubtitleSizeDesktop: e.target.value})}
                            placeholder="18px"
                            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Guide</h5>
                      <p className="text-[9px] text-gray-500 leading-relaxed bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                        Use standard CSS values like <code className="text-indigo-600 font-bold px-1">28px</code>, <code className="text-indigo-600 font-bold px-1">3.5rem</code>, or <code className="text-indigo-600 font-bold px-1">2vw</code>. 
                        Colors can be Hex codes or names. Changes apply globally to all Hero sliders.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Footer Description</label>
                  <textarea 
                    rows={2}
                    value={siteSettings.footerDescription}
                    onChange={e => setSiteSettings({...siteSettings, footerDescription: e.target.value})}
                    className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Short description for the footer..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Copyright Text (@copyright)</label>
                  <input 
                    type="text" 
                    value={siteSettings.footerCopyright}
                    onChange={e => setSiteSettings({...siteSettings, footerCopyright: e.target.value})}
                    className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="© 2026 Your Brand. All rights reserved."
                  />
                </div>

                <div className="md:col-span-2 space-y-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <Share2 className="w-3 h-3 text-indigo-600" />
                        Social Media Links
                      </h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Add your social profiles for the footer</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        const current = siteSettings.socialLinks || [];
                        setSiteSettings({
                          ...siteSettings,
                          socialLinks: [...current, { platform: "Facebook", url: "", icon: "Facebook" }]
                        });
                      }}
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Link
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(siteSettings.socialLinks || []).map((social, idx) => (
                      <div key={idx} className="bg-gray-50 p-4 rounded-2xl space-y-3 relative group border border-transparent hover:border-indigo-100 transition-colors">
                        <button 
                          type="button"
                          onClick={() => {
                            const next = [...siteSettings.socialLinks!];
                            next.splice(idx, 1);
                            setSiteSettings({ ...siteSettings, socialLinks: next });
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>

                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Platform</label>
                            <select 
                              value={social.platform}
                              onChange={(e) => {
                                const next = [...siteSettings.socialLinks!];
                                const platformMap: {[key: string]: string} = {
                                  'Facebook': 'Facebook',
                                  'Twitter': 'Twitter',
                                  'Instagram': 'Instagram',
                                  'YouTube': 'Youtube',
                                  'LinkedIn': 'Linkedin',
                                  'GitHub': 'Github',
                                  'WhatsApp': 'Phone',
                                  'Telegram': 'Send',
                                  'TikTok': 'Music',
                                  'Pinterest': 'Pin'
                                };
                                next[idx] = { 
                                  ...social, 
                                  platform: e.target.value,
                                  icon: platformMap[e.target.value] || 'ExternalLink'
                                };
                                setSiteSettings({ ...siteSettings, socialLinks: next });
                              }}
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="Facebook">Facebook</option>
                              <option value="Twitter">Twitter</option>
                              <option value="Instagram">Instagram</option>
                              <option value="YouTube">YouTube</option>
                              <option value="LinkedIn">LinkedIn</option>
                              <option value="GitHub">GitHub</option>
                              <option value="WhatsApp">WhatsApp</option>
                              <option value="Telegram">Telegram</option>
                              <option value="TikTok">TikTok</option>
                              <option value="Pinterest">Pinterest</option>
                            </select>
                          </div>
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100 mt-4">
                            {React.createElement(
                              social.platform === "Facebook" ? Facebook : 
                              social.platform === "Twitter" ? Twitter :
                              social.platform === "Instagram" ? Instagram :
                              social.platform === "YouTube" ? Youtube :
                              social.platform === "LinkedIn" ? Linkedin :
                              social.platform === "GitHub" ? Github :
                              social.platform === "WhatsApp" ? Phone :
                              social.platform === "TikTok" ? Music :
                              social.platform === "Pinterest" ? Pin :
                              social.platform === "Telegram" ? Send : ExternalLink,
                              { className: "w-5 h-5 text-indigo-500" }
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Profile URL</label>
                          <input 
                            type="url" 
                            value={social.url}
                            onChange={(e) => {
                              const next = [...siteSettings.socialLinks!];
                              next[idx] = { ...social, url: e.target.value };
                              setSiteSettings({ ...siteSettings, socialLinks: next });
                            }}
                            placeholder="https://..."
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    ))}
                    {(siteSettings.socialLinks || []).length === 0 && (
                      <div className="col-span-full py-8 border-2 border-dashed border-gray-100 rounded-4xl flex flex-col items-center justify-center gap-2 group">
                        <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                          <Share2 className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                        </div>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No social links added</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 pt-6 border-t border-gray-100">
                  <div className="bg-gray-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-32 -mt-32" />
                    
                    <div className="relative z-10 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-black text-lg uppercase tracking-tighter">Most Sold Ticker</h4>
                          <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest mt-1">Control the scrolling top seller bar</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={siteSettings.showTicker}
                            onChange={e => setSiteSettings({...siteSettings, showTicker: e.target.checked})}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                      </div>

                      {(siteSettings.showTicker ?? true) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Ticker Colors</label>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={siteSettings.tickerBgColor || "#4f46e5"}
                                      onChange={e => setSiteSettings({...siteSettings, tickerBgColor: e.target.value})}
                                      className="h-6 w-6 rounded-md bg-transparent border-none cursor-pointer"
                                    />
                                    <span className="text-[10px] font-mono text-white/60">{siteSettings.tickerBgColor || "#4f46e5"}</span>
                                  </div>
                                  <span className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1">Background</span>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={siteSettings.tickerTextColor || "#ffffff"}
                                      onChange={e => setSiteSettings({...siteSettings, tickerTextColor: e.target.value})}
                                      className="h-6 w-6 rounded-md bg-transparent border-none cursor-pointer"
                                    />
                                    <span className="text-[10px] font-mono text-white/60">{siteSettings.tickerTextColor || "#ffffff"}</span>
                                  </div>
                                  <span className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1">Text</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Ticker Text Label</label>
                              <input 
                                type="text"
                                value={siteSettings.tickerText || ""}
                                onChange={e => setSiteSettings({...siteSettings, tickerText: e.target.value})}
                                placeholder="🔥 Sold"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Scroll Speed (Seconds)</label>
                              <div className="flex items-center gap-4">
                                <input 
                                  type="range" 
                                  min="10" 
                                  max="60" 
                                  step="5"
                                  value={siteSettings.tickerSpeed || 25}
                                  onChange={e => setSiteSettings({...siteSettings, tickerSpeed: parseInt(e.target.value)})}
                                  className="flex-grow accent-indigo-500"
                                />
                                <span className="bg-white/10 px-3 py-1 rounded-lg font-mono text-xs">{siteSettings.tickerSpeed || 25}s</span>
                              </div>
                              <p className="text-[9px] text-white/30 mt-2 italic">* Lower value = Faster scroll</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-6 border-t border-gray-100">
                  <h4 className="font-bold text-gray-900 border-l-4 border-indigo-600 pl-3 mb-4 uppercase text-sm tracking-tighter">Marketplace Buttons</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100/50">
                    <div className="space-y-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                      <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Cart/Add Button</h5>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Button Text</label>
                        <input 
                          type="text" 
                          value={siteSettings.cartText || "Cart"}
                          onChange={e => setSiteSettings({...siteSettings, cartText: e.target.value})}
                          className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Background</label>
                          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                             <input type="color" value={siteSettings.cartColor || "#f9fafb"} onChange={e => setSiteSettings({...siteSettings, cartColor: e.target.value})} className="w-6 h-6 rounded border-none cursor-pointer" />
                             <span className="text-[9px] font-mono text-gray-400">{siteSettings.cartColor || "#f9fafb"}</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Text Color</label>
                          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                             <input type="color" value={siteSettings.cartTextColor || "#6b7280"} onChange={e => setSiteSettings({...siteSettings, cartTextColor: e.target.value})} className="w-6 h-6 rounded border-none cursor-pointer" />
                             <span className="text-[9px] font-mono text-gray-400">{siteSettings.cartTextColor || "#6b7280"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                      <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">View/Details Button</h5>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Button Text</label>
                        <input 
                          type="text" 
                          value={siteSettings.viewText || "View"}
                          onChange={e => setSiteSettings({...siteSettings, viewText: e.target.value})}
                          className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Background</label>
                          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                             <input type="color" value={siteSettings.viewColor || "#f9fafb"} onChange={e => setSiteSettings({...siteSettings, viewColor: e.target.value})} className="w-6 h-6 rounded border-none cursor-pointer" />
                             <span className="text-[9px] font-mono text-gray-400">{siteSettings.viewColor || "#f9fafb"}</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Text Color</label>
                          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                             <input type="color" value={siteSettings.viewTextColor || "#6b7280"} onChange={e => setSiteSettings({...siteSettings, viewTextColor: e.target.value})} className="w-6 h-6 rounded border-none cursor-pointer" />
                             <span className="text-[9px] font-mono text-gray-400">{siteSettings.viewTextColor || "#6b7280"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                      <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Buy/Purchase Button</h5>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Button Text</label>
                        <input 
                          type="text" 
                          value={siteSettings.buyText || "Buy"}
                          onChange={e => setSiteSettings({...siteSettings, buyText: e.target.value})}
                          className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Background</label>
                          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                             <input type="color" value={siteSettings.buyColor || "#4f46e5"} onChange={e => setSiteSettings({...siteSettings, buyColor: e.target.value})} className="w-6 h-6 rounded border-none cursor-pointer" />
                             <span className="text-[9px] font-mono text-gray-400">{siteSettings.buyColor || "#4f46e5"}</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Text Color</label>
                          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                             <input type="color" value={siteSettings.buyTextColor || "#ffffff"} onChange={e => setSiteSettings({...siteSettings, buyTextColor: e.target.value})} className="w-6 h-6 rounded border-none cursor-pointer" />
                             <span className="text-[9px] font-mono text-gray-400">{siteSettings.buyTextColor || "#ffffff"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h4 className="font-bold text-gray-900 border-l-4 border-indigo-600 pl-3">Hero Slider Banners</h4>
                      <p className="text-[10px] text-gray-400 mt-1 pl-3">Add multiple banners to create a sliding hero section.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        const newBanner = { 
                          id: Date.now().toString(), 
                          imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&q=80",
                          title: siteSettings.heroTitle || "New Title",
                          subtitle: siteSettings.heroSubtitle || "New Subtitle",
                          link: "/",
                          buttonText: "Open"
                        };
                        setSiteSettings(prev => ({
                          ...prev,
                          heroBanners: [...(prev.heroBanners || []), newBanner]
                        }));
                      }}
                      className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add New Slide
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(siteSettings.heroBanners || []).map((banner, index) => (
                      <div key={banner.id} className="bg-gray-50 rounded-2xl p-6 border border-gray-200 space-y-4 relative group">
                        <button 
                          type="button"
                          onClick={() => {
                            setSiteSettings(prev => ({
                              ...prev,
                              heroBanners: prev.heroBanners.filter(b => b.id !== banner.id)
                            }));
                          }}
                          className="absolute top-4 right-4 p-2 bg-white text-red-500 rounded-xl border border-red-50 opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex gap-4 items-start">
                          <div className="w-24 h-24 rounded-xl bg-white border border-gray-200 overflow-hidden flex-shrink-0">
                            <img src={banner.imageUrl} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-grow space-y-3">
                            <div>
                              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Slide Image URL</label>
                              <input 
                                type="text"
                                value={banner.imageUrl}
                                onChange={e => {
                                  const newBanners = [...siteSettings.heroBanners];
                                  newBanners[index].imageUrl = e.target.value;
                                  setSiteSettings({...siteSettings, heroBanners: newBanners});
                                }}
                                className="w-full mt-1 bg-white border-none rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                              />
                            </div>
                            <div>
                               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Target Link (Optional)</label>
                               <input 
                                 type="text"
                                 value={banner.link || ""}
                                 onChange={e => {
                                   const newBanners = [...siteSettings.heroBanners];
                                   newBanners[index].link = e.target.value;
                                   setSiteSettings({...siteSettings, heroBanners: newBanners});
                                 }}
                                 placeholder="/"
                                 className="w-full mt-1 bg-white border-none rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                               />
                             </div>
                             <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Button Text</label>
                                <input 
                                  type="text"
                                  value={banner.buttonText || ""}
                                  onChange={e => {
                                    const newBanners = [...siteSettings.heroBanners];
                                    newBanners[index].buttonText = e.target.value;
                                    setSiteSettings({...siteSettings, heroBanners: newBanners});
                                  }}
                                  placeholder="Open"
                                  className="w-full mt-1 bg-white border-none rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold"
                                />
                             </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Title Translation</label>
                            <input 
                              type="text"
                              value={banner.title || ""}
                              onChange={e => {
                                const newBanners = [...siteSettings.heroBanners];
                                newBanners[index].title = e.target.value;
                                setSiteSettings({...siteSettings, heroBanners: newBanners});
                              }}
                              className="w-full mt-1 bg-white border-none rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Subtitle Translation</label>
                            <input 
                              type="text"
                              value={banner.subtitle || ""}
                              onChange={e => {
                                const newBanners = [...siteSettings.heroBanners];
                                newBanners[index].subtitle = e.target.value;
                                setSiteSettings({...siteSettings, heroBanners: newBanners});
                              }}
                              className="w-full mt-1 bg-white border-none rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {(!siteSettings.heroBanners || siteSettings.heroBanners.length === 0) && (
                      <div className="md:col-span-2 py-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[32px] text-center">
                        <ImagePlus className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold text-sm tracking-tight italic">No custom sliders added yet. Default hero will be used.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      id="showHero"
                      checked={siteSettings.showHero !== false}
                      onChange={e => setSiteSettings({...siteSettings, showHero: e.target.checked})}
                      className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="showHero" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                      Show Hero / Slider Section
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      id="showTicker"
                      checked={siteSettings.showTicker !== false}
                      onChange={e => setSiteSettings({...siteSettings, showTicker: e.target.checked})}
                      className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="showTicker" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                      Show Most Sold Ticker (Slide)
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2 pt-6 border-t border-gray-100">
                  <h4 className="font-bold text-gray-900 border-l-4 border-indigo-600 pl-3 mb-4">Payment Methods Visibility</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl">
                      <input 
                        type="checkbox"
                        id="enableStripe"
                        checked={siteSettings.enableStripe !== false}
                        onChange={e => setSiteSettings({...siteSettings, enableStripe: e.target.checked})}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor="enableStripe" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                        Stripe
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl">
                      <input 
                        type="checkbox"
                        id="enableLocal"
                        checked={siteSettings.enableLocal !== false}
                        onChange={e => setSiteSettings({...siteSettings, enableLocal: e.target.checked})}
                        className="w-5 h-5 rounded border-gray-300 text-pink-600 focus:ring-pink-500 cursor-pointer"
                      />
                      <label htmlFor="enableLocal" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                        Local (bKash)
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl">
                      <input 
                        type="checkbox"
                        id="enableCOD"
                        checked={siteSettings.enableCOD !== false}
                        onChange={e => setSiteSettings({...siteSettings, enableCOD: e.target.checked})}
                        className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="enableCOD" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                        COD
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl">
                      <input 
                        type="checkbox"
                        id="enableBinancePay"
                        checked={siteSettings.enableBinancePay || false}
                        onChange={e => setSiteSettings({...siteSettings, enableBinancePay: e.target.checked})}
                        className="w-5 h-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400 cursor-pointer"
                      />
                      <label htmlFor="enableBinancePay" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                        Binance Pay
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl">
                      <input 
                        type="checkbox"
                        id="enablePayoneer"
                        checked={siteSettings.enablePayoneer || false}
                        onChange={e => setSiteSettings({...siteSettings, enablePayoneer: e.target.checked})}
                        className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <label htmlFor="enablePayoneer" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                        Payoneer
                      </label>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">bKash Number</label>
                    <input 
                      type="text"
                      value={siteSettings.bkashNumber || ""}
                      onChange={e => setSiteSettings({...siteSettings, bkashNumber: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="017xxxxxxxx"
                    />
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] mt-2 block">bKash Logo URL</label>
                    <input 
                      type="text"
                      value={(siteSettings as any).bkashLogo || ""}
                      onChange={e => setSiteSettings({...siteSettings, bkashLogo: e.target.value} as any)}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                      placeholder="Logo URL"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nagad Number</label>
                    <input 
                      type="text"
                      value={siteSettings.nagadNumber || ""}
                      onChange={e => setSiteSettings({...siteSettings, nagadNumber: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="018xxxxxxxx"
                    />
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] mt-2 block">Nagad Logo URL</label>
                    <input 
                      type="text"
                      value={(siteSettings as any).nagadLogo || ""}
                      onChange={e => setSiteSettings({...siteSettings, nagadLogo: e.target.value} as any)}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                      placeholder="Logo URL"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rocket Number</label>
                    <input 
                      type="text"
                      value={siteSettings.rocketNumber || ""}
                      onChange={e => setSiteSettings({...siteSettings, rocketNumber: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="019xxxxxxxx"
                    />
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] mt-2 block">Rocket Logo URL</label>
                    <input 
                      type="text"
                      value={(siteSettings as any).rocketLogo || ""}
                      onChange={e => setSiteSettings({...siteSettings, rocketLogo: e.target.value} as any)}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                      placeholder="Logo URL"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Binance Pay ID</label>
                    <input 
                      type="text"
                      value={siteSettings.binanceId || ""}
                      onChange={e => setSiteSettings({...siteSettings, binanceId: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="Binance Pay ID"
                    />
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] mt-2 block">Binance QR URL</label>
                    <input 
                      type="text"
                      value={siteSettings.binanceQR || ""}
                      onChange={e => setSiteSettings({...siteSettings, binanceQR: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                      placeholder="QR Image URL"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payoneer Email</label>
                    <input 
                      type="text"
                      value={siteSettings.payoneerEmail || ""}
                      onChange={e => setSiteSettings({...siteSettings, payoneerEmail: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="Payoneer Email"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-4 pt-8 border-t border-gray-100">
                <h4 className="font-bold text-gray-900 border-l-4 border-emerald-500 pl-3">Legal & Support Contact</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Privacy Policy URL</label>
                    <input 
                      type="text" 
                      value={siteSettings.privacyUrl}
                      onChange={e => setSiteSettings({...siteSettings, privacyUrl: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="/p/privacy-policy"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Terms of Service URL</label>
                    <input 
                      type="text" 
                      value={siteSettings.termsUrl}
                      onChange={e => setSiteSettings({...siteSettings, termsUrl: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="/p/terms-of-service"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Support Email</label>
                    <input 
                      type="email" 
                      value={siteSettings.supportEmail}
                      onChange={e => setSiteSettings({...siteSettings, supportEmail: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Support Phone</label>
                    <input 
                      type="text" 
                      value={siteSettings.supportPhone}
                      onChange={e => setSiteSettings({...siteSettings, supportPhone: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Support Address</label>
                    <input 
                      type="text" 
                      value={siteSettings.supportAddress}
                      onChange={e => setSiteSettings({...siteSettings, supportAddress: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-gray-100">
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 border-l-4 border-indigo-600 pl-3">Stat 1</h4>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Label</label>
                    <input 
                      type="text" 
                      value={siteSettings.stat1Label}
                      onChange={e => setSiteSettings({...siteSettings, stat1Label: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Value</label>
                    <input 
                      type="text" 
                      value={siteSettings.stat1Value}
                      onChange={e => setSiteSettings({...siteSettings, stat1Value: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 border-l-4 border-purple-600 pl-3">Stat 2</h4>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Label</label>
                    <input 
                      type="text" 
                      value={siteSettings.stat2Label}
                      onChange={e => setSiteSettings({...siteSettings, stat2Label: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Value</label>
                    <input 
                      type="text" 
                      value={siteSettings.stat2Value}
                      onChange={e => setSiteSettings({...siteSettings, stat2Value: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 border-l-4 border-pink-600 pl-3">Stat 3</h4>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Label</label>
                    <input 
                      type="text" 
                      value={siteSettings.stat3Label}
                      onChange={e => setSiteSettings({...siteSettings, stat3Label: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Value</label>
                    <input 
                      type="text" 
                      value={siteSettings.stat3Value}
                      onChange={e => setSiteSettings({...siteSettings, stat3Value: e.target.value})}
                      className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 pt-4">
                <button 
                  type="submit"
                  className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 flex items-center gap-3 hover:-translate-y-1 active:translate-y-0 active:scale-95"
                >
                  <Save className="w-5 h-5" />
                  Save Global Configuration
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      {/* Modal - Order Details */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-tighter">Order Details</h2>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Order ID: #{selectedOrder.id.slice(-8).toUpperCase()}</p>
                <p className="text-[9px] font-medium text-gray-300 mt-0.5">FULL ID: {selectedOrder.id}</p>
              </div>
              <button onClick={() => setSelectedOrderId(null)} className="text-gray-400 hover:text-gray-600 bg-gray-50 p-2 rounded-xl transition-all">
                <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 transform rotate-45" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Customer</div>
                <div className="font-bold text-gray-900 text-xs sm:text-sm leading-tight">{selectedOrder.customerName || "Anonymous User"}</div>
                <div className="text-[10px] sm:text-[11px] text-gray-500 mt-1">{selectedOrder.customerEmail || selectedOrder.userEmail || "No email available"}</div>
                {selectedOrder.customerPhone && (
                  <div className="text-[10px] sm:text-[11px] text-emerald-600 font-black mt-2 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {selectedOrder.customerPhone}
                  </div>
                )}
                {selectedOrder.deliveryAddress && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Delivery Address</div>
                    <div className="text-[10px] sm:text-[11px] text-gray-700 leading-relaxed font-medium bg-white p-2 rounded-lg border border-gray-50">
                      {selectedOrder.deliveryAddress}
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-right">
                <div className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-200 pb-2">Financial Summary</div>
                
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Order Subtotal</span>
                    <span className="font-mono font-bold text-gray-600 text-xs">
                      ৳{(selectedOrder.grossAmount || selectedOrder.amount + (selectedOrder.discountAmount || 0)).toLocaleString()}
                    </span>
                  </div>
                  
                  {selectedOrder.couponCode && (
                    <div className="flex justify-between items-baseline text-emerald-600">
                      <div className="flex flex-col items-start">
                        <span className="text-[9px] font-black uppercase tracking-widest">Coupon Discount</span>
                        <div className="flex items-center gap-1">
                          <Ticket className="w-2 h-2" />
                          <span className="text-[8px] font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">CODE: {selectedOrder.couponCode}</span>
                        </div>
                      </div>
                      <span className="font-mono font-black text-xs">-৳{(selectedOrder.discountAmount || 0).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline pt-2 border-t border-gray-200 border-dashed">
                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Net Payment</span>
                    <div className="text-right">
                      <div className="font-black text-indigo-600 text-base sm:text-xl">
                        ৳{(selectedOrder.netAmount || selectedOrder.amount).toLocaleString()}
                      </div>
                      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                        {selectedOrder.paymentStatus === 'paid' ? 'Total Paid' : 'Payable Amount'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4">
                    <span className={cn(
                      "px-2 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm",
                      selectedOrder.status === "completed" ? "bg-emerald-100 text-emerald-700" : 
                      selectedOrder.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                    )}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  {selectedOrder.status === "pending" && isActuallyAdmin && (
                    <button 
                      onClick={() => handleConfirmOrder(selectedOrder.id)}
                      className="w-full mt-4 bg-indigo-600 text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      Confirm Order
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-1">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Payment Method</div>
                <div className="font-bold text-pink-600 uppercase text-xs">
                  {selectedOrder.paymentMethod === "cod" ? "Cash on Delivery" : 
                   selectedOrder.paymentMethod === "binance" ? "Binance Pay" :
                   selectedOrder.paymentMethod === "payoneer" ? "Payoneer" :
                   selectedOrder.paymentMethod || "N/A"}
                </div>
              </div>
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-1">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Payment Phone</div>
                <div className="font-bold text-emerald-600 text-xs">{selectedOrder.paymentPhone || "N/A"}</div>
              </div>
              {selectedOrder.amountUSD && (
                <div className="bg-yellow-50/50 p-4 rounded-2xl border border-yellow-100 space-y-1 col-span-2">
                  <div className="text-[9px] font-black text-yellow-600 uppercase tracking-widest flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    USD Amount Details
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-yellow-900">${selectedOrder.amountUSD.toFixed(2)} USD</span>
                    <span className="text-[9px] font-black text-yellow-400 uppercase tracking-tighter">Rate: ৳1 = ${selectedOrder.usdRate?.toFixed(4)}</span>
                  </div>
                </div>
              )}
              <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 space-y-1 col-span-2">
                <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Transaction ID / Payment Proof
                </div>
                <div className="font-mono font-bold text-gray-900 text-sm break-all">{selectedOrder.transactionId || "N/A"}</div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Order Items & Assets</div>
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded-lg border border-gray-100 shadow-sm">
                  {selectedOrder.items?.length || selectedOrder.productIds?.length || 1} { (selectedOrder.items?.length || 1) === 1 ? 'Item' : 'Items' }
                </div>
              </div>
              <div className="space-y-4">
                {(selectedOrder.items || [{ id: selectedOrder.productIds?.[0], name: selectedOrder.productName, price: selectedOrder.amount + (selectedOrder.discountAmount || 0) }]).map((item: any, i: number) => {
                  const itemId = item.id || `legacy-${i}`;
                  return (
                    <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 space-y-4 shadow-sm hover:border-indigo-100 transition-colors">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                            "bg-indigo-50 text-indigo-600"
                          )}>
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-black text-xs text-gray-900 block">{item.name || "Product Name"}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">SKU: {itemId.slice(-8).toUpperCase()}</span>
                              {item.size && (
                                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tighter">
                                  Size: {item.size}
                                </span>
                              )}
                              {item.quantity > 1 && (
                                <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-tighter">
                                  Qty: {item.quantity}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-sm text-gray-900 leading-none block">৳{(Number(item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">
                            {item.quantity > 1 ? `৳${Number(item.price || 0).toLocaleString()} × ${item.quantity}` : 'Unit Price'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter pl-1">Login ID / User</label>
                          <input 
                            type="text"
                            value={editingCredentials[itemId]?.username || selectedOrder.credentials?.[itemId]?.username || ""}
                            onChange={(e) => setEditingCredentials(prev => ({
                              ...prev,
                              [itemId]: { ...(prev[itemId] || selectedOrder.credentials?.[itemId] || {}), username: e.target.value }
                            }))}
                            placeholder="username"
                            className="w-full bg-gray-50 border-none rounded-xl p-2.5 text-[11px] font-bold focus:ring-1 focus:ring-indigo-200 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter pl-1">Password</label>
                          <input 
                            type="text"
                            value={editingCredentials[itemId]?.password || selectedOrder.credentials?.[itemId]?.password || ""}
                            onChange={(e) => setEditingCredentials(prev => ({
                              ...prev,
                              [itemId]: { ...(prev[itemId] || selectedOrder.credentials?.[itemId] || {}), password: e.target.value }
                            }))}
                            placeholder="password"
                            className="w-full bg-gray-50 border-none rounded-xl p-2.5 text-[11px] font-bold focus:ring-1 focus:ring-indigo-200 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-100">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 text-left block">Admin Note / Special Instructions</label>
                <textarea 
                  value={editingNote}
                  onChange={(e) => setEditingNote(e.target.value)}
                  placeholder="Paste login details, account info, or special instructions for the buyer here..."
                  className="w-full bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-[12px] font-medium focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px] resize-none"
                />
              </div>

              {selectedOrder.status === "completed" && isActuallyAdmin && (
                <button 
                  onClick={handleUpdateOrderCredentials}
                  className="w-full py-4 bg-white text-indigo-600 border border-indigo-100 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
                >
                  Update Order Details
                </button>
              )}
            </div>

            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Order Placed</span>
                  <span className="text-xs font-bold text-indigo-900">
                    {selectedOrder.createdAt?.toDate().toLocaleString() || "Syncing..."}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Gateway</span>
                <span className="text-xs font-bold text-indigo-900 capitalize">{selectedOrder.gateway || "Stripe"}</span>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button 
                onClick={async () => {
                  if (!isActuallyAdmin) {
                    alert("Admin access required.");
                    return;
                  }
                  if (window.confirm("Purge this order record?")) {
                    try {
                      await deleteDoc(doc(db, "orders", selectedOrder.id));
                      await fetchOrders();
                      setSelectedOrderId(null);
                      alert("Order record deleted.");
                    } catch (e) {
                      console.error(e);
                      alert("Failed to delete record.");
                    }
                  }
                }}
                className={cn(
                  "flex-grow py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border",
                  isActuallyAdmin 
                    ? "bg-red-50 text-red-600 border-red-100 hover:bg-red-100" 
                    : "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                )}
              >
                Delete Record
              </button>
              <button 
                onClick={() => setSelectedOrderId(null)}
                className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200"
              >
                Close View
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal - Edit Category */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 text-left">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
          >
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Edit Category</h2>
            <form onSubmit={handleUpdateCategory} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Category Name</label>
                <input 
                  type="text" required value={editingCategory.name}
                  onChange={e => setEditingCategory({...editingCategory, name: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Description (Optional)</label>
                <textarea 
                  rows={3}
                  value={editingCategory.description || ""}
                  onChange={e => setEditingCategory({...editingCategory, description: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" onClick={() => setEditingCategory(null)}
                  className="px-10 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-grow py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
                >
                  Update Category
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal - Add Category */}
      {isAddingCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 text-left">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
          >
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Add New Category</h2>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Category Name</label>
                <input 
                  type="text" required value={newCategory.name}
                  onChange={e => setNewCategory({...newCategory, name: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Graphic Assets"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Description (Optional)</label>
                <textarea 
                  rows={3}
                  value={newCategory.description}
                  onChange={e => setNewCategory({...newCategory, description: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="What's this category for?"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" onClick={() => setIsAddingCategory(false)}
                  className="px-10 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-grow py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
                >
                  Create Category
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl space-y-6"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedTicket.subject}</h2>
                <p className="text-sm text-gray-500">From: {selectedTicket.name} ({selectedTicket.email})</p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-gray-600">
                <Trash2 className="w-6 h-6 transform rotate-45" />
              </button>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 min-h-[200px]">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedTicket.message}</p>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button" onClick={() => setSelectedTicket(null)}
                className="px-10 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
              >
                Close
              </button>
              <a 
                href={`mailto:${selectedTicket.email}?subject=Re: ${selectedTicket.subject}`}
                className="flex-grow py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all text-center flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-indigo-100"
              >
                <Mail className="w-5 h-5" />
                Reply via Email
              </a>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal - Edit Page Form */}
      {editingPage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 text-left">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-900">Edit Page</h2>
            <form onSubmit={handleUpdatePage} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Page Title</label>
                  <input 
                    type="text" required value={editingPage.title}
                    onChange={e => setEditingPage({...editingPage, title: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Slug</label>
                  <input 
                    type="text" required value={editingPage.slug}
                    onChange={e => setEditingPage({...editingPage, slug: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Content (HTML/Markdown)</label>
                <textarea 
                  rows={10} required value={editingPage.content}
                  onChange={e => setEditingPage({...editingPage, content: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
              </div>
              <div className="flex gap-4 pt-6">
                <button 
                  type="button" onClick={() => setEditingPage(null)}
                  className="px-10 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-grow py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 hover:-translate-y-0.5"
                >
                  Update Custom Page
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal - Add Page Form */}
      {isAddingPage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 text-left">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-900">Create New Page</h2>
            <form onSubmit={handleAddPage} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Page Title</label>
                  <input 
                    name="title" type="text" required
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Privacy Policy"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Slug</label>
                  <input 
                    name="slug" type="text" required
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. privacy-policy"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Content (Markdown)</label>
                <textarea 
                  name="content" rows={10} required
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  placeholder="Enter page content here..."
                />
              </div>
              <div className="flex gap-4 pt-6">
                <button 
                  type="button" onClick={() => setIsAddingPage(false)}
                  className="px-10 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  className="flex-grow py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 hover:-translate-y-0.5"
                >
                  Publish Page
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal - Edit Form */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 text-left">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Edit Product</h2>
            <form onSubmit={handleUpdateProduct} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Product Name</label>
                <input 
                  type="text" required value={editingProduct.name}
                  onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Price (Taka)</label>
                <input 
                  type="number" required value={editingProduct.price}
                  onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Category</label>
                <select 
                  value={editingProduct.category}
                  onChange={e => {
                    if (e.target.value === "ADD_NEW") {
                      setIsAddingCategory(true);
                      return;
                    }
                    setEditingProduct({...editingProduct, category: e.target.value});
                  }}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Category</option>
                  <option value="Software">Software</option>
                  <option value="Plugins">Plugins</option>
                  <option value="Scripts">Scripts</option>
                  <option value="Apps">Apps</option>
                  <option value="Templates">Templates</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="Subscription">Subscription</option>
                  <option value="ADD_NEW" className="text-indigo-600 font-bold">+ Add New Category</option>
                </select>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <div className="md:col-span-2 flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Size Settings</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={editingProduct.enableSizes}
                      onChange={e => setEditingProduct({...editingProduct, enableSizes: e.target.checked})}
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Enable Sizes</span>
                  </label>
                </div>
                
                {editingProduct.enableSizes && (
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Available Sizes</label>
                    <input 
                      type="text" 
                      value={editingProduct.availableSizes}
                      onChange={e => setEditingProduct({...editingProduct, availableSizes: e.target.value})}
                      className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="e.g. S, M, L, XL, XXL (Comma separated)"
                    />
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-tight pl-1 italic">Enter sizes separated by commas</p>
                  </div>
                )}
              </div>

              {editingProduct.category === "Subscription" && (
                <>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100">
                    <div className="md:col-span-2 flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Subscription Settings</span>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Monthly Label</label>
                      <input 
                        type="text" value={editingProduct.subscriptionMonthlyText || ""}
                        onChange={e => setEditingProduct({...editingProduct, subscriptionMonthlyText: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Monthly Plan"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Monthly Subtext</label>
                      <input 
                        type="text" value={editingProduct.subscriptionMonthlySubtext || ""}
                        onChange={e => setEditingProduct({...editingProduct, subscriptionMonthlySubtext: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Access for 30 days"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Monthly Price</label>
                      <input 
                        type="number" value={editingProduct.subscriptionMonthlyPrice || ""}
                        onChange={e => setEditingProduct({...editingProduct, subscriptionMonthlyPrice: Number(e.target.value)})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                      />
                    </div>
                    <div className="border-t border-indigo-100 md:col-span-2 my-2"></div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Yearly Label</label>
                      <input 
                        type="text" value={editingProduct.subscriptionYearlyText || ""}
                        onChange={e => setEditingProduct({...editingProduct, subscriptionYearlyText: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Annual Savings"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Yearly Subtext</label>
                      <input 
                        type="text" value={editingProduct.subscriptionYearlySubtext || ""}
                        onChange={e => setEditingProduct({...editingProduct, subscriptionYearlySubtext: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Best value for pros"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Yearly Price</label>
                      <input 
                        type="number" value={editingProduct.subscriptionYearlyPrice || ""}
                        onChange={e => setEditingProduct({...editingProduct, subscriptionYearlyPrice: Number(e.target.value)})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                      />
                    </div>
                    <div className="border-t border-indigo-100 md:col-span-2 my-2"></div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Lifetime Label</label>
                      <input 
                        type="text" value={editingProduct.subscriptionLifetimeText || ""}
                        onChange={e => setEditingProduct({...editingProduct, subscriptionLifetimeText: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Forever Deal"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Lifetime Subtext</label>
                      <input 
                        type="text" value={editingProduct.subscriptionLifetimeSubtext || ""}
                        onChange={e => setEditingProduct({...editingProduct, subscriptionLifetimeSubtext: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Own it for life"
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Description</label>
                <textarea 
                  rows={3}
                  value={editingProduct.description ?? ""}
                  onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Main Image URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" value={editingProduct.imageUrl}
                    onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})}
                    className="flex-grow bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "main", "edit")}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <button type="button" disabled={uploading} className="h-full px-4 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center gap-2 hover:bg-indigo-100 transition-all disabled:opacity-50">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">{uploading ? "Uploading" : "Upload"}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">YouTube Video URL</label>
                <input 
                  type="text" 
                  value={editingProduct.videoUrl || ""}
                  onChange={e => setEditingProduct({...editingProduct, videoUrl: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div className="md:col-span-1 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Discount Price</label>
                <input 
                  type="number" 
                  value={editingProduct.discountPrice || 0}
                  onChange={e => setEditingProduct({...editingProduct, discountPrice: Number(e.target.value)})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <div className="md:col-span-1 flex items-center gap-2 pt-6">
                <input 
                  type="checkbox" 
                  checked={editingProduct.discountEnabled || false}
                  onChange={e => setEditingProduct({...editingProduct, discountEnabled: e.target.checked})}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                  id="edit-discount-enabled"
                />
                <label htmlFor="edit-discount-enabled" className="text-xs font-bold text-gray-400 uppercase tracking-widest cursor-pointer">Enable Discount</label>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Additional Images (comma separated)</label>
                <div className="flex gap-2">
                  <textarea 
                    rows={2}
                    value={editingProduct.additionalImageUrls || ""}
                    onChange={e => setEditingProduct({...editingProduct, additionalImageUrls: e.target.value})}
                    placeholder="url1, url2, url3..."
                    className="flex-grow bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  />
                  <div className="relative flex-shrink-0">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "additional", "edit")}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <button type="button" disabled={uploading} className="h-full px-4 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center hover:bg-pink-100 transition-all disabled:opacity-50">
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Download URL</label>
                <input 
                  type="text" value={editingProduct.fileUrl}
                  onChange={e => setEditingProduct({...editingProduct, fileUrl: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="md:col-span-2 flex gap-4 pt-8">
                <button 
                  type="button" onClick={() => setEditingProduct(null)}
                  className="px-10 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-grow py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-95 hover:-translate-y-0.5"
                >
                  Apply Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal - Simple Form */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Add Digital Product</h2>
            <form onSubmit={handleAddProduct} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Product Name</label>
                <input 
                  type="text" required value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Modern CRM Dashboard"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Price (Taka)</label>
                <input 
                  type="number" required value={newProduct.price}
                  onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Category</label>
                <select 
                  value={newProduct.category}
                  onChange={e => {
                    if (e.target.value === "ADD_NEW") {
                      setIsAddingCategory(true);
                      return;
                    }
                    setNewProduct({...newProduct, category: e.target.value});
                  }}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Category</option>
                  <option value="Software">Software</option>
                  <option value="Plugins">Plugins</option>
                  <option value="Scripts">Scripts</option>
                  <option value="Apps">Apps</option>
                  <option value="Templates">Templates</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="Subscription">Subscription</option>
                  <option value="ADD_NEW" className="text-indigo-600 font-bold">+ Add New Category</option>
                </select>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <div className="md:col-span-2 flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Size Settings</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={newProduct.enableSizes}
                      onChange={e => setNewProduct({...newProduct, enableSizes: e.target.checked})}
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Enable Sizes</span>
                  </label>
                </div>
                
                {newProduct.enableSizes && (
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Available Sizes</label>
                    <input 
                      type="text" 
                      value={newProduct.availableSizes}
                      onChange={e => setNewProduct({...newProduct, availableSizes: e.target.value})}
                      className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="e.g. S, M, L, XL, XXL (Comma separated)"
                    />
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-tight pl-1 italic">Enter sizes separated by commas</p>
                  </div>
                )}
              </div>

              {newProduct.category === "Subscription" && (
                <>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100">
                    <div className="md:col-span-2 flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Subscription Settings</span>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Monthly Label</label>
                      <input 
                        type="text" value={newProduct.subscriptionMonthlyText}
                        onChange={e => setNewProduct({...newProduct, subscriptionMonthlyText: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Monthly Plan"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Monthly Subtext</label>
                      <input 
                        type="text" value={newProduct.subscriptionMonthlySubtext}
                        onChange={e => setNewProduct({...newProduct, subscriptionMonthlySubtext: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Access for 30 days"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Monthly Price</label>
                      <input 
                        type="number" value={newProduct.subscriptionMonthlyPrice || ""}
                        onChange={e => setNewProduct({...newProduct, subscriptionMonthlyPrice: Number(e.target.value)})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                      />
                    </div>
                    <div className="border-t border-indigo-100 md:col-span-2 my-2"></div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Yearly Label</label>
                      <input 
                        type="text" value={newProduct.subscriptionYearlyText}
                        onChange={e => setNewProduct({...newProduct, subscriptionYearlyText: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Annual Savings"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Yearly Subtext</label>
                      <input 
                        type="text" value={newProduct.subscriptionYearlySubtext}
                        onChange={e => setNewProduct({...newProduct, subscriptionYearlySubtext: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Best value for pros"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Yearly Price</label>
                      <input 
                        type="number" value={newProduct.subscriptionYearlyPrice || ""}
                        onChange={e => setNewProduct({...newProduct, subscriptionYearlyPrice: Number(e.target.value)})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                      />
                    </div>
                    <div className="border-t border-indigo-100 md:col-span-2 my-2"></div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Lifetime Label</label>
                      <input 
                        type="text" value={newProduct.subscriptionLifetimeText}
                        onChange={e => setNewProduct({...newProduct, subscriptionLifetimeText: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Forever Deal"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Lifetime Subtext</label>
                      <input 
                        type="text" value={newProduct.subscriptionLifetimeSubtext}
                        onChange={e => setNewProduct({...newProduct, subscriptionLifetimeSubtext: e.target.value})}
                        className="w-full bg-white border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Own it for life"
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Main Image URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" value={newProduct.imageUrl}
                    onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})}
                    className="flex-grow bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://images.unsplash.com/..."
                  />
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "main", "new")}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <button type="button" disabled={uploading} className="h-full px-4 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center gap-2 hover:bg-indigo-100 transition-all disabled:opacity-50">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">{uploading ? "Uploading" : "Upload"}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">YouTube Video URL</label>
                <input 
                  type="text" 
                  value={newProduct.videoUrl || ""}
                  onChange={e => setNewProduct({...newProduct, videoUrl: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div className="md:col-span-1 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Discount Price</label>
                <input 
                  type="number" 
                  value={newProduct.discountPrice || 0}
                  onChange={e => setNewProduct({...newProduct, discountPrice: Number(e.target.value)})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <div className="md:col-span-1 flex items-center gap-2 pt-6">
                <input 
                  type="checkbox" 
                  checked={newProduct.discountEnabled || false}
                  onChange={e => setNewProduct({...newProduct, discountEnabled: e.target.checked})}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                  id="new-discount-enabled"
                />
                <label htmlFor="new-discount-enabled" className="text-xs font-bold text-gray-400 uppercase tracking-widest cursor-pointer">Enable Discount</label>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Additional Images (comma separated)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newProduct.additionalImageUrls}
                    onChange={e => setNewProduct({...newProduct, additionalImageUrls: e.target.value})}
                    placeholder="url1, url2, url3..."
                    className="flex-grow bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="relative flex-shrink-0">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "additional", "new")}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <button type="button" disabled={uploading} className="h-full px-4 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center hover:bg-pink-100 transition-all disabled:opacity-50">
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Download URL (Private)</label>
                <input 
                  type="text" value={newProduct.fileUrl}
                  onChange={e => setNewProduct({...newProduct, fileUrl: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Link to secure file"
                />
              </div>
              <div className="md:col-span-2 flex gap-4 pt-8">
                <button 
                  type="button" onClick={() => setIsAdding(false)}
                  className="px-10 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  className="flex-grow py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-95 hover:-translate-y-0.5"
                >
                  Save & Publish Product
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Add Coupon Modal */}
      {isAddingCoupon && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl"
          >
             <div className="p-8 border-b border-gray-50">
               <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Create Discount Coupon</h3>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Set up a new discount code for your store</p>
             </div>
             
             <form onSubmit={handleAddCoupon} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Coupon Code</label>
                    <input 
                      type="text" 
                      required
                      placeholder="E.G. SAVE20"
                      value={newCoupon.code}
                      onChange={e => setNewCoupon({...newCoupon, code: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Discount Type</label>
                      <select 
                        value={newCoupon.type}
                        onChange={e => setNewCoupon({...newCoupon, type: e.target.value as any})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (৳)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Value</label>
                      <input 
                        type="number" 
                        required
                        value={newCoupon.value}
                        onChange={e => setNewCoupon({...newCoupon, value: Number(e.target.value)})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Assignee Bonus (%)</label>
                      <input 
                        type="number" 
                        placeholder="Commission %"
                        value={newCoupon.bonusPercentage || 0}
                        onChange={e => setNewCoupon({...newCoupon, bonusPercentage: Number(e.target.value)})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                      <p className="text-[8px] text-gray-400 mt-1 ml-1 uppercase font-bold tracking-tight">Bonus from Net Sale.</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Usage Limit</label>
                      <input 
                        type="number" 
                        placeholder="0 = Unlimited"
                        value={newCoupon.usageLimit || 0}
                        onChange={e => setNewCoupon({...newCoupon, usageLimit: Number(e.target.value)})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                      <p className="text-[8px] text-gray-400 mt-1 ml-1 uppercase font-bold tracking-tight">Max uses.</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Expiry Date</label>
                    <input 
                      type="date" 
                      required
                      value={newCoupon.expiryDate}
                      onChange={e => setNewCoupon({...newCoupon, expiryDate: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Assign to Email (Optional)</label>
                    <input 
                      type="email" 
                      placeholder="user@example.com"
                      value={newCoupon.assignedEmail}
                      onChange={e => setNewCoupon({...newCoupon, assignedEmail: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-[8px] text-gray-400 mt-1 ml-1 uppercase font-bold tracking-tight">Only this user will be able to see and use this coupon.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 px-1">
                  <input 
                    type="checkbox" 
                    id="isCouponActiveNew"
                    checked={newCoupon.isActive}
                    onChange={e => setNewCoupon({...newCoupon, isActive: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="isCouponActiveNew" className="text-[10px] font-bold text-gray-600 uppercase tracking-widest cursor-pointer">Coupon is Active</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingCoupon(false)}
                    className="flex-1 py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    Save Coupon
                  </button>
                </div>
             </form>
          </motion.div>
        </div>
      )}
      {/* Edit Coupon Modal */}
      {editingCoupon && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl"
          >
             <div className="p-8 border-b border-gray-50">
               <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Edit Discount Coupon</h3>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Modify existing coupon details</p>
             </div>
             
             <form onSubmit={handleUpdateCoupon} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Coupon Code</label>
                    <input 
                      type="text" 
                      required
                      placeholder="E.G. SAVE20"
                      value={editingCoupon.code}
                      onChange={e => setEditingCoupon({...editingCoupon, code: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Discount Type</label>
                      <select 
                        value={editingCoupon.type}
                        onChange={e => setEditingCoupon({...editingCoupon, type: e.target.value as any})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (৳)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Value</label>
                      <input 
                        type="number" 
                        required
                        value={editingCoupon.value}
                        onChange={e => setEditingCoupon({...editingCoupon, value: Number(e.target.value)})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Assignee Bonus (%)</label>
                      <input 
                        type="number" 
                        placeholder="Commission %"
                        value={editingCoupon.bonusPercentage || 0}
                        onChange={e => setEditingCoupon({...editingCoupon, bonusPercentage: Number(e.target.value)})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Usage Limit</label>
                      <input 
                        type="number" 
                        placeholder="0 = Unlimited"
                        value={editingCoupon.usageLimit || 0}
                        onChange={e => setEditingCoupon({...editingCoupon, usageLimit: Number(e.target.value)})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Expiry Date</label>
                    <input 
                      type="date" 
                      required
                      value={editingCoupon.expiryDate}
                      onChange={e => setEditingCoupon({...editingCoupon, expiryDate: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Assign to Email (Optional)</label>
                    <input 
                      type="email" 
                      placeholder="user@example.com"
                      value={editingCoupon.assignedEmail || ""}
                      onChange={e => setEditingCoupon({...editingCoupon, assignedEmail: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 px-1">
                    <input 
                      type="checkbox" 
                      id="isCouponActiveEdit"
                      checked={editingCoupon.isActive}
                      onChange={e => setEditingCoupon({...editingCoupon, isActive: e.target.checked})}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="isCouponActiveEdit" className="text-[10px] font-bold text-gray-600 uppercase tracking-widest cursor-pointer">Coupon is Active</label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingCoupon(null)}
                    className="flex-1 py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    Update Coupon
                  </button>
                </div>
             </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
