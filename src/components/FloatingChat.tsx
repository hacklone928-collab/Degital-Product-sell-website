import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs
} from "firebase/firestore";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import { 
  MessageCircle, 
  X, 
  Send, 
  Image as ImageIcon, 
  User, 
  ArrowLeft, 
  Smile,
  Paperclip,
  Loader2,
  Check,
  CheckCheck,
  Sparkles,
  Plus,
  Search,
  Volume2,
  VolumeX,
  Pin,
  MoreHorizontal,
  Copy,
  MessageSquare,
  Headphones,
  ShoppingCart
} from "lucide-react";
import { cn } from "../lib/utils";
import { useCart } from "../lib/CartContext";
import Markdown from "react-markdown";
import { Link } from "react-router-dom";

interface Message {
  id: string;
  sessionId: string;
  senderId: string;
  senderType: "user" | "admin" | "ai";
  text?: string;
  imageUrl?: string;
  isDeleted?: boolean;
  reactions?: Record<string, string[]>;
  productCard?: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
  };
  replyTo?: {
    id: string;
    text: string;
    senderType: string;
  } | null;
  createdAt: Timestamp;
  seen?: boolean;
}

const formatMessageTime = (createdAt: any): string => {
  if (!createdAt) return '...';
  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (createdAt instanceof Date) {
    return createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (typeof createdAt === 'string') {
    return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (typeof createdAt.seconds === 'number') {
    return new Date(createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return '...';
};

const getMessageTime = (createdAt: any): number => {
  if (!createdAt) return Date.now();
  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate().getTime();
  }
  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }
  if (typeof createdAt === 'string') {
    return new Date(createdAt).getTime();
  }
  if (typeof createdAt.seconds === 'number') {
    return createdAt.seconds * 1000;
  }
  return Date.now();
};

export default function FloatingChat() {
  const { items: cartItems } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestInfo, setGuestInfo] = useState<{ name: string; email: string } | null>(null);
  const [isGuestFormOpen, setIsGuestFormOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [siteSettings, setSiteSettings] = useState<any>(() => {
    try {
      const cached = localStorage.getItem("site_settings");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error("Failed to load cached settings in FloatingChat:", e);
      return null;
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [adminIsTyping, setAdminIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatSearchTerm, setChatSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragControls = useDragControls();

  // Initialize Sound
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
  }, []);

  // Initialize Guest ID
  const [guestId] = useState(() => {
    const saved = localStorage.getItem("chat_guest_id");
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(7);
    localStorage.setItem("chat_guest_id", newId);
    return newId;
  });

  // Set typing status
  useEffect(() => {
    if (!session?.id) return;
    const typingDoc = doc(db, "chat_sessions", session.id);
    const userId = auth.currentUser?.uid || guestId;
    
    updateDoc(typingDoc, {
      [`typingStatus.${userId}`]: inputText.length > 0
    });

    const timeout = setTimeout(() => {
      updateDoc(typingDoc, {
        [`typingStatus.${userId}`]: false
      });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [inputText, session?.id, guestId]);

  // Listen for admin typing
  useEffect(() => {
    if (!session?.typingStatus) return;
    const typingStates = session.typingStatus;
    const adminTyping = Object.entries(typingStates).some(([uid, isTyping]) => uid !== (auth.currentUser?.uid || guestId) && isTyping);
    setAdminIsTyping(adminTyping);
  }, [session?.typingStatus, guestId]);

  // Product Link Detection
  useEffect(() => {
    const detectProductLink = async () => {
      // Simple regex for product URLs if applicable, or manual IDs
      const match = inputText.match(/\/product\/([a-zA-Z0-9_\-]+)/);
      if (match && products.length > 0) {
        const prodId = match[1];
        const product = products.find(p => p.id === prodId);
        if (product) {
          // Auto-convert to card if detected
          setReplyingTo(null); // Clear reply
          sendMessage(undefined, { 
            id: product.id, 
            name: product.name, 
            price: product.price, 
            imageUrl: product.imageUrl 
          });
          setInputText(""); // Clear input
        }
      }
    };
    if (inputText.includes("/product/")) {
      detectProductLink();
    }
  }, [inputText, products]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setIsUploading(true);
    try {
      // In this environment, we use a mock upload or a data URL for simplicity 
      // as we don't have direct Firebase Storage access easily without config.
      // But typically it would be uploadBytes(ref).
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        await addDoc(collection(db, "chat_messages"), {
          sessionId: session.id,
          senderId: auth.currentUser?.uid || guestId,
          senderType: "user",
          imageUrl: base64, // Real app would use URL from storage
          createdAt: serverTimestamp(),
          seen: false
        });

        await updateDoc(doc(db, "chat_sessions", session.id), {
          lastMessage: "📷 Image",
          lastTimestamp: serverTimestamp(),
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteMessage = async (msgId: string) => {
    try {
      await updateDoc(doc(db, "chat_messages", msgId), {
        isDeleted: true,
        text: "This message was deleted"
      });
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const reactToMessage = async (msgId: string, emoji: string) => {
    try {
      const msgRef = doc(db, "chat_messages", msgId);
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) return;
      
      const reactions = msgSnap.data().reactions || {};
      const userId = auth.currentUser?.uid || guestId;
      
      if (!reactions[emoji]) reactions[emoji] = [];
      
      if (reactions[emoji].includes(userId)) {
        reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
      } else {
        reactions[emoji].push(userId);
      }

      await updateDoc(msgRef, { reactions });
    } catch (err) {
      console.error("Failed to react to message:", err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const forwardMessage = (text: string) => {
    setInputText(prev => prev + (prev ? " " : "") + text);
  };

  // Load site settings in real-time for instantaneous load & live changes
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "site"), (snap) => {
      if (snap.exists()) {
        setSiteSettings(snap.data());
      }
    });
    return () => unsub();
  }, []);

  // Load products when chat is opened
  useEffect(() => {
    if (isOpen) {
      getDocs(collection(db, "products")).then(snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  // Scroll to bottom
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages, isTyping, isOpen]);

  // Load or create session
  useEffect(() => {
    const userId = auth.currentUser?.uid || guestId;
    const sessionRef = doc(db, "chat_sessions", userId);
    
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        setSession({ id: docSnap.id, ...docSnap.data() });
      } else {
        setSession(null);
      }
    });

    return unsubscribe;
  }, [guestId]);

  // Listen to messages
  useEffect(() => {
    if (!session) return;

    const q = query(
      collection(db, "chat_messages"),
      where("sessionId", "==", session.id),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Use serverTimestamps: 'estimate' so local writes have temporary dates instead of null
      const msgs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data({ serverTimestamps: 'estimate' }) 
      } as Message));
      
      // Client-side sort guarantees chronological order under all networking and synchronization delays
      const sortedMsgs = [...msgs].sort((a, b) => getMessageTime(a.createdAt) - getMessageTime(b.createdAt));
      
      // Play sound for new incoming messages
      if (sortedMsgs.length > messages.length && messages.length > 0) {
        const lastMsg = sortedMsgs[sortedMsgs.length - 1];
        if (lastMsg.senderType !== "user" && soundEnabled && audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
      }

      setMessages(sortedMsgs);

      // Mark as seen (if sender is admin or ai)
      snapshot.docs.forEach(async (d) => {
        if (d.data().senderType !== "user" && !d.data().seen) {
          await updateDoc(doc(db, "chat_messages", d.id), { seen: true });
        }
      });
    });

    return unsubscribe;
  }, [session, messages.length]);

  const handleStartChat = async (name?: string, email?: string) => {
    const finalName = name || guestInfo?.name;
    const finalEmail = email || guestInfo?.email;

    if (!finalName || !finalEmail) {
      setIsGuestFormOpen(true);
      return;
    }
    
    setLoading(true);
    const userId = auth.currentUser?.uid || null;
    const sid = userId || guestId;

    try {
      await setDoc(doc(db, "chat_sessions", sid), {
        userId,
        userName: finalName,
        userEmail: finalEmail,
        status: "open",
        aiEnabled: true,
        typingStatus: {},
        unreadCount: 0,
        createdAt: serverTimestamp(),
        lastTimestamp: serverTimestamp() // Add this for sorting
      });

      // Send initial welcome message
      const welcomeMsg = siteSettings?.chatWelcomeMessage || "Hello! How can we help you today?";
      await addDoc(collection(db, "chat_messages"), {
        sessionId: sid,
        senderId: "ai_bot",
        senderType: "ai",
        text: welcomeMsg,
        createdAt: serverTimestamp(),
        seen: false
      });

      setIsGuestFormOpen(false);
    } catch (err) {
      console.error("Failed to start chat:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e?: React.FormEvent, productData?: any, overrideText?: string) => {
    e?.preventDefault();
    if (!productData && !overrideText && !inputText.trim()) return;
    if (!session) return;
    if (session.status === "blocked") {
      alert("Your access to chat has been restricted by an administrator.");
      return;
    }

    const text = overrideText || inputText;
    const currentReplyTo = replyingTo;
    
    if (!overrideText) {
      setInputText("");
    }
    setReplyingTo(null);
    setShowProductPicker(false);

    try {
      const msgData: any = {
        sessionId: session.id,
        senderId: auth.currentUser?.uid || guestId,
        senderType: "user",
        createdAt: serverTimestamp(),
        seen: false
      };

      if (productData) {
        msgData.productCard = productData;
      } else {
        msgData.text = text;
        if (currentReplyTo) {
          msgData.replyTo = {
            id: currentReplyTo.id,
            text: currentReplyTo.text || (currentReplyTo.productCard ? `Product: ${currentReplyTo.productCard.name}` : "Media"),
            senderType: currentReplyTo.senderType
          };
        }
      }

      await addDoc(collection(db, "chat_messages"), msgData);
      
      await updateDoc(doc(db, "chat_sessions", session.id), {
        lastMessage: productData ? `Shared Product: ${productData.name}` : text,
        lastTimestamp: serverTimestamp(),
        aiEnabled: true, // Always keep AI auto-reply enabled
      });

      // Call AI auto-reply (for any text messages OR shared product cards)
      setIsTyping(true);
      fetch("/api/chat/auto-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          message: productData ? `আমি এই পণ্যটি (Product) শেয়ার করেছি: ${productData.name}। এটার দাম ৳${productData.price}। দয়া করে এই পণ্যটি সম্পর্কে বিস্তারিত বলুন এবং আমাকে এটি কেনার জন্য সাহায্য করুন।` : text,
          userName: session.userName,
          userEmail: session.userEmail,
          forceEnabled: true,
          cart: cartItems,
          sharedProduct: productData || null
        })
      })
      .catch(err => console.error("AI reply failed:", err))
      .finally(() => {
        setIsTyping(false);
      });

    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        id="floating-chat-button"
        drag
        dragMomentum={false}
        dragElastic={0}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        style={{
          bottom: window.innerWidth < 640 
            ? (siteSettings?.mobileBottom || 24) 
            : (siteSettings?.desktopBottom || 32),
          right: window.innerWidth < 640 
            ? (siteSettings?.mobileRight || 24) 
            : (siteSettings?.desktopRight || 32),
          width: siteSettings?.iconSize || 48,
          height: siteSettings?.iconSize || 48,
          display: isOpen ? 'none' : 'flex'
        }}
        className={cn(
          "fixed z-50 items-center justify-center rounded-full shadow-2xl transition-transform",
          "bg-indigo-600 hover:bg-indigo-700 text-white"
        )}
      >
        {siteSettings?.iconType === 'message-square' ? (
          <MessageSquare style={{ width: (siteSettings?.iconSize || 48) * 0.5, height: (siteSettings?.iconSize || 48) * 0.5 }} />
        ) : siteSettings?.iconType === 'headphones' ? (
          <Headphones style={{ width: (siteSettings?.iconSize || 48) * 0.5, height: (siteSettings?.iconSize || 48) * 0.5 }} />
        ) : siteSettings?.iconType === 'sparkles' ? (
          <Sparkles style={{ width: (siteSettings?.iconSize || 48) * 0.5, height: (siteSettings?.iconSize || 48) * 0.5 }} />
        ) : (
          <MessageCircle style={{ width: (siteSettings?.iconSize || 48) * 0.5, height: (siteSettings?.iconSize || 48) * 0.5 }} />
        )}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500"></span>
        </span>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              bottom: window.innerWidth < 640 
                ? 0 
                : (siteSettings?.desktopBottom || 24),
              right: window.innerWidth < 640 
                ? 0 
                : (siteSettings?.desktopRight || 24),
            }}
            className="fixed inset-0 z-[60] sm:bottom-auto sm:right-auto sm:inset-auto sm:w-[400px] sm:h-[600px] flex flex-col bg-white dark:bg-gray-900 shadow-2xl sm:rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800"
          >
            {/* Header - Drag Handle */}
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="p-4 bg-indigo-600 text-white flex items-center justify-between shadow-lg z-20 cursor-move active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsSearching(!isSearching)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">{siteSettings?.chatHeaderTitle || "Smart AI Support"}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                    <span className="text-[10px] text-indigo-100 uppercase tracking-widest font-black">{siteSettings?.chatHeaderSubtitle || "Online"}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-50" />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  id="close-chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-header / Search */}
            <AnimatePresence>
              {isSearching && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-indigo-700 p-2 overflow-hidden border-t border-indigo-500/30"
                >
                   <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-300" />
                    <input 
                      autoFocus
                      type="text"
                      value={chatSearchTerm}
                      onChange={(e) => setChatSearchTerm(e.target.value)}
                      placeholder="Search messages..."
                      className="w-full bg-indigo-800/50 border-none rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-indigo-400 focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pinned Message Bar */}
            {session?.pinnedMessageId && (
               <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 p-2 flex items-center justify-between gap-3 shadow-sm">
                 <div className="flex items-center gap-2 min-w-0">
                    <Pin className="w-3 h-3 text-indigo-600 fill-current flex-shrink-0" />
                    <p className="text-[10px] text-gray-500 truncate italic">
                      {messages.find(m => m.id === session.pinnedMessageId)?.text || "Pinned Media"}
                    </p>
                 </div>
                 <button 
                  onClick={() => {
                     const el = document.getElementById(`msg-${session.pinnedMessageId}`);
                     el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded"
                 >
                   View
                 </button>
               </div>
            )}

            {/* Content */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-950/20">
              {!session ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto">
                      <MessageCircle className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h4 className="text-lg font-bold dark:text-white">{siteSettings?.chatStartTitle || "Start a Conversation"}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {siteSettings?.chatStartSubtitle || "Our AI and human experts are ready to help you with anything."}
                    </p>
                    <button
                      onClick={() => {
                        if (auth.currentUser) {
                          handleStartChat(
                            auth.currentUser.displayName || "User",
                            auth.currentUser.email || ""
                          );
                        } else {
                          setIsGuestFormOpen(true);
                        }
                      }}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all transform hover:scale-[1.02]"
                      id="start-chat-btn"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (siteSettings?.chatStartButtonText || "Start Chat Now")}
                    </button>
                  </motion.div>
                </div>
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-xs text-gray-400">No messages yet. Say hi!</p>
                    </div>
                  )}
                  {messages.filter(m => !chatSearchTerm || (m.text && m.text.toLowerCase().includes(chatSearchTerm.toLowerCase()))).map((msg, idx) => {
                    const isUser = msg.senderType === "user";
                    const isAI = msg.senderType === "ai";
                    const isAdmin = msg.senderType === "admin";
                    
                    return (
                      <div key={msg.id} className={cn("flex flex-col w-full", isUser ? "items-end" : "items-start")}>
                        <div className={cn(
                          "flex items-end gap-2 max-w-[88%] group relative",
                          isUser ? "flex-row-reverse" : "flex-row"
                        )}>
                          {/* Avatar */}
                          {!isUser ? (
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-1 border shadow-sm",
                              isAI 
                                ? "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-600" 
                                : "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600"
                            )}>
                              {isAI ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                          ) : (
                            <div className="w-1" />
                          )}

                          <motion.div
                            id={`msg-${msg.id}`}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            onDoubleClick={() => setReplyingTo(msg)}
                            className={cn(
                              "flex flex-col relative",
                              isUser ? "items-end" : "items-start"
                            )}
                          >
                            {/* Sender Label */}
                            {!isUser && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">
                                {isAI ? "Smart Assistant" : "Support"}
                              </span>
                            )}

                            {/* Message Actions - Hover only */}
                            <div className={cn(
                              "absolute top-0 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 z-10",
                              isUser ? "-left-20" : "-right-20"
                            )}>
                              <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:text-indigo-600" title="Reply">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => copyToClipboard(msg.text || "")} className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:text-indigo-600" title="Copy">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Reply Link */}
                            {msg.replyTo && (
                              <div className={cn(
                                "mb-1 p-2.5 rounded-2xl text-[10px] border-l-4 bg-black/5 dark:bg-white/5 opacity-80 backdrop-blur-md",
                                isUser ? "mr-1 border-indigo-200" : "ml-1 border-gray-300"
                              )}>
                                <p className="font-black uppercase text-[8px] opacity-60 mb-1">
                                  Replying to {msg.replyTo.senderType === "admin" ? "Support" : msg.replyTo.senderType === "ai" ? "Assistant" : "Me"}
                                </p>
                                <p className="line-clamp-2 italic text-gray-600 dark:text-gray-400">{msg.replyTo.text}</p>
                              </div>
                            )}

                            {msg.productCard ? (
                              <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-lg border border-gray-100 dark:border-gray-700 w-[240px]">
                                <img src={msg.productCard.imageUrl} alt="" className="w-full h-24 object-cover rounded-xl mb-2" />
                                <h5 className="font-bold text-xs dark:text-white italic truncate">{msg.productCard.name}</h5>
                                <p className="text-indigo-600 font-bold text-xs mt-0.5">${msg.productCard.price}</p>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <a 
                                    href={`/product/${msg.productCard.id}`} 
                                    className="py-1.5 bg-gray-100 text-gray-700 rounded-lg text-[10px] font-bold text-center hover:bg-gray-200 transition-all"
                                  >
                                    View
                                  </a>
                                  <button 
                                    onClick={() => {
                                      window.location.href = `/product/${msg.productCard?.id}`;
                                    }}
                                    className="py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold text-center hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                                  >
                                    Buy Now
                                  </button>
                                </div>
                              </div>
                            ) : msg.imageUrl ? (
                              <div className="bg-white dark:bg-gray-800 rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                                <img src={msg.imageUrl} alt="Shared" className="max-w-full rounded-xl max-h-60 object-contain" />
                              </div>
                            ) : (
                              <motion.div 
                                drag="x"
                                dragConstraints={{ left: 0, right: 0 }}
                                dragElastic={0.3}
                                onDragEnd={(_, info) => {
                                  if (info.offset.x < -40 || info.offset.x > 40) {
                                    setReplyingTo(msg);
                                  }
                                }}
                                className={cn(
                                "p-3 px-4 rounded-2xl text-[14px] shadow-sm relative leading-relaxed",
                                msg.isDeleted ? "italic opacity-50 bg-gray-100 dark:bg-gray-800" :
                                isUser 
                                  ? "bg-indigo-600 text-white rounded-tr-[4px]" 
                                  : isAI
                                    ? "bg-purple-50 dark:bg-purple-900/10 text-purple-900 dark:text-purple-100 border border-purple-100 dark:border-purple-800 rounded-tl-[4px] font-medium"
                                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-[4px] border border-gray-100 dark:border-gray-700 font-medium"
                              )}>
                                {msg.isDeleted ? (
                                  msg.text
                                ) : (
                                  <div className="markdown-body text-inherit">
                                    <Markdown
                                      components={{
                                        a: ({ href, children }) => {
                                          const linkClass = isUser 
                                            ? "underline text-white font-extrabold hover:text-indigo-100" 
                                            : "underline text-indigo-600 dark:text-indigo-400 font-extrabold hover:opacity-80";
                                          if (href && href.startsWith("/")) {
                                            return (
                                              <Link to={href} className={linkClass}>
                                                {children}
                                              </Link>
                                            );
                                          }
                                          return (
                                            <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={linkClass}>
                                              {children}
                                            </a>
                                          );
                                        }
                                      }}
                                    >
                                      {msg.text || ""}
                                    </Markdown>
                                  </div>
                                )}
                                
                                {/* Reactions Display */}
                                {msg.reactions && Object.keys(msg.reactions).some(e => msg.reactions[e].length > 0) && (
                                  <div className={cn(
                                    "absolute -bottom-3 flex gap-1",
                                    isUser ? "right-2" : "left-2"
                                  )}>
                                    {Object.entries(msg.reactions).map(([emoji, uids]: [string, any]) => uids.length > 0 && (
                                      <button 
                                        key={emoji}
                                        onClick={() => reactToMessage(msg.id, emoji)}
                                        className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-full text-[10px] shadow-sm hover:scale-110 transition-all"
                                      >
                                        {emoji} {uids.length > 1 && uids.length}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            )}
                            
                            <div className={cn("mt-1 flex items-center gap-1.5 px-1", isUser ? "justify-end" : "justify-start")}>
                              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest opacity-60">
                                {formatMessageTime(msg.createdAt)}
                              </span>
                              {isUser && (
                                <div className="flex items-center gap-1">
                                  {msg.seen ? (
                                    <>
                                      <span className="text-[8px] font-black uppercase text-indigo-500">Seen</span>
                                      <CheckCheck className="w-2.5 h-2.5 text-indigo-500" />
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-[8px] font-black uppercase text-gray-400">Sent</span>
                                      <Check className="w-2.5 h-2.5 text-gray-400/50" />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing Indicator */}
                  {(adminIsTyping || isTyping) && (
                    <div className="flex items-end gap-2 max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center flex-shrink-0 animate-pulse">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl rounded-tl-[4px] border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                        </div>
                      </div>
                    </div>
                  )}


                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            {session && (
              <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 relative">
                <AnimatePresence>
                  {replyingTo && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 right-0 p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 z-10"
                    >
                      <div className="flex-grow min-w-0 border-l-4 border-indigo-600 pl-3">
                        <p className="text-[9px] font-black uppercase text-indigo-600">Replying to {replyingTo.senderType === "admin" ? "Support" : replyingTo.senderType === "ai" ? "AI" : "Self"}</p>
                        <p className="text-[11px] text-gray-500 truncate">{replyingTo.text || "Product Card"}</p>
                      </div>
                      <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {showProductPicker && (
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    className="absolute bottom-full left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto p-2 grid grid-cols-2 gap-2 z-20"
                  >
                    <div className="col-span-2 p-2 flex justify-between items-center border-b border-gray-50 dark:border-gray-800">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Share Product</span>
                      <button onClick={() => setShowProductPicker(false)}><X className="w-3 h-3 text-gray-400" /></button>
                    </div>
                    {products.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => sendMessage(undefined, { id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl })}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                      >
                        <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        <span className="text-[10px] font-bold dark:text-white truncate text-left">{p.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}

                {cartItems && cartItems.length > 0 && (
                  <div className="mx-4 mt-2 mb-0 p-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl flex items-center justify-between gap-2 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[10px] font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">Your Active Cart</h4>
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-bold truncate">
                          {cartItems.length} item{cartItems.length > 1 ? "s" : ""} in hand
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cartStr = `Here is my current shopping cart details 🛒:\n` + 
                          cartItems.map((item: any) => `- **${item.name}** (Quantity: ${item.quantity || 1}x, Price: ৳${item.price})`).join("\n") + 
                          `\nTotal Cart Value: ৳${cartItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0)}.\n\nPlease review my cart, recommend if anything else matches, tell me why these are excellent choices, offer expert sales advice, and guide me to complete the purchase!`;
                        sendMessage(undefined, undefined, cartStr);
                      }}
                      className="p-1.5 px-3 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-md shadow-indigo-100 dark:shadow-none whitespace-nowrap cursor-pointer"
                    >
                      Share with AI 🚀
                    </button>
                  </div>
                )}

                <form 
                  onSubmit={sendMessage}
                  className="p-4"
                >
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 pl-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-inner">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={siteSettings?.chatInputPlaceholder || "Ask the AI or Support..."}
                      className="flex-grow bg-transparent border-none focus:ring-0 text-sm py-1 dark:text-white"
                    />
                    <div className="flex items-center gap-1 pr-1">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileUpload} 
                      />
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-all"
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setShowProductPicker(!showProductPicker)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          showProductPicker ? "bg-indigo-100 text-indigo-600" : "text-gray-400 hover:text-indigo-600"
                        )}
                        title="Show Product"
                      >
                         <Plus className="w-4 h-4" />
                      </button>
                      <button 
                        type="submit"
                        disabled={!inputText.trim()}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50"
                        id="send-message-btn"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
            
            {/* Branding */}
            <div className="py-2 px-4 bg-white dark:bg-gray-900 text-center border-t border-gray-100 dark:border-gray-800">
               <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">
                 {siteSettings?.chatPoweredByText || "Powered by Gemini AI"}
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guest Form Modal */}
      <AnimatePresence>
        {isGuestFormOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800"
            >
              <h3 className="text-2xl font-black italic mb-2 dark:text-white uppercase tracking-tighter">Identity Required</h3>
              <p className="text-sm text-gray-500 mb-6 font-medium">Please provide your details to connect with support.</p>
              
              <form onSubmit={(e) => { e.preventDefault(); handleStartChat(); }} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Full Name</label>
                  <input
                    required
                    type="text"
                    onChange={(e) => setGuestInfo(prev => ({ ...prev!, name: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-600 transition-all dark:text-white"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
                  <input
                    required
                    type="email"
                    onChange={(e) => setGuestInfo(prev => ({ ...prev!, email: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-600 transition-all dark:text-white"
                    placeholder="Enter your email"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsGuestFormOpen(false)}
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-bold text-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 dark:shadow-none inline-flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Chat"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
