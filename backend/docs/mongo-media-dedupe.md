# 🧹 Media Deduplication Specification

## 1. Overview

This document outlines the strategy for identifying and removing duplicate media entries within the Fotis MongoDB database. Duplicates can arise from re-indexing sources or potentially adding the same media through different paths if not handled correctly. The goals are to improve database efficiency, potentially reduce storage requirements if content hashing is added later, and provide a cleaner user experience by avoiding redundant entries.

## 2. Defining Duplicates

For the scope of this initial implementation, a duplicate is defined as **multiple media documents sharing the same `hash` value**.

The current `hash` is generated based on `sourceId` and the file's `relativePath` within that source (`sourceId:relativePath`). This means:
- Identical files within the *same source* scanned multiple times (e.g., during re-indexing) will be identified as duplicates if the prevention mechanism fails or if duplicates already exist.
- Identical files located in *different sources* or *different relative paths within the same source* will currently have *different hashes* and **will not** be treated as duplicates by this mechanism. True content-based deduplication is a potential future enhancement requiring file content analysis.

## 3. Prevention During Indexing

The `Indexer` service will be modified to prevent adding new duplicate entries during scans based on the `hash`.

**Changes:**
- **Location:** `backend/services/indexer.js`
- **Logic:** Within the loop that processes each discovered file:
    1. Generate the `hash` for the file based on `sourceId` and `relativePath`.
    2. **Before** calling `mediaCollection.updateOne({ hash }, { $set: mediaDoc }, { upsert: true })`:
       - Perform a check, for example: `const existing = await mediaCollection.findOne({ hash }, { projection: { _id: 1 } });`
       - If `existing` is found (meaning a document with this `hash` already exists):
         - Log a debug message (e.g., `Duplicate media skipped during indexing: hash=${hash}, path=${file.path}`).
         - **Skip** the `updateOne` call for this file, effectively preventing the creation of a new duplicate entry or unnecessary update of the existing one based solely on re-scanning.
       - If `existing` is `null`, proceed with the `updateOne` call (which will perform an insert because the document doesn't exist and `upsert: true` is used).

**Outcome:** Re-scanning a source should not create new documents for files that already exist in the database with the same `sourceId` and `relativePath`.

## 4. Scheduled Cleanup Service

A new background service will periodically scan the database for existing duplicates (based on `hash`) and remove them, keeping only the oldest entry for each hash.

**Components:**
- **New Service:** `backend/services/deduplicationService.js`
- **Scheduler:** Use `node-cron` within the service for automated execution.
- **Configuration (Environment Variables):**
    - `DEDUPE_ENABLED` (boolean, default: `true`): Master switch to enable/disable the service entirely.
    - `DEDUPE_SCHEDULE` (cron string, default: `0 3 * * *` - 3:00 AM daily): Cron schedule for the cleanup job.

**Logic (`DeduplicationService.runCleanup` method):**
1. Check if `DEDUPE_ENABLED` is true. If not, log an info message and return.
2. Implement a simple locking mechanism (e.g., an `isCleaning` boolean flag in the service instance) to prevent concurrent runs. If already running, log and return.
3. Set `isCleaning = true`. Log the start time and intention (e.g., "Starting media deduplication cleanup...").
4. Use a MongoDB Aggregation Pipeline on the `media` collection:
   ```javascript
   // Example Aggregation Pipeline
   const pipeline = [
     {
       $group: {
         _id: "$hash", // Group documents by the unique hash
         count: { $sum: 1 }, // Count how many documents share the same hash
         docIds: { $push: "$_id" } // Collect the MongoDB ObjectIds of all documents in the group
       }
     },
     {
       $match: {
         count: { $gt: 1 } // Filter to only include groups where the count is greater than 1 (i.e., duplicates exist)
       }
     }
     // Optional: Add $limit for batching if needed
   ];
   const duplicateGroups = await db.collection('media').aggregate(pipeline).toArray();
   ```
5. Log the number of unique hashes found with duplicates (e.g., `Found ${duplicateGroups.length} hashes with duplicate entries.`).
6. Initialize a counter for total removed documents (`totalRemoved = 0`).
7. Iterate through the `duplicateGroups` array:
   - For each `group`:
     - Log processing details (e.g., `Processing hash ${group._id} which has ${group.count} entries.`).
     - **Identify IDs to remove:** Sort the `docIds` array. Since MongoDB ObjectIds contain a timestamp component, sorting them chronologically sorts the documents by creation time. Keep the *first* ID (the oldest document) and collect the rest for deletion.
       ```javascript
       const sortedIds = group.docIds.sort(); // Sorts ObjectIds chronologically
       const idsToRemove = sortedIds.slice(1); // Get all IDs except the first one
       ```
     - **Delete duplicates:** If `idsToRemove.length > 0`:
       ```javascript
       const deleteResult = await db.collection('media').deleteMany({
         _id: { $in: idsToRemove }
       });
       if (deleteResult.deletedCount > 0) {
          logger.info(`Removed ${deleteResult.deletedCount} duplicates for hash ${group._id}.`);
          totalRemoved += deleteResult.deletedCount;
       }
       ```
     - **Optional:** Add a small `await sleep(ms)` here if needed to reduce database load during large cleanup operations.
8. Log the total number of duplicate documents removed during the run (e.g., `Completed deduplication cleanup. Removed ${totalRemoved} duplicate documents.`).
9. Set `isCleaning = false` (preferably in a `finally` block to ensure it's always reset).

**Integration:**
- In `backend/index.js`:
    - Import `DeduplicationService`.
    - Instantiate it: `const deduplicationService = new DeduplicationService(db);`
    - Start its schedule: `await deduplicationService.start();` (assuming an async `start` method that sets up the cron job).
    - Potentially add it to `app.locals` if needed elsewhere: `app.locals.deduplicationService = deduplicationService;`

## 5. API / CLI Integration (Phase 2 - Optional)

While not part of the initial implementation, consider adding administrative controls in the future:

- **API Endpoints (e.g., under `/admin/deduplication`):**
    - `POST /trigger`: Manually start the cleanup job.
    - `GET /status`: Check if cleanup is running, last run time, total removed in last run.
    - `GET /history`: View logs or summaries of past cleanup runs.
- **CLI Commands (e.g., `fotis admin dedupe`):**
    - `fotis admin dedupe start`: Trigger cleanup.
    - `fotis admin dedupe status`: Show current status.

## 6. Schema Changes

No changes to the `media` collection schema are required for this hash-based deduplication approach.

## 7. Future Considerations

- **Content Hashing:** The most robust deduplication involves hashing the actual file content (e.g., using SHA256). This would require reading file content during indexing (expensive, especially for SFTP) and storing the content hash in a new indexed field (e.g., `contentHash`). The cleanup service would then group by `contentHash` instead of the path-based `hash`.
- **Near-Duplicates:** For images, perceptual hashing (like pHash) could identify visually similar but not identical files.
- **User Interface:** A UI could allow users to review and confirm deletions, especially for content-based or near-duplicate detection.