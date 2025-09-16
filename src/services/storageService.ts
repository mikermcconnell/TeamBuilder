import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { storage } from '@/config/firebase';

// Upload CSV file to Firebase Storage
export const uploadCSV = async (file: File, userId: string): Promise<{ url: string; path: string }> => {
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `csvs/${userId}/${fileName}`);
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return { 
      url: downloadURL, 
      path: snapshot.ref.fullPath 
    };
  } catch (error) {
    console.error('Error uploading CSV:', error);
    throw new Error('Failed to upload CSV file');
  }
};

// Save team configuration to Firebase Storage
export const saveTeamConfiguration = async (config: any, userId: string): Promise<string> => {
  try {
    const timestamp = Date.now();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const storageRef = ref(storage, `configs/${userId}/${timestamp}_config.json`);
    
    const snapshot = await uploadBytes(storageRef, blob);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.error('Error saving configuration:', error);
    throw new Error('Failed to save configuration');
  }
};

// List all CSV files for a user
export const listUserCSVs = async (userId: string): Promise<{ name: string; url: string; path: string }[]> => {
  try {
    const listRef = ref(storage, `csvs/${userId}`);
    const result = await listAll(listRef);
    
    const files = await Promise.all(
      result.items.map(async (itemRef) => ({
        name: itemRef.name,
        url: await getDownloadURL(itemRef),
        path: itemRef.fullPath
      }))
    );
    
    return files;
  } catch (error) {
    console.error('Error listing CSV files:', error);
    return [];
  }
};

// Delete a file from Firebase Storage
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const fileRef = ref(storage, path);
    await deleteObject(fileRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
};