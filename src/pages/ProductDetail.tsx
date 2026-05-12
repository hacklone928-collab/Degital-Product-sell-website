import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, increment, serverTimestamp, collection, addDoc, onSnapshot, query, orderBy, limit, where, setDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/firestoreUtils";
import { Star, ShieldCheck, Download, Zap, Share2, Heart, ArrowLeft, CheckCircle2, ShoppingCart, CheckCircle, MessageSquare, Info, Settings, Users, StarHalf, Maximize2, Minimize2, RotateCcw, Box, ChevronLeft, ChevronRight, X, Youtube } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { cn } from "../lib/utils";
import { useCart } from "../lib/CartContext";
import { useSettings } from "../lib/SettingsContext";

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  createdAt: any;
}

interface Product {
  id: string;
  name: string;
  price: number;
  discountPrice?: number;
  discountEnabled?: boolean;
  description: string;
  category: string;
  tags?: string[];
  imageUrl?: string;
  videoUrl?: string;
  additionalImageUrls?: string;
  rating?: number;
  reviewCount?: number;
  specs?: string; // We'll add this
  overview?: string; // We'll add this
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "specs" | "reviews">("overview");
  const [newReviewComment, setNewReviewComment] = useState("");
  const [userRating, setUserRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToCart, items } = useCart();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<"lifetime" | "monthly" | "yearly">("lifetime");

  const activeCartId = product 
    ? (product.category === "Subscription" && selectedPlan !== "lifetime" 
      ? `${product.id}_${selectedPlan}` 
      : (selectedSize ? `${product.id}_${selectedSize.toLowerCase()}` : product.id))
    : "";

  const isInCart = items.some(item => item.id === activeCartId);

  const getActivePrice = () => {
    if (!product) return 0;
    
    // Check for discount first (for non-subscription or lifetime)
    const basePrice = (product.discountEnabled && product.discountPrice && product.discountPrice < product.price) 
      ? product.discountPrice 
      : product.price;

    if (product.category !== "Subscription") return basePrice;
    if (selectedPlan === "monthly") return product.subscriptionMonthlyPrice || 0;
    if (selectedPlan === "yearly") return product.subscriptionYearlyPrice || 0;
    return basePrice;
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (product.enableSizes && !selectedSize) {
      setSizeError(true);
      return;
    }
    
    const price = getActivePrice();
    const planName = product.category === "Subscription" ? (selectedPlan === "monthly" ? "Monthly" : selectedPlan === "yearly" ? "Yearly" : "Lifetime") : undefined;
    
    addToCart(product, price, planName, selectedSize || undefined, quantity);
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (product.enableSizes && !selectedSize) {
      setSizeError(true);
      return;
    }
    handleAddToCart();
    navigate("/cart-checkout");
  };

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [is360Mode, setIs360Mode] = useState(false);
  const [rotationIndex, setRotationIndex] = useState(0);

  const allImages = product ? [
    product.imageUrl,
    ...(product.additionalImageUrls?.split(',').map((u: string) => u.trim()).filter((u: string) => u) || [])
  ].filter(u => u) as string[] : [];

  const handleDragUpdate = (_: any, info: any) => {
    if (!is360Mode || allImages.length < 2) return;
    const sensitivity = 20; // pixels per image change
    const newIndex = Math.floor(info.offset.x / sensitivity);
    setRotationIndex(() => {
      let idx = (allImages.length - (newIndex % allImages.length)) % allImages.length;
      return idx;
    });
  };

