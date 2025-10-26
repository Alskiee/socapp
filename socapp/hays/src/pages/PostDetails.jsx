import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PostCard from '@/components/PostCard';
import CommentSection from '@/components/CommentSection';
import { useToast } from '@/utils/Toast';
import { useAuth } from '@/context/AuthContext';
import { getPost, updatePost, deletePost as removePost } from '@/api/posts';

export default function PostDetails() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getPost(id);
      setPost(data);
    } catch (e) {
      toast.error('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const canEdit = user && post && user.id === post.user?.id;

  const onDelete = async () => {
    if (!confirm('Delete this post?')) return;
    try {
      await removePost(id);
      toast.success('Post deleted');
      navigate('/');
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const onUpdate = async () => {
    const content = prompt('Update content', post.content);
    if (content == null) return;
    try {
      await updatePost(id, { content });
      toast.success('Post updated');
      load();
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!post) return <div>Not found</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white border rounded p-4">
        <PostCard post={post} onChanged={load} />
        {canEdit && (
          <div className="mt-3 flex gap-2">
            <button onClick={onUpdate} className="px-3 py-1 rounded bg-yellow-500 text-white">
              Edit
            </button>
            <button onClick={onDelete} className="px-3 py-1 rounded bg-red-600 text-white">
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="bg-white border rounded p-4">
        <h2 className="font-semibold mb-2">Comments</h2>
        <CommentSection postId={id} />
      </div>
    </div>
  );
}
