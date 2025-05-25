
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, Zap, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import StoryDisplay from '@/components/StoryDisplay';
import StoryHistory from '@/components/StoryHistory';

interface Story {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

const Index = () => {
  const [prompt, setPrompt] = useState('');
  const [useSSE, setUseSSE] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStory, setCurrentStory] = useState('');
  const [stories, setStories] = useState<Story[]>([]);
  const [pollTaskId, setPollTaskId] = useState<string | null>(null);
  const [pollProgress, setPollProgress] = useState(0);
  const { toast } = useToast();

  // Load recent stories on component mount
  useEffect(() => {
    loadRecentStories();
    
    // Set up realtime subscription for new stories
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stories'
        },
        (payload) => {
          console.log('New story added:', payload);
          loadRecentStories(); // Refresh the list
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Polling effect for non-SSE generation
  useEffect(() => {
    if (!pollTaskId || useSSE) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await supabase.functions.invoke('generate-story-polling', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }, {
          queryParams: { taskId: pollTaskId }
        });

        if (response.data) {
          const { status, content, progress, error } = response.data;
          
          if (status === 'generating') {
            setCurrentStory(content || '');
            setPollProgress(progress || 0);
          } else if (status === 'complete') {
            setCurrentStory(content);
            setPollProgress(100);
            setIsGenerating(false);
            setPollTaskId(null);
            clearInterval(pollInterval);
            toast({
              title: "Story Complete!",
              description: "Your story has been generated successfully.",
            });
          } else if (status === 'error') {
            setIsGenerating(false);
            setPollTaskId(null);
            clearInterval(pollInterval);
            toast({
              title: "Generation Failed",
              description: error || "Failed to generate story",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        setIsGenerating(false);
        setPollTaskId(null);
        clearInterval(pollInterval);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [pollTaskId, useSSE, toast]);

  const loadRecentStories = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setStories(data || []);
    } catch (error) {
      console.error('Error loading stories:', error);
    }
  };

  const generateWithSSE = async () => {
    try {
      const response = await fetch(`https://kczezulhpklofnibgarp.functions.supabase.co/generate-story-sse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to start story generation');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let story = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'chunk') {
                story += data.content;
                setCurrentStory(story);
              } else if (data.type === 'complete') {
                setIsGenerating(false);
                toast({
                  title: "Story Complete!",
                  description: "Your story has been generated successfully.",
                });
                return;
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('SSE generation error:', error);
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: "Failed to generate story with SSE",
        variant: "destructive",
      });
    }
  };

  const generateWithPolling = async () => {
    try {
      const response = await supabase.functions.invoke('generate-story-polling', {
        body: { prompt },
      });

      if (response.error) throw response.error;
      
      const { taskId } = response.data;
      setPollTaskId(taskId);
      setPollProgress(0);
      setCurrentStory('');
    } catch (error) {
      console.error('Polling generation error:', error);
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: "Failed to start story generation",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a story prompt",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setCurrentStory('');
    setPollProgress(0);

    if (useSSE) {
      await generateWithSSE();
    } else {
      await generateWithPolling();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <BookOpen className="h-8 w-8 text-purple-600" />
            AI Story Generator
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Experience the difference between Server-Sent Events (SSE) and Polling for real-time story generation.
            Watch stories unfold in real-time with smooth streaming or periodic updates.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generator Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Story Generator
              </CardTitle>
              <CardDescription>
                Enter a prompt and watch your story come to life
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="prompt">Story Prompt</Label>
                <Input
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., A robot discovers emotions for the first time..."
                  disabled={isGenerating}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Generation Method:</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={useSSE ? "secondary" : "default"}>
                    Polling
                  </Badge>
                  <Switch
                    checked={useSSE}
                    onCheckedChange={setUseSSE}
                    disabled={isGenerating}
                  />
                  <Badge variant={useSSE ? "default" : "secondary"}>
                    SSE
                  </Badge>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p><strong>SSE (Server-Sent Events):</strong> Real-time streaming with smooth character-by-character updates</p>
                <p><strong>Polling:</strong> Periodic updates every second with progress indicators</p>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {useSSE ? 'Streaming...' : `Generating... ${pollProgress}%`}
                  </>
                ) : (
                  'Generate Story'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Story Display */}
          <StoryDisplay 
            story={currentStory} 
            isGenerating={isGenerating}
            method={useSSE ? 'SSE' : 'Polling'}
            progress={pollProgress}
          />
        </div>

        {/* Story History */}
        <StoryHistory stories={stories} />
      </div>
    </div>
  );
};

export default Index;
