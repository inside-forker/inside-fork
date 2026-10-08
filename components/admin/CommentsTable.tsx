"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Trash2,
  CheckCircle,
  XCircle,
  Flag,
  Eye,
  MessageSquare,
  Clock,
  Reply,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentWithAuthor, CommentStatus } from "@/types/comment.types";
import { CommentModal } from "./CommentModal";

interface CommentsTableProps {
  comments: CommentWithAuthor[];
  isLoading: boolean;
  onEdit: (comment: CommentWithAuthor) => void;
  onDelete: (comment: CommentWithAuthor) => void;
  onModerate: (commentId: number, status: CommentStatus) => void;
  selectedComments: Set<number>;
  onSelectionChange: (selected: Set<number>) => void;
  isBulkMode: boolean;
  onBulkModeChange: (enabled: boolean) => void;
  onBulkModerate: (status: CommentStatus) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function CommentsTable({
  comments,
  isLoading,
  onEdit: _onEdit,
  onDelete,
  onModerate,
  selectedComments,
  onSelectionChange,
  isBulkMode,
  onBulkModeChange,
  onBulkModerate,
  currentPage,
  totalPages,
  onPageChange,
}: CommentsTableProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState<
    Record<number, boolean>
  >({});

  // Prevent scroll lock when dropdown opens
  React.useEffect(() => {
    const hasOpenDropdown = Object.values(dropdownOpen).some(
      (isOpen) => isOpen,
    );

    if (hasOpenDropdown) {
      const body = document.body;
      const removeScrollLock = () => {
        body.removeAttribute("data-scroll-locked");
        body.style.marginRight = "";
        body.style.paddingRight = "";
        body.style.overflow = "";
      };

      removeScrollLock();

      const observer = new MutationObserver(() => {
        if (body.hasAttribute("data-scroll-locked")) {
          removeScrollLock();
        }
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["data-scroll-locked", "style"],
      });

      return () => {
        observer.disconnect();
        removeScrollLock();
      };
    }
  }, [dropdownOpen]);

  const getStatusBadgeColor = (status: CommentStatus) => {
    switch (status) {
      case "approved":
        return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "rejected":
        return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "flagged":
        return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "pending":
      default:
        return "bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800";
    }
  };

  const getStatusIcon = (status: CommentStatus) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-3 w-3" />;
      case "rejected":
        return <XCircle className="h-3 w-3" />;
      case "flagged":
        return <Flag className="h-3 w-3" />;
      case "pending":
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const handleSelectComment = (commentId: number, checked: boolean) => {
    const newSelected = new Set(selectedComments);
    if (checked) {
      newSelected.add(commentId);
    } else {
      newSelected.delete(commentId);
    }
    onSelectionChange(newSelected);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const [selectedComment, setSelectedComment] =
    React.useState<CommentWithAuthor | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleViewComment = (comment: CommentWithAuthor) => {
    setSelectedComment(comment);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedComment(null);
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[600px] auto-rows-fr items-start">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse h-full">
            <CardContent className="p-5">
              <div className="flex items-start space-x-3 mb-4">
                <div className="h-12 w-12 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
              <div className="space-y-3 mb-4">
                <div className="h-16 bg-muted rounded"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-6 bg-muted rounded w-1/6"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 min-h-[600px]">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">No comments found</h3>
        <p className="text-muted-foreground text-center max-w-md">
          No comments match the current filters. Try adjusting your search
          criteria or wait for new comments to be submitted.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk Selection Header */}
      {isBulkMode && selectedComments.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 backdrop-blur-sm rounded-xl border border-primary/20 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary">
              {selectedComments.size} comment
              {selectedComments.size !== 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onBulkModerate("approved")}
              className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onBulkModerate("rejected")}
              className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onBulkModerate("flagged")}
              className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50"
            >
              <Flag className="h-4 w-4 mr-2" />
              Flag All
            </Button>
          </div>
        </motion.div>
      )}

      {/* Comments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr items-start min-h-[600px]">
        {comments.map((comment, index) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <Card className="group relative overflow-hidden flex flex-col h-full bg-background/90 backdrop-blur-md border border-border/60 shadow-premium hover:shadow-premium-lg transition-all duration-300">
              {/* Subtle hover background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              {/* Top right dropdown */}
              <div className="absolute top-3 right-3 z-20">
                <DropdownMenu
                  open={dropdownOpen[comment.id] ?? false}
                  onOpenChange={(open) =>
                    setDropdownOpen((prev) => ({
                      ...prev,
                      [comment.id]: open,
                    }))
                  }
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary/10 hover:text-primary"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-44 bg-background/95 backdrop-blur-md shadow-premium border-border/60 rounded-xl"
                  >
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/2 rounded-xl pointer-events-none" />

                    <div className="relative z-10 p-2">
                      <DropdownMenuItem
                        onClick={() => handleViewComment(comment)}
                        className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                      >
                        <Eye className="h-3.5 w-3.5 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {comment.status !== "approved" && (
                        <DropdownMenuItem
                          onClick={() => onModerate(comment.id, "approved")}
                          className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-2" />
                          Approve
                        </DropdownMenuItem>
                      )}
                      {comment.status !== "rejected" && (
                        <DropdownMenuItem
                          onClick={() => onModerate(comment.id, "rejected")}
                          className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-2" />
                          Reject
                        </DropdownMenuItem>
                      )}
                      {comment.status !== "flagged" && (
                        <DropdownMenuItem
                          onClick={() => onModerate(comment.id, "flagged")}
                          className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                        >
                          <Flag className="h-3.5 w-3.5 mr-2" />
                          Flag
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => onDelete(comment)}
                        className="cursor-pointer text-red-600 focus:text-red-600 hover:bg-red-500/10 focus:bg-red-500/10 transition-colors duration-200"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <CardContent className="p-5 relative z-10 flex-1 flex flex-col">
                {/* Header Section */}
                <div className="flex items-start space-x-3 mb-4">
                  {/* Checkbox for bulk operations */}
                  {isBulkMode && (
                    <div className="pt-0.5">
                      <Checkbox
                        checked={selectedComments.has(comment.id)}
                        onCheckedChange={(checked) =>
                          handleSelectComment(comment.id, checked as boolean)
                        }
                        className="mt-0.5"
                      />
                    </div>
                  )}

                  {/* User Avatar */}
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-12 w-12 ring-2 ring-primary/10 dark:ring-primary/20 shadow-sm">
                      <AvatarImage src={comment.author_avatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm">
                        {getInitials(comment.author_name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Status indicator dot */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-background rounded-full flex items-center justify-center ring-1 ring-background shadow-sm">
                      {getStatusIcon(comment.status as CommentStatus)}
                    </div>
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-foreground truncate text-base group-hover:text-primary transition-colors duration-300 flex items-center gap-2">
                        <span className="truncate">{comment.author_name || "Anonymous"}</span>
                        {!!comment.report_count && comment.report_count > 0 && (
                          <span
                            title={`${comment.report_count} pending report${comment.report_count === 1 ? "" : "s"}`}
                            className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                          >
                            🚩 {comment.report_count}
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {new Date(comment.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-muted/50 rounded text-xs">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        Comment #{comment.id}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Comment Content */}
                <div className="mb-3 flex-1">
                  <p className="text-sm text-foreground leading-relaxed line-clamp-4 bg-muted/20 rounded-md p-3 border-l-2 border-primary/20">
                    &ldquo;{truncateText(comment.content)}&rdquo;
                  </p>
                  {comment.parent_id && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Reply className="h-3 w-3" />
                      <span>Reply to comment #{comment.parent_id}</span>
                    </div>
                  )}
                </div>

                {/* Status and Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border backdrop-blur-sm",
                        getStatusBadgeColor(comment.status as CommentStatus),
                      )}
                    >
                      {getStatusIcon(comment.status as CommentStatus)}
                      <span className="capitalize">{comment.status}</span>
                    </div>

                    {/* Reply Count */}
                    {(comment.reply_count || 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        <span>{comment.reply_count || 0} replies</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onModerate(comment.id, "approved")}
                      className="h-6 px-2 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onModerate(comment.id, "rejected")}
                      className="h-6 px-2 text-xs bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50"
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Bulk Mode Toggle */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onBulkModeChange(!isBulkMode);
            if (isBulkMode) {
              onSelectionChange(new Set());
            }
          }}
          className="bg-background/50 border-border/50 hover:bg-background/80"
        >
          {isBulkMode ? "Exit Bulk Mode" : "Enter Bulk Mode"}
        </Button>
        <div className="text-sm text-muted-foreground">
          {comments.length} comment{comments.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Pagination */}
      {totalPages !== undefined && totalPages > 1 && onPageChange && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange((currentPage ?? 1) - 1)}
            disabled={(currentPage ?? 1) <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage ?? 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange((currentPage ?? 1) + 1)}
            disabled={(currentPage ?? 1) >= totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {selectedComment && (
        <CommentModal
          comment={selectedComment}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onUpdate={(_updatedComment) => {
            // Handle comment update if needed
            handleCloseModal();
          }}
        />
      )}
    </>
  );
}
