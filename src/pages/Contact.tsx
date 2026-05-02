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
    <div className="max-w-6xl mx-auto space-y-8 sm:space-y-16 pb-20 px-4 sm:px-0">
      <div className="text-center space-y-3 sm:space-y-4 pt-8 sm:pt-12">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block p-2.5 sm:p-3 bg-indigo-50 rounded-xl sm:rounded-2xl mb-1 sm:mb-2"
        >
          <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
        </motion.div>
        <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight uppercase">Contact Support</h1>
        <p className="text-gray-500 max-w-2xl mx-auto text-sm sm:text-lg font-medium px-4">
          Have questions about a product or need help with a download? Our team is here to support your journey.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12">
        <div className="space-y-6 sm:space-y-8">
          <div className="bg-gray-50 p-6 sm:p-8 rounded-[2rem] border border-gray-100 space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Direct Contact</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-white rounded-xl shadow-sm">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Email Us</div>
                  <div className="font-bold text-gray-900 text-sm sm:text-base">{settings.supportEmail}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-white rounded-xl shadow-sm">
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Call Us</div>
                  <div className="font-bold text-gray-900 text-sm sm:text-base">{settings.supportPhone}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-white rounded-xl shadow-sm">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Office</div>
                  <div className="font-bold text-gray-900 text-sm sm:text-base">{settings.supportAddress}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 p-6 sm:p-8 rounded-[2rem] text-white space-y-3 sm:space-y-4 shadow-xl shadow-indigo-100">
            <Globe className="w-6 h-6 sm:w-8 sm:h-8 opacity-50" />
            <h3 className="text-lg sm:text-xl font-bold">24/7 Global Support</h3>
            <p className="text-indigo-100 text-xs sm:text-sm leading-relaxed">
              We provide round-the-clock support for all verified customers. Average response time is under 4 hours.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          {submitted ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 sm:p-12 rounded-[2.5rem] border border-gray-100 shadow-xl text-center space-y-5 sm:space-y-6"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <Send className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Message Received!</h2>
              <p className="text-gray-500 max-w-sm mx-auto text-sm sm:text-base">
                We've received your inquiry and our support team will get back to you shortly.
              </p>
              <button 
                onClick={() => setSubmitted(false)}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all text-sm"
              >
                Send Another Message
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-12 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 shadow-xl space-y-5 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Name</label>
                  <input 
                    name="name" type="text" required
                    className="w-full bg-gray-50 border-none rounded-xl sm:rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Email</label>
                  <input 
                    name="email" type="email" required
                    className="w-full bg-gray-50 border-none rounded-xl sm:rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Subject</label>
                <input 
                  name="subject" type="text" required
                  className="w-full bg-gray-50 border-none rounded-xl sm:rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="What is this about?"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Message</label>
                <textarea 
                  name="message" rows={5} required
                  className="w-full bg-gray-50 border-none rounded-xl sm:rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                  placeholder="Tell us how we can help..."
                />
              </div>
              <button 
                type="submit" disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? "Sending..." : (
                  <>
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
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
