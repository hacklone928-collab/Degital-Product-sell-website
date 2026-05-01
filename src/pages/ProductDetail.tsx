import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Star, ShieldCheck, Download, Zap, Share2, Heart, ArrowLeft, CheckCircle2, ShoppingCart, CheckCircle, MessageSquare } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import { useCart } from "../lib/CartContext";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  tags?: string[];
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const { addToCart, items } = useCart();

  const isInCart = product ? items.some(item => item.id === product.id) : false;

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      const docRef = doc(db, "products", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
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

  const features = [
    "Lifetime Updates",
    "Commercial License",
    "Source Code Included",
    "24/7 Premium Support"
  ];

  return (
    <div className="space-y-12 py-6">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Results
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20">
        {/* Gallery */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="aspect-square rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm">
            <img 
              src={product.imageUrl || `https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1000&q=80`} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-square rounded-xl bg-gray-100 overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all opacity-60 hover:opacity-100">
                <img 
                  src={`https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80&rand=${i}`} 
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Info */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100">
                {product.category}
              </span>
              <div className="flex items-center gap-1 text-amber-400">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm font-bold text-gray-700">{product.rating || 0}</span>
                <span className="text-sm text-gray-400 font-medium">({product.reviewCount || 0} Reviews)</span>
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
              {product.name}
            </h1>
            
            <p className="text-gray-600 text-lg leading-relaxed">
              {product.description || "Take your development to the next level with this high-performance professional software toolkit. Designed for efficiency and scalability."}
            </p>
          </div>

          {/* Rating Section */}
          {!hasRated && (
            <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Rate this product:</span>
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
                      <Star className={cn("w-6 h-6", (hoverRating || userRating) >= star ? "fill-current" : "")} />
                    </button>
                  ))}
                </div>
              </div>
              {isSubmitting && <div className="text-amber-600 text-xs font-bold animate-pulse">Submitting...</div>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {feature}
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Price (One-time)</span>
                <div className="text-5xl font-black text-gray-900 flex items-baseline gap-1">
                  <span className="text-xl font-medium text-gray-400">৳</span>
                  {product.price.toLocaleString()}
                </div>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 fill-current" />
                <span className="text-sm font-bold">Instant Delivery</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => product && addToCart(product)}
                disabled={isInCart}
                className={cn(
                  "flex-grow py-5 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95",
                  isInCart 
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-none cursor-default" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
                )}
              >
                {isInCart ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    In Your Cart
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </>
                )}
              </button>
              
              <button 
                onClick={() => navigate(`/checkout/${product.id}`)}
                className="px-8 py-5 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Buy Now
              </button>
            </div>
            
            <p className="text-center text-xs text-gray-500">
              Safe & Secure Payments via Stripe
            </p>
          </div>

          <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-gray-50 px-4 py-2 rounded-full cursor-pointer hover:bg-gray-100 transition-colors">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              Secure Checkout
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-gray-50 px-4 py-2 rounded-full cursor-pointer hover:bg-gray-100 transition-colors">
              <Download className="w-4 h-4 text-indigo-500" />
              {Math.floor(Math.random() * 500) + 100} Sales
            </div>
            <button className="ml-auto p-2 text-gray-400 hover:text-red-500 transition-colors">
              <Heart className="w-6 h-6" />
            </button>
          </div>
        </motion.div>
      </div>
      
      {/* Description & Reviews Tabs (Simplified) */}
      <section className="pt-20 space-y-12">
        <div className="border-b border-gray-100 flex gap-12">
          <button className="pb-4 border-b-2 border-indigo-600 font-bold text-sm uppercase tracking-widest text-indigo-600">Product Details</button>
          <button className="pb-4 border-b-2 border-transparent font-bold text-sm uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">Tech Specs</button>
          <button className="pb-4 border-b-2 border-transparent font-bold text-sm uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">Reviews ({product.reviewCount || 0})</button>
        </div>
        
        <div className="prose prose-indigo max-w-none text-gray-600 leading-relaxed space-y-8">
          <p>
            DigiVault presents this premium asset, meticulously engineered to solve real-world problems for modern developers and designers. 
            Whether you're building a massive enterprise solution or a sleek startup MVP, this product provides the foundation you need.
          </p>
          <div className="grid md:grid-cols-2 gap-8 not-prose">
            <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100">
              <h4 className="font-bold text-indigo-900 mb-2">Key Value Proposition</h4>
              <p className="text-sm text-indigo-800/80">Save over 100+ hours of development time. Ready to deploy out of the box with zero configuration needed for baseline functionality.</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <h4 className="font-bold text-gray-900 mb-2">Technical Compatibility</h4>
              <p className="text-sm text-gray-600">Works with all major modern frameworks. Clean, documented code following industry best practices and PSR standards.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

