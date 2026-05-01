import { Link } from "react-router-dom";
import { useSettings } from "../lib/SettingsContext";

export default function Footer() {
  const { settings } = useSettings();

  return (
    <footer className="bg-gray-50 border-t border-gray-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <Link to="/" className="text-xl font-bold tracking-tighter text-indigo-600">
              {settings.siteName}
            </Link>
            <p className="text-sm text-gray-500 text-center md:text-left max-w-xs">
              {settings.footerDescription || "Quality digital assets for developers, designers, and creators worldwide."}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-medium text-gray-600">
            <Link to={settings.privacyUrl || "/p/privacy-policy"} className="hover:text-indigo-600 transition-colors">Privacy Policy</Link>
            <Link to={settings.termsUrl || "/p/terms-of-service"} className="hover:text-indigo-600 transition-colors">Terms of Service</Link>
            <Link to="/contact" className="hover:text-indigo-600 transition-colors">Contact Support</Link>
          </div>

          <div className="text-sm text-gray-400">
            {settings.footerCopyright || settings.footerText}
          </div>
        </div>
      </div>
    </footer>
  );
}
