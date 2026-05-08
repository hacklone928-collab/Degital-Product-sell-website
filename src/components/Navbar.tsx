import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { auth } from "../lib/firebase";
import { signOut, User } from "firebase/auth";
import { ShoppingCart, User as UserIcon, LogOut, LayoutDashboard, Search, Trash2, ShoppingBag, X, ArrowRight, Grid } from "lucide-react";
import { cn } from "../lib/utils";
import { useSettings } from "../lib/SettingsContext";
import { useCart } from "../lib/CartContext";

interface NavbarProps {
  user: User | null;
  isAdmin: boolean;
}

import { motion, AnimatePresence } from "motion/react";

export default function Navbar({ user, isAdmin }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const { totalItems, items, removeFromCart, totalPrice } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (navSearch.trim()) {
      navigate(`/?q=${encodeURIComponent(navSearch.trim())}`);
      setIsSearchOpen(false);
    }
  };
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <>
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20 items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-6 shrink-0 min-w-0">
              <Link 
                to="/" 
                className="text-xl sm:text-2xl font-black tracking-tighter flex items-center gap-2 shrink-0 transition-opacity hover:opacity-90"
                style={{ 
                  color: settings.useBrandGradient ? 'transparent' : (settings.brandColor || "#4f46e5"),
                  backgroundImage: settings.useBrandGradient 
                    ? `linear-gradient(to right, ${settings.brandColor || "#4f46e5"}, ${settings.brandSecondaryColor || "#818cf8"})` 
                    : 'none',
                  backgroundClip: settings.useBrandGradient ? 'text' : 'border-box',
                  WebkitBackgroundClip: settings.useBrandGradient ? 'text' : 'border-box',
                }}
              >
                {settings.logoUrl && settings.logoUrl.trim() !== "" && (
                  <img src={settings.logoUrl} alt="Logo" className="w-6 h-6 sm:w-10 sm:h-10 object-contain" />
                )}
                <span className="truncate max-w-[150px] sm:max-w-none">{settings.siteName}</span>
              </Link>
              
              <form onSubmit={handleSearch} className="hidden md:flex relative">
                <input 
                  type="text" 
                  placeholder="Search premium assets..." 
                  value={navSearch}
                  onChange={(e) => setNavSearch(e.target.value)}
                  className="pl-10 pr-8 py-2.5 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 w-64 lg:w-96 transition-all font-medium"
                />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </form>
            </div>

            <div className="flex items-center gap-0.5 sm:gap-4 shrink-0 min-w-0">
              {isAdmin && (
                <Link 
                  to="/admin" 
                  className="flex flex-col sm:flex-row items-center gap-0.5 px-1 sm:px-3 py-1.5 rounded-xl text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent active:scale-95 shrink-0"
                  id="admin-link"
                >
                  <LayoutDashboard className="w-4 h-4 text-indigo-500" />
                  <span className="text-[7px] sm:text-[10px] font-black uppercase tracking-widest leading-none hidden sx:flex">Admin</span>
                </Link>
              )}

              {user ? (
                <div className="flex items-center gap-0.5 sm:gap-6 shrink-0">
                  <Link 
                    to="/my-products" 
                    className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>My Assets</span>
                  </Link>
                  
                  <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                    <Link 
                      to="/profile"
                      className="flex items-center gap-2 group shrink-0"
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-all">
                        <UserIcon className="w-4 h-4 text-indigo-600 group-hover:text-white transition-colors" />
                      </div>
                      <span className="text-sm font-bold text-gray-700 hidden xl:inline group-hover:text-indigo-600 transition-colors truncate max-w-[80px]">
                        {user.displayName || user.email?.split('@')[0]}
                      </span>
                    </Link>
                    <button 
                      onClick={handleLogout}
                      className="p-1 px-1 text-gray-400 hover:text-red-500 transition-colors hidden sm:block"
                      title="Logout"
                    >
                      <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <Link 
                  to="/auth" 
                  className="bg-indigo-600 text-white px-4 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 shrink-0"
                >
                  Sign In
                </Link>
              )}
              
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 sm:p-3 text-gray-700 hover:bg-gray-50 rounded-xl sm:rounded-2xl transition-all border border-transparent active:scale-95 shrink-0"
              >
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                {totalItems > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] sm:min-w-[20px] h-[16px] sm:h-[20px] px-1 bg-indigo-600 text-white text-[8px] sm:text-[10px] flex items-center justify-center rounded-full font-black ring-2 ring-white">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar Expansion */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
            >
              <div className="px-4 py-4">
                <form onSubmit={handleSearch} className="relative">
                  <input 
                    type="text" 
                    placeholder="Search premium digital assets..." 
                    value={navSearch}
                    onChange={(e) => setNavSearch(e.target.value)}
                    className="w-full pl-11 pr-10 py-3.5 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 font-bold tracking-tight"
                    autoFocus
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  {navSearch && (
                    <button 
                      type="button"
                      onClick={() => setNavSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-gray-200 rounded-lg"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cart Sidebar Overlay (unchanged) */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                      <ShoppingCart className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Your Cart</h2>
                    <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[8px] font-black text-gray-500 uppercase tracking-[0.2em]">{totalItems}</span>
                  </div>
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
                  >
                    <X className="w-5 h-5" />
                  </button>
              </div>

              <div className="flex-grow overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-50 rounded-full flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 text-gray-200" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-gray-900 text-sm uppercase tracking-tight">Your cart is empty</p>
                      <p className="text-xs text-gray-400 font-medium">Add some premium assets to get started.</p>
                    </div>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:underline"
                    >
                      Continue Shopping
                    </button>
                  </div>
                ) : (
                  items.map(item => (
                    <div key={item.id} className="flex gap-3.5 group">
                      <div className="w-14 h-14 rounded-xl bg-gray-50 overflow-hidden border border-gray-100 shrink-0">
                        <img src={item.imageUrl || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80"} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      </div>
                      <div className="flex-grow space-y-0.5">
                        <div className="flex justify-between items-start">
                          <h3 className="font-black text-gray-900 text-[11px] sm:text-xs uppercase tracking-tight line-clamp-1">{item.name}</h3>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">{item.category}</p>
                        {item.planName && (
                          <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest">
                            {item.planName}
                          </span>
                        )}
                        <div className="pt-1 text-indigo-600 font-black text-xs sm:text-sm">৳{item.price.toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {items.length > 0 && (
                <div className="p-5 sm:p-6 border-t border-gray-100 bg-white space-y-4 sm:space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] sm:text-xs">
                      <span className="text-gray-400 font-black uppercase tracking-widest">Subtotal</span>
                      <span className="text-gray-900 font-black">৳{totalPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm sm:text-base">
                      <span className="text-gray-900 font-black uppercase tracking-tighter">Total Due</span>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-[10px] font-medium text-gray-400">৳</span>
                        <span className="text-indigo-600 font-black text-xl sm:text-2xl tracking-tighter">
                          {totalPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                   id="cart-checkout-btn"
                    onClick={() => {
                      setIsCartOpen(false);
                      navigate("/cart-checkout");
                    }}
                    className="w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95"
                    style={{ backgroundColor: settings.buyColor || "#4f46e5", color: settings.buyTextColor || "#ffffff" }}
                  >
                    {settings.buyText || "Buy"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <div className="sm:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-sm bg-white/95 backdrop-blur-2xl border border-indigo-100/30 rounded-[32px] shadow-[0_25px_60px_rgba(79,70,229,0.2)] flex items-center justify-around p-3 z-50">
        <Link 
          to="/" 
          className={cn(
            "flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300",
            location.pathname === "/" ? "text-indigo-600 bg-indigo-50/50 shadow-inner" : "text-gray-400 hover:text-indigo-400"
          )}
        >
          <Grid className="w-5 h-5 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Shop</span>
        </Link>
        <button 
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className={cn(
            "flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300",
            isSearchOpen ? "text-indigo-600 bg-indigo-50/50 shadow-inner" : "text-gray-400 hover:text-indigo-400"
          )}
        >
          <Search className="w-5 h-5 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Search</span>
        </button>
        <Link 
          to="/my-products" 
          className={cn(
            "flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300",
            location.pathname === "/my-products" ? "text-indigo-600 bg-indigo-50/50 shadow-inner" : "text-gray-400 hover:text-indigo-400"
          )}
        >
          <ShoppingBag className="w-5 h-5 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Orders</span>
        </Link>
        <Link 
          to="/profile" 
          className={cn(
            "flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300",
            location.pathname === "/profile" ? "text-indigo-600 bg-indigo-50/50 shadow-inner" : "text-gray-400 hover:text-indigo-400"
          )}
        >
          <UserIcon className="w-5 h-5 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
        </Link>
      </div>
    </nav>
    </>
  );
}
