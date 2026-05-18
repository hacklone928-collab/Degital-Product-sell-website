import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));

// Initialize with the most reliable method
const firebaseApp = admin.apps.length === 0 ? admin.initializeApp({
  projectId: firebaseConfig.projectId
}) : admin.app();

// Use a more resilient Firestore initialization
let db: admin.firestore.Firestore;
const dbId = firebaseConfig.firestoreDatabaseId;

if (dbId && dbId !== "(default)") {
  db = getFirestore(firebaseApp, dbId);
  console.log(`Firestore initialized with NAMED database: ${dbId}`);
} else {
  db = getFirestore(firebaseApp);
  console.log(`Firestore initialized with DEFAULT database`);
}

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      envProject: process.env.GOOGLE_CLOUD_PROJECT,
      configProject: firebaseConfig.projectId,
      sdkProject: firebaseApp.options.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId
    });
  });

  // Get Products
  app.get("/api/products", async (req, res) => {
    try {
      const snapshot = await db.collection("products").get();
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Create Payment Intent
  app.post("/api/create-payment-intent", async (req, res) => {
    const { productId, userId } = req.body;
    try {
      const productDoc = await db.collection("products").doc(productId).get();
      if (!productDoc.exists) {
        return res.status(404).json({ error: "Product not found" });
      }
      const product = productDoc.data();
      const amount = Math.round(product?.price * 100);

      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "bdt",
        metadata: { productId, userId },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Secure Download Route
  app.get("/api/download/:orderId", async (req, res) => {
    const { orderId } = req.params;
    const { token } = req.query;

    try {
      const orderDoc = await db.collection("orders").doc(orderId).get();
      if (!orderDoc.exists) return res.status(404).send("Order not found");
      
      const order = orderDoc.data();
      if (order?.status !== "completed" || order?.downloadToken !== token) {
        return res.status(403).send("Invalid or expired download link");
      }

      const productDoc = await db.collection("products").doc(order.productId).get();
      const product = productDoc.data();

      // In a real app, you'd stream from S3/Firebase Storage
      // For this demo, we'll redirect to the private URL or a signed URL
      // For now, simple redirect if it exists
      if (product?.fileUrl) {
        res.redirect(product.fileUrl);
      } else {
        res.status(404).send("File not found");
      }
    } catch (error) {
      res.status(500).send("Server error");
    }
  });

  // Admin: Add Product (Simple version for demo)
  app.post("/api/admin/products", async (req, res) => {
    // In production, verify ID token and role
    const product = req.body;
    try {
      const docRef = await db.collection("products").add({
        ...product,
        createdAt: FieldValue.serverTimestamp(),
      });
      res.json({ id: docRef.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to create product" });
    }
  });

// AI Auto Reply
  app.post("/api/chat/auto-reply", async (req, res) => {
    const { sessionId, message, userName, userEmail } = req.body;
    
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

    try {
      console.log(`AI Auto-reply triggered for session: ${sessionId}`);
      
      const sessionDocRef = db.collection("chat_sessions").doc(sessionId);
      const sessionDoc = await sessionDocRef.get();
      
      if (!sessionDoc.exists) {
        console.log(`Session ${sessionId} not found`);
        return res.json({ skip: true, reason: "Session not found" });
      }

      const sessionData = sessionDoc.data();
      
      if (!sessionData?.aiEnabled) {
        return res.json({ skip: true, reason: "AI disabled for this session" });
      }

      // Fetch some context
      let productsContext = "";
      try {
        const productsSnapshot = await db.collection("products").limit(15).get();
        productsContext = productsSnapshot.docs.map(d => {
          const p = d.data();
          return `- ${p.name}: ৳${p.price} (${p.category || 'General'}). Description: ${p.description?.substring(0, 100) || 'No description available'}...`;
        }).join("\n");
      } catch (e) {
        console.warn("Could not fetch products context:", e);
      }
      
      // Fetch Site settings for context and API keys
      let siteName = "Our Shop";
      let refundPolicy = "Standard 7-day refund policy applies to digital items if not downloaded.";
      let paymentMethods = "We accept Stripe, Bkash, Nagad, and Rocket.";
      let customInstructions = "";
      let geminiApiKeys: any[] = [];
      
      try {
        const settingsDoc = await db.collection("settings").doc("site").get();
        if (settingsDoc.exists) {
          const settings = settingsDoc.data();
          siteName = settings?.siteName || siteName;
          refundPolicy = settings?.refundPolicy || refundPolicy;
          paymentMethods = settings?.paymentMethods || paymentMethods;
          customInstructions = settings?.chatAiSystemPrompt || "";
          geminiApiKeys = settings?.geminiApiKeys || [];
        }
      } catch (e) {
        console.warn("Could not fetch site settings context:", e);
      }

      // API Key Rotation Logic with Real-time Monitoring
      let selectedApiKey = process.env.GEMINI_API_KEY;
      let selectedKeyIndex = -1;
      
      if (geminiApiKeys && geminiApiKeys.length > 0) {
        // Filter for active keys (simple strategy: random from active)
        const activeKeys = geminiApiKeys.map((k, i) => ({ ...k, originalIndex: i }))
          .filter(k => (typeof k === 'string') || (k.status === 'active' || !k.status));
        
        if (activeKeys.length > 0) {
          const randomIndex = Math.floor(Math.random() * activeKeys.length);
          const selected = activeKeys[randomIndex];
          selectedApiKey = typeof selected === 'string' ? selected : selected.key;
          selectedKeyIndex = selected.originalIndex ?? -1;
          console.log(`Using rotated Gemini API Key (Index: ${selectedKeyIndex})`);
        }
      }

      // Initialize local AI client with the selected key
      const localAi = new GoogleGenAI({ 
        apiKey: selectedApiKey!,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Fetch Order context if possible
      let orderContext = "";
      try {
        if (userEmail && typeof userEmail === 'string' && userEmail.includes('@')) {
          console.log(`Fetching order context for email: ${userEmail}`);
          const ordersSnapshot = await db.collection("orders")
            .where("email", "==", userEmail)
            .orderBy("createdAt", "desc")
            .limit(3)
            .get();
          
          if (!ordersSnapshot.empty) {
            orderContext = ordersSnapshot.docs.map(doc => {
              const data = doc.data();
              return `Order ID: ${doc.id}, Status: ${data.status || 'Pending'}, Product: ${data.productName || 'Unknown'}, Total: ৳${data.total || data.amount || 0}, Current Location: ${data.currentLocation || 'Processing Center'}`;
            }).join("\n");
          }
        }
      } catch (e) {
        console.warn("Could not fetch order context (might be missing index or invalid email):", e);
      }

      const prompt = `
        You are a PRO SALES ASSISTANT and CUSTOMER HAPPINESS AGENT for "${siteName}". 
        Your goal is to SELL products elegantly and solve customer issues with a "VIP" feel.

        CORE PRINCIPLES:
        1. PERSUASIVE SELLING: Don't just list products. Explain WHY the user needs them. Use "Benefit-driven" language.
        2. BENGALI MASTERY: If a user speaks in Bengali (English alphabet or Bangla script), you MUST respond in extremely sweet, respectful, and native-feeling Bengali (আবেগপ্রবণ ভাষায় কথা বলুন). Use "আপনি" and terms of respect.
        3. SALES CLOSER: If the user is interested, encourage them to "Grab it fast" or "Take this limited offer".
        4. TRUST BUILDER: Mention our ${paymentMethods} and ${refundPolicy} to build 100% trust.

        CONTEXT:
        Customer: ${userName || "Guest"}
        Available Catalog:
        ${productsContext || "Catalog is being updated, ask them what they need!"}
        
        Customer's History/Orders:
        ${orderContext || "This is a new customer. Greet them warmly!"}
        
        Admin's Special Instructions:
        ${customInstructions || "Provide premium service."}

        CONSTRAINTS:
        - NEVER sound like a robot. 
        - Use emojis effectively (🚀, ✨, ✅).
        - If they ask for order status, look at the "Customer's History" above.
        - Keep replies under 3-4 sentences unless explaining a product.
        - DO NOT use markdown headers (# or ##).

        USER MESSAGE: "${message}"
        
        YOUR MAGICAL RESPONSE:
      `;

      console.log("Generating AI content with prompt...");
      let aiReply = "";
      try {
        const response = await localAi.models.generateContent({
          model: "gemini-1.5-flash", 
          contents: prompt,
        });
        aiReply = response.text;

          // Update successful usage
        if (selectedKeyIndex !== -1) {
          const updatedKeys = [...geminiApiKeys];
          const keyObj = typeof updatedKeys[selectedKeyIndex] === 'string' 
            ? { key: updatedKeys[selectedKeyIndex] } 
            : { ...updatedKeys[selectedKeyIndex] };
          
          keyObj.usageCount = (keyObj.usageCount || 0) + 1;
          keyObj.lastUsed = FieldValue.serverTimestamp();
          keyObj.status = 'active';
          updatedKeys[selectedKeyIndex] = keyObj;
          
          console.log(`Updating usage stats for key at index ${selectedKeyIndex}`);
          const siteSettingsRef = db.collection("settings").doc("site");
          await siteSettingsRef.set({ geminiApiKeys: updatedKeys }, { merge: true });
        }
      } catch (aiErr: any) {
        console.error("Gemini API Error details:", aiErr);
        // Mark key as error if rate limited or invalid
        if (selectedKeyIndex !== -1 && (aiErr.message?.includes("429") || aiErr.message?.includes("403") || aiErr.message?.includes("API_KEY_INVALID"))) {
          const updatedKeys = [...geminiApiKeys];
          const keyObj = typeof updatedKeys[selectedKeyIndex] === 'string' 
            ? { key: updatedKeys[selectedKeyIndex] } 
            : { ...updatedKeys[selectedKeyIndex] };
          
          keyObj.status = 'error';
          keyObj.lastError = aiErr.message;
          updatedKeys[selectedKeyIndex] = keyObj;
          console.log(`Marking key at index ${selectedKeyIndex} as ERROR`);
          const siteSettingsRef = db.collection("settings").doc("site");
          await siteSettingsRef.set({ geminiApiKeys: updatedKeys }, { merge: true });
        }
        throw aiErr;
      }

      console.log("AI reply generated successfully");

      // Save AI message to firestore
      await db.collection("chat_messages").add({
        sessionId,
        senderId: "ai_bot",
        senderType: "ai",
        text: aiReply,
        createdAt: FieldValue.serverTimestamp(),
        seen: false
      });

      // Update session last message
      console.log(`Updating session ${sessionId} last message`);
      await sessionDocRef.set({
        lastMessage: aiReply,
        lastTimestamp: FieldValue.serverTimestamp(),
        unreadCount: FieldValue.increment(1)
      }, { merge: true });

      res.json({ success: true, reply: aiReply });
    } catch (error: any) {
      console.error("CRITICAL: AI Auto-reply failure:", {
        step: "reply-generation-process",
        errMessage: error.message,
        errCode: error.code, // This might reveal if it's a gRPC code 5
        stack: error.stack
      });
      res.status(500).json({ error: "Failed to generate AI response", details: error.message });
    }
  });

  // AI Suggested Reply for Admin
  app.post("/api/chat/suggest-reply", async (req, res) => {
    const { sessionId, lastUserMessage, history } = req.body;
    
    try {
      const prompt = `
        You are helping a customer support admin draft a perfect reply.
        Customer message: "${lastUserMessage}"
        
        Recent history:
        ${history?.slice(-5).map((m: any) => `${m.senderType}: ${m.text}`).join("\n")}
        
        TASK:
        Provide 3 short, professional, and helpful reply suggestions for the admin.
        Format: Return only a JSON array of strings. No extra text.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash", 
        contents: prompt,
      });

      let techText = response.text;
      // Clean potential markdown blocks
      if (techText.includes("```json")) {
        techText = techText.split("```json")[1].split("```")[0].trim();
      } else if (techText.includes("```")) {
        techText = techText.split("```")[1].split("```")[0].trim();
      }

      const suggestions = JSON.parse(techText);
      res.json({ success: true, suggestions });
    } catch (error: any) {
      console.error("AI Suggestion error:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom", // Switch to custom to handle the HTML response ourselves for better reliability
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).send(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
  });
}

startServer();
