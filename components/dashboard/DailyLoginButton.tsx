"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Flame, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import type {
  DailyLoginStatus,
  DailyLoginClaimResult,
} from "@/types/gamification.types";

interface DailyLoginButtonProps {
  className?: string;
  onSuccess?: (result: DailyLoginClaimResult) => void;
}

export function DailyLoginButton({
  className,
  onSuccess,
}: DailyLoginButtonProps) {
  const [status, setStatus] = React.useState<DailyLoginStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isClaiming, setIsClaiming] = React.useState(false);
  const { toast } = useToast();

  // Fetch current status
  const fetchStatus = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/gamification/daily-login");

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        console.error("Failed to fetch daily login status");
      }
    } catch (error) {
      console.error("Error fetching daily login status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleClaim = async () => {
    if (!status?.can_claim_xp || isClaiming) return;

    try {
      setIsClaiming(true);

      const response = await fetch("/api/gamification/daily-login", {
        method: "POST",
      });

      const result = await response.json();

      if (response.ok && result.success) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#ff184d", "#ff4d7d", "#ffa3c2"],
        });

        const claimResult = result as DailyLoginClaimResult;
        toast({
          title: "Daily Check-in Complete!",
          description: `You earned +${claimResult.xp_awarded} XP${
            claimResult.streak_bonus ? ` + ${claimResult.streak_bonus.xp_bonus} XP bonus!` : ""
          }`,
          variant: "default",
        });

        if (claimResult.rank_up && claimResult.new_rank) {
          toast({
            title: "Rank up! 🎉",
            description: `You're now a ${claimResult.new_rank.name}!`,
            variant: "default",
          });
        }

        await fetchStatus();
        onSuccess?.(claimResult);

        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else if (response.status === 400 || response.status === 409) {
        toast({
          title: "Already Claimed Today",
          description: "Come back tomorrow for your next check-in!",
          variant: "destructive",
        });
        await fetchStatus();
      } else {
        toast({
          title: "Check-in Failed",
          description: result.error || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error claiming daily login:", error);
      toast({
        title: "Error",
        description: "Failed to claim daily login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "animate-pulse bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20 p-3 md:p-4",
          className
        )}
      />
    );
  }

  if (!status) {
    return (
      <button
        onClick={fetchStatus}
        className={cn(
          "w-full rounded-2xl border border-white/20 bg-white/15 backdrop-blur-sm p-3 md:p-4 text-center",
          className
        )}
      >
        <p className="text-white/70 text-xs">Tap to retry check-in</p>
      </button>
    );
  }

  const alreadyClaimed = status.has_logged_in_today;

  return (
    <motion.button
      onClick={handleClaim}
      disabled={alreadyClaimed || isClaiming}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={!alreadyClaimed ? { scale: 1.02 } : {}}
      whileTap={!alreadyClaimed ? { scale: 0.98 } : {}}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border transition-all duration-300 p-3 md:p-4",
        "flex items-center justify-between gap-3 md:gap-4",
        "group",
        alreadyClaimed
          ? "bg-white/15 backdrop-blur-sm border-white/20 cursor-not-allowed"
          : "bg-white/15 backdrop-blur-sm border-white/20 hover:bg-white/20 hover:border-white/30"
      )}
      aria-label={alreadyClaimed ? "Checked in today" : "Claim daily check-in"}
    >
      {/* Icon Container */}
      <div
        className={cn(
          "relative flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300",
          alreadyClaimed
            ? "bg-white/15"
            : "bg-white/20 group-hover:bg-white/30 group-active:scale-95"
        )}
      >
        {alreadyClaimed ? (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Check className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </motion.div>
        ) : (
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          >
            <Flame className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </motion.div>
        )}
      </div>

      {/* Text Content */}
      <div className="flex-1 text-left">
        <p className="font-bold text-white text-sm md:text-base leading-tight">
          {alreadyClaimed ? "Checked In" : "Daily Check-in"}
        </p>
        <p className="text-white/70 text-xs md:text-sm leading-tight">
          {alreadyClaimed
            ? "Come back tomorrow"
            : `+${status.xp_earned_today} XP`}
        </p>
      </div>

      {/* Streak Badge */}
      {status.current_streak > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-center"
        >
          <p className="text-xs md:text-sm font-semibold text-white">
            {status.current_streak}
            <span className="ml-0.5">🔥</span>
          </p>
        </motion.div>
      )}

      {/* Disabled State Overlay */}
      {(alreadyClaimed || isClaiming) && (
        <div className="absolute inset-0 bg-black/5 rounded-2xl pointer-events-none" />
      )}
    </motion.button>
  );
}
