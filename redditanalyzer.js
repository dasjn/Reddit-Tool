// redditAnalyzer.js - Handles analysis, scoring, and categorization logic
import { signalPatterns, exclusionPatterns, subredditTiers } from "./data";

// Check if post should be excluded
function shouldExcludePost(post) {
  const content = `${post.title} ${post.selftext || ""}`.toLowerCase();

  for (const [category, patterns] of Object.entries(exclusionPatterns)) {
    for (const pattern of patterns) {
      if (content.includes(pattern.phrase.toLowerCase())) {
        // Strong exclusion signals
        if (pattern.weight >= 80) {
          console.log(
            `🚫 Excluded: ${category} - "${
              pattern.phrase
            }" in post: ${post.title.slice(0, 50)}...`
          );
          return true;
        }
        // Moderate exclusion signals (accumulate score)
        if (pattern.weight >= 50) {
          // Check for multiple moderate signals
          const moderateMatches = patterns.filter(
            (p) => content.includes(p.phrase.toLowerCase()) && p.weight >= 50
          ).length;
          if (moderateMatches >= 2) {
            console.log(
              `🚫 Excluded: Multiple ${category} signals in post: ${post.title.slice(
                0,
                50
              )}...`
            );
            return true;
          }
        }
      }
    }
  }

  return false;
}

// Get subreddit tier and multiplier
function getSubredditMultiplier(subredditName) {
  const name = subredditName.toLowerCase();

  for (const [tier, config] of Object.entries(subredditTiers)) {
    if (config.subreddits.includes(name)) {
      return { tier, multiplier: config.multiplier };
    }
  }

  return { tier: "standard", multiplier: 1.0 };
}

// Calculate post age penalty
function getAgePenalty(createdUtc) {
  const now = Date.now() / 1000;
  const ageInHours = (now - createdUtc) / 3600;
  const ageInDays = ageInHours / 24;

  // No penalty for first 24 hours
  if (ageInDays <= 1) return 1.0;

  // Gradual penalty after 1 day
  if (ageInDays <= 3) return 0.95;
  if (ageInDays <= 7) return 0.85;
  if (ageInDays <= 14) return 0.65;

  // Heavy penalty for very old posts
  return 0.3;
}

// Calculate engagement quality bonus
function getEngagementQuality(post) {
  const ratio = post.num_comments / Math.max(post.score, 1);
  const upvoteRatio = post.upvote_ratio || 0.5;

  let qualityBonus = 1.0;

  // High comment-to-upvote ratio indicates engagement
  if (ratio > 0.3) qualityBonus += 0.15;
  if (ratio > 0.5) qualityBonus += 0.1;

  // High upvote ratio indicates quality
  if (upvoteRatio > 0.8) qualityBonus += 0.1;
  if (upvoteRatio > 0.9) qualityBonus += 0.05;

  // Avoid posts with too many comments vs score (might be controversial)
  if (ratio > 2.0 && upvoteRatio < 0.6) qualityBonus -= 0.2;

  return Math.max(qualityBonus, 0.5);
}

// Enhanced pattern matching with fuzzy logic
function analyzeContent(text) {
  if (!text) return { score: 0, matches: [] };

  const lowerText = text.toLowerCase();
  let score = 0;
  const matches = [];

  Object.entries(signalPatterns).forEach(([category, subcategories]) => {
    Object.entries(subcategories).forEach(([subcat, items]) => {
      items.forEach((item) => {
        const phrase = item.phrase.toLowerCase();
        const weight = item.weight;

        // Exact match gets full weight
        if (lowerText.includes(phrase)) {
          score += weight;
          matches.push({ phrase, weight, category, subcat });
          return;
        }

        // Fuzzy matching for partial phrases
        const words = phrase.split(" ");
        const matchedWords = words.filter((word) => lowerText.includes(word));
        if (matchedWords.length >= Math.ceil(words.length * 0.7)) {
          const partialWeight = Math.round(
            weight * (matchedWords.length / words.length)
          );
          score += partialWeight;
          matches.push({
            phrase,
            weight: partialWeight,
            category,
            subcat,
            partial: true,
          });
        }
      });
    });
  });

  return { score, matches };
}

