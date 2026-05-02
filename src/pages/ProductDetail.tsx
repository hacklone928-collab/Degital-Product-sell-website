import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Star, ShieldCheck, Download, Zap, Share2, Heart, ArrowLeft, CheckCircle2, ShoppingCart, CheckCircle, MessageSquare } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import { useCart } from "../lib/CartContext";

import { useSettings } from "../lib/SettingsContext";

interface Product {
  id: string;
  name: string;
  price: number;
  subscriptionMonthlyPrice?: number;
  subscriptionYearlyPrice?: number;
  subscriptionMonthlyText?: string;
  subscriptionMonthlySubtext?: string;
  subscriptionYearlyText?: string;
  subscriptionYearlySubtext?: string;
  subscriptionLifetimeText?: string;
  subscriptionLifetimeSubtext?: string;
  description: string;
  category: string;
  tags?: string[];
  imageUrl?: string;
  additionalImageUrls?: string;
  rating?: number;
  reviewCount?: number;
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const { addToCart, items } = useCart();

  const [selectedPlan, setSelectedPlan] = useState<"lifetime" | "monthly" | "yearly">("lifetime");

  const activeCartId = product 
    ? (product.category === "Subscription" && selectedPlan !== "lifetime" 
      ? `${product.id}_${selectedPlan}` 
      : product.id)
    : "";

  const isInCart = items.some(item => item.id === activeCartId);

