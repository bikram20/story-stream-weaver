import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const usePollingGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStory, setCurrentStory] = useState('');
  const [pollProgress, setPollProgress] = useState(0);
  const { toast } = useToast();

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
      
      // Show some progress while generating
      setPollProgress(50);
      
      const { data, error } = await supabase.functions.invoke('generate-story-polling', {
        body: { prompt },
      });

      if (error) {
        console.error('Polling invoke error:', error);
        throw error;
      }
      
      console.log('Received response:', data);
      
      if (data.status === 'complete') {
        setCurrentStory(data.content);
        setPollProgress(100);
        setIsGenerating(false);
        toast({
          title: "Story Complete!",
          description: "Your story has been generated successfully.",
        });
      } else if (data.status === 'error') {
        throw new Error(data.error || "Failed to generate story");
      }

    } catch (error) {
      console.error('Polling generation error:', error);
      setIsGenerating(false);
      setPollProgress(0);
      toast({
        title: "Generation Failed",
        description: "Failed to generate story",
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
