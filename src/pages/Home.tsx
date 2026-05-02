import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Search, ArrowRight, Star, Code, Cpu, Layout, FileText, Package, ShoppingCart, CheckCircle, ChevronLeft, ChevronRight, Zap, ShieldCheck, MessageSquare } from "lucide-react";
import { cn } from "../lib/utils";
import { useSettings } from "../lib/SettingsContext";
import { useCart } from "../lib/CartContext";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestoreUtils";

interface Product {
  id: string;
  name: string;
  price: number;
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
    <div className="space-y-6 sm:space-y-16 pb-20">
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
      <section className="grid grid-cols-3 gap-1 sm:gap-8 py-4 sm:py-10 border-y border-gray-100">
        {[
          { label: settings.stat1Label, value: settings.stat1Value, icon: Layout, color: "text-indigo-500" },
          { label: settings.stat2Label, value: settings.stat2Value, icon: Code, color: "text-purple-500" },
          { label: settings.stat3Label, value: settings.stat3Value, icon: FileText, color: "text-pink-500" },
        ].map((stat, i) => (
          <div key={i} className="text-center space-y-1">
            <div className={cn("flex justify-center", stat.color)}>
              <stat.icon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className="text-xs sm:text-2xl font-bold text-gray-900 leading-tight">{stat.value}</div>
            <div className="text-[7px] sm:text-xs text-gray-400 sm:text-gray-500 uppercase tracking-wider sm:tracking-widest leading-none truncate px-1 font-bold">
              {stat.label}
            </div>
          </div>
        ))}
      </section>

