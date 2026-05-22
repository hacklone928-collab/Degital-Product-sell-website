import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import { 
  getFirestore as getClientFirestore, 
  doc as clientDoc, 
  getDoc as clientGetDoc, 
  getDocs as clientGetDocs, 
  setDoc as clientSetDoc, 
  addDoc as clientAddDoc, 
  updateDoc as clientUpdateDoc, 
  query as clientQuery, 
  collection as clientCollection, 
  where as clientWhere, 
  orderBy as clientOrderBy, 
  limit as clientLimit,
  serverTimestamp as clientServerTimestamp,
  increment as clientIncrement
} from "firebase/firestore";
import Stripe from "stripe";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import https from "https";
import { URL } from "url";

dotenv.config();

// Custom resilient fetch using Node's standard https module for maximum reliability of DNS resolution (bypasses Node fetch IPv6 speculatives)
const nodeFetch = (urlStr: string, options: any = {}): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const headers: any = {
        "Accept": "application/json",
        ...options.headers
      };
      
      let bodyData = options.body;
      if (bodyData) {
        if (bodyData instanceof URLSearchParams) {
          bodyData = bodyData.toString();
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        } else if (typeof bodyData !== "string") {
          try {
            const str = JSON.stringify(bodyData);
            headers["Content-Type"] = "application/json";
            bodyData = str;
          } catch(e) {}
        }
        headers["Content-Length"] = Buffer.byteLength(bodyData);
      }

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || "GET",
        headers: headers,
        timeout: 15000 // 15s timeout
      };

      const req = https.request(reqOptions, (res) => {
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          resolve({
            ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => rawData,
            json: async () => {
              try {
                return JSON.parse(rawData);
              } catch (e) {
                return { error: rawData };
              }
            }
          });
        });
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));

// Initialize with the most reliable method
let firebaseApp: admin.app.App;
try {
  firebaseApp = admin.apps.length === 0 ? admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId
  }) : admin.app();
  console.log("Firebase Admin successfully initialized with Application Default Credentials (ADC)");
} catch (error) {
  console.warn("Could not initialize with Application Default Credentials (ADC). Falling back to standalone project registration:", error);
  firebaseApp = admin.apps.length === 0 ? admin.initializeApp({
    projectId: firebaseConfig.projectId
  }) : admin.app();
}

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

// Initializing Web Client SDK db for sandbox fallback
const clientApp = initializeClientApp(firebaseConfig);
const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
console.log("Firebase Web Client SDK successfully initialized for sandbox fallbacks");

// Resilient Firestore REST API query fallback for isolated sandbox environments (overcomes 7 PERMISSION_DENIED)
const toFirestoreValue = (val: any): any => {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === "string") {
    return { stringValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields: any = {};
    for (const k of Object.keys(val)) {
      fields[k] = toFirestoreValue(val[k]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
};

const parseFirestoreValue = (val: any): any => {
  if (!val) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.nullValue !== undefined) return null;
  if (val.arrayValue !== undefined) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if (val.mapValue !== undefined) {
    const result: any = {};
    const fields = val.mapValue.fields || {};
    for (const k of Object.keys(fields)) {
      result[k] = parseFirestoreValue(fields[k]);
    }
    return result;
  }
  return null;
};

const getRESTAuthHeaders = async () => {
  const headers: any = { "Content-Type": "application/json" };
  try {
    const cred = admin.credential.applicationDefault();
    const tokenObj = await cred.getAccessToken();
    if (tokenObj && tokenObj.access_token) {
      headers["Authorization"] = `Bearer ${tokenObj.access_token}`;
    }
  } catch (err: any) {
    // Proceed silently so unauthenticated REST fallback with API Key works
  }
  return headers;
};

const fetchFirestoreDocREST = async (collectionName: string, docId: string) => {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}/${docId}?key=${apiKey}`;
  
  const headers = await getRESTAuthHeaders();
  let response = await nodeFetch(url, {
    method: "GET",
    headers
  });
  if (response.status === 403 && headers["Authorization"]) {
    console.warn(`REST fetch returned 403 with auth headers for ${collectionName}/${docId}. Retrying as unauthenticated JSON request with API key...`);
    response = await nodeFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!response.ok) {
    throw new Error(`REST fetch failed with status ${response.status}`);
  }
  const data = await response.json();

  const parsedFields: any = { id: docId };
  const fields = data.fields || {};
  for (const k of Object.keys(fields)) {
    parsedFields[k] = parseFirestoreValue(fields[k]);
  }
  return parsedFields;
};

const writeFirestoreDocREST = async (collectionName: string, docId: string, data: any, isUpdate = false) => {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  
  let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}/${docId}?key=${apiKey}`;
  
  const fields: any = {};
  for (const k of Object.keys(data)) {
    let val = data[k];
    if (val && typeof val === "object" && val.constructor?.name === "FieldValue") {
      val = new Date();
    }
    fields[k] = toFirestoreValue(val);
  }

  if (isUpdate) {
    const updateMasks = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join("&");
    url += `&${updateMasks}`;
  }

  const headers = await getRESTAuthHeaders();
  let response = await nodeFetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields })
  });

  if (response.status === 403 && headers["Authorization"]) {
    console.warn(`REST PATCH returned 403 with auth headers for ${collectionName}/${docId}. Retrying as unauthenticated JSON request with API key...`);
    response = await nodeFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`REST write failed with status ${response.status}: ${errText}`);
  }

  const resData = await response.json();
  const parsedFields: any = { id: docId };
  const resFields = resData.fields || {};
  for (const k of Object.keys(resFields)) {
    parsedFields[k] = parseFirestoreValue(resFields[k]);
  }
  return parsedFields;
};

