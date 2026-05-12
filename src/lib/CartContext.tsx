import React, { createContext, useContext, useState, useEffect } from "react";

interface CartItem {
  id: string;
  originalId?: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  category: string;
  quantity: number;
  size?: string;
  planName?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any, selectedPrice?: number, selectedPlan?: string, size?: string, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
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

  const addToCart = (product: any, selectedPrice?: number, selectedPlan?: string, size?: string, quantity: number = 1) => {
    setItems(prev => {
      // Create a unique ID that includes size if provided
      let cartId = selectedPlan ? `${product.id}_${selectedPlan.toLowerCase()}` : product.id;
      if (size) cartId = `${cartId}_${size.toLowerCase()}`;

      const existing = prev.find(item => item.id === cartId);
      if (existing) {
        // If it exists, we could either return prev or increment quantity.
        // User requirements say "store together", suggesting a new entry or update.
        // Let's increment quantity if same ID and Size.
        return prev.map(item => 
          item.id === cartId 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      } 
      
      const hasDiscount = product.discountEnabled && product.discountPrice && product.discountPrice < product.price;
      const finalPrice = selectedPrice !== undefined 
        ? selectedPrice 
        : (hasDiscount ? Number(product.discountPrice) : Number(product.price));

      return [...prev, { 
        ...product, 
        id: cartId,
        originalId: product.id,
        name: product.name,
        price: finalPrice,
        originalPrice: Number(product.price),
        quantity: quantity,
        size: size,
        planName: selectedPlan 
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };
  
  const updateQuantity = (productId: string, quantity: number) => {
    setItems(prev => {
      if (quantity <= 0) {
        return prev.filter(item => item.id !== productId);
      }
      return prev.map(item => 
        item.id === productId ? { ...item, quantity } : item
      );
    });
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
