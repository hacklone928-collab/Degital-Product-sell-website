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
    <div className="py-20 text-center min-h-[60vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
    </div>
  );

  if (!page) return (
    <div className="py-20 text-center space-y-4 min-h-[60vh] flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white transition-colors">Page Not Found</h1>
      <p className="text-gray-500 dark:text-gray-400">The page you are looking for does not exist.</p>
      <Link to="/" className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all">
        Back to Home
      </Link>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8 sm:space-y-12 pb-20 px-4 sm:px-0"
    >
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Home
      </Link>

      <div className="space-y-4">
        <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white leading-tight uppercase tracking-tighter transition-colors">{page.title}</h1>
        <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm font-medium transition-colors">
          <Clock className="w-4 h-4" />
          Last updated: {page.updatedAt?.toDate().toLocaleDateString() || "Recently"}
        </div>
      </div>

      <div className="prose prose-indigo dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-900/50 p-6 sm:p-12 rounded-[2rem] border border-gray-100 dark:border-gray-800 transition-colors">
        <Markdown>{page.content}</Markdown>
      </div>
    </motion.div>
  );
}
