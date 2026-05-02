import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { auth } from "../lib/firebase";
import { signOut, User } from "firebase/auth";
import { ShoppingCart, User as UserIcon, LogOut, LayoutDashboard, Search, Trash2, ShoppingBag, X, ArrowRight } from "lucide-react";
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
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2 sm:gap-8">
            <Link to="/" className="text-lg sm:text-2xl font-bold tracking-tighter text-indigo-600 flex items-center gap-1.5 sm:gap-2">
              {settings.logoUrl && settings.logoUrl.trim() !== "" && (
                <img src={settings.logoUrl} alt="Logo" className="w-5 h-5 sm:w-8 sm:h-8 object-contain" />
              )}
              <span className="truncate max-w-[100px] sm:max-w-none">{settings.siteName}</span>
            </Link>
            
            <form onSubmit={handleSearch} className="hidden sm:flex relative">
              <input 
                type="text" 
                placeholder="Search..." 
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                className="pl-9 pr-8 py-1.5 border border-gray-200 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32 sm:w-64 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              {navSearch && (
                <button 
                  type="button"
                  onClick={() => setNavSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1"
                >
                  <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </form>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="sm:hidden p-1.5 text-gray-600 hover:text-indigo-600 transition-colors"
              title="Search"
            >
              {isSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>

            {isAdmin && (
              <Link 
                to="/admin" 
                className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm font-black uppercase tracking-widest text-gray-600 hover:text-indigo-600 transition-colors"
                id="admin-link"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <Link 
                  to="/my-products" 
                  className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm font-black uppercase tracking-widest text-gray-600 hover:text-indigo-600 transition-colors"
                  title="My Products"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span className="hidden lg:inline">My Products</span>
                </Link>
                <Link 
                  to="/profile"
                  className="flex items-center gap-1.5 sm:gap-2 group"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                    <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-gray-700 hidden sm:inline group-hover:text-indigo-600 transition-colors truncate max-w-[80px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            ) : (
              <Link 
                to="/auth" 
                className="bg-indigo-600 text-white px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm"
              >
                Log In
              </Link>
            )}
            
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-1.5 sm:p-2 text-gray-600 hover:text-indigo-600 transition-colors"
            >
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
              {totalItems > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-indigo-600 text-white text-[8px] sm:text-[10px] flex items-center justify-center rounded-full font-bold">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Bar Expansion */}
      <AnimatePresence mode="wait">
        {isSearchOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="sm:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-3">
              <form onSubmit={handleSearch} className="relative">
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  value={navSearch}
                  onChange={(e) => setNavSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 border-none rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                  autoFocus
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                {navSearch && (
                  <button 
                    type="button"
                    onClick={() => setNavSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Sidebar Overlay */}
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
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <ShoppingCart className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Your Cart</h2>
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest">{totalItems} Items</span>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 space-y-6">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                      <ShoppingBag className="w-10 h-10 text-gray-200" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-gray-900">Your cart is empty</p>
                      <p className="text-sm text-gray-400">Add some premium assets to get started.</p>
                    </div>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="text-indigo-600 font-bold text-sm hover:underline"
                    >
                      Continue Shopping
                    </button>
                  </div>
                ) : (
                  items.map(item => (
                    <div key={item.id} className="flex gap-4 group">
                      <div className="w-20 h-20 rounded-2xl bg-gray-50 overflow-hidden border border-gray-100 shrink-0">
                        <img src={item.imageUrl || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80"} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      </div>
                      <div className="flex-grow space-y-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-gray-900 line-clamp-1">{item.name}</h3>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{item.category}</p>
                        <div className="pt-1 text-indigo-600 font-mono font-bold">৳{item.price.toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {items.length > 0 && (
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-900 font-mono font-bold">৳{totalPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-base">
                      <span className="text-gray-900 font-bold">Total</span>
                      <span className="text-indigo-600 font-mono font-black text-xl">৳{totalPrice.toLocaleString()}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setIsCartOpen(false);
                      navigate("/cart-checkout");
                    }}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3"
                  >
                    Checkout Now
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
