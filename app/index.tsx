import React, { useState } from "react";
import { Button, Image, SafeAreaView, StyleSheet, View, Text, TouchableOpacity } from "react-native";
import DocumentScanner from "react-native-document-scanner-plugin";
import * as Sharing from 'expo-sharing';

export default function App() {
  const [scannedImage, setScannedImage] = useState<string | null>(null);

  const scanDocument = async () => {
    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({
        croppedImageQuality: 100, // En yüksek kalite
      });

      if (status === "success" && scannedImages && scannedImages.length > 0) {
        setScannedImage(scannedImages[0]);
      }
    } catch (error) {
      console.error("Tarama sırasında bir hata oluştu:", error);
    }
  };

  const shareDocument = async () => {
    if (scannedImage) {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(scannedImage);
      } else {
        alert("Paylaşım bu cihazda desteklenmiyor.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {!scannedImage ? (
        <View style={styles.emptyState}>
          <Text style={styles.title}>iTechScanner</Text>
          <Text style={styles.subtitle}>Belgelerinizi yüksek kalitede tarayın.</Text>
          <TouchableOpacity style={styles.scanButton} onPress={scanDocument}>
            <Text style={styles.scanButtonText}>Kameralı Tarayıcıyı Aç</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultContainer}>
          <Image
            resizeMode="contain"
            style={styles.image}
            source={{ uri: scannedImage }}
          />
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.secondaryButton} onPress={scanDocument}>
              <Text style={styles.buttonText}>Yeni Tara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={shareDocument}>
              <Text style={styles.buttonText}>Paylaş / Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1c1c1e" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  title: { fontSize: 32, fontWeight: "bold", color: "#fff", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#8e8e93", marginBottom: 40, textAlign: "center" },
  scanButton: { backgroundColor: "#007AFF", paddingVertical: 18, paddingHorizontal: 30, borderRadius: 12, width: "100%", alignItems: "center" },
  scanButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  resultContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 },
  image: { width: "90%", height: "75%", borderRadius: 12, backgroundColor: "#000" },
  actionButtons: { flexDirection: "row", justifyContent: "space-around", width: "100%", position: "absolute", bottom: 40, paddingHorizontal: 20 },
  primaryButton: { backgroundColor: "#007AFF", paddingVertical: 15, paddingHorizontal: 20, borderRadius: 10, minWidth: 150, alignItems: "center" },
  secondaryButton: { backgroundColor: "#3a3a3c", paddingVertical: 15, paddingHorizontal: 20, borderRadius: 10, minWidth: 150, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});