import axios from "axios";

const BASE_URL = "http://192.168.29.225:5000";

// Sends all 5 required fields to backend
export const registerBatch = (
  batchId,
  medicineName,
  manufacturer,
  manufactureDate,
  expiryDate
) => {
  return axios.post(`${BASE_URL}/api/register`, {
    batchId,
    medicineName,
    manufacturer,
    manufactureDate, // Unix timestamp in seconds
    expiryDate,      // Unix timestamp in seconds
  });
};

// Sends location along with status update
export const updateStatus = (batchId, status, location) => {
  return axios.post(`${BASE_URL}/api/update-status`, {
    batchId,
    status,
    location: location || "Unknown",
  });
};

// Gets current status of batch (for verification after update)
export const getStatus = (batchId) => {
  return axios.get(`${BASE_URL}/api/status/${batchId}`);
};

// Gets full batch details for display (used after updates)
export const getBatchDetails = (batchId, location = "Unknown") => {
  return axios.get(`${BASE_URL}/api/verify/${batchId}?location=${encodeURIComponent(location)}`);
};
