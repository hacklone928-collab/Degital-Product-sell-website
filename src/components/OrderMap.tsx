import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { Map as MapIcon, Users, ShoppingCart, TrendingUp, MapPin, Clock, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";

// Fix for default marker icon in leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Order {
  id: string;
  customerName: string;
  division: string;
  district: string;
  upazila: string;
  union?: string;
  village?: string;
  lat: number;
  lng: number;
  amount: number;
  productName: string;
  createdAt: any;
}

const BD_CENTER: [number, number] = [23.6850, 90.3563];

export default function OrderMap() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    topDivision: "",
    recentOrder: null as Order | null,
    highestValue: 0
  });

  useEffect(() => {
    // Fetch Bangladesh Divisions GeoJSON
    const fetchGeoData = async () => {
      const urls = [
        "https://raw.githubusercontent.com/highcharts/map-collection-dist/master/countries/bd/bd-all.geo.json",
        "https://raw.githubusercontent.com/nuhil/bangladesh-geojson/master/bd-divisions.json",
        "https://raw.githubusercontent.com/sm-mursalin/bangladesh-geojson/master/bd-divisions.json"
      ];

      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const text = await res.text();
            try {
              const data = JSON.parse(text);
              setGeoData(data);
              return;
            } catch (parseErr) {
              console.error(`JSON parse error for ${url}:`, parseErr, "Content start:", text.substring(0, 100));
            }
          }
        } catch (err) {
          console.warn(`Failed to load GeoJSON from ${url}`, err);
        }
      }
      console.error("All GeoJSON sources failed.");
    };

    fetchGeoData();

    // Listen for recent orders
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      // Filter out orders without lat/lng
      const validOrders = ordersData.filter(o => o.lat && o.lng);
      setOrders(validOrders);

      if (validOrders.length > 0) {
        const divisionCounts: Record<string, number> = {};
        let highest = 0;
        validOrders.forEach(o => {
          divisionCounts[o.division] = (divisionCounts[o.division] || 0) + 1;
          if (o.amount > highest) highest = o.amount;
        });

        const topDiv = Object.entries(divisionCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || "N/A";

        setStats({
          totalOrders: snapshot.size,
          topDivision: topDiv,
          recentOrder: validOrders[0],
          highestValue: highest
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const customIcon = (order: Order) => L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 bg-indigo-500/20 rounded-full animate-ping"></div>
        <div class="absolute w-4 h-4 bg-indigo-600 rounded-full border-2 border-white shadow-lg"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<ShoppingCart className="w-5 h-5 text-indigo-500" />}
          label="Total Orders"
          value={stats.totalOrders}
          subValue="Live Tracking"
        />
        <StatCard 
          icon={<MapIcon className="w-5 h-5 text-emerald-500" />}
          label="Top Region"
          value={stats.topDivision}
          subValue="Most Active"
        />
        <StatCard 
          icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
          label="Peak Order Value"
          value={`৳${stats.highestValue.toLocaleString()}`}
          subValue="Maximum"
        />
        <StatCard 
          icon={<Users className="w-5 h-5 text-rose-500" />}
          label="Active Target"
          value="Bangladesh"
          subValue="Nationwide"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
        {/* Main Map */}
        <div className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-[32px] border-2 border-gray-100 dark:border-gray-800 overflow-hidden relative shadow-sm group">
          {loading && (
            <div className="absolute inset-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Initializing Map...</span>
              </div>
            </div>
          )}

          <MapContainer 
            center={BD_CENTER} 
            zoom={7} 
            className="w-full h-full z-0"
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            
            {geoData && (
              <GeoJSON 
                data={geoData} 
                style={() => ({
                  fillColor: "#6366f1",
                  weight: 1,
                  opacity: 0.1,
                  color: "#6366f1",
                  fillOpacity: 0.03
                })}
              />
            )}

            {orders.map(order => (
              <Marker 
                key={order.id} 
                position={[order.lat, order.lng]} 
                icon={customIcon(order)}
              >
                <Popup className="custom-popup">
                  <div className="p-2 min-w-[150px]">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                         {order.customerName[0]}
                       </div>
                       <span className="text-xs font-bold text-gray-900">{order.customerName}</span>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                         <MapPin className="w-3 h-3" /> 
                         {order.village && `${order.village}, `}
                         {order.union && `${order.union}, `}
                         {order.upazila}, {order.district}
                       </p>
                       <p className="text-[10px] text-gray-900 font-bold">
                         ৳{order.amount.toLocaleString()} • {order.productName}
                       </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map Overlay Controls */}
          <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-2">
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest">Live Feed active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Feed */}
        <div className="lg:col-span-4 flex flex-col gap-6 h-full">
          <div className="bg-white dark:bg-gray-900 rounded-[32px] border-2 border-gray-100 dark:border-gray-800 p-6 flex flex-col h-full shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> Recent Activity
              </h3>
              <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-1 rounded-lg uppercase">
                {orders.length} Traced
              </span>
            </div>

            <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {orders.map((order, idx) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 bg-gray-50 dark:bg-gray-950/50 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-gray-900 dark:text-white">{order.customerName}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                          {order.union ? `${order.union}, ` : ''}{order.upazila}, {order.district}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400">
                        ৳{order.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] text-gray-400 dark:text-gray-500 italic truncate max-w-[150px]">
                         {order.productName}
                       </span>
                       <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 transition-all">
                         <ExternalLink className="w-3 h-3" />
                       </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subValue }: { icon: React.ReactNode, label: string, value: string | number, subValue: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border-2 border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
          {icon}
        </div>
        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</span>
      </div>
      <div>
        <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{value}</div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-1">{subValue}</div>
      </div>
    </div>
  );
}