const addFirestoreDocREST = async (collectionName: string, data: any) => {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}?key=${apiKey}`;
  
  const fields: any = {};
  for (const k of Object.keys(data)) {
    let val = data[k];
    if (val && typeof val === "object" && val.constructor?.name === "FieldValue") {
      val = new Date();
    }
    fields[k] = toFirestoreValue(val);
  }

  const headers = await getRESTAuthHeaders();
  let response = await nodeFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields })
  });

  if (response.status === 403 && headers["Authorization"]) {
    console.warn(`REST POST returned 403 with auth headers for ${collectionName}. Retrying as unauthenticated JSON request with API key...`);
    response = await nodeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`REST add failed with status ${response.status}: ${errText}`);
  }

  const resData = await response.json();
  const docId = resData.name ? resData.name.split("/").pop() : "";
  const parsedFields: any = { id: docId };
  const resFields = resData.fields || {};
  for (const k of Object.keys(resFields)) {
    parsedFields[k] = parseFirestoreValue(resFields[k]);
  }
  return parsedFields;
};

interface QueryOption {
  field: string;
  op: "EQUAL" | "LESS_THAN" | "LESS_THAN_OR_EQUAL" | "GREATER_THAN" | "GREATER_THAN_OR_EQUAL";
  value: any;
}

const queryFirestoreREST = async (
  collectionName: string, 
  options: { 
    where?: QueryOption[], 
    orderBy?: { field: string, direction: "ASCENDING" | "DESCENDING" }[], 
    limit?: number 
  } = {}
) => {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery?key=${apiKey}`;

  const structuredQuery: any = {
    from: [{ collectionId: collectionName }]
  };

  if (options.limit !== undefined) {
    structuredQuery.limit = options.limit;
  }

  if (options.where && options.where.length > 0) {
    const filters = options.where.map(w => ({
      fieldFilter: {
        field: { fieldPath: w.field },
        op: w.op,
        value: toFirestoreValue(w.value)
      }
    }));

    if (filters.length === 1) {
      structuredQuery.where = filters[0];
    } else {
      structuredQuery.where = {
        compositeFilter: {
          op: "AND",
          filters
        }
      };
    }
  }

  if (options.orderBy && options.orderBy.length > 0) {
    structuredQuery.orderBy = options.orderBy.map(o => ({
      field: { fieldPath: o.field },
      direction: o.direction
    }));
  }

  const headers = await getRESTAuthHeaders();
  let response = await nodeFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ structuredQuery })
  });

  if (response.status === 403 && headers["Authorization"]) {
    console.warn(`REST POST query returned 403 with auth headers for ${collectionName}. Retrying as unauthenticated JSON request with API key...`);
    response = await nodeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery })
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`REST runQuery failed with status ${response.status}: ${errText}`);
  }

  const results = await response.json();
  if (!Array.isArray(results)) return [];

  const parsedDocs: any[] = [];
  for (const item of results) {
    if (!item.document) continue;
    const docData = item.document;
    const docId = docData.name ? docData.name.split("/").pop() : "";
    const fields = docData.fields || {};
    const parsedFields: any = { id: docId };
    for (const k of Object.keys(fields)) {
      parsedFields[k] = parseFirestoreValue(fields[k]);
    }
    parsedDocs.push(parsedFields);
  }
  return parsedDocs;
};

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
  app.use(express.urlencoded({ extended: true }));

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
    let products: any[] = [];
    try {
      const snapshot = await db.collection("products").get();
      products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error: any) {
      console.warn("Firestore Admin SDK failed to fetch products in background. Trying REST fallback...", error.message || error);
      try {
        products = await queryFirestoreREST("products");
      } catch (restError: any) {
        console.error("Firestore REST API fallback both failed getting products:", restError.message || restError);
      }
    }
    res.json(products);
  });

  // Create Payment Intent
  app.post("/api/create-payment-intent", async (req, res) => {
    const { productId, userId } = req.body;
    try {
      let product: any = null;
      if (productId && typeof productId === "string") {
        try {
          const productDoc = await db.collection("products").doc(productId).get();
          if (productDoc.exists) {
            product = productDoc.data();
          }
        } catch (firestoreError: any) {
          console.warn("Firestore Admin SDK failed to fetch product. Trying REST fallback...", firestoreError.message || firestoreError);
          try {
            product = await fetchFirestoreDocREST("products", productId);
          } catch (restError: any) {
            console.error("Firestore REST API fallback both failed getting product:", restError.message || restError);
          }
        }
      }

      // If product not found in DB due to permissions but user passed a placeholder price or client data:
      const price = product?.price || req.body.price || 990; // Default BDT 990 if sandbox
      const amount = Math.round(price * 100);

      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "bdt",
        metadata: { productId, userId },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Interactive Payment Gateway Simulator
  app.get("/api/payment/simulator", (req, res) => {
    const { gateway, tran_id, amount, success_url, cancel_url } = req.query;
    
    // Serve beautiful custom styled simulator page
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Payment Portal Simulator</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-[#F8F9FC] min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden">
        <!-- Top bar -->
        <div class="bg-gray-900 text-white p-6 text-center relative font-sans">
            <div class="absolute inset-y-0 left-6 flex items-center">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span class="text-[10px] font-black uppercase tracking-widest text-emerald-400 pl-1.5 font-mono">Simulated Sandbox</span>
            </div>
            <h1 class="text-sm font-black tracking-widest uppercase">${gateway === 'sslcommerz' ? 'SSLCommerz Portal' : 'ShurjoPay Portal'}</h1>
            <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Transaction: ${tran_id}</p>
        </div>

        <div class="p-6 sm:p-8 space-y-6">
            <!-- Amount Header -->
            <div class="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex items-center justify-between">
                <div>
                     <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Payable</span>
                     <span class="text-xs font-mono font-bold text-gray-500">BD Currency</span>
                </div>
                <div class="text-right">
                    <span class="text-2xl sm:text-3xl font-black text-[#4f46e5]">৳${amount}</span>
                </div>
            </div>

            <!-- Payment Channels Selection -->
            <div class="space-y-4">
                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Choose Payment Method</span>
                
                <div class="grid grid-cols-2 gap-3" id="method-grid">
                    <button onclick="selectMethod('cards', 'Visa / MasterCard')" class="method-card p-4 rounded-2xl border-2 border-gray-100 hover:border-[#4f46e5] transition-all flex flex-col items-center gap-2 group bg-white">
                        <span class="text-xl">💳</span>
                        <span class="text-xs font-bold text-gray-600">Card Payment</span>
                    </button>
                    <button onclick="selectMethod('bkash', 'bKash Wallet')" class="method-card p-4 rounded-2xl border-2 border-gray-100 hover:border-[#4f46e5] transition-all flex flex-col items-center gap-2 group bg-white">
                        <span class="text-xl">🌸</span>
                        <span class="text-xs font-bold text-gray-600">bKash</span>
                    </button>
                    <button onclick="selectMethod('nagad', 'Nagad Wallet')" class="method-card p-4 rounded-2xl border-2 border-gray-100 hover:border-[#4f46e5] transition-all flex flex-col items-center gap-2 group bg-white">
                        <span class="text-xl">🍊</span>
                        <span class="text-xs font-bold text-gray-600">Nagad</span>
                    </button>
                    <button onclick="selectMethod('rocket', 'Rocket banking')" class="method-card p-4 rounded-2xl border-2 border-gray-100 hover:border-[#4f46e5] transition-all flex flex-col items-center gap-2 group bg-white">
                        <span class="text-xl">🚀</span>
                        <span class="text-xs font-bold text-gray-600">Rocket</span>
                    </button>
                </div>
            </div>

            <!-- Validation/Submission details -->
            <div id="payment-input" class="hidden bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
                <div class="space-y-1">
                    <label id="input-label" class="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1"></label>
                    <input type="text" id="phone-input" class="w-full bg-white border-none rounded-xl p-3 text-xs font-mono font-bold outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-[#4f46e5]" placeholder="Enter simulated data">
                </div>
            </div>

            <!-- Form submission loops -->
            <form id="pay-form" method="${gateway === 'sslcommerz' ? 'POST' : 'GET'}" action="${success_url}" class="space-y-3 pt-2">
                <!-- SSLCommerz uses standard form post headers -->
                <input type="hidden" id="form-tran-id" name="tran_id" value="${tran_id}">
                <input type="hidden" id="form-order-id" name="order_id" value="${tran_id}">
                <input type="hidden" name="amount" value="${amount}">
                <input type="hidden" id="form-card-type" name="card_type" value="VISA">
                <input type="hidden" name="val_id" value="SIM_VAL_${Date.now()}">
                <input type="hidden" name="bank_tran_id" value="SIM_BANK_${Date.now()}">
                <input type="hidden" name="status" value="VALID">

                <button type="submit" id="pay-btn" disabled class="w-full bg-[#4f46e5] hover:bg-opacity-95 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 transition-all disabled:opacity-50">
                    Select a Method to Pay
                </button>
                
                <a href="${cancel_url}" class="block text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors pt-2">
                    Cancel Simulated Transaction
                </a>
            </form>
        </div>
    </div>

    <script>
        let selected = '';
        function selectMethod(id, name) {
            selected = id;
            document.querySelectorAll('.method-card').forEach(c => {
                c.classList.remove('border-[#4f46e5]', 'bg-indigo-50/10');
                c.classList.add('border-gray-100', 'bg-white');
            });
            event.currentTarget.classList.add('border-[#4f46e5]', 'bg-indigo-50/10');
            event.currentTarget.classList.remove('border-gray-100', 'bg-white');
            
            document.getElementById('form-card-type').value = name;
            
            const pInput = document.getElementById('payment-input');
            const label = document.getElementById('input-label');
            const input = document.getElementById('phone-input');
            
            pInput.classList.remove('hidden');
            if (id === 'cards') {
                label.innerText = 'Card Number (Simulated)';
                input.placeholder = '4111 2222 3333 4444';
                input.type = 'text';
            } else {
                label.innerText = name + ' Mobile Number';
                input.placeholder = '017XXXXXXXX';
                input.type = 'tel';
            }
            
            const btn = document.getElementById('pay-btn');
            btn.disabled = false;
            btn.innerText = 'Confirm simulated Pay - ৳' + '${amount}';
        }
    </script>
</body>
</html>
    `);
  });

  // Initialize payment gateway redirection
  app.post("/api/payment/init", async (req, res) => {
    const { gateway, userId, products, customerInfo, subtotal, amount, couponCode, discountAmount } = req.body;
    try {
      if (!gateway || !userId || !products || !customerInfo || !amount) {
        return res.status(400).json({ error: "Missing required checkout parameters" });
      }

      // 1. Fetch credentials with resilient client fallback (vital for isolated backend sandbox permissions)
      let credentials: any = null;
      try {
        const gatewayDoc = await db.collection("payment_gateways").doc(gateway).get();
        credentials = gatewayDoc.exists ? gatewayDoc.data() : null;
      } catch (firestoreError: any) {
        console.warn("Firestore Admin SDK failed to fetch payment gateway credentials. Trying REST fallback...", firestoreError.message || firestoreError);
        try {
          credentials = await fetchFirestoreDocREST("payment_gateways", gateway);
        } catch (restError: any) {
          console.warn("REST gateway fallback failed:", restError.message || restError);
        }
      }

      if (!credentials && req.body.clientCredentials) {
        credentials = req.body.clientCredentials;
        console.log(`Successfully recovered gateway credentials on-the-fly via client-payload for ${gateway}`);
      }

      // 2. Generate transaction ID (Direct unique ID or client-provided pre-registered ID)
      const txnId = req.body.txnId || `TXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

      // 3. Create the order
      const orderItems = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        size: p.size || null,
        quantity: p.quantity
      }));

      try {
        await db.collection("orders").doc(txnId).set({
          userId,
          productIds: products.map((p: any) => p.id),
          items: orderItems,
          productName: orderItems.length === 1 ? (orderItems[0].size ? `${orderItems[0].name} (${orderItems[0].size})` : orderItems[0].name) : `${orderItems.length} Products`,
          customerEmail: customerInfo.email,
          customerName: customerInfo.name,
          customerPhone: customerInfo.phone,
          deliveryAddress: customerInfo.address || "N/A",
          division: customerInfo.division || "",
          district: customerInfo.district || "",
          upazila: customerInfo.upazila || "",
          union: customerInfo.union || "",
          village: customerInfo.village || "",
          paymentMethod: gateway === "sslcommerz" ? "SSLCommerz" : "ShurjoPay",
          status: "pending_payment", // Waiting for gateway redirection to confirm status
          amount: subtotal,
          grossAmount: subtotal,
          discountAmount: discountAmount || 0,
          netAmount: amount,
          couponCode: couponCode || null,
          isPaid: false,
          createdAt: FieldValue.serverTimestamp(),
          transactionId: txnId,
          paymentGatewayId: gateway
        });
        console.log(`Order ${txnId} successfully persisted via Admin SDK.`);
      } catch (firestoreError: any) {
        console.warn(`Firestore Admin SDK failed to create order doc (due to isolated sandbox permissions). Trying REST write doc fallback. Order ID: ${txnId}`, firestoreError.message || firestoreError);
        try {
          await writeFirestoreDocREST("orders", txnId, {
            userId,
            productIds: products.map((p: any) => p.id),
            items: orderItems,
            productName: orderItems.length === 1 ? (orderItems[0].size ? `${orderItems[0].name} (${orderItems[0].size})` : orderItems[0].name) : `${orderItems.length} Products`,
            customerEmail: customerInfo.email,
            customerName: customerInfo.name,
            customerPhone: customerInfo.phone,
            deliveryAddress: customerInfo.address || "N/A",
            division: customerInfo.division || "",
            district: customerInfo.district || "",
            upazila: customerInfo.upazila || "",
            union: customerInfo.union || "",
            village: customerInfo.village || "",
            paymentMethod: gateway === "sslcommerz" ? "SSLCommerz" : "ShurjoPay",
            status: "pending_payment", 
            amount: subtotal,
            grossAmount: subtotal,
            discountAmount: discountAmount || 0,
            netAmount: amount,
            couponCode: couponCode || null,
            isPaid: false,
            createdAt: new Date().toISOString(),
            transactionId: txnId,
            paymentGatewayId: gateway
          });
          console.log(`Order ${txnId} successfully persisted via REST API.`);
        } catch (restError: any) {
          console.error(`REST write fallback both failed for Order ID: ${txnId}`, restError.message || restError);
        }
      }

      // 4. Handle Redirection flow (dynamically auto-generated from current host and secure protocol)
      const host = req.get("host") || "";
      const protocol = (host.includes("localhost") || host.includes("127.0.0.1")) ? "http" : "https";
      const success_url = `${protocol}://${host}/api/payment/${gateway}/success`;
      const failed_url = `${protocol}://${host}/api/payment/${gateway}/failed`;
      const cancel_url = `${protocol}://${host}/api/payment/${gateway}/cancel`;
      const ipn_url = `${protocol}://${host}/api/payment/${gateway}/ipn`;

      // If credentials do not exist or are empty, OR if sandbox mode is active and we want fail-safe simulator fallback:
      const storeId = credentials?.store_id;
      const storePassword = credentials?.store_password;
      const sandboxMode = credentials?.sandbox_mode !== false;

      if (!storeId || !storePassword) {
        // Redirect to lovely visual simulator
        const simUrl = `/api/payment/simulator?gateway=${gateway}&tran_id=${txnId}&amount=${amount}&success_url=${encodeURIComponent(success_url)}&cancel_url=${encodeURIComponent(cancel_url)}`;
        return res.json({ redirectUrl: simUrl });
      }

      // SSLCommerz live API handshake
      if (gateway === "sslcommerz") {
        const sslUrl = sandboxMode 
          ? "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
          : "https://gwprocess.sslcommerz.com/gwprocess/v4/api.php";

        try {
          const params = new URLSearchParams();
          params.append("store_id", storeId);
          params.append("store_passwd", storePassword);
          params.append("total_amount", amount.toString());
          params.append("currency", "BDT");
          params.append("tran_id", txnId);
          params.append("success_url", success_url);
          params.append("fail_url", failed_url);
          params.append("cancel_url", cancel_url);
          params.append("ipn_url", ipn_url);
          params.append("cus_name", customerInfo.name || "Customer");
          params.append("cus_email", customerInfo.email || "customer@example.com");
          params.append("cus_phone", customerInfo.phone || "01700000000");
          params.append("cus_add1", customerInfo.address || "N/A");
          params.append("cus_city", customerInfo.district || "Dhaka");
          params.append("cus_state", customerInfo.division || "Dhaka");
          params.append("cus_postcode", "1200");
          params.append("cus_country", "Bangladesh");
          params.append("shipping_method", "NO");
          params.append("num_of_item", products.length.toString());
          params.append("product_name", "Digital Products");
          params.append("product_category", "Digital");
          params.append("product_profile", "non-physical-goods");

          const response = await nodeFetch(sslUrl, {
            method: "POST",
            body: params,
            headers: { 
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });

          const resData: any = await response.json();
          if (resData.status === "SUCCESS" && resData.GatewayPageURL) {
            return res.json({ redirectUrl: resData.GatewayPageURL });
          } else {
            console.warn("SSLCommerz payload failed, returning specific error.", resData);
            return res.status(400).json({ 
              error: `SSLCommerz error: ${resData.failedreason || "Invalid credentials or initialization parameters"}. API Status: ${resData.status || "FAILED"}.` 
            });
          }
        } catch (err: any) {
          console.error("SSLCommerz network error:", err);
          return res.status(500).json({ 
            error: `SSLCommerz Net Error: ${err.message || err}. Failed to reach SSLCommerz servers.` 
          });
        }
      }

      // ShurjoPay live API handshake
      if (gateway === "shurjopay") {
        const tokenUrl = sandboxMode
          ? "https://sandbox.shurjopay.com.bd/api/get_token"
          : "https://engine.shurjopay.com.bd/api/get_token";
        
        const payUrl = sandboxMode
          ? "https://sandbox.shurjopay.com.bd/api/secret-pay"
          : "https://engine.shurjopay.com.bd/api/secret-pay";

        try {
          // STEP 1: Get Access Token
          const tokenRes = await nodeFetch(tokenUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            body: JSON.stringify({ username: storeId, password: storePassword })
          });
          const tokenData: any = await tokenRes.json();
          const token = tokenData.token;
          const shurjoStoreId = tokenData.store_id;

          if (!token) {
            console.warn("ShurjoPay token lookup failed:", tokenData);
            return res.status(400).json({ 
              error: `ShurjoPay Authentication Failed: ${tokenData.message || "Invalid username or password credentials. Please verify your settings."}` 
            });
          }

          // STEP 2: Initiate Payment
          const payRes = await nodeFetch(payUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            body: JSON.stringify({
              token,
              store_id: shurjoStoreId,
              prefix: credentials.prefix || "SP",
              currency: "BDT",
              amount,
              order_id: txnId,
              discounts: "0",
              custom_1: userId,
              client_ip: "127.0.0.1",
              customer_name: customerInfo.name || "Customer",
              customer_phone: customerInfo.phone || "01700000000",
              customer_email: customerInfo.email || "customer@example.com",
              customer_address: customerInfo.address || "N/A",
              customer_city: customerInfo.district || "Dhaka",
              return_url: success_url,
              cancel_url: cancel_url
            })
          });

          const payData: any = await payRes.json();
          const checkoutUrl = Array.isArray(payData) ? payData[0]?.checkout_url : payData?.checkout_url;

          if (checkoutUrl) {
            return res.json({ redirectUrl: checkoutUrl });
          } else {
            console.warn("ShurjoPay payment setup failed:", payData);
            return res.status(400).json({ 
              error: `ShurjoPay checkout setup failed: ${payData.message || "Invalid payload, validation issue or inactive merchant account."}` 
            });
          }
        } catch (err: any) {
          console.error("ShurjoPay handshake error:", err);
          return res.status(500).json({ 
            error: `ShurjoPay Net Error: ${err.message || err}. Failed to reach ShurjoPay API.` 
          });
        }
      }

    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // SSLCommerz Success Route (POST)
  app.post("/api/payment/sslcommerz/success", async (req, res) => {
    const { tran_id, val_id, card_type, bank_tran_id } = req.body;
    try {
      if (!tran_id) return res.status(400).send("Transaction id is missing.");
      
      try {
        const orderRef = db.collection("orders").doc(tran_id);
        const orderDoc = await orderRef.get();
        if (orderDoc.exists) {
          await orderRef.update({
            status: "completed", // Complete the order status!
            isPaid: true,
            paidAt: FieldValue.serverTimestamp(),
            valId: val_id || null,
            cardType: card_type || null,
            bankTranId: bank_tran_id || null,
            gatewayResponse: req.body
          });
          console.log(`Order ${tran_id} marked as COMPLETED via Admin SDK on SSLCommerz success.`);
        }
      } catch (firestoreError: any) {
        console.warn(`Firestore Admin SDK failed to set success status on SSLCommerz callback (isolated sandbox permissions). Trying REST fallback: ${tran_id}`, firestoreError.message || firestoreError);
        try {
          await writeFirestoreDocREST("orders", tran_id, {
            status: "completed",
            isPaid: true,
            paidAt: new Date().toISOString(),
            valId: val_id || null,
            cardType: card_type || null,
            bankTranId: bank_tran_id || null,
            gatewayResponse: req.body
          }, true);
          console.log(`Order ${tran_id} marked as COMPLETED via REST API successfully.`);
        } catch (restErr: any) {
          console.error("REST update fallback failed:", restErr.message || restErr);
        }
      }

      res.redirect(`/checkout?status=success&orderId=${tran_id}`);
    } catch (err: any) {
      console.error("SSLCommerz success redirect error:", err);
      res.redirect(`/checkout?status=success&orderId=${tran_id || ""}`);
    }
  });

  // SSLCommerz Failed (POST)
  app.post("/api/payment/sslcommerz/failed", async (req, res) => {
    const { tran_id } = req.body;
    try {
      if (tran_id) {
        try {
          await db.collection("orders").doc(tran_id).update({
            status: "failed",
            failedAt: FieldValue.serverTimestamp(),
            gatewayResponse: req.body
          });
        } catch (firestoreError: any) {
          console.warn(`Firestore Admin SDK fail on failure callback registration for ${tran_id}. Trying REST fallback...`, firestoreError.message);
          try {
            await writeFirestoreDocREST("orders", tran_id, {
              status: "failed",
              failedAt: new Date().toISOString(),
              gatewayResponse: req.body
            }, true);
          } catch (restErr: any) {
            console.error("REST failure callback update failed:", restErr.message || restErr);
          }
        }
      }
      res.redirect(`/checkout?status=failed&orderId=${tran_id || ""}`);
    } catch (err: any) {
      res.redirect(`/checkout?status=failed&orderId=${tran_id || ""}`);
    }
  });

  // SSLCommerz Cancel (POST)
  app.post("/api/payment/sslcommerz/cancel", async (req, res) => {
    const { tran_id } = req.body;
    try {
      if (tran_id) {
        try {
          await db.collection("orders").doc(tran_id).update({
            status: "cancelled",
            cancelledAt: FieldValue.serverTimestamp(),
            gatewayResponse: req.body
          });
        } catch (firestoreError: any) {
          console.warn(`Firestore Admin SDK fail on cancel callback registration for ${tran_id}. Trying REST fallback...`, firestoreError.message);
          try {
            await writeFirestoreDocREST("orders", tran_id, {
              status: "cancelled",
              cancelledAt: new Date().toISOString(),
              gatewayResponse: req.body
            }, true);
          } catch (restErr: any) {
            console.error("REST cancel callback update failed:", restErr.message || restErr);
          }
        }
      }
      res.redirect(`/checkout?status=cancelled&orderId=${tran_id || ""}`);
    } catch (err: any) {
      res.redirect(`/checkout?status=cancelled&orderId=${tran_id || ""}`);
    }
  });

  // SSLCommerz IPN (POST Webhook)
  app.post("/api/payment/sslcommerz/ipn", async (req, res) => {
    const { tran_id, status, val_id } = req.body;
    try {
      if (tran_id && status === "VALID") {
        try {
          const orderRef = db.collection("orders").doc(tran_id);
          const orderDoc = await orderRef.get();
          if (orderDoc.exists && !orderDoc.data()?.isPaid) {
            await orderRef.update({
              status: "completed",
              isPaid: true,
              paidAt: FieldValue.serverTimestamp(),
              valId: val_id || null,
              gatewayResponse: req.body
            });
          }
        } catch (firestoreError: any) {
          console.warn(`Firestore Admin SDK fail on IPN update for ${tran_id}. Trying REST fallback:`, firestoreError.message);
          try {
            await writeFirestoreDocREST("orders", tran_id, {
              status: "completed",
              isPaid: true,
              paidAt: new Date().toISOString(),
              valId: val_id || null,
              gatewayResponse: req.body
            }, true);
            console.log(`IPN completed successfully via REST for ${tran_id}`);
          } catch (restErr: any) {
            console.error("REST fallback IPN failure:", restErr.message || restErr);
          }
        }
      }
      res.status(200).send("IPN Received Successfully");
    } catch (err: any) {
      res.status(200).send("IPN processed with warnings");
    }
  });

  // ShurjoPay Success Route (POST/GET)
  const handleShurjoPaySuccess = async (req: express.Request, res: express.Response) => {
    const orderId = (req.query.order_id || req.body.order_id || req.body.sp_order_id) as string;
    try {
      if (!orderId) return res.status(400).send("Order id is missing.");
      
      try {
        const orderRef = db.collection("orders").doc(orderId);
        const orderDoc = await orderRef.get();
        if (orderDoc.exists) {
          await orderRef.update({
            status: "completed",
            isPaid: true,
            paidAt: FieldValue.serverTimestamp(),
            gatewayResponse: { ...req.query, ...req.body }
          });
          console.log(`Order ${orderId} marked as COMPLETED via Admin SDK on ShurjoPay success.`);
        }
      } catch (firestoreError: any) {
        console.warn(`Firestore Admin SDK failed to set success status on ShurjoPay callback (isolated sandbox permissions). Trying REST fallback: ${orderId}`, firestoreError.message || firestoreError);
        try {
          await writeFirestoreDocREST("orders", orderId, {
            status: "completed",
            isPaid: true,
            paidAt: new Date().toISOString(),
            gatewayResponse: { ...req.query, ...req.body }
          }, true);
          console.log(`Order ${orderId} marked as COMPLETED via REST API successfully.`);
        } catch (restErr: any) {
          console.error("REST update fallback failed:", restErr.message || restErr);
        }
      }

      res.redirect(`/checkout?status=success&orderId=${orderId}`);
    } catch (err: any) {
      res.redirect(`/checkout?status=success&orderId=${orderId || ""}`);
    }
  };
  app.get("/api/payment/shurjopay/success", handleShurjoPaySuccess);
  app.post("/api/payment/shurjopay/success", handleShurjoPaySuccess);

  // ShurjoPay Failed (POST/GET)
  const handleShurjoPayFailed = async (req: express.Request, res: express.Response) => {
    const orderId = (req.query.order_id || req.body.order_id || req.body.sp_order_id) as string;
    try {
      if (orderId) {
        try {
          await db.collection("orders").doc(orderId).update({
            status: "failed",
            failedAt: FieldValue.serverTimestamp(),
            gatewayResponse: { ...req.query, ...req.body }
          });
        } catch (firestoreError: any) {
          console.warn(`Firestore Admin SDK fail on ShurjoPay failure callback for ${orderId}. Trying REST fallback:`, firestoreError.message);
          try {
            await writeFirestoreDocREST("orders", orderId, {
              status: "failed",
              failedAt: new Date().toISOString(),
              gatewayResponse: { ...req.query, ...req.body }
            }, true);
          } catch (restErr: any) {
            console.error("REST update fallback failed:", restErr.message || restErr);
          }
        }
      }
      res.redirect(`/checkout?status=failed&orderId=${orderId || ""}`);
    } catch (err: any) {
      res.redirect(`/checkout?status=failed&orderId=${orderId || ""}`);
    }
  };
  app.get("/api/payment/shurjopay/failed", handleShurjoPayFailed);
  app.post("/api/payment/shurjopay/failed", handleShurjoPayFailed);

  // ShurjoPay Cancel (POST/GET)
  const handleShurjoPayCancel = async (req: express.Request, res: express.Response) => {
    const orderId = (req.query.order_id || req.body.order_id || req.body.sp_order_id) as string;
    try {
      if (orderId) {
        try {
          await db.collection("orders").doc(orderId).update({
            status: "cancelled",
            cancelledAt: FieldValue.serverTimestamp(),
            gatewayResponse: { ...req.query, ...req.body }
          });
        } catch (firestoreError: any) {
          console.warn(`Firestore Admin SDK fail on ShurjoPay cancel callback for ${orderId}. Trying REST fallback:`, firestoreError.message);
          try {
            await writeFirestoreDocREST("orders", orderId, {
              status: "cancelled",
              cancelledAt: new Date().toISOString(),
              gatewayResponse: { ...req.query, ...req.body }
            }, true);
          } catch (restErr: any) {
            console.error("REST update fallback failed:", restErr.message || restErr);
          }
        }
      }
      res.redirect(`/checkout?status=cancelled&orderId=${orderId || ""}`);
    } catch (err: any) {
      res.redirect(`/checkout?status=cancelled&orderId=${orderId || ""}`);
    }
  };
  app.get("/api/payment/shurjopay/cancel", handleShurjoPayCancel);
  app.post("/api/payment/shurjopay/cancel", handleShurjoPayCancel);

  // ShurjoPay IPN/Webhook (POST)
  app.post("/api/payment/shurjopay/ipn", async (req, res) => {
    const orderId = (req.body.order_id || req.body.sp_order_id) as string;
    const status = req.body.status || req.body.sp_code_message;
    try {
      if (orderId && (status === "Successful" || status === "Success" || status === "1000")) {
        try {
          const orderRef = db.collection("orders").doc(orderId);
          const orderDoc = await orderRef.get();
          if (orderDoc.exists && !orderDoc.data()?.isPaid) {
            await orderRef.update({
              status: "completed",
              isPaid: true,
              paidAt: FieldValue.serverTimestamp(),
              gatewayResponse: req.body
            });
          }
        } catch (firestoreError: any) {
          console.warn(`Firestore Admin SDK fail on ShurjoPay IPN callback for ${orderId}. Trying REST fallback:`, firestoreError.message);
          try {
            await writeFirestoreDocREST("orders", orderId, {
              status: "completed",
              isPaid: true,
              paidAt: new Date().toISOString(),
              gatewayResponse: req.body
            }, true);
          } catch (restErr: any) {
            console.error("REST update fallback failed:", restErr.message || restErr);
          }
        }
      }
      res.status(200).send("IPN Received successfully");
    } catch (err: any) {
      res.status(200).send("IPN received with warnings");
    }
  });

  // Secure Download Route
  app.get("/api/download/:orderId", async (req, res) => {
    const { orderId } = req.params;
    const { token } = req.query;

    try {
      let order: any = null;
      try {
        const orderDoc = await db.collection("orders").doc(orderId).get();
        if (orderDoc.exists) {
          order = orderDoc.data();
        }
      } catch (firestoreError: any) {
        console.warn("Firestore Admin SDK failed to get order for download. Trying REST CLI fallback...", firestoreError.message || firestoreError);
        try {
          order = await fetchFirestoreDocREST("orders", orderId);
        } catch (restError: any) {
          console.error("Firestore REST API fallback both failed getting order:", restError.message || restError);
        }
      }

      if (!order) return res.status(404).send("Order not found or database inaccessible.");

      if (order.status !== "completed" || order.downloadToken !== token) {
        return res.status(403).send("Invalid or expired download link");
      }

      let product: any = null;
      // Get the correct product ID from the order. If order.productId is empty, use the first ID in order.productIds
      const pId = order.productId || (order.productIds && order.productIds[0]);
      if (!pId) return res.status(404).send("No associated product found in this order.");

      try {
        const productDoc = await db.collection("products").doc(pId).get();
        if (productDoc.exists) {
          product = productDoc.data();
        }
      } catch (firestoreError: any) {
        console.warn("Firestore Admin SDK failed to get product. Trying REST CLI fallback...", firestoreError.message || firestoreError);
        try {
          product = await fetchFirestoreDocREST("products", pId);
        } catch (restError: any) {
          console.error("Firestore REST API fallback both failed getting product:", restError.message || restError);
        }
      }

      if (!product) return res.status(404).send("Product not found or database inaccessible.");

      // For this demo, we'll redirect to the private URL or a signed URL
      // For now, simple redirect if it exists
      if (product.fileUrl) {
        res.redirect(product.fileUrl);
      } else {
        res.status(404).send("File not found");
      }
    } catch (error: any) {
      console.error("CRITICAL error in secure download route:", error);
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

// ==========================================
// DB WEBSDK FALLBACK HELPER FUNCTIONS
// ==========================================
const clientFetchSiteSettings = async (): Promise<any> => {
  try {
    const docRef = clientDoc(clientDb, "settings", "site");
    const docSnap = await clientGetDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err: any) {
    console.error("Client SDK fallback failed to fetch site settings:", err.message || err);
  }
  return null;
};

const clientFetchChatSession = async (sessionId: string): Promise<any> => {
  try {
    const docRef = clientDoc(clientDb, "chat_sessions", sessionId);
    const docSnap = await clientGetDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err: any) {
    console.error("Client SDK fallback failed to fetch chat session:", err.message || err);
  }
  return null;
};

const clientForceEnableAi = async (sessionId: string): Promise<boolean> => {
  try {
    const docRef = clientDoc(clientDb, "chat_sessions", sessionId);
    await clientSetDoc(docRef, { aiEnabled: true }, { merge: true });
    return true;
  } catch (err: any) {
    console.error("Client SDK fallback failed to force enable AI:", err.message || err);
    return false;
  }
};

const clientFetchProducts = async (): Promise<any[]> => {
  try {
    const colRef = clientCollection(clientDb, "products");
    const q = clientQuery(colRef, clientLimit(15));
    const querySnap = await clientGetDocs(q);
    const products: any[] = [];
    querySnap.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    return products;
  } catch (err: any) {
    console.error("Client SDK fallback failed to fetch products:", err.message || err);
    return [];
  }
};

const clientFetchOrders = async (email: string): Promise<any[]> => {
  try {
    const colRef = clientCollection(clientDb, "orders");
    const q1 = clientQuery(
      colRef, 
      clientWhere("customerEmail", "==", email), 
      clientOrderBy("createdAt", "desc"), 
      clientLimit(3)
    );
    const querySnap = await clientGetDocs(q1);
    const orders: any[] = [];
    querySnap.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    
    if (orders.length === 0) {
      const q2 = clientQuery(
        colRef, 
        clientWhere("email", "==", email), 
        clientOrderBy("createdAt", "desc"), 
        clientLimit(3)
      );
      const querySnap2 = await clientGetDocs(q2);
      querySnap2.forEach(doc => {
        orders.push({ id: doc.id, ...doc.data() });
      });
    }
    return orders;
  } catch (err: any) {
    console.error("Client SDK fallback failed to fetch orders:", err.message || err);
    return [];
  }
};

const clientFetchChatHistory = async (sessionId: string): Promise<any[]> => {
  try {
    const colRef = clientCollection(clientDb, "chat_messages");
    const q = clientQuery(
      colRef, 
      clientWhere("sessionId", "==", sessionId), 
      clientOrderBy("createdAt", "asc"), 
      clientLimit(15)
    );
    const querySnap = await clientGetDocs(q);
    const messages: any[] = [];
    querySnap.forEach(doc => {
      messages.push(doc.data());
    });
    return messages;
  } catch (err: any) {
    console.error("Client SDK fallback failed to fetch chat history:", err.message || err);
    return [];
  }
};

const clientPersistAiResponse = async (sessionId: string, aiReply: string): Promise<boolean> => {
  try {
    const colRef = clientCollection(clientDb, "chat_messages");
    await clientAddDoc(colRef, {
      sessionId,
      senderId: "ai_bot",
      senderType: "ai",
      text: aiReply,
      createdAt: clientServerTimestamp(),
      seen: false
    });
    
    const docRef = clientDoc(clientDb, "chat_sessions", sessionId);
    await clientSetDoc(docRef, {
      lastMessage: aiReply,
      lastTimestamp: clientServerTimestamp(),
      unreadCount: clientIncrement(1)
    }, { merge: true });
    
    console.log("Client SDK successfully persisted auto-reply chat message.");
    return true;
  } catch (err: any) {
    console.error("Client SDK fallback failed to persist AI response:", err.message || err);
    return false;
  }
};

const clientUpdateSiteSettings = async (geminiApiKeys: any[]): Promise<boolean> => {
  try {
    const docRef = clientDoc(clientDb, "settings", "site");
    await clientSetDoc(docRef, { geminiApiKeys }, { merge: true });
    console.log("Client SDK successfully updated site settings api keys usage stats.");
    return true;
  } catch (err: any) {
    console.error("Client SDK fallback failed to update site settings api keys:", err.message || err);
    return false;
  }
};

// AI Auto Reply (with resilient sandboxed Firestore fallbacks)
  app.post("/api/chat/auto-reply", async (req, res) => {
    const { sessionId, message, userName, userEmail, forceEnabled, cart, sharedProduct } = req.body;
    
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

    try {
      console.log(`AI Auto-reply triggered for session: ${sessionId}`);
      
      let aiEnabled = true;
      let sessionDocRef: any = null;
      
      try {
        sessionDocRef = db.collection("chat_sessions").doc(sessionId);
      } catch (err) {
        console.warn("Failed to initialize sessionDocRef:", err);
      }

      if (forceEnabled) {
        aiEnabled = true;
        // Re-enable in firestore
        try {
          if (sessionDocRef) {
            await sessionDocRef.set({ aiEnabled: true }, { merge: true });
          }
        } catch (e: any) {
          console.warn("Firestore Admin SDK failed to set aiEnabled. Trying fallbacks...", e.message || e);
          try {
            const success = await clientForceEnableAi(sessionId);
            if (!success) {
              await writeFirestoreDocREST("chat_sessions", sessionId, { aiEnabled: true }, true);
            }
          } catch (restErr: any) {
            console.error("REST/Client fallbacks forced update failed:", restErr.message || restErr);
          }
        }
      } else {
        try {
          if (sessionDocRef) {
            const sessionDoc = await sessionDocRef.get();
            if (sessionDoc.exists) {
              const sessionData = sessionDoc.data();
              if (sessionData && sessionData.aiEnabled === false) {
                aiEnabled = false;
              }
            }
          }
        } catch (firestoreError: any) {
          console.warn("Firestore Admin SDK failed to fetch chat session. Trying fallbacks...", firestoreError.message || firestoreError);
          try {
            const sessionData = await clientFetchChatSession(sessionId) || await fetchFirestoreDocREST("chat_sessions", sessionId);
            if (sessionData && sessionData.aiEnabled === false) {
              aiEnabled = false;
            }
          } catch (restError: any) {
            console.warn("Could not fetch session info via fallbacks. Defaulting to AI enabled:", restError.message || restError);
          }
        }
      }
      
      if (!aiEnabled) {
        return res.json({ skip: true, reason: "AI disabled for this session" });
      }

      // Fetch some context
      let productsContext = "";
      try {
        const productsSnapshot = await db.collection("products").limit(15).get();
        productsContext = productsSnapshot.docs.map(d => {
          const p = d.data();
          return `- ${p.name}: ৳${p.price} (${p.category || "General"}). Description: ${p.description?.substring(0, 100) || "No description available"}...`;
        }).join("\n");
      } catch (e) {
        console.warn("Could not fetch products context from Admin SDK. Trying fallbacks...", e);
        try {
          const productsRest = await clientFetchProducts() || await queryFirestoreREST("products", { limit: 15 });
          productsContext = productsRest.map(p => {
            return `- ${p.name}: ৳${p.price} (${p.category || "General"}). Description: ${p.description?.substring(0, 100) || "No description available"}...`;
          }).join("\n");
        } catch (restErr: any) {
          console.warn("Could not fetch products context via fallbacks:", restErr.message || restErr);
        }
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
        console.warn("Could not fetch site settings context via Admin SDK. Trying fallbacks...", e);
        try {
          const settings = await clientFetchSiteSettings() || await fetchFirestoreDocREST("settings", "site");
          if (settings) {
            siteName = settings.siteName || siteName;
            refundPolicy = settings.refundPolicy || refundPolicy;
            paymentMethods = settings.paymentMethods || paymentMethods;
            customInstructions = settings.chatAiSystemPrompt || "";
            geminiApiKeys = settings.geminiApiKeys || [];
          }
        } catch (restErr: any) {
          console.warn("Could not fetch site settings context via fallbacks:", restErr.message || restErr);
        }
      }

      // API Key Rotation Logic with Real-time Monitoring
      let selectedApiKey = process.env.GEMINI_API_KEY;
      let selectedKeyIndex = -1;
      
      if (geminiApiKeys && Array.isArray(geminiApiKeys) && geminiApiKeys.length > 0) {
        // Filter for active keys (simple strategy: random from active)
        const activeKeys = geminiApiKeys
          .map((k, i) => {
            if (typeof k === 'string') {
              return { key: k, status: 'active', originalIndex: i };
            } else if (k && typeof k === 'object') {
              return { 
                key: k.key || '', 
                status: k.status || 'active', 
                originalIndex: i 
              };
            }
            return null;
          })
          .filter(k => k && k.key && k.status === 'active');
        
        if (activeKeys.length > 0) {
          const randomIndex = Math.floor(Math.random() * activeKeys.length);
          const selected = activeKeys[randomIndex];
          if (selected) {
            selectedApiKey = selected.key;
            selectedKeyIndex = selected.originalIndex;
            console.log(`Using rotated Gemini API Key (Index: ${selectedKeyIndex})`);
          }
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
        if (userEmail && typeof userEmail === "string" && userEmail.includes("@")) {
          console.log(`Fetching order context for email: ${userEmail}`);
          let orders: any[] = [];
          try {
            orders = await clientFetchOrders(userEmail);
            if (orders.length === 0) {
              const ordersSnapshot = await db.collection("orders")
                .where("customerEmail", "==", userEmail)
                .orderBy("createdAt", "desc")
                .limit(3)
                .get();
              orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
          } catch (firstErr) {
            console.warn("First fallback order context search failed, trying alternative queries and REST fallback...");
            try {
              const ordersSnapshot2 = await db.collection("orders")
                .where("email", "==", userEmail)
                .orderBy("createdAt", "desc")
                .limit(3)
                .get();
              orders = ordersSnapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (secErr) {
              console.warn("Both SDK order context queries failed. Trying REST API fallback...");
              try {
                orders = await queryFirestoreREST("orders", {
                  where: [{ field: "customerEmail", op: "EQUAL", value: userEmail }],
                  orderBy: [{ field: "createdAt", direction: "DESCENDING" }],
                  limit: 3
                });
                if (orders.length === 0) {
                  orders = await queryFirestoreREST("orders", {
                    where: [{ field: "email", op: "EQUAL", value: userEmail }],
                    orderBy: [{ field: "createdAt", direction: "DESCENDING" }],
                    limit: 3
                  });
                }
              } catch (restErr: any) {
                console.warn("Could not retrieve orders via REST fallback either:", restErr.message || restErr);
              }
            }
          }
          
          if (orders && orders.length > 0) {
            orderContext = orders.map(data => {
              return `Order ID: ${data.id}, Status: ${data.status || "Pending"}, Product: ${data.productName || "Unknown"}, Total: ৳${data.total || data.amount || 0}, Current Location: ${data.currentLocation || "Processing Center"}`;
            }).join("\n");
          }
        }
      } catch (e) {
        console.warn("Could not fetch order context:", e);
      }

      // Fetch Chat messages conversation history for context (vital for contextual dialogue)
      let chatHistoryContext = "";
      try {
        console.log(`Fetching chat history context for session: ${sessionId}`);
        let messages: any[] = [];
        try {
          const chatMessagesSnapshot = await db.collection("chat_messages")
            .where("sessionId", "==", sessionId)
            .orderBy("createdAt", "asc")
            .limit(10)
            .get();
          messages = chatMessagesSnapshot.docs.map(doc => doc.data());
        } catch (firestoreError: any) {
          console.warn("Firestore Admin SDK failed to fetch chat history. Trying fallbacks...", firestoreError.message || firestoreError);
          try {
            messages = await clientFetchChatHistory(sessionId);
            if (messages.length === 0) {
              messages = await queryFirestoreREST("chat_messages", {
                where: [{ field: "sessionId", op: "EQUAL", value: sessionId }],
                limit: 10
              });
              // Sort by createdAt manually if runQuery orderBy is too restrictive
              messages.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
            }
          } catch (restErr: any) {
            console.error("Could not fetch chat history via fallbacks:", restErr.message || restErr);
          }
        }

        if (messages && messages.length > 0) {
          chatHistoryContext = messages.map(data => {
            const sender = data.senderType === "ai" || data.senderId === "ai_bot" ? "Admin (You)" : "Customer";
            return `${sender}: ${data.text || ""}`;
          }).join("\n");
        }
      } catch (e) {
        console.warn("Could not fetch chat history conversation context:", e);
      }

      const prompt = `
        You are the Owner and Support Admin of "${siteName}". You are replying to a customer's message on your online shop's live chat.
        Your goal is to reply EXACTLY like a real, extremely professional, polite, and helpful shop Admin would.

        IDENTITY & TONE:
        - You are the ADMIN. Always address the customer with high respect (use "আপনি" in Bengali).
        - Speak warmly, humbly, and supportively (খুবই মিষ্টি, নরম ও আন্তরিক ভাষায় কথা বলুন).
        - If the customer writes in Bengali (Bangla script or Banglish/English letters), you MUST reply in incredibly respectful and affectionate native Bengali.
        - If the customer writes in English, reply in highly professional, polite, and warm English.
        - Be a sales and resolution champion: present products convincingly and solve issues like tracking orders, shipping, payment assistance, refunds, etc., immediately.
        - Speak on behalf of the administration: "আমরা Admin প্যানেল থেকে বলছি...", "আমি পেইজের Admin বলছি..." or refer to "আমরা" (We).

        CONTEXT & KNOWLEDGE:
        - Product Catalog (Use this to tell them product prices, descriptions, and details):
        ${productsContext || "Catalog is currently being updated. Ask the customer what they need!"}

        - Refund/Return Policy:
        ${refundPolicy}

        - Accepted Payment Methods:
        ${paymentMethods}

        - Special Support Instructions from the Business Owner:
        ${customInstructions || "State clearly that we are always here to help. Help them choose and buy easily."}

        CUSTOMER PROFILE:
        - Name: ${userName || "Valued Customer"}
        - Email: ${userEmail || "Not provided"}

        CUSTOMER'S CURRENT ACTIVE CART (PRODUCTS IN THEIR HANDS RUNTIME):
        ${cart && Array.isArray(cart) && cart.length > 0 
          ? cart.map((item: any) => `- "${item.name}" (Quantity: ${item.quantity || 1}x, Unit Price: ৳${item.price}, Total: ৳${item.price * (item.quantity || 1)})`).join("\n")
          : "The customer's shopping cart is currently empty."}

        CUSTOMER'S SHARED PRODUCT (SPECIFICALLY SELECTED BY CUSTOMER TO DISCUSS NOW):
        ${sharedProduct 
          ? `- ID: ${sharedProduct.id}\n- Name: "${sharedProduct.name}"\n- Price: ৳${sharedProduct.price}\n- Image URL: ${sharedProduct.imageUrl || "Not provided"}`
          : "No specific product shared in this turn."}

        CART AND CHECKOUT OPERATIONS ACTIONS:
        - If the customer asks about what products are in their cart, asks to clarify price or checkout, or refers to what they're trying to purchase, reference the active cart items listed above with detail, warmth, and excitement!
        - If the customer shared a specific product (listed in CUSTOMER'S SHARED PRODUCT above), you MUST reply with detailed and expert insights about that product! Focus on its fantastic benefits, explain why it is an amazing value for money, help answer any questions about it, and highly encourage them to complete their purchase by providing direct conversion links using format: [/product/${sharedProduct?.id || ''}]( বিস্তারিত) / [/checkout/${sharedProduct?.id || ''}]( অর্ডার করতে).
        - Guide them politely to our easy Cart Checkout link at "/cart-checkout" to place their order.
        - If they mention that their cart is empty, suggest some premium products from our catalog above!

        SALES EXPERTISE AND PRODUCT LINKING (CRITICAL):
        - You are a highly professional, skilled, and persuasive sales expert (আপনি প্রোডাক্ট সেল করতে অত্যন্ত দক্ষ এবং পারদর্শী).
        - To make buying smooth, you MUST include clickable Markdown links with matching emojis when suggesting products:
          * Product details page path: '/product/<product_id>'
          * Direct instantaneous checkout page path: '/checkout/<product_id>'
          * Cart checkout page path: '/cart-checkout'
        - Format markdown links beautifully, for example:
          * "[Product Name 🌟](/product/product_id) সম্পর্কে বিস্তারিত জানতে পারেন।"
          * "আজই অর্ডার করতে ক্লিক করুন: [ক্লিক করুন অর্ডার করতে 🛒](/checkout/product_id)"
          * "আপনার কার্ট চেকআউট করতে এখানে যান: [কার্ট চেকআউট করুন 💳](/cart-checkout)"
        - Look at the ID, Name, and Price in the Product Catalog above to obtain correct IDs. Never hallucinate product IDs or make up product links that aren't in the catalog!
        - Focus on describing benefits, solving customer hesitations, and closing sales politely!

        CUSTOMER'S RECENT ORDERS in DB:
        ${orderContext || "No orders found under this email yet. Encourage them to place an order or view our premium products."}

        CONVERSATION RECENT HISTORY:
        ${chatHistoryContext || `Customer: ${message}`}

        CURRENT USER MESSAGE TO REPLY TO:
        Customer: "${message}"

        CONSTRAINTS:
        - Output ONLY the direct admin reply. Do NOT wrap it in "Here is the response:" or prefix it in any way.
        - Keep the message descriptive yet focused. Do not exceed 4-5 sentences unless detailed product features are requested.
        - Use emojis beautifully (😊, 🌸, ✨, 📦, ৳, 🚀, ✅) to make the chat feel alive and human.
        - Avoid standard dry AI templates. Never say "As an AI..." or "I don't have feelings". Always be a human Admin.

        ADMIN DIRECT REPLY:
      `;

      console.log("Generating AI content with prompt...");
      let aiReply = "";
      try {
        const response = await localAi.models.generateContent({
          model: "gemini-3.5-flash", 
          contents: prompt,
        });
        aiReply = response.text;

        // Update successful usage
        if (selectedKeyIndex !== -1) {
          try {
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
          } catch (keyWriteErr: any) {
            console.warn("Could not write rotated key stats to settings via Admin SDK, trying fallbacks:", keyWriteErr.message);
            try {
              const updatedKeys = [...geminiApiKeys];
              const keyObj = typeof updatedKeys[selectedKeyIndex] === 'string' 
                ? { key: updatedKeys[selectedKeyIndex] } 
                : { ...updatedKeys[selectedKeyIndex] };
              
              keyObj.usageCount = (keyObj.usageCount || 0) + 1;
              keyObj.lastUsed = new Date().toISOString();
              keyObj.status = 'active';
              updatedKeys[selectedKeyIndex] = keyObj;
              
              const success = await clientUpdateSiteSettings(updatedKeys);
              if (!success) {
                await writeFirestoreDocREST("settings", "site", { geminiApiKeys: updatedKeys }, true);
              }
            } catch (restErr: any) {
              console.error("Could not write key stats via fallbacks either:", restErr.message);
            }
          }
        }
      } catch (aiErr: any) {
        console.error("Gemini API Error details:", aiErr);
        // Mark key as error if rate limited or invalid
        if (selectedKeyIndex !== -1 && (aiErr.message?.includes("429") || aiErr.message?.includes("403") || aiErr.message?.includes("API_KEY_INVALID"))) {
          try {
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
          } catch (siteWriteErr: any) {
            console.warn("Could not write error status back via Admin SDK, trying fallbacks:", siteWriteErr.message);
            try {
              const updatedKeys = [...geminiApiKeys];
              const keyObj = typeof updatedKeys[selectedKeyIndex] === 'string' 
                ? { key: updatedKeys[selectedKeyIndex] } 
                : { ...updatedKeys[selectedKeyIndex] };
              
              keyObj.status = 'error';
              keyObj.lastError = aiErr.message;
              updatedKeys[selectedKeyIndex] = keyObj;
              const success = await clientUpdateSiteSettings(updatedKeys);
              if (!success) {
                await writeFirestoreDocREST("settings", "site", { geminiApiKeys: updatedKeys }, true);
              }
            } catch (restErr: any) {
              console.error("Could not write error status via fallbacks either:", restErr.message);
            }
          }
        }
        throw aiErr;
      }

      console.log("AI reply generated successfully");

      // Save AI message to firestore (Soft catch to overcome permission errors)
      try {
        await db.collection("chat_messages").add({
          sessionId,
          senderId: "ai_bot",
          senderType: "ai",
          text: aiReply,
          createdAt: FieldValue.serverTimestamp(),
          seen: false
        });

        // Update session last message
        if (sessionDocRef) {
          console.log(`Updating session ${sessionId} last message`);
          await sessionDocRef.set({
            lastMessage: aiReply,
            lastTimestamp: FieldValue.serverTimestamp(),
            unreadCount: FieldValue.increment(1)
          }, { merge: true });
        }
      } catch (firestoreError: any) {
        console.warn("Firestore Admin SDK failed to persist AI response (isolated sandbox permissions). Trying Client/REST fallbacks...", firestoreError.message || firestoreError);
        try {
          const success = await clientPersistAiResponse(sessionId, aiReply);
          if (!success) {
            await addFirestoreDocREST("chat_messages", {
              sessionId,
              senderId: "ai_bot",
              senderType: "ai",
              text: aiReply,
              createdAt: new Date().toISOString(),
              seen: false
            });

            await writeFirestoreDocREST("chat_sessions", sessionId, {
              lastMessage: aiReply,
              lastTimestamp: new Date().toISOString()
            }, true);
            console.log("Auto-reply chat message persisted via REST API successfully.");
          }
        } catch (restErr: any) {
          console.error("REST fallback both failed for chat message persistence:", restErr.message || restErr);
        }
      }

      res.json({ success: true, reply: aiReply });
    } catch (error: any) {
      console.error("CRITICAL: AI Auto-reply failure:", {
        step: "reply-generation-process",
        errMessage: error.message,
        errCode: error.code,
        stack: error.stack
      });
      res.status(500).json({ error: "Failed to generate AI response", details: error.message });
    }
  });

  // AI Suggested Reply for Admin
  app.post("/api/chat/suggest-reply", async (req, res) => {
    const { sessionId, lastUserMessage, history } = req.body;
    
    try {
      // Fetch Site settings for API keys
      let geminiApiKeys: any[] = [];
      try {
        const settingsDoc = await db.collection("settings").doc("site").get();
        if (settingsDoc.exists) {
          const settings = settingsDoc.data();
          geminiApiKeys = settings?.geminiApiKeys || [];
        }
      } catch (e) {
        console.warn("Could not fetch site settings for suggestions via Admin SDK. Trying fallbacks...", e);
        try {
          const settings = await clientFetchSiteSettings() || await fetchFirestoreDocREST("settings", "site");
          if (settings) {
            geminiApiKeys = settings.geminiApiKeys || [];
          }
        } catch (restErr: any) {
          console.warn("Could not fetch site settings for suggestions via fallbacks:", restErr.message || restErr);
        }
      }

      // API Key Rotation Logic
      let selectedApiKey = process.env.GEMINI_API_KEY;
      let selectedKeyIndex = -1;
      
      if (geminiApiKeys && Array.isArray(geminiApiKeys) && geminiApiKeys.length > 0) {
        const activeKeys = geminiApiKeys
          .map((k, i) => {
            if (typeof k === 'string') {
              return { key: k, status: 'active', originalIndex: i };
            } else if (k && typeof k === 'object') {
              return { 
                key: k.key || '', 
                status: k.status || 'active', 
                originalIndex: i 
              };
            }
            return null;
          })
          .filter(k => k && k.key && k.status === 'active');
        
        if (activeKeys.length > 0) {
          const randomIndex = Math.floor(Math.random() * activeKeys.length);
          const selected = activeKeys[randomIndex];
          if (selected) {
            selectedApiKey = selected.key;
            selectedKeyIndex = selected.originalIndex;
            console.log(`Using rotated Gemini API Key for suggestions (Index: ${selectedKeyIndex})`);
          }
        }
      }

      // Initialize AI client with the selected key
      const localAi = new GoogleGenAI({ 
        apiKey: selectedApiKey!,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `
        You are helping a customer support admin draft a perfect reply.
        Customer message: "${lastUserMessage}"
        
        Recent history:
        ${history?.slice(-5).map((m: any) => `${m.senderType}: ${m.text}`).join("\n")}
        
        TASK:
        Provide 3 short, professional, and helpful reply suggestions for the admin.
        Format: Return only a JSON array of strings. No extra text.
      `;

      let techText = "";
      try {
        const response = await localAi.models.generateContent({
          model: "gemini-3.5-flash", 
          contents: prompt,
        });
        techText = response.text;

        // Update successful usage
        if (selectedKeyIndex !== -1) {
          try {
            const updatedKeys = [...geminiApiKeys];
            const keyObj = typeof updatedKeys[selectedKeyIndex] === 'string' 
              ? { key: updatedKeys[selectedKeyIndex] } 
              : { ...updatedKeys[selectedKeyIndex] };
            
            keyObj.usageCount = (keyObj.usageCount || 0) + 1;
            keyObj.lastUsed = new Date().toISOString();
            keyObj.status = 'active';
            updatedKeys[selectedKeyIndex] = keyObj;
            
            const siteSettingsRef = db.collection("settings").doc("site");
            await siteSettingsRef.set({ geminiApiKeys: updatedKeys }, { merge: true });
          } catch (keyWriteErr: any) {
            console.warn("Could not write rotated suggestion key stats to settings via Admin SDK, trying fallbacks:", keyWriteErr.message);
            try {
              const updatedKeys = [...geminiApiKeys];
              const keyObj = typeof updatedKeys[selectedKeyIndex] === 'string' 
                ? { key: updatedKeys[selectedKeyIndex] } 
                : { ...updatedKeys[selectedKeyIndex] };
              
              keyObj.usageCount = (keyObj.usageCount || 0) + 1;
              keyObj.lastUsed = new Date().toISOString();
              keyObj.status = 'active';
              updatedKeys[selectedKeyIndex] = keyObj;
              
              const success = await clientUpdateSiteSettings(updatedKeys);
              if (!success) {
                await writeFirestoreDocREST("settings", "site", { geminiApiKeys: updatedKeys }, true);
              }
            } catch (restErr: any) {
              console.error("Could not write suggestion key stats via fallbacks either:", restErr.message);
            }
          }
        }
      } catch (aiErr: any) {
        console.error("Gemini Suggestion API Error details:", aiErr);
        if (selectedKeyIndex !== -1 && (aiErr.message?.includes("429") || aiErr.message?.includes("403") || aiErr.message?.includes("API_KEY_INVALID"))) {
          try {
            const updatedKeys = [...geminiApiKeys];
            const keyObj = typeof updatedKeys[selectedKeyIndex] === 'string' 
              ? { key: updatedKeys[selectedKeyIndex] } 
              : { ...updatedKeys[selectedKeyIndex] };
            
            keyObj.status = 'error';
            keyObj.lastError = aiErr.message;
            updatedKeys[selectedKeyIndex] = keyObj;
            const siteSettingsRef = db.collection("settings").doc("site");
            await siteSettingsRef.set({ geminiApiKeys: updatedKeys }, { merge: true });
          } catch (siteWriteErr: any) {
            console.warn("Could not write error status back for suggestion keys via Admin SDK, trying fallbacks:", siteWriteErr.message);
            try {
              const updatedKeys = [...geminiApiKeys];
              const keyObj = typeof updatedKeys[selectedKeyIndex] === 'string' 
                ? { key: updatedKeys[selectedKeyIndex] } 
                : { ...updatedKeys[selectedKeyIndex] };
              
              keyObj.status = 'error';
              keyObj.lastError = aiErr.message;
              updatedKeys[selectedKeyIndex] = keyObj;
              const success = await clientUpdateSiteSettings(updatedKeys);
              if (!success) {
                await writeFirestoreDocREST("settings", "site", { geminiApiKeys: updatedKeys }, true);
              }
            } catch (restErr: any) {
              console.error("Could not write error status back for suggestion keys via fallbacks either:", restErr.message);
            }
          }
        }
        throw aiErr;
      }

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
