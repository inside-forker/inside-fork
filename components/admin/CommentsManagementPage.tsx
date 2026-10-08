"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentsTable } from "@/components/admin/CommentsTable";
import { CommentModal } from "@/components/admin/CommentModal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  RefreshCw,
  MessageSquare,
  CheckCircle,
  XCircle,
  Flag,
  Clock,
} from "lucide-react";
import type { CommentWithAuthor, CommentStatus } from "@/types/comment.types";

export function CommentsManagementPage() {
  const [comments, setComments] = React.useState<CommentWithAuthor[]>([]);
  const [totalComments, setTotalComments] = React.useState(0);
  const [selectedComment, setSelectedComment] =
    React.useState<CommentWithAuthor | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("flagged");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [commentToDelete, setCommentToDelete] =
    React.useState<CommentWithAuthor | null>(null);
  const [selectedComments, setSelectedComments] = React.useState<Set<number>>(
    new Set(),
  );
  const [isBulkMode, setIsBulkMode] = React.useState(false);
  const [statistics, setStatistics] = React.useState<{
    totalComments: number;
    pendingComments: number;
    approvedComments: number;
    rejectedComments: number;
    flaggedComments: number;
  }>({
    totalComments: 0,
    pendingComments: 0,
    approvedComments: 0,
    rejectedComments: 0,
    flaggedComments: 0,
  });
  const { toast } = useToast();

  const itemsPerPage = 12;
  const totalPages = Math.max(1, Math.ceil(totalComments / itemsPerPage));

  // Fetch comments
  const fetchComments = React.useCallback(
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

        const response = await fetch(`/api/admin/comments?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch comments");
        }
        const data = await response.json();
        setComments(data.comments || []);
        setTotalComments(data.total || data.count || (data.comments || []).length);
        if (data.statistics) {
          setStatistics(data.statistics);
        }
      } catch (error) {
        console.error("Error fetching comments:", error);
        toast({
          title: "Error",
          description: "Failed to load comments. Please try again.",
          variant: "destructive",
        });
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [currentPage, itemsPerPage, statusFilter, searchQuery, toast],
  );

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  // Load comments on mount and filter/page changes
  React.useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleEditComment = (comment: CommentWithAuthor) => {
    setSelectedComment(comment);
    setIsModalOpen(true);
  };

  const handleDeleteComment = (comment: CommentWithAuthor) => {
    setCommentToDelete(comment);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;

    // Optimistic Update: Remove from UI immediately
    const previousComments = [...comments];
    setComments((prev) => prev.filter((c) => c.id !== commentToDelete.id));
    setIsDeleteDialogOpen(false);

    try {
      const response = await fetch(
        `/api/admin/comments/${commentToDelete.id}/moderate`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      setCommentToDelete(null);
      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
      // Silent Revalidate
      fetchComments(false);
    } catch (error) {
      console.error("Error deleting comment:", error);
      // Revert on failure
      setComments(previousComments);
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

  const handleModerateComment = async (
    commentId: number,
    status: CommentStatus,
  ) => {
    // Optimistic Update
    const previousComments = [...comments];
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, status } : c)),
    );

    try {
      const response = await fetch(
        `/api/admin/comments/${commentId}/moderate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to moderate comment");
      }

      toast({
        title: "Success",
        description: `Comment ${status} successfully`,
      });
      fetchComments(false);
    } catch (error) {
      console.error("Error moderating comment:", error);
      // Revert
      setComments(previousComments);
      toast({
        title: "Error",
        description: `Failed to ${status} comment`,
        variant: "destructive",
      });
    }
  };

  const handleBulkModerate = async (status: CommentStatus) => {
    if (selectedComments.size === 0) return;

    // Optimistic Update
    const previousComments = [...comments];
    setComments((prev) =>
      prev.map((c) => (selectedComments.has(c.id) ? { ...c, status } : c)),
    );

    const commentsToUpdate = Array.from(selectedComments);
    setSelectedComments(new Set());
    setIsBulkMode(false);

    const promises = commentsToUpdate.map((commentId) =>
      fetch(`/api/admin/comments/${commentId}/moderate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      }),
    );

    try {
      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.ok).length;

      if (successCount > 0) {
        toast({
          title: "Success",
          description: `${successCount} comments ${status} successfully`,
        });

        // Silent Refresh
        fetchComments(false);
      } else {
        // If all failed, revert
        setComments(previousComments);
        toast({
          title: "Error",
          description: "All comments failed to moderate. Reverted.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in bulk moderation:", error);
      // Revert
      setComments(previousComments);
      toast({
        title: "Error",
        description: "Some comments failed to moderate. Changes reverted.",
        variant: "destructive",
      });
    }
  };

  const getStatsCards = () => {
    return [
      {
        title: "Total Comments",
        value: statistics.totalComments,
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
        title: "Pending Comments",
        value: statistics.pendingComments,
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
        title: "Approved Comments",
        value: statistics.approvedComments,
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
        title: "Rejected Comments",
        value: statistics.rejectedComments,
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
        title: "Flagged Comments",
        value: statistics.flaggedComments,
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
    ];
  };

  const _containerVariants = {
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

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comments Management</h1>
          <p className="text-muted-foreground">
            Moderate and manage user comments on reviews
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4"
      >
        {getStatsCards().map((stat, _index) => (
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
                placeholder="Search comments by user, listing, or content..."
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
              onClick={() => fetchComments(true)}
              disabled={isLoading}
              className="h-11 px-6 bg-background/50 border-border/50 hover:bg-background/80"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {isBulkMode && selectedComments.size > 0 && (
          <div className="mt-6 pt-6 border-t border-border/50">
            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">
                {selectedComments.size} comment
                {selectedComments.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkModerate("approved")}
                  className="bg-green-500/10 border-green-500/50 text-green-700 hover:bg-green-500/20"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkModerate("rejected")}
                  className="bg-red-500/10 border-red-500/50 text-red-700 hover:bg-red-500/20"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkModerate("flagged")}
                  className="bg-yellow-500/10 border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/20"
                >
                  <Flag className="h-4 w-4 mr-1" />
                  Flag
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Comments Table */}
      <motion.div variants={itemVariants}>
        <CommentsTable
          comments={comments}
          isLoading={isLoading}
          onEdit={handleEditComment}
          onDelete={handleDeleteComment}
          onModerate={handleModerateComment}
          selectedComments={selectedComments}
          onSelectionChange={setSelectedComments}
          isBulkMode={isBulkMode}
          onBulkModeChange={setIsBulkMode}
          onBulkModerate={handleBulkModerate}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </motion.div>

      {/* Comment Modal */}
      {selectedComment && (
        <CommentModal
          comment={selectedComment}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedComment(null);
          }}
          onUpdate={(updatedComment: CommentWithAuthor) => {
            setComments((prev) =>
              prev.map((c) =>
                c.id === updatedComment.id ? updatedComment : c,
              ),
            );
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setCommentToDelete(null);
        }}
        onConfirm={confirmDeleteComment}
        title="Delete Comment"
        description={`Are you sure you want to delete this comment? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
