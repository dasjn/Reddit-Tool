// server.js - Main server file with routes
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { fetchAndAnalyzePosts } = require("./redditfetcher");
const { analyzeContent } = require("./redditanalyzer");

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

// ===== PARTE 1: BACKEND - Agregar a server.js =====

// Agregar este endpoint después de la ruta /api/posts en server.js
app.get("/api/analyze-comments/:postId", async (req, res) => {
  console.log("🔍 Comment analysis request for post:", req.params.postId);

  const { postId } = req.params;

  try {
    const commentAnalysis = await analyzeSpecificPostComments(postId);

    console.log(
      `✅ Comment analysis complete for ${postId}: ${commentAnalysis.processedComments} comments analyzed`
    );
    res.json(commentAnalysis);
  } catch (err) {
    console.error("💥 Comment Analysis Error:", err);
    res.status(500).json({
      error: "Failed to analyze post comments",
      details: err.message,
      postId: postId,
      timestamp: new Date().toISOString(),
    });
  }
});

// Agregar esta función al final de server.js (antes de app.listen)
async function analyzeSpecificPostComments(postId) {
  const url = `https://www.reddit.com/comments/${postId}.json`;

  console.log(`🔄 Fetching comments from: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // data[0] es el post, data[1] son los comentarios
    const postData = data[0].data.children[0].data;
    const commentsData = data[1].data.children;

    console.log(
      `📊 Post "${postData.title.slice(0, 50)}..." has ${
        commentsData.length
      } top-level comments`
    );

    // Procesar comentarios
    const processedComments = [];
    let totalAnalysisScore = 0;
    let totalSignals = [];
    let insights = [];

    for (let i = 0; i < commentsData.length; i++) {
      const comment = commentsData[i].data;

      // Filtrar comentarios válidos
      if (
        !comment.body ||
        comment.body === "[deleted]" ||
        comment.body === "[removed]" ||
        comment.body.length < 10 ||
        comment.score < -2
      ) {
        continue;
      }

      // Analizar contenido del comentario usando función existente
      const analysis = analyzeContent(comment.body);

      if (analysis.score > 0) {
        totalAnalysisScore += analysis.score * 0.3; // Comments get 30% weight
        totalSignals.push(
          ...analysis.matches.map((match) => ({
            ...match,
            source: "comment",
            commentIndex: i,
            commentScore: comment.score,
            commentAuthor: comment.author,
          }))
        );

        console.log(
          `   💬 Comment ${i + 1} by u/${comment.author}: ${
            analysis.matches.length
          } signals (score: ${analysis.score})`
        );
      }

      processedComments.push({
        author: comment.author,
        body: comment.body.slice(0, 300), // Primeros 300 caracteres
        score: comment.score,
        created_utc: comment.created_utc,
        analysisScore: analysis.score,
        signals: analysis.matches.length,
        timeAgo: getTimeAgo(comment.created_utc),
      });
    }

    // Generar insights específicos de comentarios
    const budgetSignals = totalSignals.filter(
      (s) => s.category === "budget"
    ).length;
    const hireSignals = totalSignals.filter(
      (s) => s.category === "hire"
    ).length;
    const urgentSignals = totalSignals.filter(
      (s) => s.category === "urgent"
    ).length;
    const decisionSignals = totalSignals.filter(
      (s) => s.category === "decision"
    ).length;

    if (hireSignals > 0)
      insights.push("💼 Hiring discussions detected in comments");
    if (budgetSignals > 0) insights.push("💰 Budget-related discussions found");
    if (urgentSignals > 0) insights.push("⚡ Urgency expressions in comments");
    if (decisionSignals > 0)
      insights.push("👑 Decision makers active in comments");

    // Detectar patrones de conversación
    const authorCount = new Set(processedComments.map((c) => c.author)).size;
    if (authorCount > 5) insights.push("🗣️ Active multi-user discussion");

    const highScoreComments = processedComments.filter(
      (c) => c.score > 5
    ).length;
    if (highScoreComments > 3) insights.push("👍 High-quality comment thread");

    return {
      success: true,
      postId,
      postTitle: postData.title,
      postAuthor: postData.author,
      postScore: postData.score,
      postUrl: `https://reddit.com${postData.permalink}`,

      // Análisis de comentarios
      totalComments: commentsData.length,
      processedComments: processedComments.length,
      analysisScore: Math.round(totalAnalysisScore),

      // Señales detectadas
      signals: {
        hire: hireSignals > 0,
        budget: budgetSignals > 0,
        urgent: urgentSignals > 0,
        decision: decisionSignals > 0,
        strategic:
          totalSignals.filter((s) => s.category === "strategic").length > 0,
        competitor:
          totalSignals.filter((s) => s.category === "competitor").length > 0,
        quality:
          totalSignals.filter((s) => s.category === "quality").length > 0,
      },

      signalCounts: {
        hire: hireSignals,
        budget: budgetSignals,
        urgent: urgentSignals,
        decision: decisionSignals,
        total: totalSignals.length,
      },

      insights,

      // Comentarios más relevantes (top 5 por score de análisis)
      topComments: processedComments
        .filter((c) => c.analysisScore > 0)
        .sort((a, b) => b.analysisScore - a.analysisScore)
        .slice(0, 5),

      // Comentarios más votados
      topVotedComments: processedComments
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),

      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("💥 Error fetching comments:", error);
    throw new Error(`Failed to fetch comments: ${error.message}`);
  }
}

function getTimeAgo(timestamp) {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

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
