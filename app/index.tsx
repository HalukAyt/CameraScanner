import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import DocumentScanner from "react-native-document-scanner-plugin";
import ViewShot, { captureRef } from "react-native-view-shot";
import { WebView } from "react-native-webview";

// --- ADMOB MODÜLLERİ ---
import mobileAds, {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  TestIds,
} from "react-native-google-mobile-ads";

const bannerAdUnitId = __DEV__
  ? TestIds.BANNER
  : Platform.select({
      ios: "ca-app-pub-7283360706215445/4245282864",
      android: "ca-app-pub-7283360706215445/9970751836",
    }) || "";
const interstitialAdUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.select({
      ios: "ca-app-pub-7283360706215445/3294329127",
      android: "ca-app-pub-7283360706215445/6871446203",
    }) || "";

const interstitial = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

interface SavedScan {
  id: string;
  title: string;
  date: string;
  uri: string;
  pages?: string[];
}
interface PlacedSignature {
  id: string;
  uri: string;
  pan: Animated.ValueXY;
  scale: Animated.Value;
  rotate: Animated.Value;
  baseScale: number;
  baseRotate: number;
}

const DraggableSignature = ({
  sign,
  isActive,
  onPress,
  isCapturing,
}: {
  sign: PlacedSignature;
  isActive: boolean;
  onPress: () => void;
  isCapturing: boolean;
}) => {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        onPress();
        // @ts-ignore
        sign.pan.setOffset({ x: sign.pan.x._value, y: sign.pan.y._value });
        sign.pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: sign.pan.x, dy: sign.pan.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: () => {
        sign.pan.flattenOffset();
      },
    }),
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
            {
              rotate: sign.rotate.interpolate({
                inputRange: [-36000, 36000],
                outputRange: ["-36000deg", "36000deg"],
              }),
            },
          ],
        },
        isActive && !isCapturing
          ? styles.activeSignature
          : styles.inactiveSignature,
        isCapturing && { borderWidth: 0, backgroundColor: "transparent" },
      ]}
    >
      <Image source={{ uri: sign.uri }} style={styles.signatureImage} />
    </Animated.View>
  );
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<
    "dashboard" | "editor" | "files"
  >("dashboard");
  const [scannedImagesList, setScannedImagesList] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [documentName, setDocumentName] = useState("Yeni_Belge");
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(
    null,
  );
  const [isProcessingSignature, setIsProcessingSignature] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [rawSignatureBase64, setRawSignatureBase64] = useState<string | null>(
    null,
  );
  const [rawPdfBase64, setRawPdfBase64] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const tempPdfPages = useRef<string[]>([]);
  const [savedScans, setSavedScans] = useState<SavedScan[]>([]);
  const [savedSignatures, setSavedSignatures] = useState<string[]>([]);
  const [isSignModalVisible, setSignModalVisible] = useState(false);
  const [placedSignatures, setPlacedSignatures] = useState<PlacedSignature[]>(
    [],
  );
  const [activeSignId, setActiveSignId] = useState<string | null>(null);
  const viewShotRef = useRef<ViewShot>(null);

  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const actionCounter = useRef(0);

  useEffect(() => {
    loadData();
    mobileAds().initialize();
    const l1 = interstitial.addAdEventListener(AdEventType.LOADED, () =>
      setIsAdLoaded(true),
    );
    const l2 = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setIsAdLoaded(false);
      interstitial.load();
    });
    interstitial.load();
    return () => {
      l1();
      l2();
    };
  }, []);

  const loadData = async () => {
    try {
      const storedScans = await AsyncStorage.getItem("@itech_scans");
      const storedSigs = await AsyncStorage.getItem("@itech_signatures");
      if (storedScans) setSavedScans(JSON.parse(storedScans));
      if (storedSigs) setSavedSignatures(JSON.parse(storedSigs));
    } catch (e) {
      console.error("Veriler yüklenemedi", e);
    }
  };

  const handleAdFrequency = () => {
    actionCounter.current += 1;
    if (actionCounter.current % 3 === 0 && isAdLoaded) {
      setTimeout(() => interstitial.show(), 500);
    }
  };

  const resetEditorState = (defaultName?: string, id: string | null = null) => {
    setPlacedSignatures([]);
    setActiveSignId(null);
    setDocumentName(
      defaultName || `iTech_Belge_${Date.now().toString().slice(-4)}`,
    );
    setEditingDocumentId(id);
  };

  const openSavedScan = (scan: SavedScan) => {
    setScannedImagesList(scan.pages || [scan.uri]);
    setCurrentPage(0);
    resetEditorState(scan.title, scan.id);
    setCurrentScreen("editor");
  };

  const deleteScan = (id: string, uri: string) => {
    Alert.alert("Belgeyi Sil", "Bu işlemi geri alamazsınız.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(uri, { idempotent: true });
            const updated = savedScans.filter((scan) => scan.id !== id);
            setSavedScans(updated);
            await AsyncStorage.setItem("@itech_scans", JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const closeEditor = () => {
    Alert.alert("Çıkış Yap", "Kaydetmeden çıkmak istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çık",
        style: "destructive",
        onPress: () => {
          setScannedImagesList([]);
          resetEditorState();
          setCurrentScreen("dashboard");
        },
      },
    ]);
  };

  const updateActiveSignScale = (change: number) => {
    const sign = placedSignatures.find((s) => s.id === activeSignId);
    if (sign) {
      sign.baseScale = Math.max(0.5, Math.min(3.0, sign.baseScale + change));
      Animated.timing(sign.scale, {
        toValue: sign.baseScale,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  };

  const updateActiveSignRotate = (change: number) => {
    const sign = placedSignatures.find((s) => s.id === activeSignId);
    if (sign) {
      sign.baseRotate = sign.baseRotate + change;
      Animated.timing(sign.rotate, {
        toValue: sign.baseRotate,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  };

  const importPdfFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsLoadingPdf(true);
        tempPdfPages.current = [];
        const pdfUri = result.assets[0].uri;
        const base64String = await FileSystem.readAsStringAsync(pdfUri, {
          encoding: "base64",
        });
        resetEditorState(result.assets[0].name.replace(".pdf", ""), null);
        setRawPdfBase64(base64String);
      }
    } catch (err) {
      setIsLoadingPdf(false);
      console.error(err);
    }
  };

  const importFromGallery = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (!result.canceled && result.assets) {
        setScannedImagesList(result.assets.map((a) => a.uri));
        setCurrentPage(0);
        resetEditorState(undefined, null);
        setCurrentScreen("editor");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const scanDocument = async () => {
    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
      });
      if (status === "success" && scannedImages) {
        setScannedImagesList(scannedImages);
        setCurrentPage(0);
        resetEditorState(undefined, null);
        setCurrentScreen("editor");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const scanWetSignature = async () => {
    try {
      setIsProcessingSignature(true);
      Alert.alert(
        "İpucu",
        "Kamera açıldığında filtre ikonuna basıp 'Renkli' seçin!",
      );
      setTimeout(async () => {
        const { scannedImages, status } = await DocumentScanner.scanDocument({
          croppedImageQuality: 100,
        });
        if (status === "success" && scannedImages) {
          const base64 = await FileSystem.readAsStringAsync(scannedImages[0], {
            encoding: "base64",
          });
          setRawSignatureBase64(`data:image/jpeg;base64,${base64}`);
        } else {
          setIsProcessingSignature(false);
        }
      }, 500);
    } catch (e) {
      setIsProcessingSignature(false);
      console.error(e);
    }
  };

  const changePage = (newIndex: number) => {
    if (placedSignatures.length > 0) {
      setIsCapturing(true);
      setActiveSignId(null);
      setTimeout(async () => {
        try {
          const bakedUri = await captureRef(viewShotRef, {
            format: "jpg",
            quality: 1.0,
          });
          const updatedList = [...scannedImagesList];
          updatedList[currentPage] = bakedUri;
          setScannedImagesList(updatedList);
          setPlacedSignatures([]);
          setCurrentPage(newIndex);
          setIsCapturing(false);
        } catch (e) {
          setIsCapturing(false);
          console.error(e);
        }
      }, 100);
    } else {
      setCurrentPage(newIndex);
    }
  };

  const addSignatureToDocument = (uri: string) => {
    const newSign = {
      id: Date.now().toString(),
      uri,
      pan: new Animated.ValueXY(),
      scale: new Animated.Value(1),
      rotate: new Animated.Value(0),
      baseScale: 1,
      baseRotate: 0,
    };
    setPlacedSignatures((prev) => [...prev, newSign]);
    setActiveSignId(newSign.id);
    setSignModalVisible(false);
  };

  const handleSignatureProcessed = async (base64DataUri: string) => {
    setRawSignatureBase64(null);
    setIsProcessingSignature(false);
    try {
      const fileUri = FileSystem.documentDirectory + `sign_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(
        fileUri,
        base64DataUri.replace("data:image/png;base64,", ""),
        { encoding: "base64" },
      );
      const newSigs = [fileUri, ...savedSignatures];
      setSavedSignatures(newSigs);
      await AsyncStorage.setItem("@itech_signatures", JSON.stringify(newSigs));
      addSignatureToDocument(fileUri);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSignatureFromStorage = (uriToDelete: string) => {
    Alert.alert("İmzayı Sil", "Silinsin mi?", [
      { text: "İptal" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          const updated = savedSignatures.filter((uri) => uri !== uriToDelete);
          setSavedSignatures(updated);
          await AsyncStorage.setItem(
            "@itech_signatures",
            JSON.stringify(updated),
          );
          await FileSystem.deleteAsync(uriToDelete, { idempotent: true });
        },
      },
    ]);
  };

  const removeActiveSignatureFromDocument = () => {
    if (activeSignId) {
      setPlacedSignatures((p) => p.filter((s) => s.id !== activeSignId));
      setActiveSignId(null);
    }
  };

  const shareDocument = () => {
    Alert.alert("Paylaş", "Format seçin:", [
      { text: "İptal" },
      { text: "📸 JPG", onPress: () => processShare("jpg") },
      { text: "📄 PDF", onPress: () => processShare("pdf") },
    ]);
  };

  const processShare = async (format: "jpg" | "pdf") => {
    setIsCapturing(true);
    setActiveSignId(null);
    setTimeout(async () => {
      try {
        let finalPages = [...scannedImagesList];
        if (placedSignatures.length > 0 && viewShotRef.current) {
          finalPages[currentPage] = await captureRef(viewShotRef, {
            format: "jpg",
            quality: 1.0,
          });
        }
        let tempUri = finalPages[currentPage];
        if (format === "pdf") {
          let html = `<html><body style="margin:0; background:#fff;">`;
          for (const uri of finalPages) {
            const b64 = await FileSystem.readAsStringAsync(uri, {
              encoding: "base64",
            });
            html += `<img src="data:image/jpeg;base64,${b64}" style="width:100vw;height:100vh;object-fit:contain;page-break-after:always;"/>`;
          }
          const { uri } = await Print.printToFileAsync({
            html: html + `</body></html>`,
          });
          tempUri = uri;
        }
        const customUri =
          FileSystem.cacheDirectory +
          `${documentName.replace(/[^a-zA-Z0-9]/g, "_")}.${format}`;
        await FileSystem.copyAsync({ from: tempUri, to: customUri });
        setIsCapturing(false);
        await Sharing.shareAsync(customUri);
        handleAdFrequency();
      } catch (e) {
        setIsCapturing(false);
        console.error(e);
      }
    }, 100);
  };

  const saveDocumentAndClose = async () => {
    setIsCapturing(true);
    setActiveSignId(null);
    setTimeout(async () => {
      try {
        let finalPages = [...scannedImagesList];
        if (placedSignatures.length > 0 && viewShotRef.current) {
          finalPages[currentPage] = await captureRef(viewShotRef, {
            format: "jpg",
            quality: 1.0,
          });
        }
        const permanentUris = await Promise.all(
          finalPages.map(async (uri, index) => {
            const permUri =
              FileSystem.documentDirectory + `iTech_${Date.now()}_${index}.jpg`;
            await FileSystem.copyAsync({ from: uri, to: permUri });
            return permUri;
          }),
        );
        let updated = [...savedScans];
        if (editingDocumentId) {
          const idx = updated.findIndex((s) => s.id === editingDocumentId);
          if (idx > -1)
            updated[idx] = {
              ...updated[idx],
              title: documentName,
              uri: permanentUris[0],
              pages: permanentUris,
            };
        } else {
          updated = [
            {
              id: Date.now().toString(),
              title: documentName,
              date: new Date().toLocaleDateString("tr-TR"),
              uri: permanentUris[0],
              pages: permanentUris,
            },
            ...updated,
          ];
        }
        await AsyncStorage.setItem("@itech_scans", JSON.stringify(updated));
        setSavedScans(updated);
        setScannedImagesList([]);
        resetEditorState();
        setCurrentScreen("dashboard");
        setIsCapturing(false);
        handleAdFrequency();
      } catch (e) {
        setIsCapturing(false);
        console.error(e);
      }
    }, 100);
  };

  const renderBottomNav = () => (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => setCurrentScreen("dashboard")}
      >
        <Ionicons
          name={currentScreen === "dashboard" ? "home" : "home-outline"}
          size={24}
          color={currentScreen === "dashboard" ? "#6366f1" : "#64748b"}
        />
        <Text
          style={[
            styles.navText,
            { color: currentScreen === "dashboard" ? "#6366f1" : "#64748b" },
          ]}
        >
          Ana Sayfa
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => setCurrentScreen("files")}
      >
        <Ionicons
          name={
            currentScreen === "files" ? "folder-open" : "folder-open-outline"
          }
          size={24}
          color={currentScreen === "files" ? "#6366f1" : "#64748b"}
        />
        <Text
          style={[
            styles.navText,
            { color: currentScreen === "files" ? "#6366f1" : "#64748b" },
          ]}
        >
          Dosyalar
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderDashboard = () => (
    <View style={styles.dashboardContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>
            ITECH<Text style={styles.appNameBold}>Scanner</Text>
          </Text>
          <Text style={styles.appSubtitle}>Belgelerinizi dijitalleştirin</Text>
        </View>
        {/* <TouchableOpacity style={styles.profileBtn} onPress={() => Alert.alert("🚀", "Profil yakında.")}><Ionicons name="person-circle" size={36} color="#6366f1" /></TouchableOpacity> */}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        {isLoadingPdf && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>PDF Çözümleniyor...</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.heroCard}
          onPress={scanDocument}
          activeOpacity={0.8}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIconWrapper}>
              <Ionicons name="scan" size={32} color="#fff" />
            </View>
            <View>
              <Text style={styles.heroTitle}>Hızlı Tarama Başlat</Text>
              <Text style={styles.heroSubtitle}>
                Yapay zeka destekli belge tespiti
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={24}
            color="#fff"
            opacity={0.5}
          />
        </TouchableOpacity>
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Akıllı Araçlar</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.toolsScroll}
          >
            <TouchableOpacity style={styles.toolChip} onPress={importPdfFile}>
              <View
                style={[styles.chipIconBox, { backgroundColor: "#ef444420" }]}
              >
                <Ionicons name="document-text" size={22} color="#ef4444" />
              </View>
              <Text style={styles.chipLabel}>PDF İmzala</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolChip}
              onPress={importFromGallery}
            >
              <View
                style={[styles.chipIconBox, { backgroundColor: "#10b98120" }]}
              >
                <Ionicons name="image" size={22} color="#10b981" />
              </View>
              <Text style={styles.chipLabel}>Resim Aktar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        <View style={styles.sectionContainer}>
          <View style={styles.recentsHeader}>
            <Text style={styles.sectionTitle}>Son Taramalar</Text>
            {savedScans.length > 0 && (
              <TouchableOpacity onPress={() => setCurrentScreen("files")}>
                <Text style={styles.seeAllText}>
                  Tümü ({savedScans.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {savedScans.length === 0 ? (
            <View style={styles.emptyScansContainer}>
              <Ionicons name="documents-outline" size={40} color="#334155" />
              <Text style={styles.emptyScansText}>
                Henüz bir tarama yapmadınız.
              </Text>
            </View>
          ) : (
            savedScans.slice(0, 3).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.recentCard}
                onPress={() => openSavedScan(item)}
              >
                <View style={styles.recentThumbnail}>
                  <Image
                    source={{ uri: item.uri }}
                    style={{ width: "100%", height: "100%", borderRadius: 10 }}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentDocTitle}>{item.title}</Text>
                  <Text style={styles.recentDocDate}>{item.date}</Text>
                </View>
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={() => deleteScan(item.id, item.uri)}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={24}
                    color="#ef4444"
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
      <View style={styles.adContainer}>
        <BannerAd
          unitId={bannerAdUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
      {renderBottomNav()}
    </View>
  );

  const renderFilesScreen = () => {
    const filtered = savedScans.filter((s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    return (
      <View style={styles.dashboardContainer}>
        <View style={styles.filesHeader}>
          <Text style={styles.filesTitle}>Dosyalarım</Text>
          <TouchableOpacity
            onPress={() => setViewMode((v) => (v === "list" ? "grid" : "list"))}
          >
            <Ionicons
              name={viewMode === "list" ? "grid" : "list"}
              size={26}
              color="#6366f1"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#64748b"
            style={{ marginRight: 10 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Belgelerde Ara..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 160 }}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyScansContainer}>
              <Ionicons name="folder-open-outline" size={50} color="#334155" />
              <Text style={styles.emptyScansText}>Belge bulunamadı.</Text>
            </View>
          ) : (
            <View style={viewMode === "grid" ? styles.gridContainer : {}}>
              {filtered.map((item) =>
                viewMode === "grid" ? (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.gridCard}
                    onPress={() => openSavedScan(item)}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.gridThumbnail}
                    />
                    <Text style={styles.gridTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.gridDate}>{item.date}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.recentCard}
                    onPress={() => openSavedScan(item)}
                  >
                    <View style={styles.recentThumbnail}>
                      <Image
                        source={{ uri: item.uri }}
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: 10,
                        }}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentDocTitle}>{item.title}</Text>
                      <Text style={styles.recentDocDate}>{item.date}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.moreBtn}
                      onPress={() => deleteScan(item.id, item.uri)}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={24}
                        color="#ef4444"
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ),
              )}
            </View>
          )}
        </ScrollView>
        {/* <View style={styles.adContainer}>
          <BannerAd
            unitId={bannerAdUnitId}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View> */}
        {renderBottomNav()}
      </View>
    );
  };

  const renderEditor = () => (
    <View style={styles.editorContainer}>
      <View style={styles.editorHeader}>
        <TouchableOpacity onPress={closeEditor} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleEditContainer}>
          <TextInput
            style={styles.titleInput}
            value={documentName}
            onChangeText={setDocumentName}
            selectTextOnFocus
            maxLength={30}
          />
          <Ionicons
            name="pencil"
            size={14}
            color="#94a3b8"
            style={{ marginLeft: 5 }}
          />
        </View>
        <TouchableOpacity
          onPress={saveDocumentAndClose}
          style={styles.saveHeaderButton}
        >
          <Text style={styles.saveHeaderText}>Bitti</Text>
        </TouchableOpacity>
      </View>
      {scannedImagesList.length > 1 && (
        <View style={styles.pageNavigator}>
          <TouchableOpacity
            onPress={() => changePage(currentPage - 1)}
            disabled={currentPage === 0}
          >
            <Ionicons
              name="chevron-back-circle"
              size={30}
              color={currentPage === 0 ? "#475569" : "#6366f1"}
            />
          </TouchableOpacity>
          <Text style={styles.pageNavText}>
            Sayfa {currentPage + 1} / {scannedImagesList.length}
          </Text>
          <TouchableOpacity
            onPress={() => changePage(currentPage + 1)}
            disabled={currentPage === scannedImagesList.length - 1}
          >
            <Ionicons
              name="chevron-forward-circle"
              size={30}
              color={
                currentPage === scannedImagesList.length - 1
                  ? "#475569"
                  : "#6366f1"
              }
            />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.resultContainer}>
        <TouchableWithoutFeedback onPress={() => setActiveSignId(null)}>
          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "flex-start",
            }}
          >
            <ViewShot
              ref={viewShotRef}
              style={styles.viewShotContainer}
              options={{ format: "jpg", quality: 1.0 }}
            >
              <ImageBackground
                resizeMode="contain"
                style={styles.documentImage}
                source={{ uri: scannedImagesList[currentPage] }}
              >
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
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => updateActiveSignScale(-0.1)}
            >
              <Ionicons name="remove-circle-outline" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => updateActiveSignScale(0.1)}
            >
              <Ionicons name="add-circle-outline" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.verticalDivider} />
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => updateActiveSignRotate(-10)}
            >
              <Ionicons name="arrow-undo-outline" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => updateActiveSignRotate(10)}
            >
              <Ionicons name="arrow-redo-outline" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={styles.verticalDivider} />
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={removeActiveSignatureFromDocument}
            >
              <Ionicons name="trash-outline" size={26} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.editorToolbar}>
          <TouchableOpacity
            style={styles.toolbarBtnMain}
            onPress={() => setSignModalVisible(true)}
          >
            <MaterialCommunityIcons name="draw-pen" size={24} color="#fff" />
            <Text style={styles.toolbarTextMain}>İmza Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolbarBtnShare}
            onPress={shareDocument}
          >
            <Ionicons name="share-social" size={24} color="#fff" />
            <Text style={styles.toolbarTextShare}>Paylaş</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Modal
        visible={isSignModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>İmza Seçin</Text>
              <TouchableOpacity onPress={() => setSignModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#475569" />
              </TouchableOpacity>
            </View>
            {savedSignatures.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.savedSignsScroll}
              >
                {savedSignatures.map((uri, index) => (
                  <View key={index} style={styles.savedSignWrapper}>
                    <TouchableOpacity
                      style={styles.savedSignCard}
                      onPress={() => addSignatureToDocument(uri)}
                    >
                      <Image source={{ uri }} style={styles.savedSignImage} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteSignBtn}
                      onPress={() => deleteSignatureFromStorage(uri)}
                    >
                      <Ionicons name="trash" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptySignText}>Henüz imza yok.</Text>
            )}
            <TouchableOpacity
              style={styles.newSignBtn}
              onPress={() => {
                setSignModalVisible(false);
                scanWetSignature();
              }}
              disabled={isProcessingSignature}
            >
              {isProcessingSignature ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={24} color="#fff" />
                  <Text style={styles.newSignBtnText}>
                    Yeni Islak İmza Tara
                  </Text>
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
      <View style={{ height: 0, width: 0, position: "absolute", opacity: 0 }}>
        <WebView
          originWhitelist={["*"]}
          onMessage={(e) => handleSignatureProcessed(e.nativeEvent.data)}
          source={{
            html: `<html><body style="margin:0;"><canvas id="c"></canvas><script>
                  var img = new Image(); img.onload = function() {
                    var canvas = document.getElementById('c'); var ctx = canvas.getContext('2d'); canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0);
                    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); var data = imgData.data;
                    for (var i = 0; i < data.length; i += 4) { 
                      var r = data[i], g = data[i+1], b = data[i+2];
                      if (r > 130 && g > 130 && b > 130) { data[i+3] = 0; } 
                      else { data[i+3] = 255; data[i] = Math.max(0, r - 20); data[i+1] = Math.max(0, g - 20); data[i+2] = Math.max(0, b - 20); }
                    }
                    ctx.putImageData(imgData, 0, 0); window.ReactNativeWebView.postMessage(canvas.toDataURL('image/png'));
                  }; img.src = '${rawSignatureBase64}';
                </script></body></html>`,
          }}
        />
      </View>
      {rawPdfBase64 && (
        <View style={styles.hiddenWebView}>
          <WebView
            originWhitelist={["*"]}
            onMessage={async (e) => {
              const parsed = JSON.parse(e.nativeEvent.data);
              if (parsed.type === "pdf_page") {
                const uri =
                  FileSystem.documentDirectory +
                  `p_${Date.now()}_${parsed.pageIndex}.jpg`;
                await FileSystem.writeAsStringAsync(
                  uri,
                  parsed.base64.split(",")[1],
                  { encoding: "base64" },
                );
                tempPdfPages.current[parsed.pageIndex] = uri;
                if (
                  tempPdfPages.current.filter(Boolean).length ===
                  parsed.totalPages
                ) {
                  setScannedImagesList([...tempPdfPages.current]);
                  setCurrentPage(0);
                  setCurrentScreen("editor");
                  setIsLoadingPdf(false);
                  setRawPdfBase64(null);
                }
              }
            }}
            source={{
              html: `<html><head><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script></head><body><canvas id="c"></canvas><script>
                  var pdfjsLib = window['pdfjs-dist/build/pdf'];
                  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                  var raw = atob('${rawPdfBase64}'); var uint8Array = new Uint8Array(raw.length);
                  for (var i = 0; i < raw.length; i++) { uint8Array[i] = raw.charCodeAt(i); }
                  pdfjsLib.getDocument({data: uint8Array}).promise.then(function(pdf) {
                    var n = pdf.numPages;
                    var process = function(num) {
                      pdf.getPage(num).then(function(page) {
                        var v = page.getViewport({scale: 1.5}); var canvas = document.getElementById('c');
                        canvas.height = v.height; canvas.width = v.width;
                        page.render({canvasContext: canvas.getContext('2d'), viewport: v}).promise.then(function() {
                          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pdf_page', pageIndex: num - 1, totalPages: n, base64: canvas.toDataURL('image/jpeg', 0.8) }));
                          if(num < n) process(num + 1);
                        });
                      });
                    }; process(1);
                  });
                </script></body></html>`,
            }}
          />
        </View>
      )}
      {currentScreen === "dashboard" && renderDashboard()}
      {currentScreen === "files" && renderFilesScreen()}
      {currentScreen === "editor" && renderEditor()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  hiddenWebView: { height: 0, width: 0, opacity: 0, position: "absolute" },
  dashboardContainer: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
  },
  appName: { color: "#fff", fontSize: 26, letterSpacing: -0.5 },
  appNameBold: { fontWeight: "900", color: "#6366f1" },
  appSubtitle: { color: "#94a3b8", fontSize: 13, marginTop: 2 },
  profileBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  heroCard: {
    backgroundColor: "#6366f1",
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#6366f1",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  heroContent: { flexDirection: "row", alignItems: "center" },
  heroIconWrapper: {
    width: 50,
    height: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  heroSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 4 },
  sectionContainer: { marginTop: 30 },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  toolsScroll: { paddingLeft: 20 },
  toolChip: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 15,
    marginRight: 15,
    width: 110,
    alignItems: "center",
  },
  chipIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  chipLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  recentsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 20,
  },
  seeAllText: { color: "#6366f1", fontSize: 14, fontWeight: "600" },
  emptyScansContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
  emptyScansText: { color: "#64748b", marginTop: 10, fontSize: 14 },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 15,
  },
  recentThumbnail: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  recentInfo: { flex: 1, marginLeft: 15 },
  recentDocTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  recentDocDate: { color: "#64748b", fontSize: 12 },
  moreBtn: { padding: 10 },
  adContainer: {
    width: "100%",
    alignItems: "center",
    position: "absolute",
    bottom: 75,
    backgroundColor: "#0f172a",
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 75,
    backgroundColor: "#0f172a",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingBottom: 15,
  },
  navItem: { alignItems: "center", justifyContent: "center" },
  navText: { color: "#64748b", fontSize: 11, marginTop: 4, fontWeight: "500" },
  filesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 15,
  },
  filesTitle: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 45,
    marginBottom: 20,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 15 },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 15,
    justifyContent: "space-between",
  },
  gridCard: {
    width: "47%",
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 10,
    marginBottom: 15,
  },
  gridThumbnail: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    marginBottom: 10,
    resizeMode: "cover",
  },
  gridTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  gridDate: { color: "#64748b", fontSize: 11 },
  editorContainer: { flex: 1, backgroundColor: "#0f172a" },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: { padding: 5 },
  titleEditContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: 10,
  },
  titleInput: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    padding: 0,
    margin: 0,
    minWidth: 100,
  },
  saveHeaderButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveHeaderText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  pageNavigator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#1e293b",
  },
  pageNavText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginHorizontal: 20,
  },
  resultContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 90,
  },
  viewShotContainer: {
    width: "92%",
    height: "85%",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  documentImage: { width: "100%", height: "100%" },
  signatureWrapper: { position: "absolute", padding: 2 },
  activeSignature: {
    borderWidth: 2,
    borderColor: "#6366f1",
    borderStyle: "dashed",
    borderRadius: 8,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  inactiveSignature: { borderWidth: 0, backgroundColor: "transparent" },
  signatureImage: { width: 140, height: 70, resizeMode: "contain" },
  signatureControlsPanel: {
    position: "absolute",
    bottom: 105,
    flexDirection: "row",
    backgroundColor: "rgba(30, 41, 59, 0.95)",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  controlBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#475569",
    marginHorizontal: 10,
  },
  editorToolbar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 90,
    backgroundColor: "#1e293b",
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  toolbarBtnMain: {
    backgroundColor: "#6366f1",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: "#6366f1",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  toolbarTextMain: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
  },
  toolbarBtnShare: {
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  toolbarTextShare: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "bold" },
  savedSignsScroll: { marginBottom: 20 },
  savedSignWrapper: { marginRight: 15, position: "relative" },
  savedSignCard: {
    backgroundColor: "#cbd5e1",
    borderRadius: 12,
    padding: 10,
    width: 120,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
  },
  savedSignImage: { width: "100%", height: "100%", resizeMode: "contain" },
  deleteSignBtn: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  emptySignText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
  newSignBtn: {
    backgroundColor: "#6366f1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 16,
  },
  newSignBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 15,
    fontSize: 18,
    fontWeight: "bold",
  },
  loadingSubText: { color: "#94a3b8", marginTop: 5, fontSize: 13 },
});
