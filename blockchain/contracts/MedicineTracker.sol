// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MedicineTracker {

    struct Batch {
        string medicineName;
        string manufacturer;
        uint256 manufactureDate;
        uint256 expiryDate;
        string status;
        uint256 scanCount;
        bool exists;
        string[] history;
        string[] locations;
        string[] scanLocations; // NEW: stores GPS coords of each consumer scan
    }

    mapping(string => Batch) private batches;

    // REGISTER MEDICINE BATCH
    function registerBatch(
        string memory batchId,
        string memory medicineName,
        string memory manufacturer,
        uint256 manufactureDate,
        uint256 expiryDate
    ) public {

        require(!batches[batchId].exists, "Batch already exists");

        Batch storage b = batches[batchId];

        b.medicineName = medicineName;
        b.manufacturer = manufacturer;
        b.manufactureDate = manufactureDate;
        b.expiryDate = expiryDate;
        b.status = "Manufactured";
        b.scanCount = 0;
        b.exists = true;

        b.history.push("Manufactured");
        b.locations.push("Factory");
    }

    // UPDATE STATUS + LOCATION (Distributor / Medical Shop)
    function updateStatus(
        string memory batchId,
        string memory status,
        string memory location
    ) public {

        require(batches[batchId].exists, "Batch not found");

        batches[batchId].status = status;
        batches[batchId].history.push(status);
        batches[batchId].locations.push(location);
    }

    // INCREMENT SCAN COUNT + STORE CONSUMER SCAN LOCATION (UPDATED)
    function scanBatch(
        string memory batchId,
        string memory scanLocation
    ) public {

        require(batches[batchId].exists, "Fake medicine detected");

        batches[batchId].scanCount += 1;
        batches[batchId].scanLocations.push(scanLocation); // NEW
    }

    // GET FULL BATCH DETAILS (UPDATED: returns scanLocations)
    function getBatchHistory(string memory batchId)
        public
        view
        returns (
            string memory,    // medicineName
            string memory,    // manufacturer
            string memory,    // status
            uint256,          // manufactureDate
            uint256,          // expiryDate
            string memory,    // status (kept for compatibility)
            uint256,          // scanCount
            string[] memory,  // history
            string[] memory,  // locations (supply chain)
            string[] memory   // scanLocations (consumer GPS) NEW
        )
    {
        require(batches[batchId].exists, "Batch not found");

        Batch storage b = batches[batchId];

        return (
            b.medicineName,
            b.manufacturer,
            b.status,
            b.manufactureDate,
            b.expiryDate,
            b.status,
            b.scanCount,
            b.history,
            b.locations,
            b.scanLocations  // NEW
        );
    }
}
