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
        const { data, error } = await supabase.functions.invoke('generate-story-polling', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (error) throw error;

        if (data) {
          const { status, content, progress, error: taskError } = data;
          
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
              description: taskError || "Failed to generate story",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        setIsGenerating(false);
        setPollTaskId(null);
        clearInterval(pollInterval);
        toast({
          title: "Polling Error",
          description: "Failed to check story generation status",
          variant: "destructive",
        });
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
      const response = await fetch(`https://kczezulhpklofnibgarp.supabase.co/functions/v1/generate-story-sse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader');
      }

      let accumulatedContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                
                if (parsed.content) {
                  accumulatedContent += parsed.content;
                  setCurrentStory(accumulatedContent);
                }
                
                if (parsed.done) {
                  setIsGenerating(false);
                  toast({
                    title: "Story Complete!",
                    description: "Your story has been generated successfully.",
                  });
                  break;
                }
              } catch (e) {
                // Ignore parsing errors for partial chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
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
      const { data, error } = await supabase.functions.invoke('generate-story-polling', {
        body: { prompt },
      });

      if (error) {
        console.error('Polling invoke error:', error);
        throw error;
      }
      
      const { taskId } = data;
      setPollTaskId(taskId);
      setPollProgress(0);
      setCurrentStory('');

      // Start polling for updates
      const pollForUpdates = async () => {
        try {
          const response = await fetch(`https://kczezulhpklofnibgarp.supabase.co/functions/v1/generate-story-polling?taskId=${taskId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${supabase.supabaseKey}`,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();
          
          if (result.status === 'generating') {
            setCurrentStory(result.content || '');
            setPollProgress(result.progress || 0);
            setTimeout(pollForUpdates, 1000); // Poll again in 1 second
          } else if (result.status === 'complete') {
            setCurrentStory(result.content);
            setPollProgress(100);
            setIsGenerating(false);
            setPollTaskId(null);
            toast({
              title: "Story Complete!",
              description: "Your story has been generated successfully.",
            });
          } else if (result.status === 'error') {
            setIsGenerating(false);
            setPollTaskId(null);
            toast({
              title: "Generation Failed",
              description: result.error || "Failed to generate story",
              variant: "destructive",
            });
          } else if (result.status === 'not_found') {
            setTimeout(pollForUpdates, 1000); // Task might not be ready yet
          }
        } catch (error) {
          console.error('Polling error:', error);
          setIsGenerating(false);
          setPollTaskId(null);
          toast({
            title: "Polling Error",
            description: "Failed to check story generation status",
            variant: "destructive",
          });
        }
      };

      // Start polling
      setTimeout(pollForUpdates, 1000);

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
