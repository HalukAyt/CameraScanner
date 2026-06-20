import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageBackground,
  InteractionManager,
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
import ViewShot, { captureRef } from "react-native-view-shot";
import { WebView } from "react-native-webview";

// --- ADMOB MODÜLLERİ ---

interface SavedScan {
  id: string;
  title: string;
  date: string;
  uri: string;
  pages?: string[];
  pageFiles?: string[];
  pageTexts?: string[];
  tags?: string[];
  isFavorite?: boolean;
  scanMode?: ScanMode;
  watermarkText?: string;
}

type ImportKind = "pdf" | "docx" | "image";
type ShareFormat = "jpg" | "pdf" | "pdfCompressed" | "word" | "print";
type ImageFilterMode = "gray" | "blackWhite" | "enhance";
type ScanMode = "document" | "form" | "slide" | "whiteboard" | "idCard" | "book";

interface ImportJob {
  id: string;
  kind: ImportKind;
  append: boolean;
  name: string;
  uri?: string;
  base64?: string;
}

interface EditorSnapshot {
  pages: string[];
  pageTexts: string[];
  currentPage: number;
  label: string;
}

interface ImageFilterJob {
  id: string;
  mode: ImageFilterMode;
  pageIndex: number;
  base64: string;
}

interface OcrJob {
  id: string;
  pageIndex: number;
  base64: string;
}

const stripFileExtension = (name: string) => name.replace(/\.[^.]+$/, "");

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type DocumentScannerModule = {
  scanDocument: (options: {
    croppedImageQuality: number;
  }) => Promise<{ scannedImages?: string[]; status?: string }>;
};

type GoogleMobileAdsModule = typeof import("react-native-google-mobile-ads");

const LANGUAGE_STORAGE_KEY = "@itech_language";
const SCANS_STORAGE_KEY = "@itech_scans";
const SIGNATURES_STORAGE_KEY = "@itech_signatures";

const translations = {
  tr: {
    addFromGallery: "Galeriden foto ekle",
    addMergePage: "Sayfa Ekle / Birleştir",
    addPage: "Sayfa Ekle",
    addSignature: "İmza Ekle",
    addWithCamera: "Kamerayla ekle",
    all: "Tümü",
    appSubtitle: "Belgelerinizi dijitalleştirin",
    cancel: "İptal",
    captureModes: "Yakalama Modları",
    changeLanguage: "Dili değiştir",
    chooseSignature: "İmza Seçin",
    compressedPdf: "Sıkıştırılmış PDF",
    defaultDocumentNamePrefix: "iTech_Belge",
    delete: "Sil",
    deleteDocumentMessage: "Bu işlemi geri alamazsınız.",
    deleteDocumentTitle: "Belgeyi Sil",
    deletePageMessage: "Bu sayfayı silmek istiyor musun?",
    deletePageTitle: "Sayfayı Sil",
    deleteSignatureMessage: "Silinsin mi?",
    deleteSignatureTitle: "İmzayı Sil",
    done: "Bitti",
    exit: "Çık",
    exitMessage: "Kaydetmeden çıkmak istediğinize emin misiniz?",
    exitTitle: "Çıkış Yap",
    filesTitle: "Dosyalarım",
    filterBlackWhite: "S/B",
    filterEnhanced: "Netleştir",
    filterGray: "Gri",
    heroSubtitle: "Yapay zeka destekli belge tespiti",
    heroTitle: "Hızlı Tarama Başlat",
    imageProcessingErrorMessage: "Görsel işlenirken bir sorun oluştu.",
    imageProcessingErrorTitle: "Görsel Hatası",
    imageTools: "Görüntü",
    importErrorMessage: "Belge eklenirken bir sorun oluştu.",
    importErrorTitle: "İçe Aktarma Hatası",
    importImage: "Resim Aktar",
    languageSettingsSubtitle: "Uygulama dilini buradan değiştirebilirsiniz.",
    languageSettingsTitle: "Dil",
    languageSubtitle: "Uygulamayı hangi dilde kullanmak istersiniz?",
    languageTitle: "Dil seçin / Choose language",
    lastPageMessage: "Belgede en az bir sayfa kalmalı.",
    lastPageTitle: "Son Sayfa",
    mergeFiles: "PDF / Word / foto birleştir",
    moveLeft: "Sola Taşı",
    moveRight: "Sağa Taşı",
    navFiles: "Dosyalar",
    navHome: "Ana Sayfa",
    noDocumentsFound: "Belge bulunamadı.",
    noScansYet: "Henüz bir tarama yapmadınız.",
    noSignatures: "Henüz imza yok.",
    ocrErrorMessage:
      "Metin okunamadı. İnternet bağlantısı veya belge netliği sorun yaratmış olabilir.",
    ocrErrorTitle: "OCR Hatası",
    ocrHint:
      "OCR metnini otomatik çıkarabilir veya bu alanda elle düzenleyebilirsiniz.",
    ocrLanguage: "OCR Dili",
    ocrPlaceholder: "Bu sayfanın metni...",
    ocrText: "OCR Metni",
    page: "Sayfa",
    pageDeleted: "Sayfa silindi.",
    pageMoved: "Sayfa taşındı.",
    pagesAdded: "Sayfalar eklendi.",
    pdfErrorMessage: "PDF çözümlenemedi.",
    pdfErrorTitle: "PDF Hatası",
    printDocument: "Yazdır",
    processingImage: "Görsel işleniyor...",
    recentScans: "Son Taramalar",
    resolvingDocument: "Belge çözülüyor...",
    rotatePage: "Döndür",
    runOcr: "OCR Tara",
    runningOcr: "OCR metni çıkarılıyor...",
    scannerUnavailableMessage:
      "Bu özellik için native modülü içeren development build gerekir. Şimdilik galeriden foto veya dosya ekleyebilirsin.",
    scannerUnavailableTitle: "Tarayıcı kullanılamıyor",
    scanNewWetSignature: "Yeni Islak İmza Tara",
    scanModeBook: "Kitap",
    scanModeDocument: "Belge",
    scanModeForm: "Form",
    scanModeIdCard: "Kimlik",
    scanModeSlide: "Slayt",
    scanModeWhiteboard: "Tahta",
    searchPlaceholder: "Belgelerde Ara...",
    share: "Paylaş",
    shareAsCompressedPdf: "Sıkıştırılmış PDF paylaş",
    shareAsJpg: "JPG olarak paylaş",
    shareAsPdf: "PDF olarak paylaş",
    shareAsWord: "Word olarak paylaş",
    smartTools: "Akıllı Araçlar",
    someFilesSkippedMessage:
      "Şimdilik yalnızca PDF, DOCX ve görsel dosyaları içe aktarabiliyorum.",
    someFilesSkippedTitle: "Bazı Dosyalar Atlandı",
    stay: "Vazgeç",
    tagsPlaceholder: "Etiketler: fatura, kimlik...",
    tipMessage: "Kamera açıldığında filtre ikonuna basıp 'Renkli' seçin!",
    tipTitle: "İpucu",
    undo: "Geri Al",
    unsupportedFileMessage:
      "Şimdilik PDF, DOCX ve görsel dosyaları ekleyebiliyorum.",
    unsupportedFileTitle: "Desteklenmeyen Dosya",
    uploadDocument: "Belge Yükle",
    watermark: "Filigran",
    watermarkPlaceholder: "Filigran metni...",
    wordErrorMessage: "Word belgesi çözümlenemedi.",
    wordErrorTitle: "Word Hatası",
  },
  en: {
    addFromGallery: "Add from gallery",
    addMergePage: "Add / Merge Page",
    addPage: "Add Page",
    addSignature: "Add Signature",
    addWithCamera: "Add with camera",
    all: "All",
    appSubtitle: "Digitize your documents",
    cancel: "Cancel",
    captureModes: "Capture Modes",
    changeLanguage: "Change language",
    chooseSignature: "Choose Signature",
    compressedPdf: "Compressed PDF",
    defaultDocumentNamePrefix: "iTech_Document",
    delete: "Delete",
    deleteDocumentMessage: "You cannot undo this action.",
    deleteDocumentTitle: "Delete Document",
    deletePageMessage: "Do you want to delete this page?",
    deletePageTitle: "Delete Page",
    deleteSignatureMessage: "Delete this signature?",
    deleteSignatureTitle: "Delete Signature",
    done: "Done",
    exit: "Exit",
    exitMessage: "Are you sure you want to exit without saving?",
    exitTitle: "Exit",
    filesTitle: "My Files",
    filterBlackWhite: "B/W",
    filterEnhanced: "Enhance",
    filterGray: "Gray",
    heroSubtitle: "AI-assisted document detection",
    heroTitle: "Start Quick Scan",
    imageProcessingErrorMessage: "Something went wrong while processing image.",
    imageProcessingErrorTitle: "Image Error",
    imageTools: "Image",
    importErrorMessage: "Something went wrong while adding the document.",
    importErrorTitle: "Import Error",
    importImage: "Import Image",
    languageSettingsSubtitle: "You can change the app language here.",
    languageSettingsTitle: "Language",
    languageSubtitle: "Which language would you like to use?",
    languageTitle: "Choose language / Dil seçin",
    lastPageMessage: "The document must keep at least one page.",
    lastPageTitle: "Last Page",
    mergeFiles: "Merge PDF / Word / photo",
    moveLeft: "Move Left",
    moveRight: "Move Right",
    navFiles: "Files",
    navHome: "Home",
    noDocumentsFound: "No documents found.",
    noScansYet: "You haven't scanned anything yet.",
    noSignatures: "No signatures yet.",
    ocrErrorMessage:
      "Text could not be read. The connection or document clarity may have caused it.",
    ocrErrorTitle: "OCR Error",
    ocrHint:
      "You can extract OCR text automatically or edit it manually here.",
    ocrLanguage: "OCR Language",
    ocrPlaceholder: "Text from this page...",
    ocrText: "OCR Text",
    page: "Page",
    pageDeleted: "Page deleted.",
    pageMoved: "Page moved.",
    pagesAdded: "Pages added.",
    pdfErrorMessage: "PDF could not be parsed.",
    pdfErrorTitle: "PDF Error",
    printDocument: "Print",
    processingImage: "Processing image...",
    recentScans: "Recent Scans",
    resolvingDocument: "Resolving document...",
    rotatePage: "Rotate",
    runOcr: "Run OCR",
    runningOcr: "Extracting OCR text...",
    scannerUnavailableMessage:
      "This feature needs a development build that includes the native scanner module. For now, you can add a photo from the gallery or import a file.",
    scannerUnavailableTitle: "Scanner unavailable",
    scanNewWetSignature: "Scan New Wet Signature",
    scanModeBook: "Book",
    scanModeDocument: "Document",
    scanModeForm: "Form",
    scanModeIdCard: "ID Card",
    scanModeSlide: "Slide",
    scanModeWhiteboard: "Whiteboard",
    searchPlaceholder: "Search documents...",
    share: "Share",
    shareAsCompressedPdf: "Share compressed PDF",
    shareAsJpg: "Share as JPG",
    shareAsPdf: "Share as PDF",
    shareAsWord: "Share as Word",
    smartTools: "Smart Tools",
    someFilesSkippedMessage:
      "For now, I can only import PDF, DOCX, and image files.",
    someFilesSkippedTitle: "Some Files Skipped",
    stay: "Stay",
    tagsPlaceholder: "Tags: invoice, ID...",
    tipMessage: "When the camera opens, tap the filter icon and choose 'Color'.",
    tipTitle: "Tip",
    undo: "Undo",
    unsupportedFileMessage:
      "For now, I can add PDF, DOCX, and image files.",
    unsupportedFileTitle: "Unsupported File",
    uploadDocument: "Upload Document",
    watermark: "Watermark",
    watermarkPlaceholder: "Watermark text...",
    wordErrorMessage: "Word document could not be parsed.",
    wordErrorTitle: "Word Error",
  },
} as const;

