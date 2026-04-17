import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, StyleSheet, Alert,
  TouchableOpacity, Animated, ScrollView, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { updateStatus } from "../services/api";

const ACTIONS = [
  { status: "Shipped", label: "Mark as Shipped", icon: "cube-outline", color: "#3B82F6", desc: "Batch has left the warehouse" },
  { status: "In Transit", label: "In Transit", icon: "car-outline", color: "#8B5CF6", desc: "Currently on the way to destination" },
  { status: "Delivered to Medical Shop", label: "Delivered to Medical Shop", icon: "checkmark-done-outline", color: "#10B981", desc: "Successfully delivered to shop" },
];

// Fast: Returns coords immediately
const formatLocationCoordinates = (latitude, longitude) => {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
};

// Slow: Gets exact place name (for background fetch)
const getExactLocationName = async (latitude, longitude) => {
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
      return parts.length > 0 ? parts.join(", ") : null;
    }
  } catch {}
  return null;
};

// Get coords fast, then fetch place name in background
const fetchLocationWithPlaceName = async () => {
  try {
    console.log("🔍 Requesting location permissions...");
    const { status: permission } = await Location.requestForegroundPermissionsAsync();
    console.log("✅ Permission status:", permission);
    
    if (permission !== "granted") {
      console.log("❌ Location permission not granted");
      return { coords: "Unknown", place: "Unknown" };
    }

    // Get coordinates immediately (fast)
    console.log("🔍 Fetching device location...");
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeout: 5000, // 5 second timeout
    }).catch((err) => {
      console.log("❌ Location fetch error:", err.message);
      return null;
    });

    if (!loc) {
      console.log("❌ Could not get location");
      return { coords: "Unknown", place: "Unknown" };
    }

    const coords = formatLocationCoordinates(loc.coords.latitude, loc.coords.longitude);
    console.log("✅ Coordinates obtained:", coords);

    // Fetch place name with timeout (background, non-blocking)
    const placeNamePromise = getExactLocationName(loc.coords.latitude, loc.coords.longitude);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
    const place = await Promise.race([placeNamePromise, timeoutPromise]);

    return {
      coords,
      place: place || coords,
    };
  } catch (err) {
    console.log("❌ Location initialization error:", err.message);
    return { coords: "Unknown", place: "Unknown" };
  }
};

