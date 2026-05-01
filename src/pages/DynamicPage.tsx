import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import Markdown from "react-markdown";
import { motion } from "motion/react";
import { ArrowLeft, Clock } from "lucide-react";

export default function DynamicPage() {
  const { slug } = useParams();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "pages"), where("slug", "==", slug));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setPage({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchPage();
  }, [slug]);

  if (loading) return (
    <div className="py-20 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
    </div>
  );

  if (!page) return (
    <div className="py-20 text-center space-y-4">
      <h1 className="text-4xl font-bold text-gray-900">Page Not Found</h1>
      <p className="text-gray-500">The page you are looking for does not exist.</p>
      <Link to="/" className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">
        Back to Home
      </Link>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-12 pb-20"
    >
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-indigo-600 transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Home
      </Link>

      <div className="space-y-4">
        <h1 className="text-5xl font-black text-gray-900 leading-tight">{page.title}</h1>
        <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
          <Clock className="w-4 h-4" />
          Last updated: {page.updatedAt?.toDate().toLocaleDateString() || "Recently"}
        </div>
      </div>

      <div className="prose prose-indigo max-w-none bg-gray-50 p-8 md:p-12 rounded-[2rem] border border-gray-100">
        <Markdown>{page.content}</Markdown>
      </div>
    </motion.div>
  );
}
