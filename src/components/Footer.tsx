import React from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../lib/SettingsContext";
import { Package, Facebook, Twitter, Instagram, Youtube, Linkedin, Github, Send, Music, Pin, ExternalLink, Phone } from "lucide-react";

export default function Footer() {
  const { settings } = useSettings();

  const getIcon = (platform: string) => {
    switch (platform) {
      case "Facebook": return Facebook;
      case "Twitter": return Twitter;
      case "Instagram": return Instagram;
      case "YouTube": return Youtube;
      case "LinkedIn": return Linkedin;
      case "GitHub": return Github;
      case "WhatsApp": return Phone;
      case "Telegram": return Send;
      case "TikTok": return Music;
      case "Pinterest": return Pin;
      default: return ExternalLink;
    }
  };

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 pt-8 pb-24 sm:py-16 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-10">
          <div className="flex flex-col items-center md:items-start gap-2 sm:gap-4">
            <Link 
              to="/" 
              className="text-lg sm:text-xl font-black tracking-tighter transition-opacity hover:opacity-90"
              style={{ 
                color: settings.useBrandGradient ? 'transparent' : (settings.brandColor || "#4f46e5"),
                backgroundImage: settings.useBrandGradient 
                  ? `linear-gradient(to right, ${settings.brandColor || "#4f46e5"}, ${settings.brandSecondaryColor || "#818cf8"})` 
                  : 'none',
                backgroundClip: settings.useBrandGradient ? 'text' : 'border-box',
                WebkitBackgroundClip: settings.useBrandGradient ? 'text' : 'border-box',
              }}
            >
              {settings.siteName}
            </Link>
            <p className="text-[11px] sm:text-sm text-gray-500 dark:text-gray-400 text-center md:text-left max-w-md font-medium leading-relaxed">
              {settings.footerDescription || "Quality digital assets for developers, designers, and creators worldwide."}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 sm:gap-6">
            <div className="flex flex-wrap justify-center gap-x-6 sm:gap-x-10 gap-y-2 text-[11px] sm:text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
              <Link to={settings.privacyUrl || "/p/privacy-policy"} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy</Link>
              <Link to={settings.termsUrl || "/p/terms-of-service"} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms</Link>
              <Link to="/contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Support</Link>
            </div>

            {settings.socialLinks && settings.socialLinks.length > 0 && (
              <div className="flex items-center gap-4">
                {settings.socialLinks.map((social, idx) => (
                  <a 
                    key={idx}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all group"
                    title={social.platform}
                  >
                    {React.createElement(getIcon(social.platform), { className: "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" })}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="text-[9px] sm:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
            {settings.footerCopyright || settings.footerText || `© ${settings.siteName} 2026`}
          </div>
        </div>
      </div>
    </footer>
  );
}
