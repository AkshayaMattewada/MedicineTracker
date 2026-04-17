import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import axios from "axios";

const BASE_URL = "http://192.168.29.225:5000";

// Converts GPS coords to a readable place name using expo-location
const getPlaceName = async (latitude, longitude) => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const r = results[0];
      // Filter out plus codes and coordinates, only keep meaningful names
      const parts = [
        r.street && !r.street.match(/^[A-Z0-9\+]+$/) ? r.street : null,
        r.city,
        r.region,
        r.country
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    }
  } catch {
    // fallback to coordinates
  }
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
};

export default function ConsumerScreen({ navigation }) {

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [userLocation, setUserLocation] = useState(null);     // raw coords for API
  const [userPlaceName, setUserPlaceName] = useState(null);   // human-readable name for display
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get GPS + reverse geocode on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;
        // Get place name for storing on blockchain
        const placeName = await getPlaceName(latitude, longitude);
        setUserLocation(placeName);       // this is what gets sent to blockchain
        setUserPlaceName(placeName);      // this is what gets shown on screen
      }
    })();
  }, []);

  const handleScan = async ({ data }) => {
    if (scanned) return;
    const batchId = data.trim();
    setScanned(true);
    setLoading(true);

    try {
      const locationParam = userLocation || "Unknown";
      const response = await axios.get(
        `${BASE_URL}/api/verify/${batchId}?location=${encodeURIComponent(locationParam)}`
      );

      const resultData = response.data;
      setResult(resultData);

      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

      if (resultData.isExpired) {
        Alert.alert(
          "⚠️ Expired Medicine",
          `${resultData.medicineName} has EXPIRED. Do not consume this medicine.`,
          [{ text: "OK", style: "destructive" }]
        );
      } else if (resultData.isSuspicious) {
        Alert.alert(
          "🚨 Suspicious Scan",
          `This medicine has been scanned ${resultData.scanCount} times. Possible counterfeit QR code.`,
          [{ text: "OK", style: "destructive" }]
        );
      }

    } catch {
      setResult({ authentic: false });
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      Alert.alert(
        "❌ Fake Medicine",
        "This QR code is not registered on the blockchain.",
        [{ text: "OK", style: "destructive" }]
      );
    }

    setLoading(false);
  };

  const refreshData = async () => {
    if (!result || !result.batchId) return;
    setIsRefreshing(true);
    try {
      const locationParam = userLocation || "Unknown";
      const response = await axios.get(
        `${BASE_URL}/api/verify/${result.batchId}?location=${encodeURIComponent(locationParam)}`
      );
      const updatedData = response.data;
      setResult(updatedData);
      
      // Show toast if status changed
      if (updatedData.status !== result.status) {
        Alert.alert(
          "Status Updated",
          `Status changed to: ${updatedData.status}`,
          [{ text: "OK" }]
        );
      }
    } catch (err) {
      Alert.alert("Error", "Failed to refresh data from blockchain");
    } finally {
      setIsRefreshing(false);
    }
  };

  const reset = () => {
    setScanned(false);
    setResult(null);
    fadeAnim.setValue(0);
  };

  if (!permission || !permission.granted) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.orb} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#94A3B8" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.screenTag}>CONSUMER PORTAL</Text>
            <Text style={styles.title}>Scan & Verify</Text>
          </View>
          <View style={[styles.iconCircle, { backgroundColor: "rgba(245,158,11,0.12)" }]}>
            <Ionicons name="scan-outline" size={22} color="#F59E0B" />
          </View>
        </View>
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={48} color="#F59E0B" style={{ marginBottom: 16 }} />
          <Text style={styles.permissionText}>Camera access is needed to scan QR codes</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.85}>
            <LinearGradient colors={["#F59E0B", "#D97706"]} style={styles.permissionBtnGrad}>
              <Text style={styles.permissionBtnText}>Grant Camera Permission</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Verifying on blockchain...</Text>
        <Text style={styles.loadingSubText}>This may take a moment</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.orb} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#94A3B8" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.screenTag}>CONSUMER PORTAL</Text>
          <Text style={styles.title}>Scan & Verify</Text>
        </View>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(245,158,11,0.12)" }]}>
          <Ionicons name="scan-outline" size={22} color="#F59E0B" />
        </View>
      </View>

      {/* Camera */}
      {!scanned && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleScan}
          />
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          <Text style={styles.scanHint}>Point camera at a medicine QR code</Text>
          {/* Show resolved place name on camera screen */}
          {userPlaceName && (
            <View style={styles.locationBadge}>
              <Ionicons name="location-outline" size={12} color="#10B981" />
              <Text style={styles.locationText}>  {userPlaceName}</Text>
            </View>
          )}
        </View>
      )}

      {/* Result */}
      {result && (
        <Animated.ScrollView style={[styles.result, { opacity: fadeAnim }]}>

          {/* Status Banner */}
          <LinearGradient
            colors={result.authentic
              ? ["rgba(16,185,129,0.15)", "rgba(16,185,129,0.05)"]
              : ["rgba(239,68,68,0.15)", "rgba(239,68,68,0.05)"]}
            style={styles.statusBanner}
          >
            <Ionicons
              name={result.authentic ? "shield-checkmark" : "shield-outline"}
              size={28}
              color={result.authentic ? "#10B981" : "#EF4444"}
            />
            <Text style={[styles.statusText, { color: result.authentic ? "#10B981" : "#EF4444" }]}>
              {result.authentic ? "  Authentic Medicine" : "  Fake Medicine"}
            </Text>
          </LinearGradient>

          {/* Alert banners */}
          {result.isExpired && (
            <View style={[styles.alertBox, { borderColor: "rgba(239,68,68,0.3)" }]}>
              <Ionicons name="warning-outline" size={18} color="#EF4444" />
              <Text style={[styles.alertText, { color: "#EF4444" }]}>
                {"  "}⚠️ This medicine has EXPIRED. Do not consume.
              </Text>
            </View>
          )}
          {result.isSuspicious && (
            <View style={[styles.alertBox, { borderColor: "rgba(245,158,11,0.3)" }]}>
              <Ionicons name="alert-circle-outline" size={18} color="#F59E0B" />
              <Text style={[styles.alertText, { color: "#F59E0B" }]}>
                {"  "}🚨 High scan count ({result.scanCount}) — Possible counterfeit.
              </Text>
            </View>
          )}

          {result.authentic && (
            <>
              {/* Medicine Details */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  <Ionicons name="medkit-outline" size={14} color="#F59E0B" />{"  "}MEDICINE DETAILS
                </Text>
                <Row label="Medicine" value={result.medicineName} />
                <Row label="Manufacturer" value={result.manufacturer} />
                <Row label="Status" value={result.status} pill />
                <Row label="Manufactured" value={new Date(result.manufactureDate * 1000).toLocaleDateString()} />
                <Row label="Expiry" value={new Date(result.expiryDate * 1000).toLocaleDateString()} expired={result.isExpired} />
                <Row label="Scan Count" value={String(result.scanCount)} suspicious={result.isSuspicious} />
                {/* Show consumer's resolved place name */}
                <Row label="Your Location" value={userPlaceName || "Unavailable"} />
              </View>

              {/* Supply Chain with place names */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  <Ionicons name="git-branch-outline" size={14} color="#F59E0B" />{"  "}SUPPLY CHAIN JOURNEY
                </Text>
                {result.history.map((item, i) => (
                  <View key={i} style={styles.timelineItem}>
                    <View style={styles.timelineDotWrap}>
                      <View style={styles.timelineDot} />
                      {i < result.history.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineStatus}>{item}</Text>
                      {/* Location name from blockchain */}
                      <View style={styles.timelineLocRow}>
                        <Ionicons name="location-outline" size={11} color="#475569" />
                        <Text style={styles.timelineLocation}>
                          {"  "}{result.locations?.[i] || "N/A"}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}

                {/* Consumer scan locations stored on blockchain */}
                {result.scanLocations?.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <Text style={[styles.cardTitle, { marginTop: 12 }]}>
                      <Ionicons name="eye-outline" size={14} color="#F59E0B" />{"  "}CONSUMER SCAN LOCATIONS
                    </Text>
                    {result.scanLocations.map((loc, i) => (
                      <View key={i} style={styles.timelineItem}>
                        <View style={styles.timelineDotWrap}>
                          <View style={[styles.timelineDot, { backgroundColor: "#F59E0B" }]} />
                          {i < result.scanLocations.length - 1 && <View style={styles.timelineLine} />}
                        </View>
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineStatus}>Consumer Scan #{i + 1}</Text>
                          <View style={styles.timelineLocRow}>
                            <Ionicons name="location-outline" size={11} color="#475569" />
                            <Text style={styles.timelineLocation}>{"  "}{loc}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={reset} activeOpacity={0.85}>
            <LinearGradient colors={["#F59E0B", "#D97706"]} style={styles.resetBtnGrad}>
              <Ionicons name="scan-outline" size={18} color="#fff" />
              <Text style={styles.resetBtnText}>  Scan Another</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshBtn} onPress={refreshData} disabled={isRefreshing} activeOpacity={0.85}>
            <LinearGradient colors={["#3B82F6", "#1E40AF"]} style={styles.refreshBtnGrad}>
              {isRefreshing ? (
                <Ionicons name="sync-outline" size={18} color="#fff" />
              ) : (
                <Ionicons name="refresh-outline" size={18} color="#fff" />
              )}
              <Text style={styles.refreshBtnText}>{isRefreshing ? "  Refreshing..." : "  Refresh Data"}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      )}
    </View>
  );
}

// Reusable detail row component
const Row = ({ label, value, pill, expired, suspicious }) => (
  <>
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      {pill ? (
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{value}</Text>
        </View>
      ) : (
        <Text style={[
          styles.detailVal,
          expired && { color: "#EF4444" },
          suspicious && { color: "#F59E0B" },
        ]}>
          {value}{expired ? "  (EXPIRED)" : ""}
        </Text>
      )}
    </View>
    <View style={styles.divider} />
  </>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080E1A", paddingTop: 55, paddingHorizontal: 20 },
  loadingContainer: { flex: 1, backgroundColor: "#080E1A", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#F1F5F9", fontSize: 16, fontWeight: "600", marginTop: 16 },
  loadingSubText: { color: "#475569", fontSize: 13, marginTop: 6 },
  orb: {
    position: "absolute", width: 260, height: 260, borderRadius: 130,
    backgroundColor: "rgba(245,158,11,0.06)", top: -60, right: -60,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  headerText: { flex: 1 },
  screenTag: { color: "#F59E0B", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  title: { color: "#F1F5F9", fontSize: 22, fontWeight: "800", marginTop: 2 },
  iconCircle: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },

  // Camera
  cameraContainer: { flex: 1, borderRadius: 20, overflow: "hidden", position: "relative", marginBottom: 10 },
  camera: { flex: 1 },
  corner: { position: "absolute", width: 28, height: 28, borderColor: "#F59E0B", borderWidth: 3 },
  topLeft: { top: 16, left: 16, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  topRight: { top: 16, right: 16, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bottomLeft: { bottom: 16, left: 16, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  bottomRight: { bottom: 16, right: 16, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanHint: {
    position: "absolute", bottom: 50, alignSelf: "center",
    color: "rgba(255,255,255,0.7)", fontSize: 13,
    backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  locationBadge: {
    position: "absolute", bottom: 16, alignSelf: "center", flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: "rgba(16,185,129,0.3)",
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  locationText: { color: "#10B981", fontSize: 11 },

  // Result
  result: { flex: 1 },
  statusBanner: {
    flexDirection: "row", alignItems: "center", padding: 16,
    borderRadius: 16, marginBottom: 12, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  statusText: { fontSize: 18, fontWeight: "800" },
  alertBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10,
  },
  alertText: { fontSize: 13, fontWeight: "600", flex: 1 },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, marginBottom: 12,
  },
  cardTitle: { color: "#64748B", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 14 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  detailLabel: { color: "#475569", fontSize: 13 },
  detailVal: { color: "#F1F5F9", fontSize: 13, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.04)" },
  statusPill: {
    backgroundColor: "rgba(16,185,129,0.15)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(16,185,129,0.25)",
  },
  statusPillText: { color: "#10B981", fontSize: 12, fontWeight: "600" },

  // Timeline
  timelineItem: { flexDirection: "row", marginBottom: 4, minHeight: 44 },
  timelineDotWrap: { alignItems: "center", marginRight: 12, width: 10 },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#3B82F6", marginTop: 4, flexShrink: 0,
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: "rgba(59,130,246,0.2)", marginTop: 2 },
  timelineContent: { flex: 1, paddingBottom: 12 },
  timelineStatus: { color: "#F1F5F9", fontSize: 13, fontWeight: "600" },
  timelineLocRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  timelineLocation: { color: "#475569", fontSize: 12 },

  // Permission
  permissionBox: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  permissionText: { color: "#64748B", fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 22 },
  permissionBtn: { width: "100%", borderRadius: 14, overflow: "hidden" },
  permissionBtnGrad: { padding: 16, alignItems: "center" },
  permissionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Reset
  resetBtn: { marginTop: 8, borderRadius: 14, overflow: "hidden" },
  resetBtnGrad: { flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 16 },
  resetBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Refresh
  refreshBtn: { marginTop: 8, borderRadius: 14, overflow: "hidden" },
  refreshBtnGrad: { flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 16 },
  refreshBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
