import * as Location from "expo-location";

export const getLocation = async () => {

  try {

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      alert("Location permission denied");
      return "Unknown Location";
    }

    const location = await Location.getCurrentPositionAsync({});

    const latitude = location.coords.latitude;
    const longitude = location.coords.longitude;

    return `${latitude},${longitude}`;

  } catch (error) {

    console.log("Location error:", error);
    return "Unknown Location";

  }

};