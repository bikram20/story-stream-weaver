
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/supabase';

export const usePollingGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStory, setCurrentStory] = useState('');
  const [pollTaskId, setPollTaskId] = useState<string | null>(null);
  const [pollProgress, setPollProgress] = useState(0);
  const { toast } = useToast();

  // Polling effect for non-SSE generation
  useEffect(() => {
    if (!pollTaskId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-story-polling?taskId=${pollTaskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'generating') {
          setCurrentStory(data.content || '');
          setPollProgress(data.progress || 0);
        } else if (data.status === 'complete') {
          setCurrentStory(data.content);
          setPollProgress(100);
          setIsGenerating(false);
          setPollTaskId(null);
          clearInterval(pollInterval);
          toast({
            title: "Story Complete!",
            description: "Your story has been generated successfully.",
          });
        } else if (data.status === 'error') {
          setIsGenerating(false);
          setPollTaskId(null);
          clearInterval(pollInterval);
          toast({
            title: "Generation Failed",
            description: data.error || "Failed to generate story",
            variant: "destructive",
          });
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
  }, [pollTaskId, toast]);

  const generateWithPolling = async (prompt: string) => {
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

  return {
    isGenerating,
    currentStory,
    pollProgress,
    generateWithPolling,
    setCurrentStory,
    setIsGenerating,
    setPollProgress
  };
};
