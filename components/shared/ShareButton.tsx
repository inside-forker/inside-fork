"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  MessageCircle,
  Link2,
  Upload,
  X,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { openShareDialog } from "@/lib/utils/share-urls";
import type {
  ShareButtonProps,
  SocialPlatform,
  CreateShareResponse,
} from "@/types/invite-share.types";

type ShareState = "idle" | "selecting" | "uploading" | "success";

const PLATFORM_CONFIG = {
  facebook: {
    name: "Facebook",
    icon: Facebook,
    color: "text-blue-600 bg-blue-500/10 hover:bg-blue-500/20",
    borderColor: "border-blue-500/20",
  },
  twitter: {
    name: "Twitter",
    icon: Twitter,
    color: "text-sky-500 bg-sky-500/10 hover:bg-sky-500/20",
    borderColor: "border-sky-500/20",
  },
  linkedin: {
    name: "LinkedIn",
    icon: Linkedin,
    color: "text-blue-700 bg-blue-500/10 hover:bg-blue-500/20",
    borderColor: "border-blue-500/20",
  },
  instagram: {
    name: "Instagram",
    icon: Instagram,
    color: "text-pink-600 bg-pink-500/10 hover:bg-pink-500/20",
    borderColor: "border-pink-500/20",
  },
  whatsapp: {
    name: "WhatsApp",
    icon: MessageCircle,
    color: "text-green-600 bg-green-500/10 hover:bg-green-500/20",
    borderColor: "border-green-500/20",
  },
  copy_link: {
    name: "Copy Link",
    icon: Link2,
    color: "text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20",
    borderColor: "border-indigo-500/20",
  },
  other: {
    name: "Other",
    icon: Share2,
    color: "text-purple-600 bg-purple-500/10 hover:bg-purple-500/20",
    borderColor: "border-purple-500/20",
  },
} as const;

