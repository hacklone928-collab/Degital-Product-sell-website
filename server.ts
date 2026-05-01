import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));

const firebaseApp = admin.initializeApp({
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
});

const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

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
    res.json({ status: "ok" });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
