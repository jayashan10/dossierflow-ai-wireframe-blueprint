import { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import type { DocumentComment } from '../../data/mockData';

interface CommentThreadProps {
  comments: DocumentComment[];
  onReply: (parentId: string, text: string) => void;
}

export function CommentThread({ comments, onReply }: CommentThreadProps) {
  if (!comments.length) {
    return <p className="text-muted-foreground text-sm py-6 text-center">No comments yet</p>;
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} onReply={onReply} />
      ))}
    </div>
  );
}

function CommentItem({ comment, onReply }: { comment: DocumentComment; onReply: (parentId: string, text: string) => void }) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyValue, setReplyValue] = useState('');

  const handleSubmit = () => {
    if (!replyValue.trim()) return;
    onReply(comment.id, replyValue.trim());
    setReplyValue('');
    setIsReplying(false);
  };

  return (
    <div className="border rounded-md p-3 space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{comment.author}</span>
          <span className="text-xs text-muted-foreground">{comment.createdAt}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{comment.section}</p>
        <p className="text-sm mt-2 whitespace-pre-wrap">{comment.text}</p>
      </div>

      <div className="space-y-2">
        {comment.replies?.map((reply) => (
          <div key={reply.id} className="border rounded-md p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">{reply.author}</span>
              <span className="text-[10px] text-muted-foreground">{reply.createdAt}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{reply.section}</p>
            <p className="text-sm mt-2 whitespace-pre-wrap">{reply.text}</p>
          </div>
        ))}
      </div>

      {isReplying ? (
        <div className="space-y-2">
          <Textarea
            value={replyValue}
            onChange={(event) => setReplyValue(event.target.value)}
            placeholder="Add a reply..."
            className="min-h-[80px] text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsReplying(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit}>
              Reply
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setIsReplying(true)}>
          Reply
        </Button>
      )}
    </div>
  );
}
