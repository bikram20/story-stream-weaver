
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/supabase';

export const useSSEGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStory, setCurrentStory] = useState('');
  const { toast } = useToast();

  const generateWithSSE = async (prompt: string) => {
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

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-story-sse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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

  return {
    isGenerating,
    currentStory,
    generateWithSSE,
    setCurrentStory,
    setIsGenerating
  };
};
