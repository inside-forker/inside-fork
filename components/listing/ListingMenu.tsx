"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Eye, ChefHat, Download, FileText } from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";
import { Database } from "@/types/database";
import { useMenuModal } from "@/lib/context/MenuModalContext";

type MenuSection = Database["public"]["Tables"]["menu_sections"]["Row"] & {
  menu_items: Database["public"]["Tables"]["menu_items"]["Row"][] | null;
};

interface ListingMenuProps {
  menuSections: MenuSection[];
  restaurantName?: string;
  menuPdfUrl?: string | null;
  listingId: number;
}

export function ListingMenu({
  menuSections,
  restaurantName = "Restaurant",
  menuPdfUrl,
  listingId,
}: ListingMenuProps) {
  const { openMenu } = useMenuModal();

  if (!menuSections || menuSections.length === 0) {
    return null;
  }

  // Helper function to format price
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Get featured items (prioritize user-selected featured items)
  const getFeaturedItems = () => {
    const featured: Database["public"]["Tables"]["menu_items"]["Row"][] = [];

    // First, collect all explicitly featured items
    menuSections.forEach((section) => {
      const featuredItemsInSection =
        section.menu_items?.filter(
          (item) => item.is_available && item.is_featured,
        ) || [];
      featured.push(...featuredItemsInSection);
    });

    // If we don't have enough featured items, fill with auto-selected items from first 3 sections
    if (featured.length < 6) {
      // Only take from first 3 sections to keep preview compact
      const firstThreeSections = menuSections.slice(0, 3);
      firstThreeSections.forEach((section) => {
        const availableItems =
          section.menu_items?.filter(
            (item) => item.is_available && !item.is_featured,
          ) || [];
        const sortedItems = availableItems.sort(
          (a, b) => (a.display_order || 0) - (b.display_order || 0),
        );
        const needed = 6 - featured.length;
        const itemsToAdd = sortedItems.slice(0, Math.min(needed, 2));
        featured.push(...itemsToAdd);
      });
    }

    return featured.slice(0, 6); // Max 6 featured items
  };

  const featuredItems = getFeaturedItems();
  const totalItems = menuSections.reduce((total, section) => {
    return (
      total +
      (section.menu_items?.filter((item) => item.is_available)?.length || 0)
    );
  }, 0);
  const sectionsCount = menuSections.length;

  // Trigger the global menu context
  const handleOpenMenu = () => {
    openMenu({ menuSections, restaurantName, listingId });
  };

  return (
    <div className="relative z-10">
      <div className="space-y-6 cursor-default pointer-events-auto">
        {/* Mobile-First Header */}
        <div className="md:hidden">
          {/* Mobile Header - Matching Photos & Features Section Style */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
                <ChefHat className="h-6 w-6 text-primary" />
              </div>
              <div>
                <PremiumHeading level={2} dense className="text-foreground">
                  Our <span className="gradient-text-primary">Menu</span>
                </PremiumHeading>
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                  {totalItems} delicious items across {sectionsCount} categories
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="px-3 py-1 text-xs font-medium bg-primary/5"
            >
              Featured
            </Badge>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
              <ChefHat className="h-6 w-6 text-primary" />
            </div>
            <div>
              <PremiumHeading level={2} dense className="text-foreground">
                Our <span className="gradient-text-primary">Menu</span>
              </PremiumHeading>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                {totalItems} delicious items across {sectionsCount} categories
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="px-4 py-2 font-semibold border-2 bg-primary/5"
          >
            Featured Items
          </Badge>
        </div>

        {/* Featured Items Preview */}
        <div className="space-y-6">
          {/* Mobile Grid - 1 column */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {featuredItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="group relative bg-card/60 md:bg-card/40 backdrop-blur-sm border-2 md:border border-border/80 md:border-border/50 rounded-2xl p-4 md:p-6 hover:bg-card/80 md:hover:bg-card/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-default hover:border-primary/30"
              >
                <div className="space-y-3 md:space-y-4">
                  {/* Item Image */}
                  {item.image_url && (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden bg-muted/50">
                      <Image
                        src={item.image_url}
                        alt={item.image_alt || item.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                  )}

                  {/* Item Header */}
                  <div>
                    <h4 className="font-bold text-base md:text-lg mb-2 group-hover:text-primary transition-colors line-clamp-1">
                      {item.name}
                    </h4>
                    {item.description && (
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between">
                    <div className="text-lg md:text-xl font-black text-primary">
                      {formatPrice(Number(item.price))}
                    </div>
                    {/* <Badge variant="outline" className="text-xs border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                      Available
                    </Badge> */}
                  </div>
                </div>

                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
              </motion.div>
            ))}
          </div>

          {/* View Full Menu Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-center relative z-20"
          >
            {/* Mobile-Optimized Button Container */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center max-w-md mx-auto">
              {/* View Full Menu Button */}
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 w-full sm:w-auto"
              >
                <Button
                  onClick={handleOpenMenu}
                  size="lg"
                  className="group relative bg-gradient-to-r from-primary via-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 overflow-hidden cursor-pointer w-full sm:w-auto"
                >
                  <div className="relative z-10 flex items-center justify-center">
                    <Eye className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 group-hover:scale-110 transition-transform" />
                    <span className="text-sm sm:text-base md:text-lg font-bold">
                      View Full Menu
                    </span>
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 sm:ml-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{
                      repeat: Infinity,
                      repeatType: "loop",
                      duration: 1.5,
                      ease: "easeInOut",
                      repeatDelay: 2,
                    }}
                    style={{ filter: "blur(8px)" }}
                  />
                </Button>
              </motion.div>

              {/* PDF Download Button */}
              {menuPdfUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 w-full sm:w-auto"
                >
                  <Button
                    onClick={() => window.open(menuPdfUrl, "_blank")}
                    size="lg"
                    variant="outline"
                    className="group relative border-2 border-primary/40 hover:border-primary bg-background/95 dark:bg-background/90 backdrop-blur-sm hover:bg-primary/5 dark:hover:bg-primary/10 px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-2xl shadow-lg hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 overflow-hidden cursor-pointer will-change-transform w-full sm:w-auto"
                  >
                    <div className="relative z-10 flex items-center justify-center">
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-primary group-hover:scale-110 transition-transform duration-200 ease-out" />
                      <span className="text-sm sm:text-base md:text-lg font-bold text-primary dark:text-primary-foreground">
                        Download PDF
                      </span>
                      <Download className="w-4 h-4 sm:w-5 sm:h-5 ml-2 sm:ml-3 group-hover:translate-y-0.5 transition-transform duration-200 ease-out" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10"
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 2,
                        ease: "easeInOut",
                        repeatDelay: 3,
                      }}
                      style={{ filter: "blur(4px)" }}
                    />
                  </Button>
                </motion.div>
              )}
            </div>

            <p className="text-xs md:text-sm text-muted-foreground mt-4 px-4 md:px-0">
              Explore all {totalItems} items • {sectionsCount} categories •
              Interactive menu experience
            </p>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-gradient-to-r from-primary/5 via-primary/3 to-secondary/5 border border-border/30 rounded-2xl p-4 md:p-6"
        >
          <div className="grid grid-cols-3 gap-4 text-center divide-x divide-border/50">
            <div className="space-y-1 md:space-y-2 px-2">
              <div className="text-2xl md:text-3xl font-black text-primary">
                {totalItems}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">
                Menu Items
              </div>
            </div>
            <div className="space-y-1 md:space-y-2 px-2">
              <div className="text-2xl md:text-3xl font-black text-primary">
                {sectionsCount}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">
                Categories
              </div>
            </div>
            <div className="space-y-1 md:space-y-2 px-2">
              <div className="text-2xl md:text-3xl font-black text-primary">
                100%
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">
                Fresh Daily
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
