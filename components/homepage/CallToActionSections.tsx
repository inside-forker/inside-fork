"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

import {
  UserPlus,
  Store,
  ArrowRight,
  Sparkles,
  Crown,
  Zap,
  Star,
  Gift,
} from "lucide-react";

export function CallToActionSections() {
  return (
    <section className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />

      {/* Floating Background Elements */}
      <div className="absolute top-20 right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-12 sm:space-y-16">
          {/* Join Community CTA - CSS animation */}
          <div className="opacity-0 animate-hero-fade-in">
            <div className="relative rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-xl border border-primary/20 shadow-premium overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(var(--primary-rgb),0.1)_1px,transparent_1px),linear-gradient(-45deg,rgba(var(--primary-rgb),0.1)_1px,transparent_1px)] bg-[size:30px_30px] opacity-30" />

              {/* Floating Elements */}
              <div className="absolute top-8 right-4 p-2 md:right-8 md:p-3 rounded-2xl bg-primary/20 border border-primary/30 hidden md:block">
                <Crown className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <div className="absolute bottom-8 left-8 p-3 rounded-2xl bg-primary/20 border border-primary/30 hidden md:block">
                <Gift className="h-6 w-6 text-primary" />
              </div>

              <div className="relative z-10 p-4 sm:p-6 md:p-8 lg:p-12 text-center">
                <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
                  {/* Badge */}
                  <div className="flex justify-center">
                    <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 text-primary font-semibold text-sm">
                      <Sparkles className="h-4 w-4" />
                      <span>Join the Community</span>
                    </div>
                  </div>

                  {/* Heading */}
                  <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-foreground">
                    Start Your Karachi{" "}
                    <span className="gradient-text-primary">Adventure</span>
                  </h2>

                  {/* Description */}
                  <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed px-2 sm:px-0">
                    Create a free account to save favorites, book event
                    tickets, unlock deals and earn XP as you explore the city.
                  </p>

                  {/* Benefits */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-8">
                    {[
                      { icon: Star, text: "Save Your Favorites" },
                      { icon: Zap, text: "Deals & Card Offers" },
                      { icon: Crown, text: "Earn XP & Ranks" },
                    ].map((benefit, index) => (
                      <div
                        key={index}
                        className="flex flex-col items-center justify-center space-y-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-center sm:space-x-2 sm:space-y-0"
                      >
                        <benefit.icon className="h-4 w-4 text-primary" />
                        <span>{benefit.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Buttons - CSS hover effects */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-6 sm:mt-8">
                    <Link href="/signup">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group"
                      >
                        <UserPlus className="h-5 w-5 mr-2" />
                        <span>Sign Up Free</span>
                        <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                      </Button>
                    </Link>

                    <Link href="/login">
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full sm:w-auto px-8 py-4 border-primary/30 text-primary hover:bg-primary/10 font-semibold rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Already a member? Sign In
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Business Listing CTA - CSS animation with delay */}
          <div
            className="opacity-0 animate-hero-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="relative rounded-3xl bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent backdrop-blur-xl border border-green-500/20 shadow-premium overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(34,197,94,0.1)_1px,transparent_1px),linear-gradient(-45deg,rgba(34,197,94,0.1)_1px,transparent_1px)] bg-[size:30px_30px] opacity-30" />

              {/* Floating Elements */}
              <div className="absolute top-8 right-8 p-3 rounded-2xl bg-green-500/20 border border-green-500/30 hidden md:block">
                <Store className="h-6 w-6 text-green-500" />
              </div>

              <div className="relative z-10 p-4 sm:p-6 md:p-8 lg:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  {/* Content */}
                  <div className="space-y-4 sm:space-y-6">
                    {/* Badge */}
                    <div className="flex justify-center md:justify-start">
                      <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30 text-green-600 font-semibold text-sm">
                        <Store className="h-4 w-4" />
                        <span>For Business Owners</span>
                      </div>
                    </div>

                    {/* Heading */}
                    <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-foreground text-center md:text-left">
                      List Your <span className="text-green-500">Business</span>
                    </h2>

                    {/* Description */}
                    <p className="text-base sm:text-lg text-muted-foreground leading-relaxed text-center md:text-left">
                      Get discovered by food lovers, event-goers and local
                      explorers looking for their next favorite spot in
                      Karachi.
                    </p>

                    {/* Benefits List */}
                    <div className="space-y-3">
                      {[
                        "Increase visibility and foot traffic",
                        "Manage reviews and customer feedback",
                        "Promote events and special offers",
                        "Access detailed analytics and insights",
                      ].map((benefit, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3"
                        >
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-muted-foreground">
                            {benefit}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button - CSS hover */}
                    <div className="flex justify-center md:justify-start">
                      <Link href="/get-listed">
                        <Button
                          size="lg"
                          className="px-6 sm:px-8 py-3 sm:py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group"
                        >
                          <Store className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          <span>Get Listed Today</span>
                          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Visual Element */}
                  <div className="relative">
                    <div className="aspect-square max-w-sm mx-auto">
                      {/* Placeholder for business illustration */}
                      <div className="w-full h-full rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center">
                        <div className="text-center space-y-4">
                          <div className="p-4 sm:p-6 rounded-2xl bg-green-500/20 border border-green-500/30 mx-auto w-fit">
                            <Store className="h-8 w-8 sm:h-12 sm:w-12 text-green-500" />
                          </div>
                          <div className="space-y-2">
                            <div className="text-base sm:text-lg font-bold text-foreground">
                              Your Business Here
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              Apply online in a few minutes
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
