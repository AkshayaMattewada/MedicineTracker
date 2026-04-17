import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Animated,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { registerBatch } from "../services/api";

// Gets the most precise location string possible
const getExactLocation = async (latitude, longitude) => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const r = results[0];
      // Build full address: street number + street, district, city, region, country
      const parts = [
        r.name,           // street number or place name
        r.street,         // street name
        r.district || r.subregion,
        r.city,
        r.region,
        r.country,
      ].filter(Boolean);
      return parts.join(", ");
    }
  } catch {}
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
};

const Field = ({ label, icon, value, onChange, placeholder, keyboardType, scrollRef }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>
        <Ionicons name={icon} size={13} color="#3B82F6" />{"  "}{label}
      </Text>
      <View style={[fieldStyles.inputWrap, focused && fieldStyles.inputFocused]}>
        <TextInput
          style={fieldStyles.input}
          placeholder={placeholder}
          placeholderTextColor="#334155"
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType || "default"}
          onFocus={() => {
            setFocused(true);
            // Scroll down so field is visible when keyboard opens
            setTimeout(() => scrollRef?.current?.scrollToEnd({ animated: true }), 300);
          }}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
};

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 8, letterSpacing: 0.3 },
  inputWrap: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  inputFocused: {
    borderColor: "rgba(59,130,246,0.5)",
    backgroundColor: "rgba(59,130,246,0.05)",
  },
  input: { padding: 15, color: "#F1F5F9", fontSize: 15 },
});

