require("dotenv").config();

const express = require("express");
const cors = require("cors");
const contract = require("./contract");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend API is running");
});

/**
 * VERIFY MEDICINE (Consumer)
 * GET /api/verify/:batchId?location=lat,lng
 */
app.get("/api/verify/:batchId", async (req, res) => {
  const { batchId } = req.params;
  const scanLocation = req.query.location || "Unknown";

  try {
    // scanBatch requires batchId and scanLocation
    const scanTx = await contract.scanBatch(batchId, scanLocation);
    await scanTx.wait();

    const data = await contract.getBatchHistory(batchId);

    const expiryDate = Number(data[4]);
    const scanCount = Number(data[6]);
    const now = Math.floor(Date.now() / 1000);

    const isExpired = expiryDate < now;
    const isSuspicious = scanCount > 10;

    res.json({
      authentic: true,
      batchId: batchId,  // ✅ Added: frontend needs this for refresh
      medicineName: data[0],
      manufacturer: data[1],
      status: data[2],
      manufactureDate: Number(data[3]),
      expiryDate: expiryDate,
      scanCount: scanCount,
      history: data[7],
      locations: data[8],
      scanLocations: data[9],   // ✅ FIX: was missing, consumer scan locations never showed
      scanLocation: scanLocation,
      isExpired: isExpired,
      isSuspicious: isSuspicious,
    });

  } catch (error) {
    console.log("VERIFY ERROR:", error.reason || error.message);
    res.status(404).json({
      authentic: false,
      message: "Fake medicine detected",
    });
  }
});

/**
 * REGISTER MEDICINE (Manufacturer)
 * POST /api/register
 */
app.post("/api/register", async (req, res) => {
  const { batchId, medicineName, manufacturer, manufactureDate, expiryDate } = req.body;

  if (!batchId || !medicineName || !manufacturer || !manufactureDate || !expiryDate) {
    return res.status(400).json({ success: false, error: "All fields are required" });
  }

  try {
    // ✅ Check if batch already exists before attempting registration
    try {
      await contract.getBatchHistory(batchId);
      // If we reach here, batch exists
      return res.status(400).json({ success: false, error: "Batch ID already exists. Use a different ID." });
    } catch (e) {
      // Batch doesn't exist, proceed with registration
    }

    const tx = await contract.registerBatch(
      batchId,
      medicineName,
      manufacturer,
      Number(manufactureDate),
      Number(expiryDate)
    );
    await tx.wait();

    res.json({ success: true, message: "Batch registered successfully" });

  } catch (err) {
    console.log("REGISTER ERROR:", err.reason || err.message);
    res.status(400).json({ success: false, error: err.reason || err.message });
  }
});

/**
 * UPDATE STATUS (Distributor / Medical Shop)
 * POST /api/update-status
 */
app.post("/api/update-status", async (req, res) => {
  const { batchId, status, location } = req.body;

  // ✅ FIX: validate required fields — missing batchId caused silent blockchain crash
  if (!batchId || !status) {
    return res.status(400).json({ success: false, error: "batchId and status are required" });
  }

  console.log(`UPDATE STATUS → batchId: "${batchId}", status: "${status}", location: "${location}"`);

  try {
    // ✅ Check if batch exists BEFORE attempting update
    try {
      await contract.getBatchHistory(batchId);
    } catch (checkErr) {
      console.log("BATCH CHECK ERROR:", checkErr.message);
      return res.status(404).json({ success: false, error: `Batch "${batchId}" not found. Register it first as Manufacturer.` });
    }

    const tx = await contract.updateStatus(batchId, status, location || "Unknown");
    await tx.wait();

    console.log(`SUCCESS → "${batchId}" updated to "${status}"`);
    res.json({ success: true, message: "Status updated successfully" });

  } catch (error) {
    console.log("UPDATE ERROR:", error.reason || error.message);
    // Better error message parsing
    let errorMsg = error.reason || error.message || "Update failed";
    if (errorMsg.includes("Batch not found")) {
      errorMsg = `Batch "${batchId}" not found. Register it first.`;
    }
    res.status(400).json({ success: false, error: errorMsg });
  }
});

/**
 * GET CURRENT STATUS (Medical Shop verification)
 * GET /api/status/:batchId
 */
app.get("/api/status/:batchId", async (req, res) => {
  const { batchId } = req.params;

  try {
    const data = await contract.getBatchHistory(batchId);

    res.json({
      success: true,
      batchId: batchId,
      medicineName: data[0],
      manufacturer: data[1],
      currentStatus: data[2],
      history: data[7],
      locations: data[8],
    });

  } catch (error) {
    console.log("STATUS CHECK ERROR:", error.reason || error.message);
    res.status(404).json({ success: false, error: "Batch not found" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
