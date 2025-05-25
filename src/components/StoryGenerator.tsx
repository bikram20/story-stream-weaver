
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Clock } from 'lucide-react';

interface StoryGeneratorProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  useSSE: boolean;
  setUseSSE: (useSSE: boolean) => void;
  isGenerating: boolean;
  pollProgress: number;
  onGenerate: (prompt: string, useSSE: boolean) => void;
}

const StoryGenerator: React.FC<StoryGeneratorProps> = ({
  prompt,
  setPrompt,
  useSSE,
  setUseSSE,
  isGenerating,
  pollProgress,
  onGenerate
}) => {
  const handleGenerate = () => {
    onGenerate(prompt, useSSE);
  };

  return (
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
  );
};

export default StoryGenerator;
