
import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import StoryDisplay from '@/components/StoryDisplay';
import StoryHistory from '@/components/StoryHistory';
import StoryGenerator from '@/components/StoryGenerator';
import { useSSEGeneration } from '@/hooks/useSSEGeneration';
import { usePollingGeneration } from '@/hooks/usePollingGeneration';
import { useStoryData } from '@/hooks/useStoryData';

const Index = () => {
  const [prompt, setPrompt] = useState('');
  const [useSSE, setUseSSE] = useState(true);
  
  const { stories } = useStoryData();
  
  const {
    isGenerating: isGeneratingSSE,
    currentStory: currentStorySSE,
    generateWithSSE,
    setCurrentStory: setCurrentStorySSE,
    setIsGenerating: setIsGeneratingSSE
  } = useSSEGeneration();
  
  const {
    isGenerating: isGeneratingPolling,
    currentStory: currentStoryPolling,
    pollProgress,
    generateWithPolling,
    setCurrentStory: setCurrentStoryPolling,
    setIsGenerating: setIsGeneratingPolling,
    setPollProgress
  } = usePollingGeneration();

  const isGenerating = useSSE ? isGeneratingSSE : isGeneratingPolling;
  const currentStory = useSSE ? currentStorySSE : currentStoryPolling;

  const handleGenerate = async (prompt: string, useSSE: boolean) => {
    // Reset both stories when starting new generation
    setCurrentStorySSE('');
    setCurrentStoryPolling('');
    setPollProgress(0);

    if (useSSE) {
      await generateWithSSE(prompt);
    } else {
      await generateWithPolling(prompt);
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
          <StoryGenerator
            prompt={prompt}
            setPrompt={setPrompt}
            useSSE={useSSE}
            setUseSSE={setUseSSE}
            isGenerating={isGenerating}
            pollProgress={pollProgress}
            onGenerate={handleGenerate}
          />

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
