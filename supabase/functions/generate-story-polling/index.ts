
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// In-memory storage for ongoing generation tasks
const activeGenerations = new Map();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    // Get taskId from URL search params
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    
    console.log('GET request for taskId:', taskId);
    
    if (!taskId) {
      return new Response(JSON.stringify({ error: 'No taskId provided' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const task = activeGenerations.get(taskId);
    console.log('Task status for', taskId, ':', task);
    
    if (!task) {
      return new Response(JSON.stringify({ 
        status: 'not_found',
        error: 'Task not found or expired'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    return new Response(JSON.stringify(task), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST') {
    try {
      const { prompt } = await req.json();
      const taskId = crypto.randomUUID();
      
      console.log('Starting story generation with polling for prompt:', prompt, 'taskId:', taskId);
      
      // Initialize task
      activeGenerations.set(taskId, {
        status: 'generating',
        content: '',
        progress: 0,
      });

      // Start generation in background
      generateStoryInBackground(taskId, prompt);

      return new Response(JSON.stringify({ taskId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Error in generate-story-polling function:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { 
    status: 405,
    headers: corsHeaders
  });
});

async function generateStoryInBackground(taskId: string, prompt: string) {
  try {
    console.log('Background generation started for task:', taskId);
    
    // Simulate progress updates with delays to make it visible
    const progressSteps = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    
    for (const progress of progressSteps) {
      activeGenerations.set(taskId, {
        status: 'generating',
        content: '',
        progress,
      });
      console.log('Progress update for', taskId, ':', progress);
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between progress updates
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a creative storyteller. Write engaging short stories (2-3 paragraphs) based on the given prompt. Make them vivid and imaginative.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    // Save to database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const title = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
    
    const { error: insertError } = await supabase
      .from('stories')
      .insert({ 
        title: title,
        content: generatedContent.trim()
      });

    if (insertError) {
      console.error('Error saving story:', insertError);
    }

    // Mark as complete
    activeGenerations.set(taskId, {
      status: 'complete',
      content: generatedContent.trim(),
      progress: 100,
    });

    console.log('Story generation completed for task:', taskId);

    // Clean up after 5 minutes
    setTimeout(() => {
      activeGenerations.delete(taskId);
      console.log('Cleaned up task:', taskId);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('Error in background generation for task', taskId, ':', error);
    activeGenerations.set(taskId, {
      status: 'error',
      error: error.message,
      progress: 0,
    });
  }
}
