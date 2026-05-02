import React, { useState, useEffect } from "react";
import { db, storage, auth } from "../lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Plus, Package, Users, DollarSign, Trash2, Edit, Star, Database, Settings as SettingsIcon, Save, ShoppingBag, Clock, CheckCircle, Copy, Link as LinkIcon, Inbox, Mail, Search, ShieldCheck, TrendingUp, Calendar, Eye, EyeOff, ExternalLink, ImagePlus, Upload, Loader2, Phone } from "lucide-react";
import { motion } from "motion/react";
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
  const [activeTab, setActiveTab] = useState<"products" | "settings" | "orders" | "pages" | "tickets" | "categories">("products");
  const [revenueTimeframe, setRevenueTimeframe] = useState<"daily" | "weekly" | "monthly">("daily");
  const [showSalesStats, setShowSalesStats] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [editingCredentials, setEditingCredentials] = useState<{ [key: string]: { username?: string, password?: string } }>({});
  const [editingNote, setEditingNote] = useState("");
  const [siteSettings, setSiteSettings] = useState({
    siteName: "",
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
    showTicker: true,
    bkashNumber: "",
    nagadNumber: "",
    rocketNumber: "",
    bkashLogo: "",
    nagadLogo: "",
    rocketLogo: "",
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
    hiddenCategories: [] as string[]
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
    additionalImageUrls: "",
    fileUrl: "",
  });

  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    icon: "Package"
  });

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isAdminChecking, setIsAdminChecking] = useState(true);

  const adminEmails = ['businessonline.6251@gmail.com', 'hacklone928@gmail.com'];
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(auth.currentUser?.email || null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUserEmail(user?.email || null);
    });
    return () => unsubscribe();
  }, []);

  const isActuallyAdmin = isAdminUser || (currentUserEmail && adminEmails.includes(currentUserEmail.toLowerCase().trim()));

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
    if (!isActuallyAdmin) {
      alert("Admin access required.");
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

  const stats = [
    { label: "Total Revenue", value: `৳${orders.reduce((sum, o) => sum + (o.amount || 0), 0).toLocaleString()}`, icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
    { label: "Total Orders", value: orders.length, icon: ShoppingBag, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Products", value: products.length, icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  const getRevenueStats = () => {
    const data: { [key: string]: number } = {};
    
    orders.forEach(order => {
      if (!order.createdAt) return;
      const date = order.createdAt.toDate ? order.createdAt.toDate() : new Date();
      
      let key = "";
      if (revenueTimeframe === "daily") {
        key = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      } else if (revenueTimeframe === "weekly") {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        key = `Week ${weekNo}, ${d.getFullYear()}`;
      } else {
        key = date.toLocaleDateString('en-GB', { month: 'long', year: '2-digit' });
      }
      
      data[key] = (data[key] || 0) + (order.amount || 0);
    });

    const result = Object.entries(data).map(([name, total]) => ({
      name,
      revenue: total,
    }));

    if (revenueTimeframe === "daily") return result.slice(-14);
    if (revenueTimeframe === "weekly") return result.slice(-8);
    return result.slice(-12);
  };

  const calculateDetailedStats = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const thisWeek = today - (7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let daily = 0;
    let weekly = 0;
    let monthly = 0;

    orders.forEach(order => {
      if (!order.createdAt) return;
      const time = order.createdAt.toDate ? order.createdAt.toDate().getTime() : 0;
      const amount = order.amount || 0;

      if (time >= today) daily += amount;
      if (time >= thisWeek) weekly += amount;
      if (time >= thisMonth) monthly += amount;
    });

    return { daily, weekly, monthly };
  };

  const detailedStats = calculateDetailedStats();
  const chartData = getRevenueStats();

  useEffect(() => {
    fetchProducts();
    fetchSettings();
    fetchPages();
    fetchCategories();
    if (isActuallyAdmin) {
      fetchOrders();
      fetchTickets();
    }
  }, [isActuallyAdmin]);

  const fetchTickets = async () => {
    try {
      const snap = await getDocs(collection(db, "support_tickets"));
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "support_tickets");
    }
  };

  useEffect(() => {
    const checkAdmin = async () => {
      if (auth.currentUser) {
        setIsAdminChecking(true);
          // Method 1: Check by email directly for immediate UI feedback
        const userEmail = auth.currentUser.email?.toLowerCase().trim();
        const adminEmailsList = ['businessonline.6251@gmail.com', 'hacklone928@gmail.com'];
        const isEmailAdmin = adminEmailsList.includes(userEmail || '');
        
        // Method 2: Check by doc for robust role management
        try {
          const userDocRef = doc(db, "users", auth.currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          let isRoleAdmin = userDoc.exists() && userDoc.data()?.role === 'admin';
          
          // Auto-provision admin role for master emails
          if (isEmailAdmin && !isRoleAdmin) {
            console.log("Auto-provisioning admin role for master email:", userEmail);
            // We'll skip the setDoc here if it might fail due to rules, 
            // but we'll trust the email check for the session.
            setIsAdminUser(true);
          } else {
            setIsAdminUser(isEmailAdmin || isRoleAdmin);
          }
          console.log("Admin Check:", { isEmailAdmin, isRoleAdmin, userEmail });
        } catch (e) {
          console.error("Admin Doc Check Failed:", e);
          setIsAdminUser(isEmailAdmin);
        } finally {
          setIsAdminChecking(false);
        }
      } else {
        setIsAdminChecking(false);
      }
    };
    checkAdmin();
  }, [auth.currentUser]);

  const handleFullReset = async () => {
    if (!isActuallyAdmin) return;
    if (!window.confirm("CRITICAL ACTION: This will delete ALL products, orders, tickets, and pages. The site will be factory reset. Continue?")) return;

    try {
      setLoading(true);
      const collections = ["products", "orders", "support_tickets", "pages"];
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        const deletes = snap.docs.map(d => deleteDoc(doc(db, col, d.id)));
        await Promise.all(deletes);
      }
      
      // Reset settings to default
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
        heroBannerUrl: ""
      });

      alert("Website reset successfully! Everything has been cleared.");
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

      await updateDoc(doc(db, "orders", id), updates);
      await fetchOrders();
      alert("Order confirmed! Product is now available to the user.");
      setSelectedOrder(null);
      setEditingCredentials({});
      setEditingNote("");
    } catch (error: any) {
      alert(`Failed to confirm order: ${error.message}`);
    }
  };

  const handleUpdateOrderCredentials = async () => {
    if (!selectedOrder || !isActuallyAdmin) return;
    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
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

    if (!collectionName || !isActuallyAdmin) return;
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
        setSiteSettings(snap.data() as any);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "settings/site");
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await setDoc(doc(db, "settings", "site"), siteSettings);
    alert("Settings updated successfully!");
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id, ...data } = editingProduct;
      await setDoc(doc(db, "products", id), {
        ...data,
        price: Number(data.price),
        subscriptionMonthlyPrice: data.category === "Subscription" ? Number(data.subscriptionMonthlyPrice || 0) : 0,
        subscriptionYearlyPrice: data.category === "Subscription" ? Number(data.subscriptionYearlyPrice || 0) : 0,
        subscriptionMonthlyText: data.subscriptionMonthlyText || "",
        subscriptionMonthlySubtext: data.subscriptionMonthlySubtext || "",
        subscriptionYearlyText: data.subscriptionYearlyText || "",
        subscriptionYearlySubtext: data.subscriptionYearlySubtext || "",
        subscriptionLifetimeText: data.subscriptionLifetimeText || "",
        subscriptionLifetimeSubtext: data.subscriptionLifetimeSubtext || "",
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
        subscriptionMonthlyPrice: newProduct.category === "Subscription" ? Number(newProduct.subscriptionMonthlyPrice || 0) : 0,
        subscriptionYearlyPrice: newProduct.category === "Subscription" ? Number(newProduct.subscriptionYearlyPrice || 0) : 0,
        subscriptionMonthlyText: newProduct.subscriptionMonthlyText || "",
        subscriptionMonthlySubtext: newProduct.subscriptionMonthlySubtext || "",
        subscriptionYearlyText: newProduct.subscriptionYearlyText || "",
        subscriptionYearlySubtext: newProduct.subscriptionYearlySubtext || "",
        subscriptionLifetimeText: newProduct.subscriptionLifetimeText || "",
        subscriptionLifetimeSubtext: newProduct.subscriptionLifetimeSubtext || "",
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
        additionalImageUrls: "", 
        fileUrl: "" 
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
          {!isAdminChecking && !isActuallyAdmin && auth.currentUser && (
            <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-xs font-bold border border-amber-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> NOT AN ADMIN - View Only Mode
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
          {activeTab !== "settings" && (
            <button 
              onClick={() => {
                if (!isActuallyAdmin) {
                  alert("Action Denied: You do not have administrator permissions.");
                  return;
                }
                handleClearAll();
              }}
              className={cn(
                "border px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 hover:-translate-y-0.5 active:scale-95",
                isActuallyAdmin 
                  ? "border-red-100 bg-red-50/50 text-red-600 hover:bg-red-50 hover:border-red-200" 
                  : "border-gray-100 text-gray-300 cursor-not-allowed"
              )}
            >
              <Trash2 className="w-4 h-4" /> Clear All {activeTab === "tickets" ? "Inbox" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </button>
          )}
          <button 
            onClick={() => {
              if (!isActuallyAdmin) {
                alert("Action Denied: You do not have administrator permissions.");
                return;
              }
              setIsAdding(true);
            }}
            className={cn(
              "px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 hover:-translate-y-0.5 active:scale-95 flex-1 sm:flex-none",
              isActuallyAdmin 
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pb-4">
          <div className="bg-indigo-50/30 p-3 sm:p-4 rounded-2xl border border-indigo-50">
            <div className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Today</div>
            <div className="text-lg sm:text-xl font-black text-indigo-600">৳{detailedStats.daily.toLocaleString()}</div>
          </div>
          <div className="bg-emerald-50/30 p-3 sm:p-4 rounded-2xl border border-emerald-50">
            <div className="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">This Week</div>
            <div className="text-lg sm:text-xl font-black text-emerald-600">৳{detailedStats.weekly.toLocaleString()}</div>
          </div>
          <div className="bg-amber-50/30 p-3 sm:p-4 rounded-2xl border border-amber-50">
            <div className="text-[9px] sm:text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">This Month</div>
            <div className="text-lg sm:text-xl font-black text-amber-600">৳{detailedStats.monthly.toLocaleString()}</div>
          </div>
        </div>

        <div className="h-[300px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
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
                  itemStyle={{ fontWeight: 800, color: '#4f46e5' }}
                  labelStyle={{ marginBottom: '4px', fontWeight: 600, color: '#111827' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
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
      </div>

      <div className="space-y-8">
        <div className="flex gap-1 p-1 bg-gray-100/50 rounded-2xl w-full overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap sticky top-16 z-20 backdrop-blur-sm">
          <button 
            onClick={() => setActiveTab("products")}
            className={cn(
              "px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap flex-shrink-0",
              activeTab === "products" 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            )}
          >
            Inventory
          </button>
          <button 
            onClick={() => setActiveTab("orders")}
            className={cn(
              "px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap flex-shrink-0",
              activeTab === "orders" 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            )}
          >
            Sales
          </button>
          <button 
            onClick={() => setActiveTab("categories")}
            className={cn(
              "px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap flex-shrink-0",
              activeTab === "categories" 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            )}
          >
            Categories
          </button>
          <button 
            onClick={() => setActiveTab("pages")}
            className={cn(
              "px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap flex-shrink-0",
              activeTab === "pages" 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            )}
          >
            Pages
          </button>
          <button 
            onClick={() => setActiveTab("tickets")}
            className={cn(
              "px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap flex-shrink-0",
              activeTab === "tickets" 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            )}
          >
            Tickets
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={cn(
              "px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap flex-shrink-0",
              activeTab === "settings" 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            )}
          >
            Site Logic
          </button>
        </div>

        {activeTab === "categories" ? (
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
                          onClick={() => setEditingCategory(category)}
                          className="p-2 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(category.id)}
                          className="p-2 text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
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
                {isActuallyAdmin && products.length > 0 && (
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
                      if (!isActuallyAdmin) {
                        alert("Action Denied: You do not have administrator permissions.");
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
                      if (!isActuallyAdmin) {
                        alert("Administrator access required for this action.");
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
                      isActuallyAdmin ? "text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 shadow-sm hover:shadow-red-50" : "text-gray-200 bg-gray-50/50 cursor-not-allowed"
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
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] sm:text-xs text-gray-500 truncate">{o.customerEmail || o.email}</span>
                                {o.deliveryAddress && (
                                  <span className="flex items-center gap-0.5 text-[8px] font-black bg-purple-50 text-purple-600 px-1 rounded uppercase tracking-tighter">
                                    <ShoppingBag className="w-2 h-2" />
                                    Details
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="hidden sm:table-cell px-6 py-4 border-l border-gray-50">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                                o.paymentMethod === "bkash" ? "bg-pink-50 text-pink-600" :
                                o.paymentMethod === "nagad" ? "bg-orange-50 text-orange-600" : "bg-indigo-50 text-indigo-600"
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
                                onClick={() => {
                                  setSelectedOrder(o);
                                  setEditingCredentials(o.credentials || {});
                                  setEditingNote(o.adminNote || "");
                                }}
                                className="p-2 sm:p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl sm:rounded-2xl transition-all border border-transparent hover:border-indigo-100 shadow-sm active:scale-90"
                              >
                                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                              {o.status === "pending" && isActuallyAdmin && (
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

            <div className="flex justify-between items-center bg-red-50 border border-red-100 p-6 rounded-2xl">
              <div>
                <h4 className="text-sm font-bold text-red-900">Danger Zone</h4>
                <p className="text-xs text-red-600">Wipe all data and reset the marketplace to factory defaults.</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  if (!isActuallyAdmin) {
                    alert("Action Denied: You do not have administrator permissions.");
                    return;
                  }
                  handleFullReset();
                }}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  isActuallyAdmin ? "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-100" : "bg-gray-100 text-gray-400"
                )}
              >
                Reset Website
              </button>
            </div>

            <form onSubmit={handleUpdateSettings} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
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
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Logo URL</label>
                  <input 
                    type="text" 
                    value={siteSettings.logoUrl}
                    onChange={e => setSiteSettings({...siteSettings, logoUrl: e.target.value})}
                    className="w-full mt-1 bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Favicon URL</label>
                  <input 
                    type="text" 
                    value={siteSettings.faviconUrl}
                    onChange={e => setSiteSettings({...siteSettings, faviconUrl: e.target.value})}
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
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 bg-gray-50 p-2 rounded-xl transition-all">
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
                <div className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Payment</div>
                <div className="font-black text-indigo-600 text-base sm:text-lg">৳{selectedOrder.amount.toLocaleString()}</div>
                <div className="flex items-center justify-end gap-2 mt-2">
                  <span className={cn(
                    "px-2 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest",
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

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-1">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Payment Method</div>
                <div className="font-bold text-pink-600 uppercase text-xs">
                  {selectedOrder.paymentMethod === "cod" ? "Cash on Delivery" : selectedOrder.paymentMethod || "N/A"}
                </div>
              </div>
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-1">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Payment Phone</div>
                <div className="font-bold text-emerald-600 text-xs">{selectedOrder.paymentPhone || "N/A"}</div>
              </div>
              <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 space-y-1 col-span-2">
                <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Transaction ID / Payment Proof
                </div>
                <div className="font-mono font-bold text-gray-900 text-sm break-all">{selectedOrder.transactionId || "N/A"}</div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Purchased Assets & Credentials</div>
              <div className="space-y-4">
                {(selectedOrder.items || [{ id: selectedOrder.productIds?.[0], name: selectedOrder.productName }]).map((item: any, i: number) => {
                  const itemId = item.id || `legacy-${i}`;
                  return (
                    <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Package className="w-4 h-4 text-indigo-600" />
                          </div>
                          <span className="font-bold text-xs text-gray-900">{item.name || "Product"}</span>
                        </div>
                        {item.price && <span className="font-mono font-bold text-xs text-gray-500">৳{item.price?.toLocaleString()}</span>}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pt-2">
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
                      setSelectedOrder(null);
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
                onClick={() => setSelectedOrder(null)}
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
    </div>
  );
}
