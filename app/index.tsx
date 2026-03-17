import React, { useState, useRef, useMemo } from "react";
import { Image, SafeAreaView, StyleSheet, View, Text, TouchableOpacity, Animated, PanResponder, ActivityIndicator, ScrollView, Alert, StatusBar } from "react-native";
import DocumentScanner from "react-native-document-scanner-plugin";
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import ViewShot, { captureRef } from "react-native-view-shot";
import { WebView } from "react-native-webview";
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'editor'>('dashboard');

  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [signatureUri, setSignatureUri] = useState<string | null>(null);
  const [isProcessingSignature, setIsProcessingSignature] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [rawSignatureBase64, setRawSignatureBase64] = useState<string | null>(null);

  const viewShotRef = useRef<ViewShot>(null);

  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      // @ts-ignore
      pan.setOffset({ x: pan.x._value, y: pan.y._value });
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: () => { pan.flattenOffset(); },
  }), [pan]);

  // --- AKTİF FONKSİYONLAR ---
  const scanDocument = async () => {
    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({ croppedImageQuality: 100 });
      if (status === "success" && scannedImages && scannedImages.length > 0) {
        setScannedImage(scannedImages[0]);
        setSignatureUri(null); 
        pan.setValue({ x: 0, y: 0 }); 
        setCurrentScreen('editor');
      }
    } catch (error) {
      console.error("Tarama hatası:", error);
    }
  };

  const scanWetSignature = async () => {
    try {
      setIsProcessingSignature(true);
      const { scannedImages, status } = await DocumentScanner.scanDocument({ croppedImageQuality: 100 });
      if (status === "success" && scannedImages && scannedImages.length > 0) {
        const imageUri = scannedImages[0];
        const base64String = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
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
          finalImageUri = await captureRef(viewShotRef, { format: "jpg", quality: 1.0 });
        }
        setIsCapturing(false);
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(finalImageUri);
        } else {
          Alert.alert("Hata", "Paylaşım bu cihazda desteklenmiyor.");
        }
      } catch (error) {
        console.error("Kaydetme hatası:", error);
        setIsCapturing(false); 
      }
    }, 100);
  };

  const closeEditor = () => {
    Alert.alert("Çıkış Yap", "Kaydetmeden çıkmak istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çık", style: "destructive", onPress: () => {
          setScannedImage(null);
          setSignatureUri(null);
          setCurrentScreen('dashboard');
        }
      }
    ]);
  };

  // İşlevsiz butonlar için yardımcı fonksiyon
  const handleComingSoon = (feature: string) => {
    Alert.alert("🚀 Yakında!", `"${feature}" özelliği iTechScanner'ın bir sonraki güncellemesinde aktif olacak.`);
  };

  // ==========================================
  // UI: DASHBOARD (ÖZGÜN iTECH TASARIMI)
  // ==========================================
  const renderDashboard = () => (
    <View style={styles.dashboardContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Özel Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>iTech<Text style={styles.appNameBold}>Scanner</Text></Text>
          <Text style={styles.appSubtitle}>Belgelerinizi dijitalleştirin</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => handleComingSoon("Profil Ayarları")}>
          <Ionicons name="person-circle" size={36} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* HERO CARD (Büyük Tarama Kartı) */}
        <TouchableOpacity style={styles.heroCard} onPress={scanDocument} activeOpacity={0.8}>
          <View style={styles.heroContent}>
            <View style={styles.heroIconWrapper}>
              <Ionicons name="scan" size={32} color="#fff" />
            </View>
            <View>
              <Text style={styles.heroTitle}>Hızlı Tarama Başlat</Text>
              <Text style={styles.heroSubtitle}>Yapay zeka destekli belge tespiti</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" opacity={0.5} />
        </TouchableOpacity>

        {/* YATAY ARAÇ MENÜSÜ (Scrollable Chips) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Akıllı Araçlar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolsScroll}>
            {[
              { id: 1, icon: 'document-text', color: '#3b82f6', label: 'Metin Çıkar (OCR)' },
              { id: 2, icon: 'images', color: '#10b981', label: 'Resimden PDF' },
              { id: 3, icon: 'id-card', color: '#f59e0b', label: 'Kimlik Tara' },
              { id: 4, icon: 'lock-closed', color: '#ef4444', label: 'PDF Şifrele' },
            ].map((tool) => (
              <TouchableOpacity key={tool.id} style={styles.toolChip} onPress={() => handleComingSoon(tool.label)}>
                <View style={[styles.chipIconBox, { backgroundColor: tool.color + '20' }]}>
                  <Ionicons name={tool.icon as any} size={22} color={tool.color} />
                </View>
                <Text style={styles.chipLabel}>{tool.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* SON TARAMALAR (Modern Kartlar) */}
        <View style={styles.sectionContainer}>
          <View style={styles.recentsHeader}>
            <Text style={styles.sectionTitle}>Son Taramalar</Text>
            <TouchableOpacity onPress={() => handleComingSoon("Tüm Dosyalar")}><Text style={styles.seeAllText}>Tümü</Text></TouchableOpacity>
          </View>

          {[1, 2].map((item) => (
            <TouchableOpacity key={item} style={styles.recentCard} onPress={() => handleComingSoon("Dosya Görüntüleyici")}>
              <View style={styles.recentThumbnail}>
                <Ionicons name="document" size={24} color="#6366f1" />
              </View>
              <View style={styles.recentInfo}>
                <Text style={styles.recentDocTitle}>Sözleşme_Taslak_v{item}.pdf</Text>
                <Text style={styles.recentDocDate}>17 Mar 2026 • 2.4 MB</Text>
              </View>
              <TouchableOpacity style={styles.moreBtn} onPress={() => handleComingSoon("Dosya Seçenekleri")}>
                <MaterialCommunityIcons name="dots-horizontal" size={24} color="#64748b" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* MODERN ALT MENÜ */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color="#6366f1" />
          <Text style={[styles.navText, { color: '#6366f1' }]}>Ana Sayfa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => handleComingSoon("Dosyalarım")}>
          <Ionicons name="folder-open-outline" size={24} color="#64748b" />
          <Text style={styles.navText}>Dosyalar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => handleComingSoon("Pro Araçlar")}>
          <MaterialCommunityIcons name="lightning-bolt-outline" size={26} color="#64748b" />
          <Text style={styles.navText}>Araçlar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ==========================================
  // UI: DÜZENLEME VE İMZA EKRANI
  // ==========================================
  const renderEditor = () => (
    <View style={styles.editorContainer}>
      <View style={styles.editorHeader}>
        <TouchableOpacity onPress={closeEditor} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.editorTitle}>Düzenle</Text>
        <TouchableOpacity onPress={shareOrSaveDocument} style={styles.saveHeaderButton}>
          <Text style={styles.saveHeaderText}>Bitti</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultContainer}>
        <ViewShot ref={viewShotRef} style={styles.viewShotContainer} options={{ format: "jpg", quality: 1.0 }}>
          <Image resizeMode="contain" style={styles.documentImage} source={{ uri: scannedImage! }} />
          {signatureUri && (
            <Animated.View {...panResponder.panHandlers} style={[ styles.signatureWrapper, { transform: pan.getTranslateTransform() }, isCapturing && { borderWidth: 0, backgroundColor: 'transparent' } ]}>
              <Image source={{ uri: signatureUri }} style={styles.signatureImage} />
            </Animated.View>
          )}
        </ViewShot>

        <View style={styles.editorToolbar}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => scanDocument()}>
             <Ionicons name="refresh" size={24} color="#cbd5e1" />
             <Text style={styles.toolbarText}>Yenile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtnMain} onPress={scanWetSignature} disabled={isProcessingSignature}>
            {isProcessingSignature ? <ActivityIndicator color="#fff" /> : (
              <>
                <MaterialCommunityIcons name="draw-pen" size={24} color="#fff" />
                <Text style={styles.toolbarTextMain}>İmza Ekle</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} onPress={shareOrSaveDocument}>
             <Ionicons name="share-outline" size={24} color="#cbd5e1" />
             <Text style={styles.toolbarText}>Paylaş</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {rawSignatureBase64 && (
        <View style={styles.hiddenWebView}>
          <WebView
            originWhitelist={['*']}
            source={{
              html: `<html><body style="margin:0;"><canvas id="c"></canvas><script>
                  var img = new Image();
                  img.onload = function() {
                    var canvas = document.getElementById('c'); var ctx = canvas.getContext('2d');
                    canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0);
                    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); var data = imgData.data;
                    for (var i = 0; i < data.length; i += 4) {
                      var brightness = (data[i] + data[i+1] + data[i+2]) / 3;
                      if (brightness > 140) { data[i+3] = 0; } else { data[i]=0; data[i+1]=0; data[i+2]=0; data[i+3]=255; }
                    }
                    ctx.putImageData(imgData, 0, 0); window.ReactNativeWebView.postMessage(canvas.toDataURL('image/png'));
                  };
                  img.src = '${rawSignatureBase64}';
                </script></body></html>`
            }}
            onMessage={(e) => { setSignatureUri(e.nativeEvent.data); setRawSignatureBase64(null); setIsProcessingSignature(false); }}
          />
        </View>
      )}

      {currentScreen === 'dashboard' ? renderDashboard() : renderEditor()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" }, // Gece Mavisi Arka Plan
  hiddenWebView: { height: 0, width: 0, opacity: 0, position: 'absolute' },

  // --- YENİ ÖZGÜN DASHBOARD STİLLERİ ---
  dashboardContainer: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 30, paddingBottom: 20 },
  appName: { color: '#fff', fontSize: 26, letterSpacing: -0.5 },
  appNameBold: { fontWeight: '900', color: '#6366f1' }, // İndigo vurgu
  appSubtitle: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  profileBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },

  // Hero Card (Büyük Tarama Butonu)
  heroCard: { backgroundColor: '#6366f1', marginHorizontal: 20, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  heroContent: { flexDirection: 'row', alignItems: 'center' },
  heroIconWrapper: { width: 50, height: 50, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },

  sectionContainer: { marginTop: 30 },
  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 15 },
  
  // Yatay Araçlar
  toolsScroll: { paddingLeft: 20 },
  toolChip: { backgroundColor: '#1e293b', borderRadius: 16, padding: 15, marginRight: 15, width: 110, alignItems: 'center' },
  chipIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  chipLabel: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', fontWeight: '500' },

  // Son Taramalar
  recentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 },
  seeAllText: { color: '#6366f1', fontSize: 14, fontWeight: '600' },
  recentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 15 },
  recentThumbnail: { width: 44, height: 44, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  recentInfo: { flex: 1, marginLeft: 15 },
  recentDocTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  recentDocDate: { color: '#64748b', fontSize: 12 },
  moreBtn: { padding: 5 },

  // Alt Navigasyon
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 75, backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1e293b', paddingBottom: 15 },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { color: '#64748b', fontSize: 11, marginTop: 4, fontWeight: '500' },

  // --- EDITOR STİLLERİ ---
  editorContainer: { flex: 1, backgroundColor: '#0f172a' },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: 20, paddingBottom: 10 },
  backButton: { padding: 5 },
  editorTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  saveHeaderButton: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  saveHeaderText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  resultContainer: { flex: 1, alignItems: "center", paddingTop: 10, paddingBottom: 90 },
  viewShotContainer: { width: "92%", height: "90%", backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", justifyContent: "center", alignItems: "center", shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  documentImage: { width: "100%", height: "100%" },
  
  signatureWrapper: { position: "absolute", borderWidth: 2, borderColor: "#6366f1", borderStyle: "dashed", borderRadius: 8, backgroundColor: "rgba(99, 102, 241, 0.1)", padding: 2 },
  signatureImage: { width: 140, height: 70, resizeMode: "contain" },

  editorToolbar: { position: 'absolute', bottom: 0, width: '100%', height: 90, backgroundColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingBottom: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  toolbarBtn: { alignItems: 'center', justifyContent: 'center', width: 70 },
  toolbarText: { color: '#cbd5e1', fontSize: 12, marginTop: 6, fontWeight: '500' },
  toolbarBtnMain: { backgroundColor: '#6366f1', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  toolbarTextMain: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginLeft: 8 }
});