  const getActivePrice = () => {
    if (!product) return 0;
    if (product.category !== "Subscription") return product.price;
    if (selectedPlan === "monthly") return product.subscriptionMonthlyPrice || 0;
    if (selectedPlan === "yearly") return product.subscriptionYearlyPrice || 0;
    return product.price;
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (product.category === "Subscription" && selectedPlan !== "lifetime") {
      const price = getActivePrice();
      const planName = selectedPlan === "monthly" ? "Monthly" : "Yearly";
      addToCart(product, price, planName);
    } else {
      addToCart(product);
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    handleAddToCart();
    navigate("/cart-checkout");
  };

  const [activeImage, setActiveImage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      const docRef = doc(db, "products", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Product;
        
        // Check if category is hidden
        if (settings?.hiddenCategories?.includes(data.category)) {
          navigate("/", { replace: true });
          return;
        }

        setProduct({ id: docSnap.id, ...data } as Product);
        setActiveImage(data.imageUrl || null);
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  const handleRate = async (rating: number) => {
    if (!auth.currentUser) {
      alert("Please sign in to rate products.");
      return;
    }
    if (!product) return;

    setIsSubmitting(true);
    try {
      const productRef = doc(db, "products", product.id);
      
      // Calculate new average rating
      const currentRating = product.rating || 0;
      const currentCount = product.reviewCount || 0;
      const newCount = currentCount + 1;
      const newRating = ((currentRating * currentCount) + rating) / newCount;

      await updateDoc(productRef, {
        rating: Number(newRating.toFixed(1)),
        reviewCount: increment(1),
        updatedAt: serverTimestamp()
      });

      setProduct({
        ...product,
        rating: Number(newRating.toFixed(1)),
        reviewCount: newCount
      });
      setHasRated(true);
      alert("Thank you for your rating!");
    } catch (error) {
      console.error("Error rating product:", error);
      alert("Failed to submit rating. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="animate-pulse space-y-12 py-10">
      <div className="h-10 bg-gray-100 rounded w-1/4" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="aspect-square bg-gray-100 rounded-3xl" />
        <div className="space-y-6">
          <div className="h-12 bg-gray-100 rounded w-3/4" />
          <div className="h-24 bg-gray-100 rounded" />
          <div className="h-16 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );

  if (!product) return (
    <div className="text-center py-20 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Product not found</h2>
      <Link to="/" className="text-indigo-600 font-semibold flex items-center justify-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Catalog
      </Link>
    </div>
  );

  const allImages = [
    product.imageUrl,
    ...(product.additionalImageUrls?.split(',').map(u => u.trim()).filter(u => u) || [])
  ].filter(u => u) as string[];

  const features = [
    "Lifetime Updates",
    "Commercial License",
    "Source Code Included",
    "24/7 Premium Support"
  ];

  return (
    <div className="space-y-6 sm:space-y-12 py-4 sm:py-6">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs sm:text-sm font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-colors mb-2 sm:mb-4 px-1"
      >
        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 xl:gap-20">
        {/* Gallery */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4 sm:space-y-6"
        >
          <div className="aspect-[4/3] sm:aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm transition-all duration-500">
            <img 
              src={activeImage || product.imageUrl || `https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1000&q=80`} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar px-1 sm:grid sm:grid-cols-4 sm:gap-4 sm:pb-0 sm:px-0">
              {allImages.map((img, i) => (
                <div 
                  key={i} 
                  onClick={() => setActiveImage(img)}
                  className={cn(
                    "w-16 h-16 sm:w-auto aspect-square rounded-xl overflow-hidden cursor-pointer transition-all border-2 flex-shrink-0",
                    activeImage === img ? "border-indigo-600 sm:ring-2 sm:ring-indigo-500 sm:ring-offset-2" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img src={img} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Info */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6 sm:space-y-8"
        >
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-50 text-indigo-600 text-[9px] sm:text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100">
                {product.category}
              </span>
              <div className="flex items-center gap-1 text-amber-400">
                <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                <span className="text-xs sm:text-sm font-bold text-gray-700">{product.rating || 0}</span>
                <span className="text-[10px] sm:text-sm text-gray-400 font-medium">({product.reviewCount || 0})</span>
              </div>
            </div>
            
            <h1 className="text-xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 leading-tight uppercase">
              {product.name}
            </h1>
            
            <p className="text-gray-500 text-xs sm:text-lg leading-relaxed font-medium">
              {product.description || "Take your development to the next level with this high-performance professional software toolkit."}
            </p>
          </div>

          {/* Rating Section */}
          {!hasRated && (
            <div className="bg-amber-50/50 rounded-2xl p-3 sm:p-4 border border-amber-100 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Rate:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => handleRate(star)}
                      disabled={isSubmitting}
                      className={cn(
                        "transition-all",
                        (hoverRating || userRating) >= star ? "text-amber-400 scale-110" : "text-gray-300"
                      )}
                    >
                      <Star className={cn("w-5 h-5 sm:w-6 sm:h-6", (hoverRating || userRating) >= star ? "fill-current" : "")} />
                    </button>
                  ))}
                </div>
              </div>
              {isSubmitting && <div className="text-amber-600 text-[10px] font-black animate-pulse uppercase tracking-widest">Submitting...</div>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                {feature}
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 border border-gray-100 space-y-6">
            {product.category === "Subscription" && (
              <div className="space-y-3 sm:space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Select Your Plan</label>
                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                    <button 
                      onClick={() => setSelectedPlan("lifetime")}
                      className={cn(
                        "p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 text-left transition-all flex justify-between items-center group",
                        selectedPlan === "lifetime" ? "border-indigo-600 bg-white" : "border-transparent bg-white/50 hover:bg-white"
                      )}
                    >
                      <div>
                        <div className="font-bold text-xs sm:text-base text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {product.subscriptionLifetimeText || "Lifetime Purchase"}
                        </div>
                        <div className="text-[9px] sm:text-xs text-gray-500">
                          {product.subscriptionLifetimeSubtext || "Forever access"}
                        </div>
                      </div>
                      <div className="text-base sm:text-lg font-black text-indigo-600">৳{product.price.toLocaleString()}</div>
                    </button>

                    {product.subscriptionMonthlyPrice && (
                      <button 
                        onClick={() => setSelectedPlan("monthly")}
                        className={cn(
                          "p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 text-left transition-all flex justify-between items-center group",
                          selectedPlan === "monthly" ? "border-indigo-600 bg-white" : "border-transparent bg-white/50 hover:bg-white"
                        )}
                      >
                        <div>
                          <div className="font-bold text-xs sm:text-base text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {product.subscriptionMonthlyText || "Monthly"}
                          </div>
                          <div className="text-[9px] sm:text-xs text-gray-500">
                            {product.subscriptionMonthlySubtext || "30 days access"}
                          </div>
                        </div>
                        <div className="text-base sm:text-lg font-black text-indigo-600">৳{product.subscriptionMonthlyPrice.toLocaleString()}<span className="text-[10px] font-normal text-gray-400">/mo</span></div>
                      </button>
                    )}

                    {product.subscriptionYearlyPrice && (
                      <button 
                        onClick={() => setSelectedPlan("yearly")}
                        className={cn(
                          "p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 text-left transition-all flex justify-between items-center group",
                          selectedPlan === "yearly" ? "border-indigo-600 bg-white" : "border-transparent bg-white/50 hover:bg-white"
                        )}
                      >
                        <div>
                          <div className="font-bold text-xs sm:text-base text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {product.subscriptionYearlyText || "Yearly"}
                          </div>
                          <div className="text-[9px] sm:text-xs text-gray-500">
                            {product.subscriptionYearlySubtext || "365 days access"}
                          </div>
                        </div>
                        <div className="text-base sm:text-lg font-black text-indigo-600">৳{product.subscriptionYearlyPrice.toLocaleString()}<span className="text-[10px] font-normal text-gray-400">/yr</span></div>
                      </button>
                    )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                  {product.category === "Subscription" && selectedPlan !== "lifetime" ? "Sub Price" : "One-time"}
                </span>
                <div className="text-2xl sm:text-5xl font-black text-gray-900 flex items-baseline gap-0.5 sm:gap-1">
                  <span className="text-xs sm:text-xl font-medium text-gray-400">৳</span>
                  {getActivePrice().toLocaleString()}
                </div>
              </div>
              <div className="bg-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl shadow-sm border border-gray-100 flex items-center gap-1 sm:gap-2">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500 fill-current" />
                <span className="text-[9px] sm:text-sm font-black uppercase tracking-widest">Instant</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button 
                onClick={handleAddToCart}
                disabled={isInCart}
                className={cn(
                  "flex-grow py-3.5 sm:py-5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-lg uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 sm:gap-3 active:scale-95",
                  isInCart 
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-none cursor-default" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
                )}
              >
                {isInCart ? (
                  <>
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    In Cart
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                    Cart
                  </>
                )}
              </button>
              
              <button 
                onClick={handleBuyNow}
                className="px-6 py-3.5 sm:py-5 sm:px-8 bg-gray-900 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-lg uppercase tracking-widest hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-gray-200"
              >
                Buy Now
              </button>
            </div>
            
            <p className="text-center text-[9px] sm:text-xs text-gray-400 font-medium uppercase tracking-widest">
              Secured by Stripe & SSL
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-sm font-black uppercase tracking-widest text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              Secure
            </div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-sm font-black uppercase tracking-widest text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              {Math.floor(Math.random() * 500) + 100} Sold
            </div>
            <button className="ml-auto p-2 text-gray-400 hover:text-red-500 transition-colors">
              <Heart className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </motion.div>
      </div>
      
      {/* Description & Reviews Tabs (Simplified) */}
      <section className="pt-10 sm:pt-20 space-y-8 sm:space-y-12">
        <div className="border-b border-gray-100 flex gap-6 sm:gap-12 overflow-x-auto no-scrollbar scroll-smooth">
          <button className="pb-3 sm:pb-4 border-b-2 border-indigo-600 font-black text-[10px] sm:text-sm uppercase tracking-widest text-indigo-600 whitespace-nowrap">Details</button>
          <button className="pb-3 sm:pb-4 border-b-2 border-transparent font-black text-[10px] sm:text-sm uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap">Specs</button>
          <button className="pb-3 sm:pb-4 border-b-2 border-transparent font-black text-[10px] sm:text-sm uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap">Reviews ({product.reviewCount || 0})</button>
        </div>
        
        <div className="prose prose-indigo max-w-none text-gray-500 text-sm sm:text-base leading-relaxed space-y-6 sm:space-y-8">
          <p className="font-medium">
            This premium asset is meticulously engineered to solve real-world problems for modern developers and designers. 
            Whether you're building a massive enterprise solution or a sleek startup MVP, this product provides the foundation you need.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 not-prose">
            <div className="bg-indigo-50/50 rounded-2xl p-5 sm:p-6 border border-indigo-100">
              <h4 className="font-black text-indigo-900 mb-2 uppercase text-xs tracking-widest">Key Value Proposition</h4>
              <p className="text-[11px] sm:text-sm text-indigo-800/80 font-medium">Save over 100+ hours of development time. Ready to deploy out of the box with zero configuration needed for baseline functionality.</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-5 sm:p-6 border border-gray-100">
              <h4 className="font-black text-gray-900 mb-2 uppercase text-xs tracking-widest">Technical Compatibility</h4>
              <p className="text-[11px] sm:text-sm text-gray-500 font-medium">Works with all major modern frameworks. Clean, documented code following industry best practices and standards.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

