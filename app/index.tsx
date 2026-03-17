import * as Sharing from "expo-sharing";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DocumentScanner from "react-native-document-scanner-plugin";
import ViewShot, { captureRef } from "react-native-view-shot";
import { WebView } from "react-native-webview";
import * as FileSystem from 'expo-file-system/legacy';
export default function App() {
  const [scannedImage, setScannedImage] = useState<string | null>(null);

  const [signatureUri, setSignatureUri] = useState<string | null>(null);
  const [isProcessingSignature, setIsProcessingSignature] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Gizli WebView için geçici Base64 state'i
  const [rawSignatureBase64, setRawSignatureBase64] = useState<string | null>(
    null,
  );

  const viewShotRef = useRef<ViewShot>(null);

  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          // @ts-ignore
          pan.setOffset({ x: pan.x._value, y: pan.y._value });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: () => {
          pan.flattenOffset();
        },
      }),
    [pan],
  );

  const scanDocument = async () => {
    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
      });
      if (status === "success" && scannedImages && scannedImages.length > 0) {
        setScannedImage(scannedImages[0]);
        setSignatureUri(null);
        pan.setValue({ x: 0, y: 0 });
      }
    } catch (error) {
      console.error("Tarama hatası:", error);
    }
  };

  const scanWetSignature = async () => {
    try {
      setIsProcessingSignature(true);
      const { scannedImages, status } = await DocumentScanner.scanDocument({ 
        croppedImageQuality: 100, 
      });

      if (status === "success" && scannedImages && scannedImages.length > 0) {
        const imageUri = scannedImages[0];
        
        // HATANIN DÜZELDİĞİ YER: Doğrudan 'base64' string'ini kullanıyoruz
        const base64String = await FileSystem.readAsStringAsync(imageUri, {
          encoding: 'base64', 
        });
        
        setRawSignatureBase64(`data:image/jpeg;base64,${base64String}`);
      } else {
        setIsProcessingSignature(false);
      }
    } catch (error) {
      console.error("İmza tarama hatası:", error);
      setIsProcessingSignature(false);
    }
  };

  const shareOrSaveDocument = async () => {
    if (!scannedImage) return;
    setIsCapturing(true);

    setTimeout(async () => {
      try {
        let finalImageUri = scannedImage;
        if (signatureUri && viewShotRef.current) {
          finalImageUri = await captureRef(viewShotRef, {
            format: "jpg",
            quality: 1.0,
          });
        }
        setIsCapturing(false);

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(finalImageUri);
        } else {
          alert("Paylaşım bu cihazda desteklenmiyor.");
        }
      } catch (error) {
        console.error("Kaydetme hatası:", error);
        setIsCapturing(false);
      }
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* SİHİRLİ GİZLİ WEBVIEW: Pikselleri okuyup beyazı siler */}
      {rawSignatureBase64 && (
        <View style={styles.hiddenWebView}>
          <WebView
            originWhitelist={["*"]}
            source={{
              html: `
              <html><body style="margin:0;padding:0;">
                <canvas id="c"></canvas>
                <script>
                  var img = new Image();
                  img.onload = function() {
                    var canvas = document.getElementById('c');
                    var ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    var data = imgData.data;
                    
                    // Bütün pikselleri tek tek geziyoruz
                    for (var i = 0; i < data.length; i += 4) {
                      var r = data[i];
                      var g = data[i+1];
                      var b = data[i+2];
                      var brightness = (r + g + b) / 3;
                      
                      // Eğer piksel açık renkse (kağıtsa), ŞEFFAF yap (Alpha = 0)
                      if (brightness > 140) {
                        data[i+3] = 0; 
                      } else {
                        // Koyu renkse (mürekkepse), SİMSİYAH yap
                        data[i] = 0; 
                        data[i+1] = 0; 
                        data[i+2] = 0; 
                        data[i+3] = 255; 
                      }
                    }
                    ctx.putImageData(imgData, 0, 0);
                    // Şeffaf PNG olarak React Native'e geri gönder
                    window.ReactNativeWebView.postMessage(canvas.toDataURL('image/png'));
                  };
                  img.src = '${rawSignatureBase64}';
                </script>
              </body></html>
              `,
            }}
            onMessage={(event) => {
              // WebView'dan şeffaf resim geldi!
              setSignatureUri(event.nativeEvent.data);
              setRawSignatureBase64(null); // WebView'ı kapat
              setIsProcessingSignature(false); // Yüklemeyi bitir
            }}
          />
        </View>
      )}

      {!scannedImage ? (
        <View style={styles.emptyState}>
          <Text style={styles.title}>iTechScanner</Text>
          <Text style={styles.subtitle}>
            Belgelerinizi tarayın ve imzalayın.
          </Text>
          <TouchableOpacity style={styles.scanButton} onPress={scanDocument}>
            <Text style={styles.scanButtonText}>Belge Tara</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultContainer}>
          <ViewShot
            ref={viewShotRef}
            style={styles.viewShotContainer}
            options={{ format: "jpg", quality: 1.0 }}
          >
            <Image
              resizeMode="contain"
              style={styles.documentImage}
              source={{ uri: scannedImage }}
            />

            {signatureUri && (
              <Animated.View
                {...panResponder.panHandlers}
                style={[
                  styles.signatureWrapper,
                  { transform: pan.getTranslateTransform() },
                  isCapturing && {
                    borderWidth: 0,
                    backgroundColor: "transparent",
                  },
                ]}
              >
                <Image
                  source={{ uri: signatureUri }}
                  style={styles.signatureImage}
                />
              </Animated.View>
            )}
          </ViewShot>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={scanWetSignature}
              disabled={isProcessingSignature}
            >
              {isProcessingSignature ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>✍️ Islak İmza</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={shareOrSaveDocument}
            >
              <Text style={styles.buttonText}>Paylaş</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1c1c1e" },
  hiddenWebView: { height: 0, width: 0, opacity: 0, position: "absolute" }, // Asla ekranda görünmez
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: { fontSize: 32, fontWeight: "bold", color: "#fff", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#8e8e93", marginBottom: 40 },
  scanButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  scanButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  resultContainer: { flex: 1, alignItems: "center", paddingTop: 20 },
  viewShotContainer: {
    width: "95%",
    height: "75%",
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  documentImage: { width: "100%", height: "100%" },

  signatureWrapper: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(0, 122, 255, 0.8)",
    borderStyle: "dashed",
    borderRadius: 8,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    padding: 2,
  },
  signatureImage: {
    width: 140,
    height: 70,
    resizeMode: "contain",
  },

  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    position: "absolute",
    bottom: 40,
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 150,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#ff9500",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 150,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
