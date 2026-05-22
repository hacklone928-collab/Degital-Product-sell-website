import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  where,
  deleteDoc,
  getDocs,
  getDoc,
  Timestamp,
  increment
} from "firebase/firestore";
import { 
  Search, 
  Pin, 
  Trash2, 
  CheckCircle, 
  Ban, 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Clock, 
  MoreVertical,
  ChevronLeft,
  ShoppingBag,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  CheckCheck,
  Check,
  Plus,
  X,
  Sparkles,
  Settings,
  ShieldCheck,
  Info,
  MapPin,
  FileText,
  Link as LinkIcon,
  Layout,
  Headphones,
  MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface ChatSession {
  id: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  status: "open" | "solved" | "blocked";
  lastMessage?: string;
  lastTimestamp?: Timestamp;
  aiEnabled: boolean;
  adminId?: string | null;
  unreadCount?: number;
  isPinned?: boolean;
  isArchived?: boolean;
  typingStatus?: Record<string, boolean>;
}

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

export default function AdminChatPanel() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "open" | "solved" | "pinned" | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [customerIsTyping, setCustomerIsTyping] = useState(false);
  const [innerSearchTerm, setInnerSearchTerm] = useState("");
  const [isInnerSearching, setIsInnerSearching] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatSettings, setChatSettings] = useState<any>({
    chatHeaderTitle: "",
    chatHeaderSubtitle: "",
    chatAiSystemPrompt: "",
    chatWelcomeMessage: "",
    chatOfflineMessage: "",
    chatInputPlaceholder: "",
    chatPoweredByText: "",
    geminiApiKeys: [] as string[],
    iconType: "message-circle",
    iconSize: 48,
    desktopBottom: 32,
    desktopRight: 32,
    mobileBottom: 24,
    mobileRight: 24,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Site Settings and Products
  useEffect(() => {
    getDoc(doc(db, "settings", "site")).then(snap => {
      if (snap.exists()) setChatSettings(snap.data());
    });
    getDocs(collection(db, "products")).then(snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Responsive sidebar handling
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowSidebar(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When selection happens on mobile, hide sidebar
  useEffect(() => {
    if (selectedSessionId && window.innerWidth < 768) {
      setShowSidebar(false);
    }
  }, [selectedSessionId]);
  const [showOrdersPanel, setShowOrdersPanel] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  // Load user orders when session changes
  useEffect(() => {
    if (selectedSession?.userEmail) {
      const q = query(
        collection(db, "orders"),
        where("email", "==", selectedSession.userEmail),
        orderBy("createdAt", "desc")
      );
      const unsubscribe = onSnapshot(q, (snap) => {
        setUserOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return unsubscribe;
    } else {
      setUserOrders([]);
    }
  }, [selectedSessionId, selectedSession?.userEmail]);

  const updateOrderStatus = async (orderId: string, status: string, location: string, note: string) => {
    setUpdatingOrderId(orderId);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status,
        currentLocation: location,
        trackingNote: note,
        updatedAt: serverTimestamp()
      });
      alert("Order updated successfully!");
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const saveSettings = async () => {
    await updateDoc(doc(db, "settings", "site"), chatSettings);
    setShowSettings(false);
    alert("Chat settings saved!");
  };

  const getAiSuggestions = async () => {
    if (!selectedSessionId || messages.length === 0) return;
    setIsGeneratingSuggestions(true);
    try {
      const lastUserMsg = [...messages].reverse().find(m => m.senderType === "user")?.text;
      const res = await fetch("/api/chat/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId: selectedSessionId, 
          lastUserMessage: lastUserMsg || "",
          history: messages.slice(-10)
        })
      });
      const data = await res.json();
      if (data.suggestions) setAiSuggestions(data.suggestions);
    } catch (err) {
      console.error("Suggestions failed:", err);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const useSuggestion = (text: string) => {
    setInputText(text);
    setAiSuggestions([]);
  };

  const toggleBlock = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "blocked" ? "open" : "blocked";
    await updateDoc(doc(db, "chat_sessions", id), { status: newStatus });
  };

  const pinMessage = async (msgId: string) => {
    if (!selectedSessionId) return;
    await updateDoc(doc(db, "chat_sessions", selectedSessionId), { pinnedMessageId: msgId });
  };

  const forwardMessage = (text: string) => {
    setInputText(prev => prev + (prev ? " " : "") + text);
  };

  // Presence/Typing Logic for Admin
  useEffect(() => {
    if (!selectedSessionId) return;
    const typingDoc = doc(db, "chat_sessions", selectedSessionId);
    
    updateDoc(typingDoc, {
      [`typingStatus.${auth.currentUser?.uid}`]: inputText.length > 0
    });

    const timeout = setTimeout(() => {
      updateDoc(typingDoc, {
        [`typingStatus.${auth.currentUser?.uid}`]: false
      });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [inputText, selectedSessionId]);

  // Listen for customer typing
  useEffect(() => {
    if (!selectedSession?.typingStatus) return;
    const typingStates = selectedSession.typingStatus;
    const customerTyping = Object.entries(typingStates).some(([uid, isTyping]) => uid !== auth.currentUser?.uid && isTyping);
    setCustomerIsTyping(customerTyping);
  }, [selectedSession?.typingStatus]);

  // Listen to sessions
  useEffect(() => {
    const q = query(collection(db, "chat_sessions"), orderBy("lastTimestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
      setSessions(data);
      if (!selectedSessionId && data.length > 0) {
        setSelectedSessionId(data[0].id);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Listen to messages of selected session
  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      setReplyingTo(null);
      return;
    }

    const q = query(
      collection(db, "chat_messages"),
      where("sessionId", "==", selectedSessionId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Use serverTimestamps: 'estimate' so local writes have temporary dates instead of null
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data({ serverTimestamps: 'estimate' }) 
      } as Message));

      // Client-side sort guarantees chronological order under all networking and synchronization delays
      const sortedData = [...data].sort((a, b) => getMessageTime(a.createdAt) - getMessageTime(b.createdAt));
      setMessages(sortedData);
      
      // Mark as seen
      snapshot.docs.forEach(async (d) => {
        if (d.data().senderType === "user" && !d.data().seen) {
          await updateDoc(doc(db, "chat_messages", d.id), { seen: true });
        }
      });

      // Clear unread count
      updateDoc(doc(db, "chat_sessions", selectedSessionId), { unreadCount: 0 });
    });

    return unsubscribe;
  }, [selectedSessionId]);

  // Load products for sharing
  useEffect(() => {
    getDocs(collection(db, "products")).then(snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedSessionId) return;

    const text = inputText;
    const currentReplyTo = replyingTo;
    
    setInputText("");
    setReplyingTo(null);

    try {
      await addDoc(collection(db, "chat_messages"), {
        sessionId: selectedSessionId,
        senderId: auth.currentUser?.uid,
        senderType: "admin",
        text,
        replyTo: currentReplyTo ? {
          id: currentReplyTo.id,
          text: currentReplyTo.text || (currentReplyTo.productCard ? `Product: ${currentReplyTo.productCard.name}` : "Media"),
          senderType: currentReplyTo.senderType
        } : null,
        createdAt: serverTimestamp(),
        seen: false
      });

      await updateDoc(doc(db, "chat_sessions", selectedSessionId), {
        lastMessage: text,
        lastTimestamp: serverTimestamp(),
        adminId: auth.currentUser?.uid,
        aiEnabled: false // Pause AI when admin replies
      });
    } catch (err) {
      console.error("Failed to send admin message:", err);
    }
  };

  const toggleAI = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "chat_sessions", id), { aiEnabled: !current });
  };

  const markSolved = async (id: string) => {
    await updateDoc(doc(db, "chat_sessions", id), { status: "solved" });
  };

  const togglePin = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "chat_sessions", id), { isPinned: !current });
  };

  const toggleArchive = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "chat_sessions", id), { isArchived: !current });
  };

  const deleteMessage = async (msgId: string) => {
    await updateDoc(doc(db, "chat_messages", msgId), { isDeleted: true, text: "Message deleted by admin" });
  };

  const deleteSession = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this conversation?")) {
      await deleteDoc(doc(db, "chat_sessions", id));
      // Also delete messages
      const msgs = await getDocs(query(collection(db, "chat_messages"), where("sessionId", "==", id)));
      msgs.docs.forEach(d => deleteDoc(d.ref));
      if (selectedSessionId === id) setSelectedSessionId(null);
    }
  };

  const shareProduct = async (product: any) => {
    if (!selectedSessionId) return;

    try {
      await addDoc(collection(db, "chat_messages"), {
        sessionId: selectedSessionId,
        senderId: auth.currentUser?.uid,
        senderType: "admin",
        productCard: {
          id: product.id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl
        },
        createdAt: serverTimestamp(),
        seen: false
      });

      await updateDoc(doc(db, "chat_sessions", selectedSessionId), {
        lastMessage: `Shared Product: ${product.name}`,
        lastTimestamp: serverTimestamp(),
        aiEnabled: false
      });
      setShowProductPicker(false);
    } catch (err) {
      console.error("Failed to share product:", err);
    }
  };

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = s.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterMode === "open") return s.status === "open" && !s.isArchived;
    if (filterMode === "solved") return s.status === "solved" && !s.isArchived;
    if (filterMode === "pinned") return s.isPinned;
    if (filterMode === "archived") return s.isArchived;
    
    return !s.isArchived; // "all" but not archived by default
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSessionId) return;

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await addDoc(collection(db, "chat_messages"), {
          sessionId: selectedSessionId,
          senderId: auth.currentUser?.uid,
          senderType: "admin",
          imageUrl: base64,
          createdAt: serverTimestamp(),
          seen: false
        });
        await updateDoc(doc(db, "chat_sessions", selectedSessionId), {
          lastMessage: "📷 Sent an image",
          lastTimestamp: serverTimestamp(),
          aiEnabled: false
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  const reactToMessage = async (msgId: string, emoji: string) => {
    try {
      const msgRef = doc(db, "chat_messages", msgId);
      const msgSnap = await getDoc(msgRef); // Need to import getDoc
      if (!msgSnap.exists()) return;
      const reactions = msgSnap.data().reactions || {};
      const userId = auth.currentUser?.uid;
      if (!reactions[emoji]) reactions[emoji] = [];
      if (reactions[emoji].includes(userId)) {
        reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
      } else {
        reactions[emoji].push(userId);
      }
      await updateDoc(msgRef, { reactions });
    } catch (err) {
      console.error("Reaction failed:", err);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] bg-white dark:bg-gray-900 md:rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-xl w-full">
      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50/50 dark:bg-gray-950/20 transition-all z-20",
        !showSidebar && "hidden md:flex"
      )}>
        <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black italic uppercase tracking-tighter dark:text-white">Conversations</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-400 hover:text-indigo-600 transition-all"
                title="System Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 transition-all dark:text-white"
            />
          </div>
          
          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar items-center">
            {["all", "open", "solved", "pinned", "archived"].map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  filterMode === mode 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none" 
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-8 h-8 text-gray-200 dark:text-gray-800 mx-auto mb-3" />
              <p className="text-xs text-gray-400 italic">No {filterMode !== "all" ? filterMode : ""} conversations found.</p>
            </div>
          ) : (
            filteredSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className={cn(
                  "w-full p-4 rounded-2xl flex items-start gap-3 transition-all text-left relative group",
                  selectedSessionId === s.id 
                    ? "bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700" 
                    : "hover:bg-white dark:hover:bg-gray-800"
                )}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center font-bold text-indigo-600">
                    {s.userName.charAt(0)}
                  </div>
                  {s.unreadCount ? (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-black animate-bounce shadow-lg">
                      {s.unreadCount}
                    </span>
                  ) : null}
                  {s.isPinned && (
                    <div className="absolute -bottom-1 -right-1 p-1 bg-white dark:bg-gray-800 rounded-full shadow-sm text-indigo-600">
                      <Pin className="w-2.5 h-2.5 fill-current" />
                    </div>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm truncate dark:text-white">{s.userName || "Guest"}</h4>
                    <span className="text-[9px] font-bold text-gray-400 whitespace-nowrap">
                      {s.lastTimestamp?.toDate ? new Date(s.lastTimestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (s.lastTimestamp ? new Date(s.lastTimestamp.seconds ? s.lastTimestamp.seconds * 1000 : s.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "")}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5 font-medium">
                    {s.lastMessage || "New conversation started"}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {s.aiEnabled && (
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                        <Bot className="w-2.5 h-2.5" /> AI Active
                      </span>
                    )}
                    {s.status === "open" ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                        Live
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 dark:bg-gray-900/40 px-2 py-0.5 rounded-full">
                        {s.status}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-grow flex flex-col bg-gray-50 dark:bg-gray-950 transition-all relative overflow-hidden",
        showSidebar && "hidden md:flex"
      )}>
        {selectedSession ? (
          <>
            {/* Header */}
            <div className="p-4 md:p-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-sm z-30">
              <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                <button 
                  onClick={() => setShowSidebar(true)}
                  className="md:hidden p-2 -ml-2 text-gray-400 hover:text-indigo-600"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg md:text-xl italic flex-shrink-0">
                  {selectedSession.userName.charAt(0)}
                </div>
                <div className="truncate">
                  <h3 className="font-black text-sm md:text-lg dark:text-white italic tracking-tight truncate">{selectedSession.userName}</h3>
                  <p className="text-[10px] md:text-xs text-gray-500 truncate">{selectedSession.userEmail}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 md:gap-2">
                <div className="hidden lg:flex items-center gap-1">
                  <button
                    onClick={() => togglePin(selectedSession.id, !!selectedSession.isPinned)}
                    className={cn(
                      "p-2 rounded-lg border transition-all",
                      selectedSession.isPinned 
                        ? "bg-amber-50 text-amber-600 border-amber-200" 
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 border-transparent hover:bg-gray-200"
                    )}
                    title="Pin"
                  >
                    <Pin className={cn("w-3.5 h-3.5", selectedSession.isPinned && "fill-current")} />
                  </button>
                  <button
                    onClick={() => toggleAI(selectedSession.id, selectedSession.aiEnabled)}
                    className={cn(
                      "p-2 rounded-lg border transition-all",
                      selectedSession.aiEnabled 
                        ? "bg-indigo-50 text-indigo-600 border-indigo-200" 
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 border-transparent hover:bg-gray-200"
                    )}
                    title="Toggle AI"
                  >
                    <Bot className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowOrdersPanel(!showOrdersPanel)}
                    className={cn(
                      "p-2 px-3 rounded-lg border transition-all flex items-center gap-2 text-[10px] font-black uppercase",
                      showOrdersPanel 
                        ? "bg-indigo-600 text-white border-indigo-700" 
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-200"
                    )}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{userOrders.length} Orders</span>
                  </button>
                  
                  <div className="relative group">
                    <button className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 hidden group-hover:block z-50">
                      <button onClick={() => markSolved(selectedSession.id)} className="w-full flex items-center gap-3 p-2.5 text-xs font-bold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-all">
                        <CheckCircle className="w-4 h-4" /> Resolve Chat
                      </button>
                      <button onClick={() => toggleArchive(selectedSession.id, !!selectedSession.isArchived)} className="w-full flex items-center gap-3 p-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all">
                        <User className="w-4 h-4" /> {selectedSession.isArchived ? "Unarchive" : "Archive"}
                      </button>
                      <button onClick={() => toggleBlock(selectedSession.id, selectedSession.status)} className="w-full flex items-center gap-3 p-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                        <Ban className="w-4 h-4" /> {selectedSession.status === 'blocked' ? 'Unblock User' : 'Block User'}
                      </button>
                      <div className="h-px bg-gray-100 dark:bg-gray-700 my-2" />
                      <button onClick={() => deleteSession(selectedSession.id)} className="w-full flex items-center gap-3 p-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                        <Trash2 className="w-4 h-4" /> Delete Conversation
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Inner Chat Search / Suggestions Bar */}
            <div className="bg-white dark:bg-gray-900 px-6 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
              <div className="flex-grow flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <input 
                  type="text" 
                  value={innerSearchTerm}
                  onChange={(e) => setInnerSearchTerm(e.target.value)}
                  placeholder="Search in this chat..."
                  className="bg-transparent border-none focus:ring-0 text-xs w-full dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={getAiSuggestions}
                  disabled={isGeneratingSuggestions}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg text-[10px] font-black uppercase transition-all"
                >
                  <Sparkles className={cn("w-3 h-3", isGeneratingSuggestions && "animate-spin")} />
                  {isGeneratingSuggestions ? "Thinking..." : "Get Suggested Replies"}
                </button>
              </div>
            </div>

            {/* Suggestions Display */}
            <AnimatePresence>
              {aiSuggestions.length > 0 && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-purple-600 p-2 overflow-hidden flex flex-wrap gap-2 justify-center"
                >
                  {aiSuggestions.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => useSuggestion(s)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] rounded-lg font-medium transition-all"
                    >
                      {s}
                    </button>
                  ))}
                  <button onClick={() => setAiSuggestions([])} className="p-1.5 text-white/50 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth custom-scrollbar">
              {messages.filter(m => !innerSearchTerm || (m.text && m.text.toLowerCase().includes(innerSearchTerm.toLowerCase()))).map((msg, idx) => {
                const isAdmin = msg.senderType === "admin";
                const isAI = msg.senderType === "ai";
                
                return (
                  <div key={msg.id} className={cn("flex flex-col w-full", isAdmin ? "items-end" : "items-start")}>
                    <div className={cn(
                      "flex items-end gap-3 max-w-[80%] group relative",
                      isAdmin ? "flex-row-reverse" : "flex-row"
                    )}>
                      {/* Avatar */}
                      {!isAdmin ? (
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mb-1 border shadow-sm",
                          isAI 
                            ? "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-600" 
                            : "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 font-bold"
                        )}>
                          {isAI ? <Bot className="w-5 h-5" /> : selectedSession.userName.charAt(0)}
                        </div>
                      ) : (
                        <div className="w-2" />
                      )}

                      <motion.div
                        id={`admin-msg-${msg.id}`}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        onDoubleClick={() => setReplyingTo(msg)}
                        className={cn(
                          "flex flex-col relative",
                          isAdmin ? "items-end" : "items-start"
                        )}
                      >
                        {/* Sender Label */}
                        <div className={cn(
                          "flex items-center gap-2 mb-1 px-1",
                          isAdmin ? "flex-row-reverse" : "flex-row"
                        )}>
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            {isAI ? "Assistant" : isAdmin ? "You" : selectedSession.userName}
                          </span>
                          <span className="text-[9px] text-gray-300">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              {msg.seen ? (
                                <>
                                  <span className="text-[8px] font-black uppercase text-indigo-400">Seen</span>
                                  <CheckCheck className="w-2.5 h-2.5 text-indigo-400" />
                                </>
                              ) : (
                                <>
                                  <span className="text-[8px] font-black uppercase text-gray-300">Sent</span>
                                  <Check className="w-2.5 h-2.5 text-gray-300" />
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="relative group w-full flex flex-col items-start">
                          {/* Message Actions */}
                          <div className={cn(
                            "absolute top-0 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 z-10",
                            isAdmin ? "-left-28" : "-right-28"
                          )}>
                            <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:text-indigo-600" title="Reply">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => pinMessage(msg.id)} className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:text-amber-500" title="Pin">
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => forwardMessage(msg.text || "")} className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:text-green-500" title="Forward">
                              <ShoppingBag className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button onClick={() => deleteMessage(msg.id)} className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:text-red-500" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Reply To Thread */}
                          {msg.replyTo && (
                            <div className={cn(
                              "mb-1 p-2.5 rounded-2xl text-[10px] border-l-4 max-w-[240px] bg-black/5 dark:bg-white/5 opacity-80",
                              isAdmin ? "mr-1 border-indigo-400" : "ml-1 border-gray-400"
                            )}>
                              <p className="font-black uppercase text-[8px] opacity-60 mb-1 flex items-center gap-1">
                                Replying to {msg.replyTo.senderType === "admin" ? "You" : msg.replyTo.senderType === "ai" ? "Assistant" : selectedSession.userName}
                              </p>
                              <p className="line-clamp-2 italic text-gray-600 dark:text-gray-400">{msg.replyTo.text}</p>
                            </div>
                          )}

                          {msg.productCard ? (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl border border-gray-100 dark:border-gray-700 w-[280px]">
                              <img src={msg.productCard.imageUrl} alt="" className="w-full h-32 object-cover rounded-xl mb-3" />
                              <h5 className="font-bold text-sm dark:text-white italic">{msg.productCard.name}</h5>
                              <p className="text-indigo-600 font-bold mt-1">${msg.productCard.price}</p>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <a 
                                  href={`/product/${msg.productCard.id}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 rounded-lg text-[10px] font-bold hover:bg-gray-200 transition-all"
                                >
                                  Details
                                </a>
                                <a 
                                  href={`/product/${msg.productCard.id}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                                >
                                  Buy
                                </a>
                              </div>
                            </div>
                          ) : msg.imageUrl ? (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                              <img src={msg.imageUrl} alt="" className="max-w-[300px] rounded-xl max-h-80 object-contain" />
                            </div>
                          ) : (
                            <motion.div 
                              drag="x"
                              dragConstraints={{ left: 0, right: 0 }}
                              dragElastic={0.4}
                              onDragEnd={(_, info) => {
                                if (Math.abs(info.offset.x) > 50) {
                                  setReplyingTo(msg);
                                }
                              }}
                              className={cn(
                              "p-3.5 px-4 rounded-2xl text-[14px] leading-relaxed relative shadow-sm",
                              msg.isDeleted ? "italic opacity-50 bg-gray-100 dark:bg-gray-800" :
                              isAdmin 
                                ? "bg-indigo-600 text-white rounded-tr-[4px]" 
                                : isAI
                                  ? "bg-purple-50 dark:bg-purple-900/10 text-purple-900 dark:text-purple-100 border border-purple-100 dark:border-purple-800 rounded-tl-[4px] font-medium"
                                  : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-[4px] border border-gray-100 dark:border-gray-700 shadow-sm"
                            )}>
                              {msg.text}

                              {/* Reactions Display */}
                              {msg.reactions && Object.keys(msg.reactions).some(e => msg.reactions[e].length > 0) && (
                                <div className={cn(
                                  "absolute -bottom-3 flex gap-1",
                                  isAdmin ? "right-2" : "left-2"
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
                        </div>
                      </motion.div>
                    </div>
                  </div>
                );
              })}

              {/* Customer Typing Indicator */}
              {customerIsTyping && (
                <div className="flex items-end gap-3 max-w-[75%]">
                   <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center flex-shrink-0 animate-pulse border border-indigo-100 dark:border-indigo-900/20">
                    <User className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl rounded-tl-[4px] border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
                    <div className="flex gap-1.5 px-1">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 relative shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
              <AnimatePresence>
                {replyingTo && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 right-0 p-3 md:p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 z-40 shadow-lg"
                  >
                    <div className="flex-grow min-w-0 border-l-4 border-indigo-600 pl-3">
                      <p className="text-[10px] font-black uppercase text-indigo-600 mb-0.5">
                        Replying to {replyingTo.senderType === "admin" ? "You" : 
                                    replyingTo.senderType === "ai" ? "AI Bot" : 
                                    selectedSession?.userName || "User"}
                      </p>
                      <p className="text-xs text-gray-500 truncate font-medium">{replyingTo.text || "Media Attachment"}</p>
                    </div>
                    <button 
                      onClick={() => setReplyingTo(null)}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {showProductPicker && (
                <div className="absolute bottom-full left-4 md:left-6 mb-4 w-[calc(100%-2rem)] md:w-[360px] max-h-[400px] bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col z-[100] animate-in slide-in-from-bottom-2">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                    <h5 className="font-black italic uppercase tracking-tighter text-xs dark:text-white">Select Product to Share</h5>
                    <button onClick={() => setShowProductPicker(false)} className="text-gray-400 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex-grow overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {products.map(p => (
                      <button
                        key={p.id}
                        onClick={() => shareProduct(p)}
                        className="w-full p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 flex items-center gap-3 rounded-2xl transition-all group"
                      >
                        <img src={p.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform" />
                        <div className="text-left">
                          <p className="font-bold text-xs dark:text-white italic">{p.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">৳{p.price.toLocaleString()}</p>
                        </div>
                        <Plus className="w-4 h-4 ml-auto text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-end gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={() => setShowProductPicker(!showProductPicker)}
                  className={cn(
                    "p-3.5 md:p-4 rounded-2xl transition-all flex flex-col items-center gap-1 shrink-0",
                    showProductPicker ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-indigo-600"
                  )}
                  title="Share Product"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span className="text-[8px] font-black uppercase hidden sm:block">Share</span>
                </button>
                <div className="flex flex-col gap-1">
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
                    className="p-3.5 md:p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-indigo-600 transition-all flex flex-col items-center gap-1 shrink-0"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase hidden sm:block">Image</span>
                  </button>
                </div>
                <div className="flex-grow relative">
                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl md:rounded-3xl p-4 md:p-5 pr-14 md:pr-16 text-sm focus:ring-2 focus:ring-indigo-600 transition-all dark:text-white resize-none max-h-32"
                  />
                  <button
                    disabled={!inputText.trim()}
                    className="absolute right-2.5 bottom-2.5 p-2.5 md:p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl md:rounded-2xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
              <div className="hidden md:block mt-3 text-[8px] text-gray-400 uppercase font-black tracking-widest text-center opacity-60">
                AI replies are paused while you are active in this chat · Press ENTER to send
              </div>
            </div>
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-20 text-center opacity-40">
            <div className="w-32 h-32 bg-gray-200 dark:bg-gray-800 rounded-[40px] flex items-center justify-center mb-8 rotate-3 transition-transform hover:rotate-0">
               <MessageSquare className="w-16 h-16 text-gray-400" />
            </div>
            <h3 className="text-3xl font-black italic uppercase tracking-tight mb-2 dark:text-white">Admin View Center</h3>
            <p className="text-sm dark:text-gray-400 max-w-xs font-medium">Select a conversation from the sidebar to start providing world-class support.</p>
          </div>
        )}
      </div>

      {/* Orders Panel (Right Sidebar) */}
      <AnimatePresence>
        {showOrdersPanel && selectedSession && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-80 lg:w-96 md:relative border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col h-full overflow-hidden shadow-2xl z-50"
          >
            <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-950/20">
              <div>
                <h3 className="text-xs md:text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-indigo-600" /> Customer Orders
                </h3>
                <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Session Insights</p>
              </div>
              <button 
                onClick={() => setShowOrdersPanel(false)}
                className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {userOrders.length === 0 ? (
                <div className="text-center py-20 opacity-30 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-[24px] flex items-center justify-center rotate-6">
                    <ShoppingBag className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">No orders found for this email</p>
                </div>
              ) : (
                userOrders.map(order => (
                  <div key={order.id} className="p-4 bg-white dark:bg-gray-800 rounded-[24px] border border-gray-100 dark:border-gray-700 shadow-sm space-y-4 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[9px] font-mono font-black text-indigo-500 uppercase tracking-tighter">#{order.id.slice(-8).toUpperCase()}</div>
                        <div className="text-[11px] font-bold text-gray-900 dark:text-white mt-1 leading-tight">{order.productName}</div>
                      </div>
                      <div className={cn(
                        "text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border",
                        order.status === "completed" || order.status === "delivered" 
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800" 
                          : "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800"
                      )}>
                        {order.status}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                      {/* Status Update */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                          <CheckCircle className="w-2.5 h-2.5" /> Order Status
                        </label>
                        <select 
                          className="w-full text-xs font-bold bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-600 transition-all dark:text-white appearance-none cursor-pointer"
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value, order.currentLocation || "", order.trackingNote || "")}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>

                      {/* Location Update */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                          <MapPin className="w-2.5 h-2.5" /> Live Location (For AI)
                        </label>
                        <input 
                          type="text"
                          placeholder="e.g. Dhaka Hub"
                          className="w-full text-xs font-bold bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-600 transition-all dark:text-white"
                          defaultValue={order.currentLocation || ""}
                          onBlur={(e) => {
                            if (e.target.value !== order.currentLocation) {
                              updateOrderStatus(order.id, order.status, e.target.value, order.trackingNote || "");
                            }
                          }}
                        />
                      </div>

                      {/* Tracking Note */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                          <FileText className="w-2.5 h-2.5" /> Internal Notes
                        </label>
                        <textarea 
                          placeholder="Additional info for AI to use..."
                          className="w-full text-[11px] font-medium bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-600 transition-all dark:text-white min-h-[70px] resize-none"
                          defaultValue={order.trackingNote || ""}
                          onBlur={(e) => {
                            if (e.target.value !== order.trackingNote) {
                              updateOrderStatus(order.id, order.status, order.currentLocation || "", e.target.value);
                            }
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1 opacity-60">
                        <span className="text-xs font-black text-indigo-600">৳{order.amount.toLocaleString()}</span>
                        <div className="text-[9px] font-bold text-gray-400">
                          {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleDateString() : (order.createdAt ? new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleDateString() : "")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800"
            >
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-950/40">
                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter dark:text-white">Chat System Configuration</h3>
                  <p className="text-sm text-gray-500 font-medium">Fine-tune the AI bot and customer interface</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-all">
                  <X className="w-5 h-5 dark:text-white" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-8 space-y-8">
                {/* Visual Settings */}
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-4 flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" /> UI Appearance
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Header Title</label>
                      <input 
                        type="text" 
                        value={chatSettings.chatHeaderTitle}
                        onChange={(e) => setChatSettings({...chatSettings, chatHeaderTitle: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-xs dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Header Subtitle</label>
                      <input 
                        type="text" 
                        value={chatSettings.chatHeaderSubtitle}
                        onChange={(e) => setChatSettings({...chatSettings, chatHeaderSubtitle: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-xs dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Input Placeholder</label>
                      <input 
                        type="text" 
                        value={chatSettings.chatInputPlaceholder}
                        onChange={(e) => setChatSettings({...chatSettings, chatInputPlaceholder: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-xs dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Branding Text</label>
                      <input 
                        type="text" 
                        value={chatSettings.chatPoweredByText}
                        onChange={(e) => setChatSettings({...chatSettings, chatPoweredByText: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-xs dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all font-medium"
                      />
                    </div>
                  </div>
                </section>

                {/* Floating Icon & Layout */}
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-4 flex items-center gap-2">
                    <Layout className="w-3 h-3" /> Floating Icon & Layout
                  </h4>
                  <div className="space-y-6">
                    {/* Icon Selection */}
                    <div className="grid grid-cols-4 gap-3">
                      {['message-circle', 'message-square', 'headphones', 'sparkles'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setChatSettings({...chatSettings, iconType: type})}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                            chatSettings.iconType === type 
                              ? "bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-100" 
                              : "bg-gray-50 dark:bg-gray-800 border-transparent text-gray-500 hover:bg-gray-100"
                          )}
                        >
                          {type === 'message-circle' && <MessageCircle className="w-6 h-6" />}
                          {type === 'message-square' && <MessageSquare className="w-6 h-6" />}
                          {type === 'headphones' && <Headphones className="w-6 h-6" />}
                          {type === 'sparkles' && <Sparkles className="w-6 h-6" />}
                          <span className="text-[8px] font-black uppercase">{type.replace('-', ' ')}</span>
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      {/* Desktop Control */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-indigo-400 flex items-center gap-2">
                           Desktop Position (px)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400">Bottom</label>
                            <input 
                              type="number" 
                              value={chatSettings.desktopBottom}
                              onChange={(e) => setChatSettings({...chatSettings, desktopBottom: parseInt(e.target.value) || 0})}
                              className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs dark:text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400">Right</label>
                            <input 
                              type="number" 
                              value={chatSettings.desktopRight}
                              onChange={(e) => setChatSettings({...chatSettings, desktopRight: parseInt(e.target.value) || 0})}
                              className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs dark:text-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Mobile Control */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-rose-400 flex items-center gap-2">
                           Mobile Position (px)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400">Bottom</label>
                            <input 
                              type="number" 
                              value={chatSettings.mobileBottom}
                              onChange={(e) => setChatSettings({...chatSettings, mobileBottom: parseInt(e.target.value) || 0})}
                              className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs dark:text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400">Right</label>
                            <input 
                              type="number" 
                              value={chatSettings.mobileRight}
                              onChange={(e) => setChatSettings({...chatSettings, mobileRight: parseInt(e.target.value) || 0})}
                              className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Size Control */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Icon Size ({chatSettings.iconSize}px)</label>
                      </div>
                      <input 
                        type="range"
                        min="32"
                        max="80"
                        value={chatSettings.iconSize}
                        onChange={(e) => setChatSettings({...chatSettings, iconSize: parseInt(e.target.value)})}
                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  </div>
                </section>

                {/* AI Persona & Keys */}
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-4 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> AI Sales Agent & Keys
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">AI System Prompt (Training Data)</label>
                      <textarea 
                        rows={6}
                        value={chatSettings.chatAiSystemPrompt}
                        onChange={(e) => setChatSettings({...chatSettings, chatAiSystemPrompt: e.target.value})}
                        placeholder="e.g. Always mention current 20% discount. If asked about shipping, say standard takes 3 days..."
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-xs dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all font-medium resize-none shadow-inner"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest"> Gemini API Keys & Real-time Usage</label>
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                          {chatSettings.geminiApiKeys?.length || 0} Total Keys
                        </span>
                      </div>
                      
                      {/* Key List with Monitoring */}
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {chatSettings.geminiApiKeys?.map((apiKeyObj: any, idx: number) => {
                          // Handle legacy string keys gracefully
                          const keyData = typeof apiKeyObj === 'string' ? { key: apiKeyObj, usageCount: 0, status: 'active' } : apiKeyObj;
                          
                          return (
                            <div key={idx} className="group flex flex-col gap-2 p-3 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl transition-all hover:shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  keyData.status === 'error' ? "bg-red-500 animate-pulse" : "bg-green-500"
                                )} />
                                <input 
                                  type="password"
                                  readOnly
                                  value={keyData.key}
                                  className="flex-1 bg-transparent border-none p-0 text-[10px] font-mono opacity-40 focus:ring-0"
                                />
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Usage</p>
                                    <p className="text-[10px] font-bold dark:text-white">{keyData.usageCount || 0}</p>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      const newKeys = [...chatSettings.geminiApiKeys];
                                      newKeys.splice(idx, 1);
                                      setChatSettings({...chatSettings, geminiApiKeys: newKeys});
                                    }}
                                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {keyData.lastUsed && (
                                <div className="flex items-center justify-between px-5">
                                  <p className="text-[8px] text-gray-400 italic">
                                    Last pulse: {(keyData.lastUsed as any).toDate ? (keyData.lastUsed as any).toDate().toLocaleString() : new Date(keyData.lastUsed).toLocaleString()}
                                  </p>
                                  {keyData.status === 'error' && (
                                    <p className="text-[8px] text-red-500 font-bold uppercase tracking-tighter">Rate Limited or Invalid</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {(!chatSettings.geminiApiKeys || chatSettings.geminiApiKeys.length === 0) && (
                          <div className="text-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                             <Sparkles className="w-6 h-6 text-gray-200 dark:text-gray-800 mx-auto mb-2" />
                             <p className="text-[10px] text-gray-400 italic">No keys added yet. Add keys below to enable AI.</p>
                          </div>
                        )}
                      </div>

                      {/* Bulk Add UI */}
                      <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-800">
                        <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2 block">Bulk Add Keys (One per line or comma separated)</label>
                        <textarea 
                          id="bulk-keys-input"
                          rows={3}
                          placeholder="PASTE MULTIPLE KEYS HERE..."
                          className="w-full bg-white dark:bg-gray-900 border-none rounded-xl p-3 text-[10px] font-mono dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all resize-none shadow-sm placeholder:opacity-30"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              const val = (e.target as HTMLTextAreaElement).value.trim();
                              if (val) {
                                const splitKeys = val.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 20);
                                if (splitKeys.length > 0) {
                                  const newKeys = splitKeys.map(k => ({
                                    key: k,
                                    usageCount: 0,
                                    status: 'active',
                                    addedAt: new Date().toISOString()
                                  }));
                                  
                                  setChatSettings({
                                    ...chatSettings, 
                                    geminiApiKeys: [...(chatSettings.geminiApiKeys || []), ...newKeys]
                                  });
                                  (e.target as HTMLTextAreaElement).value = '';
                                  alert(`${newKeys.length} keys added!`);
                                }
                              }
                            }
                          }}
                        />
                        <div className="mt-2 flex justify-between items-center px-1">
                          <p className="text-[8px] text-indigo-400 italic font-medium">Tip: Press CTRL + ENTER to bulk save.</p>
                          <button 
                            type="button"
                            onClick={() => {
                              const textarea = document.getElementById('bulk-keys-input') as HTMLTextAreaElement;
                              const val = textarea.value.trim();
                              if (val) {
                                const splitKeys = val.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 20);
                                if (splitKeys.length > 0) {
                                  const newKeys = splitKeys.map(k => ({
                                    key: k,
                                    usageCount: 0,
                                    status: 'active',
                                    addedAt: new Date().toISOString()
                                  }));
                                  
                                  setChatSettings({
                                    ...chatSettings, 
                                    geminiApiKeys: [...(chatSettings.geminiApiKeys || []), ...newKeys]
                                  });
                                  textarea.value = '';
                                  alert(`${newKeys.length} keys added!`);
                                }
                              }
                            }}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all"
                          >
                            Add Keys Now
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Welcome / Offline Messages */}
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-4 flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Auto-Messages
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Welcome Message</label>
                      <input 
                        type="text" 
                        value={chatSettings.chatWelcomeMessage}
                        onChange={(e) => setChatSettings({...chatSettings, chatWelcomeMessage: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-xs dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Offline Notice</label>
                      <input 
                        type="text" 
                        value={chatSettings.chatOfflineMessage}
                        onChange={(e) => setChatSettings({...chatSettings, chatOfflineMessage: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-xs dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all font-medium"
                      />
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-8 bg-gray-50 dark:bg-gray-950/40 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  Discard
                </button>
                <button 
                  onClick={saveSettings}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
