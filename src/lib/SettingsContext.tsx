import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

interface SiteSettings {
  siteName: string;
  heroTitle: string;
  heroSubtitle: string;
  footerText: string;
  footerCopyright?: string;
  footerDescription?: string;
  logoUrl?: string;
  faviconUrl?: string;
  privacyUrl?: string;
  termsUrl?: string;
  supportEmail: string;
  supportPhone: string;
  supportAddress: string;
  stat1Label: string;
  stat1Value: string;
  stat2Label: string;
  stat2Value: string;
  stat3Label: string;
  stat3Value: string;
  showHero?: boolean;
  showTicker?: boolean;
  tickerBgColor?: string;
  tickerTextColor?: string;
  tickerSpeed?: number;
  tickerText?: string;
  bkashNumber?: string;
  nagadNumber?: string;
  rocketNumber?: string;
  bkashLogo?: string;
  nagadLogo?: string;
  rocketLogo?: string;
  heroBannerUrl?: string;
  enableStripe?: boolean;
  enableLocal?: boolean;
  enableCOD?: boolean;
  heroBanners?: { id: string, imageUrl: string, title?: string, subtitle?: string, link?: string, buttonText?: string }[];
  hiddenCategories?: string[];
}

const defaultSettings: SiteSettings = {
  siteName: "DigiVault",
  heroTitle: "Premium Digital Assets for Makers",
  heroSubtitle: "Unlock your project's potential with high-quality software, plugins, and scripts.",
  footerText: "© 2026 DigiVault. All rights reserved.",
  footerCopyright: "© 2026 DigiVault. All rights reserved.",
  footerDescription: "Quality digital assets for developers, designers, and creators worldwide.",
  privacyUrl: "/p/privacy-policy",
  termsUrl: "/p/terms-of-service",
  supportEmail: "support@digivault.com",
  supportPhone: "+880 1234-567890",
  supportAddress: "Dhaka, Bangladesh",
  stat1Label: "Total Users",
  stat1Value: "50k+",
  stat2Label: "Digital Assets",
  stat2Value: "1,200+",
  stat3Label: "Success Rate",
  stat3Value: "99.9%",
  showHero: true,
  showTicker: true,
  tickerBgColor: "#4f46e5",
  tickerTextColor: "#ffffff",
  tickerSpeed: 25,
  tickerText: "🔥 Top Selling Products",
  bkashNumber: "01700000000",
  nagadNumber: "01800000000",
  rocketNumber: "01900000000",
  bkashLogo: "https://freelogopng.com/images/all_img/1656234745bkash-app-logo-png.png",
  nagadLogo: "https://freelogopng.com/images/all_img/1679248787nagad-logo-png.png",
  rocketLogo: "https://freelogopng.com/images/all_img/1679249767rocket-logo-png.png",
  heroBannerUrl: "",
  enableStripe: true,
  enableLocal: true,
  enableCOD: true,
  heroBanners: [],
  hiddenCategories: []
};

const SettingsContext = createContext<{ settings: SiteSettings; loading: boolean }>({
  settings: defaultSettings,
  loading: true,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "site"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SiteSettings;
        setSettings({ ...defaultSettings, ...data });
        
        // Dynamic Title and Favicon
        if (data.siteName) document.title = data.siteName;
        if (data.faviconUrl) {
          let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = data.faviconUrl;
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