      {/* Why Choose Us */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
        {[
          { title: "Instant Access", desc: "Download assets immediately after purchase.", icon: Zap, bg: "bg-indigo-50", text: "text-indigo-600" },
          { title: "Secure Payments", desc: "Top-tier encryption for your safety.", icon: ShieldCheck, bg: "bg-emerald-50", text: "text-emerald-600" },
          { title: "Expert Support", desc: "Friendly help available whenever you need.", icon: MessageSquare, bg: "bg-amber-50", text: "text-amber-600" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <div className={cn("p-3 rounded-xl shrink-0", item.bg, item.text)}>
              <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">{item.title}</h4>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Product List */}
      <section ref={productsRef} className="space-y-6 sm:space-y-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-3xl font-black text-gray-900 uppercase tracking-tight">
                {searchTerm ? `Search: ${searchTerm}` : "Best Sellers"}
              </h2>
              {searchTerm && (
                <button 
                  onClick={() => {
                    setSearchTerm("");
                    navigate("/");
                  }}
                  className="p-1 px-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-500 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs sm:text-base text-gray-500 font-medium">Hand-picked premium assets for your ideas.</p>
          </div>
          
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {categoryOptions.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  "px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  filter === cat 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse space-y-4">
                <div className="aspect-[4/3] bg-gray-100 rounded-2xl" />
                <div className="h-4 bg-gray-100 rounded w-2/3" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-8">
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
  const navigate = useNavigate();

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (!banners || banners.length === 0) {
    return (
      <section className="relative overflow-hidden rounded-2xl sm:rounded-[40px] bg-indigo-950 text-white min-h-[220px] sm:min-h-[400px] flex items-center shadow-2xl shadow-indigo-100/50">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50" />
        <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-indigo-500/20 rounded-full blur-3xl -mr-32 sm:-mr-48 -mt-32 sm:-mt-48" />
        <div className="relative w-full max-w-4xl mx-auto text-center px-4 sm:px-6 py-6 sm:py-20 space-y-4 sm:space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-lg sm:text-5xl md:text-7xl font-black tracking-tighter leading-tight uppercase">{defaultTitle}</h1>
            <p className="text-indigo-100/80 text-[10px] sm:text-lg md:text-xl max-w-2xl mx-auto mt-1 sm:mt-4 font-medium px-4">{defaultSubtitle}</p>
          </motion.div>
          <button onClick={() => productsRef.current?.scrollIntoView({ behavior: 'smooth' })} className="bg-white text-indigo-950 px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2 mx-auto shadow-xl">
            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" /> Explore
          </button>
        </div>
      </section>
    );
  }

  const slide = banners[current];

  return (
    <section className="relative overflow-hidden rounded-2xl sm:rounded-[40px] bg-indigo-950 text-white min-h-[220px] sm:min-h-[450px] shadow-2xl shadow-indigo-100/50 group/slider">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 w-full h-full">
            <img 
              src={slide.imageUrl} 
              alt={slide.title || "Banner"} 
              className="w-full h-full object-cover opacity-50" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/90 via-indigo-950/40 to-transparent" />
          </div>

          <div className="relative h-full w-full max-w-5xl mx-auto flex flex-col justify-center items-center text-center px-4 py-4 sm:py-20 space-y-2.5 sm:space-y-8">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-1 sm:space-y-4"
            >
              <h1 className="text-base sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter uppercase leading-tight px-2">
                {slide.title || defaultTitle}
              </h1>
              <p className="text-indigo-100/80 text-[9px] sm:text-lg md:text-xl max-w-2xl mx-auto font-medium px-4 line-clamp-1 sm:line-clamp-none">
                {slide.subtitle || defaultSubtitle}
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex gap-4"
            >
              <button 
                onClick={() => slide.link ? (slide.link.startsWith('http') ? window.open(slide.link, '_blank') : navigate(slide.link)) : productsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-white text-indigo-950 px-5 py-2.5 sm:px-8 sm:py-5 rounded-lg sm:rounded-[24px] font-black text-[9px] sm:text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-1.5 sm:gap-3 shadow-xl active:scale-95"
              >
                <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-indigo-600" />
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
  const { addToCart, items } = useCart();
  const isInCart = items.some(item => item.id === product.id);

  const getCategoryColor = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'software': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'plugins': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'scripts': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'apps': return 'bg-pink-50 text-pink-600 border-pink-100';
      case 'templates': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'subscription': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  return (
    <div 
      className="group bg-white rounded-xl sm:rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 flex flex-col h-full relative"
    >
      {/* Image Section */}
      <div className="relative aspect-[16/11] sm:aspect-[16/10] overflow-hidden bg-gray-50 border-b border-gray-50">
        <Link to={`/product/${product.id}`} className="block w-full h-full">
          <img 
            src={product.imageUrl || `https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80`} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
        </Link>
        <div className="absolute top-1 sm:top-4 left-1 sm:left-4">
          <span className={cn(
            "px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[6px] sm:text-[10px] font-black uppercase tracking-widest border shadow-sm",
            getCategoryColor(product.category)
          )}>
            {product.category}
          </span>
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-2 sm:p-6 flex-grow flex flex-col justify-between space-y-1 sm:space-y-4">
        <div className="space-y-0.5 sm:space-y-2">
          <Link to={`/product/${product.id}`} className="block">
            <h3 className="text-[10px] sm:text-lg font-bold text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-1 sm:line-clamp-none">
              {product.name}
            </h3>
          </Link>
          <p className="text-[8px] sm:text-sm text-gray-500 line-clamp-1 sm:line-clamp-2 leading-relaxed font-medium">
            {product.description || "Premium software asset."}
          </p>
        </div>
        
        <div className="space-y-1.5 sm:space-y-4 pt-1.5 sm:pt-4 border-t border-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-[13px] sm:text-2xl font-black text-gray-900 flex items-baseline gap-0.5 sm:gap-1 tracking-tighter">
              <span className="text-[8px] sm:text-sm font-medium text-gray-400">৳</span>
              {product.price.toLocaleString()}
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1.5 px-0.5 sm:px-2 py-0.5 bg-amber-50 rounded-md sm:rounded-lg text-amber-600 border border-amber-100">
              <Star className="w-2 h-2 sm:w-3.5 sm:h-3.5 fill-current" />
              <span className="text-[8px] sm:text-xs font-black">{product.rating || 4.8}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5 sm:gap-3">
            <button 
              onClick={() => addToCart(product)}
              disabled={isInCart}
              className={cn(
                "w-full py-1.5 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-2xl text-center text-[8px] sm:text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1 sm:gap-2 shadow-lg",
                isInCart 
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-none cursor-default" 
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
              )}
            >
              {isInCart ? (
                <>
                  <CheckCircle className="w-2.5 h-2.5 sm:w-4 sm:h-4" />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-2.5 h-2.5 sm:w-4 sm:h-4" />
                  <span>Cart</span>
                </>
              )}
            </button>
            <div className="flex gap-1 sm:gap-2">
              <Link 
                to={`/product/${product.id}`}
                className="flex-1 py-1 sm:py-3 px-1 sm:px-4 bg-gray-50 text-gray-600 rounded-lg sm:rounded-2xl text-center text-[8px] sm:text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95 whitespace-nowrap"
              >
                View
              </Link>
              {product.category === "Subscription" ? (
                <Link 
                  to={`/product/${product.id}`}
                  className="flex-1 py-1 sm:py-3 px-1 sm:px-4 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg sm:rounded-2xl text-center text-[8px] sm:text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95 whitespace-nowrap"
                >
                  Plans
                </Link>
              ) : (
                <Link 
                  to={`/checkout/${product.id}`}
                  className="flex-1 py-1 sm:py-3 px-1 sm:px-4 bg-gray-900 text-white rounded-lg sm:rounded-2xl text-center text-[8px] sm:text-xs font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 whitespace-nowrap"
                >
                  Buy
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
