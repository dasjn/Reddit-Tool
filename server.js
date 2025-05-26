// server.js - Main server file with routes
const express = require("express");
const cors = require("cors");
const path = require("path");
const { fetchAndAnalyzePosts } = require("./redditfetcher");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static("."));

// Main posts endpoint
app.get("/api/posts", async (req, res) => {
  console.log("🔍 API request received:", req.query);

  const { subreddits, keywords, minScore = 1 } = req.query;
  const subList = subreddits?.split(",").map((s) => s.trim()) || [];
  const keywordList = keywords?.split(",").map((k) => k.trim()) || [];

  try {
    const { posts, stats, excludedCount } = await fetchAndAnalyzePosts(
      subList,
      keywordList,
      parseInt(minScore)
    );

    console.log(
      `✅ Returning ${posts.length} qualified leads (excluded ${excludedCount} irrelevant posts)`
    );
    res.json({ posts, stats });
  } catch (err) {
    console.error("💥 API Error:", err);
    res.status(500).json({
      error: "Failed to fetch Reddit posts",
      details: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    version: "3.0-smart-filters",
    timestamp: new Date().toISOString(),
    features: [
      "smart-exclusion",
      "contextual-scoring",
      "subreddit-tiers",
      "age-penalties",
      "engagement-quality",
    ],
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Reddit Intelligence API running on http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});
