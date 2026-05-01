import { useState } from "react";
import { motion } from "motion/react";
import { Mail, MessageSquare, Send, Globe, Phone, MapPin } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestoreUtils";
import { useSettings } from "../lib/SettingsContext";

export default function Contact() {
  const { settings } = useSettings();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      subject: formData.get("subject"),
      message: formData.get("message"),
      status: "open",
      createdAt: serverTimestamp(),
    };
    try {
      await addDoc(collection(db, "support_tickets"), payload);
      setSubmitted(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "support_tickets");
      alert("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-20">
      <div className="text-center space-y-4 pt-12">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block p-3 bg-indigo-50 rounded-2xl mb-2"
        >
          <MessageSquare className="w-8 h-8 text-indigo-600" />
        </motion.div>
        <h1 className="text-5xl font-black text-gray-900 tracking-tight">Contact Support</h1>
        <p className="text-gray-500 max-w-2xl mx-auto text-lg font-medium">
          Have questions about a product or need help with a download? Our team is here to support your journey.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="space-y-8">
          <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 space-y-6">
            <h3 className="text-xl font-bold text-gray-900">Direct Contact</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Mail className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Us</div>
                  <div className="font-bold text-gray-900">{settings.supportEmail}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Phone className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Call Us</div>
                  <div className="font-bold text-gray-900">{settings.supportPhone}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <MapPin className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Office</div>
                  <div className="font-bold text-gray-900">{settings.supportAddress}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 p-8 rounded-[2rem] text-white space-y-4 shadow-xl shadow-indigo-100">
            <Globe className="w-8 h-8 opacity-50" />
            <h3 className="text-xl font-bold">24/7 Global Support</h3>
            <p className="text-indigo-100 text-sm leading-relaxed">
              We provide round-the-clock support for all verified customers. Average response time is under 4 hours.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          {submitted ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-12 rounded-[2.5rem] border border-gray-100 shadow-xl text-center space-y-6"
            >
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <Send className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Message Received!</h2>
              <p className="text-gray-500 max-w-sm mx-auto">
                We've received your inquiry and our support team will get back to you shortly.
              </p>
              <button 
                onClick={() => setSubmitted(false)}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
              >
                Send Another Message
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Name</label>
                  <input 
                    name="name" type="text" required
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Email</label>
                  <input 
                    name="email" type="email" required
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Subject</label>
                <input 
                  name="subject" type="text" required
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="What is this about?"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Message</label>
                <textarea 
                  name="message" rows={6} required
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Tell us how we can help..."
                />
              </div>
              <button 
                type="submit" disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? "Sending..." : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Support Message
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
