import { useEffect } from 'react';
import axios from 'axios';
import { db } from '../db/db';

export const useBackgroundSync = () => {
  useEffect(() => {
    const syncData = async () => {
      // 1. Check if there is anything in the queue
      const queueItems = await db.syncQueue.toArray();
      if (queueItems.length === 0) return;

      console.log(`Syncing ${queueItems.length} items to the server...`);

      // 2. Loop through the queue and send to backend
      for (const item of queueItems) {
        try {
          await axios.post(item.endpoint, item.payload);
          
          // 3. If successful, remove it from the offline IndexedDB queue
          if (item.id) {
            await db.syncQueue.delete(item.id);
          }
        } catch (error) {
          console.error('Sync failed for item', item.id, error);
          // If it fails, it stays in the database to be retried later
        }
      }
    };

    // Listen for the browser coming back online
    window.addEventListener('online', syncData);

    // Also attempt a sync on initial load just in case
    if (navigator.onLine) {
      syncData();
    }

    return () => {
      window.removeEventListener('online', syncData);
    };
  }, []);
};