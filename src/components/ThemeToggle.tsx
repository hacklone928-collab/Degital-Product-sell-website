import React from 'react';
import { Sun, Moon, CloudSun, CloudMoon, Sparkles, Star } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useSettings } from '../lib/SettingsContext';

export default function ThemeToggle({ className, isFloating }: { className?: string, isFloating?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const { settings } = useSettings();
  const style = settings.themeToggleStyle || 'classic';
  const size = settings.themeToggleSize || 'md';

  const sizeClasses = {
    sm: isFloating ? "w-10 h-10" : "p-1.5",
    md: isFloating ? "w-12 h-12" : "p-2",
    lg: isFloating ? "w-16 h-16" : "p-3",
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 28,
  };

  const commonProps = {
    onClick: toggleTheme,
    title: theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode',
  };

  if (style === 'minimal') {
    return (
      <button
        {...commonProps}
        className={cn(
          "relative rounded-full flex items-center justify-center transition-all duration-500 overflow-hidden",
          "bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700",
          "hover:scale-110 active:scale-95 group",
          size === 'sm' ? "w-10 h-10" : size === 'lg' ? "w-16 h-16" : "w-12 h-12",
          className
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/10 group-hover:to-purple-500/10 transition-colors" />
        <AnimatePresence mode="wait" initial={false}>
          {theme === 'light' ? (
            <motion.div
              key="sun"
              initial={{ y: 20, rotate: -45, opacity: 0 }}
              animate={{ y: 0, rotate: 0, opacity: 1 }}
              exit={{ y: -20, rotate: 45, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-amber-500 z-10"
            >
              <Sun size={iconSizes[size]} className="fill-amber-500/20" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ y: 20, rotate: 45, opacity: 0 }}
              animate={{ y: 0, rotate: 0, opacity: 1 }}
              exit={{ y: -20, rotate: -45, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-indigo-400 z-10"
            >
              <Moon size={iconSizes[size]} className="fill-indigo-400/20" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  }

  if (style === 'ios') {
    const scale = size === 'sm' ? 0.8 : size === 'lg' ? 1.4 : 1;
    return (
      <button
        {...commonProps}
        style={{ transform: `scale(${scale})` }}
        className={cn(
          "relative w-14 h-8 rounded-full p-1 transition-colors duration-500 origin-center shrink-0",
          theme === 'light' ? "bg-indigo-100" : "bg-gray-800",
          className
        )}
      >
        <motion.div
          animate={{ x: theme === 'light' ? 0 : 24 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center shadow-lg transform transition-colors duration-500",
            theme === 'light' ? "bg-white text-amber-500" : "bg-indigo-600 text-white"
          )}
        >
          {theme === 'light' ? <Sun size={14} fill="currentColor" fillOpacity={0.2} /> : <Moon size={14} fill="currentColor" fillOpacity={0.2} />}
        </motion.div>
      </button>
    );
  }

  if (style === 'glass') {
    return (
      <button
        {...commonProps}
        className={cn(
          "relative rounded-full flex items-center justify-center transition-all duration-700",
          "bg-white/10 dark:bg-black/10 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden group",
          size === 'sm' ? "w-10 h-10" : size === 'lg' ? "w-20 h-20" : "w-14 h-14",
          className
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <AnimatePresence mode="wait">
          {theme === 'light' ? (
            <motion.div
              key="glass-sun"
              initial={{ scale: 0, rotate: -180, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 2, rotate: 180, opacity: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
              className="relative text-amber-400 z-10"
            >
              <Sun size={size === 'lg' ? 36 : size === 'sm' ? 20 : 28} className="drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 bg-amber-400/30 blur-xl rounded-full -z-10"
              />
            </motion.div>
          ) : (
            <motion.div
              key="glass-moon"
              initial={{ scale: 0, rotate: 180, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 2, rotate: -180, opacity: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
              className="relative text-indigo-300 z-10"
            >
              <Moon size={size === 'lg' ? 36 : size === 'sm' ? 20 : 28} className="drop-shadow-[0_0_8px_rgba(165,180,252,0.5)]" />
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute inset-0 bg-indigo-400/30 blur-xl rounded-full -z-10"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  }

  if (style === 'creative') {
    return (
      <button
        {...commonProps}
        className={cn(
          "relative overflow-hidden rounded-[2rem] transition-all duration-500 ring-4",
          theme === 'light' ? "bg-sky-400 ring-sky-100" : "bg-slate-900 ring-slate-800",
          size === 'sm' ? "w-16 h-8" : size === 'lg' ? "w-28 h-14" : "w-20 h-10",
          className
        )}
      >
        {/* Sky Elements */}
        <AnimatePresence>
          {theme === 'light' ? (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className="absolute top-2 left-4 w-4 h-1.5 bg-white/60 rounded-full blur-[1px]" />
              <div className="absolute top-4 right-6 w-6 h-2 bg-white/40 rounded-full blur-[2px]" />
            </motion.div>
          ) : (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              <Star className="absolute top-2 left-6 w-1 h-1 text-white fill-white animate-pulse" />
              <Star className="absolute top-4 right-8 w-0.5 h-0.5 text-white fill-white opacity-50" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={{ x: theme === 'light' ? 0 : (size === 'sm' ? 32 : size === 'lg' ? 56 : 40) }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className={cn(
            "absolute top-1 left-1 bottom-1 aspect-square rounded-full flex items-center justify-center shadow-inner",
            theme === 'light' ? "bg-amber-100" : "bg-slate-100"
          )}
        >
          {theme === 'light' ? (
            <Sun size={iconSizes[size]} className="text-amber-500 fill-amber-500/20" />
          ) : (
            <div className="relative">
              <Moon size={iconSizes[size]} className="text-slate-400 fill-slate-400/20" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-slate-300 rounded-full opacity-40 blur-[1px]" />
            </div>
          )}
        </motion.div>
      </button>
    );
  }

  if (style === 'glow') {
    return (
      <button
        {...commonProps}
        className={cn(
          "relative rounded-full flex items-center justify-center transition-all duration-500 overflow-hidden",
          "bg-white dark:bg-black/40 shadow-2xl border border-gray-100 dark:border-white/10 group",
          size === 'sm' ? "w-10 h-10" : size === 'lg' ? "w-20 h-20" : "w-14 h-14",
          className
        )}
      >
        <div className={cn(
          "absolute inset-0 transition-opacity duration-1000",
          theme === 'light' ? "bg-amber-500/5" : "bg-indigo-500/10"
        )} />
        
        <AnimatePresence mode="wait">
          {theme === 'light' ? (
            <motion.div
              key="glow-sun"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="relative z-10"
            >
              <Sun size={size === 'lg' ? 42 : size === 'sm' ? 24 : 32} className="text-amber-500 fill-amber-500/40" />
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-amber-500 blur-2xl rounded-full -z-10"
              />
            </motion.div>
          ) : (
            <motion.div
              key="glow-moon"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="relative z-10"
            >
              <Moon size={size === 'lg' ? 42 : size === 'sm' ? 24 : 32} className="text-indigo-400 fill-indigo-400/40" />
              <motion.div
                animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-indigo-500 blur-2xl rounded-full -z-10"
              />
              <motion.div
                animate={{ x: [0, 5, 0], y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -top-4 -right-4"
              >
                <Star className="w-2 h-2 text-white fill-white opacity-50" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  }

  if (style === 'landscape') {
    return (
      <button
        {...commonProps}
        className={cn(
          "relative overflow-hidden rounded-[2rem] transition-all duration-700 ring-2",
          theme === 'light' ? "bg-sky-300 ring-sky-100" : "bg-slate-950 ring-slate-800",
          size === 'sm' ? "w-16 h-8" : size === 'lg' ? "w-32 h-16" : "w-24 h-12",
          className
        )}
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Mountains */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 h-1/2 transition-colors duration-700",
            theme === 'light' ? "bg-emerald-500" : "bg-slate-900"
          )} style={{ clipPath: 'polygon(0 100%, 0 40%, 20% 60%, 40% 30%, 65% 65%, 80% 25%, 100% 50%, 100% 100%)' }} />
          
          <AnimatePresence>
            {theme === 'light' ? (
              <motion.div
                key="day-clouds"
                initial={{ x: -100 }}
                animate={{ x: 100 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute top-2 flex gap-4"
              >
                <div className="w-8 h-3 bg-white/60 rounded-full blur-[1px]" />
                <div className="w-12 h-4 bg-white/40 rounded-full blur-[2px]" />
              </motion.div>
            ) : (
              <motion.div
                key="night-stars"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0"
              >
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.2, 0.8, 0.2] }}
                    transition={{ duration: 2 + i, repeat: Infinity }}
                    className="absolute bg-white rounded-full"
                    style={{
                      width: Math.random() * 2 + 1,
                      height: Math.random() * 2 + 1,
                      top: `${Math.random() * 50}%`,
                      left: `${Math.random() * 100}%`,
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          animate={{ 
            x: theme === 'light' ? 0 : (size === 'sm' ? 32 : size === 'lg' ? 64 : 48),
            y: theme === 'light' ? 0 : 4
          }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className={cn(
            "absolute top-1 left-1 bottom-1 aspect-square rounded-full flex items-center justify-center",
            theme === 'light' ? "bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]" : "bg-slate-100 shadow-[0_0_15px_rgba(255,255,255,0.4)]"
          )}
        >
          {theme === 'light' ? (
            <Sun size={iconSizes[size] * 0.8} className="text-white fill-white/20" />
          ) : (
            <Moon size={iconSizes[size] * 0.8} className="text-slate-400 fill-slate-400/20" />
          )}
        </motion.div>
      </button>
    );
  }

  // Classic Style (Default)
  return (
    <button
      {...commonProps}
      className={cn(
        "relative rounded-xl transition-all duration-300 shrink-0",
        "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400",
        "shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/50 flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      <AnimatePresence mode="wait">
        {theme === 'light' ? (
          <motion.div
            key="sun"
            initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center text-amber-500"
          >
            <Sun size={iconSizes[size]} className="fill-amber-500/10" />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center text-indigo-400"
          >
            <Moon size={iconSizes[size]} className="fill-indigo-400/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
