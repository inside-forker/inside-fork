"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import HeroSection from "@/components/ui/HeroSection";
import HeroPlaceholder from "@/components/ui/HeroPlaceholder";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function PrivacyPolicyHero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <HeroPlaceholder variant="default" />;

  const floatingElements = [
    { icon: Shield, delay: 0, position: "top-20 left-4 sm:left-20" },
    { icon: Lock, delay: 3, position: "top-32 right-4 sm:right-32" },
  ];

  return (
    <HeroSection
      floating={
        <>
          {floatingElements.map((element, index) => (
            <motion.div
              key={index}
              animate={{
                y: [0, -20, 0],
                rotate: [0, 4, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 6 + index,
                repeat: Infinity,
                ease: "easeInOut",
                delay: element.delay,
              }}
              className={cn(
                "absolute p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30",
                element.position,
              )}
            >
              <element.icon className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            </motion.div>
          ))}
        </>
      }
    >
      <motion.div
        className="max-w-4xl mx-auto space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex justify-center"
        >
          <Badge className="px-6 py-3 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
            <Shield className="h-4 w-4 mr-2" />
            Privacy & Data Protection
          </Badge>
        </motion.div>

        {/* Main Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="space-y-4"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
            Privacy <span className="gradient-text-primary">Policy</span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            Your privacy matters to us. This policy explains how Inside
            (&ldquo;Inside: The City Guide&rdquo;, operated by City Guide Network
            (Private) Limited) collects, uses and protects your personal
            information in our mobile app and on this website.
          </p>
        </motion.div>

        {/* Key Commitments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto"
        >
          {[
            {
              icon: Shield,
              title: "Data Protection",
              description:
                "We implement robust security measures to safeguard your information",
            },
            {
              icon: Eye,
              title: "Transparency",
              description:
                "Clear explanations of our data practices and your rights",
            },
            {
              icon: Users,
              title: "Your Control",
              description: "You have control over your data and how it's used",
            },
          ].map((commitment, index) => (
            <motion.div
              key={commitment.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.8 + index * 0.1,
                type: "spring",
                stiffness: 200,
              }}
              className="text-center p-6 rounded-xl bg-background/95 border border-primary/10 group transition-all duration-300 hover:bg-background/30 hover:border-primary/20"
            >
              <commitment.icon className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {commitment.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {commitment.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Last Updated */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="text-center"
        >
          <p className="text-sm text-muted-foreground">
            Last updated: September 16, 2026
          </p>
        </motion.div>
      </motion.div>
    </HeroSection>
  );
}