export function ShareButton({
  contentType,
  contentId,
  contentTitle,
  contentUrl,
  variant = "default",
  className,
}: ShareButtonProps) {
  const [state, setState] = React.useState<ShareState>("idle");
  const [selectedPlatform, setSelectedPlatform] =
    React.useState<SocialPlatform | null>(null);
  const [screenshot, setScreenshot] = React.useState<File | null>(null);
  const [xpAwarded, setXpAwarded] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleShareClick = () => {
    setState("selecting");
  };

  const handlePlatformSelect = async (platform: SocialPlatform) => {
    setSelectedPlatform(platform);

    // If copy_link, handle immediately
    if (platform === "copy_link") {
      try {
        const fullUrl = `${process.env.NEXT_PUBLIC_APP_URL}${contentUrl}`;
        await navigator.clipboard.writeText(fullUrl);

        // Create share record
        await createShare(platform);

        toast({
          title: "Link Copied! 🎉",
          description: fullUrl,
          duration: 7000, // Longer so user can see the URL
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Please try again";
        console.error("Copy link error:", err);

        toast({
          title: "Failed to copy",
          description: errorMessage,
          variant: "destructive",
        });
      }
      return;
    }

    // Handle Instagram (no web share support)
    if (platform === "instagram") {
      // Check if mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        toast({
          title: "Opening Instagram 📸",
          description:
            "Share on Instagram, then come back to upload your screenshot",
          duration: 5000,
        });
      } else {
        toast({
          title: "Instagram Sharing",
          description:
            "Open Instagram on your mobile device to share, then upload your screenshot here.",
          duration: 5000,
        });
      }

      setState("uploading");
      return;
    }

    // For other platforms, open share dialog first
    const fullUrl = `${process.env.NEXT_PUBLIC_APP_URL}${contentUrl}`;
    const shareParams = {
      title: `Check out: ${contentTitle}`,
      url: fullUrl,
      description: `Discover ${contentTitle} on Inside Karachi`,
      hashtags: ["InsideKarachi", "Karachi"],
    };

    // Open the platform's share dialog
    const opened = openShareDialog(platform, shareParams);

    if (opened) {
      // Add platform name to toast for clarity
      const platformNames: Record<SocialPlatform, string> = {
        whatsapp: "WhatsApp",
        facebook: "Facebook",
        twitter: "Twitter/X",
        linkedin: "LinkedIn",
        instagram: "Instagram",
        copy_link: "Copy Link",
        other: "Share",
      };

      // For Facebook, show URL so user can copy if needed
      if (platform === "facebook") {
        toast({
          title: `${platformNames[platform]} opened! 📱`,
          description: `URL: ${fullUrl}`,
          duration: 7000, // Longer duration so user can see/copy URL
        });

        // Also copy to clipboard as backup
        try {
          await navigator.clipboard.writeText(fullUrl);
        } catch (e) {
          // Silently fail - user can still see URL in toast
          console.log("Clipboard copy failed:", e);
        }
      } else {
        toast({
          title: `${platformNames[platform]} opened! 📱`,
          description: "After sharing, come back and upload your screenshot",
          duration: 5000,
        });
      }
    }

    // Show upload dialog
    setState("uploading");
  };

  const createShare = async (platform: SocialPlatform) => {
    try {
      const response = await fetch("/api/shares/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId,
          content_title: contentTitle,
          content_url: contentUrl,
          platform,
          verification_method:
            platform === "copy_link" ? "tracking_url" : "screenshot",
        }),
      });

      const data: CreateShareResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create share");
      }

      setXpAwarded(data.data?.xp_amount || 0);

      if (!data.data?.requires_verification) {
        // Auto-verified, show success
        setState("success");
        triggerSuccessAnimation();
      }

      return data;
    } catch (err) {
      toast({
        title: "Share Failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    setScreenshot(file);
  };

  const handleUploadScreenshot = async () => {
    if (!screenshot || !selectedPlatform) return;

    try {
      setIsUploading(true);

      // Create share record first
      const shareData = await createShare(selectedPlatform);
      if (!shareData?.data?.share_id) {
        throw new Error("Failed to create share");
      }

      // Upload screenshot to Supabase Storage
      const formData = new FormData();
      formData.append("file", screenshot);
      formData.append("share_id", shareData.data.share_id.toString());

      const uploadResponse = await fetch("/api/shares/upload-screenshot", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadData.success) {
        throw new Error(uploadData.error || "Failed to upload screenshot");
      }

      setState("success");
      toast({
        title: "Share Submitted! 🎉",
        description: "Your share will be verified within 24 hours",
      });
    } catch (err) {
      toast({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const triggerSuccessAnimation = () => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ["#8b5cf6", "#6366f1", "#ec4899"],
    });
  };

  const handleBack = () => {
    setState("selecting");
    setSelectedPlatform(null);
    setScreenshot(null);
  };

  const reset = () => {
    setState("idle");
    setSelectedPlatform(null);
    setScreenshot(null);
    setXpAwarded(0);
    setIsUploading(false);
  };

  // Compact variant (just icon button)
  if (variant === "compact") {
    return (
      <>
        <Button
          onClick={handleShareClick}
          variant="outline"
          size="icon"
          className={cn("rounded-full", className)}
        >
          <Share2 className="w-4 h-4" />
        </Button>
        <ShareModal
          isOpen={state !== "idle"}
          state={state}
          selectedPlatform={selectedPlatform}
          screenshot={screenshot}
          xpAwarded={xpAwarded}
          isUploading={isUploading}
          onPlatformSelect={handlePlatformSelect}
          onFileSelect={handleFileSelect}
          onUpload={handleUploadScreenshot}
          onBack={handleBack}
          onClose={reset}
          fileInputRef={fileInputRef}
        />
      </>
    );
  }

  // Default variant (full button)
  return (
    <>
      <Button
        onClick={handleShareClick}
        variant="outline"
        className={cn(
          "bg-primary/10 border-primary/20 hover:bg-primary/15",
          className,
        )}
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share & Earn XP</span>
        <span className="inline sm:hidden">Share</span>
      </Button>
      <ShareModal
        isOpen={state !== "idle"}
        state={state}
        selectedPlatform={selectedPlatform}
        screenshot={screenshot}
        xpAwarded={xpAwarded}
        isUploading={isUploading}
        onPlatformSelect={handlePlatformSelect}
        onFileSelect={handleFileSelect}
        onUpload={handleUploadScreenshot}
        onBack={handleBack}
        onClose={reset}
        fileInputRef={fileInputRef}
      />
    </>
  );
}

interface ShareModalProps {
  isOpen: boolean;
  state: ShareState;
  selectedPlatform: SocialPlatform | null;
  screenshot: File | null;
  xpAwarded: number;
  isUploading: boolean;
  onPlatformSelect: (platform: SocialPlatform) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onBack: () => void;
  onClose: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

function ShareModal({
  isOpen,
  state,
  selectedPlatform,
  screenshot,
  xpAwarded,
  isUploading,
  onPlatformSelect,
  onFileSelect,
  onUpload,
  onBack,
  onClose,
  fileInputRef,
}: ShareModalProps) {
  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, state, selectedPlatform]);

  // Use portal to render modal outside of parent container restrictions
  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[9999]"
            onClick={() => {
              onClose();
            }}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="pointer-events-auto relative w-full max-w-md bg-white dark:bg-background border border-gray-200 dark:border-border/50 rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {/* Header */}
              <div className="relative px-6 pt-6 pb-4 border-b border-gray-100 dark:border-border/40">
                <button
                  onClick={() => {
                    onClose();
                  }}
                  className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-muted/80 transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>

                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                    <Share2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-foreground">
                      Share & Earn XP
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-muted-foreground">
                      Get{" "}
                      <span className="font-semibold text-primary">10 XP</span>{" "}
                      for every share! 🎁
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="relative p-6">
                {state === "selecting" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground ml-1">
                      Choose a platform
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {(Object.keys(PLATFORM_CONFIG) as SocialPlatform[]).map(
                        (platform, index) => {
                          const config = PLATFORM_CONFIG[platform];
                          const Icon = config.icon;

                          // Extract base text color from config.color string
                          const colorClass = config.color.split(" ")[0];

                          // Span the last "other" item full-width when there are 7 items
                          const isLastAndOdd = index === 6;

                          return (
                            <button
                              key={platform}
                              onClick={() => {
                                onPlatformSelect(platform);
                              }}
                              className={cn(
                                "group relative p-3 rounded-xl transition-all duration-300",
                                // Light Mode Styles
                                "bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5",
                                // Dark Mode Styles
                                "dark:bg-muted/20 dark:border-border/50 dark:hover:bg-muted/40 dark:hover:shadow-lg dark:hover:shadow-primary/5",
                                "flex flex-col items-center justify-center gap-2 text-center",
                                isLastAndOdd
                                  ? "col-span-3 sm:col-span-1 sm:col-start-2"
                                  : "",
                              )}
                            >
                              <div
                                className={cn(
                                  "p-2.5 rounded-lg transition-transform duration-300",
                                  // Light/Dark Mode Bg
                                  "bg-gray-50 ring-1 ring-gray-100 dark:bg-background dark:ring-border/20",
                                  colorClass,
                                )}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <p className="text-xs font-medium text-gray-700 dark:text-foreground/80 group-hover:text-gray-900 dark:group-hover:text-foreground transition-colors">
                                {config.name}
                              </p>
                            </button>
                          );
                        },
                      )}
                    </div>
                  </motion.div>
                )}

                {state === "uploading" && selectedPlatform && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    {/* Back Button */}
                    <button
                      onClick={onBack}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isUploading}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      Back to platforms
                    </button>

                    <div className="text-center space-y-2">
                      <div className="flex justify-center">
                        <div
                          className={cn(
                            "p-3 rounded-xl",
                            PLATFORM_CONFIG[selectedPlatform].color,
                          )}
                        >
                          {React.createElement(
                            PLATFORM_CONFIG[selectedPlatform].icon,
                            {
                              className: "w-8 h-8",
                            },
                          )}
                        </div>
                      </div>
                      <h3 className="font-semibold">Upload Screenshot</h3>
                      <p className="text-sm text-muted-foreground">
                        Share on {PLATFORM_CONFIG[selectedPlatform].name}, then
                        upload a screenshot as proof
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        onFileSelect(e);
                      }}
                      className="hidden"
                    />

                    {!screenshot ? (
                      <Button
                        onClick={() => {
                          fileInputRef.current?.click();
                        }}
                        variant="outline"
                        className="w-full h-32 border-2 border-dashed border-border hover:border-primary hover:bg-primary/5"
                      >
                        <div className="text-center">
                          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">
                            Click to upload screenshot
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PNG, JPG up to 5MB
                          </p>
                        </div>
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-muted/50 border border-border">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {screenshot.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(screenshot.size / 1024).toFixed(0)} KB
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                fileInputRef.current?.click();
                              }}
                              className="text-xs text-primary hover:text-primary/80"
                            >
                              Change
                            </button>
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            onUpload();
                          }}
                          disabled={isUploading}
                          className="w-full bg-primary hover:bg-primary/90"
                        >
                          {isUploading ? (
                            <>
                              <svg
                                className="w-4 h-4 mr-2 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Submit for Verification
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          Your screenshot will be reviewed within 24 hours.
                          You&apos;ll earn 10 XP once verified!
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {state === "success" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-4"
                  >
                    <div className="flex justify-center">
                      <div className="p-4 rounded-full bg-emerald-500/10">
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">
                        Share Submitted!
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        You&apos;ll earn {xpAwarded} XP once verified
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        onClose();
                      }}
                      className="w-full bg-primary hover:bg-primary/90"
                    >
                      Done
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;

  return createPortal(modalContent, document.body);
}
