import Dexie, { type Table } from 'dexie';

export interface Literature {
  id: string;
  title: string;
  author: string;
  adaptedContent: string;
}

export interface SyncQueue {
  id?: number;
  endpoint: string;
  payload: any;
  timestamp: number;
}

export class IncludEdDB extends Dexie {
  literature!: Table<Literature>;
  syncQueue!: Table<SyncQueue>; 

  constructor() {
    super('IncludEdDB');
    this.version(1).stores({
      literature: 'id, title, author',
      syncQueue: '++id, endpoint, timestamp' // Operations waiting to sync to server
    });
  }
}

export const db = new IncludEdDB();