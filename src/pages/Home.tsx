import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Search, ArrowRight, Star, Code, Cpu, Layout, FileText, Package, ShoppingCart, CheckCircle } from "lucide-react";
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

  const topSellers = [...products].sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0)).slice(0, 8);

  const categories = ["All", "Software", "Plugins", "Scripts", "Apps", "Templates", "Subscription"];

  const filteredProducts = products.filter(p => {
    const matchesFilter = filter === "All" || p.category?.toLowerCase() === filter.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (p.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 sm:space-y-16 pb-20">
      {/* Most Sold Ticker */}
      {settings.showTicker !== false && topSellers.length > 0 && (
        <div className="bg-indigo-600 overflow-hidden py-3 -mx-4 sm:-mx-8 lg:-mx-12 rounded-t-3xl sm:rounded-none">
          <motion.div 
            animate={{ x: [0, -1000] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="flex whitespace-nowrap gap-12 items-center"
          >
            {[...topSellers, ...topSellers, ...topSellers].map((p, i) => (
              <Link 
                key={`${p.id}-${i}`} 
                to={`/product/${p.id}`}
                className="flex items-center gap-3 text-white/90 hover:text-white transition-colors"
                id={`top-seller-${p.id}-${i}`}
              >
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">Most Sold</span>
                <span className="font-bold text-sm tracking-tight">{p.name}</span>
                <span className="text-xs opacity-60">৳{p.price}</span>
                <div className="flex items-center gap-1 text-amber-300">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="text-xs font-bold">{p.rating || 4.8}</span>
                </div>
              </Link>
            ))}
          </motion.div>
        </div>
      )}

      {/* Hero Section */}
      {settings.showHero !== false && (
        <section className="relative overflow-hidden rounded-3xl sm:rounded-[40px] bg-indigo-950 text-white min-h-[300px] sm:min-h-[400px] flex items-center shadow-2xl shadow-indigo-100/50">
          {settings.heroBannerUrl ? (
            <div className="absolute inset-0 w-full h-full">
              <img 
                src={settings.heroBannerUrl} 
                alt="Promotion Banner" 
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-950 via-indigo-950/40 to-transparent" />
            </div>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50" />
              <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-indigo-500/20 rounded-full blur-3xl -mr-32 sm:-mr-48 -mt-32 sm:-mt-48" />
              <div className="absolute bottom-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-purple-500/20 rounded-full blur-3xl -ml-24 sm:-ml-32 -mb-24 sm:-mb-32" />
            </>
          )}
          
          <div className="relative w-full max-w-4xl mx-auto text-center px-4 sm:px-6 py-12 sm:py-20 space-y-6 sm:space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-[1] sm:leading-[0.9] uppercase">
                {settings.heroTitle}
              </h1>
              <p className="text-indigo-100/80 text-sm sm:text-lg md:text-xl max-w-2xl mx-auto mt-4 sm:mt-6 leading-relaxed font-medium">
                {settings.heroSubtitle}
              </p>
            </motion.div>
  
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center"
            >
              <button 
                onClick={() => {
                  productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="bg-white text-indigo-950 px-6 sm:px-10 py-3.5 sm:py-5 rounded-2xl sm:rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2 sm:gap-3 group shadow-xl active:scale-95"
              >
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                Explore Collection
              </button>
            </motion.div>
          </div>
        </section>
      )}

      {/* Featured Statistics */}
      <section className="grid grid-cols-3 gap-2 sm:gap-8 py-6 sm:py-10 border-y border-gray-100">
        {[
          { label: settings.stat1Label, value: settings.stat1Value, icon: Layout, color: "text-indigo-500" },
          { label: settings.stat2Label, value: settings.stat2Value, icon: Code, color: "text-purple-500" },
          { label: settings.stat3Label, value: settings.stat3Value, icon: FileText, color: "text-pink-500" },
        ].map((stat, i) => (
          <div key={i} className="text-center space-y-1 sm:space-y-2">
            <div className={cn("flex justify-center", stat.color)}>
              <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="text-sm sm:text-2xl font-bold text-gray-900 leading-tight">{stat.value}</div>
            <div className="text-[8px] sm:text-sm text-gray-400 sm:text-gray-500 uppercase tracking-[0.05em] sm:tracking-widest leading-none truncate px-1">
              {stat.label}
            </div>
          </div>
        ))}
      </section>

      {/* Product List */}
      <section ref={productsRef} className="space-y-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Best Sellers</h2>
            <p className="text-gray-500">Hand-picked premium assets for your next big idea.</p>
          </div>
          
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
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
      className="group bg-white rounded-2xl sm:rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 flex flex-col h-full relative"
    >
      {/* Image Section */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gray-50 border-b border-gray-50">
        <img 
          src={product.imageUrl || `https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80`} 
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        />
        <div className="absolute top-2 sm:top-4 left-2 sm:left-4">
          <span className={cn(
            "px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest border shadow-sm",
            getCategoryColor(product.category)
          )}>
            {product.category}
          </span>
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-3 sm:p-6 flex-grow flex flex-col justify-between space-y-2 sm:space-y-4">
        <div className="space-y-1 sm:space-y-2">
          <h3 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-1 sm:line-clamp-none">
            {product.name}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 line-clamp-1 sm:line-clamp-2 leading-relaxed">
            {product.description || "Premium software asset."}
          </p>
        </div>
        
        <div className="space-y-2 sm:space-y-4 pt-2 sm:pt-4 border-t border-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-base sm:text-2xl font-black text-gray-900 flex items-baseline gap-0.5 sm:gap-1">
              <span className="text-[10px] sm:text-sm font-medium text-gray-400">৳</span>
              {product.price.toLocaleString()}
            </div>
            <div className="hidden xs:flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-50 rounded-lg text-amber-600 border border-amber-100">
              <Star className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 fill-current" />
              <span className="text-[10px] sm:text-xs font-black">{product.rating || 4.8}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 sm:gap-3">
            <button 
              onClick={() => addToCart(product)}
              disabled={isInCart}
              className={cn(
                "w-full py-2 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-center text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg",
                isInCart 
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-none cursor-default" 
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
              )}
            >
              {isInCart ? (
                <>
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Cart</span>
                </>
              )}
            </button>
            <div className="flex gap-2">
              <Link 
                to={`/product/${product.id}`}
                className="flex-1 py-1.5 sm:py-3 px-2 sm:px-4 bg-gray-50 text-gray-600 rounded-xl sm:rounded-2xl text-center text-[9px] sm:text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95 whitespace-nowrap"
              >
                View
              </Link>
              <Link 
                to={`/checkout/${product.id}`}
                className="flex-1 py-1.5 sm:py-3 px-2 sm:px-4 bg-gray-900 text-white rounded-xl sm:rounded-2xl text-center text-[9px] sm:text-xs font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 whitespace-nowrap"
              >
                Buy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