type LanguageCode = keyof typeof translations;
type TranslationKey = keyof (typeof translations)["tr"];

const isLanguageCode = (value: string | null): value is LanguageCode =>
  value === "tr" || value === "en";

const languageOptions: {
  code: LanguageCode;
  title: string;
  subtitle: string;
}[] = [
  { code: "tr", title: "Türkçe", subtitle: "Türkçe arayüz" },
  { code: "en", title: "English", subtitle: "English interface" },
];

const scanModeOptions: {
  mode: ScanMode;
  labelKey: TranslationKey;
  icon: string;
}[] = [
  { mode: "document", labelKey: "scanModeDocument", icon: "document-text-outline" },
  { mode: "form", labelKey: "scanModeForm", icon: "reader-outline" },
  { mode: "slide", labelKey: "scanModeSlide", icon: "easel-outline" },
  { mode: "whiteboard", labelKey: "scanModeWhiteboard", icon: "tablet-landscape-outline" },
  { mode: "idCard", labelKey: "scanModeIdCard", icon: "id-card-outline" },
  { mode: "book", labelKey: "scanModeBook", icon: "book-outline" },
];

const ocrLanguageOptions = [
  { code: "tur+eng", label: "TR + EN" },
  { code: "eng", label: "English" },
  { code: "tur", label: "Türkçe" },
  { code: "deu", label: "Deutsch" },
  { code: "fra", label: "Français" },
  { code: "spa", label: "Español" },
  { code: "ita", label: "Italiano" },
  { code: "por", label: "Português" },
  { code: "nld", label: "Nederlands" },
  { code: "swe", label: "Svenska" },
  { code: "nor", label: "Norsk" },
  { code: "dan", label: "Dansk" },
  { code: "fin", label: "Suomi" },
  { code: "pol", label: "Polski" },
  { code: "ces", label: "Čeština" },
  { code: "slk", label: "Slovenčina" },
  { code: "hun", label: "Magyar" },
  { code: "ron", label: "Română" },
  { code: "bul", label: "Български" },
  { code: "ell", label: "Ελληνικά" },
  { code: "rus", label: "Русский" },
  { code: "ukr", label: "Українська" },
  { code: "ara", label: "العربية" },
  { code: "heb", label: "עברית" },
  { code: "hin", label: "हिन्दी" },
  { code: "ben", label: "বাংলা" },
  { code: "urd", label: "اردو" },
  { code: "fas", label: "فارسی" },
  { code: "chi_sim", label: "简体中文" },
  { code: "chi_tra", label: "繁體中文" },
  { code: "jpn", label: "日本語" },
  { code: "kor", label: "한국어" },
  { code: "tha", label: "ไทย" },
  { code: "vie", label: "Tiếng Việt" },
  { code: "ind", label: "Indonesia" },
  { code: "msa", label: "Melayu" },
  { code: "fil", label: "Filipino" },
  { code: "swa", label: "Kiswahili" },
  { code: "tam", label: "தமிழ்" },
  { code: "tel", label: "తెలుగు" },
  { code: "mar", label: "मराठी" },
  { code: "kan", label: "ಕನ್ನಡ" },
];

const arraysEqual = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((item, index) => item === right[index]);

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

const getFileNameFromUri = (uri: string, fallbackName: string) => {
  const path = uri.split("?")[0];
  const fileName = path.substring(path.lastIndexOf("/") + 1);
  return sanitizeFileName(decodeURIComponent(fileName || fallbackName));
};

const fileExists = async (uri: string) => {
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
};

