import { Link } from "react-router-dom";
import { useSettings } from "../lib/SettingsContext";
import { Package } from "lucide-react";

export default function Footer() {
  const { settings } = useSettings();

  return (
    <footer className="bg-gray-50 border-t border-gray-100 py-10 sm:py-16 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 sm:gap-10">
          <div className="flex flex-col items-center md:items-start gap-3 sm:gap-4">
            <Link to="/" className="text-lg sm:text-xl font-black tracking-tighter text-indigo-600">
              {settings.siteName}
            </Link>
            <p className="text-[11px] sm:text-sm text-gray-500 text-center md:text-left max-w-md font-medium leading-relaxed">
              {settings.footerDescription || "Quality digital assets for developers, designers, and creators worldwide."}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 sm:gap-x-10 gap-y-2 text-[11px] sm:text-sm font-bold text-gray-600 uppercase tracking-widest">
            <Link to={settings.privacyUrl || "/p/privacy-policy"} className="hover:text-indigo-600 transition-colors">Privacy</Link>
            <Link to={settings.termsUrl || "/p/terms-of-service"} className="hover:text-indigo-600 transition-colors">Terms</Link>
            <Link to="/contact" className="hover:text-indigo-600 transition-colors">Support</Link>
          </div>

          <div className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
            {settings.footerCopyright || settings.footerText || `© ${settings.siteName} 2026`}
          </div>
        </div>
      </div>
    </footer>
  );
}
