import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  ArrowRight, 
  Star, 
  Code, 
  Cpu, 
  Layout, 
  FileText, 
  Package, 
  ShoppingCart, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  ShieldCheck, 
  MessageSquare
} from "lucide-react";
import { cn } from "../lib/utils";
import { useSettings } from "../lib/SettingsContext";
import { useCart } from "../lib/CartContext";
import { useTheme } from "../lib/ThemeContext";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestoreUtils";

interface Product {
  id: string;
  name: string;
  price: number;
  discountPrice?: number;
  discountEnabled?: boolean;
  category: string;
  imageUrl?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
}

export default function Home() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const productsRef = useRef<HTMLElement>(null);
  const { theme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Sync search term with URL query param
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const query = searchParams.get("q");
    if (query !== null) {
      setSearchTerm(query);
      // Optional: Auto-scroll when search is initiated
      if (query.trim()) {
        setTimeout(() => {
          productsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location.search]);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "categories"), (snapshot) => {
      const catList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCategories(catList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "categories");
    });

    return () => unsubscribe();
  }, []);

  const topSellers = products
    .filter(p => !(settings.hiddenCategories || []).includes(p.category))
    .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
    .slice(0, 8);

  const categoryOptions = Array.from(new Set(["All", "Software", "Plugins", "Scripts", "Apps", "Templates", ...categories.map(c => c.name), "Subscription"]))
    .filter(cat => cat === "All" || !(settings.hiddenCategories || []).includes(cat));

  const filteredProducts = products.filter(p => {
    // Hide products whose category is hidden by admin
    if ((settings.hiddenCategories || []).includes(p.category)) return false;

    const matchesFilter = filter === "All" || p.category?.toLowerCase() === filter.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (p.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="w-full space-y-8 sm:space-y-16 pb-20">
      {/* Most Sold Ticker */}
      {(settings.showTicker ?? true) && topSellers.length > 0 && (
        <div 
          style={{ backgroundColor: settings.tickerBgColor || "#4f46e5" }}
          className="overflow-hidden py-2 sm:py-4 relative border-b border-white/5 shadow-inner rounded-2xl"
        >
          <div className="flex whitespace-nowrap items-center">
            <motion.div 
              animate={{ x: [0, "-50%"] }}
              transition={{ 
                duration: settings.tickerSpeed || 25, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="flex whitespace-nowrap gap-10 sm:gap-16 items-center"
            >
              {[...topSellers, ...topSellers, ...topSellers].map((p, i) => (
                <Link 
                  key={`${p.id}-${i}`} 
                  to={`/product/${p.id}`}
                  style={{ color: settings.tickerTextColor || "#ffffff" }}
                  className="flex items-center gap-3 sm:gap-4 group/ticker"
                >
                  <span className="bg-white/20 px-2.5 py-1 rounded-[6px] text-[10px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                    {settings.tickerText || "🔥 Sold"}
                  </span>
                  <span className="font-bold text-sm sm:text-base tracking-tight whitespace-nowrap group-hover/ticker:underline decoration-2 underline-offset-4">
                    {p.name}
                  </span>
                  <span className="text-xs sm:text-sm font-medium opacity-70">
                    ৳{(p.discountEnabled && p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1 text-amber-300">
                    <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                    <span className="text-xs sm:text-sm font-black">{p.rating || 4.8}</span>
                  </div>
                </Link>
              ))}
            </motion.div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      {settings.showHero !== false && (
        <HeroSlider 
          banners={settings.heroBanners || []} 
          defaultTitle={settings.heroTitle} 
          defaultSubtitle={settings.heroSubtitle}
          productsRef={productsRef}
        />
      )}

      {/* Featured Statistics */}
      <section className="grid grid-cols-3 gap-1 sm:gap-8 py-10 sm:py-20 border-y border-gray-100 dark:border-gray-800 w-full overflow-hidden">
        {[
          { label: settings.stat1Label || "TOTAL USERS", value: settings.stat1Value || "50k+", icon: Layout, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
          { label: settings.stat2Label || "DIGITAL ASSETS", value: settings.stat2Value || "1,200+", icon: Code, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
          { label: settings.stat3Label || "SUCCESS RATE", value: settings.stat3Value || "99.9%", icon: FileText, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-900/20" },
        ].map((stat, i) => (
          <div key={i} className="text-center space-y-2 sm:space-y-4 px-1">
            <div className={cn("mx-auto flex items-center justify-center w-10 h-10 sm:w-16 sm:h-16 rounded-2xl shrink-0 transition-transform hover:scale-110", stat.bg)}>
              <stat.icon className={cn("w-5 h-5 sm:w-8 sm:h-8", stat.color)} />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <div className="text-[15px] sm:text-3xl font-black text-gray-900 dark:text-gray-100 leading-tight whitespace-nowrap overflow-hidden tracking-tighter">{stat.value}</div>
              <div className="text-[8px] sm:text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest leading-none whitespace-nowrap overflow-hidden opacity-80">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Why Choose Us */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        {[
          { title: "Instant Delivery", desc: "Digital assets instantly.", icon: Zap, bg: "bg-indigo-50 dark:bg-indigo-900/10", text: "text-indigo-600 dark:text-indigo-400" },
          { title: "Secure Platform", desc: "Safe checkout flows.", icon: ShieldCheck, bg: "bg-emerald-50 dark:bg-emerald-900/10", text: "text-emerald-600 dark:text-emerald-400" },
          { title: "Top Quality", desc: "Curated premium assets.", icon: MessageSquare, bg: "bg-amber-50 dark:bg-amber-900/10", text: "text-amber-600 dark:text-amber-400" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3.5 sm:gap-5 p-4 sm:p-6 rounded-xl sm:rounded-[24px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl dark:hover:shadow-black/20 hover:-translate-y-1 transition-all duration-300 group">
            <div className={cn("p-3 sm:p-4 rounded-xl shrink-0 group-hover:scale-110 transition-transform shadow-sm", item.bg, item.text)}>
              <item.icon className="w-5 h-5 sm:w-8 sm:h-8" />
            </div>
            <div className="space-y-1 flex-grow">
              <h4 className="font-black text-gray-900 dark:text-gray-100 text-sm sm:text-xl leading-tight">{item.title}</h4>
              <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-tight">{item.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Product List */}
      <section ref={productsRef} className="space-y-6 sm:space-y-12">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 sm:gap-10">
          <div className="space-y-2 sm:space-y-3 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter leading-tight">
                {searchTerm ? `Search: ${searchTerm}` : "Premium Catalog"}
              </h2>
              {searchTerm && (
                <button 
                  onClick={() => {
                    setSearchTerm("");
                    navigate("/");
                  }}
                  className="w-fit p-1 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs sm:text-xl text-gray-500 dark:text-gray-400 font-medium">Hand-picked premium assets for your ideas.</p>
          </div>
          
          <div className="w-full lg:w-auto flex flex-wrap gap-3 overflow-x-auto pb-2 no-scrollbar">
            <div className="flex bg-gray-100/30 dark:bg-gray-800/30 p-2 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-x-auto no-scrollbar w-full sm:w-auto">
              {categoryOptions.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={cn(
                    "px-5 py-3 sm:px-8 sm:py-3.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap",
                    filter === cat 
                      ? "bg-indigo-600 text-white shadow-2xl shadow-indigo-200 ring-4 ring-indigo-500/10 scale-105 z-10" 
                      : "text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-800"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-8 w-full">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="aspect-square bg-gray-100 rounded-lg sm:rounded-2xl" />
                <div className="h-3 bg-gray-100 rounded w-2/3 mx-auto" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-8 w-full">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product as any} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">No products found</h3>
            <p className="text-gray-500">Try adjusting your filter or check back later.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function HeroSlider({ banners, defaultTitle, defaultSubtitle, productsRef }: { banners: any[], defaultTitle: string, defaultSubtitle: string, productsRef: React.RefObject<HTMLElement> }) {
  const [current, setCurrent] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const defaultTitleColor = isDark ? "#ffffff" : "#111827";
  const defaultSubtitleColor = isDark ? "#ffffffcc" : "#4b5563";

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) {
    return (
      <section className="relative overflow-hidden rounded-xl sm:rounded-[32px] bg-white dark:bg-indigo-950 text-gray-900 dark:text-white min-h-[140px] sm:min-h-[400px] flex items-center shadow-2xl shadow-indigo-100/30 dark:shadow-none mx-auto w-full border border-gray-100 dark:border-none">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/50 dark:to-purple-900/50" />
        <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-indigo-500/20 rounded-full blur-3xl -mr-16 sm:-mr-48 -mt-32 sm:-mt-48 pointer-events-none" />
        <div className="relative w-full max-w-4xl mx-auto text-center px-6 py-4 sm:py-20 space-y-2.5 sm:space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 
              style={{ 
                fontSize: isMobile ? (settings.heroTitleSizeMobile || "18px") : (settings.heroTitleSizeDesktop || "48px"),
                color: settings.heroTitleColor || defaultTitleColor
              }}
              className="font-black tracking-tighter leading-tight uppercase underline decoration-indigo-500/30 decoration-2 underline-offset-2 sm:underline-offset-8 px-2"
            >
              {defaultTitle}
            </h1>
            <p 
              style={{ 
                fontSize: isMobile ? (settings.heroSubtitleSizeMobile || "10px") : (settings.heroSubtitleSizeDesktop || "16px"),
                color: settings.heroSubtitleColor || defaultSubtitleColor
              }}
              className="mt-1 sm:mt-4 font-medium px-4 line-clamp-2 sm:line-clamp-none max-w-2xl mx-auto opacity-80"
            >
              {defaultSubtitle}
            </p>
          </motion.div>
          <button 
            onClick={() => productsRef.current?.scrollIntoView({ behavior: 'smooth' })} 
            className="bg-indigo-600 dark:bg-white text-white dark:text-indigo-950 px-5 py-2.5 sm:px-8 sm:py-4 rounded-lg sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-700 dark:hover:bg-indigo-50 transition-all flex items-center gap-1.5 sm:gap-2 mx-auto shadow-xl active:scale-95"
          >
            <Package className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white dark:text-indigo-600" /> Explore
          </button>
        </div>
      </section>
    );
  }

  const slide = banners[current];

  return (
  <section className="relative overflow-hidden rounded-xl sm:rounded-[40px] bg-white dark:bg-indigo-950 text-gray-900 dark:text-white min-h-[160px] sm:min-h-[450px] shadow-2xl shadow-indigo-100/30 dark:shadow-none group/slider mx-auto w-full border border-gray-100 dark:border-none">
    <AnimatePresence mode="wait">
      <motion.div
        key={current}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <div className="absolute inset-0 h-full w-full">
          <img 
            src={slide.imageUrl} 
            alt={slide.title || "Banner"} 
            className="w-full h-full object-cover opacity-100 dark:opacity-50 transition-opacity duration-300" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/20 to-transparent dark:from-indigo-950/95 dark:via-indigo-950/40 dark:to-transparent" />
        </div>

        <div className="relative h-full w-full max-w-5xl mx-auto flex flex-col justify-center items-center text-center px-6 py-4 sm:py-20 space-y-3 sm:space-y-8">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-1 sm:space-y-4"
          >
            <h1 
              style={{ 
                fontSize: isMobile ? (settings.heroTitleSizeMobile || "18px") : (settings.heroTitleSizeDesktop || "48px"),
                color: settings.heroTitleColor || defaultTitleColor
              }}
              className="font-black tracking-tighter uppercase leading-[1.1] sm:leading-none px-4 break-words"
            >
              {slide.title || defaultTitle}
            </h1>
            <p 
              style={{ 
                fontSize: isMobile ? (settings.heroSubtitleSizeMobile || "10px") : (settings.heroSubtitleSizeDesktop || "16px"),
                color: settings.heroSubtitleColor || defaultSubtitleColor
              }}
              className="max-w-2xl mx-auto font-medium px-4 line-clamp-2 sm:line-clamp-none opacity-90"
            >
              {slide.subtitle || defaultSubtitle}
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <button 
              onClick={() => slide.link ? (slide.link.startsWith('http') ? window.open(slide.link, '_blank') : navigate(slide.link)) : productsRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-indigo-600 dark:bg-white text-white dark:text-indigo-950 px-5 py-2.5 sm:px-8 sm:py-5 rounded-lg sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-700 dark:hover:bg-indigo-50 transition-all flex items-center gap-1.5 sm:gap-3 shadow-xl active:scale-95"
            >
              <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white dark:text-indigo-600" />
              {slide.buttonText || (slide.link ? "Open" : "Explore")}
            </button>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>


      {/* Controls */}
      {banners.length > 1 && (
        <>
          <button 
            onClick={() => setCurrent(prev => (prev - 1 + banners.length) % banners.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 hover:bg-white/20 transition-all opacity-0 group-hover/slider:opacity-100 hidden sm:block"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setCurrent(prev => (prev + 1) % banners.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 hover:bg-white/20 transition-all opacity-0 group-hover/slider:opacity-100 hidden sm:block"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={cn(
                  "h-1 sm:h-1.5 rounded-full transition-all duration-300",
                  current === i ? "w-6 sm:w-8 bg-white" : "w-1.5 sm:w-2 bg-white/30"
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ProductCard({ product }: any) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { addToCart, items } = useCart();
  const isInCart = items.some(item => item.id === product.id);
  const hasDiscount = product.discountEnabled && product.discountPrice && product.discountPrice < product.price;
  const discountPercentage = hasDiscount ? Math.round(((product.price - product.discountPrice) / product.price) * 100) : 0;

  const getCategoryColor = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'software': return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
      case 'plugins': return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800';
      case 'scripts': return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
      case 'apps': return 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800';
      case 'templates': return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
      case 'subscription': return 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800';
      default: return 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  return (
    <div 
      className="group bg-white dark:bg-gray-900 rounded-xl sm:rounded-[32px] border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 flex flex-col h-full relative w-full max-w-full box-border"
    >
      {/* Image Section */}
      <div className="relative aspect-square sm:aspect-[1.5/1] overflow-hidden bg-gray-50 dark:bg-gray-800/50 border-b border-gray-50/50 dark:border-gray-800/50">
        <Link to={`/product/${product.id}`} className="block w-full h-full">
          <img 
            src={product.imageUrl || `https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80`} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
        </Link>
        <div className="absolute top-2 sm:top-4 left-2 sm:left-4 flex flex-col gap-2">
          <span className={cn(
            "px-2 sm:px-3 py-1 rounded-md sm:rounded-xl text-[7px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm backdrop-blur-md",
            getCategoryColor(product.category)
          )}>
            {product.category}
          </span>
          {hasDiscount && (
            <motion.span 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-red-500 text-white px-2 sm:px-3 py-1 rounded-md sm:rounded-xl text-[7px] sm:text-[9px] font-black uppercase tracking-widest shadow-lg shadow-red-200"
            >
              {discountPercentage}% OFF
            </motion.span>
          )}
        </div>
      </div>
      
      <div className="p-3 sm:p-6 flex-grow flex flex-col justify-between space-y-3 sm:space-y-5">
        <div className="space-y-1 sm:space-y-1.5">
          <Link to={`/product/${product.id}`} className="block">
            <h3 className="text-[12px] sm:text-base lg:text-lg font-black text-gray-900 dark:text-white leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2 min-h-[2.4em] sm:min-h-0 tracking-tight uppercase">
              {product.name}
            </h3>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 text-amber-400">
              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
              <span className="text-[9px] sm:text-[10px] font-black dark:text-amber-300">{product.rating || 4.8}</span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-gray-300 dark:text-gray-500 font-bold uppercase tracking-widest">• {product.category}</span>
          </div>
        </div>
        
        <div className="space-y-2 sm:space-y-4 pt-3 sm:pt-5 border-t border-gray-50 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              {hasDiscount && (
                <span className="text-[9px] sm:text-xs text-red-500 font-bold line-through opacity-70">
                  ৳{product.price.toLocaleString()}
                </span>
              )}
              <div className="text-sm sm:text-xl font-black text-gray-900 dark:text-white flex items-baseline gap-0.5 tracking-tighter">
                <span className="text-[9px] sm:text-xs font-medium text-gray-400 dark:text-gray-500">৳</span>
                {(hasDiscount ? product.discountPrice : product.price).toLocaleString()}
              </div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md flex items-center gap-1">
               <ShieldCheck className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400" />
               <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Safe</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <button 
              onClick={() => addToCart(product)}
              disabled={isInCart}
              className={cn(
                "w-full py-2 sm:py-3 px-4 rounded-lg sm:rounded-xl text-center text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm",
                isInCart 
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-none cursor-default" 
                  : "hover:opacity-90 shadow-indigo-100"
              )}
              style={!isInCart ? { backgroundColor: settings.cartColor || "#4f46e5", color: settings.cartTextColor || "#ffffff" } : {}}
            >
              {isInCart ? (
                <>
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>In Cart</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{settings.cartText || "Cart"}</span>
                </>
              )}
            </button>
            <div className="flex gap-1.5">
              <Link 
                to={`/product/${product.id}`}
                className="flex-1 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-center text-[8px] sm:text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 flex items-center justify-center"
                style={{ backgroundColor: settings.viewColor || "#f9fafb", color: settings.viewTextColor || "#6b7280" }}
              >
                {settings.viewText || "View"}
              </Link>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (product.category === "Subscription") {
                    navigate(`/product/${product.id}`);
                  } else {
                    if (!isInCart) addToCart(product);
                    navigate("/cart-checkout");
                  }
                }}
                className="flex-1 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-center text-[8px] sm:text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 flex items-center justify-center"
                style={{ backgroundColor: settings.buyColor || "#111827", color: settings.buyTextColor || "#ffffff" }}
              >
                {settings.buyText || "Buy"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
