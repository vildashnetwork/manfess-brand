import { useEffect, useState } from "react";

/**
 * Client-only host for the react-router-dom SPA.
 * TanStack Start handles SSR shell; the entire app routing happens here.
 */
export function SpaHost() {
  const [App, setApp] = useState<React.ComponentType | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing...");
  const [loadingDots, setLoadingDots] = useState("");

  useEffect(() => {
    let mounted = true;
    let progressInterval: NodeJS.Timeout;
    let dotInterval: NodeJS.Timeout;
    let currentProgress = 0;

    // Status messages for different phases
    const statusMessages = [
      { progress: 5, text: "Starting MANFESS..." },
      { progress: 15, text: "Loading modules..." },
      { progress: 25, text: "Connecting to services..." },
      { progress: 35, text: "Initializing components..." },
      { progress: 50, text: "Building user interface..." },
      { progress: 65, text: "Loading your data..." },
      { progress: 75, text: "Preparing dashboard..." },
      { progress: 85, text: "Almost there..." },
      { progress: 93, text: "Finalizing setup..." },
      { progress: 98, text: "Ready to launch!" },
    ];

    // Update progress with random increments
    progressInterval = setInterval(() => {
      if (!mounted) return;
      
      const increment = Math.floor(Math.random() * 4) + 1;
      currentProgress = Math.min(currentProgress + increment, 98);
      setProgress(currentProgress);

      // Update status text based on progress
      const currentStatus = statusMessages.reduce((prev, curr) => {
        if (curr.progress <= currentProgress) return curr;
        return prev;
      }, statusMessages[0]);
      
      if (currentStatus) {
        setStatusText(currentStatus.text);
      }
    }, 150);

    // Loading dots animation
    dotInterval = setInterval(() => {
      if (!mounted) return;
      setLoadingDots(prev => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 400);

    // Actually load the app
    import("./App")
      .then((m) => {
        if (mounted) {
          // Complete the loading
          setProgress(100);
          setStatusText("Welcome to MANFESS!");
          // Small delay to show 100% before rendering
          setTimeout(() => {
            if (mounted) setApp(() => m.default);
          }, 600);
        }
      })
      .catch((error) => {
        console.error("Failed to load app:", error);
        if (mounted) {
          setStatusText("Error loading application");
          setProgress(0);
        }
      });

    return () => {
      mounted = false;
      clearInterval(progressInterval);
      clearInterval(dotInterval);
    };
  }, []);

  if (!App) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo / Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-green-600 flex items-center justify-center shadow-2xl">
                <span className="text-white text-4xl font-bold font-display">M</span>
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                S
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white font-display">
              MANFESS
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Academic Management System
            </p>
          </div>

          {/* Progress Card */}
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl p-6 border border-stone-200 dark:border-stone-700">
            {/* Status Text */}
            <div className="text-center mb-4">
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {statusText}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {loadingDots}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="relative">
              <div className="overflow-hidden h-3 rounded-full bg-stone-100 dark:bg-stone-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300 ease-out"
                  style={{ 
                    width: `${progress}%`,
                    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                />
              </div>
              
              {/* Progress Percentage */}
              <div className="absolute -top-5 right-0 text-xs font-mono font-bold text-green-600 dark:text-green-400">
                {progress}%
              </div>
            </div>

            {/* Tip Messages */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {progress < 30 && " Preparing your workspace..."}
                {progress >= 30 && progress < 60 && " Loading your data..."}
                {progress >= 60 && progress < 85 && " Almost there..."}
                {progress >= 85 && progress < 100 && " Finalizing..."}
                {progress >= 100 && " Welcome to MANFESS!"}
              </p>
            </div>

            {/* Animated Dots */}
            <div className="flex justify-center mt-4 gap-1.5">
              {[0, 0.15, 0.3].map((delay, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-green-500/60"
                  style={{
                    animation: 'pulse-dot 1.4s ease-in-out infinite',
                    animationDelay: `${delay}s`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-[10px] text-gray-400 dark:text-gray-600 tracking-wider uppercase font-medium">
              MANFESS Evening School • Yaoundé, Cameroon
            </p>
          </div>

          {/* Keyframe Animations */}
          <style>{`
            @keyframes pulse-dot {
              0%, 80%, 100% {
                opacity: 0.3;
                transform: scale(0.8);
              }
              40% {
                opacity: 1;
                transform: scale(1.2);
              }
            }

            @keyframes shimmer {
              0% {
                background-position: -1000px 0;
              }
              100% {
                background-position: 1000px 0;
              }
            }

            .shimmer {
              background: linear-gradient(
                90deg,
                rgba(255,255,255,0) 0%,
                rgba(255,255,255,0.1) 50%,
                rgba(255,255,255,0) 100%
              );
              background-size: 1000px 100%;
              animation: shimmer 2s infinite;
            }

            .dark .shimmer {
              background: linear-gradient(
                90deg,
                rgba(0,0,0,0) 0%,
                rgba(255,255,255,0.05) 50%,
                rgba(0,0,0,0) 100%
              );
              background-size: 1000px 100%;
              animation: shimmer 2s infinite;
            }
          `}</style>

          {/* Shimmer overlay on progress bar */}
          <div className="relative -mt-3 mx-6 h-3 rounded-full overflow-hidden">
            <div className="shimmer absolute inset-0" />
          </div>
        </div>
      </div>
    );
  }

  return <App />;
}