  const handleMainDragEnd = (_: any, info: any) => {
    if (is360Mode || allImages.length < 2) return;
    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold) {
      const idx = allImages.indexOf(activeImage || allImages[0]);
      setActiveImage(allImages[(idx - 1 + allImages.length) % allImages.length]);
    } else if (info.offset.x < -swipeThreshold) {
      const idx = allImages.indexOf(activeImage || allImages[0]);
      setActiveImage(allImages[(idx + 1) % allImages.length]);
    }
  };

  useEffect(() => {
    if (!id) return;
    
    // Real-time product data
    const productRef = doc(db, "products", id);
    const unsubscribeProduct = onSnapshot(productRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (settings?.hiddenCategories?.includes(data.category)) {
          navigate("/", { replace: true });
          return;
        }
        setProduct({ id: docSnap.id, ...data });
        if (!activeImage) setActiveImage(data.imageUrl || null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `products/${id}`);
      setLoading(false);
    });

    // Real-time reviews
    const reviewsQuery = query(
      collection(db, "products", id, "reviews"),
      where("status", "==", "approved"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
      const reviewList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];
      setReviews(reviewList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `products/${id}/reviews`);
    });

    // Increment views
    const timer = setTimeout(() => {
      updateDoc(productRef, {
        views: increment(1)
      }).catch(err => console.error("Error updating views:", err));
    }, 2000); // 2 second delay to count as a "view"

    return () => {
      unsubscribeProduct();
      unsubscribeReviews();
      clearTimeout(timer);
    };
  }, [id, settings]);

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Please sign in to leave a review.");
      return;
    }
    if (!product || !newReviewComment.trim()) return;

    setIsSubmitting(true);
    try {
      const reviewData = {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || "Anonymous",
        userAvatar: auth.currentUser.photoURL || "",
        productId: product.id,
        productName: product.name,
        rating: userRating,
        comment: newReviewComment.trim(),
        status: settings.requireReviewApproval ? "pending" : "approved",
        createdAt: serverTimestamp()
      };

      // Add review to subcollection
      const reviewRef = await addDoc(collection(db, "products", product.id, "reviews"), reviewData);
      
      // Also sync to top-level reviews collection for easier admin management
      await setDoc(doc(db, "reviews", reviewRef.id), reviewData);

      if (!settings.requireReviewApproval) {
        // Update product rating average (only if auto-approved)
        const productRef = doc(db, "products", product.id);
        const currentRating = product.rating || 0;
        const currentCount = product.reviewCount || 0;
        const newCount = currentCount + 1;
        const newRating = ((currentRating * currentCount) + userRating) / newCount;

        await updateDoc(productRef, {
          rating: Number(newRating.toFixed(1)),
          reviewCount: increment(1),
          updatedAt: serverTimestamp()
        });
        alert("Review submitted successfully!");
      } else {
        alert("Review submitted and is awaiting approval.");
      }

      setNewReviewComment("");
      setUserRating(5);
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("Failed to submit review.");
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

  const features = [
    "Lifetime Updates",
    "Commercial License",
    "Source Code Included",
    "24/7 Premium Support"
  ];

  return (
    <div className="space-y-6 sm:space-y-12 py-2 sm:py-6 relative max-w-6xl mx-auto">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-colors mb-2 sm:mb-4 px-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 xl:gap-20">
        {/* Gallery Section */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-7 space-y-6"
        >
          {/* Main Stage */}
          <div className="relative group">
            <div className="aspect-[4/3] sm:aspect-[16/10] rounded-[2rem] sm:rounded-[3rem] overflow-hidden bg-white border border-gray-100 shadow-2xl shadow-indigo-100/50 flex items-center justify-center p-4 sm:p-8 relative">
              {/* Glassmorphism Background Decoration */}
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -left-1/4 w-full h-full bg-indigo-50/50 rounded-full blur-[120px]" />
                <div className="absolute -bottom-1/2 -right-1/4 w-full h-full bg-emerald-50/50 rounded-full blur-[120px]" />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={is360Mode ? `360-${rotationIndex}` : activeImage}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.4, ease: "circOut" }}
                  className="w-full h-full flex items-center justify-center z-10 cursor-grab active:cursor-grabbing"
                  drag="x"
                  onDrag={is360Mode ? handleDragUpdate : undefined}
                  onDragEnd={handleMainDragEnd}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.1}
                >
                  <img 
                    src={is360Mode ? allImages[rotationIndex] : (activeImage || allImages[0])} 
                    alt={product.name}
                    className="w-full h-full object-contain pointer-events-none drop-shadow-2xl"
                    loading="eager"
                  />
                </motion.div>
              </AnimatePresence>

              {/* Controls */}
              <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
                {allImages.length > 2 && (
                  <button
                    onClick={() => {
                      setIs360Mode(!is360Mode);
                      if (!is360Mode) setRotationIndex(allImages.indexOf(activeImage!));
                    }}
                    className={cn(
                      "p-3 sm:p-4 rounded-full backdrop-blur-md shadow-xl transition-all border flex items-center gap-2",
                      is360Mode 
                        ? "bg-indigo-600 border-indigo-500 text-white" 
                        : "bg-white/80 border-white text-gray-900 hover:bg-white"
                    )}
                  >
                    <Box className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest px-1">
                      {is360Mode ? "Exit 360°" : "360° View"}
                    </span>
                  </button>
                )}
                
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-3 sm:p-4 rounded-full bg-white/80 backdrop-blur-md border border-white text-gray-900 shadow-xl hover:bg-white transition-all"
                >
                  <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Navigation Arrows for non-360 */}
              {!is360Mode && allImages.length > 1 && (
                <>
                  <button 
                    onClick={() => {
                      const idx = allImages.indexOf(activeImage || allImages[0]);
                      setActiveImage(allImages[(idx - 1 + allImages.length) % allImages.length]);
                    }}
                    className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-white/50 backdrop-blur-sm border border-white/50 text-gray-900 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-white z-20"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button 
                    onClick={() => {
                      const idx = allImages.indexOf(activeImage || allImages[0]);
                      setActiveImage(allImages[(idx + 1) % allImages.length]);
                    }}
                    className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-white/50 backdrop-blur-sm border border-white/50 text-gray-900 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-white z-20"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Thumbnails */}
          {!is360Mode && (allImages.length > 1 || product.videoUrl) && (
            <div className="flex flex-wrap gap-4 items-center justify-center pt-2">
              {allImages.map((img, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveImage(img)}
                  className={cn(
                    "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[1.5rem] overflow-hidden cursor-pointer transition-all border-2 flex-shrink-0 bg-white p-1",
                    activeImage === img ? "border-indigo-600 shadow-xl shadow-indigo-100" : "border-gray-50 opacity-50 hover:opacity-100 hover:border-gray-200"
                  )}
                >
                  <img src={img} className="w-full h-full object-contain rounded-xl sm:rounded-[1rem]" />
                </button>
              ))}

              {product.videoUrl && (
                <div className="w-full mt-4 max-w-sm mx-auto">
                  <div className="flex items-center gap-2 mb-3 pl-1">
                    <Youtube className="w-4 h-4 text-red-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Watch Product Video</span>
                  </div>
                  <div className="aspect-video w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-black border-4 border-white shadow-xl shadow-indigo-100/30">
                    <iframe 
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${(() => {
                        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                        const match = product.videoUrl.match(regExp);
                        return (match && match[2].length === 11) ? match[2] : product.videoUrl;
                      })()}`}
                      title="Product Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Info Section */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-5 space-y-8"
        >
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-50 text-indigo-600 text-[9px] sm:text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border border-indigo-100">
                {product.category}
              </span>
              {product.discountEnabled && product.discountPrice && product.discountPrice < product.price && (
                <span className="bg-red-500 text-white text-[9px] sm:text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest shadow-lg shadow-red-200">
                  {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                </span>
              )}
              <div className="flex items-center gap-1.5 text-amber-400">
                <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                <span className="text-xs sm:text-sm font-black text-gray-900">{product.rating || 0}</span>
                <span className="text-[10px] sm:text-xs text-gray-400 font-bold">({product.reviewCount || 0} Reviews)</span>
              </div>
            </div>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-gray-900 leading-tight uppercase">
              {product.name}
            </h1>
            
            <p className="text-gray-500 text-xs sm:text-base leading-relaxed font-medium line-clamp-3">
              {product.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] sm:text-sm text-gray-600 font-bold">
                <div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                </div>
                {feature}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-gray-100 space-y-5 sm:space-y-7 shadow-sm">
            {product.category === "Subscription" && (
              <div className="space-y-3 sm:space-y-4">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Select Plan</label>
                <div className="grid grid-cols-1 gap-2.5">
                    <button 
                      onClick={() => setSelectedPlan("lifetime")}
                      className={cn(
                        "p-3 sm:p-4 rounded-xl border-2 text-left transition-all flex justify-between items-center group gap-3",
                        selectedPlan === "lifetime" ? "border-indigo-600 bg-indigo-50/30" : "border-gray-50 bg-gray-50/30 hover:border-gray-100"
                      )}
                    >
                      <div className="space-y-0.5">
                        <div className="font-black text-[11px] sm:text-base text-gray-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                          {product.subscriptionLifetimeText || "Lifetime Access"}
                        </div>
                        <div className="text-[9px] sm:text-xs text-gray-500 font-medium line-clamp-1">
                          Forever access, one-time payment
                        </div>
                      </div>
                      <div className="text-sm sm:text-xl font-black text-indigo-600 tracking-tighter">৳{product.price.toLocaleString()}</div>
                    </button>

                    {product.subscriptionMonthlyPrice && (
                      <button 
                        onClick={() => setSelectedPlan("monthly")}
                        className={cn(
                          "p-3 sm:p-4 rounded-xl border-2 text-left transition-all flex justify-between items-center group gap-3",
                          selectedPlan === "monthly" ? "border-indigo-600 bg-indigo-50/30" : "border-gray-50 bg-gray-50/30 hover:border-gray-100"
                        )}
                      >
                        <div className="space-y-0.5">
                          <div className="font-black text-[11px] sm:text-base text-gray-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                            {product.subscriptionMonthlyText || "Monthly Subscription"}
                          </div>
                          <div className="text-[9px] sm:text-xs text-gray-500 font-medium line-clamp-1">
                            Cancel anytime
                          </div>
                        </div>
                        <div className="text-sm sm:text-xl font-black text-indigo-600 tracking-tighter">৳{product.subscriptionMonthlyPrice.toLocaleString()}<span className="text-[9px] font-medium text-gray-400">/mo</span></div>
                      </button>
                    )}

                    {product.subscriptionYearlyPrice && (
                      <button 
                        onClick={() => setSelectedPlan("yearly")}
                        className={cn(
                          "p-3 sm:p-4 rounded-xl border-2 text-left transition-all flex justify-between items-center group gap-3",
                          selectedPlan === "yearly" ? "border-indigo-600 bg-indigo-50/30" : "border-gray-50 bg-gray-50/30 hover:border-gray-100"
                        )}
                      >
                        <div className="space-y-0.5">
                          <div className="font-black text-[11px] sm:text-base text-gray-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                            {product.subscriptionYearlyText || "Yearly Professional"}
                          </div>
                          <div className="text-[9px] sm:text-xs text-gray-500 font-medium line-clamp-1">
                            Full year access
                          </div>
                        </div>
                        <div className="text-sm sm:text-xl font-black text-indigo-600 tracking-tighter">৳{product.subscriptionYearlyPrice.toLocaleString()}<span className="text-[9px] font-medium text-gray-400">/yr</span></div>
                      </button>
                    )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                  Total Investment
                </span>
                <div className="flex flex-col">
                  {product.discountEnabled && product.discountPrice && product.discountPrice < product.price && (selectedPlan === "lifetime" || product.category !== "Subscription") && (
                    <span className="text-xs sm:text-base text-red-500 font-bold line-through opacity-70">
                      ৳{product.price.toLocaleString()}
                    </span>
                  )}
                  <div className="text-2xl sm:text-5xl font-black text-gray-900 flex items-baseline gap-1 tracking-tighter">
                    <span className="text-xs sm:text-xl font-medium text-gray-400">৳</span>
                    {getActivePrice().toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="bg-amber-50 px-3 py-2 sm:px-5 sm:py-3 rounded-xl border border-amber-100 flex flex-col items-center">
                <Zap className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-500 fill-current mb-0.5" />
                <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-amber-700">Instant</span>
              </div>
            </div>

            {/* Size and Quantity Selection */}
            <div className="space-y-6 pt-4 sm:pt-6 border-t border-gray-50">
              {/* Size Selector */}
              {product.enableSizes && product.availableSizes && product.availableSizes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className={cn(
                      "text-[9px] font-black uppercase tracking-widest transition-colors",
                      sizeError ? "text-red-500" : "text-gray-400"
                    )}>
                      Select Size {sizeError && "(Required)"}
                    </label>
                    <button className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Size Guide</button>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {product.availableSizes.map((size: string) => (
                      <button
                        key={size}
                        onClick={() => {
                          setSelectedSize(size);
                          setSizeError(false);
                        }}
                        className={cn(
                          "w-12 h-12 rounded-xl border-2 font-black transition-all active:scale-95 flex items-center justify-center text-sm",
                          selectedSize === size 
                            ? "border-indigo-600 bg-indigo-50 text-indigo-600 shadow-md shadow-indigo-100" 
                            : "border-gray-50 bg-gray-50/50 text-gray-400 hover:border-gray-100"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Selector */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Quantity</label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-gray-50 rounded-2xl p-1 border border-gray-100">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all text-gray-400 font-black text-lg"
                    >
                      -
                    </button>
                    <span className="w-12 text-center font-black text-gray-900 text-sm">
                      {quantity}
                    </span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all text-gray-400 font-black text-lg"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Minimum weight available</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleAddToCart}
                disabled={isInCart}
                className={cn(
                  "flex-1 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95",
                  isInCart 
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-none cursor-default" 
                    : "hover:opacity-90 shadow-indigo-100"
                )}
                style={!isInCart ? { backgroundColor: settings.cartColor || "#4f46e5", color: settings.cartTextColor || "#ffffff" } : {}}
              >
                {isInCart ? (
                  <>
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    In Cart
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                    {settings.cartText || "Cart"}
                  </>
                )}
              </button>
              
              <button 
                onClick={handleBuyNow}
                className="flex-1 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                style={{ backgroundColor: settings.buyColor || "#111827", color: settings.buyTextColor || "#ffffff" }}
              >
                {settings.buyText || "Buy"}
              </button>
            </div>
            
            <div className="flex justify-center items-center gap-3">
              <div className="flex -space-x-1.5">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?u=${i + parseInt(product.id.slice(0, 2), 16)}`} alt="Avatar" />
                  </div>
                ))}
              </div>
              <p className="text-[8px] sm:text-[10px] text-gray-400 font-black uppercase tracking-widest">
                {Math.floor(Math.random() * 50) + 20}+ recently purchased
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 pt-4 border-t border-gray-50">
            <div className="flex items-center gap-1.5 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Verified Assets
            </div>
            <div className="flex items-center gap-1.5 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              Instant Delivery
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Tabs Section */}
      <section className="pt-10 sm:pt-20 space-y-8 sm:space-y-12">
        <div className="border-b border-gray-100 flex gap-6 sm:gap-10 overflow-x-auto no-scrollbar">
          {[
            { id: "overview", label: "Asset Overview", icon: Info },
            { id: "specs", label: "Technical Specs", icon: Settings },
            { id: "reviews", label: `Client Reviews (${product.reviewCount || 0})`, icon: MessageSquare }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "pb-4 flex items-center gap-2 font-black text-[10px] sm:text-sm uppercase tracking-widest transition-all whitespace-nowrap border-b-2",
                activeTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-900"
              )}
            >
              <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="min-h-[200px]">
          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="prose prose-indigo max-w-none text-gray-500 text-xs sm:text-base leading-relaxed">
                  <p className="font-bold text-gray-900 leading-relaxed text-sm sm:text-lg">
                    {product.overview || "This premium digital asset is meticulously engineered for modern development workflows. Built with performance, scalability, and ease of use in mind, it provides a robust foundation for your next big project."}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-8">
                    <div className="p-5 sm:p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100/50">
                      <h4 className="font-black text-indigo-900 text-[10px] sm:text-xs uppercase tracking-widest mb-2">Designed for Efficiency</h4>
                      <p className="text-[11px] sm:text-sm text-indigo-800/70 font-medium">Reduce your time-to-market significantly with our ready-to-use components and logic. Focus on what matters most - your unique features.</p>
                    </div>
                    <div className="p-5 sm:p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100/50">
                      <h4 className="font-black text-emerald-900 text-[10px] sm:text-xs uppercase tracking-widest mb-2">Scalable Foundation</h4>
                      <p className="text-[11px] sm:text-sm text-emerald-800/70 font-medium">Built following industry standard best practices. Whether you're a solo dev or a large team, this asset scales with your needs.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "specs" && (
              <motion.div 
                key="specs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6"
              >
                {[
                  { label: "Category", value: product.category },
                  { label: "Last Updated", value: product.updatedAt ? new Date(product.updatedAt.seconds * 1000).toLocaleDateString() : "Recently" },
                  { label: "File Format", value: product.category === "Software" ? ".zip / .dmg / .exe" : "Digital Asset" },
                  { label: "Included Files", value: "Source code, Documentation, License" },
                  { label: "Compatibility", value: "Modern Browsers, Cross-platform" },
                  { label: "License", value: "Commercial Premium" }
                ].map((spec, i) => (
                  <div key={i} className="flex justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">{spec.label}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-gray-900">{spec.value}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === "reviews" && (
              <motion.div 
                key="reviews"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 sm:space-y-12"
              >
                {/* Submit Review */}
                {auth.currentUser ? (
                  <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] sm:text-sm font-black text-gray-900 uppercase tracking-widest">Write a Review</h4>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setUserRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="transition-transform active:scale-125"
                          >
                            <Star 
                              className={cn(
                                "w-4 h-4 sm:w-5 sm:h-5",
                                (hoverRating || userRating) >= star ? "text-amber-400 fill-current" : "text-gray-300"
                              )} 
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea 
                      value={newReviewComment}
                      onChange={(e) => setNewReviewComment(e.target.value)}
                      placeholder="Share your experience with this asset..."
                      className="w-full p-4 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 min-h-[100px] font-medium"
                    />
                    <div className="flex justify-end">
                      <button 
                        onClick={handleRate}
                        disabled={isSubmitting || !newReviewComment.trim()}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        {isSubmitting ? "Submitting..." : "Post Review"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-indigo-50 rounded-2xl p-6 text-center border border-indigo-100">
                    <p className="text-sm font-bold text-indigo-900">Please <Link to="/auth" className="underline">sign in</Link> to leave a review.</p>
                  </div>
                )}

                {/* Review List */}
                <div className="space-y-6">
                  {reviews.length === 0 ? (
                    <div className="text-center py-10 space-y-4">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                        <MessageSquare className="w-6 h-6 text-gray-200" />
                      </div>
                      <p className="text-xs sm:text-sm text-gray-400 font-bold uppercase tracking-widest">No reviews yet. Be the first!</p>
                    </div>
                  ) : (
                    reviews.map((review) => (
                      <div key={review.id} className="flex gap-4 p-4 rounded-2xl border border-transparent hover:border-gray-50 transition-colors">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 shrink-0 overflow-hidden border border-gray-50">
                          <img src={review.userAvatar || `https://ui-avatars.com/api/?name=${review.userName}&background=random`} alt={review.userName} />
                        </div>
                        <div className="space-y-1.5 flex-grow">
                          <div className="flex justify-between items-center">
                            <h5 className="text-[11px] sm:text-sm font-black text-gray-900 uppercase tracking-tight">{review.userName}</h5>
                            <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium">
                              {review.createdAt ? new Date(review.createdAt.seconds * 1000).toLocaleDateString() : "Just now"}
                            </span>
                          </div>
                          <div className="flex gap-0.5 text-amber-400">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={cn("w-3 h-3 fill-current", i < review.rating ? "text-amber-400" : "text-gray-200")} />
                            ))}
                          </div>
                          <p className="text-[11px] sm:text-sm text-gray-500 font-medium leading-relaxed italic">
                            "{review.comment}"
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Fullscreen Preview Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-12 overflow-hidden"
          >
            <button 
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 p-4 rounded-full bg-gray-100 text-gray-900 hover:bg-gray-200 transition-all z-[110]"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="w-full h-full max-w-7xl mx-auto flex items-center justify-center">
              <motion.div 
                className="w-full h-full flex items-center justify-center relative touch-none"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
              >
                <img 
                  src={activeImage || allImages[0]} 
                  alt={product.name}
                  className="max-w-full max-h-full object-contain drop-shadow-3xl p-4 cursor-zoom-in"
                  style={{ transform: 'scale(var(--img-zoom, 1))' }}
                  onClick={(e: any) => {
                    const currentScale = e.currentTarget.style.getPropertyValue('--img-zoom') || '1';
                    e.currentTarget.style.setProperty('--img-zoom', currentScale === '1' ? '2.5' : '1');
                  }}
                />
              </motion.div>
            </div>

            {/* Thumbnail selector in modal */}
            {allImages.length > 1 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar max-w-full px-8">
                {allImages.map((img, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveImage(img)}
                    className={cn(
                      "w-12 h-12 sm:w-20 sm:h-20 rounded-xl overflow-hidden cursor-pointer transition-all border-2 bg-white flex-shrink-0 p-1",
                      activeImage === img ? "border-indigo-600 shadow-xl shadow-indigo-100 scale-110" : "border-gray-100 opacity-50 hover:opacity-100"
                    )}
                  >
                    <img src={img} className="w-full h-full object-contain rounded-lg" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

