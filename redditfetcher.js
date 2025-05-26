// redditFetcher.js - Handles fetching and initial processing of Reddit posts
const Snoowrap = require("snoowrap");
const {
  analyzeContent,
  analyzePostAndComments,
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

// Main function to fetch and analyze Reddit posts
async function fetchAndAnalyzePosts(subList, keywordList, minScore) {
  let allPosts = [];
  let excludedCount = 0;

  console.log(
    `🎯 Analyzing ${subList.length} subreddits for ${keywordList.length} keywords`
  );

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

          // Analyze comments for high-potential posts
          let commentAnalysis = null;
          if (postAnalysis.score > 20 || post.num_comments > 5) {
            commentAnalysis = await analyzePostAndComments(post);

            // DEBUG: Log comment retrieval status
            console.log(
              `💬 Retrieved ${
                commentAnalysis.commentCount || 0
              } comments for post: "${post.title.slice(0, 30)}..."`
            );
            if (commentAnalysis.sampleComment) {
              console.log(
                `💬 Sample comment: "${commentAnalysis.sampleComment.slice(
                  0,
                  100
                )}..."`
              );
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

  // Calculate stats
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
  };

  return { posts: unique, stats, excludedCount };
}

module.exports = { fetchAndAnalyzePosts };
