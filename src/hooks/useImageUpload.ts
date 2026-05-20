import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

interface UseImageUploadReturn {
  pickAndUpload: (storagePath: string, options?: { fromCamera?: boolean }) => Promise<string | null>;
  uploading: boolean;
  uploadError: string | null;
  clearError: () => void;
}

export function useImageUpload(): UseImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pickAndUpload = useCallback(async (
    storagePath: string,
    options?: { fromCamera?: boolean }
  ): Promise<string | null> => {
    setUploadError(null);

    try {
      let result: ImagePicker.ImagePickerResult;

      if (options?.fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          setUploadError('Camera permission denied');
          return null;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
          allowsEditing: false,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setUploadError('Gallery permission denied');
          return null;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
          allowsMultipleSelection: false,
        });
      }

      if (result.canceled || !result.assets?.[0]) return null;

      const asset = result.assets[0];

      // Resize to max 900px wide and compress
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 900 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );

      setUploading(true);
      const response = await fetch(compressed.uri);
      const blob = await response.blob();
      const fileRef = storageRef(storage, storagePath);
      await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
      const downloadUrl = await getDownloadURL(fileRef);
      setUploading(false);
      return downloadUrl;
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed');
      setUploading(false);
      return null;
    }
  }, []);

  const clearError = useCallback(() => setUploadError(null), []);

  return { pickAndUpload, uploading, uploadError, clearError };
}