export default function DistributorScreen({ navigation }) {
  const [batchId, setBatchId] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(null);
  const [lastStatus, setLastStatus] = useState(null);
  const [lastLocation, setLastLocation] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [cachedLocation, setCachedLocation] = useState({ coords: "Unknown", place: "Unknown" });
  const [locationInitialized, setLocationInitialized] = useState(false);
  const successAnim = useRef(new Animated.Value(0)).current;
  const lastUpdateTime = useRef(0);

  // ✅ Fetch initial location on screen load - WAIT for it to complete
  useEffect(() => {
    const initializeLocation = async () => {
      console.log("📍 Initializing location...");
      const location = await fetchLocationWithPlaceName();
      console.log("📍 Location fetched:", location);
      if (location.coords !== "Unknown") {
        setCachedLocation(location);
      }
      setLocationInitialized(true); // Signal that initial fetch is done
    };
    initializeLocation();
  }, []);

  // Optimized: Send API immediately with place name, fetch fresh location in background
  const update = async (status) => {
    if (!batchId.trim()) {
      Alert.alert("Validation", "Please enter a Batch ID first");
      return;
    }

    // Wait for initial location to be fetched
    if (!locationInitialized) {
      console.log("⏳ Waiting for location to initialize...");
      Alert.alert("Location", "Initializing your location... please try again in a moment");
      return;
    }

    // Debounce: prevent rapid clicks
    const now = Date.now();
    if (now - lastUpdateTime.current < 2000) {
      return;
    }
    lastUpdateTime.current = now;

    setLoading(status);
    try {
      // Send API with place name (readable location name)
      console.log("🔄 Updating with location:", cachedLocation.place);
      const res = await updateStatus(batchId.trim(), status, cachedLocation.place);
      if (res.data.success) {
        setLastStatus(status);
        setLastLocation(cachedLocation.place);
        setSelectedAction(status);
        successAnim.setValue(0);
        Animated.timing(successAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

        // Fetch fresh location in background for next update
        const freshLocation = await fetchLocationWithPlaceName();
        console.log("🔄 Fresh location fetched:", freshLocation);
        if (freshLocation.coords !== "Unknown" && freshLocation.coords !== cachedLocation.coords) {
          setCachedLocation(freshLocation);
        }
      } else {
        Alert.alert("Error", res.data.error || "Update failed");
      }
    } catch {
      Alert.alert("Error", "Update failed. Check backend connection.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.orb} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#94A3B8" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.screenTag}>DISTRIBUTOR PORTAL</Text>
            <Text style={styles.title}>Update Status</Text>
          </View>
          <View style={[styles.iconCircle, { backgroundColor: "rgba(139,92,246,0.12)" }]}>
            <Ionicons name="swap-horizontal-outline" size={22} color="#8B5CF6" />
          </View>
        </View>

        {/* Batch ID Input */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>
            <Ionicons name="barcode-outline" size={13} color="#8B5CF6" />{"  "}BATCH ID
          </Text>
          <View style={[styles.inputWrap, focused && styles.inputFocused]}>
            <Ionicons name="search-outline" size={18} color="#475569" style={{ marginLeft: 14 }} />
            <TextInput
              style={styles.input}
              placeholder="Enter batch ID to update"
              placeholderTextColor="#334155"
              value={batchId}
              onChangeText={setBatchId}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>
        </View>

        {/* Success toast */}
        {lastStatus && (
          <Animated.View style={[styles.successToast, { opacity: successAnim }]}>
            <Ionicons name="shield-checkmark" size={18} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.successText}>Status updated → {lastStatus}</Text>
              {lastLocation && (
                <Text style={styles.successLocation}>
                  <Ionicons name="location-outline" size={11} color="#10B981" />{"  "}{lastLocation}
                </Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* Action Cards */}
        <Text style={styles.sectionLabel}>SUPPLY CHAIN ACTIONS</Text>

        {ACTIONS.map((action) => {
          const isSelected = selectedAction === action.status; // NEW
          const isLoading = loading === action.status;
          return (
            <TouchableOpacity
              key={action.status}
              style={[
                styles.actionCard,
                isLoading && { opacity: 0.6 },
                // NEW: highlight selected action with colored border
                isSelected && { borderColor: action.color + "80", borderWidth: 2 },
              ]}
              onPress={() => update(action.status)}
              disabled={!!loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isSelected ? [action.color + "25", action.color + "10"] : [action.color + "14", "transparent"]}
                style={styles.actionGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + "20", borderColor: action.color + "30" }]}>
                  <Ionicons name={action.icon} size={22} color={action.color} />
                </View>
                <View style={styles.actionText}>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                  <Text style={styles.actionDesc}>{action.desc}</Text>
                  {/* NEW: show checkmark + location under selected action */}
                  {isSelected && lastLocation && (
                    <Text style={[styles.actionSelectedLoc, { color: action.color }]}>
                      <Ionicons name="checkmark-circle" size={11} color={action.color} />{"  "}
                      {lastLocation}
                    </Text>
                  )}
                </View>
                <View style={[styles.actionArrow, { backgroundColor: action.color + "15" }]}>
                  {isLoading ? (
                    <Ionicons name="sync-outline" size={16} color={action.color} />
                  ) : isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color={action.color} />
                  ) : (
                    <Ionicons name="arrow-forward" size={16} color={action.color} />
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080E1A", padding: 20, paddingTop: 55 },
  orb: {
    position: "absolute", width: 260, height: 260, borderRadius: 130,
    backgroundColor: "rgba(139,92,246,0.06)", top: -60, right: -60,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  headerText: { flex: 1 },
  screenTag: { color: "#8B5CF6", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  title: { color: "#F1F5F9", fontSize: 22, fontWeight: "800", marginTop: 2 },
  iconCircle: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, marginBottom: 14,
  },
  fieldLabel: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 10 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  inputFocused: { borderColor: "rgba(139,92,246,0.5)" },
  input: { flex: 1, padding: 14, color: "#F1F5F9", fontSize: 15 },
  successToast: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "rgba(16,185,129,0.1)", borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)", borderRadius: 14, padding: 14, marginBottom: 14,
  },
  successText: { color: "#10B981", fontWeight: "600", fontSize: 13 },
  successLocation: { color: "#10B981", fontSize: 11, marginTop: 3, opacity: 0.8 },
  sectionLabel: { color: "#334155", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 12 },
  actionCard: {
    borderRadius: 18, overflow: "hidden", marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  actionGrad: { flexDirection: "row", alignItems: "center", padding: 16 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  actionText: { flex: 1, marginLeft: 14 },
  actionLabel: { color: "#F1F5F9", fontWeight: "700", fontSize: 14 },
  actionDesc: { color: "#475569", fontSize: 12, marginTop: 3 },
  actionSelectedLoc: { fontSize: 11, marginTop: 5, opacity: 0.9 },
  actionArrow: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
});