const documentFileUri = (fileName: string) => {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${fileName}`;
};

const normalizeFileToDocuments = async (
  uri: string,
  fallbackName: string,
) => {
  const fileName = getFileNameFromUri(uri, fallbackName);
  const currentDocumentUri = documentFileUri(fileName);

  if (!currentDocumentUri) {
    return { uri, fileName, changed: false };
  }

  if (await fileExists(currentDocumentUri)) {
    return {
      uri: currentDocumentUri,
      fileName,
      changed: currentDocumentUri !== uri,
    };
  }

  if (await fileExists(uri)) {
    await FileSystem.copyAsync({ from: uri, to: currentDocumentUri });
    return {
      uri: currentDocumentUri,
      fileName,
      changed: currentDocumentUri !== uri,
    };
  }

  return { uri, fileName, changed: false };
};

const normalizeSavedScan = async (scan: SavedScan) => {
  const sourcePages = scan.pages?.length ? scan.pages : [scan.uri];
  const migratedPages: string[] = [];
  const pageFiles: string[] = [];
  let changed = false;

  for (let index = 0; index < sourcePages.length; index += 1) {
    const storedFileName = scan.pageFiles?.[index];
    const storedFileUri = storedFileName ? documentFileUri(storedFileName) : null;

    if (storedFileName && storedFileUri && (await fileExists(storedFileUri))) {
      migratedPages.push(storedFileUri);
      pageFiles.push(storedFileName);
      changed = changed || storedFileUri !== sourcePages[index];
      continue;
    }

    const migrated = await normalizeFileToDocuments(
      sourcePages[index],
      `iTech_${scan.id}_${index}.jpg`,
    );
    migratedPages.push(migrated.uri);
    pageFiles.push(migrated.fileName);
    changed = changed || migrated.changed;
  }

  const migratedScan = {
    ...scan,
    uri: migratedPages[0] || scan.uri,
    pages: migratedPages,
    pageFiles,
  };

  changed =
    changed ||
    migratedScan.uri !== scan.uri ||
    !arraysEqual(scan.pages || [scan.uri], migratedPages) ||
    !arraysEqual(scan.pageFiles || [], pageFiles);

  return { scan: migratedScan, changed };
};

const normalizeSavedScans = async (scans: SavedScan[]) => {
  let changed = false;
  const normalizedScans = await Promise.all(
    scans.map(async (scan) => {
      const normalized = await normalizeSavedScan(scan);
      changed = changed || normalized.changed;
      return normalized.scan;
    }),
  );

  return { scans: normalizedScans, changed };
};

const normalizeSavedFileUris = async (
  uris: string[],
  fallbackPrefix: string,
) => {
  let changed = false;
  const normalizedUris = await Promise.all(
    uris.map(async (uri, index) => {
      const normalized = await normalizeFileToDocuments(
        uri,
        `${fallbackPrefix}_${index}.png`,
      );
      changed = changed || normalized.changed;
      return normalized.uri;
    }),
  );

  return { uris: normalizedUris, changed };
};

const alignPageTexts = (texts: string[] | undefined, pageCount: number) =>
  Array.from({ length: pageCount }, (_, index) => texts?.[index] || "");

const parseTags = (rawTags: string) =>
  rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const tagsToInputValue = (tags: string[] | undefined) =>
  tags?.join(", ") || "";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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
  const [language, setLanguage] = useState<LanguageCode>("tr");
  const [isLanguageReady, setIsLanguageReady] = useState(false);
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);
  const [needsInitialLanguage, setNeedsInitialLanguage] = useState(false);
  const [scannedImagesList, setScannedImagesList] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [selectedScanMode, setSelectedScanMode] =
    useState<ScanMode>("document");
  const [documentScanMode, setDocumentScanMode] =
    useState<ScanMode>("document");
  const [documentName, setDocumentName] = useState("Yeni_Belge");
  const [documentTags, setDocumentTags] = useState("");
  const [documentWatermark, setDocumentWatermark] = useState("");
  const [ocrLanguage, setOcrLanguage] = useState("tur+eng");
  const [isFavorite, setIsFavorite] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(
    null,
  );
  const [isProcessingSignature, setIsProcessingSignature] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [rawSignatureBase64, setRawSignatureBase64] = useState<string | null>(
    null,
  );
  const [imageFilterJob, setImageFilterJob] = useState<ImageFilterJob | null>(
    null,
  );
  const [ocrJob, setOcrJob] = useState<OcrJob | null>(null);
  const [pendingImports, setPendingImports] = useState<ImportJob[]>([]);
  const [activeImport, setActiveImport] = useState<ImportJob | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const tempImportedPages = useRef<string[]>([]);
  const [savedScans, setSavedScans] = useState<SavedScan[]>([]);
  const [savedSignatures, setSavedSignatures] = useState<string[]>([]);
  const [isSignModalVisible, setSignModalVisible] = useState(false);
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  const [isOcrModalVisible, setOcrModalVisible] = useState(false);
  const [isPageAddModalVisible, setPageAddModalVisible] = useState(false);
  const [isPageAddBusy, setIsPageAddBusy] = useState(false);
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [placedSignatures, setPlacedSignatures] = useState<PlacedSignature[]>(
    [],
  );
  const [activeSignId, setActiveSignId] = useState<string | null>(null);
  const viewShotRef = useRef<ViewShot>(null);

  const [adsModule, setAdsModule] = useState<GoogleMobileAdsModule | null>(
    null,
  );
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const interstitialRef = useRef<any>(null);
  const hasInitializedAdsRef = useRef(false);
  const processingImportIdRef = useRef<string | null>(null);
  const t = useCallback(
    (key: TranslationKey) => translations[language][key],
    [language],
  );
  const currentPageText = pageTexts[currentPage] || "";
  const isImageToolBusy = Boolean(imageFilterJob) || isOcrRunning || isCapturing;

  const clearEditorMetadata = () => {
    setPageTexts([]);
    setDocumentTags("");
    setDocumentWatermark("");
    setDocumentScanMode(selectedScanMode);
    setIsFavorite(false);
  };

  const getScanModeLabel = (mode: ScanMode | undefined) => {
    const option =
      scanModeOptions.find((item) => item.mode === mode) || scanModeOptions[0];
    return t(option.labelKey);
  };

  const updateCurrentPageText = (text: string) => {
    setPageTexts((currentTexts) => {
      const alignedTexts = alignPageTexts(
        currentTexts,
        scannedImagesList.length,
      );
      alignedTexts[currentPage] = text;
      return alignedTexts;
    });
  };

  const selectLanguage = async (nextLanguage: LanguageCode) => {
    setLanguage(nextLanguage);
    setNeedsInitialLanguage(false);
    setLanguageModalVisible(false);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (
      !isLanguageReady ||
      needsInitialLanguage ||
      hasInitializedAdsRef.current
    ) {
      return;
    }

    hasInitializedAdsRef.current = true;
    let isMounted = true;
    let unsubscribeLoaded: (() => void) | undefined;
    let unsubscribeClosed: (() => void) | undefined;

    const requestTrackingPermissionIfNeeded = async () => {
      if (Platform.OS !== "ios") return;

      try {
        const permission = await getTrackingPermissionsAsync();
        if (permission.status === "undetermined" && permission.canAskAgain) {
          await requestTrackingPermissionsAsync();
        }
      } catch (error) {
        console.warn("App Tracking Transparency request failed.", error);
      }
    };

    const initializeAds = async () => {
      try {
        await requestTrackingPermissionIfNeeded();
        const module = await import("react-native-google-mobile-ads");
        await module.default().initialize();
        if (!isMounted) return;

        const interstitialAdUnitId = __DEV__
          ? module.TestIds.INTERSTITIAL
          : Platform.select({
              ios: "ca-app-pub-7283360706215445/3294329127",
              android: "ca-app-pub-7283360706215445/6871446203",
            }) || "";
        const interstitial = module.InterstitialAd.createForAdRequest(
          interstitialAdUnitId,
          {
            requestNonPersonalizedAdsOnly: true,
          },
        );

        interstitialRef.current = interstitial;
        setAdsModule(module);
        unsubscribeLoaded = interstitial.addAdEventListener(
          module.AdEventType.LOADED,
          () => setIsAdLoaded(true),
        );
        unsubscribeClosed = interstitial.addAdEventListener(
          module.AdEventType.CLOSED,
          () => {
            setIsAdLoaded(false);
            interstitial.load();
          },
        );
        interstitial.load();
      } catch (error) {
        hasInitializedAdsRef.current = false;
        console.warn("Google Mobile Ads native module is unavailable.", error);
      }
    };

    void initializeAds();
    return () => {
      isMounted = false;
      unsubscribeLoaded?.();
      unsubscribeClosed?.();
    };
  }, [isLanguageReady, needsInitialLanguage]);

  const loadData = async () => {
    try {
      const [storedScans, storedSigs, storedLanguage] = await Promise.all([
        AsyncStorage.getItem(SCANS_STORAGE_KEY),
        AsyncStorage.getItem(SIGNATURES_STORAGE_KEY),
        AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
      ]);
      if (storedScans) {
        const parsedScans = JSON.parse(storedScans) as SavedScan[];
        const normalized = await normalizeSavedScans(parsedScans);
        setSavedScans(normalized.scans);
        if (normalized.changed) {
          await AsyncStorage.setItem(
            SCANS_STORAGE_KEY,
            JSON.stringify(normalized.scans),
          );
        }
      }
      if (storedSigs) {
        const parsedSignatures = JSON.parse(storedSigs) as string[];
        const normalized = await normalizeSavedFileUris(
          parsedSignatures,
          "sign",
        );
        setSavedSignatures(normalized.uris);
        if (normalized.changed) {
          await AsyncStorage.setItem(
            SIGNATURES_STORAGE_KEY,
            JSON.stringify(normalized.uris),
          );
        }
      }
      if (isLanguageCode(storedLanguage)) {
        setLanguage(storedLanguage);
      } else {
        setNeedsInitialLanguage(true);
        setLanguageModalVisible(true);
      }
    } catch (e) {
      console.error("Veriler yüklenemedi", e);
      setNeedsInitialLanguage(true);
      setLanguageModalVisible(true);
    } finally {
      setIsLanguageReady(true);
    }
  };

  const showInterstitialAd = () => {
    if (!isAdLoaded || !interstitialRef.current) return;

    setIsAdLoaded(false);
    setTimeout(() => {
      try {
        interstitialRef.current?.show();
      } catch (error) {
        console.warn("Interstitial ad could not be shown.", error);
        interstitialRef.current?.load?.();
      }
    }, 350);
  };

  const bannerAdUnitId = adsModule
    ? __DEV__
      ? adsModule.TestIds.BANNER
      : Platform.select({
          ios: "ca-app-pub-7283360706215445/4245282864",
          android: "ca-app-pub-7283360706215445/9970751836",
        }) || ""
    : "";
  const BannerAdComponent = adsModule?.BannerAd;
  const bannerAdSize = adsModule?.BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

  const getDocumentScanner = async () => {
    try {
      const module = await import("react-native-document-scanner-plugin");
      return module.default as DocumentScannerModule;
    } catch (error) {
      console.warn("DocumentScanner native module is unavailable.", error);
      return null;
    }
  };

  const showScannerUnavailableAlert = () => {
    Alert.alert(
      t("scannerUnavailableTitle"),
      t("scannerUnavailableMessage"),
    );
  };

  const resetEditorState = useCallback(
    (defaultName?: string, id: string | null = null) => {
      setPlacedSignatures([]);
      setActiveSignId(null);
      setUndoStack([]);
      setDocumentName(
        defaultName ||
          `${t("defaultDocumentNamePrefix")}_${Date.now()
            .toString()
            .slice(-4)}`,
      );
      setEditingDocumentId(id);
    },
    [t],
  );

  const openSavedScan = (scan: SavedScan) => {
    const pages = scan.pages || [scan.uri];
    setScannedImagesList(pages);
    setPageTexts(alignPageTexts(scan.pageTexts, pages.length));
    setDocumentTags(tagsToInputValue(scan.tags));
    setDocumentWatermark(scan.watermarkText || "");
    setDocumentScanMode(scan.scanMode || "document");
    setIsFavorite(Boolean(scan.isFavorite));
    setCurrentPage(0);
    resetEditorState(scan.title, scan.id);
    setCurrentScreen("editor");
  };

  const deleteScan = (scan: SavedScan) => {
    Alert.alert(t("deleteDocumentTitle"), t("deleteDocumentMessage"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            const pagesToDelete = scan.pages?.length ? scan.pages : [scan.uri];
            await Promise.all(
              pagesToDelete.map((uri) =>
                FileSystem.deleteAsync(uri, { idempotent: true }),
              ),
            );
            const updated = savedScans.filter((item) => item.id !== scan.id);
            setSavedScans(updated);
            await AsyncStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const closeEditor = () => {
    Alert.alert(t("exitTitle"), t("exitMessage"), [
      { text: t("stay"), style: "cancel" },
      {
        text: t("exit"),
        style: "destructive",
        onPress: () => {
          setScannedImagesList([]);
          clearEditorMetadata();
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

  const bakeCurrentPageIfNeeded = useCallback(async () => {
    if (placedSignatures.length === 0 || !viewShotRef.current) {
      return [...scannedImagesList];
    }

    setIsCapturing(true);
    setActiveSignId(null);
    await pause(100);

    try {
      const bakedUri = await captureRef(viewShotRef, {
        format: "jpg",
        quality: 1.0,
      });
      const updatedList = [...scannedImagesList];
      updatedList[currentPage] = bakedUri;
      setScannedImagesList(updatedList);
      setPlacedSignatures([]);
      return updatedList;
    } finally {
      setIsCapturing(false);
    }
  }, [currentPage, placedSignatures.length, scannedImagesList]);

  const rememberUndoState = useCallback(
    (
      pages: string[],
      pageIndex: number,
      label: string,
      texts: string[] = pageTexts,
    ) => {
      setUndoStack((history) => [
        ...history.slice(-19),
        {
          pages: [...pages],
          pageTexts: alignPageTexts(texts, pages.length),
          currentPage: pageIndex,
          label,
        },
      ]);
    },
    [pageTexts],
  );

  const undoLastEditorAction = async () => {
    if (undoStack.length === 0) return;

    try {
      await bakeCurrentPageIfNeeded();
      const previousState = undoStack[undoStack.length - 1];
      setScannedImagesList(previousState.pages);
      setPageTexts(alignPageTexts(previousState.pageTexts, previousState.pages.length));
      setCurrentPage(
        Math.min(previousState.currentPage, previousState.pages.length - 1),
      );
      setPlacedSignatures([]);
      setActiveSignId(null);
      setUndoStack((history) => history.slice(0, -1));
    } catch (e) {
      console.error(e);
    }
  };

  const applyPagesToWorkspace = useCallback(
    async (pages: string[], append: boolean, defaultName?: string) => {
      if (append && scannedImagesList.length > 0) {
        const committedPages = await bakeCurrentPageIfNeeded();
        const committedTexts = alignPageTexts(pageTexts, committedPages.length);
        rememberUndoState(
          committedPages,
          currentPage,
          t("pagesAdded"),
          committedTexts,
        );
        setScannedImagesList([...committedPages, ...pages]);
        setPageTexts([
          ...committedTexts,
          ...Array.from({ length: pages.length }, () => ""),
        ]);
        setCurrentPage(committedPages.length);
        setCurrentScreen("editor");
        return;
      }

      setScannedImagesList(pages);
      setPageTexts(Array.from({ length: pages.length }, () => ""));
      setDocumentTags("");
      setDocumentWatermark("");
      setDocumentScanMode(selectedScanMode);
      setIsFavorite(false);
      setCurrentPage(0);
      resetEditorState(defaultName, null);
      setCurrentScreen("editor");
    },
    [
      bakeCurrentPageIfNeeded,
      currentPage,
      rememberUndoState,
      pageTexts,
      resetEditorState,
      scannedImagesList.length,
      selectedScanMode,
      t,
    ],
  );

  const completeImport = useCallback(async (job: ImportJob, pages: string[]) => {
    try {
      await applyPagesToWorkspace(
        pages,
        job.append,
        job.append ? undefined : stripFileExtension(job.name),
      );
    } catch (error) {
      console.error(error);
      Alert.alert(t("importErrorTitle"), t("importErrorMessage"));
    } finally {
      setActiveImport(null);
      if (processingImportIdRef.current === job.id) {
        processingImportIdRef.current = null;
      }
    }
  }, [applyPagesToWorkspace, t]);

  useEffect(() => {
    if (!activeImport && pendingImports.length > 0) {
      const [nextImport, ...remainingImports] = pendingImports;
      tempImportedPages.current = [];
      setPendingImports(remainingImports);
      setActiveImport(nextImport);
    } else if (!activeImport && pendingImports.length === 0) {
      setIsLoadingDocument(false);
    }
  }, [activeImport, pendingImports]);

  useEffect(() => {
    if (activeImport?.kind === "image" && activeImport.uri) {
      if (processingImportIdRef.current === activeImport.id) return;
      processingImportIdRef.current = activeImport.id;
      void completeImport(activeImport, [activeImport.uri]);
    }
  }, [activeImport, completeImport]);

  if (!isLanguageReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    );
  }

  const runPageAddAction = (action: () => Promise<void>) => {
    if (isPageAddBusy) return;

    setIsPageAddBusy(true);
    setPageAddModalVisible(false);
    InteractionManager.runAfterInteractions(() => {
      setTimeout(async () => {
        try {
          await action();
        } finally {
          setIsPageAddBusy(false);
        }
      }, 250);
    });
  };

  const openPageAddOptions = () => {
    if (isPageAddBusy) return;

    setPageAddModalVisible(true);
  };

  const queueDocumentImports = async (append: boolean) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "image/*",
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const jobs = await Promise.all(
          result.assets.map(async (asset, index) => {
            const lowerName = asset.name.toLowerCase();
            const shouldAppend = append || index > 0;
            const isImage = asset.mimeType?.startsWith("image/");
            const isPdf =
              asset.mimeType === "application/pdf" ||
              lowerName.endsWith(".pdf");
            const isDocx =
              asset.mimeType ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
              lowerName.endsWith(".docx");

            if (isImage) {
              return {
                id: `${Date.now()}_${index}`,
                kind: "image" as const,
                append: shouldAppend,
                name: asset.name,
                uri: asset.uri,
              };
            }

            if (isPdf || isDocx) {
              const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: "base64",
              });
              return {
                id: `${Date.now()}_${index}`,
                kind: isPdf ? ("pdf" as const) : ("docx" as const),
                append: shouldAppend,
                name: asset.name,
                base64,
              };
            }

            return null;
          }),
        );

        const validJobs = jobs.filter(Boolean) as ImportJob[];
        if (validJobs.length === 0) {
          Alert.alert(
            t("unsupportedFileTitle"),
            t("unsupportedFileMessage"),
          );
          return;
        }

        if (validJobs.length !== jobs.length) {
          Alert.alert(
            t("someFilesSkippedTitle"),
            t("someFilesSkippedMessage"),
          );
        }

        setIsLoadingDocument(true);
        setPendingImports((current) => [...current, ...validJobs]);
        showInterstitialAd();
      }
    } catch (err) {
      setIsLoadingDocument(false);
      console.error(err);
    }
  };

  const importFromGallery = async (append = false) => {
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
        await applyPagesToWorkspace(
          result.assets.map((a) => a.uri),
          append,
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const scanDocument = async (append = false) => {
    try {
      const scanner = await getDocumentScanner();
      if (!scanner) {
        showScannerUnavailableAlert();
        return;
      }

      const { scannedImages, status } = await scanner.scanDocument({
        croppedImageQuality: 100,
      });
      if (status === "success" && scannedImages) {
        await applyPagesToWorkspace(scannedImages, append);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const scanWetSignature = async () => {
    try {
      const scanner = await getDocumentScanner();
      if (!scanner) {
        showScannerUnavailableAlert();
        return;
      }

      setIsProcessingSignature(true);
      Alert.alert(t("tipTitle"), t("tipMessage"));
      setTimeout(async () => {
        const { scannedImages, status } = await scanner.scanDocument({
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

  const changePage = async (newIndex: number) => {
    if (newIndex < 0 || newIndex >= scannedImagesList.length) return;
    try {
      await bakeCurrentPageIfNeeded();
      setCurrentPage(newIndex);
    } catch (e) {
      console.error(e);
    }
  };

  const moveCurrentPage = async (direction: -1 | 1) => {
    const targetIndex = currentPage + direction;
    if (targetIndex < 0 || targetIndex >= scannedImagesList.length) return;

    try {
      const committedPages = await bakeCurrentPageIfNeeded();
      const committedTexts = alignPageTexts(pageTexts, committedPages.length);
      rememberUndoState(
        committedPages,
        currentPage,
        t("pageMoved"),
        committedTexts,
      );
      const updatedPages = [...committedPages];
      [updatedPages[currentPage], updatedPages[targetIndex]] = [
        updatedPages[targetIndex],
        updatedPages[currentPage],
      ];
      const updatedTexts = [...committedTexts];
      [updatedTexts[currentPage], updatedTexts[targetIndex]] = [
        updatedTexts[targetIndex],
        updatedTexts[currentPage],
      ];
      setScannedImagesList(updatedPages);
      setPageTexts(updatedTexts);
      setCurrentPage(targetIndex);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteCurrentPage = async () => {
    if (scannedImagesList.length <= 1) {
      Alert.alert(t("lastPageTitle"), t("lastPageMessage"));
      return;
    }

    Alert.alert(t("deletePageTitle"), t("deletePageMessage"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            const committedPages = await bakeCurrentPageIfNeeded();
            const committedTexts = alignPageTexts(
              pageTexts,
              committedPages.length,
            );
            rememberUndoState(
              committedPages,
              currentPage,
              t("pageDeleted"),
              committedTexts,
            );
            const updatedPages = committedPages.filter(
              (_, index) => index !== currentPage,
            );
            const updatedTexts = committedTexts.filter(
              (_, index) => index !== currentPage,
            );
            setScannedImagesList(updatedPages);
            setPageTexts(updatedTexts);
            setCurrentPage(Math.min(currentPage, updatedPages.length - 1));
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const toggleFavoriteScan = async (scanId: string) => {
    const updated = savedScans.map((scan) =>
      scan.id === scanId
        ? { ...scan, isFavorite: !scan.isFavorite }
        : scan,
    );
    setSavedScans(updated);
    await AsyncStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(updated));
  };

  const getFilterLabel = (mode: ImageFilterMode) => {
    if (mode === "gray") return t("filterGray");
    if (mode === "blackWhite") return t("filterBlackWhite");
    return t("filterEnhanced");
  };

  const rotateCurrentPage = async () => {
    if (isImageToolBusy) return;

    try {
      const committedPages = await bakeCurrentPageIfNeeded();
      const committedTexts = alignPageTexts(pageTexts, committedPages.length);
      rememberUndoState(
        committedPages,
        currentPage,
        t("rotatePage"),
        committedTexts,
      );
      const rotated = await ImageManipulator.manipulateAsync(
        committedPages[currentPage],
        [{ rotate: 90 }],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG },
      );
      const updatedPages = [...committedPages];
      updatedPages[currentPage] = rotated.uri;
      setScannedImagesList(updatedPages);
      setPageTexts(committedTexts);
    } catch (error) {
      console.error(error);
      Alert.alert(
        t("imageProcessingErrorTitle"),
        t("imageProcessingErrorMessage"),
      );
    }
  };

  const applyFilterToCurrentPage = async (mode: ImageFilterMode) => {
    if (isImageToolBusy) return;

    try {
      const committedPages = await bakeCurrentPageIfNeeded();
      const committedTexts = alignPageTexts(pageTexts, committedPages.length);
      rememberUndoState(
        committedPages,
        currentPage,
        getFilterLabel(mode),
        committedTexts,
      );
      setScannedImagesList(committedPages);
      setPageTexts(committedTexts);
      const base64 = await FileSystem.readAsStringAsync(
        committedPages[currentPage],
        { encoding: "base64" },
      );
      setImageFilterJob({
        id: `${Date.now()}_${mode}`,
        mode,
        pageIndex: currentPage,
        base64,
      });
    } catch (error) {
      console.error(error);
      Alert.alert(
        t("imageProcessingErrorTitle"),
        t("imageProcessingErrorMessage"),
      );
    }
  };

  const runOcrForCurrentPage = async () => {
    if (isImageToolBusy) return;

    try {
      const committedPages = await bakeCurrentPageIfNeeded();
      setScannedImagesList(committedPages);
      const base64 = await FileSystem.readAsStringAsync(
        committedPages[currentPage],
        { encoding: "base64" },
      );
      setOcrModalVisible(true);
      setIsOcrRunning(true);
      setOcrJob({
        id: `${Date.now()}_ocr`,
        pageIndex: currentPage,
        base64,
      });
    } catch (error) {
      setIsOcrRunning(false);
      console.error(error);
      Alert.alert(t("ocrErrorTitle"), t("ocrErrorMessage"));
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
      await AsyncStorage.setItem(SIGNATURES_STORAGE_KEY, JSON.stringify(newSigs));
      addSignatureToDocument(fileUri);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSignatureFromStorage = (uriToDelete: string) => {
    Alert.alert(t("deleteSignatureTitle"), t("deleteSignatureMessage"), [
      { text: t("cancel") },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          const updated = savedSignatures.filter((uri) => uri !== uriToDelete);
          setSavedSignatures(updated);
          await AsyncStorage.setItem(
            SIGNATURES_STORAGE_KEY,
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
    if (isCapturing) return;
    setShareModalVisible(true);
  };

  const runShareAction = (format: ShareFormat) => {
    setShareModalVisible(false);
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        void processShare(format);
      }, 200);
    });
  };

  const compressPagesForExport = async (pages: string[]) =>
    Promise.all(
      pages.map(async (uri) => {
        const compressed = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1240 } }],
          { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG },
        );
        return compressed.uri;
      }),
    );

  const buildPagesHtml = async (
    pages: string[],
    options?: { watermark?: string; texts?: string[] },
  ) => {
    const watermark = options?.watermark?.trim() || "";
    const watermarkHtml = escapeHtml(watermark);
    const alignedTexts = alignPageTexts(options?.texts, pages.length);
    let html = `<html><body style="margin:0; background:#fff;">`;
    for (let index = 0; index < pages.length; index += 1) {
      const uri = pages[index];
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });
      html += `<div style="position:relative;width:100vw;height:100vh;page-break-after:always;background:#fff;overflow:hidden;">
        <img src="data:image/jpeg;base64,${b64}" style="width:100%;height:100%;object-fit:contain;"/>
        ${
          watermark
            ? `<div style="position:absolute;left:0;right:0;top:46%;text-align:center;font-size:46px;font-weight:800;color:rgba(15,23,42,0.16);transform:rotate(-24deg);letter-spacing:2px;">${watermarkHtml}</div>`
            : ""
        }
        <div style="position:absolute;left:0;top:0;opacity:0.01;font-size:1px;color:#fff;">${escapeHtml(alignedTexts[index])}</div>
      </div>`;
    }
    return html + `</body></html>`;
  };

  const processShare = async (format: ShareFormat) => {
    setIsCapturing(true);
    setActiveSignId(null);
    setTimeout(async () => {
      try {
        const finalPages = await bakeCurrentPageIfNeeded();
        let tempUri = finalPages[currentPage];
        const safeName = documentName.replace(/[^a-zA-Z0-9]/g, "_");
        const isCompressedPdf = format === "pdfCompressed";
        const extension =
          format === "word" ? "doc" : isCompressedPdf ? "pdf" : format;
        const exportPages = isCompressedPdf
          ? await compressPagesForExport(finalPages)
          : finalPages;
        const htmlOptions = {
          watermark: documentWatermark,
          texts: pageTexts,
        };

        if (format === "print") {
          const html = await buildPagesHtml(exportPages, htmlOptions);
          setIsCapturing(false);
          await Print.printAsync({ html });
          return;
        }

        if (format === "pdf" || format === "pdfCompressed") {
          const html = await buildPagesHtml(exportPages, htmlOptions);
          const { uri } = await Print.printToFileAsync({
            html,
          });
          tempUri = uri;
        } else if (format === "word") {
          const html = await buildPagesHtml(exportPages, htmlOptions);
          tempUri = FileSystem.cacheDirectory + `${safeName}.doc`;
          await FileSystem.writeAsStringAsync(tempUri, html, {
            encoding: "utf8",
          });
        }
        const customUri = FileSystem.cacheDirectory + `${safeName}.${extension}`;
        if (tempUri !== customUri) {
          await FileSystem.copyAsync({ from: tempUri, to: customUri });
        }
        setIsCapturing(false);
        await Sharing.shareAsync(customUri);
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
        const finalPages = await bakeCurrentPageIfNeeded();
        const savedAt = Date.now();
        const permanentPages = await Promise.all(
          finalPages.map(async (uri, index) => {
            const fileName = `iTech_${savedAt}_${index}.jpg`;
            const permUri = documentFileUri(fileName);
            if (!permUri) {
              return {
                uri,
                fileName: getFileNameFromUri(uri, fileName),
              };
            }
            await FileSystem.copyAsync({ from: uri, to: permUri });
            return { uri: permUri, fileName };
          }),
        );
        const permanentUris = permanentPages.map((page) => page.uri);
        const pageFiles = permanentPages.map((page) => page.fileName);
        const finalPageTexts = alignPageTexts(pageTexts, permanentUris.length);
        const finalTags = parseTags(documentTags);
        const finalWatermark = documentWatermark.trim();
        let updated = [...savedScans];
        if (editingDocumentId) {
          const idx = updated.findIndex((s) => s.id === editingDocumentId);
          if (idx > -1)
            updated[idx] = {
              ...updated[idx],
              title: documentName,
              uri: permanentUris[0],
              pages: permanentUris,
              pageFiles,
              pageTexts: finalPageTexts,
              tags: finalTags,
              isFavorite,
              scanMode: documentScanMode,
              watermarkText: finalWatermark,
            };
        } else {
          updated = [
            {
              id: savedAt.toString(),
              title: documentName,
              date: new Date().toLocaleDateString(
                language === "tr" ? "tr-TR" : "en-US",
              ),
              uri: permanentUris[0],
              pages: permanentUris,
              pageFiles,
              pageTexts: finalPageTexts,
              tags: finalTags,
              isFavorite,
              scanMode: documentScanMode,
              watermarkText: finalWatermark,
            },
            ...updated,
          ];
        }
        await AsyncStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(updated));
        setSavedScans(updated);
        setScannedImagesList([]);
        clearEditorMetadata();
        resetEditorState();
        setCurrentScreen("dashboard");
        setIsCapturing(false);
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
          {t("navHome")}
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
          {t("navFiles")}
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
            Cam<Text style={styles.appNameBold}>Scanner</Text>
          </Text>
          <Text style={styles.appSubtitle}>{t("appSubtitle")}</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel={t("changeLanguage")}
          accessibilityRole="button"
          style={styles.profileBtn}
          onPress={() => setLanguageModalVisible(true)}
        >
          <Ionicons name="globe-outline" size={32} color="#6366f1" />
        </TouchableOpacity>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        <View style={styles.captureModeSection}>
          <Text style={styles.captureModeTitle}>{t("captureModes")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {scanModeOptions.map((option) => {
              const isSelected = selectedScanMode === option.mode;
              return (
                <TouchableOpacity
                  key={option.mode}
                  style={[
                    styles.captureModeChip,
                    isSelected && styles.captureModeChipActive,
                  ]}
                  onPress={() => setSelectedScanMode(option.mode)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={18}
                    color={isSelected ? "#fff" : "#94a3b8"}
                  />
                  <Text
                    style={[
                      styles.captureModeText,
                      isSelected && styles.captureModeTextActive,
                    ]}
                  >
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        <TouchableOpacity
          style={styles.heroCard}
          onPress={() => scanDocument(false)}
          activeOpacity={0.8}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIconWrapper}>
              <Ionicons name="scan" size={32} color="#fff" />
            </View>
            <View>
              <Text style={styles.heroTitle}>{t("heroTitle")}</Text>
              <Text style={styles.heroSubtitle}>
                {t("heroSubtitle")} - {getScanModeLabel(selectedScanMode)}
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
          <Text style={styles.sectionTitle}>{t("smartTools")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.toolsScroll}
          >
            <TouchableOpacity
              style={styles.toolChip}
              onPress={() => queueDocumentImports(false)}
            >
              <View
                style={[styles.chipIconBox, { backgroundColor: "#ef444420" }]}
              >
                <Ionicons name="document-text" size={22} color="#ef4444" />
              </View>
              <Text style={styles.chipLabel}>{t("uploadDocument")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolChip}
              onPress={() => importFromGallery(false)}
            >
              <View
                style={[styles.chipIconBox, { backgroundColor: "#10b98120" }]}
              >
                <Ionicons name="image" size={22} color="#10b981" />
              </View>
              <Text style={styles.chipLabel}>{t("importImage")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        <View style={styles.sectionContainer}>
          <View style={styles.recentsHeader}>
            <Text style={styles.sectionTitle}>{t("recentScans")}</Text>
            {savedScans.length > 0 && (
              <TouchableOpacity onPress={() => setCurrentScreen("files")}>
                <Text style={styles.seeAllText}>
                  {t("all")} ({savedScans.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {savedScans.length === 0 ? (
            <View style={styles.emptyScansContainer}>
              <Ionicons name="documents-outline" size={40} color="#334155" />
              <Text style={styles.emptyScansText}>
                {t("noScansYet")}
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
                  onPress={() => deleteScan(item)}
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
      {BannerAdComponent && bannerAdSize && bannerAdUnitId ? (
        <View style={styles.adContainer}>
          <BannerAdComponent
            unitId={bannerAdUnitId}
            size={bannerAdSize}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>
      ) : null}
      {renderBottomNav()}
    </View>
  );

  const renderFilesScreen = () => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = savedScans
      .filter((scan) => {
        if (!query) return true;

        const searchable = [
          scan.title,
          scan.date,
          getScanModeLabel(scan.scanMode),
          scan.watermarkText || "",
          ...(scan.tags || []),
          ...(scan.pageTexts || []),
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      })
      .sort((left, right) => Number(right.isFavorite) - Number(left.isFavorite));

    return (
      <View style={styles.dashboardContainer}>
        <View style={styles.filesHeader}>
          <Text style={styles.filesTitle}>{t("filesTitle")}</Text>
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
            placeholder={t("searchPlaceholder")}
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
              <Text style={styles.emptyScansText}>
                {t("noDocumentsFound")}
              </Text>
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
                    <View style={styles.scanMetaRow}>
                      <Text style={styles.gridDate}>{item.date}</Text>
                      {item.pageTexts?.some(Boolean) && (
                        <View style={styles.ocrBadge}>
                          <Text style={styles.ocrBadgeText}>OCR</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.scanMetaRow}>
                      <Text style={styles.gridDate} numberOfLines={1}>
                        {[getScanModeLabel(item.scanMode), ...(item.tags || [])]
                          .slice(0, 2)
                          .join(", ")}
                      </Text>
                      <TouchableOpacity
                        style={styles.favoriteCardBtn}
                        onPress={() => toggleFavoriteScan(item.id)}
                      >
                        <Ionicons
                          name={item.isFavorite ? "star" : "star-outline"}
                          size={18}
                          color={item.isFavorite ? "#facc15" : "#64748b"}
                        />
                      </TouchableOpacity>
                    </View>
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
                      <View style={styles.scanMetaRow}>
                        <Text style={styles.recentDocDate}>{item.date}</Text>
                        {item.pageTexts?.some(Boolean) && (
                          <View style={styles.ocrBadge}>
                            <Text style={styles.ocrBadgeText}>OCR</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.scanTagsText} numberOfLines={1}>
                        {[
                          getScanModeLabel(item.scanMode),
                          ...(item.tags || []),
                        ].join(", ")}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.moreBtn}
                      onPress={() => toggleFavoriteScan(item.id)}
                    >
                      <Ionicons
                        name={item.isFavorite ? "star" : "star-outline"}
                        size={23}
                        color={item.isFavorite ? "#facc15" : "#64748b"}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.moreBtn}
                      onPress={() => deleteScan(item)}
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
          <Text style={styles.saveHeaderText}>{t("done")}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.metadataBar}>
        <TouchableOpacity
          style={[
            styles.favoriteMetaButton,
            isFavorite && styles.favoriteMetaButtonActive,
          ]}
          onPress={() => setIsFavorite((value) => !value)}
        >
          <Ionicons
            name={isFavorite ? "star" : "star-outline"}
            size={20}
            color={isFavorite ? "#facc15" : "#94a3b8"}
          />
        </TouchableOpacity>
        <TextInput
          style={styles.tagsInput}
          placeholder={t("tagsPlaceholder")}
          placeholderTextColor="#64748b"
          value={documentTags}
          onChangeText={setDocumentTags}
        />
      </View>
      <View style={styles.editorMetaSecondary}>
        <View style={styles.scanModePill}>
          <Ionicons name="scan-outline" size={16} color="#a5b4fc" />
          <Text style={styles.scanModePillText}>
            {getScanModeLabel(documentScanMode)}
          </Text>
        </View>
        <TextInput
          style={styles.watermarkInput}
          placeholder={t("watermarkPlaceholder")}
          placeholderTextColor="#64748b"
          value={documentWatermark}
          onChangeText={setDocumentWatermark}
        />
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
            {t("page")} {currentPage + 1} / {scannedImagesList.length}
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
      <View style={styles.pageToolsContainer}>
        <TouchableOpacity
          style={[
            styles.pageToolButton,
            isPageAddBusy && styles.pageToolButtonDisabled,
          ]}
          disabled={isPageAddBusy}
          onPress={openPageAddOptions}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.pageToolText}>{t("addPage")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pageToolButton,
            currentPage === 0 && styles.pageToolButtonDisabled,
          ]}
          onPress={() => moveCurrentPage(-1)}
          disabled={currentPage === 0}
        >
          <Ionicons name="arrow-back-outline" size={18} color="#fff" />
          <Text style={styles.pageToolText}>{t("moveLeft")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pageToolButton,
            currentPage === scannedImagesList.length - 1 &&
              styles.pageToolButtonDisabled,
          ]}
          onPress={() => moveCurrentPage(1)}
          disabled={currentPage === scannedImagesList.length - 1}
        >
          <Ionicons name="arrow-forward-outline" size={18} color="#fff" />
          <Text style={styles.pageToolText}>{t("moveRight")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pageToolButton, styles.pageToolDeleteButton]}
          onPress={deleteCurrentPage}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.pageToolText}>{t("delete")}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.imageToolsScroll}
        contentContainerStyle={styles.imageToolsContent}
      >
        <Text style={styles.imageToolsTitle}>{t("imageTools")}</Text>
        <TouchableOpacity
          style={[
            styles.imageToolChip,
            isImageToolBusy && styles.imageToolChipDisabled,
          ]}
          disabled={isImageToolBusy}
          onPress={rotateCurrentPage}
        >
          <Ionicons name="refresh-outline" size={18} color="#fff" />
          <Text style={styles.imageToolText}>{t("rotatePage")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.imageToolChip,
            isImageToolBusy && styles.imageToolChipDisabled,
          ]}
          disabled={isImageToolBusy}
          onPress={() => applyFilterToCurrentPage("gray")}
        >
          <Ionicons name="contrast-outline" size={18} color="#fff" />
          <Text style={styles.imageToolText}>{t("filterGray")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.imageToolChip,
            isImageToolBusy && styles.imageToolChipDisabled,
          ]}
          disabled={isImageToolBusy}
          onPress={() => applyFilterToCurrentPage("blackWhite")}
        >
          <Ionicons name="barcode-outline" size={18} color="#fff" />
          <Text style={styles.imageToolText}>{t("filterBlackWhite")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.imageToolChip,
            isImageToolBusy && styles.imageToolChipDisabled,
          ]}
          disabled={isImageToolBusy}
          onPress={() => applyFilterToCurrentPage("enhance")}
        >
          <Ionicons name="sparkles-outline" size={18} color="#fff" />
          <Text style={styles.imageToolText}>{t("filterEnhanced")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.imageToolChip,
            isImageToolBusy && styles.imageToolChipDisabled,
          ]}
          disabled={isImageToolBusy}
          onPress={() => setOcrModalVisible(true)}
        >
          <Ionicons name="text-outline" size={18} color="#fff" />
          <Text style={styles.imageToolText}>{t("ocrText")}</Text>
        </TouchableOpacity>
      </ScrollView>
      {undoStack.length > 0 && (
        <View style={styles.undoBar}>
          <Text style={styles.undoText}>
            {undoStack[undoStack.length - 1].label}
          </Text>
          <TouchableOpacity onPress={undoLastEditorAction}>
            <Text style={styles.undoAction}>{t("undo")}</Text>
          </TouchableOpacity>
        </View>
      )}
      {scannedImagesList.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pageThumbsScroll}
          contentContainerStyle={styles.pageThumbsContent}
        >
          {scannedImagesList.map((uri, index) => (
            <TouchableOpacity
              key={`${uri}_${index}`}
              style={[
                styles.pageThumbCard,
                currentPage === index && styles.pageThumbCardActive,
              ]}
              onPress={() => changePage(index)}
            >
              <Image source={{ uri }} style={styles.pageThumbImage} />
              <Text style={styles.pageThumbLabel}>{index + 1}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
                {documentWatermark.trim().length > 0 && !isCapturing && (
                  <Text style={styles.watermarkPreviewText}>
                    {documentWatermark.trim()}
                  </Text>
                )}
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
            <Text style={styles.toolbarTextMain}>{t("addSignature")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolbarBtnShare}
            onPress={shareDocument}
          >
            <Ionicons name="share-social" size={24} color="#fff" />
            <Text style={styles.toolbarTextShare}>{t("share")}</Text>
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
              <Text style={styles.modalTitle}>{t("chooseSignature")}</Text>
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
              <Text style={styles.emptySignText}>{t("noSignatures")}</Text>
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
                    {t("scanNewWetSignature")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isShareModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isCapturing) setShareModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("share")}</Text>
              <TouchableOpacity
                disabled={isCapturing}
                onPress={() => setShareModalVisible(false)}
              >
                <Ionicons name="close-circle" size={28} color="#475569" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.pageAddAction,
                isCapturing && styles.pageAddActionDisabled,
              ]}
              disabled={isCapturing}
              onPress={() => runShareAction("jpg")}
            >
              <Ionicons name="image-outline" size={22} color="#fff" />
              <Text style={styles.pageAddActionText}>{t("shareAsJpg")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pageAddAction,
                isCapturing && styles.pageAddActionDisabled,
              ]}
              disabled={isCapturing}
              onPress={() => runShareAction("pdf")}
            >
              <Ionicons name="document-text-outline" size={22} color="#fff" />
              <Text style={styles.pageAddActionText}>{t("shareAsPdf")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pageAddAction,
                isCapturing && styles.pageAddActionDisabled,
              ]}
              disabled={isCapturing}
              onPress={() => runShareAction("pdfCompressed")}
            >
              <Ionicons name="archive-outline" size={22} color="#fff" />
              <Text style={styles.pageAddActionText}>
                {t("shareAsCompressedPdf")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pageAddAction,
                isCapturing && styles.pageAddActionDisabled,
              ]}
              disabled={isCapturing}
              onPress={() => runShareAction("word")}
            >
              <Ionicons name="document-outline" size={22} color="#fff" />
              <Text style={styles.pageAddActionText}>{t("shareAsWord")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pageAddAction,
                isCapturing && styles.pageAddActionDisabled,
              ]}
              disabled={isCapturing}
              onPress={() => runShareAction("print")}
            >
              <Ionicons name="print-outline" size={22} color="#fff" />
              <Text style={styles.pageAddActionText}>{t("printDocument")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isOcrModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isOcrRunning) setOcrModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t("ocrText")}</Text>
                <Text style={styles.modalHint}>
                  {t("page")} {currentPage + 1} / {scannedImagesList.length}
                </Text>
              </View>
              <TouchableOpacity
                disabled={isOcrRunning}
                onPress={() => setOcrModalVisible(false)}
              >
                <Ionicons name="close-circle" size={28} color="#475569" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>{t("ocrHint")}</Text>
            <Text style={styles.modalSectionLabel}>{t("ocrLanguage")}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.ocrLanguageScroll}
              contentContainerStyle={styles.ocrLanguageContent}
            >
              {ocrLanguageOptions.map((option) => {
                const isSelected = ocrLanguage === option.code;
                return (
                  <TouchableOpacity
                    key={option.code}
                    style={[
                      styles.ocrLanguageChip,
                      isSelected && styles.ocrLanguageChipActive,
                    ]}
                    onPress={() => setOcrLanguage(option.code)}
                  >
                    <Text
                      style={[
                        styles.ocrLanguageText,
                        isSelected && styles.ocrLanguageTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              style={styles.ocrTextInput}
              multiline
              textAlignVertical="top"
              placeholder={t("ocrPlaceholder")}
              placeholderTextColor="#64748b"
              value={currentPageText}
              onChangeText={updateCurrentPageText}
            />
            <TouchableOpacity
              style={[
                styles.pageAddAction,
                isImageToolBusy && styles.pageAddActionDisabled,
              ]}
              disabled={isImageToolBusy}
              onPress={runOcrForCurrentPage}
            >
              {isOcrRunning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="scan-outline" size={22} color="#fff" />
              )}
              <Text style={styles.pageAddActionText}>{t("runOcr")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
        <Modal
          visible={isPageAddModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            if (!isPageAddBusy) setPageAddModalVisible(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t("addMergePage")}</Text>
              <TouchableOpacity
                disabled={isPageAddBusy}
                onPress={() => setPageAddModalVisible(false)}
              >
                <Ionicons name="close-circle" size={28} color="#475569" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.pageAddAction,
                isPageAddBusy && styles.pageAddActionDisabled,
              ]}
              disabled={isPageAddBusy}
              onPress={() => runPageAddAction(() => scanDocument(true))}
            >
              <Ionicons name="scan-outline" size={22} color="#fff" />
              <Text style={styles.pageAddActionText}>{t("addWithCamera")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pageAddAction,
                isPageAddBusy && styles.pageAddActionDisabled,
              ]}
              disabled={isPageAddBusy}
              onPress={() => runPageAddAction(() => importFromGallery(true))}
            >
              <Ionicons name="images-outline" size={22} color="#fff" />
              <Text style={styles.pageAddActionText}>
                {t("addFromGallery")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pageAddAction,
                isPageAddBusy && styles.pageAddActionDisabled,
              ]}
              disabled={isPageAddBusy}
              onPress={() => runPageAddAction(() => queueDocumentImports(true))}
            >
              <Ionicons name="documents-outline" size={22} color="#fff" />
              <Text style={styles.pageAddActionText}>{t("mergeFiles")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderLanguageModal = () => (
    <Modal
      visible={isLanguageModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        if (!needsInitialLanguage) setLanguageModalVisible(false);
      }}
    >
      <View style={styles.languageOverlay}>
        <View style={styles.languageCard}>
          <View style={styles.languageHeader}>
            <View style={styles.languageHeaderText}>
              <Text style={styles.languageTitle}>
                {needsInitialLanguage
                  ? t("languageTitle")
                  : t("languageSettingsTitle")}
              </Text>
              <Text style={styles.languageSubtitle}>
                {needsInitialLanguage
                  ? t("languageSubtitle")
                  : t("languageSettingsSubtitle")}
              </Text>
            </View>
            {!needsInitialLanguage && (
              <TouchableOpacity
                style={styles.languageCloseButton}
                onPress={() => setLanguageModalVisible(false)}
              >
                <Ionicons name="close" size={22} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>
          {languageOptions.map((option) => {
            const isSelected = language === option.code;
            return (
              <TouchableOpacity
                key={option.code}
                style={[
                  styles.languageOption,
                  isSelected && styles.languageOptionSelected,
                ]}
                activeOpacity={0.85}
                onPress={() => selectLanguage(option.code)}
              >
                <View style={styles.languageOptionText}>
                  <Text
                    style={[
                      styles.languageOptionTitle,
                      isSelected && styles.languageOptionTitleSelected,
                    ]}
                  >
                    {option.title}
                  </Text>
                  <Text style={styles.languageOptionSubtitle}>
                    {option.subtitle}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#818cf8" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
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
      {imageFilterJob && (
        <View style={styles.hiddenWebView}>
          <WebView
            originWhitelist={["*"]}
            onMessage={async (e) => {
              try {
                const parsed = JSON.parse(e.nativeEvent.data);
                if (parsed.type === "image_filter") {
                  const uri =
                    FileSystem.cacheDirectory +
                    `filter_${imageFilterJob.id}.jpg`;
                  await FileSystem.writeAsStringAsync(
                    uri,
                    parsed.base64.split(",")[1],
                    { encoding: "base64" },
                  );
                  setScannedImagesList((currentPages) => {
                    const updatedPages = [...currentPages];
                    updatedPages[parsed.pageIndex] = uri;
                    return updatedPages;
                  });
                } else if (parsed.type === "import_error") {
                  Alert.alert(
                    t("imageProcessingErrorTitle"),
                    parsed.message || t("imageProcessingErrorMessage"),
                  );
                }
              } catch (error) {
                console.error(error);
                Alert.alert(
                  t("imageProcessingErrorTitle"),
                  t("imageProcessingErrorMessage"),
                );
              } finally {
                setImageFilterJob(null);
              }
            }}
            source={{
              html: `<html><body style="margin:0;"><canvas id="c"></canvas><script>
                  function clamp(value) { return Math.max(0, Math.min(255, value)); }
                  var mode = '${imageFilterJob.mode}';
                  var img = new Image();
                  img.onload = function() {
                    var canvas = document.getElementById('c');
                    var ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    var data = imgData.data;
                    for (var i = 0; i < data.length; i += 4) {
                      var r = data[i], g = data[i + 1], b = data[i + 2];
                      var gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                      if (mode === 'gray') {
                        data[i] = gray;
                        data[i + 1] = gray;
                        data[i + 2] = gray;
                      } else if (mode === 'blackWhite') {
                        var bw = gray > 168 ? 255 : 0;
                        data[i] = bw;
                        data[i + 1] = bw;
                        data[i + 2] = bw;
                      } else {
                        var factor = 1.35;
                        data[i] = clamp((r - 128) * factor + 142);
                        data[i + 1] = clamp((g - 128) * factor + 142);
                        data[i + 2] = clamp((b - 128) * factor + 142);
                        if (gray > 218) {
                          data[i] = 255;
                          data[i + 1] = 255;
                          data[i + 2] = 255;
                        }
                      }
                    }
                    ctx.putImageData(imgData, 0, 0);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'image_filter',
                      pageIndex: ${imageFilterJob.pageIndex},
                      base64: canvas.toDataURL('image/jpeg', 0.92)
                    }));
                  };
                  img.onerror = function(error) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'import_error', message: String(error) }));
                  };
                  img.src = 'data:image/jpeg;base64,${imageFilterJob.base64}';
                </script></body></html>`,
            }}
          />
        </View>
      )}
      {ocrJob && (
        <View style={styles.hiddenWebView}>
          <WebView
            originWhitelist={["*"]}
            onMessage={(e) => {
              try {
                const parsed = JSON.parse(e.nativeEvent.data);
                if (parsed.type === "ocr_result") {
                  setPageTexts((currentTexts) => {
                    const updatedTexts = alignPageTexts(
                      currentTexts,
                      scannedImagesList.length,
                    );
                    updatedTexts[parsed.pageIndex] = parsed.text?.trim?.() || "";
                    return updatedTexts;
                  });
                } else if (parsed.type === "import_error") {
                  Alert.alert(
                    t("ocrErrorTitle"),
                    parsed.message || t("ocrErrorMessage"),
                  );
                }
              } catch (error) {
                console.error(error);
                Alert.alert(t("ocrErrorTitle"), t("ocrErrorMessage"));
              } finally {
                setIsOcrRunning(false);
                setOcrJob(null);
              }
            }}
            source={{
              html: `<html><body style="margin:0;"><script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script><script>
                  (async function() {
                    try {
                      var result = await Tesseract.recognize(
                        'data:image/jpeg;base64,${ocrJob.base64}',
                        '${ocrLanguage}'
                      );
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'ocr_result',
                        pageIndex: ${ocrJob.pageIndex},
                        text: result && result.data ? result.data.text : ''
                      }));
                    } catch (error) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'import_error', message: String(error) }));
                    }
                  })();
                </script></body></html>`,
            }}
          />
        </View>
      )}
      {activeImport?.kind === "pdf" && activeImport.base64 && (
        <View style={styles.hiddenWebView}>
          <WebView
            originWhitelist={["*"]}
            onMessage={async (e) => {
              const parsed = JSON.parse(e.nativeEvent.data);
              if (parsed.type === "pdf_page") {
                const uri =
                  FileSystem.cacheDirectory +
                  `pdf_${activeImport.id}_${parsed.pageIndex}.jpg`;
                await FileSystem.writeAsStringAsync(
                  uri,
                  parsed.base64.split(",")[1],
                  { encoding: "base64" },
                );
                tempImportedPages.current[parsed.pageIndex] = uri;
                if (
                  tempImportedPages.current.filter(Boolean).length ===
                  parsed.totalPages
                ) {
                  await completeImport(activeImport, [
                    ...tempImportedPages.current,
                  ]);
                }
              } else if (parsed.type === "import_error") {
                Alert.alert(
                  t("pdfErrorTitle"),
                  parsed.message || t("pdfErrorMessage"),
                );
                setActiveImport(null);
              }
            }}
            source={{
              html: `<html><head><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script></head><body><canvas id="c"></canvas><script>
                  var pdfjsLib = window['pdfjs-dist/build/pdf'];
                  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                  var raw = atob('${activeImport.base64}'); var uint8Array = new Uint8Array(raw.length);
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
                  }).catch(function(error) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'import_error', message: String(error) }));
                  });
                </script></body></html>`,
            }}
          />
        </View>
      )}
      {activeImport?.kind === "docx" && activeImport.base64 && (
        <View style={styles.hiddenWebView}>
          <WebView
            originWhitelist={["*"]}
            onMessage={async (e) => {
              const parsed = JSON.parse(e.nativeEvent.data);
              if (parsed.type === "docx_page") {
                const uri =
                  FileSystem.cacheDirectory +
                  `docx_${activeImport.id}_${parsed.pageIndex}.jpg`;
                await FileSystem.writeAsStringAsync(
                  uri,
                  parsed.base64.split(",")[1],
                  { encoding: "base64" },
                );
                tempImportedPages.current[parsed.pageIndex] = uri;
                if (
                  tempImportedPages.current.filter(Boolean).length ===
                  parsed.totalPages
                ) {
                  await completeImport(activeImport, [
                    ...tempImportedPages.current,
                  ]);
                }
              } else if (parsed.type === "import_error") {
                Alert.alert(
                  t("wordErrorTitle"),
                  parsed.message || t("wordErrorMessage"),
                );
                setActiveImport(null);
              }
            }}
            source={{
              html: `<html><head>
                  <script src="https://unpkg.com/jszip/dist/jszip.min.js"></script>
                  <script src="https://cdn.jsdelivr.net/npm/docx-preview@0.3.6/dist/docx-preview.min.js"></script>
                  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
                  <style>
                    body { margin: 0; background: #fff; }
                    #container { background: #fff; }
                    section.docx { margin: 0 auto 12px !important; box-shadow: none !important; }
                  </style>
                </head><body><div id="container"></div><script>
                  function base64ToBytes(base64) {
                    var raw = atob(base64);
                    var bytes = new Uint8Array(raw.length);
                    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                    return bytes;
                  }
                  var bytes = base64ToBytes('${activeImport.base64}');
                  function emitPage(canvas, pageIndex, totalPages) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'docx_page',
                      pageIndex: pageIndex,
                      totalPages: totalPages,
                      base64: canvas.toDataURL('image/jpeg', 0.9)
                    }));
                  }
                  function splitTallCanvas(canvas, targetPageHeight) {
                    var slices = [];
                    var totalSlices = Math.max(1, Math.ceil(canvas.height / targetPageHeight));
                    for (var i = 0; i < totalSlices; i++) {
                      var sliceCanvas = document.createElement('canvas');
                      sliceCanvas.width = canvas.width;
                      sliceCanvas.height = targetPageHeight;
                      var ctx = sliceCanvas.getContext('2d');
                      ctx.fillStyle = '#fff';
                      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                      ctx.drawImage(
                        canvas,
                        0,
                        i * targetPageHeight,
                        canvas.width,
                        Math.min(targetPageHeight, canvas.height - i * targetPageHeight),
                        0,
                        0,
                        canvas.width,
                        Math.min(targetPageHeight, canvas.height - i * targetPageHeight)
                      );
                      slices.push(sliceCanvas);
                    }
                    return slices;
                  }
                  docx.renderAsync(bytes, document.getElementById('container'), null, {
                    useBase64URL: true,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: false
                  }).then(async function() {
                    var renderedSections = Array.prototype.slice.call(document.querySelectorAll('section.docx'));
                    var pages = renderedSections.length ? renderedSections : [document.getElementById('container')];

                    if (pages.length > 1) {
                      for (var i = 0; i < pages.length; i++) {
                        var pageCanvas = await html2canvas(pages[i], {
                          backgroundColor: '#fff',
                          scale: 1.5,
                          useCORS: true
                        });
                        emitPage(pageCanvas, i, pages.length);
                      }
                      return;
                    }

                    var sourcePage = pages[0];
                    var fullCanvas = await html2canvas(sourcePage, {
                      backgroundColor: '#fff',
                      scale: 1.5,
                      useCORS: true
                    });
                    var targetPageHeight = Math.round(fullCanvas.width * 1.4142);
                    var pageCanvases =
                      fullCanvas.height > targetPageHeight * 1.1
                        ? splitTallCanvas(fullCanvas, targetPageHeight)
                        : [fullCanvas];
                    for (var j = 0; j < pageCanvases.length; j++) {
                      emitPage(pageCanvases[j], j, pageCanvases.length);
                    }
                  }).catch(function(error) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'import_error', message: String(error) }));
                  });
                </script></body></html>`,
            }}
          />
        </View>
      )}
      {(isLoadingDocument || imageFilterJob || isOcrRunning) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>
            {isOcrRunning
              ? t("runningOcr")
              : imageFilterJob
                ? t("processingImage")
                : t("resolvingDocument")}
          </Text>
        </View>
      )}
      {currentScreen === "dashboard" && renderDashboard()}
      {currentScreen === "files" && renderFilesScreen()}
      {currentScreen === "editor" && renderEditor()}
      {renderLanguageModal()}
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
  captureModeSection: {
    marginBottom: 16,
    paddingLeft: 20,
  },
  captureModeTitle: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  captureModeChip: {
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginRight: 8,
    gap: 6,
  },
  captureModeChipActive: {
    backgroundColor: "#6366f1",
    borderColor: "#818cf8",
  },
  captureModeText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  captureModeTextActive: { color: "#fff" },
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
  scanMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  scanTagsText: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 4,
  },
  ocrBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ocrBadgeText: {
    color: "#a5b4fc",
    fontSize: 10,
    fontWeight: "800",
  },
  favoriteCardBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
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
  metadataBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  favoriteMetaButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteMetaButtonActive: {
    borderColor: "#facc15",
    backgroundColor: "rgba(250, 204, 21, 0.12)",
  },
  tagsInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    color: "#f8fafc",
    paddingHorizontal: 12,
    fontSize: 13,
  },
  editorMetaSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  scanModePill: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "rgba(99, 102, 241, 0.16)",
    borderWidth: 1,
    borderColor: "#4338ca",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 6,
  },
  scanModePillText: {
    color: "#c7d2fe",
    fontSize: 12,
    fontWeight: "800",
  },
  watermarkInput: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    color: "#f8fafc",
    paddingHorizontal: 12,
    fontSize: 13,
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
  pageToolsContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#0f172a",
  },
  pageToolButton: {
    flex: 1,
    minHeight: 42,
    backgroundColor: "#334155",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },
  pageToolButtonDisabled: { opacity: 0.45 },
  pageToolDeleteButton: { backgroundColor: "#ef4444" },
  pageToolText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  imageToolsScroll: {
    maxHeight: 54,
    backgroundColor: "#0f172a",
  },
  imageToolsContent: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  imageToolsTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginRight: 2,
  },
  imageToolChip: {
    minHeight: 38,
    borderRadius: 19,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
  },
  imageToolChipDisabled: { opacity: 0.45 },
  imageToolText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  undoBar: {
    marginHorizontal: 12,
    marginBottom: 10,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  undoText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "500",
  },
  undoAction: {
    color: "#818cf8",
    fontSize: 13,
    fontWeight: "700",
  },
  pageThumbsScroll: {
    maxHeight: 92,
    backgroundColor: "#0f172a",
  },
  pageThumbsContent: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
  },
  pageThumbCard: {
    width: 58,
    height: 76,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 5,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
  },
  pageThumbCardActive: {
    borderColor: "#6366f1",
    backgroundColor: "#312e81",
  },
  pageThumbImage: {
    width: "100%",
    height: 52,
    borderRadius: 8,
    resizeMode: "cover",
    backgroundColor: "#fff",
  },
  pageThumbLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
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
  watermarkPreviewText: {
    position: "absolute",
    left: 20,
    right: 20,
    top: "45%",
    textAlign: "center",
    color: "rgba(15, 23, 42, 0.2)",
    fontSize: 34,
    fontWeight: "900",
    transform: [{ rotate: "-24deg" }],
    letterSpacing: 2,
  },
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
  modalHint: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  modalSectionLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  ocrLanguageScroll: {
    maxHeight: 44,
    marginBottom: 12,
  },
  ocrLanguageContent: {
    gap: 8,
    paddingRight: 20,
  },
  ocrLanguageChip: {
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  ocrLanguageChipActive: {
    backgroundColor: "#6366f1",
    borderColor: "#818cf8",
  },
  ocrLanguageText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  ocrLanguageTextActive: { color: "#fff" },
  ocrTextInput: {
    minHeight: 170,
    maxHeight: 260,
    borderRadius: 14,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    color: "#f8fafc",
    fontSize: 14,
    lineHeight: 20,
    padding: 14,
    marginBottom: 14,
  },
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
  pageAddAction: {
    backgroundColor: "#334155",
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  pageAddActionDisabled: { opacity: 0.5 },
  pageAddActionText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 12,
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
  languageOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    justifyContent: "center",
    padding: 20,
  },
  languageCard: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 20,
  },
  languageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  languageHeaderText: { flex: 1, paddingRight: 12 },
  languageTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  languageSubtitle: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
  },
  languageCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  languageOption: {
    minHeight: 70,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  languageOptionSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#312e81",
  },
  languageOptionText: { flex: 1 },
  languageOptionTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  languageOptionTitleSelected: { color: "#fff" },
  languageOptionSubtitle: {
    color: "#94a3b8",
    fontSize: 13,
  },
});
