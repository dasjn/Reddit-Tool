// redditFetcher.js - Actualización con debug mejorado para comentarios
const Snoowrap = require("snoowrap");
const {
  analyzeContent,
  analyzePostAndCommentsWithDebug,
  debugCommentStructure,
  testCommentAnalysis,
  calculatePriorityScore,
  detectSignals,
  categorizePost,
  generateInsights,
  shouldExcludePost,
  hasRelevantKeywords,
  getSubredditMultiplier,
  getAgePenalty,
  getEngagementQuality,
  getTimeAgo,
} = require("./redditAnalyzer");

// Setup Reddit client
const r = new Snoowrap({
  userAgent: "RedditIntelligenceBot/1.0",
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD,
});

// Configuración de debug
const DEBUG_CONFIG = {
  enableCommentDebug: process.env.DEBUG_COMMENTS === "true", // Activa con DEBUG_COMMENTS=true
  maxDebugPosts: parseInt(process.env.DEBUG_MAX_POSTS) || 3, // Máximo posts para debug completo
  logCommentStructure: process.env.LOG_COMMENT_STRUCTURE === "true",
  testSpecificPost: process.env.TEST_POST_URL || null, // URL específica para testing
};

console.log("🔧 Debug configuration:", DEBUG_CONFIG);

// Función para testing de comentarios específicos
async function runCommentTests() {
  if (DEBUG_CONFIG.testSpecificPost) {
    console.log("\n🧪 === RUNNING COMMENT ANALYSIS TEST ===");
    const testResult = await testCommentAnalysis(
      DEBUG_CONFIG.testSpecificPost,
      r
    );
    console.log("Test completed:", testResult.success ? "✅" : "❌");
    return testResult;
  }
  return null;
}

