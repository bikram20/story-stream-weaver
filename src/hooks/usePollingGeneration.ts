
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
    if (!pollTaskId || !isGenerating) return;

    console.log('Starting polling for taskId:', pollTaskId);

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-story-polling?taskId=${pollTaskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        console.log('Polling response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Polling error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Polling data:', data);
        
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
        } else if (data.status === 'not_found') {
          setIsGenerating(false);
          setPollTaskId(null);
          clearInterval(pollInterval);
          toast({
            title: "Task Not Found",
            description: "The generation task was not found or expired",
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
          description: "Failed to get story generation status",
          variant: "destructive",
        });
      }
    }, 1000); // Poll every second

    return () => {
      console.log('Cleaning up polling interval');
      clearInterval(pollInterval);
    };
  }, [pollTaskId, isGenerating, toast]);

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
      console.log('Invoking polling function with prompt:', prompt);
      
      const { data, error } = await supabase.functions.invoke('generate-story-polling', {
        body: { prompt },
      });

      if (error) {
        console.error('Polling invoke error:', error);
        throw error;
      }
      
      console.log('Got taskId:', data?.taskId);
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
