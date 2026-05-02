import React, { createContext, useContext, useState, useEffect } from "react";

interface CartItem {
  id: string;
  originalId?: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any, selectedPrice?: number, selectedPlan?: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const addToCart = (product: any, selectedPrice?: number, selectedPlan?: string) => {
    setItems(prev => {
      const cartId = selectedPlan ? `${product.id}_${selectedPlan.toLowerCase()}` : product.id;
      const existing = prev.find(item => item.id === cartId);
      if (existing) return prev; 
      
      return [...prev, { 
        ...product, 
        id: cartId,
        originalId: product.id, // Store original ID for reference if needed
        name: selectedPlan ? `${product.name} (${selectedPlan})` : product.name,
        price: selectedPrice !== undefined ? selectedPrice : product.price,
        quantity: 1 
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };

  const clearCart = () => setItems([]);

  const totalItems = items.length;
  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
