
'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addCommentToIdea } from '@/lib/firebase/firestore';
import type { IdeaSubmission, UserProfile, Comment as CommentType } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageSquare } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

const commentSchema = z.object({
  comment: z.string().min(1, 'Comment cannot be empty.').max(1000, 'Comment is too long.'),
});

type CommentFormData = z.infer<typeof commentSchema>;

interface IdeaCommentsProps {
  idea: IdeaSubmission;
  currentUserProfile: UserProfile;
  onCommentPosted: () => void;
}

const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

export function IdeaComments({ idea, currentUserProfile, onCommentPosted }: IdeaCommentsProps) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
  });

  const onSubmit: SubmitHandler<CommentFormData> = async (data) => {
    try {
      await addCommentToIdea(idea.id!, idea.title, data.comment, currentUserProfile);
      toast({ title: 'Comment Posted', description: 'Your feedback has been added to the discussion.' });
      reset();
      onCommentPosted(); // Callback to parent to refetch data
    } catch (error) {
      console.error("Error posting comment:", error);
      toast({ title: 'Error', description: (error as Error).message || 'Could not post comment.', variant: 'destructive' });
    }
  };
  
  const sortedComments = idea.comments?.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis()) || [];

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-lg flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary"/>
        Feedback & Discussion
      </h4>
      <div className="space-y-4 max-h-96 overflow-y-auto pr-3">
        {sortedComments.length > 0 ? (
          sortedComments.map((comment: CommentType) => (
            <div key={comment.id} className="flex items-start space-x-3">
              <Avatar className="h-8 w-8">
                  <AvatarFallback>{getInitials(comment.authorName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{comment.authorName}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true })}</p>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Start the conversation!</p>
        )}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 pt-4 border-t">
        <Textarea
          {...register('comment')}
          placeholder="Add your feedback or ask a question..."
          rows={3}
          disabled={isSubmitting}
        />
        {errors.comment && <p className="text-sm text-destructive">{errors.comment.message}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner className="mr-2" size={16} /> : <Send className="mr-2 h-4 w-4" />}
            Post Comment
          </Button>
        </div>
      </form>
    </div>
  );
}
