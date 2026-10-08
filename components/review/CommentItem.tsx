"use client";

import { useState } from "react";
import { CommentWithAuthor, CommentStatus } from "@/types/comment.types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  MoreVertical,
  Edit,
  Trash2,
  Flag,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { CommentForm } from "./CommentForm";
import { CommentThread } from "./CommentThread";
import { COMMENT_STATUS_COLORS } from "@/types/comment.types";
import { ReportContentModal } from "@/components/shared/ReportContentModal";

interface CommentItemProps {
  comment: CommentWithAuthor;
  reviewId: number;
  onUpdate: (comment: CommentWithAuthor) => void;
  onDelete: (commentId: number) => void;
  onReply: (content: string) => Promise<void>;
  isReply?: boolean;
  isAdmin?: boolean;
  onModerate?: (commentId: number, status: CommentStatus) => void;
  className?: string;
}

export function CommentItem({
  comment,
  reviewId,
  onUpdate,
  onDelete,
  onReply,
  isReply = false,
  isAdmin = false,
  onModerate,
  className = "",
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [showingReplies, setShowingReplies] = useState(false);
  const [replying, setReplying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { toast } = useToast();
  const { userId } = useSupabaseUser();

  const handleReportClick = () => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to report a comment",
        variant: "destructive",
      });
      return;
    }
    setReporting(true);
  };

  // Handle comment edit
  const handleEdit = async (content: string) => {
    try {
      const response = await fetch(
        `/api/reviews/${reviewId}/comments/${comment.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update comment");
      }

      const data = await response.json();
      onUpdate(data.comment);
      setEditing(false);

      toast({
        title: "Success",
        description: "Comment updated successfully",
      });
    } catch (error) {
      console.error("Error updating comment:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update comment",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle comment delete
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      setDeleting(true);

      // Use admin endpoint if admin, otherwise user endpoint
      const endpoint = isAdmin
        ? `/api/admin/comments/${comment.id}/moderate`
        : `/api/reviews/${reviewId}/comments/${comment.id}`;

      const response = await fetch(endpoint, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete comment");
      }

      onDelete(comment.id);
      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete comment",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Handle reply submission
  const handleReply = async (content: string) => {
    try {
      await onReply(content);
      setReplying(false);
    } catch (_error) {
      // Error is handled by the parent
    }
  };

  // Get user initials for avatar fallback
  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if comment can be edited/deleted (author's own comment, or any comment by admin)
  const isOwnComment = !!userId && comment.user_id === userId;
  const canModify = isOwnComment || isAdmin;
  // Anyone (including signed-out visitors, who get prompted to sign in on
  // click) viewing someone else's comment can report it - admins already
  // have Flag for this, and you can't report your own comment.
  const canReport = !isAdmin && !isOwnComment;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.author_avatar || undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(comment.author_name)}
          </AvatarFallback>
        </Avatar>

        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
              {comment.author_name || "Anonymous"}
            </span>

            {/* Status Badge */}
            {comment.status !== "approved" && (
              <Badge
                variant="secondary"
                className={`text-xs ${
                  COMMENT_STATUS_COLORS[
                    comment.status as keyof typeof COMMENT_STATUS_COLORS
                  ]
                }`}
              >
                {comment.status}
              </Badge>
            )}

            <RelativeTime
              date={comment.created_at}
              addSuffix={true}
              className="text-xs text-muted-foreground"
            />

            {/* Updated indicator */}
            {comment.updated_at !== comment.created_at && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
          </div>

          {/* Comment Content or Edit Form */}
          {editing ? (
            <CommentForm
              onSubmit={handleEdit}
              initialValue={comment.content}
              placeholder="Edit your comment..."
              isReply={isReply}
              onCancel={() => setEditing(false)}
              className="mt-2"
            />
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {comment.content}
            </div>
          )}

          {/* Action Buttons */}
          {!editing && (
            <div className="flex items-center gap-2 mt-2">
              {/* Reply Button */}
              {!isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplying(!replying)}
                  className="h-7 px-2 text-xs"
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Reply
                </Button>
              )}

              {/* Show Replies Button */}
              {comment.reply_count && comment.reply_count > 0 && !isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowingReplies(!showingReplies)}
                  className="h-7 px-2 text-xs"
                >
                  {showingReplies ? "Hide" : "Show"} {comment.reply_count} repl
                  {comment.reply_count === 1 ? "y" : "ies"}
                </Button>
              )}

              {/* More Actions Dropdown */}
              {(canModify || canReport) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Regular user actions */}
                    {!isAdmin && canModify && (
                      <>
                        <DropdownMenuItem onClick={() => setEditing(true)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleDelete}
                          disabled={deleting}
                          className="text-destructive focus:text-destructive"
                        >
                          {deleting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}

                    {canReport && (
                      <DropdownMenuItem onClick={handleReportClick}>
                        <Flag className="h-4 w-4 mr-2" />
                        Report
                      </DropdownMenuItem>
                    )}

                    {/* Admin moderation actions */}
                    {isAdmin && onModerate && (
                      <>
                        {comment.status !== "approved" && (
                          <DropdownMenuItem
                            onClick={() => onModerate(comment.id, "approved")}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                        )}
                        {comment.status !== "rejected" && (
                          <DropdownMenuItem
                            onClick={() => onModerate(comment.id, "rejected")}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </DropdownMenuItem>
                        )}
                        {comment.status !== "flagged" && (
                          <DropdownMenuItem
                            onClick={() => onModerate(comment.id, "flagged")}
                          >
                            <Flag className="h-4 w-4 mr-2" />
                            Flag
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={handleDelete}
                          disabled={deleting}
                          className="text-destructive focus:text-destructive"
                        >
                          {deleting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {replying && (
        <div className="ml-11">
          <CommentForm
            onSubmit={handleReply}
            placeholder="Write a reply..."
            isReply={true}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}

      {/* Replies Thread */}
      {showingReplies && comment.reply_count && comment.reply_count > 0 && (
        <div className="ml-11">
          <CommentThread
            reviewId={reviewId}
            parentCommentId={comment.id}
            totalReplies={comment.reply_count}
          />
        </div>
      )}

      <ReportContentModal
        isOpen={reporting}
        onClose={() => setReporting(false)}
        endpoint={`/api/reviews/${reviewId}/comments/${comment.id}/report`}
      />
    </div>
  );
}