// Analyze both post and top comments
async function analyzePostAndComments(post) {
  try {
    // Get top comments (limit to avoid rate limiting)
    const comments = await post.comments.slice(0, 10);

    // Add these for debugging
    let commentCount = comments.length;
    let sampleComment = comments[0]?.body || "";

    let commentAnalysis = {
      score: 0,
      matches: [],
      insights: [],
      commentCount,
      sampleComment,
    };

    for (const comment of comments) {
      if (comment.body && comment.body !== "[deleted]" && comment.score > 1) {
        const analysis = analyzeContent(comment.body);
        commentAnalysis.score += analysis.score * 0.3; // Comments get 30% weight
        commentAnalysis.matches.push(...analysis.matches);

        // Check for hiring responses in comments
        if (analysis.matches.some((m) => m.category === "hire")) {
          commentAnalysis.insights.push("💬 Hiring discussion in comments");
        }
      }
    }

    return commentAnalysis;
  } catch (error) {
    console.log("Error analyzing comments:", error.message);
    return { score: 0, matches: [], insights: [], commentCount: 0 };
  }
}

// Enhanced priority scoring with contextual factors
function calculatePriorityScore(post, postAnalysis, commentAnalysis = null) {
  let score = 0;

  // Base engagement (reduced weight to focus on content quality)
  score += Math.min(post.score / 15, 15);
  score += Math.min(post.num_comments / 8, 12);

  // Content analysis score (primary factor)
  score += postAnalysis.score;

  // Comment analysis bonus
  if (commentAnalysis) {
    score += commentAnalysis.score;
  }

  // Quality multipliers
  const hasDirectHire = postAnalysis.matches.some(
    (m) => m.category === "hire" && m.subcat === "direct"
  );
  const hasBudget = postAnalysis.matches.some((m) => m.category === "budget");
  const hasUrgency = postAnalysis.matches.some((m) => m.category === "urgent");
  const hasAuthority = postAnalysis.matches.some(
    (m) => m.category === "decision" && m.subcat === "authority"
  );

  // Combo bonuses
  if (hasDirectHire && hasBudget) score += 25;
  if (hasAuthority && hasUrgency) score += 20;
  if (hasDirectHire && hasUrgency) score += 15;

  // Title relevance bonus
  const titleAnalysis = analyzeContent(post.title);
  if (titleAnalysis.score > 0) score += titleAnalysis.score * 0.5;

  // CONTEXTUAL SCORING ENHANCEMENTS

  // 1. Subreddit quality multiplier
  const subredditInfo = getSubredditMultiplier(post.subreddit.display_name);
  score *= subredditInfo.multiplier;

  // 2. Age penalty
  const agePenalty = getAgePenalty(post.created_utc);
  score *= agePenalty;

  // 3. Engagement quality bonus
  const engagementBonus = getEngagementQuality(post);
  score *= engagementBonus;

  // Engagement quality bonus (original logic)
  if (post.upvote_ratio > 0.8) score += 5;
  if (post.num_comments > post.score * 0.1) score += 8; // High comment-to-upvote ratio

  return Math.min(Math.round(score), 100);
}

// Enhanced signal detection
function detectSignals(postAnalysis, commentAnalysis = null) {
  const allMatches = [...postAnalysis.matches];
  if (commentAnalysis) {
    allMatches.push(...commentAnalysis.matches);
  }

  return {
    hire: allMatches.some((m) => m.category === "hire"),
    budget: allMatches.some((m) => m.category === "budget"),
    urgent: allMatches.some((m) => m.category === "urgent"),
    strategic: allMatches.some((m) => m.category === "strategic"),
    decision: allMatches.some((m) => m.category === "decision"),
    competitor: allMatches.some((m) => m.category === "competitor"),
    quality: allMatches.some((m) => m.category === "quality"),
  };
}

