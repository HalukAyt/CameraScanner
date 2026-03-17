import React, { useState, useRef, useEffect, useMemo } from "react";
import { Image, SafeAreaView, StyleSheet, View, Text, TouchableOpacity, Animated, PanResponder, ActivityIndicator, ScrollView, Alert, StatusBar, ImageBackground, Modal, TouchableWithoutFeedback } from "react-native";
import DocumentScanner from "react-native-document-scanner-plugin";
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print'; // YENİ: PDF OLUŞTURUCU
import ViewShot, { captureRef } from "react-native-view-shot";
import { WebView } from "react-native-webview";
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavedScan { id: string; title: string; date: string; uri: string; }

interface PlacedSignature {
  id: string;
  uri: string;
  pan: Animated.ValueXY;
  scale: Animated.Value;
  rotate: Animated.Value;
  baseScale: number;
  baseRotate: number;
}

const DraggableSignature = ({ sign, isActive, onPress, isCapturing }: { sign: PlacedSignature, isActive: boolean, onPress: () => void, isCapturing: boolean }) => {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        onPress(); 
        // @ts-ignore
        sign.pan.setOffset({ x: sign.pan.x._value, y: sign.pan.y._value });
        sign.pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: sign.pan.x, dy: sign.pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => { sign.pan.flattenOffset(); },
    })
  ).current;

  return (
    <Animated.View 
      {...panResponder.panHandlers} 
      style={[ 
        styles.signatureWrapper, 
        { 
          transform: [
            { translateX: sign.pan.x },
            { translateY: sign.pan.y },
            { scale: sign.scale }, 
            { rotate: sign.rotate.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] }) } 
          ]
        },
        isActive && !isCapturing ? styles.activeSignature : styles.inactiveSignature,
        isCapturing && { borderWidth: 0, backgroundColor: 'transparent' } 
      ]}
    >
      <Image source={{ uri: sign.uri }} style={styles.signatureImage} />
    </Animated.View>
  );
};


