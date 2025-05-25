
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Story {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export const useStoryData = () => {
  const [stories, setStories] = useState<Story[]>([]);

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

  return {
    stories,
    loadRecentStories
  };
};
