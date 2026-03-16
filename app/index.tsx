import React, { useState } from 'react';
import { StyleSheet, View, Button, Image, SafeAreaView } from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';

export default function App() {
  // State'in hem string (fotoğraf yolu) hem de null olabileceğini TypeScript'e söylüyoruz
  const [scannedImage, setScannedImage] = useState<string | null>(null);

  const scanDocument = async () => {
    try {
      // Tarayıcıyı başlat
      const { scannedImages, status } = await DocumentScanner.scanDocument({
        croppedImageQuality: 100, // Premium kalite
      });

      // Status başarılıysa VE scannedImages tanımlıysa VE içinde eleman varsa
      if (status === 'success' && scannedImages && scannedImages.length > 0) {
        setScannedImage(scannedImages[0]);
      }
    } catch (error) {
      console.error("Tarama sırasında bir hata oluştu:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button title="Yeni Belge Tara" onPress={scanDocument} color="#007AFF" />
      </View>
      
      {scannedImage && (
        <Image
          resizeMode="contain"
          style={styles.image}
          source={{ uri: scannedImage }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  image: {
    width: '90%',
    height: '70%',
    borderRadius: 8,
  },
});