"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentsManagementPage } from "@/components/admin/CommentsManagementPage";
import { ReviewsTable } from "@/components/admin/ReviewsTable";
import { ReviewModal } from "@/components/admin/ReviewModal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useReviewManagement } from "@/hooks/useReviewManagement";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import {
  Search,
  RefreshCw,
  Star,
  CheckCircle,
  XCircle,
  Flag,
  MessageSquare,
  Clock,
} from "lucide-react";
import type {
  ReviewWithModeration,
  ReviewStatus,
  ReviewStatistics,
} from "@/types/review.types";

export function ReviewsManagementPage() {
  const [reviews, setReviews] = React.useState<ReviewWithModeration[]>([]);
  const [totalReviews, setTotalReviews] = React.useState(0);
  const [selectedReview, setSelectedReview] =
    React.useState<ReviewWithModeration | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("flagged");
  const [ratingFilter, setRatingFilter] = React.useState<string>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [reviewToDelete, setReviewToDelete] =
    React.useState<ReviewWithModeration | null>(null);
  const [isBulkMode, setIsBulkMode] = React.useState(false);
  const [selectedReviews, setSelectedReviews] = React.useState<Set<number>>(
    new Set(),
  );
  const [statistics, setStatistics] = React.useState<ReviewStatistics | null>(
    null,
  );

  const {
    updateReview,
    deleteReview,
    moderateReview,
    bulkModerate,
    isLoading: isActionLoading,
  } = useReviewManagement();
  const { toast } = useToast();

  // Server-driven pagination
  const itemsPerPage = 12;
  const totalPages = Math.max(1, Math.ceil(totalReviews / itemsPerPage));

  // Fetch reviews with server query parameters
  const fetchReviews = React.useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setIsLoading(true);
        const params = new URLSearchParams();
        params.set("page", currentPage.toString());
        params.set("limit", itemsPerPage.toString());
        if (statusFilter && statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }
        if (ratingFilter && ratingFilter !== "all") {
          params.set("rating", ratingFilter);
        }

        const response = await fetch(`/api/admin/reviews?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
          setReviews(result.data.reviews || []);
          setTotalReviews(result.data.total ?? 0);
          setStatistics(result.data.statistics);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Fetch reviews error:", error);
        toast({
          title: "Error",
          description: "Failed to fetch reviews",
          variant: "destructive",
        });
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [currentPage, itemsPerPage, statusFilter, searchQuery, ratingFilter, toast],
  );

  // Reset page to 1 when filters change
  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleRatingFilterChange = (val: string) => {
    setRatingFilter(val);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  // Load reviews on mount and when filter/page dependencies change
  React.useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Realtime updates for reviews, images, and comments
  useRealtimeRefresh(
    "reviews-management",
    [
      { table: "reviews" },
      { table: "review_images" },
      { table: "review_comments" },
    ],
    () => fetchReviews(false),
    500,
  );

  // Fallback: Refresh on tab visibility (safety net for connection issues)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void fetchReviews(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchReviews]);

  const handleEditReview = (review: ReviewWithModeration) => {
    setSelectedReview(review);
    setIsModalOpen(true);
  };

  const handleDeleteReview = (review: ReviewWithModeration) => {
    setReviewToDelete(review);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteReview = async () => {
    if (!reviewToDelete) return;

    // Optimistic Update: Remove immediately from UI
    const previousReviews = [...reviews];
    setReviews((prev) => prev.filter((r) => r.id !== reviewToDelete.id));
    setIsDeleteDialogOpen(false);

    const success = await deleteReview(reviewToDelete.id);
    if (success) {
      setReviewToDelete(null);
      // Silent revalidation to ensure data consistency
      fetchReviews(false);
    } else {
      setReviews(previousReviews);
      toast({
        title: "Error",
        description: "Failed to delete review. Changes reverted.",
        variant: "destructive",
      });
    }
  };

  const handleSaveReview = async (
    reviewData: Partial<ReviewWithModeration>,
  ) => {
    if (!selectedReview) return;

    // Optimistic Update
    const previousReviews = [...reviews];
    setReviews((prev) =>
      prev.map((r) =>
        r.id === selectedReview.id ? { ...r, ...reviewData } : r,
      ),
    );

    const success = await updateReview(selectedReview.id, reviewData);
    if (success) {
      setIsModalOpen(false);
      setSelectedReview(null);
      fetchReviews(false);
    } else {
      setReviews(previousReviews);
      toast({
        title: "Error",
        description: "Failed to update review. Changes reverted.",
        variant: "destructive",
      });
    }
  };

  const handleModerateReview = async (
    review: ReviewWithModeration,
    status: ReviewStatus,
    reason?: string,
  ) => {
    // Optimistic Update
    const previousReviews = [...reviews];
    setReviews((prev) =>
      prev.map((r) => (r.id === review.id ? { ...r, status } : r)),
    );

    const success = await moderateReview(review.id, status, reason);
    if (success) {
      fetchReviews(false);
    } else {
      setReviews(previousReviews);
      toast({
        title: "Error",
        description: "Failed to update status. Changes reverted.",
        variant: "destructive",
      });
    }
  };

  const handleSelectReview = (reviewId: number, selected: boolean) => {
    setSelectedReviews((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(reviewId);
      } else {
        newSet.delete(reviewId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedReviews(new Set(reviews.map((r) => r.id)));
    } else {
      setSelectedReviews(new Set());
    }
  };

  const handleBulkModerate = async (status: ReviewStatus) => {
    if (selectedReviews.size === 0) return;

    const reviewIds = Array.from(selectedReviews);

    // Optimistic Update
    const previousReviews = [...reviews];
    setReviews((prev) =>
      prev.map((r) => (selectedReviews.has(r.id) ? { ...r, status } : r)),
    );

    // Clear selection immediately for better UX
    setSelectedReviews(new Set());
    setIsBulkMode(false);

    const success = await bulkModerate(reviewIds, status);
    if (success) {
      fetchReviews(false);
    } else {
      // Revert
      setReviews(previousReviews);
      toast({
        title: "Error",
        description: "Failed to update reviews. Changes reverted.",
        variant: "destructive",
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  const getStatsCards = () => {
    if (!statistics) return [];

    return [
      {
        title: "Total",
        value: statistics.totalReviews,
        icon: MessageSquare,
        color:
          "from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0",
        borderColor: "border-blue-500/30 dark:border-blue-500/20",
        shadowColor: "hover:shadow-blue-500/25",
        iconBg: "bg-blue-500/10",
        iconHoverBg: "group-hover:bg-blue-500/20",
        textColor: "text-blue-900 dark:text-blue-100",
        textHoverColor:
          "group-hover:text-blue-800 dark:group-hover:text-blue-200",
        valueColor: "text-blue-700 dark:text-blue-300",
        valueHoverColor:
          "group-hover:text-blue-600 dark:group-hover:text-blue-400",
        iconColor: "text-blue-600 dark:text-blue-400",
      },
      {
        title: "Pending",
        value: statistics.pendingReviews,
        icon: Clock,
        color:
          "from-yellow-500/20 via-yellow-500/10 to-yellow-500/5 dark:from-yellow-500/10 dark:via-yellow-500/5 dark:to-yellow-500/0",
        borderColor: "border-yellow-500/30 dark:border-yellow-500/20",
        shadowColor: "hover:shadow-yellow-500/25",
        iconBg: "bg-yellow-500/10",
        iconHoverBg: "group-hover:bg-yellow-500/20",
        textColor: "text-yellow-900 dark:text-yellow-100",
        textHoverColor:
          "group-hover:text-yellow-800 dark:group-hover:text-yellow-200",
        valueColor: "text-yellow-700 dark:text-yellow-300",
        valueHoverColor:
          "group-hover:text-yellow-600 dark:group-hover:text-yellow-400",
        iconColor: "text-yellow-600 dark:text-yellow-400",
      },
      {
        title: "Approved",
        value: statistics.approvedReviews,
        icon: CheckCircle,
        color:
          "from-green-500/20 via-green-500/10 to-green-500/5 dark:from-green-500/10 dark:via-green-500/5 dark:to-green-500/0",
        borderColor: "border-green-500/30 dark:border-green-500/20",
        shadowColor: "hover:shadow-green-500/25",
        iconBg: "bg-green-500/10",
        iconHoverBg: "group-hover:bg-green-500/20",
        textColor: "text-green-900 dark:text-green-100",
        textHoverColor:
          "group-hover:text-green-800 dark:group-hover:text-green-200",
        valueColor: "text-green-700 dark:text-green-300",
        valueHoverColor:
          "group-hover:text-green-600 dark:group-hover:text-green-400",
        iconColor: "text-green-600 dark:text-green-400",
      },
      {
        title: "Rejected",
        value: statistics.rejectedReviews,
        icon: XCircle,
        color:
          "from-red-500/20 via-red-500/10 to-red-500/5 dark:from-red-500/10 dark:via-red-500/5 dark:to-red-500/0",
        borderColor: "border-red-500/30 dark:border-red-500/20",
        shadowColor: "hover:shadow-red-500/25",
        iconBg: "bg-red-500/10",
        iconHoverBg: "group-hover:bg-red-500/20",
        textColor: "text-red-900 dark:text-red-100",
        textHoverColor:
          "group-hover:text-red-800 dark:group-hover:text-red-200",
        valueColor: "text-red-700 dark:text-red-300",
        valueHoverColor:
          "group-hover:text-red-600 dark:group-hover:text-red-400",
        iconColor: "text-red-600 dark:text-red-400",
      },
      {
        title: "Flagged",
        value: statistics.flaggedReviews,
        icon: Flag,
        color:
          "from-orange-500/20 via-orange-500/10 to-orange-500/5 dark:from-orange-500/10 dark:via-orange-500/5 dark:to-orange-500/0",
        borderColor: "border-orange-500/30 dark:border-orange-500/20",
        shadowColor: "hover:shadow-orange-500/25",
        iconBg: "bg-orange-500/10",
        iconHoverBg: "group-hover:bg-orange-500/20",
        textColor: "text-orange-900 dark:text-orange-100",
        textHoverColor:
          "group-hover:text-orange-800 dark:group-hover:text-orange-200",
        valueColor: "text-orange-700 dark:text-orange-300",
        valueHoverColor:
          "group-hover:text-orange-600 dark:group-hover:text-orange-400",
        iconColor: "text-orange-600 dark:text-orange-400",
      },
      {
        title: "Avg Rating",
        value:
          statistics.averageRating > 0
            ? `${statistics.averageRating.toFixed(1)} ⭐`
            : "N/A",
        icon: Star,
        color:
          "from-purple-500/20 via-purple-500/10 to-purple-500/5 dark:from-purple-500/10 dark:via-purple-500/5 dark:to-purple-500/0",
        borderColor: "border-purple-500/30 dark:border-purple-500/20",
        shadowColor: "hover:shadow-purple-500/25",
        iconBg: "bg-purple-500/10",
        iconHoverBg: "group-hover:bg-purple-500/20",
        textColor: "text-purple-900 dark:text-purple-100",
        textHoverColor:
          "group-hover:text-purple-800 dark:group-hover:text-purple-200",
        valueColor: "text-purple-700 dark:text-purple-300",
        valueHoverColor:
          "group-hover:text-purple-600 dark:group-hover:text-purple-400",
        iconColor: "text-purple-600 dark:text-purple-400",
      },
    ];
  };

  const statsCards = getStatsCards();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <Tabs defaultValue="reviews" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 h-12 p-1 bg-gradient-to-r from-background/90 via-background/80 to-background/70 backdrop-blur-md border border-border/30 shadow-xl shadow-black/10 dark:shadow-black/30 rounded-2xl relative overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-primary/[0.02] opacity-50" />

          <TabsTrigger
            value="reviews"
            className="relative flex items-center gap-2 h-10 px-6 text-sm font-medium rounded-xl transition-all duration-500 ease-out group
              data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:via-primary/15 data-[state=active]:to-primary/10
              data-[state=active]:text-primary data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25
              data-[state=active]:border data-[state=active]:border-primary/30 data-[state=active]:backdrop-blur-sm
              hover:bg-gradient-to-r hover:from-muted/60 hover:via-muted/40 hover:to-muted/30
              hover:text-foreground hover:shadow-md hover:shadow-black/10 dark:hover:shadow-black/20
              hover:scale-[1.02] hover:-translate-y-0.5
              data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground
              data-[state=inactive]:hover:bg-muted/30 data-[state=inactive]:transition-all data-[state=inactive]:duration-300"
          >
            <Star className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
            <span className="font-semibold tracking-wide">Reviews</span>
            {statistics && (
              <span className="ml-1 text-xs bg-primary/15 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold shadow-sm transition-all duration-300 group-hover:bg-primary/20">
                {statistics.totalReviews}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="comments"
            className="relative flex items-center gap-2 h-10 px-6 text-sm font-medium rounded-xl transition-all duration-500 ease-out group
              data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:via-primary/15 data-[state=active]:to-primary/10
              data-[state=active]:text-primary data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25
              data-[state=active]:border data-[state=active]:border-primary/30 data-[state=active]:backdrop-blur-sm
              hover:bg-gradient-to-r hover:from-muted/60 hover:via-muted/40 hover:to-muted/30
              hover:text-foreground hover:shadow-md hover:shadow-black/10 dark:hover:shadow-black/20
              hover:scale-[1.02] hover:-translate-y-0.5
              data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground
              data-[state=inactive]:hover:bg-muted/30 data-[state=inactive]:transition-all data-[state=inactive]:duration-300"
          >
            <MessageSquare className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
            <span className="font-semibold tracking-wide">Comments</span>
            {statistics && (
              <span className="ml-1 text-xs bg-primary/15 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold shadow-sm transition-all duration-300 group-hover:bg-primary/20">
                {statistics.totalComments || 0}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-6 mt-0">
          {/* Stats Cards */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4"
          >
            {statsCards.map((stat) => (
              <motion.div
                key={stat.title}
                variants={itemVariants}
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.2 },
                }}
              >
                <Card
                  className={`bg-gradient-to-br ${stat.color} ${stat.borderColor} hover:shadow-xl ${stat.shadowColor} transition-all duration-300 group cursor-pointer h-full`}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle
                      className={`text-sm font-medium ${stat.textColor} ${stat.textHoverColor} transition-colors leading-tight`}
                    >
                      {stat.title}
                    </CardTitle>
                    <div
                      className={`p-2 ${stat.iconBg} rounded-lg ${stat.iconHoverBg} transition-colors flex-shrink-0`}
                    >
                      <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div
                      className={`text-2xl font-bold ${stat.valueColor} ${stat.valueHoverColor} transition-colors`}
                    >
                      {stat.value}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Filters and Actions */}
          <motion.div
            variants={itemVariants}
            className="bg-gradient-to-r from-background/50 to-background/30 backdrop-blur-sm border border-border/50 rounded-xl p-6"
          >
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 bg-primary/10 rounded-md">
                    <Search className="h-4 w-4 text-primary" />
                  </div>
                  <Input
                    placeholder="Search reviews by user, listing, or content..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-12 h-11 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
                  />
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-44 h-11 bg-background/50 border-border/50">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                  </SelectContent>
                </Select>

                {/* Rating Filter */}
                <Select value={ratingFilter} onValueChange={handleRatingFilterChange}>
                  <SelectTrigger className="w-44 h-11 bg-background/50 border-border/50">
                    <SelectValue placeholder="Filter by rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="1">1 Star</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsBulkMode(!isBulkMode)}
                  className={`h-11 px-6 bg-background/50 border-border/50 hover:bg-background/80 ${
                    isBulkMode ? "bg-primary/10 border-primary/50" : ""
                  }`}
                >
                  {isBulkMode ? "Exit Bulk Mode" : "Bulk Actions"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fetchReviews(true)}
                  disabled={isLoading}
                  className="h-11 px-6 bg-background/50 border-border/50 hover:bg-background/80"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${
                      isLoading ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Bulk Actions */}
            {isBulkMode && selectedReviews.size > 0 && (
              <div className="mt-6 pt-6 border-t border-border/50">
                <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">
                    {selectedReviews.size} review
                    {selectedReviews.size !== 1 ? "s" : ""} selected
                  </span>
                  <div className="flex gap-2 ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkModerate("approved")}
                      disabled={isActionLoading}
                      className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkModerate("rejected")}
                      disabled={isActionLoading}
                      className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkModerate("flagged")}
                      disabled={isActionLoading}
                      className="text-yellow-600 hover:text-yellow-700 border-yellow-200 hover:border-yellow-300"
                    >
                      <Flag className="h-4 w-4 mr-1" />
                      Flag All
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Reviews Table */}
          <motion.div variants={itemVariants}>
            <ReviewsTable
              reviews={reviews}
              isLoading={isLoading}
              onEditReview={handleEditReview}
              onDeleteReview={handleDeleteReview}
              onModerateReview={handleModerateReview}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              selectedReviews={selectedReviews}
              onSelectReview={handleSelectReview}
              onSelectAll={handleSelectAll}
              isBulkMode={isBulkMode}
            />
          </motion.div>

          {/* Review Modal */}
          <ReviewModal
            review={selectedReview}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedReview(null);
            }}
            onSave={handleSaveReview}
            onModerate={async (status, reason) => {
              if (selectedReview) {
                await handleModerateReview(selectedReview, status, reason);
                setIsModalOpen(false);
                setSelectedReview(null);
              }
            }}
          />

          {/* Delete Confirmation Dialog */}
          <ConfirmationDialog
            isOpen={isDeleteDialogOpen}
            onClose={() => {
              setIsDeleteDialogOpen(false);
              setReviewToDelete(null);
            }}
            onConfirm={confirmDeleteReview}
            title="Delete Review"
            description={`Are you sure you want to delete this review by ${reviewToDelete?.user_name}? This action cannot be undone.`}
            confirmText="Delete Review"
            variant="destructive"
          />
        </TabsContent>

        <TabsContent value="comments" className="space-y-6 mt-0">
          <CommentsManagementPage />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