// Main function to fetch and analyze Reddit posts (con debug mejorado)
async function fetchAndAnalyzePosts(subList, keywordList, minScore) {
  let allPosts = [];
  let excludedCount = 0;
  let debugCounter = 0;

  // Ejecutar test específico si está configurado
  if (DEBUG_CONFIG.testSpecificPost) {
    await runCommentTests();
  }

  console.log(
    `🎯 Analyzing ${subList.length} subreddits for ${keywordList.length} keywords`
  );

  if (DEBUG_CONFIG.enableCommentDebug) {
    console.log(
      `🔍 DEBUG MODE: Will analyze comments in detail for first ${DEBUG_CONFIG.maxDebugPosts} high-potential posts`
    );
  }

  for (const sub of subList) {
    console.log(`📊 Processing r/${sub}...`);

    try {
      // Fetch multiple post types
      const [hot, fresh, rising, top] = await Promise.all([
        r.getSubreddit(sub).getHot({ limit: 75 }),
        r.getSubreddit(sub).getNew({ limit: 50 }),
        r.getSubreddit(sub).getRising({ limit: 25 }),
        r.getSubreddit(sub).getTop({ time: "week", limit: 25 }),
      ]);

      const posts = [...hot, ...fresh, ...rising, ...top];
      console.log(`📈 Found ${posts.length} posts in r/${sub}`);

      for (const post of posts) {
        try {
          const content = `${post.title} ${post.selftext || ""}`;

          // Basic filters
          if (post.score < minScore) continue;
          if (post.removed || post.author.name === "[deleted]") continue;

          // SMART EXCLUSION FILTERS
          if (shouldExcludePost(post)) {
            excludedCount++;
            continue;
          }

          // Enhanced keyword filtering
          if (!hasRelevantKeywords(content, keywordList)) continue;

          // Analyze post content
          const postAnalysis = analyzeContent(content);

          // ENHANCED COMMENT ANALYSIS WITH DEBUG
          let commentAnalysis = null;
          const shouldAnalyzeComments =
            postAnalysis.score > 20 || post.num_comments > 5;

          if (shouldAnalyzeComments) {
            const enableDebugForThisPost =
              DEBUG_CONFIG.enableCommentDebug &&
              debugCounter < DEBUG_CONFIG.maxDebugPosts;

            if (enableDebugForThisPost) {
              console.log(
                `\n🔍 === DEBUG ANALYSIS ${debugCounter + 1}/${
                  DEBUG_CONFIG.maxDebugPosts
                } ===`
              );
              debugCounter++;
            }
          }

          // ENHANCED PRIORITY SCORING WITH CONTEXTUAL FACTORS
          const priorityScore = calculatePriorityScore(
            post,
            postAnalysis,
            commentAnalysis
          );
          const signals = detectSignals(postAnalysis, commentAnalysis);
          const category = categorizePost(priorityScore);
          const insights = generateInsights(
            post,
            signals,
            postAnalysis,
            commentAnalysis
          );

          // Higher threshold for inclusion with contextual scoring
          if (priorityScore < 15 && !signals.hire) continue;

          // Get subreddit info for display
          const subredditInfo = getSubredditMultiplier(
            post.subreddit.display_name
          );

          allPosts.push({
            title: post.title,
            excerpt: post.selftext?.slice(0, 600) || "",
            subreddit: post.subreddit.display_name,
            score: post.score,
            comments: post.num_comments,
            date: new Date(post.created_utc * 1000).toISOString().split("T")[0],
            url: `https://reddit.com${post.permalink}`,
            priorityScore,
            category,
            signals,
            insights,
            author: post.author.name,
            upvoteRatio: post.upvote_ratio || 0,
            matchedSignals:
              postAnalysis.matches.length +
              (commentAnalysis?.matches.length || 0),
            hasCommentAnalysis: !!commentAnalysis,
            timeAgo: getTimeAgo(post.created_utc),
            subredditTier: subredditInfo.tier,
            agePenalty: getAgePenalty(post.created_utc),
            engagementQuality: getEngagementQuality(post),
            // NUEVOS CAMPOS DE DEBUG
            commentAnalysisScore: commentAnalysis?.score || 0,
            commentsProcessed: commentAnalysis?.processedComments || 0,
            commentsSkipped: commentAnalysis?.skippedComments || 0,
            commentSignals: commentAnalysis?.matches?.length || 0,
            hasCommentError: !!commentAnalysis?.error,
            commentDebugApplied: !!commentAnalysis?.debugInfo,
          });
        } catch (postError) {
          console.log(`⚠️ Error processing post: ${postError.message}`);
          continue;
        }
      }

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (subError) {
      console.log(`❌ Error with r/${sub}: ${subError.message}`);
      continue;
    }
  }

  // Enhanced deduplication and sorting
  const unique = allPosts
    .filter((p, i, self) => i === self.findIndex((q) => q.url === p.url))
    .sort((a, b) => {
      // Prioritize high-scoring posts with hire signals from premium subreddits
      if (a.signals.hire && !b.signals.hire) return -1;
      if (!a.signals.hire && b.signals.hire) return 1;
      if (a.subredditTier === "premium" && b.subredditTier !== "premium")
        return -1;
      if (a.subredditTier !== "premium" && b.subredditTier === "premium")
        return 1;
      return b.priorityScore - a.priorityScore;
    });

  // Calculate enhanced stats with comment analysis info
  const stats = {
    total: unique.length,
    excluded: excludedCount,
    hot: unique.filter((p) => p.category === "hot").length,
    warm: unique.filter((p) => p.category === "warm").length,
    cold: unique.filter((p) => p.category === "cold").length,
    withBudgetSignals: unique.filter((p) => p.signals.budget).length,
    withHireSignals: unique.filter((p) => p.signals.hire).length,
    withUrgentSignals: unique.filter((p) => p.signals.urgent).length,
    decisionMakers: unique.filter((p) => p.signals.decision).length,
    averageScore:
      Math.round(
        unique.reduce((sum, p) => sum + p.priorityScore, 0) / unique.length
      ) || 0,
    withCommentAnalysis: unique.filter((p) => p.hasCommentAnalysis).length,
    premiumSources: unique.filter((p) => p.subredditTier === "premium").length,
    qualitySources: unique.filter((p) => p.subredditTier === "quality").length,
    // NUEVAS ESTADÍSTICAS DE COMENTARIOS
    totalCommentsProcessed: unique.reduce(
      (sum, p) => sum + (p.commentsProcessed || 0),
      0
    ),
    totalCommentsSkipped: unique.reduce(
      (sum, p) => sum + (p.commentsSkipped || 0),
      0
    ),
    postsWithCommentSignals: unique.filter((p) => p.commentSignals > 0).length,
    averageCommentScore:
      Math.round(
        unique.reduce((sum, p) => sum + (p.commentAnalysisScore || 0), 0) /
          unique.length
      ) || 0,
    commentErrorsFound: unique.filter((p) => p.hasCommentError).length,
    debuggedPosts: unique.filter((p) => p.commentDebugApplied).length,
  };

  // Log resumen del análisis de comentarios
  console.log("\n📊 === COMMENT ANALYSIS SUMMARY ===");
  console.log(
    `Posts with comment analysis: ${stats.withCommentAnalysis}/${stats.total}`
  );
  console.log(
    `Comments processed: ${stats.totalCommentsProcessed} (skipped: ${stats.totalCommentsSkipped})`
  );
  console.log(`Posts with comment signals: ${stats.postsWithCommentSignals}`);
  console.log(`Comment errors: ${stats.commentErrorsFound}`);
  console.log(`Debug applied to: ${stats.debuggedPosts} posts`);

  return { posts: unique, stats, excludedCount };
}

// Función auxiliar para debugging manual
async function debugSpecificPost(postUrl) {
  return await testCommentAnalysis(postUrl, r);
}

module.exports = {
  fetchAndAnalyzePosts,
  debugSpecificPost,
  runCommentTests,
};
