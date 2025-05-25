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
    const { prompt } = await req.json();
    
    console.log('Generating story with SSE streaming for prompt:', prompt);
    
    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
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
              stream: true,
              max_tokens: 500,
              temperature: 0.8,
            }),
          });

          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          let fullContent = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\n').filter(line => line.trim() !== '');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  if (data === '[DONE]') {
                    break;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    
                    if (content) {
                      fullContent += content;
                      // Send the chunk to the client
                      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                      
                      // Add a small delay to make streaming visible (100ms per chunk)
                      await new Promise(resolve => setTimeout(resolve, 100));
                    }
                  } catch (e) {
                    // Ignore parsing errors for partial chunks
                  }
                }
              }
            }

            // Save the final story to database
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const title = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
            
            const { error: insertError } = await supabase
              .from('stories')
              .insert({ 
                title: title,
                content: fullContent.trim()
              });

            if (insertError) {
              console.error('Error saving story:', insertError);
            } else {
              console.log('Story saved to database');
            }

            // Send final message
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));

          } finally {
            reader.releaseLock();
          }

        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in generate-story-sse function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
