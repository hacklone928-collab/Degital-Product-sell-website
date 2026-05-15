import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { handleFirestoreError, OperationType } from "./firestoreUtils";

interface SiteSettings {
  siteName: string;
  tabTitle?: string;
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
  heroTitleSizeMobile?: string;
  heroTitleSizeDesktop?: string;
  heroSubtitleSizeMobile?: string;
  heroSubtitleSizeDesktop?: string;
  heroTitleColor?: string;
  heroSubtitleColor?: string;
  enableStripe?: boolean;
  enableLocal?: boolean;
  enableCOD?: boolean;
  enableBinancePay?: boolean;
  binanceId?: string;
  binanceQR?: string;
  enablePayoneer?: boolean;
  payoneerEmail?: string;
  heroBanners?: { id: string, imageUrl: string, title?: string, subtitle?: string, link?: string, buttonText?: string }[];
  hiddenCategories?: string[];
  cartText?: string;
  viewText?: string;
  buyText?: string;
  cartColor?: string;
  viewColor?: string;
  buyColor?: string;
  cartTextColor?: string;
  viewTextColor?: string;
  buyTextColor?: string;
  brandColor?: string;
  brandSecondaryColor?: string;
  useBrandGradient?: boolean;
  socialLinks?: { platform: string; url: string; icon: string }[];
  invoiceTitle?: string;
  invoiceSubtitle?: string;
  invoiceFooter?: string;
  invoiceNote?: string;
  tabPermissions?: Record<string, string[]>;
  requireReviewApproval?: boolean;
  showReviews?: boolean;
  loadingTitle?: string;
  loadingSubtitle?: string;
  loadingStyle?: "classic" | "minimal" | "modern" | "bento" | "waves" | "dots" | "cube" | "bars" | "ring";
  adminLayout?: "classic" | "modern";
  showThemeToggle?: boolean;
  themeToggleStyle?: "classic" | "minimal" | "ios" | "glass" | "creative" | "glow" | "landscape";
  themeTogglePosition?: "header-left" | "header-center" | "header-right" | "profile-page";
  themeToggleSize?: "sm" | "md" | "lg";
}

const defaultSettings: SiteSettings = {
  siteName: "Digital Marketplace",
  tabTitle: "Digital Marketplace",
  heroTitle: "Premium Digital Assets for Makers",
  heroSubtitle: "Unlock your project's potential with high-quality software, plugins, and scripts.",
  footerText: "© 2026. All rights reserved.",
  footerCopyright: "© 2026. All rights reserved.",
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
  heroTitleSizeMobile: "28px",
  heroTitleSizeDesktop: "60px",
  heroSubtitleSizeMobile: "12px",
  heroSubtitleSizeDesktop: "18px",
  heroTitleColor: "#ffffff",
  heroSubtitleColor: "#ffffffcc",
  enableStripe: true,
  enableLocal: true,
  enableCOD: true,
  enableBinancePay: false,
  binanceId: "",
  binanceQR: "",
  enablePayoneer: false,
  payoneerEmail: "",
  heroBanners: [],
  hiddenCategories: [],
  cartText: "Cart",
  viewText: "View",
  buyText: "Buy",
  cartColor: "#f9fafb",
  viewColor: "#f9fafb",
  buyColor: "#4f46e5",
  cartTextColor: "#6b7280",
  viewTextColor: "#6b7280",
  buyTextColor: "#ffffff",
  brandColor: "#4f46e5",
  brandSecondaryColor: "#818cf8",
  useBrandGradient: false,
  socialLinks: [],
  invoiceTitle: "Official Invoice",
  invoiceSubtitle: "Digital Asset Purchase",
  invoiceFooter: "Thank you for choosing our platform for your digital assets.",
  invoiceNote: "This is a computer generated invoice and does not require a physical signature.",
  tabPermissions: {},
  requireReviewApproval: false,
  showReviews: true,
  loadingTitle: "Digital Marketplace",
  loadingSubtitle: "Syncing Workspace",
  loadingStyle: "modern",
  adminLayout: "classic",
  showThemeToggle: true,
  themeToggleStyle: "classic",
  themeTogglePosition: "header-right",
  themeToggleSize: "md",
};

const SettingsContext = createContext<{ settings: SiteSettings; loading: boolean }>({
  settings: defaultSettings,
  loading: true,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const cached = localStorage.getItem("site_settings");
      if (cached) {
        return { ...defaultSettings, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.error("Failed to load cached settings:", e);
    }
    return defaultSettings;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "site"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SiteSettings;
        const mergedSettings = { ...defaultSettings, ...data };
        setSettings(mergedSettings);
        
        // Cache settings for next load
        try {
          localStorage.setItem("site_settings", JSON.stringify(mergedSettings));
        } catch (e) {
          console.error("Failed to cache settings:", e);
        }
        
        // Dynamic Title and Favicon
        if (mergedSettings.tabTitle || mergedSettings.siteName) {
          document.title = mergedSettings.tabTitle || mergedSettings.siteName;
        }
        if (mergedSettings.faviconUrl) {
          let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = mergedSettings.faviconUrl;
        }
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "settings/site");
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