// Enhanced categorization
function categorizePost(score) {
  if (score >= 65) return "hot";
  if (score >= 35) return "warm";
  return "cold";
}

// Advanced insight generation
function generateInsights(post, signals, postAnalysis, commentAnalysis = null) {
  const insights = [];
  const allMatches = [...postAnalysis.matches];
  if (commentAnalysis) allMatches.push(...commentAnalysis.matches);

  // Subreddit context insight
  const subredditInfo = getSubredditMultiplier(post.subreddit.display_name);
  if (subredditInfo.tier === "premium") {
    insights.push("🏆 Premium subreddit source");
  }

  // Age context insight
  const ageInDays = (Date.now() / 1000 - post.created_utc) / 86400;
  if (ageInDays < 1) {
    insights.push("🔥 Fresh post (< 24h)");
  } else if (ageInDays > 7) {
    insights.push("⏰ Older post - check relevance");
  }

  // Primary insights
  if (signals.hire && signals.budget) {
    insights.push("💰 Ready to hire with budget signals");
  }
  if (signals.decision && signals.urgent) {
    insights.push("⚡ Decision maker expressing urgency");
  }
  if (signals.strategic && signals.hire) {
    insights.push("🚀 Strategic growth hiring opportunity");
  }
  if (signals.competitor && signals.hire) {
    insights.push("🎯 Competitor dissatisfaction + hiring intent");
  }
  if (signals.quality && signals.budget) {
    insights.push("💎 Quality-focused client with budget");
  }

  // Engagement insights
  if (post.num_comments > 15) {
    insights.push("🗣️ High engagement thread");
  }
  if (post.score > 100) {
    insights.push("📈 Viral post with visibility");
  }
  if (post.upvote_ratio > 0.9) {
    insights.push("👍 Highly positive reception");
  }

  // Authority insights
  const hasFounder = allMatches.some(
    (m) => m.phrase.includes("founder") || m.phrase.includes("ceo")
  );
  if (hasFounder) {
    insights.push("👑 C-level executive posting");
  }

  // Pain point insights
  const hasPain = allMatches.some(
    (m) => m.category === "hire" && m.subcat === "pain"
  );
  if (hasPain) {
    insights.push("🎯 Expressing clear pain points");
  }

  // Timeline insights
  const hasDeadline = allMatches.some(
    (m) => m.phrase.includes("deadline") || m.phrase.includes("asap")
  );
  if (hasDeadline) {
    insights.push("⏰ Time-sensitive opportunity");
  }

  // Comment insights
  if (commentAnalysis && commentAnalysis.insights.length > 0) {
    insights.push(...commentAnalysis.insights);
  }

  return insights;
}

// Enhanced keyword matching
function hasRelevantKeywords(content, keywordList) {
  if (!keywordList || keywordList.length === 0) return true;

  const lowerContent = content.toLowerCase();

  return keywordList.some((keyword) => {
    const lowerKeyword = keyword.toLowerCase();

    // Exact phrase match
    if (lowerContent.includes(lowerKeyword)) return true;

    // Individual word matching for multi-word keywords
    const keywordWords = lowerKeyword.split(" ");
    if (keywordWords.length > 1) {
      const matchedWords = keywordWords.filter((word) =>
        lowerContent.includes(word)
      );
      return matchedWords.length >= Math.ceil(keywordWords.length * 0.7);
    }

    // Partial word matching for single words (minimum 4 characters)
    if (lowerKeyword.length >= 4) {
      return lowerContent.includes(lowerKeyword.slice(0, -1));
    }

    return false;
  });
}

function getTimeAgo(timestamp) {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

module.exports = {
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
};
