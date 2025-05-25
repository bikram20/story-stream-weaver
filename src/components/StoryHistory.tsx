
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Calendar } from 'lucide-react';

interface Story {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface StoryHistoryProps {
  stories: Story[];
}

const StoryHistory: React.FC<StoryHistoryProps> = ({ stories }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Recent Stories
          <Badge variant="secondary">{stories.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No stories generated yet. Create your first story above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stories.map((story) => (
              <div
                key={story.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900 line-clamp-1">
                    {story.title}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-gray-500 ml-4">
                    <Calendar className="h-3 w-3" />
                    {formatDate(story.created_at)}
                  </div>
                </div>
                <p className="text-sm text-gray-600 line-clamp-3">
                  {story.content}
                </p>
                <div className="mt-2 text-xs text-gray-400">
                  {story.content.length} characters
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StoryHistory;