export default function ManufacturerScreen({ navigation }) {
  const [batchId, setBatchId] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mfgLocation, setMfgLocation] = useState(null);

  const scrollRef = useRef(null);
  const qrRef = useRef(null);
  const qrAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const toUnix = (dateStr) => {
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (isNaN(date.getTime())) return null;
    return Math.floor(date.getTime() / 1000);
  };

  const handleRegister = async () => {
    if (!batchId || !medicineName || !manufacturer || !manufactureDate || !expiryDate) {
      Alert.alert("Validation", "All fields are required");
      return;
    }
    const mfgUnix = toUnix(manufactureDate);
    const expUnix = toUnix(expiryDate);
    if (!mfgUnix || !expUnix) {
      Alert.alert("Invalid Date", "Use DD/MM/YYYY format (e.g. 01/01/2025)");
      return;
    }
    if (expUnix <= mfgUnix) {
      Alert.alert("Invalid Date", "Expiry date must be after manufacture date");
      return;
    }

    setLoading(true);
    try {
      // Get manufacturer's exact location
      const { status } = await Location.requestForegroundPermissionsAsync();
      let locationStr = "Factory";
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        locationStr = await getExactLocation(loc.coords.latitude, loc.coords.longitude);
      }
      setMfgLocation(locationStr);

      const res = await registerBatch(
        batchId.trim(),
        medicineName.trim(),
        manufacturer.trim(),
        mfgUnix,
        expUnix
      );

      if (res.data.success) {
        setShowQR(true);
        Animated.parallel([
          Animated.timing(qrAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
        ]).start(() => {
          // Scroll to QR after animation
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        });
      } else {
        Alert.alert("Error", res.data.error || "Registration failed");
      }
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "Blockchain transaction failed");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Generate QR as printable/downloadable PDF - Save to file system
  const handleDownloadQR = async () => {
    try {
      // ✅ Use public QR Code API to generate QR code image
      // QR Server API is free and reliable
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(batchId.trim())}`;

      const htmlContent = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body {
                margin: 0;
                padding: 0;
                background: white;
              }
              .container {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .qr-image img {
                width: 400px;
                height: 400px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <img src="${qrImageUrl}" alt="QR Code" />
            </div>
          </body>
        </html>
      `;

      // ✅ Generate PDF file - prints to system temp location
      const result = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // ✅ Show success alert with PDF location
      Alert.alert(
        "✅ PDF Generated Successfully",
        `QR Code Certificate ready!\n\nFile: QR_${batchId}.pdf\n\nYou can now print or share this document.`,
        [
          {
            text: "Close",
            style: "default",
          },
          {
            text: "Share",
            onPress: async () => {
              try {
                await Sharing.shareAsync(result.uri, {
                  mimeType: "application/pdf",
                  dialogTitle: `Share QR_${batchId}`,
                });
              } catch (err) {
                Alert.alert("Error", "Failed to share PDF");
              }
            },
          },
          {
            text: "Print/View",
            onPress: async () => {
              try {
                await Sharing.shareAsync(result.uri, {
                  mimeType: "application/pdf",
                  UTType: "com.adobe.pdf",
                });
              } catch (err) {
                Alert.alert("Error", "Failed to open PDF");
              }
            },
          },
        ]
      );
    } catch (err) {
      console.log("Download error:", err);
      Alert.alert("Error Generating PDF", "Failed to generate QR certificate.\n\n" + err.message);
    }
  };



  return (
    // KeyboardAvoidingView ensures screen shifts up when keyboard opens
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#080E1A" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.orb} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#94A3B8" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.screenTag}>MANUFACTURER PORTAL</Text>
            <Text style={styles.title}>Register Batch</Text>
          </View>
          <View style={[styles.iconCircle, { backgroundColor: "rgba(59,130,246,0.12)" }]}>
            <Ionicons name="flask-outline" size={22} color="#3B82F6" />
          </View>
        </View>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
          <Text style={styles.infoText}>
            Registering a batch creates an immutable record on the blockchain with your exact GPS location.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Field label="BATCH ID" icon="barcode-outline" value={batchId} onChange={setBatchId}
            placeholder="e.g. BATCH-2024-001" scrollRef={scrollRef} />
          <Field label="MEDICINE NAME" icon="medkit-outline" value={medicineName} onChange={setMedicineName}
            placeholder="e.g. Amoxicillin 500mg" scrollRef={scrollRef} />
          <Field label="MANUFACTURER" icon="business-outline" value={manufacturer} onChange={setManufacturer}
            placeholder="e.g. Sun Pharma" scrollRef={scrollRef} />
          <Field label="MANUFACTURE DATE (DD/MM/YYYY)" icon="calendar-outline"
            value={manufactureDate} onChange={setManufactureDate}
            placeholder="e.g. 01/01/2025" keyboardType="numbers-and-punctuation" scrollRef={scrollRef} />
          <Field label="EXPIRY DATE (DD/MM/YYYY)" icon="calendar-clear-outline"
            value={expiryDate} onChange={setExpiryDate}
            placeholder="e.g. 01/01/2027" keyboardType="numbers-and-punctuation" scrollRef={scrollRef} />

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#3B82F6", "#2563EB"]} style={styles.btnGrad}>
              {loading ? (
                <Text style={styles.btnText}>Registering on Blockchain...</Text>
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.btnText}>  Register Batch</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* QR Card */}
        {showQR && (
          <Animated.View style={[styles.qrCard, { opacity: qrAnim, transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.qrHeader}>
              <Ionicons name="qr-code-outline" size={18} color="#3B82F6" />
              <Text style={styles.qrTitle}>  Batch QR Code</Text>
            </View>
            <Text style={styles.qrSub}>Scan this code to verify product authenticity</Text>

            <View style={styles.qrWrap} ref={qrRef}>
              <View style={styles.qrInner}>
                <QRCode
                  value={batchId.trim()}
                  size={180}
                  backgroundColor="transparent"
                  color="#F1F5F9"
                />
              </View>
            </View>

            {/* Batch meta info */}
            <View style={styles.qrMeta}>
              {[
                ["BATCH ID", batchId],
                ["MEDICINE", medicineName],
                ["MANUFACTURER", manufacturer],
                ["MANUFACTURE DATE", manufactureDate],
                ["EXPIRY DATE", expiryDate],
                ["REGISTERED LOCATION", mfgLocation || "Fetching..."],
              ].map(([label, val]) => (
                <View key={label}>
                  <Text style={styles.qrMetaLabel}>{label}</Text>
                  <Text style={styles.qrMetaVal}>{val}</Text>
                </View>
              ))}
            </View>

            {/* Success badge */}
            <View style={styles.successBadge}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
              <Text style={styles.successText}>  Registered on Blockchain</Text>
            </View>

            {/* ✅ Download QR Button */}
            <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadQR} activeOpacity={0.85}>
              <LinearGradient colors={["#3B82F6", "#2563EB"]} style={styles.downloadBtnGrad}>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.downloadBtnText}>  Download / Print QR</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute", width: 300, height: 300, borderRadius: 150,
    backgroundColor: "rgba(59,130,246,0.06)", top: -80, right: -80,
  },
  scrollContent: { padding: 20, paddingTop: 55 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  headerText: { flex: 1 },
  screenTag: { color: "#3B82F6", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  title: { color: "#F1F5F9", fontSize: 22, fontWeight: "800", marginTop: 2 },
  iconCircle: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  infoBanner: {
    flexDirection: "row", backgroundColor: "rgba(59,130,246,0.08)",
    borderWidth: 1, borderColor: "rgba(59,130,246,0.2)",
    borderRadius: 14, padding: 12, marginBottom: 16, alignItems: "flex-start",
  },
  infoText: { color: "#64748B", fontSize: 12, lineHeight: 18, flex: 1, marginLeft: 8 },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 20, marginBottom: 16,
  },
  btn: { marginTop: 6, borderRadius: 14, overflow: "hidden" },
  btnGrad: { flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 16 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  qrCard: {
    backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1,
    borderColor: "rgba(59,130,246,0.2)", borderRadius: 20, padding: 20,
  },
  qrHeader: { flexDirection: "row", alignItems: "center" },
  qrTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "700" },
  qrSub: { color: "#475569", fontSize: 12, marginTop: 4, marginBottom: 20 },
  qrWrap: { alignItems: "center", marginBottom: 20 },
  qrInner: {
    padding: 20, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  qrMeta: {
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 14, marginBottom: 14,
  },
  qrMetaLabel: { color: "#475569", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 8 },
  qrMetaVal: { color: "#F1F5F9", fontSize: 13, fontWeight: "600", marginTop: 2 },
  successBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(16,185,129,0.1)", borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)", borderRadius: 10, padding: 10,
    marginBottom: 12,
  },
  successText: { color: "#10B981", fontSize: 13, fontWeight: "600" },
  // ✅ Download QR Button
  downloadBtn: { borderRadius: 14, overflow: "hidden", marginBottom: 10 },
  downloadBtnGrad: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    padding: 14,
  },
  downloadBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