export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'editor'>('dashboard');
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  
  const [isProcessingSignature, setIsProcessingSignature] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [rawSignatureBase64, setRawSignatureBase64] = useState<string | null>(null);

  const [savedScans, setSavedScans] = useState<SavedScan[]>([]);
  const [savedSignatures, setSavedSignatures] = useState<string[]>([]); 
  const [isSignModalVisible, setSignModalVisible] = useState(false);

  const [placedSignatures, setPlacedSignatures] = useState<PlacedSignature[]>([]);
  const [activeSignId, setActiveSignId] = useState<string | null>(null);

  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const storedScans = await AsyncStorage.getItem('@itech_scans');
      const storedSigs = await AsyncStorage.getItem('@itech_signatures');
      if (storedScans) setSavedScans(JSON.parse(storedScans));
      if (storedSigs) setSavedSignatures(JSON.parse(storedSigs));
    } catch (e) { console.error("Veriler yüklenemedi", e); }
  };

  const resetEditorState = () => {
    setPlacedSignatures([]);
    setActiveSignId(null);
  };

  const scanDocument = async () => {
    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({ croppedImageQuality: 100 });
      if (status === "success" && scannedImages && scannedImages.length > 0) {
        setScannedImage(scannedImages[0]);
        resetEditorState();
        setCurrentScreen('editor');
      }
    } catch (error) { console.error("Tarama hatası:", error); }
  };

  const scanWetSignature = async () => {
    try {
      setIsProcessingSignature(true);
      const { scannedImages, status } = await DocumentScanner.scanDocument({ croppedImageQuality: 100 });
      if (status === "success" && scannedImages && scannedImages.length > 0) {
        const imageUri = scannedImages[0];
        const base64String = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
        setRawSignatureBase64(`data:image/jpeg;base64,${base64String}`);
      } else { setIsProcessingSignature(false); }
    } catch (error) { setIsProcessingSignature(false); }
  };

  const addSignatureToDocument = (uri: string) => {
    const newSign: PlacedSignature = {
      id: Date.now().toString(),
      uri: uri,
      pan: new Animated.ValueXY(),
      scale: new Animated.Value(1),
      rotate: new Animated.Value(0),
      baseScale: 1,
      baseRotate: 0,
    };
    setPlacedSignatures(prev => [...prev, newSign]);
    setActiveSignId(newSign.id); 
    setSignModalVisible(false);
  };

  const handleSignatureProcessed = async (base64DataUri: string) => {
    setRawSignatureBase64(null);
    setIsProcessingSignature(false);
    try {
      const fileName = `sign_${Date.now()}.png`;
      const fileUri = FileSystem.documentDirectory + fileName;
      const base64Data = base64DataUri.replace('data:image/png;base64,', ''); 
      await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: 'base64' });

      const newSigs = [fileUri, ...savedSignatures];
      setSavedSignatures(newSigs);
      await AsyncStorage.setItem('@itech_signatures', JSON.stringify(newSigs));
      
      addSignatureToDocument(fileUri); 
    } catch (error) { console.error("İmza kaydedilemedi", error); }
  };

  const deleteSignatureFromStorage = (uriToDelete: string) => {
    Alert.alert("İmzayı Sil", "Bu imzayı kalıcı olarak silmek istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: async () => {
          const updated = savedSignatures.filter(uri => uri !== uriToDelete);
          setSavedSignatures(updated);
          await AsyncStorage.setItem('@itech_signatures', JSON.stringify(updated));
          await FileSystem.deleteAsync(uriToDelete, { idempotent: true });
      }}
    ]);
  };

  const removeActiveSignatureFromDocument = () => {
    if (activeSignId) {
      setPlacedSignatures(prev => prev.filter(sign => sign.id !== activeSignId));
      setActiveSignId(null);
    }
  };

  // --- YENİ: PAYLAŞIM SEÇENEKLERİ MENÜSÜ ---
  const shareDocument = () => {
    if (!scannedImage) return;
    Alert.alert(
      "Paylaş",
      "Belgeyi hangi formatta paylaşmak istiyorsunuz?",
      [
        { text: "İptal", style: "cancel" },
        { text: "📸 JPG (Resim)", onPress: () => processShare('jpg') },
        { text: "📄 PDF Belgesi", onPress: () => processShare('pdf') }
      ]
    );
  };

  // --- YENİ: PDF OLUŞTURMA VE PAYLAŞMA MOTORU ---
  const processShare = async (format: 'jpg' | 'pdf') => {
    setIsCapturing(true); 
    setActiveSignId(null); // İmzaların çerçevelerini gizle

    setTimeout(async () => {
      try {
        let finalImageUri = scannedImage!;

        // 1. Ekrandaki imzalarla birlikte fotoğrafı birleştirip çek (ViewShot)
        if (placedSignatures.length > 0 && viewShotRef.current) {
          finalImageUri = await captureRef(viewShotRef, { format: "jpg", quality: 1.0 });
        }

        let shareUri = finalImageUri;

        // 2. Eğer PDF seçildiyse Resmi PDF'e çevir
        if (format === 'pdf') {
          // Güvenli PDF oluşturma (Resmi Base64 olarak gömüyoruz ki yerel dosya hataları olmasın)
          const base64 = await FileSystem.readAsStringAsync(finalImageUri, { encoding: 'base64' });
          const htmlContent = `
            <html>
              <head>
                <style>
                  @page { margin: 0; size: A4 portrait; }
                  body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background-color: #ffffff; }
                  img { width: 100vw; height: 100vh; object-fit: contain; }
                </style>
              </head>
              <body>
                <img src="data:image/jpeg;base64,${base64}" />
              </body>
            </html>
          `;

          const { uri: pdfUri } = await Print.printToFileAsync({ html: htmlContent });
          shareUri = pdfUri; // Paylaşılacak dosya artık PDF oldu
        }

        setIsCapturing(false);
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          // UTMType ekleyerek cihazın dosyayı doğru formatta algılamasını sağlıyoruz
          await Sharing.shareAsync(shareUri, { UTI: format === 'pdf' ? 'com.adobe.pdf' : 'public.jpeg' });
        } else {
          Alert.alert("Hata", "Paylaşım bu cihazda desteklenmiyor.");
        }
      } catch (error) { 
        console.error("Paylaşım hatası:", error);
        setIsCapturing(false); 
      }
    }, 100); // UI'ın güncellenmesi için ufak bir gecikme
  };

  const saveDocumentAndClose = async () => {
    if (!scannedImage) return;
    setIsCapturing(true); setActiveSignId(null);
    setTimeout(async () => {
      try {
        let finalImageUri = scannedImage;
        if (placedSignatures.length > 0 && viewShotRef.current) {
          finalImageUri = await captureRef(viewShotRef, { format: "jpg", quality: 1.0 });
        }
        setIsCapturing(false);
        const permanentUri = FileSystem.documentDirectory + `iTech_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: finalImageUri, to: permanentUri });

        const newScan: SavedScan = {
          id: Date.now().toString(),
          title: `Tarama_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '')}`,
          date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }),
          uri: permanentUri
        };

        const updatedScans = [newScan, ...savedScans];
        await AsyncStorage.setItem('@itech_scans', JSON.stringify(updatedScans));
        setSavedScans(updatedScans);

        setScannedImage(null);
        resetEditorState();
        setCurrentScreen('dashboard');
      } catch (error) { setIsCapturing(false); }
    }, 100);
  };

  const deleteScan = (id: string, uri: string) => {
    Alert.alert("Belgeyi Sil", "Bu işlemi geri alamazsınız.", [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: async () => {
          await FileSystem.deleteAsync(uri, { idempotent: true });
          const updated = savedScans.filter(scan => scan.id !== id);
          setSavedScans(updated);
          await AsyncStorage.setItem('@itech_scans', JSON.stringify(updated));
        } 
      }
    ]);
  };

  const closeEditor = () => {
    Alert.alert("Çıkış Yap", "Kaydetmeden çıkmak istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çık", style: "destructive", onPress: () => {
          setScannedImage(null); resetEditorState(); setCurrentScreen('dashboard');
        }
      }
    ]);
  };

  const updateActiveSignScale = (change: number) => {
    const sign = placedSignatures.find(s => s.id === activeSignId);
    if (sign) {
      sign.baseScale = Math.max(0.5, Math.min(3.0, sign.baseScale + change));
      Animated.timing(sign.scale, { toValue: sign.baseScale, duration: 150, useNativeDriver: false }).start();
    }
  };

  const updateActiveSignRotate = (change: number) => {
    const sign = placedSignatures.find(s => s.id === activeSignId);
    if (sign) {
      sign.baseRotate = sign.baseRotate + change;
      Animated.timing(sign.rotate, { toValue: sign.baseRotate, duration: 150, useNativeDriver: false }).start();
    }
  };

  const handleComingSoon = (f: string) => Alert.alert("🚀 Yakında!", `"${f}" yakında eklenecek.`);

  const renderDashboard = () => (
    <View style={styles.dashboardContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
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
        
        <View style={styles.sectionContainer}>
          <View style={styles.recentsHeader}>
            <Text style={styles.sectionTitle}>Son Taramalar</Text>
          </View>
          {savedScans.length === 0 ? (
            <View style={styles.emptyScansContainer}>
              <Ionicons name="documents-outline" size={40} color="#334155" />
              <Text style={styles.emptyScansText}>Henüz bir tarama yapmadınız.</Text>
            </View>
          ) : (
            savedScans.map((item) => (
              <TouchableOpacity key={item.id} style={styles.recentCard} onPress={() => { setScannedImage(item.uri); resetEditorState(); setCurrentScreen('editor'); }}>
                <View style={styles.recentThumbnail}>
                  <Image source={{ uri: item.uri }} style={{width: '100%', height: '100%', borderRadius: 10}} resizeMode="cover" />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentDocTitle}>{item.title}</Text>
                  <Text style={styles.recentDocDate}>{item.date}</Text>
                </View>
                <TouchableOpacity style={styles.moreBtn} onPress={() => deleteScan(item.id, item.uri)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={24} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color="#6366f1" />
          <Text style={[styles.navText, { color: '#6366f1' }]}>Ana Sayfa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => handleComingSoon("Dosyalar")}>
          <Ionicons name="folder-open-outline" size={24} color="#64748b" />
        <Text style={styles.navText}>Dosyalar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEditor = () => (
    <View style={styles.editorContainer}>
      <View style={styles.editorHeader}>
        <TouchableOpacity onPress={closeEditor} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.editorTitle}>Düzenle</Text>
        <TouchableOpacity onPress={saveDocumentAndClose} style={styles.saveHeaderButton}>
          <Text style={styles.saveHeaderText}>Bitti</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultContainer}>
        <TouchableWithoutFeedback onPress={() => setActiveSignId(null)}>
          <View style={{flex:1, width: '100%', alignItems: 'center', justifyContent: 'center'}}>
            <ViewShot ref={viewShotRef} style={styles.viewShotContainer} options={{ format: "jpg", quality: 1.0 }}>
              <ImageBackground resizeMode="contain" style={styles.documentImage} source={{ uri: scannedImage! }}>
                
                {placedSignatures.map((sign) => (
                  <DraggableSignature 
                    key={sign.id} 
                    sign={sign} 
                    isActive={activeSignId === sign.id} 
                    isCapturing={isCapturing}
                    onPress={() => setActiveSignId(sign.id)} 
                  />
                ))}

              </ImageBackground>
            </ViewShot>
          </View>
        </TouchableWithoutFeedback>

        {activeSignId && !isCapturing && (
          <View style={styles.signatureControlsPanel}>
            <TouchableOpacity style={styles.controlBtn} onPress={() => updateActiveSignScale(-0.1)}>
              <Ionicons name="remove-circle-outline" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} onPress={() => updateActiveSignScale(0.1)}>
              <Ionicons name="add-circle-outline" size={28} color="#fff" />
            </TouchableOpacity>

            <View style={styles.verticalDivider} />

            <TouchableOpacity style={styles.controlBtn} onPress={() => updateActiveSignRotate(-10)}>
              <Ionicons name="arrow-undo-outline" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} onPress={() => updateActiveSignRotate(10)}>
              <Ionicons name="arrow-redo-outline" size={26} color="#fff" />
            </TouchableOpacity>

            <View style={styles.verticalDivider} />
            
            <TouchableOpacity style={styles.controlBtn} onPress={removeActiveSignatureFromDocument}>
              <Ionicons name="trash-outline" size={26} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.editorToolbar}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => scanDocument()}>
             <Ionicons name="refresh" size={24} color="#cbd5e1" />
             <Text style={styles.toolbarText}>Yenile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtnMain} onPress={() => setSignModalVisible(true)}>
            <MaterialCommunityIcons name="draw-pen" size={24} color="#fff" />
            <Text style={styles.toolbarTextMain}>İmza Ekle</Text>
          </TouchableOpacity>
          {/* PAYLAŞ BUTONU ARTIK SEÇENEKLİ ÇALIŞIYOR */}
          <TouchableOpacity style={styles.toolbarBtn} onPress={shareDocument}>
             <Ionicons name="share-outline" size={24} color="#cbd5e1" />
             <Text style={styles.toolbarText}>Paylaş</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={isSignModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>İmza Seçin</Text>
              <TouchableOpacity onPress={() => setSignModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#475569" />
              </TouchableOpacity>
            </View>

            {savedSignatures.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.savedSignsScroll}>
                {savedSignatures.map((uri, index) => (
                  <View key={index} style={styles.savedSignWrapper}>
                    <TouchableOpacity style={styles.savedSignCard} onPress={() => addSignatureToDocument(uri)}>
                      <Image source={{ uri }} style={styles.savedSignImage} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteSignBtn} onPress={() => deleteSignatureFromStorage(uri)}>
                      <Ionicons name="trash" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptySignText}>Henüz kayıtlı imzanız bulunmuyor.</Text>
            )}

            <TouchableOpacity style={styles.newSignBtn} onPress={() => { setSignModalVisible(false); scanWetSignature(); }} disabled={isProcessingSignature}>
              {isProcessingSignature ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="add-circle-outline" size={24} color="#fff" />
                  <Text style={styles.newSignBtnText}>Yeni Islak İmza Tara</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            onMessage={(e) => handleSignatureProcessed(e.nativeEvent.data)}
          />
        </View>
      )}
      {currentScreen === 'dashboard' ? renderDashboard() : renderEditor()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" }, 
  hiddenWebView: { height: 0, width: 0, opacity: 0, position: 'absolute' },
  dashboardContainer: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 30, paddingBottom: 20 },
  appName: { color: '#fff', fontSize: 26, letterSpacing: -0.5 },
  appNameBold: { fontWeight: '900', color: '#6366f1' }, 
  appSubtitle: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  profileBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  heroCard: { backgroundColor: '#6366f1', marginHorizontal: 20, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  heroContent: { flexDirection: 'row', alignItems: 'center' },
  heroIconWrapper: { width: 50, height: 50, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  sectionContainer: { marginTop: 30 },
  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 15 },
  recentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 },
  seeAllText: { color: '#6366f1', fontSize: 14, fontWeight: '600' },
  emptyScansContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
  emptyScansText: { color: '#64748b', marginTop: 10, fontSize: 14 },
  recentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 15 },
  recentThumbnail: { width: 44, height: 44, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  recentInfo: { flex: 1, marginLeft: 15 },
  recentDocTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  recentDocDate: { color: '#64748b', fontSize: 12 },
  moreBtn: { padding: 10 }, 
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 75, backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1e293b', paddingBottom: 15 },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { color: '#64748b', fontSize: 11, marginTop: 4, fontWeight: '500' },
  editorContainer: { flex: 1, backgroundColor: '#0f172a' },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: 20, paddingBottom: 10 },
  backButton: { padding: 5 },
  editorTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  saveHeaderButton: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  saveHeaderText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  resultContainer: { flex: 1, alignItems: "center", paddingTop: 10, paddingBottom: 90 },
  viewShotContainer: { width: "92%", height: "90%", backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", justifyContent: "center", alignItems: "center", shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  documentImage: { width: "100%", height: "100%" },
  signatureWrapper: { position: "absolute", padding: 2 },
  activeSignature: { borderWidth: 2, borderColor: "#6366f1", borderStyle: "dashed", borderRadius: 8, backgroundColor: "rgba(99, 102, 241, 0.1)" },
  inactiveSignature: { borderWidth: 0, backgroundColor: 'transparent' },
  signatureImage: { width: 140, height: 70, resizeMode: "contain" },
  signatureControlsPanel: { position: 'absolute', bottom: 105, flexDirection: 'row', backgroundColor: 'rgba(30, 41, 59, 0.95)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  controlBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  controlText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginHorizontal: 2 },
  verticalDivider: { width: 1, height: 24, backgroundColor: '#475569', marginHorizontal: 10 },
  editorToolbar: { position: 'absolute', bottom: 0, width: '100%', height: 90, backgroundColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingBottom: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  toolbarBtn: { alignItems: 'center', justifyContent: 'center', width: 70 },
  toolbarText: { color: '#cbd5e1', fontSize: 12, marginTop: 6, fontWeight: '500' },
  toolbarBtnMain: { backgroundColor: '#6366f1', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  toolbarTextMain: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold' },
  savedSignsScroll: { marginBottom: 20 },
  savedSignWrapper: { marginRight: 15, position: 'relative' },
  savedSignCard: { backgroundColor: '#cbd5e1', borderRadius: 12, padding: 10, width: 120, height: 70, justifyContent: 'center', alignItems: 'center' },
  savedSignImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  deleteSignBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, elevation: 3 },
  emptySignText: { color: '#64748b', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  newSignBtn: { backgroundColor: '#6366f1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 16 },
  newSignBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 }
});