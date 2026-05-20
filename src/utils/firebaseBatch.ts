import { writeBatch, doc, Firestore } from 'firebase/firestore';

const BATCH_SIZE = 500; // Firebase limit

export async function batchUpdate(db: Firestore, collectionName: string, items: any[]) {
  if (!items || items.length === 0) {
    console.warn('⚠️  batchUpdate: No items to update');
    return;
  }

  console.log(`🔄 Batch updating ${items.length} documents in ${collectionName}...`);
  
  const chunks = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE));
  }

  let totalUpdated = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const batch = writeBatch(db);

    chunk.forEach(item => {
      if (!item.id) {
        console.error('❌ Missing id for item:', item);
        return;
      }
      
      const docRef = doc(db, collectionName, item.id);
      batch.update(docRef, item.data);
    });

    await batch.commit();
    totalUpdated += chunk.length;
    
    console.log(`✅ Batch ${i + 1}/${chunks.length} committed (${totalUpdated}/${items.length} updated)`);
  }

  console.log(`✨ Successfully updated ${totalUpdated} documents`);
  return totalUpdated;
}

export async function batchCreate(db: Firestore, collectionName: string, items: any[]) {
  if (!items || items.length === 0) {
    console.warn('⚠️  batchCreate: No items to create');
    return;
  }

  console.log(`➕ Batch creating ${items.length} documents in ${collectionName}...`);
  
  const chunks = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE));
  }

  let totalCreated = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const batch = writeBatch(db);

    chunk.forEach(item => {
      const docRef = item.id 
        ? doc(db, collectionName, item.id)
        : doc(db, collectionName); 
      
      batch.set(docRef, item.data);
    });

    await batch.commit();
    totalCreated += chunk.length;
    
    console.log(`✅ Batch ${i + 1}/${chunks.length} committed (${totalCreated}/${items.length} created)`);
  }

  console.log(`✨ Successfully created ${totalCreated} documents`);
  return totalCreated;
}

export async function batchDelete(db: Firestore, collectionName: string, ids: string[]) {
  if (!ids || ids.length === 0) {
    console.warn('⚠️  batchDelete: No IDs to delete');
    return;
  }

  console.log(`🗑️  Batch deleting ${ids.length} documents from ${collectionName}...`);
  
  const chunks = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    chunks.push(ids.slice(i, i + BATCH_SIZE));
  }

  let totalDeleted = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const batch = writeBatch(db);

    chunk.forEach(id => {
      const docRef = doc(db, collectionName, id);
      batch.delete(docRef);
    });

    await batch.commit();
    totalDeleted += chunk.length;
    
    console.log(`✅ Batch ${i + 1}/${chunks.length} committed (${totalDeleted}/${ids.length} deleted)`);
  }

  console.log(`✨ Successfully deleted ${totalDeleted} documents`);
  return totalDeleted;
}

export async function batchMixed(db: Firestore, operations: { create?: any[], update?: any[], delete?: any[] }) {
  const { create = [], update = [], delete: toDelete = [] } = operations;
  
  const totalOps = create.length + update.length + toDelete.length;
  
  if (totalOps === 0) {
    console.warn('⚠️  batchMixed: No operations to perform');
    return;
  }

  console.log(`🔄 Performing ${totalOps} mixed operations...`);
  
  const allOps = [
    ...create.map(op => ({ ...op, type: 'create' })),
    ...update.map(op => ({ ...op, type: 'update' })),
    ...toDelete.map(op => ({ ...op, type: 'delete' }))
  ];

  const chunks = [];
  for (let i = 0; i < allOps.length; i += BATCH_SIZE) {
    chunks.push(allOps.slice(i, i + BATCH_SIZE));
  }

  let stats = { created: 0, updated: 0, deleted: 0 };

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const batch = writeBatch(db);

    chunk.forEach(op => {
      const docRef = op.id
        ? doc(db, op.collection, op.id)
        : doc(db, op.collection);

      switch (op.type) {
        case 'create':
          batch.set(docRef, op.data);
          stats.created++;
          break;
        case 'update':
          batch.update(docRef, op.data);
          stats.updated++;
          break;
        case 'delete':
          batch.delete(docRef);
          stats.deleted++;
          break;
      }
    });

    await batch.commit();
    console.log(`✅ Batch ${i + 1}/${chunks.length} committed`);
  }

  console.log('✨ Batch operations completed:');
  console.table(stats);
  
  return stats;
}

export async function batchUpdateAtomic(db: Firestore, collectionName: string, items: any[]) {
  if (!items || items.length === 0) {
    console.warn('⚠️  batchUpdateAtomic: No items to update');
    return;
  }

  if (items.length > BATCH_SIZE) {
    throw new Error(`Too many items (${items.length}). Maximum ${BATCH_SIZE} for atomic operations.`);
  }

  console.log(`🔒 Atomic batch updating ${items.length} documents...`);

  const batch = writeBatch(db);

  items.forEach(item => {
    if (!item.id) {
      throw new Error('Missing id for item in atomic update');
    }
    
    const docRef = doc(db, collectionName, item.id);
    batch.update(docRef, item.data);
  });

  await batch.commit();
  console.log(`✅ Atomic update completed for ${items.length} documents`);
  
  return items.length;
}

export function prepareBatchData(items: any[], getId: (item: any) => string, getData: (item: any) => any) {
  return items.map(item => ({
    id: getId(item),
    data: getData(item)
  }));
}

export default {
  batchUpdate,
  batchCreate,
  batchDelete,
  batchMixed,
  batchUpdateAtomic,
  prepareBatchData
};
