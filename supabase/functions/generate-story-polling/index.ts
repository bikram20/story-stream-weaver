import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only handle POST requests - generate story immediately
    if (req.method === 'POST') {
      const { prompt } = await req.json();
      
      console.log('Generating story immediately for prompt:', prompt);

      // Generate the complete story with OpenAI
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

      // Save to stories table
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

      console.log('Story generation completed');

      // Return the complete story immediately
      return new Response(JSON.stringify({
        status: 'complete',
        content: generatedContent.trim(),
        progress: 100,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error in generate-story-polling function:', error);
    return new Response(JSON.stringify({ 
      status: 'error',
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
