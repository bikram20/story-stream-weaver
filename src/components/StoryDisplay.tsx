
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileText, Zap, Clock } from 'lucide-react';

interface StoryDisplayProps {
  story: string;
  isGenerating: boolean;
  method: 'SSE' | 'Polling';
  progress?: number;
}

const StoryDisplay: React.FC<StoryDisplayProps> = ({ 
  story, 
  isGenerating, 
  method, 
  progress = 0 
}) => {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generated Story
          </div>
          <Badge variant={method === 'SSE' ? 'default' : 'secondary'} className="flex items-center gap-1">
            {method === 'SSE' ? <Zap className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {method}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {method === 'Polling' && isGenerating && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Generation Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}
        
        <div className="min-h-[300px] max-h-[500px] overflow-y-auto">
          {story ? (
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {story}
                {isGenerating && method === 'SSE' && (
                  <span className="inline-block w-2 h-5 bg-purple-600 ml-1 animate-pulse" />
                )}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              {isGenerating ? (
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>
                    {method === 'SSE' 
                      ? 'Connecting to story stream...' 
                      : 'Starting story generation...'
                    }
                  </p>
                </div>
              ) : (
                <p>Your generated story will appear here...</p>
              )}
            </div>
          )}
        </div>
        
        {story && !isGenerating && (
          <div className="mt-4 pt-4 border-t text-xs text-gray-500">
            Generated using {method} • {story.length} characters
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StoryDisplay;
